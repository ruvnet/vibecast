/**
 * CUDA Test Framework for Interplanetary Communication System
 * Provides comprehensive testing utilities for GPU kernels
 */

#ifndef CUDA_TEST_FRAMEWORK_CUH
#define CUDA_TEST_FRAMEWORK_CUH

#include <cuda_runtime.h>
#include <cudnn.h>
#include <cublas_v2.h>
#include <cufft.h>
#include <curand.h>
#include <thrust/device_vector.h>
#include <thrust/host_vector.h>
#include <iostream>
#include <chrono>
#include <vector>
#include <string>
#include <functional>
#include <map>

namespace cuda_test {

// Error checking macros
#define CUDA_CHECK(call) \
    do { \
        cudaError_t error = call; \
        if (error != cudaSuccess) { \
            std::cerr << "CUDA Error: " << cudaGetErrorString(error) \
                      << " at " << __FILE__ << ":" << __LINE__ << std::endl; \
            exit(1); \
        } \
    } while(0)

#define CUDNN_CHECK(call) \
    do { \
        cudnnStatus_t status = call; \
        if (status != CUDNN_STATUS_SUCCESS) { \
            std::cerr << "cuDNN Error: " << cudnnGetErrorString(status) \
                      << " at " << __FILE__ << ":" << __LINE__ << std::endl; \
            exit(1); \
        } \
    } while(0)

#define CUBLAS_CHECK(call) \
    do { \
        cublasStatus_t status = call; \
        if (status != CUBLAS_STATUS_SUCCESS) { \
            std::cerr << "cuBLAS Error: " << status \
                      << " at " << __FILE__ << ":" << __LINE__ << std::endl; \
            exit(1); \
        } \
    } while(0)

// Performance metrics structure
struct PerformanceMetrics {
    double kernel_time_ms;
    double memory_bandwidth_gb_s;
    double compute_throughput_gflops;
    double power_consumption_watts;
    double temperature_celsius;
    size_t memory_used_bytes;
    size_t shared_memory_bytes;
    size_t registers_per_thread;
    float occupancy_percentage;
};

// Test result structure
struct TestResult {
    std::string test_name;
    bool passed;
    std::string error_message;
    PerformanceMetrics metrics;
    std::chrono::duration<double> execution_time;
};

// Base test class
class CudaTest {
protected:
    cudaStream_t stream_;
    cudaEvent_t start_event_;
    cudaEvent_t stop_event_;
    int device_id_;
    cudaDeviceProp device_props_;
    
public:
    CudaTest(int device_id = 0) : device_id_(device_id) {
        CUDA_CHECK(cudaSetDevice(device_id_));
        CUDA_CHECK(cudaGetDeviceProperties(&device_props_, device_id_));
        CUDA_CHECK(cudaStreamCreate(&stream_));
        CUDA_CHECK(cudaEventCreate(&start_event_));
        CUDA_CHECK(cudaEventCreate(&stop_event_));
    }
    
    virtual ~CudaTest() {
        cudaStreamDestroy(stream_);
        cudaEventDestroy(start_event_);
        cudaEventDestroy(stop_event_);
    }
    
    // Virtual methods to be implemented by test cases
    virtual void SetUp() = 0;
    virtual TestResult Run() = 0;
    virtual void TearDown() = 0;
    
    // Performance measurement utilities
    void StartTiming() {
        CUDA_CHECK(cudaEventRecord(start_event_, stream_));
    }
    
    float StopTiming() {
        CUDA_CHECK(cudaEventRecord(stop_event_, stream_));
        CUDA_CHECK(cudaEventSynchronize(stop_event_));
        float milliseconds = 0;
        CUDA_CHECK(cudaEventElapsedTime(&milliseconds, start_event_, stop_event_));
        return milliseconds;
    }
    
    // Memory bandwidth calculation
    double CalculateBandwidth(size_t bytes_transferred, float time_ms) {
        return (bytes_transferred / (1024.0 * 1024.0 * 1024.0)) / (time_ms / 1000.0);
    }
    
    // FLOPS calculation
    double CalculateThroughput(size_t operations, float time_ms) {
        return (operations / 1e9) / (time_ms / 1000.0);
    }
    
    // Device memory info
    void GetMemoryInfo(size_t& free_bytes, size_t& total_bytes) {
        CUDA_CHECK(cudaMemGetInfo(&free_bytes, &total_bytes));
    }
    
    // Occupancy calculation
    float CalculateOccupancy(int blocks_per_sm, int threads_per_block) {
        int max_threads_per_sm = device_props_.maxThreadsPerMultiProcessor;
        int active_threads = blocks_per_sm * threads_per_block;
        return (float)active_threads / max_threads_per_sm * 100.0f;
    }
};

// Test suite manager
class TestSuite {
private:
    std::vector<std::unique_ptr<CudaTest>> tests_;
    std::vector<TestResult> results_;
    std::string suite_name_;
    
public:
    TestSuite(const std::string& name) : suite_name_(name) {}
    
