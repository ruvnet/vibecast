/**
 * @file allocation_strategies.cu
 * @brief GPU memory allocation strategies for different workload patterns
 * 
 * Implements various allocation strategies optimized for:
 * - High-frequency small allocations
 * - Large contiguous allocations
 * - Stream-aware allocations
 * - NUMA-aware allocations
 */

#include <cuda_runtime.h>
#include <cuda.h>
#include <memory>
#include <vector>
#include <queue>
#include <unordered_map>
#include <algorithm>
#include <chrono>

namespace nvidia_comms {
namespace memory {
namespace strategies {

/**
 * @class AllocationStrategy
 * @brief Base class for GPU memory allocation strategies
 */
class AllocationStrategy {
public:
    virtual ~AllocationStrategy() = default;
    
    /**
     * @brief Allocate memory according to strategy
     * @param size Requested memory size
     * @param stream CUDA stream for allocation
     * @return Allocated memory pointer
     */
    virtual void* allocate(size_t size, cudaStream_t stream = 0) = 0;
    
    /**
     * @brief Deallocate memory
     * @param ptr Memory pointer to deallocate
     * @param stream CUDA stream for deallocation
     */
    virtual void deallocate(void* ptr, cudaStream_t stream = 0) = 0;
    
    /**
     * @brief Get strategy statistics
     * @return Strategy-specific statistics
     */
    virtual std::string get_stats() const = 0;
    
    /**
     * @brief Optimize strategy based on usage patterns
     */
    virtual void optimize() = 0;
};

/**
 * @class BuddyAllocator
 * @brief Buddy allocation strategy for efficient memory management
 */
class BuddyAllocator : public AllocationStrategy {
private:
    struct Block {
        void* ptr;
        size_t size;
        int level;
        bool is_free;
        Block* buddy;
        cudaStream_t stream;
    };
    
    static constexpr size_t MIN_BLOCK_SIZE = 1024;      // 1KB
    static constexpr size_t MAX_BLOCK_SIZE = 1ULL << 30; // 1GB
    static constexpr int MAX_LEVELS = 21;               // 2^20 * MIN_BLOCK_SIZE = 1GB
    
    std::vector<std::vector<Block*>> free_lists_;
    std::unordered_map<void*, Block*> allocated_blocks_;
    void* base_ptr_;
    size_t total_size_;
    size_t allocated_size_;
    std::mutex mutex_;
    
public:
    BuddyAllocator(size_t size = 1ULL << 30) : total_size_(size), allocated_size_(0) {
        // Initialize free lists for each level
        free_lists_.resize(MAX_LEVELS);
        
        // Allocate base memory
        cudaMalloc(&base_ptr_, total_size_);
        
        // Create initial block covering entire memory
        Block* initial_block = new Block{
            base_ptr_, total_size_, MAX_LEVELS - 1, true, nullptr, 0
        };
        free_lists_[MAX_LEVELS - 1].push_back(initial_block);
    }
    
    ~BuddyAllocator() override {
        cudaFree(base_ptr_);
        
        // Clean up blocks
        for (auto& level : free_lists_) {
            for (auto* block : level) {
                delete block;
            }
        }
    }
    
    void* allocate(size_t size, cudaStream_t stream = 0) override {
        std::lock_guard<std::mutex> lock(mutex_);
        
        // Round up to nearest power of 2
        size_t block_size = MIN_BLOCK_SIZE;
        int level = 0;
        while (block_size < size && level < MAX_LEVELS - 1) {
            block_size <<= 1;
            level++;
        }
        
        // Find block at appropriate level
        Block* block = find_free_block(level);
        if (!block) return nullptr;
        
        // Mark as allocated
        block->is_free = false;
        block->stream = stream;
        allocated_blocks_[block->ptr] = block;
        allocated_size_ += block->size;
        
        return block->ptr;
    }
    
