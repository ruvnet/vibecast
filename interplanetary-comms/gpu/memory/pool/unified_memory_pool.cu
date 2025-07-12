/**
 * @file unified_memory_pool.cu
 * @brief Unified GPU memory pool manager with zero-copy support
 * 
 * Implements a high-performance memory pool for GPU operations with:
 * - Unified memory allocation across CPU and GPU
 * - Zero-copy memory transfers
 * - Pinned memory support for fast DMA
 * - Memory fragmentation prevention
 */

#include <cuda_runtime.h>
#include <cuda.h>
#include <vector>
#include <map>
#include <mutex>
#include <atomic>
#include <cstring>
#include <stdexcept>

namespace nvidia_comms {
namespace memory {

/**
 * @class UnifiedMemoryPool
 * @brief Manages unified memory allocations with zero-copy capabilities
 */
class UnifiedMemoryPool {
private:
    struct MemoryBlock {
        void* ptr;
        size_t size;
        bool is_free;
        bool is_pinned;
        cudaStream_t stream;
        std::atomic<int> ref_count;
        
        MemoryBlock() : ptr(nullptr), size(0), is_free(true), 
                       is_pinned(false), stream(0), ref_count(0) {}
    };
    
    struct PoolStats {
        std::atomic<size_t> total_allocated;
        std::atomic<size_t> total_used;
        std::atomic<size_t> peak_usage;
        std::atomic<size_t> allocation_count;
        std::atomic<size_t> deallocation_count;
        std::atomic<size_t> fragmentation_count;
    };

    // Memory pool configuration
    const size_t MIN_BLOCK_SIZE = 1024;           // 1KB minimum
    const size_t MAX_BLOCK_SIZE = 1024 * 1024 * 1024; // 1GB maximum
    const size_t POOL_GROWTH_FACTOR = 2;
    const float FRAGMENTATION_THRESHOLD = 0.3f;

    // Pool management
    std::vector<MemoryBlock> memory_blocks_;
    std::map<void*, size_t> ptr_to_block_;
    std::mutex pool_mutex_;
    PoolStats stats_;
    
    // Device properties
    int device_id_;
    cudaDeviceProp device_props_;
    size_t total_device_memory_;
    size_t available_device_memory_;
    
    // Unified memory hints
    bool use_prefetch_hints_;
    bool use_access_hints_;
    cudaStream_t default_stream_;

public:
    /**
     * @brief Initialize unified memory pool
     * @param initial_size Initial pool size in bytes
     * @param device_id Target GPU device ID
     */
    UnifiedMemoryPool(size_t initial_size = 1024 * 1024 * 1024, int device_id = 0)
        : device_id_(device_id), use_prefetch_hints_(true), 
          use_access_hints_(true), default_stream_(0) {
        
        // Initialize CUDA
        cudaSetDevice(device_id_);
        cudaGetDeviceProperties(&device_props_, device_id_);
        
        // Get memory info
        cudaMemGetInfo(&available_device_memory_, &total_device_memory_);
        
        // Initialize statistics
        stats_.total_allocated = 0;
        stats_.total_used = 0;
        stats_.peak_usage = 0;
        stats_.allocation_count = 0;
        stats_.deallocation_count = 0;
        stats_.fragmentation_count = 0;
        
        // Pre-allocate initial pool
        preallocate_pool(initial_size);
    }
    
    ~UnifiedMemoryPool() {
        cleanup_pool();
    }
    
    /**
     * @brief Allocate unified memory from pool
     * @param size Requested memory size
     * @param stream CUDA stream for async operations
     * @param pinned Whether to use pinned memory
     * @return Pointer to allocated memory
     */
    void* allocate(size_t size, cudaStream_t stream = 0, bool pinned = false) {
        std::lock_guard<std::mutex> lock(pool_mutex_);
        
        // Align size to 256 bytes for optimal performance
        size = align_size(size, 256);
        
        // Try to find existing free block
        for (size_t i = 0; i < memory_blocks_.size(); ++i) {
            auto& block = memory_blocks_[i];
            if (block.is_free && block.size >= size && block.is_pinned == pinned) {
                return allocate_from_block(i, size, stream);
            }
        }
        
        // No suitable block found, allocate new one
        return allocate_new_block(size, stream, pinned);
    }
    
    /**
     * @brief Deallocate memory back to pool
     * @param ptr Pointer to deallocate
     */
    void deallocate(void* ptr) {
        if (!ptr) return;
        
        std::lock_guard<std::mutex> lock(pool_mutex_);
        
        auto it = ptr_to_block_.find(ptr);
        if (it == ptr_to_block_.end()) {
            throw std::runtime_error("Invalid pointer for deallocation");
        }
        
        size_t block_idx = it->second;
        auto& block = memory_blocks_[block_idx];
        
        // Update statistics
        stats_.total_used -= block.size;
        stats_.deallocation_count++;
        
        // Mark block as free
        block.is_free = true;
        block.ref_count = 0;
        ptr_to_block_.erase(it);
        
        // Try to coalesce adjacent free blocks
        coalesce_free_blocks();
    }
    
