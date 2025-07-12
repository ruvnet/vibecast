/**
 * @file multi_gpu_coordinator.cu
 * @brief Multi-GPU memory coordination and synchronization
 * 
 * Implements efficient multi-GPU memory management:
 * - Distributed memory pools across GPUs
 * - Peer-to-peer memory access
 * - Load balancing across GPUs
 * - Coherent memory views
 */

#include <cuda_runtime.h>
#include <cuda.h>
#include <nccl.h>
#include <vector>
#include <map>
#include <unordered_map>
#include <atomic>
#include <mutex>
#include <thread>
#include <condition_variable>
#include <queue>
#include <algorithm>

namespace nvidia_comms {
namespace memory {
namespace multi_gpu {

/**
 * @class MultiGPUCoordinator
 * @brief Coordinates memory management across multiple GPUs
 */
class MultiGPUCoordinator {
private:
    /**
     * @struct GPUInfo
     * @brief Information about each GPU
     */
    struct GPUInfo {
        int device_id;
        cudaDeviceProp properties;
        size_t total_memory;
        size_t available_memory;
        size_t allocated_memory;
        std::unique_ptr<UnifiedMemoryPool> memory_pool;
        std::vector<int> peer_devices;
        double bandwidth_gb_s;
        std::atomic<size_t> active_transfers;
    };
    
    /**
     * @struct MemoryRegion
     * @brief Distributed memory region across GPUs
     */
    struct MemoryRegion {
        std::string name;
        size_t total_size;
        std::map<int, void*> device_pointers;
        std::map<int, size_t> device_sizes;
        bool is_replicated;
        bool is_coherent;
        ncclComm_t nccl_comm;
        std::vector<cudaEvent_t> sync_events;
    };
    
    /**
     * @struct LoadBalanceStrategy
     * @brief Strategy for distributing memory across GPUs
     */
    enum class LoadBalanceStrategy {
        ROUND_ROBIN,
        LEAST_LOADED,
        BANDWIDTH_AWARE,
        AFFINITY_BASED,
        ADAPTIVE
    };
    
    /**
     * @struct TransferRequest
     * @brief Inter-GPU transfer request
     */
    struct TransferRequest {
        void* src;
        void* dst;
        size_t size;
        int src_device;
        int dst_device;
        cudaStream_t stream;
        std::function<void()> callback;
        std::chrono::steady_clock::time_point timestamp;
    };

    // GPU management
    std::vector<GPUInfo> gpus_;
    int num_gpus_;
    std::mutex gpu_mutex_;
    
    // Memory regions
    std::unordered_map<std::string, MemoryRegion> regions_;
    std::mutex regions_mutex_;
    
    // Load balancing
    LoadBalanceStrategy balance_strategy_;
    std::atomic<int> round_robin_counter_{0};
    
    // Transfer queue
    std::queue<TransferRequest> transfer_queue_;
    std::mutex transfer_mutex_;
    std::condition_variable transfer_cv_;
    std::vector<std::thread> transfer_threads_;
    std::atomic<bool> shutdown_{false};
    
    // NCCL communication
    std::vector<ncclComm_t> nccl_comms_;
    
    // Statistics
    std::atomic<size_t> total_transfers_{0};
    std::atomic<size_t> total_bytes_transferred_{0};
    std::atomic<double> total_transfer_time_ms_{0.0};
    
public:
    MultiGPUCoordinator(LoadBalanceStrategy strategy = LoadBalanceStrategy::ADAPTIVE) 
        : balance_strategy_(strategy) {
        initialize();
    }
    
    ~MultiGPUCoordinator() {
        shutdown();
    }
    