    void deallocate(void* ptr, cudaStream_t stream = 0) override {
        std::lock_guard<std::mutex> lock(mutex_);
        
        auto it = allocated_blocks_.find(ptr);
        if (it == allocated_blocks_.end()) return;
        
        Block* block = it->second;
        allocated_blocks_.erase(it);
        allocated_size_ -= block->size;
        
        // Mark as free and coalesce with buddy if possible
        block->is_free = true;
        coalesce_block(block);
    }
    
    std::string get_stats() const override {
        std::stringstream ss;
        ss << "BuddyAllocator Stats:\n";
        ss << "  Total Size: " << (total_size_ / (1024.0 * 1024.0)) << " MB\n";
        ss << "  Allocated: " << (allocated_size_ / (1024.0 * 1024.0)) << " MB\n";
        ss << "  Fragmentation: " << calculate_fragmentation() << "%\n";
        
        return ss.str();
    }
    
    void optimize() override {
        // Compact free lists by level
        for (auto& level : free_lists_) {
            std::sort(level.begin(), level.end(),
                     [](Block* a, Block* b) { return a->ptr < b->ptr; });
        }
    }
    
private:
    Block* find_free_block(int level) {
        // Check if block available at requested level
        if (!free_lists_[level].empty()) {
            Block* block = free_lists_[level].back();
            free_lists_[level].pop_back();
            return block;
        }
        
        // Try to split larger block
        for (int i = level + 1; i < MAX_LEVELS; ++i) {
            if (!free_lists_[i].empty()) {
                Block* block = free_lists_[i].back();
                free_lists_[i].pop_back();
                
                // Split block recursively
                return split_block(block, level);
            }
        }
        
        return nullptr;
    }
    
    Block* split_block(Block* block, int target_level) {
        while (block->level > target_level) {
            size_t half_size = block->size / 2;
            
            // Create buddy block
            Block* buddy = new Block{
                (char*)block->ptr + half_size,
                half_size,
                block->level - 1,
                true,
                block,
                0
            };
            
            // Update original block
            block->size = half_size;
            block->level--;
            block->buddy = buddy;
            
            // Add buddy to free list
            free_lists_[buddy->level].push_back(buddy);
        }
        
        return block;
    }
    
    void coalesce_block(Block* block) {
        while (block->buddy && block->buddy->is_free && block->level < MAX_LEVELS - 1) {
            Block* buddy = block->buddy;
            
            // Remove buddy from free list
            auto& level_list = free_lists_[buddy->level];
            level_list.erase(
                std::remove(level_list.begin(), level_list.end(), buddy),
                level_list.end()
            );
            
            // Determine which block comes first in memory
            Block* first = (block->ptr < buddy->ptr) ? block : buddy;
            Block* second = (block->ptr < buddy->ptr) ? buddy : block;
            
            // Merge blocks
            first->size *= 2;
            first->level++;
            first->buddy = nullptr;
            
            delete second;
            block = first;
        }
        
        // Add coalesced block to free list
        free_lists_[block->level].push_back(block);
    }
    
    float calculate_fragmentation() const {
        size_t largest_free = 0;
        size_t total_free = total_size_ - allocated_size_;
        
        for (const auto& level : free_lists_) {
            for (const auto* block : level) {
                largest_free = std::max(largest_free, block->size);
            }
        }
        
        if (total_free == 0) return 0.0f;
        return (1.0f - float(largest_free) / float(total_free)) * 100.0f;
    }
};

/**
 * @class SlabAllocator
 * @brief Slab allocation strategy for fixed-size allocations
 */
class SlabAllocator : public AllocationStrategy {
private:
    struct Slab {
        void* base_ptr;
        size_t object_size;
        size_t num_objects;
        std::vector<bool> allocation_map;
        std::queue<size_t> free_indices;
        cudaStream_t stream;
    };
    
    std::unordered_map<size_t, std::vector<std::unique_ptr<Slab>>> slab_cache_;
    std::unordered_map<void*, std::pair<Slab*, size_t>> ptr_to_slab_;
    std::mutex mutex_;
    
    const size_t SLAB_SIZE = 4 * 1024 * 1024; // 4MB slabs
    const std::vector<size_t> PREDEFINED_SIZES = {
        64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536
    };
    
public:
    SlabAllocator() {
        // Pre-allocate slabs for common sizes
        for (size_t size : PREDEFINED_SIZES) {
            allocate_slab(size);
        }
    }
    