    /**
     * @brief Prefetch memory to specific device
     * @param ptr Memory pointer
     * @param size Memory size
     * @param device Target device ID (-1 for CPU)
     * @param stream CUDA stream for async prefetch
     */
    void prefetch(void* ptr, size_t size, int device = -1, cudaStream_t stream = 0) {
        if (!use_prefetch_hints_) return;
        
        int target = (device == -1) ? cudaCpuDeviceId : device;
        cudaMemPrefetchAsync(ptr, size, target, stream);
    }
    
    /**
     * @brief Set memory access hints
     * @param ptr Memory pointer
     * @param size Memory size
     * @param device Device that will access memory
     * @param flags Access flags (read-only, preferred location, etc.)
     */
    void set_access_hint(void* ptr, size_t size, int device, unsigned int flags = 0) {
        if (!use_access_hints_) return;
        
        cudaMemAdvise(ptr, size, cudaMemAdviseSetPreferredLocation, device);
        
        if (flags & cudaMemAdviseSetReadMostly) {
            cudaMemAdvise(ptr, size, cudaMemAdviseSetReadMostly, device);
        }
        
        if (flags & cudaMemAdviseSetAccessedBy) {
            cudaMemAdvise(ptr, size, cudaMemAdviseSetAccessedBy, device);
        }
    }
    
    /**
     * @brief Perform zero-copy memory mapping
     * @param host_ptr Host memory pointer
     * @param size Memory size
     * @return Device-accessible pointer
     */
    void* zero_copy_map(void* host_ptr, size_t size) {
        void* device_ptr = nullptr;
        
        // Register host memory for zero-copy access
        cudaHostRegister(host_ptr, size, cudaHostRegisterMapped);
        
        // Get device pointer
        cudaHostGetDevicePointer(&device_ptr, host_ptr, 0);
        
        return device_ptr;
    }
    
    /**
     * @brief Unmap zero-copy memory
     * @param host_ptr Host memory pointer
     */
    void zero_copy_unmap(void* host_ptr) {
        cudaHostUnregister(host_ptr);
    }
    
    /**
     * @brief Get pool statistics
     * @return Current pool statistics
     */
    PoolStats get_stats() const {
        return stats_;
    }
    
    /**
     * @brief Defragment memory pool
     * @return Number of blocks consolidated
     */
    size_t defragment() {
        std::lock_guard<std::mutex> lock(pool_mutex_);
        
        size_t consolidated = 0;
        std::vector<MemoryBlock> new_blocks;
        std::map<void*, void*> relocation_map;
        
        // Sort blocks by address
        std::sort(memory_blocks_.begin(), memory_blocks_.end(),
                  [](const MemoryBlock& a, const MemoryBlock& b) {
                      return a.ptr < b.ptr;
                  });
        
        // Consolidate adjacent free blocks
        for (size_t i = 0; i < memory_blocks_.size(); ++i) {
            auto& block = memory_blocks_[i];
            
            if (block.is_free && i + 1 < memory_blocks_.size()) {
                auto& next_block = memory_blocks_[i + 1];
                
                // Check if blocks are adjacent
                if ((char*)block.ptr + block.size == next_block.ptr && next_block.is_free) {
                    // Merge blocks
                    block.size += next_block.size;
                    cudaFree(next_block.ptr);
                    consolidated++;
                    continue;
                }
            }
            
            new_blocks.push_back(block);
        }
        
        memory_blocks_ = std::move(new_blocks);
        stats_.fragmentation_count = consolidated;
        
        return consolidated;
    }

private:
    /**
     * @brief Pre-allocate initial memory pool
     * @param size Initial pool size
     */
    void preallocate_pool(size_t size) {
        // Allocate in chunks for better management
        const size_t chunk_size = std::min(size, size_t(256 * 1024 * 1024)); // 256MB chunks
        size_t remaining = size;
        
        while (remaining > 0) {
            size_t alloc_size = std::min(remaining, chunk_size);
            void* ptr = nullptr;
            
            // Allocate unified memory
            cudaError_t err = cudaMallocManaged(&ptr, alloc_size, cudaMemAttachGlobal);
            if (err != cudaSuccess) {
                throw std::runtime_error("Failed to allocate unified memory: " + 
                                       std::string(cudaGetErrorString(err)));
            }
            
            // Create memory block
            MemoryBlock block;
            block.ptr = ptr;
            block.size = alloc_size;
            block.is_free = true;
            block.is_pinned = false;
            block.stream = 0;
            block.ref_count = 0;
            
            memory_blocks_.push_back(block);
            stats_.total_allocated += alloc_size;
            
            remaining -= alloc_size;
        }
    }
    