    /**
     * @brief Allocate memory region across multiple GPUs
     * @param name Region name
     * @param size Total size to allocate
     * @param replicate Whether to replicate across all GPUs
     * @param devices Specific devices to use (empty = all)
     * @return Success status
     */
    bool allocate_region(const std::string& name, size_t size, 
                        bool replicate = false,
                        const std::vector<int>& devices = {}) {
        std::lock_guard<std::mutex> lock(regions_mutex_);
        
        if (regions_.find(name) != regions_.end()) {
            return false; // Region already exists
        }
        
        MemoryRegion region;
        region.name = name;
        region.total_size = size;
        region.is_replicated = replicate;
        region.is_coherent = replicate;
        
        // Determine target devices
        std::vector<int> target_devices = devices.empty() ? 
            get_all_devices() : devices;
        
        if (replicate) {
            // Allocate full size on each GPU
            for (int device : target_devices) {
                void* ptr = allocate_on_device(device, size);
                if (!ptr) {
                    // Cleanup on failure
                    deallocate_region_internal(region);
                    return false;
                }
                region.device_pointers[device] = ptr;
                region.device_sizes[device] = size;
            }
        } else {
            // Distribute across GPUs
            auto distribution = calculate_distribution(size, target_devices);
            
            for (const auto& [device, alloc_size] : distribution) {
                if (alloc_size > 0) {
                    void* ptr = allocate_on_device(device, alloc_size);
                    if (!ptr) {
                        deallocate_region_internal(region);
                        return false;
                    }
                    region.device_pointers[device] = ptr;
                    region.device_sizes[device] = alloc_size;
                }
            }
        }
        
        // Initialize NCCL for this region if needed
        if (replicate && target_devices.size() > 1) {
            initialize_nccl_for_region(region, target_devices);
        }
        
        // Create synchronization events
        for (size_t i = 0; i < target_devices.size(); ++i) {
            cudaEvent_t event;
            cudaSetDevice(target_devices[i]);
            cudaEventCreate(&event);
            region.sync_events.push_back(event);
        }
        
        regions_[name] = std::move(region);
        return true;
    }
    
    /**
     * @brief Deallocate memory region
     * @param name Region name
     */
    void deallocate_region(const std::string& name) {
        std::lock_guard<std::mutex> lock(regions_mutex_);
        
        auto it = regions_.find(name);
        if (it != regions_.end()) {
            deallocate_region_internal(it->second);
            regions_.erase(it);
        }
    }
    
    /**
     * @brief Get pointer to region on specific device
     * @param name Region name
     * @param device Device ID
     * @return Device pointer or nullptr
     */
    void* get_region_pointer(const std::string& name, int device) {
        std::lock_guard<std::mutex> lock(regions_mutex_);
        
        auto it = regions_.find(name);
        if (it == regions_.end()) return nullptr;
        
        auto ptr_it = it->second.device_pointers.find(device);
        if (ptr_it == it->second.device_pointers.end()) return nullptr;
        
        return ptr_it->second;
    }
    
    /**
     * @brief Synchronize replicated region across GPUs
     * @param name Region name
     * @param source_device Source device for synchronization
     */
    void synchronize_region(const std::string& name, int source_device = -1) {
        std::lock_guard<std::mutex> lock(regions_mutex_);
        
        auto it = regions_.find(name);
        if (it == regions_.end() || !it->second.is_replicated) return;
        
        auto& region = it->second;
        
        if (source_device == -1) {
            // Auto-select source based on most recent update
            source_device = *region.device_pointers.begin();
        }
        
        // Use NCCL broadcast for efficient synchronization
        if (region.nccl_comm) {
            void* src_ptr = region.device_pointers[source_device];
            
            ncclGroupStart();
            for (const auto& [device, ptr] : region.device_pointers) {
                cudaSetDevice(device);
                ncclBroadcast(src_ptr, ptr, region.total_size,
                             ncclChar, source_device, region.nccl_comm,
                             get_stream_for_device(device));
            }
            ncclGroupEnd();
        } else {
            // Fallback to manual synchronization
            manual_synchronize_region(region, source_device);
        }
    }
    
