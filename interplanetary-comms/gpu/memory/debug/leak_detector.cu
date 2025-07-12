/**
 * @file leak_detector.cu
 * @brief GPU memory leak detection and profiling utilities
 * 
 * Implements comprehensive memory tracking with:
 * - Real-time leak detection
 * - Allocation call stack tracking
 * - Memory usage profiling
 * - Automatic cleanup suggestions
 */

#include <cuda_runtime.h>
#include <cuda.h>
#include <map>
#include <unordered_map>
#include <vector>
#include <string>
#include <mutex>
#include <atomic>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <algorithm>
#include <execinfo.h>
#include <cxxabi.h>

namespace nvidia_comms {
namespace memory {
namespace debug {

/**
 * @class LeakDetector
 * @brief Comprehensive GPU memory leak detection and analysis
 */
class LeakDetector {
private:
    /**
     * @struct AllocationInfo
     * @brief Metadata for each memory allocation
     */
    struct AllocationInfo {
        size_t size;
        cudaMemoryType type;
        int device_id;
        std::chrono::steady_clock::time_point timestamp;
        std::vector<std::string> call_stack;
        std::string tag;
        cudaStream_t stream;
        bool is_async;
        size_t alignment;
        void* original_ptr;  // For aligned allocations
    };
    
    /**
     * @struct LeakReport
     * @brief Memory leak analysis report
     */
    struct LeakReport {
        size_t total_leaked_bytes;
        size_t leak_count;
        std::vector<std::pair<void*, AllocationInfo>> leaks;
        std::map<std::string, size_t> leaks_by_location;
        std::map<std::string, size_t> leaks_by_tag;
        std::chrono::steady_clock::time_point report_time;
    };
    
    /**
     * @struct MemorySnapshot
     * @brief Point-in-time memory state
     */
    struct MemorySnapshot {
        size_t total_allocated;
        size_t peak_allocated;
        size_t allocation_count;
        size_t deallocation_count;
        std::map<cudaMemoryType, size_t> memory_by_type;
        std::map<int, size_t> memory_by_device;
        std::chrono::steady_clock::time_point timestamp;
    };

    // Allocation tracking
    std::unordered_map<void*, AllocationInfo> allocations_;
    std::mutex allocations_mutex_;
    
    // Statistics
    std::atomic<size_t> total_allocated_{0};
    std::atomic<size_t> peak_allocated_{0};
    std::atomic<size_t> allocation_count_{0};
    std::atomic<size_t> deallocation_count_{0};
    std::atomic<size_t> leak_count_{0};
    
    // Snapshots for timeline analysis
    std::vector<MemorySnapshot> snapshots_;
    std::mutex snapshots_mutex_;
    
    // Configuration
    bool track_call_stacks_;
    size_t max_call_stack_depth_;
    bool auto_check_enabled_;
    std::chrono::seconds check_interval_;
    std::thread checker_thread_;
    std::atomic<bool> shutdown_{false};
    
    // Leak detection thresholds
    size_t leak_size_threshold_;
    std::chrono::seconds leak_age_threshold_;
    
    // Hook original CUDA functions
    static LeakDetector* instance_;
    
public:
    /**
     * @brief Initialize leak detector
     * @param track_stacks Whether to track call stacks
     * @param auto_check Enable automatic leak checking
     * @param check_interval_seconds Interval for automatic checks
     */
    LeakDetector(bool track_stacks = true, bool auto_check = true, 
                 int check_interval_seconds = 60)
        : track_call_stacks_(track_stacks),
          max_call_stack_depth_(20),
          auto_check_enabled_(auto_check),
          check_interval_(check_interval_seconds),
          leak_size_threshold_(1024),  // 1KB minimum
          leak_age_threshold_(300) {   // 5 minutes
        
        instance_ = this;
        
        if (auto_check_enabled_) {
            start_auto_checker();
        }
    }
    
    ~LeakDetector() {
        shutdown_ = true;
        if (checker_thread_.joinable()) {
            checker_thread_.join();
        }
        
        // Final leak report
        auto report = generate_leak_report();
        if (report.leak_count > 0) {
            print_leak_report(report);
        }
    }
    
