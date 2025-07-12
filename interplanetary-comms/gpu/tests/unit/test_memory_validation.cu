/**
 * Memory Validation Tests for GPU Implementation
 * Tests memory patterns, allocations, and data integrity
 */

#include "../utils/cuda_test_framework.cuh"
#include <cuda_runtime.h>
#include <thrust/device_vector.h>
#include <thrust/host_vector.h>
#include <thrust/fill.h>
#include <thrust/sequence.h>
#include <random>

using namespace cuda_test;

class MemoryPatternTest : public CudaTest {
private:
    size_t test_size_;
    void* d_memory_;
    void* h_reference_;
    void* h_result_;
    
    enum PatternType {
        PATTERN_ZEROS,
        PATTERN_ONES,
        PATTERN_CHECKERBOARD,
        PATTERN_SEQUENTIAL,
        PATTERN_RANDOM,
        PATTERN_WALKING_ONES,
        PATTERN_WALKING_ZEROS
    };
    
public:
    MemoryPatternTest(size_t size_mb = 100) 
        : CudaTest(), test_size_(size_mb * 1024 * 1024) {
        d_memory_ = nullptr;
        h_reference_ = nullptr;
        h_result_ = nullptr;
    }
    
    void SetUp() override {
        // Allocate device memory
        CUDA_CHECK(cudaMalloc(&d_memory_, test_size_));
        
        // Allocate host memory
        h_reference_ = malloc(test_size_);
        h_result_ = malloc(test_size_);
        
        if (!h_reference_ || !h_result_) {
            throw std::runtime_error("Failed to allocate host memory");
        }
    }
    
    TestResult Run() override {
        TestResult result;
        result.test_name = "Memory Pattern Validation Test";
        result.passed = true;
        
        // Test different memory patterns
        std::vector<PatternType> patterns = {
            PATTERN_ZEROS,
            PATTERN_ONES,
            PATTERN_CHECKERBOARD,
            PATTERN_SEQUENTIAL,
            PATTERN_RANDOM,
            PATTERN_WALKING_ONES,
            PATTERN_WALKING_ZEROS
        };
        
        for (auto pattern : patterns) {
            if (!TestPattern(pattern)) {
                result.passed = false;
                result.error_message += "Pattern " + PatternName(pattern) + " failed. ";
            }
        }
        
        // Test memory bandwidth
        float bandwidth = TestMemoryBandwidth();
        result.metrics.memory_bandwidth_gb_s = bandwidth;
        
        // Test memory coherency
        if (!TestMemoryCoherency()) {
            result.passed = false;
            result.error_message += "Memory coherency test failed. ";
        }
        
        // Test edge cases
        if (!TestEdgeCases()) {
            result.passed = false;
            result.error_message += "Edge case tests failed. ";
        }
        
        return result;
    }
    
    void TearDown() override {
        if (d_memory_) cudaFree(d_memory_);
        if (h_reference_) free(h_reference_);
        if (h_result_) free(h_result_);
    }
    
private:
    bool TestPattern(PatternType pattern) {
        // Generate pattern in host memory
        GeneratePattern(h_reference_, test_size_, pattern);
        
        // Copy to device
        CUDA_CHECK(cudaMemcpy(d_memory_, h_reference_, test_size_, cudaMemcpyHostToDevice));
        
        // Copy back to verify
        CUDA_CHECK(cudaMemcpy(h_result_, d_memory_, test_size_, cudaMemcpyDeviceToHost));
        
        // Compare
        return memcmp(h_reference_, h_result_, test_size_) == 0;
    }
    
    void GeneratePattern(void* buffer, size_t size, PatternType pattern) {
        uint8_t* ptr = static_cast<uint8_t*>(buffer);
        
        switch (pattern) {
            case PATTERN_ZEROS:
                memset(ptr, 0, size);
                break;
                
            case PATTERN_ONES:
                memset(ptr, 0xFF, size);
                break;
                
            case PATTERN_CHECKERBOARD:
                for (size_t i = 0; i < size; ++i) {
                    ptr[i] = (i % 2) ? 0xFF : 0x00;
                }
                break;
                
            case PATTERN_SEQUENTIAL:
                for (size_t i = 0; i < size; ++i) {
                    ptr[i] = i & 0xFF;
                }
                break;
                
            case PATTERN_RANDOM: {
                std::random_device rd;
                std::mt19937 gen(rd());
                std::uniform_int_distribution<> dis(0, 255);
                for (size_t i = 0; i < size; ++i) {
                    ptr[i] = dis(gen);
                }
                break;
            }
                
            case PATTERN_WALKING_ONES:
                for (size_t i = 0; i < size; ++i) {
                    ptr[i] = 1 << (i % 8);
                }
                break;
                
            case PATTERN_WALKING_ZEROS:
                for (size_t i = 0; i < size; ++i) {
                    ptr[i] = ~(1 << (i % 8));
                }
                break;
        }
    }
    
