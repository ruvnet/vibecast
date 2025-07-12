/**
 * CUDA Error Checking Utilities
 * Comprehensive error handling for all CUDA operations
 */

#ifndef CUDA_ERROR_CHECK_H
#define CUDA_ERROR_CHECK_H

#include <cuda_runtime.h>
#include <cudnn.h>
#include <cublas_v2.h>
#include <cufft.h>
#include <curand.h>
#include <cusparse.h>
#include <nccl.h>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

// Define for enabling/disabling error checking
#ifndef CUDA_ERROR_CHECK_DISABLE
#define CUDA_ERROR_CHECK_ENABLE
#endif

namespace cuda_error {

// Custom exception for CUDA errors
class CudaException : public std::runtime_error {
public:
    CudaException(const std::string& what, const std::string& file, 
                  int line, const std::string& function)
        : std::runtime_error(FormatMessage(what, file, line, function)) {}
    
private:
    static std::string FormatMessage(const std::string& what, 
                                   const std::string& file, 
                                   int line, 
                                   const std::string& function) {
        std::stringstream ss;
        ss << "CUDA Error in " << file << ":" << line 
           << " (" << function << "): " << what;
        return ss.str();
    }
};

// Error checking functions for different CUDA libraries
inline void CheckCudaError(cudaError_t error, const char* file, 
                          int line, const char* function) {
    if (error != cudaSuccess) {
        throw CudaException(cudaGetErrorString(error), file, line, function);
    }
}

inline void CheckCudnnError(cudnnStatus_t status, const char* file, 
                           int line, const char* function) {
    if (status != CUDNN_STATUS_SUCCESS) {
        throw CudaException(cudnnGetErrorString(status), file, line, function);
    }
}

inline void CheckCublasError(cublasStatus_t status, const char* file, 
                            int line, const char* function) {
    if (status != CUBLAS_STATUS_SUCCESS) {
        std::string error_str;
        switch (status) {
            case CUBLAS_STATUS_NOT_INITIALIZED:
                error_str = "CUBLAS_STATUS_NOT_INITIALIZED";
                break;
            case CUBLAS_STATUS_ALLOC_FAILED:
                error_str = "CUBLAS_STATUS_ALLOC_FAILED";
                break;
            case CUBLAS_STATUS_INVALID_VALUE:
                error_str = "CUBLAS_STATUS_INVALID_VALUE";
                break;
            case CUBLAS_STATUS_ARCH_MISMATCH:
                error_str = "CUBLAS_STATUS_ARCH_MISMATCH";
                break;
            case CUBLAS_STATUS_MAPPING_ERROR:
                error_str = "CUBLAS_STATUS_MAPPING_ERROR";
                break;
            case CUBLAS_STATUS_EXECUTION_FAILED:
                error_str = "CUBLAS_STATUS_EXECUTION_FAILED";
                break;
            case CUBLAS_STATUS_INTERNAL_ERROR:
                error_str = "CUBLAS_STATUS_INTERNAL_ERROR";
                break;
            case CUBLAS_STATUS_NOT_SUPPORTED:
                error_str = "CUBLAS_STATUS_NOT_SUPPORTED";
                break;
            case CUBLAS_STATUS_LICENSE_ERROR:
                error_str = "CUBLAS_STATUS_LICENSE_ERROR";
                break;
            default:
                error_str = "Unknown cuBLAS error";
        }
        throw CudaException(error_str, file, line, function);
    }
}

inline void CheckCufftError(cufftResult result, const char* file, 
                           int line, const char* function) {
    if (result != CUFFT_SUCCESS) {
        std::string error_str;
        switch (result) {
            case CUFFT_INVALID_PLAN:
                error_str = "CUFFT_INVALID_PLAN";
                break;
            case CUFFT_ALLOC_FAILED:
                error_str = "CUFFT_ALLOC_FAILED";
                break;
            case CUFFT_INVALID_TYPE:
                error_str = "CUFFT_INVALID_TYPE";
                break;
            case CUFFT_INVALID_VALUE:
                error_str = "CUFFT_INVALID_VALUE";
                break;
            case CUFFT_INTERNAL_ERROR:
                error_str = "CUFFT_INTERNAL_ERROR";
                break;
            case CUFFT_EXEC_FAILED:
                error_str = "CUFFT_EXEC_FAILED";
                break;
            case CUFFT_SETUP_FAILED:
                error_str = "CUFFT_SETUP_FAILED";
                break;
            case CUFFT_INVALID_SIZE:
                error_str = "CUFFT_INVALID_SIZE";
                break;
            case CUFFT_UNALIGNED_DATA:
                error_str = "CUFFT_UNALIGNED_DATA";
                break;
            case CUFFT_INCOMPLETE_PARAMETER_LIST:
                error_str = "CUFFT_INCOMPLETE_PARAMETER_LIST";
                break;
            case CUFFT_INVALID_DEVICE:
                error_str = "CUFFT_INVALID_DEVICE";
                break;
            case CUFFT_PARSE_ERROR:
                error_str = "CUFFT_PARSE_ERROR";
                break;
            case CUFFT_NO_WORKSPACE:
                error_str = "CUFFT_NO_WORKSPACE";
                break;
            case CUFFT_NOT_IMPLEMENTED:
                error_str = "CUFFT_NOT_IMPLEMENTED";
                break;
            case CUFFT_LICENSE_ERROR:
                error_str = "CUFFT_LICENSE_ERROR";
                break;
            case CUFFT_NOT_SUPPORTED:
                error_str = "CUFFT_NOT_SUPPORTED";
                break;
            default:
                error_str = "Unknown cuFFT error";
        }
        throw CudaException(error_str, file, line, function);
    }
}

inline void CheckCurandError(curandStatus_t status, const char* file, 
                            int line, const char* function) {
    if (status != CURAND_STATUS_SUCCESS) {
        std::string error_str;
        switch (status) {
            case CURAND_STATUS_VERSION_MISMATCH:
                error_str = "CURAND_STATUS_VERSION_MISMATCH";
                break;
            case CURAND_STATUS_NOT_INITIALIZED:
                error_str = "CURAND_STATUS_NOT_INITIALIZED";
                break;
            case CURAND_STATUS_ALLOCATION_FAILED:
                error_str = "CURAND_STATUS_ALLOCATION_FAILED";
                break;
            case CURAND_STATUS_TYPE_ERROR:
                error_str = "CURAND_STATUS_TYPE_ERROR";
                break;
            case CURAND_STATUS_OUT_OF_RANGE:
                error_str = "CURAND_STATUS_OUT_OF_RANGE";
                break;
            case CURAND_STATUS_LENGTH_NOT_MULTIPLE:
                error_str = "CURAND_STATUS_LENGTH_NOT_MULTIPLE";
                break;
            case CURAND_STATUS_DOUBLE_PRECISION_REQUIRED:
                error_str = "CURAND_STATUS_DOUBLE_PRECISION_REQUIRED";
                break;
            case CURAND_STATUS_LAUNCH_FAILURE:
                error_str = "CURAND_STATUS_LAUNCH_FAILURE";
                break;
            case CURAND_STATUS_PREEXISTING_FAILURE:
                error_str = "CURAND_STATUS_PREEXISTING_FAILURE";
                break;
            case CURAND_STATUS_INITIALIZATION_FAILED:
                error_str = "CURAND_STATUS_INITIALIZATION_FAILED";
                break;
            case CURAND_STATUS_ARCH_MISMATCH:
                error_str = "CURAND_STATUS_ARCH_MISMATCH";
                break;
            case CURAND_STATUS_INTERNAL_ERROR:
                error_str = "CURAND_STATUS_INTERNAL_ERROR";
                break;
            default:
                error_str = "Unknown cuRAND error";
        }
        throw CudaException(error_str, file, line, function);
    }
}

inline void CheckNcclError(ncclResult_t result, const char* file, 
                          int line, const char* function) {
    if (result != ncclSuccess) {
        throw CudaException(ncclGetErrorString(result), file, line, function);
    }
}

// Kernel launch error checking
inline void CheckKernelLaunch(const char* kernel_name, const char* file, 
                             int line) {
    cudaError_t error = cudaGetLastError();
    if (error != cudaSuccess) {
        std::string msg = std::string("Kernel launch failed: ") + kernel_name;
        throw CudaException(msg + " - " + cudaGetErrorString(error), 
                          file, line, kernel_name);
    }
}

// Memory allocation checker
inline void CheckMemoryAllocation(void* ptr, size_t size, const char* file, 
                                 int line, const char* function) {
    if (ptr == nullptr) {
        std::stringstream ss;
        ss << "Memory allocation failed for " << size << " bytes";
        throw CudaException(ss.str(), file, line, function);
    }
}

// Device synchronization with error checking
inline void SynchronizeAndCheck(const char* file, int line, 
                               const char* function) {
    cudaError_t error = cudaDeviceSynchronize();
    if (error != cudaSuccess) {
        throw CudaException(cudaGetErrorString(error), file, line, function);
    }
}

} // namespace cuda_error

