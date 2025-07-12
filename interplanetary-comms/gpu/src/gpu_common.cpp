#include "gpu_common.cuh"
#include <sstream>
#include <iomanip>

namespace gpu {

DeviceInfo getDeviceInfo(int deviceId) {
    DeviceInfo info;
    info.deviceId = deviceId;
    
    cudaDeviceProp prop;
    CUDA_CHECK(cudaGetDeviceProperties(&prop, deviceId));
    
    info.name = prop.name;
    info.major = prop.major;
    info.minor = prop.minor;
    info.multiProcessorCount = prop.multiProcessorCount;
    info.maxThreadsPerBlock = prop.maxThreadsPerBlock;
    info.maxBlocksPerMultiProcessor = prop.maxBlocksPerMultiProcessorCount;
    info.totalMemory = prop.totalGlobalMem;
    
    // Check for tensor core support (compute capability >= 7.0)
    info.tensorCoreSupport = (prop.major >= 7);
    
    // Get free memory
    size_t free, total;
    CUDA_CHECK(cudaMemGetInfo(&free, &total));
    info.freeMemory = free;
    
    return info;
}

int selectBestDevice() {
    int deviceCount;
    CUDA_CHECK(cudaGetDeviceCount(&deviceCount));
    
    if (deviceCount == 0) {
        throw std::runtime_error("No CUDA devices found");
    }
    
    int bestDevice = 0;
    size_t maxMemory = 0;
    
    for (int i = 0; i < deviceCount; ++i) {
        DeviceInfo info = getDeviceInfo(i);
        if (info.totalMemory > maxMemory) {
            maxMemory = info.totalMemory;
            bestDevice = i;
        }
    }
    
    CUDA_CHECK(cudaSetDevice(bestDevice));
    return bestDevice;
}

void printDeviceInfo(const DeviceInfo& info) {
    std::cout << "=== CUDA Device " << info.deviceId << " ===" << std::endl;
    std::cout << "Name: " << info.name << std::endl;
    std::cout << "Compute Capability: " << info.major << "." << info.minor << std::endl;
    std::cout << "Total Memory: " << (info.totalMemory / (1024.0 * 1024.0 * 1024.0)) 
              << " GB" << std::endl;
    std::cout << "Free Memory: " << (info.freeMemory / (1024.0 * 1024.0 * 1024.0)) 
              << " GB" << std::endl;
    std::cout << "Multiprocessors: " << info.multiProcessorCount << std::endl;
    std::cout << "Max Threads per Block: " << info.maxThreadsPerBlock << std::endl;
    std::cout << "Max Blocks per SM: " << info.maxBlocksPerMultiProcessor << std::endl;
    std::cout << "Tensor Core Support: " << (info.tensorCoreSupport ? "Yes" : "No") 
              << std::endl;
    std::cout << "========================" << std::endl;
}

LaunchConfig::LaunchConfig(size_t totalThreads, size_t threadsPerBlock, 
                          size_t sharedMem, cudaStream_t s) 
    : sharedMemBytes(sharedMem), stream(s) {
    
    // Ensure threadsPerBlock is valid
    int device;
    CUDA_CHECK(cudaGetDevice(&device));
    
    cudaDeviceProp prop;
    CUDA_CHECK(cudaGetDeviceProperties(&prop, device));
    
    threadsPerBlock = std::min(threadsPerBlock, (size_t)prop.maxThreadsPerBlock);
    
    // Calculate grid dimensions
    size_t blocksNeeded = (totalThreads + threadsPerBlock - 1) / threadsPerBlock;
    
    // Handle multi-dimensional grids if needed
    if (blocksNeeded <= (size_t)prop.maxGridSize[0]) {
        gridDim = dim3(blocksNeeded, 1, 1);
        blockDim = dim3(threadsPerBlock, 1, 1);
    } else {
        // Use 2D grid
        size_t gridX = std::min(blocksNeeded, (size_t)prop.maxGridSize[0]);
        size_t gridY = (blocksNeeded + gridX - 1) / gridX;
        gridDim = dim3(gridX, gridY, 1);
        blockDim = dim3(threadsPerBlock, 1, 1);
    }
}

} // namespace gpu