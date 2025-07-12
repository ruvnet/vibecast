/**
 * @file memory_manager.h
 * @brief GPU Memory Management System for Interplanetary Communications
 * 
 * This header provides access to all GPU memory management components:
 * - Unified memory pool management
 * - Allocation strategies (Buddy, Slab, Stream-aware, Adaptive)
 * - Memory transfer optimization
 * - Intelligent prefetching
 * - Memory leak detection
 * - Multi-GPU coordination
 */

#ifndef NVIDIA_COMMS_MEMORY_MANAGER_H
#define NVIDIA_COMMS_MEMORY_MANAGER_H

#include <cuda_runtime.h>
#include <memory>
#include <string>

// Include all memory management components
#include "pool/unified_memory_pool.cu"
#include "strategies/allocation_strategies.cu"
#include "transfer/transfer_optimizer.cu"
#include "prefetch/prefetch_engine.cu"
#include "debug/leak_detector.cu"
#include "multi_gpu/multi_gpu_coordinator.cu"

namespace nvidia_comms {
namespace memory {

/**
 * @class MemoryManager
 * @brief Integrated GPU memory management system
 * 
 * Provides a unified interface to all memory management components
 * optimized for interplanetary communication workloads.
 */
class MemoryManager {
private:
    // Core components
    std::unique_ptr<UnifiedMemoryPool> memory_pool_;
    std::unique_ptr<strategies::AllocationStrategy> allocation_strategy_;
    std::unique_ptr<transfer::TransferOptimizer> transfer_optimizer_;
    std::unique_ptr<prefetch::PrefetchEngine> prefetch_engine_;
    std::unique_ptr<debug::LeakDetector> leak_detector_;
    std::unique_ptr<multi_gpu::MultiGPUCoordinator> multi_gpu_coordinator_;
    
    // Configuration
    struct Config {
        size_t initial_pool_size = 1024 * 1024 * 1024;  // 1GB
        strategies::LoadBalanceStrategy balance_strategy = 
            strategies::LoadBalanceStrategy::ADAPTIVE;
        bool enable_leak_detection = true;
        bool enable_prefetching = true;
        bool enable_multi_gpu = true;
        int primary_device = 0;
    } config_;
    
    // Statistics
    struct Stats {
        size_t total_allocations = 0;
        size_t total_deallocations = 0;
        size_t total_bytes_allocated = 0;
        size_t total_bytes_transferred = 0;
        size_t total_prefetch_hits = 0;
        size_t total_prefetch_misses = 0;
    } stats_;
    
public:
    /**
     * @brief Initialize memory manager with configuration
     * @param config Optional configuration parameters
     */
    explicit MemoryManager(const Config& config = Config()) : config_(config) {
        initialize();
    }
    
    ~MemoryManager() {
        shutdown();
    }
    
    /**
     * @brief Allocate GPU memory
     * @param size Size in bytes
     * @param stream CUDA stream for async operations
     * @param tag Optional tag for tracking
     * @return Allocated pointer
     */
    void* allocate(size_t size, cudaStream_t stream = 0, 
                   const std::string& tag = "") {
        void* ptr = nullptr;
        
        if (allocation_strategy_) {
            ptr = allocation_strategy_->allocate(size, stream);
        } else {
            ptr = memory_pool_->allocate(size, stream);
        }
        
        if (ptr && leak_detector_) {
            leak_detector_->track_allocation(ptr, size, cudaMemoryTypeDevice, tag);
        }
        
        if (ptr && prefetch_engine_) {
            prefetch_engine_->record_access(ptr, size, stream);
        }
        
        stats_.total_allocations++;
        stats_.total_bytes_allocated += size;
        
        return ptr;
    }
    
    /**
     * @brief Deallocate GPU memory
     * @param ptr Pointer to deallocate
     * @param stream CUDA stream
     */
    void deallocate(void* ptr, cudaStream_t stream = 0) {
        if (!ptr) return;
        
        if (leak_detector_) {
            leak_detector_->track_deallocation(ptr);
        }
        
        if (allocation_strategy_) {
            allocation_strategy_->deallocate(ptr, stream);
        } else {
            memory_pool_->deallocate(ptr);
        }
        
        stats_.total_deallocations++;
    }
    