// Macro definitions for easy error checking
#ifdef CUDA_ERROR_CHECK_ENABLE

#define CUDA_CHECK(call) \
    cuda_error::CheckCudaError(call, __FILE__, __LINE__, __FUNCTION__)

#define CUDNN_CHECK(call) \
    cuda_error::CheckCudnnError(call, __FILE__, __LINE__, __FUNCTION__)

#define CUBLAS_CHECK(call) \
    cuda_error::CheckCublasError(call, __FILE__, __LINE__, __FUNCTION__)

#define CUFFT_CHECK(call) \
    cuda_error::CheckCufftError(call, __FILE__, __LINE__, __FUNCTION__)

#define CURAND_CHECK(call) \
    cuda_error::CheckCurandError(call, __FILE__, __LINE__, __FUNCTION__)

#define NCCL_CHECK(call) \
    cuda_error::CheckNcclError(call, __FILE__, __LINE__, __FUNCTION__)

#define CUDA_KERNEL_CHECK(kernel_name) \
    cuda_error::CheckKernelLaunch(kernel_name, __FILE__, __LINE__)

#define CUDA_MALLOC_CHECK(ptr, size) \
    cuda_error::CheckMemoryAllocation(ptr, size, __FILE__, __LINE__, __FUNCTION__)

#define CUDA_SYNC_CHECK() \
    cuda_error::SynchronizeAndCheck(__FILE__, __LINE__, __FUNCTION__)