    /**
     * @brief Track memory allocation
     * @param ptr Allocated pointer
     * @param size Allocation size
     * @param type Memory type
     * @param tag Optional tag for grouping
     */
    void track_allocation(void* ptr, size_t size, cudaMemoryType type = cudaMemoryTypeDevice,
                         const std::string& tag = "") {
        if (!ptr) return;
        
        AllocationInfo info;
        info.size = size;
        info.type = type;
        info.timestamp = std::chrono::steady_clock::now();
        info.tag = tag;
        info.stream = 0;
        info.is_async = false;
        info.alignment = 0;
        info.original_ptr = ptr;
        
        // Get device ID
        cudaGetDevice(&info.device_id);
        
        // Capture call stack if enabled
        if (track_call_stacks_) {
            info.call_stack = capture_call_stack();
        }
        
        {
            std::lock_guard<std::mutex> lock(allocations_mutex_);
            allocations_[ptr] = info;
        }
        
        // Update statistics
        total_allocated_ += size;
        allocation_count_++;
        
        // Update peak
        size_t current = total_allocated_.load();
        size_t peak = peak_allocated_.load();
        while (current > peak && !peak_allocated_.compare_exchange_weak(peak, current)) {}
    }
    
    /**
     * @brief Track memory deallocation
     * @param ptr Deallocated pointer
     */
    void track_deallocation(void* ptr) {
        if (!ptr) return;
        
        AllocationInfo info;
        bool found = false;
        
        {
            std::lock_guard<std::mutex> lock(allocations_mutex_);
            auto it = allocations_.find(ptr);
            if (it != allocations_.end()) {
                info = it->second;
                allocations_.erase(it);
                found = true;
            }
        }
        
        if (found) {
            total_allocated_ -= info.size;
            deallocation_count_++;
        } else {
            // Possible double-free or untracked allocation
            leak_count_++;
        }
    }
    
    /**
     * @brief Check for memory leaks
     * @return Leak report
     */
    LeakReport check_leaks() {
        LeakReport report;
        report.total_leaked_bytes = 0;
        report.leak_count = 0;
        report.report_time = std::chrono::steady_clock::now();
        
        std::lock_guard<std::mutex> lock(allocations_mutex_);
        
        auto now = std::chrono::steady_clock::now();
        
        for (const auto& [ptr, info] : allocations_) {
            auto age = std::chrono::duration_cast<std::chrono::seconds>(now - info.timestamp);
            
            // Consider it a leak if old enough and large enough
            if (info.size >= leak_size_threshold_ && age >= leak_age_threshold_) {
                report.leaks.push_back({ptr, info});
                report.total_leaked_bytes += info.size;
                report.leak_count++;
                
                // Group by location
                if (!info.call_stack.empty()) {
                    report.leaks_by_location[info.call_stack[0]] += info.size;
                }
                
                // Group by tag
                if (!info.tag.empty()) {
                    report.leaks_by_tag[info.tag] += info.size;
                }
            }
        }
        
        return report;
    }
    
    /**
     * @brief Take memory snapshot
     * @return Current memory state
     */
    MemorySnapshot take_snapshot() {
        MemorySnapshot snapshot;
        snapshot.timestamp = std::chrono::steady_clock::now();
        snapshot.total_allocated = total_allocated_;
        snapshot.peak_allocated = peak_allocated_;
        snapshot.allocation_count = allocation_count_;
        snapshot.deallocation_count = deallocation_count_;
        
        {
            std::lock_guard<std::mutex> lock(allocations_mutex_);
            
            for (const auto& [ptr, info] : allocations_) {
                snapshot.memory_by_type[info.type] += info.size;
                snapshot.memory_by_device[info.device_id] += info.size;
            }
        }
        
        {
            std::lock_guard<std::mutex> lock(snapshots_mutex_);
            snapshots_.push_back(snapshot);
        }
        
        return snapshot;
    }
    
    /**
     * @brief Generate memory usage report
     * @return Formatted report string
     */
    std::string generate_usage_report() {
        std::stringstream ss;
        
        ss << "\n=== GPU Memory Usage Report ===\n";
        ss << "Current Allocated: " << format_bytes(total_allocated_) << "\n";
        ss << "Peak Allocated: " << format_bytes(peak_allocated_) << "\n";
        ss << "Total Allocations: " << allocation_count_ << "\n";
        ss << "Total Deallocations: " << deallocation_count_ << "\n";
        ss << "Active Allocations: " << allocations_.size() << "\n";
        
        // Memory by type
        std::map<cudaMemoryType, size_t> by_type;
        std::map<int, size_t> by_device;
        std::map<std::string, size_t> by_tag;
        
        {
            std::lock_guard<std::mutex> lock(allocations_mutex_);
            
            for (const auto& [ptr, info] : allocations_) {
                by_type[info.type] += info.size;
                by_device[info.device_id] += info.size;
                if (!info.tag.empty()) {
                    by_tag[info.tag] += info.size;
                }
            }
        }
        
        ss << "\nMemory by Type:\n";
        for (const auto& [type, size] : by_type) {
            ss << "  " << memory_type_string(type) << ": " << format_bytes(size) << "\n";
        }
        
        ss << "\nMemory by Device:\n";
        for (const auto& [device, size] : by_device) {
            ss << "  Device " << device << ": " << format_bytes(size) << "\n";
        }
        
        if (!by_tag.empty()) {
            ss << "\nMemory by Tag:\n";
            for (const auto& [tag, size] : by_tag) {
                ss << "  " << tag << ": " << format_bytes(size) << "\n";
            }
        }
        
        return ss.str();
    }
    