    /**
     * @brief Transfer data between regions
     * @param src_region Source region
     * @param dst_region Destination region
     * @param size Transfer size (0 = entire region)
     * @param async Whether to perform async transfer
     */
    void transfer_between_regions(const std::string& src_region,
                                 const std::string& dst_region,
                                 size_t size = 0, bool async = true) {
        std::lock_guard<std::mutex> lock(regions_mutex_);
        
        auto src_it = regions_.find(src_region);
        auto dst_it = regions_.find(dst_region);
        
        if (src_it == regions_.end() || dst_it == regions_.end()) return;
        
        size_t transfer_size = (size == 0) ? 
            std::min(src_it->second.total_size, dst_it->second.total_size) : size;
        
        // Create transfer plan
        auto transfer_plan = create_transfer_plan(src_it->second, dst_it->second, 
                                                 transfer_size);
        
        // Execute transfers
        for (const auto& transfer : transfer_plan) {
            if (async) {
                enqueue_transfer(transfer);
            } else {
                execute_transfer(transfer);
            }
        }
    }
    
    /**
     * @brief Rebalance memory across GPUs
     * @param name Region name to rebalance
     */
    void rebalance_region(const std::string& name) {
        std::lock_guard<std::mutex> lock1(regions_mutex_);
        std::lock_guard<std::mutex> lock2(gpu_mutex_);
        
        auto it = regions_.find(name);
        if (it == regions_.end() || it->second.is_replicated) return;
        
        auto& region = it->second;
        
        // Calculate new distribution based on current GPU loads
        std::vector<int> devices;
        for (const auto& [device, _] : region.device_pointers) {
            devices.push_back(device);
        }
        
        auto new_distribution = calculate_distribution(region.total_size, devices);
        
        // Create migration plan
        std::vector<TransferRequest> migrations;
        
        for (const auto& [device, new_size] : new_distribution) {
            size_t current_size = region.device_sizes[device];
            
            if (new_size > current_size) {
                // Need to receive data
                size_t needed = new_size - current_size;
                
                // Find donor devices
                for (auto& [donor_device, donor_size] : region.device_sizes) {
                    if (donor_device != device && 
                        donor_size > new_distribution[donor_device]) {
                        
                        size_t available = donor_size - new_distribution[donor_device];
                        size_t transfer = std::min(needed, available);
                        
                        if (transfer > 0) {
                            TransferRequest req;
                            req.src = region.device_pointers[donor_device];
                            req.dst = region.device_pointers[device];
                            req.size = transfer;
                            req.src_device = donor_device;
                            req.dst_device = device;
                            req.stream = get_stream_for_device(device);
                            
                            migrations.push_back(req);
                            
                            needed -= transfer;
                            if (needed == 0) break;
                        }
                    }
                }
            }
        }
        
        // Execute migrations
        for (const auto& migration : migrations) {
            enqueue_transfer(migration);
        }
        
        // Update sizes after migration
        region.device_sizes = new_distribution;
    }
    
    /**
     * @brief Enable peer access between all GPUs
     */
    void enable_peer_access() {
        for (int i = 0; i < num_gpus_; ++i) {
            cudaSetDevice(i);
            
            for (int j = 0; j < num_gpus_; ++j) {
                if (i != j) {
                    int can_access;
                    cudaDeviceCanAccessPeer(&can_access, i, j);
                    
                    if (can_access) {
                        cudaDeviceEnablePeerAccess(j, 0);
                        gpus_[i].peer_devices.push_back(j);
                    }
                }
            }
        }
    }
    