// Safe kernel launch macro
#define CUDA_LAUNCH(kernel, grid, block, shared, stream, ...) \
    do { \
        kernel<<<grid, block, shared, stream>>>(__VA_ARGS__); \
        CUDA_KERNEL_CHECK(#kernel); \
    } while(0)

#else // CUDA_ERROR_CHECK_ENABLE

// No-op macros when error checking is disabled
#define CUDA_CHECK(call) call
#define CUDNN_CHECK(call) call
#define CUBLAS_CHECK(call) call
#define CUFFT_CHECK(call) call
#define CURAND_CHECK(call) call
#define NCCL_CHECK(call) call
#define CUDA_KERNEL_CHECK(kernel_name) ((void)0)
#define CUDA_MALLOC_CHECK(ptr, size) ((void)0)
#define CUDA_SYNC_CHECK() cudaDeviceSynchronize()
#define CUDA_LAUNCH(kernel, grid, block, shared, stream, ...) \
    kernel<<<grid, block, shared, stream>>>(__VA_ARGS__)

#endif // CUDA_ERROR_CHECK_ENABLE

// Helper class for RAII-style CUDA resource management
template<typename T, typename Deleter>
class CudaResource {
private:
    T resource_;
    Deleter deleter_;
    bool owned_;
    
public:
    CudaResource() : resource_(nullptr), owned_(false) {}
    
    CudaResource(T resource, Deleter deleter) 
        : resource_(resource), deleter_(deleter), owned_(true) {}
    
    ~CudaResource() {
        if (owned_ && resource_) {
            deleter_(resource_);
        }
    }
    
    // Move constructor
    CudaResource(CudaResource&& other) noexcept
        : resource_(other.resource_), deleter_(other.deleter_), owned_(other.owned_) {
        other.owned_ = false;
    }
    
    // Move assignment
    CudaResource& operator=(CudaResource&& other) noexcept {
        if (this != &other) {
            if (owned_ && resource_) {
                deleter_(resource_);
            }
            resource_ = other.resource_;
            deleter_ = other.deleter_;
            owned_ = other.owned_;
            other.owned_ = false;
        }
        return *this;
    }
    
    // Delete copy operations
    CudaResource(const CudaResource&) = delete;
    CudaResource& operator=(const CudaResource&) = delete;
    
    T get() const { return resource_; }
    T* operator&() { return &resource_; }
    operator T() const { return resource_; }
};

// Factory functions for common CUDA resources
inline auto MakeCudaStream(unsigned int flags = cudaStreamDefault) {
    cudaStream_t stream;
    CUDA_CHECK(cudaStreamCreateWithFlags(&stream, flags));
    return CudaResource<cudaStream_t, decltype(&cudaStreamDestroy)>(
        stream, cudaStreamDestroy);
}

inline auto MakeCudaEvent(unsigned int flags = cudaEventDefault) {
    cudaEvent_t event;
    CUDA_CHECK(cudaEventCreateWithFlags(&event, flags));
    return CudaResource<cudaEvent_t, decltype(&cudaEventDestroy)>(
        event, cudaEventDestroy);
}

#endif // CUDA_ERROR_CHECK_H