    /**
     * @brief Get largest allocations
     * @param count Number of allocations to return
     * @return Vector of largest allocations
     */
    std::vector<std::pair<void*, AllocationInfo>> get_largest_allocations(size_t count = 10) {
        std::vector<std::pair<void*, AllocationInfo>> result;
        
        {
            std::lock_guard<std::mutex> lock(allocations_mutex_);
            
            for (const auto& alloc : allocations_) {
                result.push_back(alloc);
            }
        }
        
        // Sort by size descending
        std::sort(result.begin(), result.end(),
                  [](const auto& a, const auto& b) {
                      return a.second.size > b.second.size;
                  });
        
        if (result.size() > count) {
            result.resize(count);
        }
        
        return result;
    }
    
    /**
     * @brief Set leak detection thresholds
     * @param size_threshold Minimum size to consider a leak
     * @param age_seconds Minimum age to consider a leak
     */
    void set_leak_thresholds(size_t size_threshold, int age_seconds) {
        leak_size_threshold_ = size_threshold;
        leak_age_threshold_ = std::chrono::seconds(age_seconds);
    }
    
    /**
     * @brief Clear all tracking data
     */
    void reset() {
        std::lock_guard<std::mutex> lock1(allocations_mutex_);
        std::lock_guard<std::mutex> lock2(snapshots_mutex_);
        
        allocations_.clear();
        snapshots_.clear();
        
        total_allocated_ = 0;
        peak_allocated_ = 0;
        allocation_count_ = 0;
        deallocation_count_ = 0;
        leak_count_ = 0;
    }
    
    /**
     * @brief Export tracking data to file
     * @param filename Output filename
     */
    void export_data(const std::string& filename) {
        std::ofstream file(filename);
        if (!file.is_open()) return;
        
        file << "# GPU Memory Tracking Data\n";
        file << "# Generated: " << current_timestamp() << "\n\n";
        
        file << generate_usage_report() << "\n";
        
        // Export allocations
        file << "\n=== Active Allocations ===\n";
        file << "Address,Size,Type,Device,Age(s),Tag,CallStack\n";
        
        std::lock_guard<std::mutex> lock(allocations_mutex_);
        auto now = std::chrono::steady_clock::now();
        
        for (const auto& [ptr, info] : allocations_) {
            auto age = std::chrono::duration_cast<std::chrono::seconds>(now - info.timestamp);
            
            file << ptr << ","
                 << info.size << ","
                 << memory_type_string(info.type) << ","
                 << info.device_id << ","
                 << age.count() << ","
                 << info.tag << ",";
            
            if (!info.call_stack.empty()) {
                file << "\"";
                for (const auto& frame : info.call_stack) {
                    file << frame << ";";
                }
                file << "\"";
            }
            
            file << "\n";
        }
    }

private:
    static LeakDetector* instance_;
    
    void start_auto_checker() {
        checker_thread_ = std::thread([this]() {
            while (!shutdown_) {
                std::this_thread::sleep_for(check_interval_);
                
                if (shutdown_) break;
                
                auto report = check_leaks();
                if (report.leak_count > 0) {
                    std::cerr << "\n[LeakDetector] Potential memory leaks detected!\n";
                    print_leak_report(report);
                }
            }
        });
    }
    
    std::vector<std::string> capture_call_stack() {
        std::vector<std::string> stack;
        
        void* buffer[max_call_stack_depth_];
        int frames = backtrace(buffer, max_call_stack_depth_);
        
        char** symbols = backtrace_symbols(buffer, frames);
        if (symbols) {
            for (int i = 2; i < frames; ++i) { // Skip first 2 frames (this function)
                stack.push_back(demangle_symbol(symbols[i]));
            }
            free(symbols);
        }
        
        return stack;
    }
    
    std::string demangle_symbol(const std::string& symbol) {
        // Extract mangled name from symbol
        size_t start = symbol.find('(');
        size_t plus = symbol.find('+', start);
        
        if (start == std::string::npos || plus == std::string::npos) {
            return symbol;
        }
        
        std::string mangled = symbol.substr(start + 1, plus - start - 1);
        
        int status;
        char* demangled = abi::__cxa_demangle(mangled.c_str(), nullptr, nullptr, &status);
        
        if (status == 0 && demangled) {
            std::string result = demangled;
            free(demangled);
            return result;
        }
        
        return symbol;
    }
    
