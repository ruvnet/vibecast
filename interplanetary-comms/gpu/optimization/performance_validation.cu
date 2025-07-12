/**
 * @file performance_validation.cu
 * @brief Performance validation and benchmarking for optimized kernels
 * @author PerformanceEngineer Agent
 * 
 * This file contains comprehensive performance validation tests to verify
 * the 15x target performance improvement over CPU baseline.
 */

#include <cuda_runtime.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <math.h>
#include <assert.h>
#include <sys/time.h>

// Include optimized kernels
extern "C" {
    void launch_optimized_ekf_prediction(OptimizedNavigationState* states,
                                       const KalmanParameters* params,
                                       int num_states,
                                       cudaStream_t stream);
    
    void launch_optimized_trajectory_optimization(float4* trajectory_points,
                                                float4* gradients,
                                                const float3* constraints,
                                                int num_points,
                                                float learning_rate,
                                                cudaStream_t stream);
    
    void launch_optimized_magnetic_field_processing(
        const OptimizedMagneticFieldMeasurement* measurements,
        float3* interpolated_fields,
        int num_measurements,
        int3 grid_dims,
        cudaStream_t stream);
    
    void launch_fused_ekf_matrix(OptimizedNavigationState* states,
                                const KalmanParameters* params,
                                const float* measurement_matrix,
                                float* kalman_gain,
                                int num_states,
                                cudaStream_t stream);
}

// Performance measurement utilities
typedef struct {
    double cpu_time_ms;
    double gpu_original_time_ms;
    double gpu_optimized_time_ms;
    double memory_bandwidth_gb_s;
    double speedup_vs_cpu;
    double speedup_vs_original_gpu;
    double occupancy;
    double efficiency;
} PerformanceMetrics;

// High-resolution timing
double get_time_ms() {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (double)tv.tv_sec * 1000.0 + (double)tv.tv_usec / 1000.0;
}

// CUDA timing wrapper
double cuda_time_kernel(void (*kernel_func)(void*), void* args, int iterations) {
    cudaEvent_t start, stop;
    cudaEventCreate(&start);
    cudaEventCreate(&stop);
    
    // Warm-up
    for (int i = 0; i < 5; i++) {
        kernel_func(args);
    }
    cudaDeviceSynchronize();
    
    // Actual timing
    cudaEventRecord(start);
    for (int i = 0; i < iterations; i++) {
        kernel_func(args);
    }
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);
    
    float milliseconds = 0;
    cudaEventElapsedTime(&milliseconds, start, stop);
    
    cudaEventDestroy(start);
    cudaEventDestroy(stop);
    
    return milliseconds / iterations;
}

// CPU reference implementation for EKF prediction
void cpu_ekf_prediction(OptimizedNavigationState* states,
                       const KalmanParameters* params,
                       int num_states) {
    for (int i = 0; i < num_states; i++) {
        OptimizedNavigationState* state = &states[i];
        
        // Simple state prediction: x = F * x
        float new_state[6];
        for (int j = 0; j < 6; j++) {
            new_state[j] = state->state[j];
            if (j < 3) {
                new_state[j] += params->dt * state->state[j + 3]; // Add velocity
            }
        }
        
        // Update state
        for (int j = 0; j < 6; j++) {
            state->state[j] = new_state[j];
        }
        
        // Simplified covariance update
        for (int j = 0; j < 36; j++) {
            state->covariance[j] += params->process_noise[j] * params->dt;
        }
    }
}