    /**
     * @brief Get memory usage statistics
     * @return Formatted statistics string
     */
    std::string get_statistics() {
        std::stringstream ss;
        
        ss << "=== Multi-GPU Memory Statistics ===\n";
        ss << "GPUs: " << num_gpus_ << "\n";
        ss << "Total Transfers: " << total_transfers_.load() << "\n";
        ss << "Total Bytes Transferred: " << format_bytes(total_bytes_transferred_.load()) << "\n";
        
        double avg_bandwidth = 0.0;
        if (total_transfer_time_ms_ > 0) {
            avg_bandwidth = (total_bytes_transferred_ / (1024.0 * 1024.0 * 1024.0)) / 
                          (total_transfer_time_ms_ / 1000.0);
        }
        ss << "Average Bandwidth: " << std::fixed << std::setprecision(2) 
           << avg_bandwidth << " GB/s\n\n";
        
        // Per-GPU statistics
        for (const auto& gpu : gpus_) {
            ss << "GPU " << gpu.device_id << " (" << gpu.properties.name << "):\n";
            ss << "  Total Memory: " << format_bytes(gpu.total_memory) << "\n";
            ss << "  Allocated: " << format_bytes(gpu.allocated_memory) << "\n";
            ss << "  Available: " << format_bytes(gpu.available_memory) << "\n";
            ss << "  Peer Devices: ";
            for (int peer : gpu.peer_devices) {
                ss << peer << " ";
            }
            ss << "\n";
        }
        
        // Region statistics
        ss << "\nMemory Regions:\n";
        for (const auto& [name, region] : regions_) {
            ss << "  " << name << ": " << format_bytes(region.total_size);
            if (region.is_replicated) {
                ss << " (replicated)";
            } else {
                ss << " (distributed)";
            }
            ss << "\n";
            
            for (const auto& [device, size] : region.device_sizes) {
                ss << "    GPU " << device << ": " << format_bytes(size) << "\n";
            }
        }
        
        return ss.str();
    }
    
    /**
     * @brief Set load balancing strategy
     * @param strategy New strategy
     */
    void set_load_balance_strategy(LoadBalanceStrategy strategy) {
        balance_strategy_ = strategy;
    }

private:
    void initialize() {
        // Get GPU count
        cudaGetDeviceCount(&num_gpus_);
        
        // Initialize GPU info
        for (int i = 0; i < num_gpus_; ++i) {
            GPUInfo info;
            info.device_id = i;
            
            cudaSetDevice(i);
            cudaGetDeviceProperties(&info.properties, i);
            
            size_t free, total;
            cudaMemGetInfo(&free, &total);
            info.total_memory = total;
            info.available_memory = free;
            info.allocated_memory = 0;
            info.active_transfers = 0;
            
            // Estimate bandwidth (simplified)
            info.bandwidth_gb_s = estimate_bandwidth(i);
            
            // Create memory pool for each GPU
            info.memory_pool = std::make_unique<UnifiedMemoryPool>(
                256 * 1024 * 1024, i); // 256MB per GPU
            
            gpus_.push_back(std::move(info));
        }
        
        // Enable peer access
        enable_peer_access();
        
        // Initialize NCCL
        initialize_nccl();
        
        // Start transfer threads
        for (int i = 0; i < std::min(4, num_gpus_); ++i) {
            transfer_threads_.emplace_back(&MultiGPUCoordinator::transfer_worker, this);
        }
    }
    
    void shutdown() {
        shutdown_ = true;
        transfer_cv_.notify_all();
        
        for (auto& thread : transfer_threads_) {
            if (thread.joinable()) {
                thread.join();
            }
        }
        
        // Cleanup regions
        for (auto& [name, region] : regions_) {
            deallocate_region_internal(region);
        }
        
        // Cleanup NCCL
        for (auto& comm : nccl_comms_) {
            ncclCommDestroy(comm);
        }
    }
    
    void initialize_nccl() {
        ncclUniqueId id;
        ncclGetUniqueId(&id);
        
        nccl_comms_.resize(num_gpus_);
        
        #pragma omp parallel for
        for (int i = 0; i < num_gpus_; ++i) {
            cudaSetDevice(i);
            ncclCommInitRank(&nccl_comms_[i], num_gpus_, id, i);
        }
    }
    