    /**
     * @brief Transfer memory between locations
     * @param src Source pointer
     * @param dst Destination pointer
     * @param size Transfer size
     * @param kind Transfer type
     * @param stream CUDA stream
     */
    void transfer(void* src, void* dst, size_t size,
                  cudaMemcpyKind kind = cudaMemcpyDeviceToDevice,
                  cudaStream_t stream = 0) {
        if (transfer_optimizer_) {
            transfer_optimizer_->transfer_async(src, dst, size, kind, stream);
        } else {
            cudaMemcpyAsync(dst, src, size, kind, stream);
        }
        
        stats_.total_bytes_transferred += size;
    }
    
    /**
     * @brief Prefetch memory to device
     * @param ptr Memory pointer
     * @param size Size to prefetch
     * @param device Target device (-1 for CPU)
     * @param stream CUDA stream
     */
    void prefetch(void* ptr, size_t size, int device = -1,
                  cudaStream_t stream = 0) {
        if (prefetch_engine_) {
            prefetch_engine_->prefetch(ptr, size, device, stream);
        } else {
            memory_pool_->prefetch(ptr, size, device, stream);
        }
    }
    
    /**
     * @brief Create distributed memory region across GPUs
     * @param name Region name
     * @param size Total size
     * @param replicate Whether to replicate across GPUs
     * @return Success status
     */
    bool create_distributed_region(const std::string& name, size_t size,
                                  bool replicate = false) {
        if (!multi_gpu_coordinator_) return false;
        
        return multi_gpu_coordinator_->allocate_region(name, size, replicate);
    }
    
    /**
     * @brief Get pointer to distributed region on device
     * @param name Region name
     * @param device Device ID
     * @return Device pointer
     */
    void* get_distributed_pointer(const std::string& name, int device) {
        if (!multi_gpu_coordinator_) return nullptr;
        
        return multi_gpu_coordinator_->get_region_pointer(name, device);
    }
    
    /**
     * @brief Synchronize distributed region across GPUs
     * @param name Region name
     * @param source_device Source device for sync
     */
    void synchronize_region(const std::string& name, int source_device = -1) {
        if (multi_gpu_coordinator_) {
            multi_gpu_coordinator_->synchronize_region(name, source_device);
        }
    }
    
    /**
     * @brief Set allocation strategy
     * @param strategy Strategy type
     */
    void set_allocation_strategy(const std::string& strategy) {
        if (strategy == "buddy") {
            allocation_strategy_ = std::make_unique<strategies::BuddyAllocator>();
        } else if (strategy == "slab") {
            allocation_strategy_ = std::make_unique<strategies::SlabAllocator>();
        } else if (strategy == "stream_aware") {
            allocation_strategy_ = std::make_unique<strategies::StreamAwareAllocator>();
        } else if (strategy == "adaptive") {
            allocation_strategy_ = std::make_unique<strategies::AdaptiveAllocator>();
        }
    }
    
    /**
     * @brief Check for memory leaks
     * @return Leak detection report
     */
    std::string check_leaks() {
        if (!leak_detector_) return "Leak detection disabled";
        
        auto report = leak_detector_->check_leaks();
        return leak_detector_->generate_usage_report();
    }
    
    /**
     * @brief Get memory usage statistics
     * @return Formatted statistics
     */
    std::string get_statistics() {
        std::stringstream ss;
        
        ss << "=== GPU Memory Manager Statistics ===\n";
        ss << "Allocations: " << stats_.total_allocations << "\n";
        ss << "Deallocations: " << stats_.total_deallocations << "\n";
        ss << "Total Allocated: " << format_bytes(stats_.total_bytes_allocated) << "\n";
        ss << "Total Transferred: " << format_bytes(stats_.total_bytes_transferred) << "\n";
        
        if (memory_pool_) {
            auto pool_stats = memory_pool_->get_stats();
            ss << "\nMemory Pool:\n";
            ss << "  Current: " << format_bytes(pool_stats.total_used) << "\n";
            ss << "  Peak: " << format_bytes(pool_stats.peak_usage) << "\n";
        }
        
        if (allocation_strategy_) {
            ss << "\nAllocation Strategy:\n";
            ss << allocation_strategy_->get_stats();
        }
        
        if (transfer_optimizer_) {
            auto transfer_stats = transfer_optimizer_->get_stats();
            ss << "\nTransfer Optimizer:\n";
            ss << "  Transfers: " << transfer_stats.transfer_count << "\n";
            ss << "  Bandwidth: " << calculate_bandwidth(transfer_stats) << " GB/s\n";
        }
        
        if (prefetch_engine_) {
            auto prefetch_stats = prefetch_engine_->get_stats();
            ss << "\nPrefetch Engine:\n";
            ss << "  Total Prefetches: " << prefetch_stats.total_prefetches << "\n";
            ss << "  Success Rate: " << (prefetch_stats.average_accuracy * 100) << "%\n";
        }
        
        if (multi_gpu_coordinator_) {
            ss << "\n" << multi_gpu_coordinator_->get_statistics();
        }
        
        return ss.str();
    }
    
