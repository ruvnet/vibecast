#include <cuda_runtime.h>
#include <cufft.h>
#include <cuComplex.h>
#include "gpu_common.cuh"

namespace interplanetary {
namespace gpu {

// Kernel for signal modulation using phase shift keying
__global__ void modulatePSKKernel(const float* data, cuComplex* modulated, 
                                  int numSymbols, float carrierFreq, float sampleRate) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= numSymbols) return;
    
    // PSK modulation
    float phase = 2.0f * M_PI * data[idx] / 8.0f; // 8-PSK
    float t = idx / sampleRate;
    float carrier = 2.0f * M_PI * carrierFreq * t;
    
    modulated[idx].x = cosf(carrier + phase);
    modulated[idx].y = sinf(carrier + phase);
}

// Kernel for adding Doppler shift compensation
__global__ void applyDopplerShiftKernel(cuComplex* signal, int signalLength,
                                       float dopplerShift, float sampleRate) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= signalLength) return;
    
    float t = idx / sampleRate;
    float shiftPhase = 2.0f * M_PI * dopplerShift * t;
    
    // Complex multiplication for frequency shift
    float cos_shift = cosf(shiftPhase);
    float sin_shift = sinf(shiftPhase);
    
    cuComplex shifted;
    shifted.x = signal[idx].x * cos_shift - signal[idx].y * sin_shift;
    shifted.y = signal[idx].x * sin_shift + signal[idx].y * cos_shift;
    
    signal[idx] = shifted;
}

// Kernel for signal correlation (used in synchronization)
__global__ void correlateSignalsKernel(const cuComplex* signal1, const cuComplex* signal2,
                                      cuComplex* correlation, int length) {
    extern __shared__ cuComplex sharedMem[];
    
    int tid = threadIdx.x;
    int idx = blockIdx.x * blockDim.x + tid;
    
    cuComplex localSum = make_cuComplex(0.0f, 0.0f);
    
    // Grid-stride loop for large signals
    for (int i = idx; i < length; i += gridDim.x * blockDim.x) {
        // Complex conjugate multiplication
        cuComplex conj2 = cuConjf(signal2[i]);
        cuComplex prod = cuCmulf(signal1[i], conj2);
        localSum = cuCaddf(localSum, prod);
    }
    
    // Store in shared memory
    sharedMem[tid] = localSum;
    __syncthreads();
    
    // Reduction in shared memory
    for (int stride = blockDim.x / 2; stride > 0; stride >>= 1) {
        if (tid < stride) {
            sharedMem[tid] = cuCaddf(sharedMem[tid], sharedMem[tid + stride]);
        }
        __syncthreads();
    }
    
    // Write result
    if (tid == 0) {
        atomicAdd(&correlation->x, sharedMem[0].x);
        atomicAdd(&correlation->y, sharedMem[0].y);
    }
}

// Kernel for applying FEC (Forward Error Correction) - simplified Reed-Solomon
__global__ void applyFECEncodingKernel(const uint8_t* data, uint8_t* encoded,
                                      int dataLength, int codeLength) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= dataLength) return;
    
    // Simplified FEC: Add parity bits
    int blockIdx = idx / 223; // RS(255,223) blocks
    int blockOffset = idx % 223;
    int encodedIdx = blockIdx * 255 + blockOffset;
    
    encoded[encodedIdx] = data[idx];
    
    // Generate parity (simplified - in real implementation use proper RS)
    if (blockOffset == 0 && idx + 223 <= dataLength) {
        // Calculate and store 32 parity bytes
        for (int p = 0; p < 32; p++) {
            uint8_t parity = 0;
            for (int i = 0; i < 223; i++) {
                parity ^= data[blockIdx * 223 + i];
            }
            encoded[blockIdx * 255 + 223 + p] = parity;
        }
    }
}

// Host wrapper functions
void modulatePSK(const float* data, cuComplex* modulated, int numSymbols,
                 float carrierFreq, float sampleRate) {
    LaunchConfig config(numSymbols);
    modulatePSKKernel<<<config.gridDim, config.blockDim, 0, config.stream>>>
        (data, modulated, numSymbols, carrierFreq, sampleRate);
    CUDA_CHECK(cudaGetLastError());
}

void applyDopplerShift(cuComplex* signal, int signalLength,
                      float dopplerShift, float sampleRate) {
    LaunchConfig config(signalLength);
    applyDopplerShiftKernel<<<config.gridDim, config.blockDim, 0, config.stream>>>
        (signal, signalLength, dopplerShift, sampleRate);
    CUDA_CHECK(cudaGetLastError());
}

void correlateSignals(const cuComplex* signal1, const cuComplex* signal2,
                     cuComplex* correlation, int length, cudaStream_t stream) {
    const int threadsPerBlock = 256;
    const int blocks = std::min((length + threadsPerBlock - 1) / threadsPerBlock, 1024);
    size_t sharedMemSize = threadsPerBlock * sizeof(cuComplex);
    
    // Initialize correlation result
    CUDA_CHECK(cudaMemsetAsync(correlation, 0, sizeof(cuComplex), stream));
    
    correlateSignalsKernel<<<blocks, threadsPerBlock, sharedMemSize, stream>>>
        (signal1, signal2, correlation, length);
    CUDA_CHECK(cudaGetLastError());
}

void applyFECEncoding(const uint8_t* data, uint8_t* encoded,
                     int dataLength, int codeLength) {
    LaunchConfig config(dataLength);
    applyFECEncodingKernel<<<config.gridDim, config.blockDim, 0, config.stream>>>
        (data, encoded, dataLength, codeLength);
    CUDA_CHECK(cudaGetLastError());
}

} // namespace gpu
} // namespace interplanetary