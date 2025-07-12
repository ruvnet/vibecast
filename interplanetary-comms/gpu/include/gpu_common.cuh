#ifndef GPU_COMMON_CUH
#define GPU_COMMON_CUH

#include <cuda_runtime.h>
#include <cuda.h>
#include <cufft.h>
#include <curand.h>
#include <cublas_v2.h>
#include <cusparse.h>
#include <iostream>
#include <string>
#include <stdexcept>

// CUDA error checking macro
#define CUDA_CHECK(call) \
    do { \
        cudaError_t error = call; \
        if (error != cudaSuccess) { \
            std::cerr << "CUDA error at " << __FILE__ << ":" << __LINE__ \
                      << " code=" << error << " \"" << cudaGetErrorString(error) << "\"" << std::endl; \
            throw std::runtime_error("CUDA error"); \
        } \
    } while(0)

// cuFFT error checking
#define CUFFT_CHECK(call) \
    do { \
        cufftResult error = call; \
        if (error != CUFFT_SUCCESS) { \
            std::cerr << "cuFFT error at " << __FILE__ << ":" << __LINE__ \
                      << " code=" << error << std::endl; \
            throw std::runtime_error("cuFFT error"); \
        } \
    } while(0)

// cuBLAS error checking
#define CUBLAS_CHECK(call) \
    do { \
        cublasStatus_t error = call; \
        if (error != CUBLAS_STATUS_SUCCESS) { \
            std::cerr << "cuBLAS error at " << __FILE__ << ":" << __LINE__ \
                      << " code=" << error << std::endl; \
            throw std::runtime_error("cuBLAS error"); \
        } \
    } while(0)

// Common GPU utilities
namespace gpu {
    
    // Device query and selection
    struct DeviceInfo {
        int deviceId;
        std::string name;
        size_t totalMemory;
        size_t freeMemory;
        int major;
        int minor;
        int multiProcessorCount;
        int maxThreadsPerBlock;
        int maxBlocksPerMultiProcessor;
        bool tensorCoreSupport;
    };
    
    DeviceInfo getDeviceInfo(int deviceId = 0);
    int selectBestDevice();
    void printDeviceInfo(const DeviceInfo& info);
    
    // Memory management utilities
    template<typename T>
    class DeviceMemory {
    private:
        T* ptr_;
        size_t size_;
        
    public:
        DeviceMemory(size_t size) : size_(size) {
            CUDA_CHECK(cudaMalloc(&ptr_, size * sizeof(T)));
        }
        
        ~DeviceMemory() {
            if (ptr_) {
                cudaFree(ptr_);
            }
        }
        
        // Delete copy constructor and assignment
        DeviceMemory(const DeviceMemory&) = delete;
        DeviceMemory& operator=(const DeviceMemory&) = delete;
        
        // Move semantics
        DeviceMemory(DeviceMemory&& other) noexcept : ptr_(other.ptr_), size_(other.size_) {
            other.ptr_ = nullptr;
            other.size_ = 0;
        }
        
        DeviceMemory& operator=(DeviceMemory&& other) noexcept {
            if (this != &other) {
                if (ptr_) cudaFree(ptr_);
                ptr_ = other.ptr_;
                size_ = other.size_;
                other.ptr_ = nullptr;
                other.size_ = 0;
            }
            return *this;
        }
        
        T* get() { return ptr_; }
        const T* get() const { return ptr_; }
        size_t size() const { return size_; }
        
        void copyFromHost(const T* hostPtr) {
            CUDA_CHECK(cudaMemcpy(ptr_, hostPtr, size_ * sizeof(T), cudaMemcpyHostToDevice));
        }
        
        void copyToHost(T* hostPtr) const {
            CUDA_CHECK(cudaMemcpy(hostPtr, ptr_, size_ * sizeof(T), cudaMemcpyDeviceToHost));
        }
    };
    
    // Kernel launch configuration helper
    struct LaunchConfig {
        dim3 gridDim;
        dim3 blockDim;
        size_t sharedMemBytes;
        cudaStream_t stream;
        
        LaunchConfig(size_t totalThreads, size_t threadsPerBlock = 256, 
                     size_t sharedMem = 0, cudaStream_t s = 0);
    };
    
} // namespace gpu

#endif // GPU_COMMON_CUH