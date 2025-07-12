/**
 * @file transfer_optimizer.cu
 * @brief Memory transfer optimization for GPU operations
 * 
 * Implements advanced memory transfer techniques:
 * - Asynchronous bidirectional transfers
 * - Pipeline optimization for overlapping compute and transfer
 * - Compression for bandwidth optimization
 * - Multi-stream concurrent transfers
 */

#include <cuda_runtime.h>
#include <cuda.h>
#include <nccl.h>
#include <vector>
#include <queue>
#include <thread>
#include <atomic>
#include <condition_variable>
#include <cstring>

namespace nvidia_comms {
namespace memory {
namespace transfer {

/**
 * @class TransferOptimizer
 * @brief Optimizes GPU memory transfers for maximum bandwidth utilization
 */
class TransferOptimizer {
private:
    struct TransferRequest {
        void* src;
        void* dst;
        size_t size;
        cudaMemcpyKind kind;
        cudaStream_t stream;
        bool compress;
        int priority;
        std::function<void()> callback;
    };
    
    struct TransferStats {
        std::atomic<size_t> bytes_transferred;
        std::atomic<size_t> transfer_count;
        std::atomic<double> total_time_ms;
        std::atomic<size_t> compressed_bytes;
        std::atomic<size_t> compression_time_ms;
    };
    
    struct StreamContext {
        cudaStream_t stream;
        cudaEvent_t start_event;
        cudaEvent_t end_event;
        bool is_busy;
        size_t bytes_in_flight;
    };

    // Configuration
    const size_t MAX_CHUNK_SIZE = 64 * 1024 * 1024;     // 64MB chunks
    const size_t COMPRESSION_THRESHOLD = 1024 * 1024;    // 1MB minimum for compression
    const int NUM_TRANSFER_STREAMS = 4;
    const size_t PIPELINE_DEPTH = 4;
    
    // Transfer management
    std::vector<StreamContext> stream_contexts_;
    std::priority_queue<TransferRequest> pending_transfers_;
    std::mutex queue_mutex_;
    std::condition_variable queue_cv_;
    std::atomic<bool> shutdown_;
    std::thread worker_thread_;
    
    // Statistics
    TransferStats stats_;
    
    // Compression
    void* compression_buffer_;
    size_t compression_buffer_size_;
    
    // Multi-GPU support
    int device_count_;
    std::vector<int> peer_access_matrix_;
    
public:
    TransferOptimizer() : shutdown_(false), compression_buffer_(nullptr), 
                         compression_buffer_size_(0) {
        initialize();
    }
    
    ~TransferOptimizer() {
        shutdown();
    }
    
    /**
     * @brief Asynchronous memory transfer with optimization
     * @param src Source memory pointer
     * @param dst Destination memory pointer
     * @param size Transfer size
     * @param kind Transfer type (H2D, D2H, D2D)
     * @param stream Optional stream for synchronization
     * @param compress Whether to compress data during transfer
     * @param priority Transfer priority (higher = more urgent)
     * @param callback Optional completion callback
     */
    void transfer_async(void* src, void* dst, size_t size, 
                       cudaMemcpyKind kind, cudaStream_t stream = 0,
                       bool compress = false, int priority = 0,
                       std::function<void()> callback = nullptr) {
        TransferRequest request{
            src, dst, size, kind, stream, compress, priority, callback
        };
        
        {
            std::lock_guard<std::mutex> lock(queue_mutex_);
            pending_transfers_.push(request);
        }
        queue_cv_.notify_one();
    }
    
    /**
     * @brief Optimized bidirectional transfer
     * @param dev_ptr1 First device pointer
     * @param dev_ptr2 Second device pointer
     * @param size Transfer size in each direction
     * @param stream1 Stream for first transfer
     * @param stream2 Stream for second transfer
     */
    void bidirectional_transfer(void* dev_ptr1, void* dev_ptr2, size_t size,
                               cudaStream_t stream1 = 0, cudaStream_t stream2 = 0) {
        // Allocate temporary buffers for swap
        void* temp1, *temp2;
        cudaMalloc(&temp1, size);
        cudaMalloc(&temp2, size);
        
        // Simultaneous transfers in opposite directions
        cudaMemcpyAsync(temp1, dev_ptr1, size, cudaMemcpyDeviceToDevice, stream1);
        cudaMemcpyAsync(temp2, dev_ptr2, size, cudaMemcpyDeviceToDevice, stream2);
        
        // Synchronize streams
        cudaEvent_t event1, event2;
        cudaEventCreate(&event1);
        cudaEventCreate(&event2);
        
        cudaEventRecord(event1, stream1);
        cudaEventRecord(event2, stream2);
        
        cudaStreamWaitEvent(stream1, event2, 0);
        cudaStreamWaitEvent(stream2, event1, 0);
        
        // Copy back
        cudaMemcpyAsync(dev_ptr1, temp2, size, cudaMemcpyDeviceToDevice, stream1);
        cudaMemcpyAsync(dev_ptr2, temp1, size, cudaMemcpyDeviceToDevice, stream2);
        
        // Cleanup
        cudaFree(temp1);
        cudaFree(temp2);
        cudaEventDestroy(event1);
        cudaEventDestroy(event2);
    }
    