    std::string PatternName(PatternType pattern) {
        switch (pattern) {
            case PATTERN_ZEROS: return "Zeros";
            case PATTERN_ONES: return "Ones";
            case PATTERN_CHECKERBOARD: return "Checkerboard";
            case PATTERN_SEQUENTIAL: return "Sequential";
            case PATTERN_RANDOM: return "Random";
            case PATTERN_WALKING_ONES: return "Walking Ones";
            case PATTERN_WALKING_ZEROS: return "Walking Zeros";
            default: return "Unknown";
        }
    }
    
    float TestMemoryBandwidth() {
        const int iterations = 100;
        cudaEvent_t start, stop;
        CUDA_CHECK(cudaEventCreate(&start));
        CUDA_CHECK(cudaEventCreate(&stop));
        
        // Test H2D bandwidth
        CUDA_CHECK(cudaEventRecord(start));
        for (int i = 0; i < iterations; ++i) {
            CUDA_CHECK(cudaMemcpy(d_memory_, h_reference_, test_size_, cudaMemcpyHostToDevice));
        }
        CUDA_CHECK(cudaEventRecord(stop));
        CUDA_CHECK(cudaEventSynchronize(stop));
        
        float h2d_ms;
        CUDA_CHECK(cudaEventElapsedTime(&h2d_ms, start, stop));
        float h2d_bandwidth = (test_size_ * iterations) / (h2d_ms / 1000.0) / (1024.0 * 1024.0 * 1024.0);
        
        // Test D2H bandwidth
        CUDA_CHECK(cudaEventRecord(start));
        for (int i = 0; i < iterations; ++i) {
            CUDA_CHECK(cudaMemcpy(h_result_, d_memory_, test_size_, cudaMemcpyDeviceToHost));
        }
        CUDA_CHECK(cudaEventRecord(stop));
        CUDA_CHECK(cudaEventSynchronize(stop));
        
        float d2h_ms;
        CUDA_CHECK(cudaEventElapsedTime(&d2h_ms, start, stop));
        float d2h_bandwidth = (test_size_ * iterations) / (d2h_ms / 1000.0) / (1024.0 * 1024.0 * 1024.0);
        
        CUDA_CHECK(cudaEventDestroy(start));
        CUDA_CHECK(cudaEventDestroy(stop));
        
        std::cout << "H2D Bandwidth: " << h2d_bandwidth << " GB/s" << std::endl;
        std::cout << "D2H Bandwidth: " << d2h_bandwidth << " GB/s" << std::endl;
        
        return (h2d_bandwidth + d2h_bandwidth) / 2.0f;
    }
    
    bool TestMemoryCoherency() {
        // Test concurrent memory access patterns
        const size_t chunk_size = 1024 * 1024; // 1MB chunks
        const size_t num_chunks = test_size_ / chunk_size;
        
        // Create streams for concurrent operations
        const int num_streams = 4;
        cudaStream_t streams[num_streams];
        for (int i = 0; i < num_streams; ++i) {
            CUDA_CHECK(cudaStreamCreate(&streams[i]));
        }
        
        // Fill with pattern
        uint8_t* h_ptr = static_cast<uint8_t*>(h_reference_);
        for (size_t i = 0; i < test_size_; ++i) {
            h_ptr[i] = i & 0xFF;
        }
        
        // Copy chunks concurrently
        for (size_t i = 0; i < num_chunks; ++i) {
            int stream_id = i % num_streams;
            size_t offset = i * chunk_size;
            CUDA_CHECK(cudaMemcpyAsync(
                static_cast<uint8_t*>(d_memory_) + offset,
                h_ptr + offset,
                chunk_size,
                cudaMemcpyHostToDevice,
                streams[stream_id]
            ));
        }
        
        // Synchronize all streams
        for (int i = 0; i < num_streams; ++i) {
            CUDA_CHECK(cudaStreamSynchronize(streams[i]));
        }
        
        // Copy back and verify
        CUDA_CHECK(cudaMemcpy(h_result_, d_memory_, test_size_, cudaMemcpyDeviceToHost));
        bool coherent = memcmp(h_reference_, h_result_, test_size_) == 0;
        
        // Cleanup streams
        for (int i = 0; i < num_streams; ++i) {
            cudaStreamDestroy(streams[i]);
        }
        
        return coherent;
    }
    