// Benchmark EKF prediction kernel
PerformanceMetrics benchmark_ekf_prediction(int num_states) {
    printf("🧪 Benchmarking EKF Prediction Kernel (%d states)\n", num_states);
    
    PerformanceMetrics metrics = {0};
    
    // Allocate host memory
    OptimizedNavigationState* h_states = (OptimizedNavigationState*)malloc(
        num_states * sizeof(OptimizedNavigationState));
    KalmanParameters* h_params = (KalmanParameters*)malloc(sizeof(KalmanParameters));
    
    // Initialize test data
    for (int i = 0; i < num_states; i++) {
        for (int j = 0; j < 6; j++) {
            h_states[i].state[j] = (float)rand() / RAND_MAX;
        }
        for (int j = 0; j < 36; j++) {
            h_states[i].covariance[j] = (float)rand() / RAND_MAX * 0.1f;
        }
        h_states[i].timestamp = i * 0.1f;
    }
    
    // Initialize parameters
    h_params->dt = 0.1f;
    for (int i = 0; i < 36; i++) {
        h_params->process_noise[i] = 0.001f;
    }
    
    // Allocate GPU memory
    OptimizedNavigationState* d_states;
    KalmanParameters* d_params;
    cudaMalloc(&d_states, num_states * sizeof(OptimizedNavigationState));
    cudaMalloc(&d_params, sizeof(KalmanParameters));
    
    // Copy to GPU
    cudaMemcpy(d_states, h_states, num_states * sizeof(OptimizedNavigationState),
               cudaMemcpyHostToDevice);
    cudaMemcpy(d_params, h_params, sizeof(KalmanParameters), cudaMemcpyHostToDevice);
    
    // CPU benchmark
    OptimizedNavigationState* cpu_states = (OptimizedNavigationState*)malloc(
        num_states * sizeof(OptimizedNavigationState));
    memcpy(cpu_states, h_states, num_states * sizeof(OptimizedNavigationState));
    
    double cpu_start = get_time_ms();
    cpu_ekf_prediction(cpu_states, h_params, num_states);
    double cpu_end = get_time_ms();
    metrics.cpu_time_ms = cpu_end - cpu_start;
    
    // GPU benchmark (optimized)
    cudaStream_t stream;
    cudaStreamCreate(&stream);
    
    cudaEvent_t gpu_start, gpu_stop;
    cudaEventCreate(&gpu_start);
    cudaEventCreate(&gpu_stop);
    
    // Warm-up
    for (int i = 0; i < 5; i++) {
        launch_optimized_ekf_prediction(d_states, d_params, num_states, stream);
    }
    cudaStreamSynchronize(stream);
    
    // Actual timing
    cudaEventRecord(gpu_start, stream);
    for (int i = 0; i < 100; i++) {
        launch_optimized_ekf_prediction(d_states, d_params, num_states, stream);
    }
    cudaEventRecord(gpu_stop, stream);
    cudaEventSynchronize(gpu_stop);
    
    float gpu_milliseconds = 0;
    cudaEventElapsedTime(&gpu_milliseconds, gpu_start, gpu_stop);
    metrics.gpu_optimized_time_ms = gpu_milliseconds / 100.0;
    
    // Calculate metrics
    metrics.speedup_vs_cpu = metrics.cpu_time_ms / metrics.gpu_optimized_time_ms;
    
    // Estimate memory bandwidth
    size_t bytes_transferred = num_states * (sizeof(OptimizedNavigationState) * 2); // Read + Write
    metrics.memory_bandwidth_gb_s = (bytes_transferred / 1e9) / (metrics.gpu_optimized_time_ms / 1000.0);
    
    // Estimate occupancy (simplified)
    metrics.occupancy = fmin(1.0, (double)num_states / (82 * 2048)); // 82 SMs, 2048 threads/SM
    
    printf("  📊 Results:\n");
    printf("    CPU Time: %.2f ms\n", metrics.cpu_time_ms);
    printf("    GPU Time: %.2f ms\n", metrics.gpu_optimized_time_ms);
    printf("    Speedup: %.1fx\n", metrics.speedup_vs_cpu);
    printf("    Bandwidth: %.1f GB/s\n", metrics.memory_bandwidth_gb_s);
    printf("    Occupancy: %.1f%%\n", metrics.occupancy * 100.0);
    
    // Cleanup
    free(h_states);
    free(h_params);
    free(cpu_states);
    cudaFree(d_states);
    cudaFree(d_params);
    cudaStreamDestroy(stream);
    cudaEventDestroy(gpu_start);
    cudaEventDestroy(gpu_stop);
    
    return metrics;
}