    /**
     * @brief Allocate from existing block
     * @param block_idx Block index
     * @param size Requested size
     * @param stream CUDA stream
     * @return Allocated pointer
     */
    void* allocate_from_block(size_t block_idx, size_t size, cudaStream_t stream) {
        auto& block = memory_blocks_[block_idx];
        
        // If block is exactly the right size, use it as-is
        if (block.size == size) {
            block.is_free = false;
            block.stream = stream;
            block.ref_count = 1;
            ptr_to_block_[block.ptr] = block_idx;
            
            stats_.total_used += size;
            stats_.allocation_count++;
            update_peak_usage();
            
            return block.ptr;
        }
        
        // Split block if it's larger than needed
        if (block.size > size + MIN_BLOCK_SIZE) {
            // Create new block for remaining memory
            MemoryBlock new_block;
            new_block.ptr = (char*)block.ptr + size;
            new_block.size = block.size - size;
            new_block.is_free = true;
            new_block.is_pinned = block.is_pinned;
            new_block.stream = 0;
            new_block.ref_count = 0;
            
            // Update original block
            block.size = size;
            block.is_free = false;
            block.stream = stream;
            block.ref_count = 1;
            ptr_to_block_[block.ptr] = block_idx;
            
            // Insert new block after current one
            memory_blocks_.insert(memory_blocks_.begin() + block_idx + 1, new_block);
            
            stats_.total_used += size;
            stats_.allocation_count++;
            update_peak_usage();
            
            return block.ptr;
        }
        
        // Use entire block even if slightly larger than requested
        block.is_free = false;
        block.stream = stream;
        block.ref_count = 1;
        ptr_to_block_[block.ptr] = block_idx;
        
        stats_.total_used += block.size;
        stats_.allocation_count++;
        update_peak_usage();
        
        return block.ptr;
    }
    
    /**
     * @brief Allocate new memory block
     * @param size Block size
     * @param stream CUDA stream
     * @param pinned Whether to use pinned memory
     * @return Allocated pointer
     */
    void* allocate_new_block(size_t size, cudaStream_t stream, bool pinned) {
        void* ptr = nullptr;
        cudaError_t err;
        
        if (pinned) {
            // Allocate pinned host memory
            err = cudaMallocHost(&ptr, size);
        } else {
            // Allocate unified memory
            err = cudaMallocManaged(&ptr, size, cudaMemAttachGlobal);
        }
        
        if (err != cudaSuccess) {
            throw std::runtime_error("Failed to allocate memory: " + 
                                   std::string(cudaGetErrorString(err)));
        }
        
        // Create new block
        MemoryBlock block;
        block.ptr = ptr;
        block.size = size;
        block.is_free = false;
        block.is_pinned = pinned;
        block.stream = stream;
        block.ref_count = 1;
        
        size_t block_idx = memory_blocks_.size();
        memory_blocks_.push_back(block);
        ptr_to_block_[ptr] = block_idx;
        
        stats_.total_allocated += size;
        stats_.total_used += size;
        stats_.allocation_count++;
        update_peak_usage();
        
        return ptr;
    }
    
    /**
     * @brief Coalesce adjacent free blocks
     */
    void coalesce_free_blocks() {
        bool changed = true;
        
        while (changed) {
            changed = false;
            
            for (size_t i = 0; i < memory_blocks_.size() - 1; ++i) {
                auto& block = memory_blocks_[i];
                auto& next = memory_blocks_[i + 1];
                
                if (block.is_free && next.is_free && 
                    block.is_pinned == next.is_pinned &&
                    (char*)block.ptr + block.size == next.ptr) {
                    
                    // Merge blocks
                    block.size += next.size;
                    memory_blocks_.erase(memory_blocks_.begin() + i + 1);
                    changed = true;
                    stats_.fragmentation_count--;
                    break;
                }
            }
        }
    }
    
    /**
     * @brief Update peak usage statistics
     */
    void update_peak_usage() {
        size_t current = stats_.total_used.load();
        size_t peak = stats_.peak_usage.load();
        
        while (current > peak && 
               !stats_.peak_usage.compare_exchange_weak(peak, current)) {
            // Keep trying until successful
        }
    }
    
    /**
     * @brief Align size to boundary
     * @param size Original size
     * @param alignment Alignment boundary
     * @return Aligned size
     */
    size_t align_size(size_t size, size_t alignment) {
        return (size + alignment - 1) & ~(alignment - 1);
    }
    
    /**
     * @brief Clean up all allocated memory
     */
    void cleanup_pool() {
        std::lock_guard<std::mutex> lock(pool_mutex_);
        
        for (auto& block : memory_blocks_) {
            if (block.is_pinned) {
                cudaFreeHost(block.ptr);
            } else {
                cudaFree(block.ptr);
            }
        }
        
        memory_blocks_.clear();
        ptr_to_block_.clear();
    }
};

} // namespace memory
} // namespace nvidia_comms