    ~SlabAllocator() override {
        for (auto& [size, slabs] : slab_cache_) {
            for (auto& slab : slabs) {
                cudaFree(slab->base_ptr);
            }
        }
    }
    
    void* allocate(size_t size, cudaStream_t stream = 0) override {
        std::lock_guard<std::mutex> lock(mutex_);
        
        // Find best fit slab size
        size_t slab_size = find_best_slab_size(size);
        
        // Get or create slab for this size
        auto& slabs = slab_cache_[slab_size];
        Slab* available_slab = nullptr;
        
        // Find slab with free space
        for (auto& slab : slabs) {
            if (!slab->free_indices.empty()) {
                available_slab = slab.get();
                break;
            }
        }
        
        // Allocate new slab if needed
        if (!available_slab) {
            available_slab = allocate_slab(slab_size);
        }
        
        // Allocate from slab
        size_t index = available_slab->free_indices.front();
        available_slab->free_indices.pop();
        available_slab->allocation_map[index] = true;
        
        void* ptr = (char*)available_slab->base_ptr + (index * slab_size);
        ptr_to_slab_[ptr] = {available_slab, index};
        
        return ptr;
    }
    
    void deallocate(void* ptr, cudaStream_t stream = 0) override {
        std::lock_guard<std::mutex> lock(mutex_);
        
        auto it = ptr_to_slab_.find(ptr);
        if (it == ptr_to_slab_.end()) return;
        
        Slab* slab = it->second.first;
        size_t index = it->second.second;
        
        slab->allocation_map[index] = false;
        slab->free_indices.push(index);
        ptr_to_slab_.erase(it);
    }
    
    std::string get_stats() const override {
        std::stringstream ss;
        ss << "SlabAllocator Stats:\n";
        
        size_t total_allocated = 0;
        size_t total_used = 0;
        
        for (const auto& [size, slabs] : slab_cache_) {
            size_t slab_allocated = slabs.size() * SLAB_SIZE;
            size_t slab_used = 0;
            
            for (const auto& slab : slabs) {
                for (bool allocated : slab->allocation_map) {
                    if (allocated) slab_used += size;
                }
            }
            
            total_allocated += slab_allocated;
            total_used += slab_used;
            
            ss << "  Size " << size << ": "
               << slabs.size() << " slabs, "
               << (slab_used * 100.0 / slab_allocated) << "% utilization\n";
        }
        
        ss << "  Total: " << (total_allocated / (1024.0 * 1024.0)) << " MB allocated, "
           << (total_used / (1024.0 * 1024.0)) << " MB used\n";
        
        return ss.str();
    }
    
    void optimize() override {
        std::lock_guard<std::mutex> lock(mutex_);
        
        // Remove empty slabs that haven't been used recently
        for (auto& [size, slabs] : slab_cache_) {
            slabs.erase(
                std::remove_if(slabs.begin(), slabs.end(),
                    [](const std::unique_ptr<Slab>& slab) {
                        return slab->free_indices.size() == slab->num_objects;
                    }),
                slabs.end()
            );
        }
    }
    
private:
    size_t find_best_slab_size(size_t requested_size) {
        // Find smallest predefined size that fits
        for (size_t size : PREDEFINED_SIZES) {
            if (size >= requested_size) return size;
        }
        
        // Round up to next power of 2 for larger sizes
        size_t size = 1;
        while (size < requested_size) size <<= 1;
        return size;
    }
    