// Benchmark trajectory optimization kernel
PerformanceMetrics benchmark_trajectory_optimization(int num_points) {
    printf("🧪 Benchmarking Trajectory Optimization Kernel (%d points)\n", num_points);
    
    PerformanceMetrics metrics = {0};
    
    // Allocate host memory
    float4* h_points = (float4*)malloc(num_points * sizeof(float4));
    float4* h_gradients = (float4*)malloc(num_points * sizeof(float4));
    float3* h_constraints = (float3*)malloc(sizeof(float3));
    
    // Initialize test data
    for (int i = 0; i < num_points; i++) {
        h_points[i] = make_float4(
            (float)rand() / RAND_MAX * 1000.0f,
            (float)rand() / RAND_MAX * 1000.0f,
            (float)rand() / RAND_MAX * 1000.0f,
            0.0f
        );
        h_gradients[i] = make_float4(
            ((float)rand() / RAND_MAX - 0.5f) * 10.0f,
            ((float)rand() / RAND_MAX - 0.5f) * 10.0f,
            ((float)rand() / RAND_MAX - 0.5f) * 10.0f,
            0.0f
        );
    }
    h_constraints[0] = make_float3(5.0f, 5.0f, 5.0f); // Max acceleration
    
    // Allocate GPU memory
    float4* d_points;
    float4* d_gradients;
    float3* d_constraints;
    cudaMalloc(&d_points, num_points * sizeof(float4));
    cudaMalloc(&d_gradients, num_points * sizeof(float4));
    cudaMalloc(&d_constraints, sizeof(float3));
    
    // Copy to GPU
    cudaMemcpy(d_points, h_points, num_points * sizeof(float4), cudaMemcpyHostToDevice);
    cudaMemcpy(d_gradients, h_gradients, num_points * sizeof(float4), cudaMemcpyHostToDevice);
    cudaMemcpy(d_constraints, h_constraints, sizeof(float3), cudaMemcpyHostToDevice);
    
    // CPU benchmark
    float4* cpu_points = (float4*)malloc(num_points * sizeof(float4));
    memcpy(cpu_points, h_points, num_points * sizeof(float4));
    
    double cpu_start = get_time_ms();
    // Simple CPU trajectory optimization
    for (int i = 0; i < num_points; i++) {
        float4 grad = h_gradients[i];
        float grad_mag = sqrtf(grad.x * grad.x + grad.y * grad.y + grad.z * grad.z);
        
        if (grad_mag > h_constraints[0].x) {
            float scale = h_constraints[0].x / grad_mag;
            grad.x *= scale;
            grad.y *= scale;
            grad.z *= scale;
        }
        
        cpu_points[i].x -= 0.01f * grad.x;
        cpu_points[i].y -= 0.01f * grad.y;
        cpu_points[i].z -= 0.01f * grad.z;
    }
    double cpu_end = get_time_ms();
    metrics.cpu_time_ms = cpu_end - cpu_start;
    
    // GPU benchmark
    cudaStream_t stream;
    cudaStreamCreate(&stream);
    
    cudaEvent_t gpu_start, gpu_stop;
    cudaEventCreate(&gpu_start);
    cudaEventCreate(&gpu_stop);
    
    // Warm-up
    for (int i = 0; i < 5; i++) {
        launch_optimized_trajectory_optimization(d_points, d_gradients, d_constraints,
                                               num_points, 0.01f, stream);
    }
    cudaStreamSynchronize(stream);
    
    // Actual timing
    cudaEventRecord(gpu_start, stream);
    for (int i = 0; i < 100; i++) {
        launch_optimized_trajectory_optimization(d_points, d_gradients, d_constraints,
                                               num_points, 0.01f, stream);
    }
    cudaEventRecord(gpu_stop, stream);
    cudaEventSynchronize(gpu_stop);
    
    float gpu_milliseconds = 0;
    cudaEventElapsedTime(&gpu_milliseconds, gpu_start, gpu_stop);
    metrics.gpu_optimized_time_ms = gpu_milliseconds / 100.0;
    
    // Calculate metrics
    metrics.speedup_vs_cpu = metrics.cpu_time_ms / metrics.gpu_optimized_time_ms;
    
    // Estimate memory bandwidth
    size_t bytes_transferred = num_points * (sizeof(float4) * 3); // Read points, gradients, write points
    metrics.memory_bandwidth_gb_s = (bytes_transferred / 1e9) / (metrics.gpu_optimized_time_ms / 1000.0);
    
    metrics.occupancy = fmin(1.0, (double)num_points / (82 * 2048));
    
    printf("  📊 Results:\n");
    printf("    CPU Time: %.2f ms\n", metrics.cpu_time_ms);
    printf("    GPU Time: %.2f ms\n", metrics.gpu_optimized_time_ms);
    printf("    Speedup: %.1fx\n", metrics.speedup_vs_cpu);
    printf("    Bandwidth: %.1f GB/s\n", metrics.memory_bandwidth_gb_s);
    printf("    Occupancy: %.1f%%\n", metrics.occupancy * 100.0);
    
    // Cleanup
    free(h_points);
    free(h_gradients);
    free(h_constraints);
    free(cpu_points);
    cudaFree(d_points);
    cudaFree(d_gradients);
    cudaFree(d_constraints);
    cudaStreamDestroy(stream);
    cudaEventDestroy(gpu_start);
    cudaEventDestroy(gpu_stop);
    
    return metrics;
}