    /**
     * @brief Pipeline memory transfers with computation
     * @param transfers Vector of transfer requests
     * @param compute_fn Function to execute between transfers
     * @param compute_stream Stream for computation
     */
    void pipeline_transfers(const std::vector<TransferRequest>& transfers,
                           std::function<void(int stage)> compute_fn,
                           cudaStream_t compute_stream) {
        const size_t num_stages = transfers.size();
        std::vector<cudaEvent_t> transfer_events(num_stages);
        std::vector<cudaEvent_t> compute_events(num_stages);
        
        // Create events
        for (size_t i = 0; i < num_stages; ++i) {
            cudaEventCreate(&transfer_events[i]);
            cudaEventCreate(&compute_events[i]);
        }
        
        // Pipeline execution
        for (size_t i = 0; i < num_stages + PIPELINE_DEPTH - 1; ++i) {
            // Transfer stage
            if (i < num_stages) {
                const auto& req = transfers[i];
                
                // Wait for previous compute if not first iteration
                if (i > 0) {
                    cudaStreamWaitEvent(req.stream, compute_events[i-1], 0);
                }
                
                // Execute transfer
                execute_transfer(req);
                cudaEventRecord(transfer_events[i], req.stream);
            }
            
            // Compute stage
            if (i >= PIPELINE_DEPTH - 1 && i - PIPELINE_DEPTH + 1 < num_stages) {
                size_t compute_idx = i - PIPELINE_DEPTH + 1;
                
                // Wait for transfer to complete
                cudaStreamWaitEvent(compute_stream, transfer_events[compute_idx], 0);
                
                // Execute computation
                compute_fn(compute_idx);
                cudaEventRecord(compute_events[compute_idx], compute_stream);
            }
        }
        
        // Cleanup events
        for (size_t i = 0; i < num_stages; ++i) {
            cudaEventDestroy(transfer_events[i]);
            cudaEventDestroy(compute_events[i]);
        }
    }
    
    /**
     * @brief Zero-copy transfer using unified memory hints
     * @param ptr Unified memory pointer
     * @param size Memory size
     * @param src_device Source device ID
     * @param dst_device Destination device ID
     * @param stream Transfer stream
     */
    void zero_copy_transfer(void* ptr, size_t size, int src_device, 
                           int dst_device, cudaStream_t stream = 0) {
        // Prefetch from source to destination
        cudaMemPrefetchAsync(ptr, size, dst_device, stream);
        
        // Set access hints for optimal performance
        cudaMemAdvise(ptr, size, cudaMemAdviseSetReadMostly, src_device);
        cudaMemAdvise(ptr, size, cudaMemAdviseSetAccessedBy, dst_device);
    }
    
    /**
     * @brief Multi-GPU peer-to-peer transfer
     * @param src Source pointer on GPU
     * @param dst Destination pointer on different GPU
     * @param size Transfer size
     * @param src_device Source GPU ID
     * @param dst_device Destination GPU ID
     * @param stream Transfer stream
     */
    void p2p_transfer(void* src, void* dst, size_t size,
                     int src_device, int dst_device, cudaStream_t stream = 0) {
        // Check if peer access is available
        if (!can_access_peer(src_device, dst_device)) {
            // Fall back to staged transfer through host
            staged_transfer(src, dst, size, src_device, dst_device, stream);
            return;
        }
        
        // Direct peer-to-peer transfer
        int current_device;
        cudaGetDevice(&current_device);
        
        cudaSetDevice(dst_device);
        cudaMemcpyPeerAsync(dst, dst_device, src, src_device, size, stream);
        
        cudaSetDevice(current_device);
    }
    
    /**
     * @brief Compress and transfer data
     * @param src Source data
     * @param dst Destination buffer
     * @param size Original data size
     * @param kind Transfer type
     * @param stream Transfer stream
     * @return Compressed size
     */
    size_t compress_transfer(void* src, void* dst, size_t size,
                            cudaMemcpyKind kind, cudaStream_t stream = 0) {
        // Simple RLE compression for demonstration
        // In production, use nvCOMP or similar
        
        ensure_compression_buffer(size);
        
        // Compress data (simplified)
        size_t compressed_size = simple_rle_compress(src, compression_buffer_, size);
        
        // Transfer compressed data
        cudaMemcpyAsync(dst, compression_buffer_, compressed_size, kind, stream);
        
        stats_.compressed_bytes += size - compressed_size;
        
        return compressed_size;
    }
    