    void initialize_nccl_for_region(MemoryRegion& region, 
                                   const std::vector<int>& devices) {
        ncclUniqueId id;
        ncclGetUniqueId(&id);
        
        std::vector<ncclComm_t> comms(devices.size());
        
        #pragma omp parallel for
        for (size_t i = 0; i < devices.size(); ++i) {
            cudaSetDevice(devices[i]);
            ncclCommInitRank(&comms[i], devices.size(), id, i);
        }
        
        // Use first comm for the region
        region.nccl_comm = comms[0];
    }
    
    void* allocate_on_device(int device, size_t size) {
        cudaSetDevice(device);
        
        void* ptr = gpus_[device].memory_pool->allocate(size);
        if (ptr) {
            gpus_[device].allocated_memory += size;
            
            size_t free, total;
            cudaMemGetInfo(&free, &total);
            gpus_[device].available_memory = free;
        }
        
        return ptr;
    }
    
    void deallocate_region_internal(MemoryRegion& region) {
        for (const auto& [device, ptr] : region.device_pointers) {
            cudaSetDevice(device);
            gpus_[device].memory_pool->deallocate(ptr);
            
            if (region.device_sizes.find(device) != region.device_sizes.end()) {
                gpus_[device].allocated_memory -= region.device_sizes[device];
            }
        }
        
        for (auto& event : region.sync_events) {
            cudaEventDestroy(event);
        }
        
        if (region.nccl_comm) {
            ncclCommDestroy(region.nccl_comm);
        }
    }
    
    std::vector<int> get_all_devices() {
        std::vector<int> devices;
        for (int i = 0; i < num_gpus_; ++i) {
            devices.push_back(i);
        }
        return devices;
    }
    
    std::map<int, size_t> calculate_distribution(size_t total_size,
                                                const std::vector<int>& devices) {
        std::map<int, size_t> distribution;
        
        switch (balance_strategy_) {
            case LoadBalanceStrategy::ROUND_ROBIN: {
                size_t per_device = total_size / devices.size();
                size_t remainder = total_size % devices.size();
                
                for (size_t i = 0; i < devices.size(); ++i) {
                    distribution[devices[i]] = per_device + (i < remainder ? 1 : 0);
                }
                break;
            }
            
            case LoadBalanceStrategy::LEAST_LOADED: {
                std::vector<std::pair<int, size_t>> loads;
                for (int device : devices) {
                    loads.push_back({device, gpus_[device].allocated_memory});
                }
                
                std::sort(loads.begin(), loads.end(),
                         [](const auto& a, const auto& b) {
                             return a.second < b.second;
                         });
                
                // Distribute to least loaded devices
                size_t remaining = total_size;
                size_t device_idx = 0;
                
                while (remaining > 0) {
                    size_t chunk = std::min(remaining, total_size / devices.size());
                    distribution[loads[device_idx].first] += chunk;
                    remaining -= chunk;
                    device_idx = (device_idx + 1) % devices.size();
                }
                break;
            }
            
            case LoadBalanceStrategy::BANDWIDTH_AWARE: {
                // Distribute based on bandwidth capabilities
                double total_bandwidth = 0.0;
                for (int device : devices) {
                    total_bandwidth += gpus_[device].bandwidth_gb_s;
                }
                
                for (int device : devices) {
                    double ratio = gpus_[device].bandwidth_gb_s / total_bandwidth;
                    distribution[device] = static_cast<size_t>(total_size * ratio);
                }
                
                // Handle rounding errors
                size_t allocated = 0;
                for (const auto& [_, size] : distribution) {
                    allocated += size;
                }
                if (allocated < total_size) {
                    distribution[devices[0]] += total_size - allocated;
                }
                break;
            }
            
            case LoadBalanceStrategy::ADAPTIVE:
            default: {
                // Combine multiple factors
                for (int device : devices) {
                    double score = 1.0;
                    
                    // Factor in available memory
                    score *= gpus_[device].available_memory / 
                            static_cast<double>(gpus_[device].total_memory);
                    
                    // Factor in bandwidth
                    score *= gpus_[device].bandwidth_gb_s / 10.0; // Normalize to 10 GB/s
                    
                    // Factor in active transfers (inverse)
                    score /= (1.0 + gpus_[device].active_transfers.load());
                    
                    distribution[device] = static_cast<size_t>(total_size * score);
                }
                
                // Normalize distribution
                size_t total_distributed = 0;
                for (const auto& [_, size] : distribution) {
                    total_distributed += size;
                }
                
                for (auto& [device, size] : distribution) {
                    size = (size * total_size) / total_distributed;
                }
                break;
            }
        }
        
        return distribution;
    }
    