// Comprehensive performance validation
void run_comprehensive_validation() {
    printf("🚀 Comprehensive Performance Validation\n");
    printf("="*60);
    printf("\n");
    
    // Test different data sizes
    int test_sizes[] = {1000, 10000, 100000, 1000000};
    int num_sizes = sizeof(test_sizes) / sizeof(test_sizes[0]);
    
    printf("📋 Performance Target: 15x improvement over CPU\n");
    printf("🎯 Memory Bandwidth Target: >85%% utilization\n");
    printf("📊 Occupancy Target: >80%%\n\n");
    
    PerformanceMetrics overall_metrics = {0};
    int validation_count = 0;
    
    for (int i = 0; i < num_sizes; i++) {
        printf("🔍 Testing with %d elements:\n", test_sizes[i]);
        
        // EKF Prediction
        PerformanceMetrics ekf_metrics = benchmark_ekf_prediction(test_sizes[i]);
        overall_metrics.speedup_vs_cpu += ekf_metrics.speedup_vs_cpu;
        overall_metrics.memory_bandwidth_gb_s += ekf_metrics.memory_bandwidth_gb_s;
        overall_metrics.occupancy += ekf_metrics.occupancy;
        validation_count++;
        
        // Trajectory Optimization
        PerformanceMetrics traj_metrics = benchmark_trajectory_optimization(test_sizes[i]);
        overall_metrics.speedup_vs_cpu += traj_metrics.speedup_vs_cpu;
        overall_metrics.memory_bandwidth_gb_s += traj_metrics.memory_bandwidth_gb_s;
        overall_metrics.occupancy += traj_metrics.occupancy;
        validation_count++;
        
        printf("\n");
    }
    
    // Calculate averages
    overall_metrics.speedup_vs_cpu /= validation_count;
    overall_metrics.memory_bandwidth_gb_s /= validation_count;
    overall_metrics.occupancy /= validation_count;
    
    // Validation results
    printf("📊 OVERALL VALIDATION RESULTS:\n");
    printf("="*40);
    printf("\n");
    printf("Average Speedup vs CPU: %.1fx\n", overall_metrics.speedup_vs_cpu);
    printf("Average Memory Bandwidth: %.1f GB/s\n", overall_metrics.memory_bandwidth_gb_s);
    printf("Average Occupancy: %.1f%%\n", overall_metrics.occupancy * 100.0);
    
    // Validation checks
    bool speedup_achieved = overall_metrics.speedup_vs_cpu >= 15.0;
    bool bandwidth_achieved = overall_metrics.memory_bandwidth_gb_s >= 856.8; // 85% of 1008 GB/s
    bool occupancy_achieved = overall_metrics.occupancy >= 0.8;
    
    printf("\n🎯 PERFORMANCE TARGETS:\n");
    printf("Speedup Target (15x): %s %.1fx\n", 
           speedup_achieved ? "✅ ACHIEVED" : "❌ MISSED", 
           overall_metrics.speedup_vs_cpu);
    printf("Bandwidth Target (85%%): %s %.1f%%\n", 
           bandwidth_achieved ? "✅ ACHIEVED" : "❌ MISSED", 
           (overall_metrics.memory_bandwidth_gb_s / 1008.0) * 100.0);
    printf("Occupancy Target (80%%): %s %.1f%%\n", 
           occupancy_achieved ? "✅ ACHIEVED" : "❌ MISSED", 
           overall_metrics.occupancy * 100.0);
    
    if (speedup_achieved && bandwidth_achieved && occupancy_achieved) {
        printf("\n🎉 ALL PERFORMANCE TARGETS ACHIEVED!\n");
        printf("🚀 System ready for production deployment\n");
    } else {
        printf("\n⚠️  Some targets not met - additional optimization needed\n");
    }
}