    /**
     * @brief Get transfer statistics
     * @return Current transfer statistics
     */
    TransferStats get_stats() const {
        return stats_;
    }
    
    /**
     * @brief Optimize transfer strategy based on profiling
     */
    void optimize_strategy() {
        double avg_bandwidth = calculate_average_bandwidth();
        
        // Adjust chunk size based on achieved bandwidth
        if (avg_bandwidth < 5.0) { // GB/s
            // Increase chunk size for better efficiency
            const_cast<size_t&>(MAX_CHUNK_SIZE) = 128 * 1024 * 1024;
        } else if (avg_bandwidth > 10.0) {
            // Decrease chunk size for better latency
            const_cast<size_t&>(MAX_CHUNK_SIZE) = 32 * 1024 * 1024;
        }
    }

private:
    void initialize() {
        // Get device count
        cudaGetDeviceCount(&device_count_);
        
        // Initialize peer access matrix
        peer_access_matrix_.resize(device_count_ * device_count_);
        for (int i = 0; i < device_count_; ++i) {
            for (int j = 0; j < device_count_; ++j) {
                if (i != j) {
                    int can_access;
                    cudaDeviceCanAccessPeer(&can_access, i, j);
                    peer_access_matrix_[i * device_count_ + j] = can_access;
                    
                    if (can_access) {
                        cudaSetDevice(i);
                        cudaDeviceEnablePeerAccess(j, 0);
                    }
                }
            }
        }
        
        // Create transfer streams
        for (int i = 0; i < NUM_TRANSFER_STREAMS; ++i) {
            StreamContext ctx;
            cudaStreamCreateWithPriority(&ctx.stream, cudaStreamNonBlocking, -1);
            cudaEventCreate(&ctx.start_event);
            cudaEventCreate(&ctx.end_event);
            ctx.is_busy = false;
            ctx.bytes_in_flight = 0;
            stream_contexts_.push_back(ctx);
        }
        
        // Initialize statistics
        stats_.bytes_transferred = 0;
        stats_.transfer_count = 0;
        stats_.total_time_ms = 0.0;
        stats_.compressed_bytes = 0;
        stats_.compression_time_ms = 0;
        
        // Start worker thread
        worker_thread_ = std::thread(&TransferOptimizer::worker_loop, this);
    }
    
    void shutdown() {
        shutdown_ = true;
        queue_cv_.notify_all();
        
        if (worker_thread_.joinable()) {
            worker_thread_.join();
        }
        
        // Cleanup streams and events
        for (auto& ctx : stream_contexts_) {
            cudaStreamDestroy(ctx.stream);
            cudaEventDestroy(ctx.start_event);
            cudaEventDestroy(ctx.end_event);
        }
        
        // Free compression buffer
        if (compression_buffer_) {
            cudaFree(compression_buffer_);
        }
    }
    
    void worker_loop() {
        while (!shutdown_) {
            TransferRequest request;
            
            {
                std::unique_lock<std::mutex> lock(queue_mutex_);
                queue_cv_.wait(lock, [this] { 
                    return !pending_transfers_.empty() || shutdown_; 
                });
                
                if (shutdown_) break;
                
                request = pending_transfers_.top();
                pending_transfers_.pop();
            }
            
            // Find available stream
            StreamContext* ctx = find_available_stream();
            if (!ctx) {
                // All streams busy, wait for one to free up
                cudaStreamSynchronize(stream_contexts_[0].stream);
                ctx = &stream_contexts_[0];
            }
            
            // Execute transfer
            execute_transfer_with_stats(request, ctx);
        }
    }
    
    StreamContext* find_available_stream() {
        for (auto& ctx : stream_contexts_) {
            if (!ctx.is_busy) {
                return &ctx;
            }
            
            // Check if stream has completed
            cudaError_t status = cudaEventQuery(ctx.end_event);
            if (status == cudaSuccess) {
                ctx.is_busy = false;
                ctx.bytes_in_flight = 0;
                return &ctx;
            }
        }
        return nullptr;
    }
    