    std::vector<TransferRequest> create_transfer_plan(const MemoryRegion& src,
                                                      const MemoryRegion& dst,
                                                      size_t total_size) {
        std::vector<TransferRequest> plan;
        
        // Simple strategy: transfer from each source device to corresponding destination
        size_t transferred = 0;
        
        auto src_it = src.device_pointers.begin();
        auto dst_it = dst.device_pointers.begin();
        
        while (transferred < total_size && 
               src_it != src.device_pointers.end() &&
               dst_it != dst.device_pointers.end()) {
            
            size_t src_available = src.device_sizes.at(src_it->first);
            size_t dst_capacity = dst.device_sizes.at(dst_it->first);
            size_t transfer_size = std::min({src_available, dst_capacity, 
                                           total_size - transferred});
            
            if (transfer_size > 0) {
                TransferRequest req;
                req.src = src_it->second;
                req.dst = dst_it->second;
                req.size = transfer_size;
                req.src_device = src_it->first;
                req.dst_device = dst_it->first;
                req.stream = get_stream_for_device(dst_it->first);
                req.timestamp = std::chrono::steady_clock::now();
                
                plan.push_back(req);
                transferred += transfer_size;
            }
            
            ++src_it;
            ++dst_it;
        }
        
        return plan;
    }
    
    void enqueue_transfer(const TransferRequest& request) {
        {
            std::lock_guard<std::mutex> lock(transfer_mutex_);
            transfer_queue_.push(request);
        }
        transfer_cv_.notify_one();
    }
    
    void transfer_worker() {
        while (!shutdown_) {
            TransferRequest request;
            
            {
                std::unique_lock<std::mutex> lock(transfer_mutex_);
                transfer_cv_.wait(lock, [this] {
                    return !transfer_queue_.empty() || shutdown_;
                });
                
                if (shutdown_) break;
                
                request = transfer_queue_.front();
                transfer_queue_.pop();
            }
            
            execute_transfer(request);
        }
    }
    
    void execute_transfer(const TransferRequest& request) {
        auto start_time = std::chrono::steady_clock::now();
        
        gpus_[request.src_device].active_transfers++;
        gpus_[request.dst_device].active_transfers++;
        
        // Check if peer access is available
        bool use_peer = std::find(gpus_[request.src_device].peer_devices.begin(),
                                 gpus_[request.src_device].peer_devices.end(),
                                 request.dst_device) != 
                       gpus_[request.src_device].peer_devices.end();
        
        if (use_peer) {
            // Direct peer-to-peer transfer
            cudaMemcpyPeerAsync(request.dst, request.dst_device,
                               request.src, request.src_device,
                               request.size, request.stream);
        } else {
            // Staged transfer through host
            void* staging_buffer;
            cudaMallocHost(&staging_buffer, request.size);
            
            cudaSetDevice(request.src_device);
            cudaMemcpyAsync(staging_buffer, request.src, request.size,
                           cudaMemcpyDeviceToHost, request.stream);
            
            cudaSetDevice(request.dst_device);
            cudaMemcpyAsync(request.dst, staging_buffer, request.size,
                           cudaMemcpyHostToDevice, request.stream);
            
            // Free staging buffer after transfer
            cudaStreamAddCallback(request.stream,
                [](cudaStream_t stream, cudaError_t status, void* userData) {
                    cudaFreeHost(userData);
                }, staging_buffer, 0);
        }
        
        // Execute callback if provided
        if (request.callback) {
            cudaStreamAddCallback(request.stream,
                [](cudaStream_t stream, cudaError_t status, void* userData) {
                    auto* callback = static_cast<std::function<void()>*>(userData);
                    (*callback)();
                    delete callback;
                }, new std::function<void()>(request.callback), 0);
        }
        
        // Update statistics
        cudaStreamSynchronize(request.stream);
        
        auto end_time = std::chrono::steady_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>
                       (end_time - start_time);
        
        total_transfers_++;
        total_bytes_transferred_ += request.size;
        total_transfer_time_ms_ += duration.count() / 1000.0;
        
        gpus_[request.src_device].active_transfers--;
        gpus_[request.dst_device].active_transfers--;
    }
    