    /**
     * @brief Optimize memory management based on usage patterns
     */
    void optimize() {
        if (memory_pool_) {
            memory_pool_->defragment();
        }
        
        if (allocation_strategy_) {
            allocation_strategy_->optimize();
        }
        
        if (transfer_optimizer_) {
            transfer_optimizer_->optimize_strategy();
        }
        
        if (prefetch_engine_) {
            prefetch_engine_->train_predictor();
        }
    }
    
    /**
     * @brief Zero-copy memory operations
     * @param host_ptr Host memory pointer
     * @param size Memory size
     * @return Device-accessible pointer
     */
    void* enable_zero_copy(void* host_ptr, size_t size) {
        return memory_pool_->zero_copy_map(host_ptr, size);
    }
    
    /**
     * @brief Disable zero-copy for memory
     * @param host_ptr Host memory pointer
     */
    void disable_zero_copy(void* host_ptr) {
        memory_pool_->zero_copy_unmap(host_ptr);
    }

private:
    void initialize() {
        // Set primary device
        cudaSetDevice(config_.primary_device);
        
        // Initialize memory pool
        memory_pool_ = std::make_unique<UnifiedMemoryPool>(
            config_.initial_pool_size, config_.primary_device);
        
        // Initialize allocation strategy
        allocation_strategy_ = std::make_unique<strategies::AdaptiveAllocator>();
        
        // Initialize transfer optimizer
        transfer_optimizer_ = std::make_unique<transfer::TransferOptimizer>();
        
        // Initialize prefetch engine if enabled
        if (config_.enable_prefetching) {
            prefetch_engine_ = std::make_unique<prefetch::PrefetchEngine>();
        }
        
        // Initialize leak detector if enabled
        if (config_.enable_leak_detection) {
            leak_detector_ = std::make_unique<debug::LeakDetector>(true, true, 60);
        }
        
        // Initialize multi-GPU coordinator if enabled
        if (config_.enable_multi_gpu) {
            int device_count;
            cudaGetDeviceCount(&device_count);
            
            if (device_count > 1) {
                multi_gpu_coordinator_ = std::make_unique<multi_gpu::MultiGPUCoordinator>(
                    multi_gpu::LoadBalanceStrategy::ADAPTIVE);
            }
        }
    }
    
    void shutdown() {
        // Clean shutdown in reverse order
        multi_gpu_coordinator_.reset();
        leak_detector_.reset();
        prefetch_engine_.reset();
        transfer_optimizer_.reset();
        allocation_strategy_.reset();
        memory_pool_.reset();
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
    
    double calculate_bandwidth(const transfer::TransferOptimizer::TransferStats& stats) {
        if (stats.total_time_ms == 0) return 0.0;
        
        double gb = stats.bytes_transferred / (1024.0 * 1024.0 * 1024.0);
        double seconds = stats.total_time_ms / 1000.0;
        
        return gb / seconds;
    }
};

/**
 * @brief Convenience function to create memory manager
 * @param enable_all Enable all features
 * @return Unique pointer to memory manager
 */
inline std::unique_ptr<MemoryManager> create_memory_manager(bool enable_all = true) {
    MemoryManager::Config config;
    config.enable_leak_detection = enable_all;
    config.enable_prefetching = enable_all;
    config.enable_multi_gpu = enable_all;
    
    return std::make_unique<MemoryManager>(config);
}

} // namespace memory
} // namespace nvidia_comms

#endif // NVIDIA_COMMS_MEMORY_MANAGER_H