// Memory usage analysis
void analyze_memory_usage() {
    printf("\n📊 Memory Usage Analysis\n");
    printf("="*40);
    printf("\n");
    
    // Query GPU memory
    size_t free_bytes, total_bytes;
    cudaMemGetInfo(&free_bytes, &total_bytes);
    
    printf("Total GPU Memory: %.2f GB\n", total_bytes / 1e9);
    printf("Free GPU Memory: %.2f GB\n", free_bytes / 1e9);
    printf("Used GPU Memory: %.2f GB\n", (total_bytes - free_bytes) / 1e9);
    
    // Analyze memory requirements for typical workloads
    int typical_states = 100000;
    int typical_points = 1000000;
    int typical_measurements = 50000;
    
    size_t ekf_memory = typical_states * sizeof(OptimizedNavigationState);
    size_t traj_memory = typical_points * sizeof(float4) * 2; // Points + gradients
    size_t field_memory = typical_measurements * sizeof(OptimizedMagneticFieldMeasurement);
    
    printf("\nMemory Requirements for Typical Workloads:\n");
    printf("EKF Navigation States: %.2f MB\n", ekf_memory / 1e6);
    printf("Trajectory Points: %.2f MB\n", traj_memory / 1e6);
    printf("Magnetic Field Data: %.2f MB\n", field_memory / 1e6);
    printf("Total Required: %.2f MB\n", (ekf_memory + traj_memory + field_memory) / 1e6);
    
    bool memory_sufficient = (ekf_memory + traj_memory + field_memory) < free_bytes;
    printf("Memory Sufficient: %s\n", memory_sufficient ? "✅ YES" : "❌ NO");
}

// Main validation function
int main(int argc, char* argv[]) {
    printf("🔬 GPU Performance Validation Suite\n");
    printf("📅 Date: %s\n", __DATE__);
    printf("🕒 Time: %s\n", __TIME__);
    printf("🎯 Target: 15x improvement over CPU baseline\n");
    printf("\n");
    
    // Initialize CUDA
    cudaSetDevice(0);
    
    // Device info
    cudaDeviceProp prop;
    cudaGetDeviceProperties(&prop, 0);
    printf("🖥️  GPU: %s\n", prop.name);
    printf("🔧 Compute Capability: %d.%d\n", prop.major, prop.minor);
    printf("🧮 Multiprocessors: %d\n", prop.multiProcessorCount);
    printf("📱 Memory: %.2f GB\n", prop.totalGlobalMem / 1e9);
    printf("\n");
    
    // Run validation
    run_comprehensive_validation();
    
    // Analyze memory usage
    analyze_memory_usage();
    
    printf("\n✅ Validation Complete!\n");
    return 0;
}