    bool TestEdgeCases() {
        bool all_passed = true;
        
        // Test unaligned access
        size_t unaligned_offset = 13; // Prime number for worst alignment
        void* d_unaligned = static_cast<uint8_t*>(d_memory_) + unaligned_offset;
        void* h_unaligned = static_cast<uint8_t*>(h_reference_) + unaligned_offset;
        size_t unaligned_size = 1024 * 1024 - unaligned_offset;
        
        CUDA_CHECK(cudaMemcpy(d_unaligned, h_unaligned, unaligned_size, cudaMemcpyHostToDevice));
        CUDA_CHECK(cudaMemcpy(h_result_, d_unaligned, unaligned_size, cudaMemcpyDeviceToHost));
        
        if (memcmp(h_unaligned, h_result_, unaligned_size) != 0) {
            all_passed = false;
        }
        
        // Test zero-size copy (should not crash)
        CUDA_CHECK(cudaMemcpy(d_memory_, h_reference_, 0, cudaMemcpyHostToDevice));
        
        // Test maximum single allocation
        void* d_large = nullptr;
        size_t free_mem, total_mem;
        CUDA_CHECK(cudaMemGetInfo(&free_mem, &total_mem));
        
        size_t max_alloc = free_mem * 0.9; // 90% of free memory
        cudaError_t err = cudaMalloc(&d_large, max_alloc);
        if (err == cudaSuccess) {
            // Test succeeded, free the memory
            cudaFree(d_large);
        } else if (err != cudaErrorMemoryAllocation) {
            // Unexpected error
            all_passed = false;
        }
        
        return all_passed;
    }
};

// Unified Memory Test
class UnifiedMemoryTest : public CudaTest {
private:
    size_t test_size_;
    float* unified_memory_;
    
public:
    UnifiedMemoryTest(size_t size_mb = 10) 
        : CudaTest(), test_size_(size_mb * 1024 * 1024 / sizeof(float)) {
        unified_memory_ = nullptr;
    }
    
    void SetUp() override {
        CUDA_CHECK(cudaMallocManaged(&unified_memory_, test_size_ * sizeof(float)));
    }
    
    TestResult Run() override {
        TestResult result;
        result.test_name = "Unified Memory Test";
        result.passed = true;
        
        // Test CPU write -> GPU read
        for (size_t i = 0; i < test_size_; ++i) {
            unified_memory_[i] = static_cast<float>(i);
        }
        
        // Launch kernel to process data
        dim3 block_size(256);
        dim3 grid_size((test_size_ + block_size.x - 1) / block_size.x);
        
        ProcessUnifiedMemory<<<grid_size, block_size>>>(unified_memory_, test_size_);
        CUDA_CHECK(cudaDeviceSynchronize());
        
        // Verify results on CPU
        for (size_t i = 0; i < test_size_; ++i) {
            float expected = static_cast<float>(i) * 2.0f;
            if (std::abs(unified_memory_[i] - expected) > 1e-6f) {
                result.passed = false;
                result.error_message = "Unified memory data mismatch";
                break;
            }
        }
        
        // Test prefetching
        int device;
        CUDA_CHECK(cudaGetDevice(&device));
        CUDA_CHECK(cudaMemPrefetchAsync(unified_memory_, test_size_ * sizeof(float), device));
        CUDA_CHECK(cudaDeviceSynchronize());
        
        // Test memory advise
        CUDA_CHECK(cudaMemAdvise(unified_memory_, test_size_ * sizeof(float), 
                                cudaMemAdviseSetReadMostly, device));
        
        return result;
    }
    