    void print_leak_report(const LeakReport& report) {
        std::cerr << "Total Leaked: " << format_bytes(report.total_leaked_bytes) 
                  << " in " << report.leak_count << " allocations\n";
        
        if (!report.leaks_by_location.empty()) {
            std::cerr << "\nLeaks by Location:\n";
            for (const auto& [location, size] : report.leaks_by_location) {
                std::cerr << "  " << location << ": " << format_bytes(size) << "\n";
            }
        }
        
        if (!report.leaks_by_tag.empty()) {
            std::cerr << "\nLeaks by Tag:\n";
            for (const auto& [tag, size] : report.leaks_by_tag) {
                std::cerr << "  " << tag << ": " << format_bytes(size) << "\n";
            }
        }
        
        // Show top 5 largest leaks
        std::cerr << "\nLargest Leaks:\n";
        auto sorted_leaks = report.leaks;
        std::sort(sorted_leaks.begin(), sorted_leaks.end(),
                  [](const auto& a, const auto& b) {
                      return a.second.size > b.second.size;
                  });
        
        for (size_t i = 0; i < std::min(size_t(5), sorted_leaks.size()); ++i) {
            const auto& [ptr, info] = sorted_leaks[i];
            std::cerr << "  " << ptr << ": " << format_bytes(info.size);
            
            if (!info.tag.empty()) {
                std::cerr << " [" << info.tag << "]";
            }
            
            if (!info.call_stack.empty()) {
                std::cerr << "\n    at " << info.call_stack[0];
            }
            
            std::cerr << "\n";
        }
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
    
    std::string memory_type_string(cudaMemoryType type) {
        switch (type) {
            case cudaMemoryTypeHost: return "Host";
            case cudaMemoryTypeDevice: return "Device";
            case cudaMemoryTypeArray: return "Array";
            case cudaMemoryTypeUnified: return "Unified";
            default: return "Unknown";
        }
    }
    
    std::string current_timestamp() {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        
        std::stringstream ss;
        ss << std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S");
        return ss.str();
    }
    
    LeakReport generate_leak_report() {
        return check_leaks();
    }
};

// Static member initialization
LeakDetector* LeakDetector::instance_ = nullptr;

/**
 * @class MemoryGuard
 * @brief RAII wrapper for automatic memory tracking
 */
template<typename T>
class MemoryGuard {
private:
    T* ptr_;
    size_t size_;
    LeakDetector* detector_;
    
public:
    MemoryGuard(T* ptr, size_t count, LeakDetector* detector, 
                const std::string& tag = "")
        : ptr_(ptr), size_(count * sizeof(T)), detector_(detector) {
        if (detector_ && ptr_) {
            detector_->track_allocation(ptr_, size_, cudaMemoryTypeDevice, tag);
        }
    }
    
    ~MemoryGuard() {
        if (detector_ && ptr_) {
            detector_->track_deallocation(ptr_);
            cudaFree(ptr_);
        }
    }
    
    // Disable copy
    MemoryGuard(const MemoryGuard&) = delete;
    MemoryGuard& operator=(const MemoryGuard&) = delete;
    
    // Enable move
    MemoryGuard(MemoryGuard&& other) noexcept
        : ptr_(other.ptr_), size_(other.size_), detector_(other.detector_) {
        other.ptr_ = nullptr;
    }
    
    MemoryGuard& operator=(MemoryGuard&& other) noexcept {
        if (this != &other) {
            if (ptr_) {
                detector_->track_deallocation(ptr_);
                cudaFree(ptr_);
            }
            ptr_ = other.ptr_;
            size_ = other.size_;
            detector_ = other.detector_;
            other.ptr_ = nullptr;
        }
        return *this;
    }
    
    T* get() { return ptr_; }
    const T* get() const { return ptr_; }
    T* release() {
        T* temp = ptr_;
        ptr_ = nullptr;
        return temp;
    }
    
    operator T*() { return ptr_; }
    operator const T*() const { return ptr_; }
};

/**
 * @brief Convenience function to create tracked allocation
 */
template<typename T>
MemoryGuard<T> make_tracked_allocation(size_t count, LeakDetector* detector,
                                       const std::string& tag = "") {
    T* ptr = nullptr;
    cudaMalloc(&ptr, count * sizeof(T));
    return MemoryGuard<T>(ptr, count, detector, tag);
}

} // namespace debug
} // namespace memory
} // namespace nvidia_comms