    Slab* allocate_slab(size_t object_size) {
        auto slab = std::make_unique<Slab>();
        slab->object_size = object_size;
        slab->num_objects = SLAB_SIZE / object_size;
        
        // Allocate GPU memory for slab
        cudaMalloc(&slab->base_ptr, SLAB_SIZE);
        
        // Initialize allocation tracking
        slab->allocation_map.resize(slab->num_objects, false);
        for (size_t i = 0; i < slab->num_objects; ++i) {
            slab->free_indices.push(i);
        }
        
        auto& slabs = slab_cache_[object_size];
        slabs.push_back(std::move(slab));
        
        return slabs.back().get();
    }
};

/**
 * @class StreamAwareAllocator
 * @brief Stream-aware allocation strategy for concurrent operations
 */
class StreamAwareAllocator : public AllocationStrategy {
private:
    struct StreamPool {
        cudaStream_t stream;
        std::unique_ptr<BuddyAllocator> allocator;
        std::chrono::steady_clock::time_point last_used;
        size_t allocation_count;
    };
    
    std::unordered_map<cudaStream_t, std::unique_ptr<StreamPool>> stream_pools_;
    std::unique_ptr<BuddyAllocator> default_pool_;
    std::mutex mutex_;
    
    const size_t POOL_SIZE = 256 * 1024 * 1024; // 256MB per stream
    const std::chrono::seconds POOL_TIMEOUT{60};  // 60 second timeout
    
public:
    StreamAwareAllocator() {
        default_pool_ = std::make_unique<BuddyAllocator>(POOL_SIZE * 4);
    }
    
    void* allocate(size_t size, cudaStream_t stream = 0) override {
        std::lock_guard<std::mutex> lock(mutex_);
        
        if (stream == 0) {
            return default_pool_->allocate(size, stream);
        }
        
        // Get or create stream pool
        auto& pool = get_or_create_stream_pool(stream);
        pool->last_used = std::chrono::steady_clock::now();
        pool->allocation_count++;
        
        return pool->allocator->allocate(size, stream);
    }
    
    void deallocate(void* ptr, cudaStream_t stream = 0) override {
        std::lock_guard<std::mutex> lock(mutex_);
        
        if (stream == 0) {
            default_pool_->deallocate(ptr, stream);
            return;
        }
        
        auto it = stream_pools_.find(stream);
        if (it != stream_pools_.end()) {
            it->second->allocator->deallocate(ptr, stream);
        }
    }
    
    std::string get_stats() const override {
        std::stringstream ss;
        ss << "StreamAwareAllocator Stats:\n";
        ss << "  Default Pool:\n" << default_pool_->get_stats();
        ss << "  Stream Pools: " << stream_pools_.size() << "\n";
        
        for (const auto& [stream, pool] : stream_pools_) {
            ss << "    Stream " << stream << ": "
               << pool->allocation_count << " allocations\n";
        }
        
        return ss.str();
    }
    
    void optimize() override {
        std::lock_guard<std::mutex> lock(mutex_);
        
        auto now = std::chrono::steady_clock::now();
        
        // Remove inactive stream pools
        for (auto it = stream_pools_.begin(); it != stream_pools_.end();) {
            if (now - it->second->last_used > POOL_TIMEOUT) {
                it = stream_pools_.erase(it);
            } else {
                it->second->allocator->optimize();
                ++it;
            }
        }
        
        default_pool_->optimize();
    }
    
private:
    StreamPool* get_or_create_stream_pool(cudaStream_t stream) {
        auto it = stream_pools_.find(stream);
        if (it != stream_pools_.end()) {
            return it->second.get();
        }
        
        auto pool = std::make_unique<StreamPool>();
        pool->stream = stream;
        pool->allocator = std::make_unique<BuddyAllocator>(POOL_SIZE);
        pool->last_used = std::chrono::steady_clock::now();
        pool->allocation_count = 0;
        
        auto* pool_ptr = pool.get();
        stream_pools_[stream] = std::move(pool);
        
        return pool_ptr;
    }
};

/**
 * @class AdaptiveAllocator
 * @brief Adaptive allocation strategy that switches based on usage patterns
 */
class AdaptiveAllocator : public AllocationStrategy {
private:
    struct AllocationMetrics {
        size_t small_allocs = 0;      // < 4KB
        size_t medium_allocs = 0;     // 4KB - 1MB
        size_t large_allocs = 0;      // > 1MB
        size_t total_allocs = 0;
        size_t stream_variety = 0;
        std::chrono::steady_clock::time_point last_adaptation;
    };
    