    void AddTest(std::unique_ptr<CudaTest> test) {
        tests_.push_back(std::move(test));
    }
    
    void RunAll() {
        std::cout << "\n=== Running Test Suite: " << suite_name_ << " ===" << std::endl;
        
        for (auto& test : tests_) {
            test->SetUp();
            auto result = test->Run();
            results_.push_back(result);
            test->TearDown();
            
            std::cout << "[" << (result.passed ? "PASS" : "FAIL") << "] " 
                      << result.test_name << std::endl;
            if (!result.passed) {
                std::cout << "  Error: " << result.error_message << std::endl;
            }
        }
    }
    
    void GenerateReport(const std::string& filename) {
        // Implementation in separate file
    }
    
    const std::vector<TestResult>& GetResults() const { return results_; }
};

// Memory leak detector
class MemoryLeakDetector {
private:
    size_t initial_free_bytes_;
    size_t initial_total_bytes_;
    
public:
    void Start() {
        cudaMemGetInfo(&initial_free_bytes_, &initial_total_bytes_);
    }
    
    bool CheckForLeaks() {
        size_t current_free_bytes, current_total_bytes;
        cudaMemGetInfo(&current_free_bytes, &current_total_bytes);
        
        // Allow for small variations due to driver allocations
        const size_t tolerance = 1024 * 1024; // 1MB tolerance
        return std::abs((long long)current_free_bytes - (long long)initial_free_bytes_) < tolerance;
    }
    
    size_t GetLeakedBytes() {
        size_t current_free_bytes, current_total_bytes;
        cudaMemGetInfo(&current_free_bytes, &current_total_bytes);
        return initial_free_bytes_ > current_free_bytes ? 
               initial_free_bytes_ - current_free_bytes : 0;
    }
};

// Correctness verifier utilities
template<typename T>
bool CompareArrays(const T* expected, const T* actual, size_t size, T tolerance) {
    for (size_t i = 0; i < size; ++i) {
        if (std::abs(expected[i] - actual[i]) > tolerance) {
            std::cerr << "Mismatch at index " << i << ": expected " 
                      << expected[i] << ", got " << actual[i] << std::endl;
            return false;
        }
    }
    return true;
}

// Random data generator
template<typename T>
void GenerateRandomData(T* data, size_t size, T min_val, T max_val) {
    curandGenerator_t gen;
    curandCreateGenerator(&gen, CURAND_RNG_PSEUDO_DEFAULT);
    curandSetPseudoRandomGeneratorSeed(gen, 1234ULL);
    
    if constexpr (std::is_same_v<T, float>) {
        curandGenerateUniform(gen, data, size);
        // Scale to [min_val, max_val]
        thrust::device_ptr<T> d_ptr(data);
        thrust::transform(d_ptr, d_ptr + size, d_ptr,
            [=] __device__ (T val) { return min_val + val * (max_val - min_val); });
    }
    
    curandDestroyGenerator(gen);
}

// Kernel profiler
class KernelProfiler {
private:
    cudaEvent_t* events_;
    int num_events_;
    int current_event_;
    std::vector<std::string> event_names_;
    std::vector<float> event_times_;
    
public:
    KernelProfiler(int max_events = 100) : num_events_(max_events), current_event_(0) {
        events_ = new cudaEvent_t[num_events_ * 2]; // pairs of start/stop
        for (int i = 0; i < num_events_ * 2; ++i) {
            CUDA_CHECK(cudaEventCreate(&events_[i]));
        }
    }
    
    ~KernelProfiler() {
        for (int i = 0; i < num_events_ * 2; ++i) {
            cudaEventDestroy(events_[i]);
        }
        delete[] events_;
    }
    
    void MarkStart(const std::string& name, cudaStream_t stream = 0) {
        if (current_event_ < num_events_) {
            event_names_.push_back(name);
            CUDA_CHECK(cudaEventRecord(events_[current_event_ * 2], stream));
        }
    }
    
    void MarkEnd(cudaStream_t stream = 0) {
        if (current_event_ < num_events_) {
            CUDA_CHECK(cudaEventRecord(events_[current_event_ * 2 + 1], stream));
            current_event_++;
        }
    }
    
    void PrintSummary() {
        CUDA_CHECK(cudaDeviceSynchronize());
        
        std::cout << "\n=== Kernel Profiling Summary ===" << std::endl;
        float total_time = 0.0f;
        
        for (int i = 0; i < current_event_; ++i) {
            float time_ms;
            CUDA_CHECK(cudaEventElapsedTime(&time_ms, 
                events_[i * 2], events_[i * 2 + 1]));
            event_times_.push_back(time_ms);
            total_time += time_ms;
            
            std::cout << event_names_[i] << ": " << time_ms << " ms" << std::endl;
        }
        
        std::cout << "Total Time: " << total_time << " ms" << std::endl;
    }
};

} // namespace cuda_test

#endif // CUDA_TEST_FRAMEWORK_CUH