    void manual_synchronize_region(const MemoryRegion& region, int source_device) {
        void* src_ptr = region.device_pointers.at(source_device);
        
        for (const auto& [device, dst_ptr] : region.device_pointers) {
            if (device != source_device) {
                TransferRequest req;
                req.src = src_ptr;
                req.dst = dst_ptr;
                req.size = region.total_size;
                req.src_device = source_device;
                req.dst_device = device;
                req.stream = get_stream_for_device(device);
                
                execute_transfer(req);
            }
        }
    }
    
    cudaStream_t get_stream_for_device(int device) {
        // Simple round-robin stream selection per device
        static std::map<int, std::vector<cudaStream_t>> device_streams;
        static std::map<int, int> stream_counters;
        
        if (device_streams[device].empty()) {
            // Create 4 streams per device
            for (int i = 0; i < 4; ++i) {
                cudaStream_t stream;
                cudaSetDevice(device);
                cudaStreamCreate(&stream);
                device_streams[device].push_back(stream);
            }
            stream_counters[device] = 0;
        }
        
        int idx = stream_counters[device]++ % device_streams[device].size();
        return device_streams[device][idx];
    }
    
    double estimate_bandwidth(int device) {
        // Simple bandwidth estimation
        const size_t test_size = 100 * 1024 * 1024; // 100MB
        void *d_src, *d_dst;
        
        cudaSetDevice(device);
        cudaMalloc(&d_src, test_size);
        cudaMalloc(&d_dst, test_size);
        
        cudaEvent_t start, stop;
        cudaEventCreate(&start);
        cudaEventCreate(&stop);
        
        // Warm up
        cudaMemcpy(d_dst, d_src, test_size, cudaMemcpyDeviceToDevice);
        
        // Measure
        cudaEventRecord(start);
        for (int i = 0; i < 10; ++i) {
            cudaMemcpy(d_dst, d_src, test_size, cudaMemcpyDeviceToDevice);
        }
        cudaEventRecord(stop);
        cudaEventSynchronize(stop);
        
        float milliseconds = 0;
        cudaEventElapsedTime(&milliseconds, start, stop);
        
        double bandwidth_gb_s = (test_size * 10.0 / (1024.0 * 1024.0 * 1024.0)) / 
                               (milliseconds / 1000.0);
        
        cudaFree(d_src);
        cudaFree(d_dst);
        cudaEventDestroy(start);
        cudaEventDestroy(stop);
        
        return bandwidth_gb_s;
    }
    
    std::string format_bytes(size_t bytes) {
        std::stringstream ss;
        
        if (bytes >= 1024 * 1024 * 1024) {
            ss << std::fixed << std::setprecision(2) 
               << (bytes / (1024.0 * 1024.0 * 1024.0)) << " GB";
        } else if (bytes >= 1024 * 1024) {
            ss << std::fixed << std::setprecision(2) 
               << (bytes / (1024.0 * 1024.0)) << " MB";
        } else if (bytes >= 1024) {
            ss << std::fixed << std::setprecision(2) 
               << (bytes / 1024.0) << " KB";
        } else {
            ss << bytes << " B";
        }
        
        return ss.str();
    }
};

} // namespace multi_gpu
} // namespace memory
} // namespace nvidia_comms