    void execute_transfer(const TransferRequest& request) {
        if (request.size <= MAX_CHUNK_SIZE) {
            // Single transfer
            if (request.compress && request.size >= COMPRESSION_THRESHOLD) {
                compress_transfer(request.src, request.dst, request.size, 
                                request.kind, request.stream);
            } else {
                cudaMemcpyAsync(request.dst, request.src, request.size, 
                              request.kind, request.stream);
            }
        } else {
            // Chunked transfer for large data
            size_t remaining = request.size;
            size_t offset = 0;
            
            while (remaining > 0) {
                size_t chunk_size = std::min(remaining, MAX_CHUNK_SIZE);
                
                void* src_chunk = (char*)request.src + offset;
                void* dst_chunk = (char*)request.dst + offset;
                
                cudaMemcpyAsync(dst_chunk, src_chunk, chunk_size, 
                              request.kind, request.stream);
                
                offset += chunk_size;
                remaining -= chunk_size;
            }
        }
        
        // Execute callback if provided
        if (request.callback) {
            cudaStreamAddCallback(request.stream, stream_callback, 
                                (void*)&request.callback, 0);
        }
    }
    
    void execute_transfer_with_stats(const TransferRequest& request, 
                                    StreamContext* ctx) {
        ctx->is_busy = true;
        ctx->bytes_in_flight = request.size;
        
        // Record start time
        cudaEventRecord(ctx->start_event, ctx->stream);
        
        // Execute transfer
        execute_transfer(request);
        
        // Record end time
        cudaEventRecord(ctx->end_event, ctx->stream);
        
        // Update statistics asynchronously
        cudaStreamAddCallback(ctx->stream, 
            [](cudaStream_t stream, cudaError_t status, void* userData) {
                auto* optimizer = static_cast<TransferOptimizer*>(userData);
                optimizer->update_stats();
            }, this, 0);
        
        stats_.bytes_transferred += request.size;
        stats_.transfer_count++;
    }
    
    void update_stats() {
        // Calculate transfer time from events
        float elapsed_ms;
        cudaEventElapsedTime(&elapsed_ms, 
                           stream_contexts_[0].start_event,
                           stream_contexts_[0].end_event);
        
        stats_.total_time_ms += elapsed_ms;
    }
    
    bool can_access_peer(int src_device, int dst_device) {
        if (src_device == dst_device) return true;
        if (src_device >= device_count_ || dst_device >= device_count_) return false;
        
        return peer_access_matrix_[src_device * device_count_ + dst_device];
    }
    
    void staged_transfer(void* src, void* dst, size_t size,
                        int src_device, int dst_device, cudaStream_t stream) {
        // Allocate staging buffer on host
        void* host_buffer;
        cudaMallocHost(&host_buffer, size);
        
        // Transfer through host
        int current_device;
        cudaGetDevice(&current_device);
        
        cudaSetDevice(src_device);
        cudaMemcpyAsync(host_buffer, src, size, cudaMemcpyDeviceToHost, stream);
        
        cudaSetDevice(dst_device);
        cudaMemcpyAsync(dst, host_buffer, size, cudaMemcpyHostToDevice, stream);
        
        cudaSetDevice(current_device);
        
        // Free staging buffer after transfer
        cudaStreamAddCallback(stream,
            [](cudaStream_t stream, cudaError_t status, void* userData) {
                cudaFreeHost(userData);
            }, host_buffer, 0);
    }
    
    void ensure_compression_buffer(size_t size) {
        if (compression_buffer_size_ < size) {
            if (compression_buffer_) {
                cudaFree(compression_buffer_);
            }
            
            compression_buffer_size_ = size * 2; // Extra space for worst case
            cudaMalloc(&compression_buffer_, compression_buffer_size_);
        }
    }
    
    size_t simple_rle_compress(void* src, void* dst, size_t size) {
        // Simplified RLE compression
        // In production, use GPU-accelerated compression
        
        uint8_t* src_bytes = (uint8_t*)src;
        uint8_t* dst_bytes = (uint8_t*)dst;
        
        size_t src_idx = 0;
        size_t dst_idx = 0;
        
        while (src_idx < size) {
            uint8_t value = src_bytes[src_idx];
            size_t count = 1;
            
            while (src_idx + count < size && 
                   src_bytes[src_idx + count] == value && 
                   count < 255) {
                count++;
            }
            
            dst_bytes[dst_idx++] = count;
            dst_bytes[dst_idx++] = value;
            src_idx += count;
        }
        
        return dst_idx;
    }
    
    double calculate_average_bandwidth() {
        if (stats_.transfer_count == 0) return 0.0;
        
        double total_gb = stats_.bytes_transferred / (1024.0 * 1024.0 * 1024.0);
        double total_seconds = stats_.total_time_ms / 1000.0;
        
        return total_gb / total_seconds;
    }
    
    static void CUDART_CB stream_callback(cudaStream_t stream, 
                                         cudaError_t status, void* userData) {
        auto* callback = static_cast<std::function<void()>*>(userData);
        if (callback && *callback) {
            (*callback)();
        }
    }
};

} // namespace transfer
} // namespace memory
} // namespace nvidia_comms