    void TearDown() override {
        if (unified_memory_) cudaFree(unified_memory_);
    }
    
private:
    __global__ void ProcessUnifiedMemory(float* data, size_t size) {
        size_t idx = blockIdx.x * blockDim.x + threadIdx.x;
        if (idx < size) {
            data[idx] *= 2.0f;
        }
    }
};

// Pinned Memory Test
class PinnedMemoryTest : public CudaTest {
private:
    size_t test_size_;
    float* h_pinned_;
    float* h_pageable_;
    float* d_memory_;
    
public:
    PinnedMemoryTest(size_t size_mb = 100)
        : CudaTest(), test_size_(size_mb * 1024 * 1024 / sizeof(float)) {
        h_pinned_ = nullptr;
        h_pageable_ = nullptr;
        d_memory_ = nullptr;
    }
    
    void SetUp() override {
        // Allocate pinned memory
        CUDA_CHECK(cudaMallocHost(&h_pinned_, test_size_ * sizeof(float)));
        
        // Allocate pageable memory
        h_pageable_ = new float[test_size_];
        
        // Allocate device memory
        CUDA_CHECK(cudaMalloc(&d_memory_, test_size_ * sizeof(float)));
        
        // Initialize data
        for (size_t i = 0; i < test_size_; ++i) {
            h_pinned_[i] = h_pageable_[i] = static_cast<float>(i);
        }
    }
    
    TestResult Run() override {
        TestResult result;
        result.test_name = "Pinned Memory Performance Test";
        result.passed = true;
        
        const int iterations = 100;
        
        // Test pinned memory transfer
        StartTiming();
        for (int i = 0; i < iterations; ++i) {
            CUDA_CHECK(cudaMemcpy(d_memory_, h_pinned_, 
                                 test_size_ * sizeof(float), 
                                 cudaMemcpyHostToDevice));
        }
        float pinned_time = StopTiming();
        
        // Test pageable memory transfer
        StartTiming();
        for (int i = 0; i < iterations; ++i) {
            CUDA_CHECK(cudaMemcpy(d_memory_, h_pageable_, 
                                 test_size_ * sizeof(float), 
                                 cudaMemcpyHostToDevice));
        }
        float pageable_time = StopTiming();
        
        // Calculate speedup
        float speedup = pageable_time / pinned_time;
        
        std::cout << "Pinned Memory Time: " << pinned_time << " ms" << std::endl;
        std::cout << "Pageable Memory Time: " << pageable_time << " ms" << std::endl;
        std::cout << "Speedup: " << speedup << "x" << std::endl;
        
        // Pinned memory should be faster
        if (speedup < 1.1f) {
            result.passed = false;
            result.error_message = "Pinned memory not showing expected performance benefit";
        }
        
        result.metrics.memory_bandwidth_gb_s = CalculateBandwidth(
            test_size_ * sizeof(float) * iterations, pinned_time
        );
        
        return result;
    }
    
    void TearDown() override {
        if (h_pinned_) cudaFreeHost(h_pinned_);
        if (h_pageable_) delete[] h_pageable_;
        if (d_memory_) cudaFree(d_memory_);
    }
};

// Main test runner
int main(int argc, char** argv) {
    TestSuite suite("GPU Memory Validation Tests");
    
    // Add memory tests
    suite.AddTest(std::make_unique<MemoryPatternTest>(10));    // 10MB
    suite.AddTest(std::make_unique<MemoryPatternTest>(100));   // 100MB
    suite.AddTest(std::make_unique<MemoryPatternTest>(1000));  // 1GB
    suite.AddTest(std::make_unique<UnifiedMemoryTest>(100));
    suite.AddTest(std::make_unique<PinnedMemoryTest>(100));
    
    // Check for memory leaks
    MemoryLeakDetector leak_detector;
    leak_detector.Start();
    
    // Run tests
    suite.RunAll();
    
    // Check for leaks
    if (!leak_detector.CheckForLeaks()) {
        std::cerr << "Memory leak detected: " 
                  << leak_detector.GetLeakedBytes() << " bytes" << std::endl;
    }
    
    // Generate report
    suite.GenerateReport("memory_validation_report.json");
    
    return 0;
}