    std::unique_ptr<AllocationStrategy> current_strategy_;
    AllocationMetrics metrics_;
    std::unordered_set<cudaStream_t> unique_streams_;
    std::mutex mutex_;
    
    const size_t ADAPTATION_THRESHOLD = 1000;
    const std::chrono::seconds ADAPTATION_INTERVAL{30};
    
public:
    AdaptiveAllocator() {
        // Start with buddy allocator as default
        current_strategy_ = std::make_unique<BuddyAllocator>();
        metrics_.last_adaptation = std::chrono::steady_clock::now();
    }
    
    void* allocate(size_t size, cudaStream_t stream = 0) override {
        std::lock_guard<std::mutex> lock(mutex_);
        
        // Update metrics
        update_metrics(size, stream);
        
        // Check if adaptation needed
        if (should_adapt()) {
            adapt_strategy();
        }
        
        return current_strategy_->allocate(size, stream);
    }
    
    void deallocate(void* ptr, cudaStream_t stream = 0) override {
        std::lock_guard<std::mutex> lock(mutex_);
        current_strategy_->deallocate(ptr, stream);
    }
    
    std::string get_stats() const override {
        std::stringstream ss;
        ss << "AdaptiveAllocator Stats:\n";
        ss << "  Current Strategy: " << get_strategy_name() << "\n";
        ss << "  Small Allocations: " << metrics_.small_allocs << "\n";
        ss << "  Medium Allocations: " << metrics_.medium_allocs << "\n";
        ss << "  Large Allocations: " << metrics_.large_allocs << "\n";
        ss << "  Stream Variety: " << metrics_.stream_variety << "\n";
        ss << "\n" << current_strategy_->get_stats();
        
        return ss.str();
    }
    
    void optimize() override {
        std::lock_guard<std::mutex> lock(mutex_);
        current_strategy_->optimize();
    }
    
private:
    void update_metrics(size_t size, cudaStream_t stream) {
        metrics_.total_allocs++;
        
        if (size < 4 * 1024) {
            metrics_.small_allocs++;
        } else if (size < 1024 * 1024) {
            metrics_.medium_allocs++;
        } else {
            metrics_.large_allocs++;
        }
        
        unique_streams_.insert(stream);
        metrics_.stream_variety = unique_streams_.size();
    }
    
    bool should_adapt() const {
        auto now = std::chrono::steady_clock::now();
        
        return metrics_.total_allocs >= ADAPTATION_THRESHOLD &&
               (now - metrics_.last_adaptation) >= ADAPTATION_INTERVAL;
    }
    
    void adapt_strategy() {
        float small_ratio = float(metrics_.small_allocs) / metrics_.total_allocs;
        float large_ratio = float(metrics_.large_allocs) / metrics_.total_allocs;
        
        std::unique_ptr<AllocationStrategy> new_strategy;
        
        if (metrics_.stream_variety > 10) {
            // Many streams - use stream-aware allocator
            new_strategy = std::make_unique<StreamAwareAllocator>();
        } else if (small_ratio > 0.7) {
            // Mostly small allocations - use slab allocator
            new_strategy = std::make_unique<SlabAllocator>();
        } else {
            // Mixed or large allocations - use buddy allocator
            new_strategy = std::make_unique<BuddyAllocator>();
        }
        
        current_strategy_ = std::move(new_strategy);
        
        // Reset metrics
        metrics_ = AllocationMetrics{};
        metrics_.last_adaptation = std::chrono::steady_clock::now();
    }
    
    std::string get_strategy_name() const {
        if (dynamic_cast<BuddyAllocator*>(current_strategy_.get())) {
            return "BuddyAllocator";
        } else if (dynamic_cast<SlabAllocator*>(current_strategy_.get())) {
            return "SlabAllocator";
        } else if (dynamic_cast<StreamAwareAllocator*>(current_strategy_.get())) {
            return "StreamAwareAllocator";
        }
        return "Unknown";
    }
};

} // namespace strategies
} // namespace memory
} // namespace nvidia_comms