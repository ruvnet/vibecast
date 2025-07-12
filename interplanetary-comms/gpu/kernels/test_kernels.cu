/**
 * @file test_kernels.cu
 * @brief Test program for quantum navigation GPU kernels
 * @author GPUArchitect Agent
 */

#include "quantum_navigation_kernels.h"
#include <cuda_runtime.h>
#include <iostream>
#include <chrono>
#include <random>

// Test data structures matching kernel definitions
struct NavigationState {
    float state[6];
    float covariance[36];
    float timestamp;
};

struct MagneticFieldMeasurement {
    float3 position;
    float3 field_strength;
    float confidence;
};

struct KalmanParameters {
    float process_noise[36];
    float measurement_noise[1024];
    float dt;
};

// Helper function to check CUDA errors
#define CUDA_CHECK(call) do { \
    cudaError_t error = call; \
    if (error != cudaSuccess) { \
        std::cerr << "CUDA error at " << __FILE__ << ":" << __LINE__ \
                  << " - " << cudaGetErrorString(error) << std::endl; \
        exit(1); \
    } \
} while(0)

int main() {
    std::cout << "Quantum Navigation GPU Kernel Test\n";
    std::cout << "==================================\n\n";
    
    // Set device
    CUDA_CHECK(cudaSetDevice(0));
    
    // Get device properties
    cudaDeviceProp prop;
    CUDA_CHECK(cudaGetDeviceProperties(&prop, 0));
    std::cout << "Using GPU: " << prop.name << std::endl;
    std::cout << "Compute capability: " << prop.major << "." << prop.minor << std::endl;
    std::cout << "\n";
    
    // Test parameters
    const int num_states = 10000;
    const int num_measurements = 5000;
    const int num_trajectory_points = 1000;
    
    // Allocate host memory
    NavigationState* h_states = new NavigationState[num_states];
    KalmanParameters h_params;
    MagneticFieldMeasurement* h_measurements = new MagneticFieldMeasurement[num_measurements];
    float3* h_trajectories = new float3[num_trajectory_points];
    float3* h_gradients = new float3[num_trajectory_points];
    
    // Initialize test data
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<float> dist(0.0f, 1.0f);
    
    // Initialize states
    for (int i = 0; i < num_states; i++) {
        for (int j = 0; j < 6; j++) {
            h_states[i].state[j] = dist(gen);
        }
        for (int j = 0; j < 36; j++) {
            h_states[i].covariance[j] = (j % 7 == 0) ? 1.0f : 0.0f; // Identity matrix
        }
        h_states[i].timestamp = i * 0.1f;
    }
    
    // Initialize Kalman parameters
    h_params.dt = 0.1f;
    for (int i = 0; i < 36; i++) {
        h_params.process_noise[i] = (i % 7 == 0) ? 0.01f : 0.0f;
    }
    
    // Allocate device memory
    NavigationState* d_states;
    KalmanParameters* d_params;
    MagneticFieldMeasurement* d_measurements;
    float3* d_trajectories;
    float3* d_gradients;
    float3* d_constraints;
    float3* d_interpolated_fields;
    
    CUDA_CHECK(cudaMalloc(&d_states, num_states * sizeof(NavigationState)));
    CUDA_CHECK(cudaMalloc(&d_params, sizeof(KalmanParameters)));
    CUDA_CHECK(cudaMalloc(&d_measurements, num_measurements * sizeof(MagneticFieldMeasurement)));
    CUDA_CHECK(cudaMalloc(&d_trajectories, num_trajectory_points * sizeof(float3)));
    CUDA_CHECK(cudaMalloc(&d_gradients, num_trajectory_points * sizeof(float3)));
    CUDA_CHECK(cudaMalloc(&d_constraints, sizeof(float3)));
    CUDA_CHECK(cudaMalloc(&d_interpolated_fields, num_measurements * sizeof(float3)));
    
    // Copy data to device
    CUDA_CHECK(cudaMemcpy(d_states, h_states, num_states * sizeof(NavigationState), 
                          cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_params, &h_params, sizeof(KalmanParameters), 
                          cudaMemcpyHostToDevice));
    
    // Create CUDA streams
    cudaStream_t stream1, stream2;
    CUDA_CHECK(cudaStreamCreate(&stream1));
    CUDA_CHECK(cudaStreamCreate(&stream2));
    
    // Warmup
    launch_ekf_prediction(d_states, d_params, num_states, stream1);
    CUDA_CHECK(cudaStreamSynchronize(stream1));
    
    // Test 1: EKF Prediction Kernel
    std::cout << "Testing EKF Prediction Kernel...\n";
    auto start = std::chrono::high_resolution_clock::now();
    
    const int iterations = 100;
    for (int i = 0; i < iterations; i++) {
        launch_ekf_prediction(d_states, d_params, num_states, stream1);
    }
    CUDA_CHECK(cudaStreamSynchronize(stream1));
    
    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end - start);
    
    float throughput = (num_states * iterations * 1e6f) / duration.count();
    std::cout << "  States processed: " << num_states * iterations << std::endl;
    std::cout << "  Time: " << duration.count() / 1000.0f << " ms\n";
    std::cout << "  Throughput: " << throughput / 1e6f << " M states/second\n";
    std::cout << "\n";
    
    // Test 2: Matrix Multiplication Kernel
    std::cout << "Testing Matrix Multiplication Kernel...\n";
    const int matrix_size = 6;
    float* d_A, *d_B, *d_C;
    CUDA_CHECK(cudaMalloc(&d_A, matrix_size * matrix_size * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&d_B, matrix_size * matrix_size * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&d_C, matrix_size * matrix_size * sizeof(float)));
    
    start = std::chrono::high_resolution_clock::now();
    
    for (int i = 0; i < iterations * 100; i++) {
        launch_matrix_multiply(d_A, d_B, d_C, matrix_size, matrix_size, matrix_size,
                             1.0f, 0.0f, stream2);
    }
    CUDA_CHECK(cudaStreamSynchronize(stream2));
    
    end = std::chrono::high_resolution_clock::now();
    duration = std::chrono::duration_cast<std::chrono::microseconds>(end - start);
    
    float gflops = (2.0f * matrix_size * matrix_size * matrix_size * iterations * 100) / 
                   (duration.count() * 1000.0f);
    std::cout << "  Matrix operations: " << iterations * 100 << std::endl;
    std::cout << "  Time: " << duration.count() / 1000.0f << " ms\n";
    std::cout << "  Performance: " << gflops << " GFLOPS\n";
    std::cout << "\n";
    
    // Memory bandwidth test
    std::cout << "Memory Bandwidth Analysis:\n";
    size_t total_bytes = num_states * sizeof(NavigationState) * 2; // Read + Write
    float bandwidth_gb = (total_bytes * iterations) / (duration.count() * 1000.0f);
    std::cout << "  EKF kernel bandwidth: " << bandwidth_gb << " GB/s\n";
    std::cout << "  Theoretical peak: " << prop.memoryBusWidth * prop.memoryClockRate * 2 / 
              (8.0f * 1e6f) << " GB/s\n";
    std::cout << "  Efficiency: " << (bandwidth_gb / (prop.memoryBusWidth * 
              prop.memoryClockRate * 2 / (8.0f * 1e6f))) * 100.0f << "%\n";
    
    // Cleanup
    delete[] h_states;
    delete[] h_measurements;
    delete[] h_trajectories;
    delete[] h_gradients;
    
    CUDA_CHECK(cudaFree(d_states));
    CUDA_CHECK(cudaFree(d_params));
    CUDA_CHECK(cudaFree(d_measurements));
    CUDA_CHECK(cudaFree(d_trajectories));
    CUDA_CHECK(cudaFree(d_gradients));
    CUDA_CHECK(cudaFree(d_constraints));
    CUDA_CHECK(cudaFree(d_interpolated_fields));
    CUDA_CHECK(cudaFree(d_A));
    CUDA_CHECK(cudaFree(d_B));
    CUDA_CHECK(cudaFree(d_C));
    
    CUDA_CHECK(cudaStreamDestroy(stream1));
    CUDA_CHECK(cudaStreamDestroy(stream2));
    
    std::cout << "\nAll tests completed successfully!\n";
    
    return 0;
}