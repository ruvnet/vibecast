/**
 * @file kernel_launchers.cu
 * @brief Kernel launcher implementations for quantum navigation
 * @author GPUArchitect Agent
 */

#include "quantum_navigation_kernels.h"
#include <cuda_runtime.h>
#include <device_launch_parameters.h>

// Include kernel definitions
extern __global__ void ekf_prediction_kernel(
    NavigationState* states,
    const KalmanParameters* params,
    const int num_states
);

extern __global__ void matrix_multiply_kernel(
    const float* A,
    const float* B,
    float* C,
    const int m,
    const int n,
    const int k,
    const float alpha,
    const float beta
);

extern __global__ void trajectory_optimization_kernel(
    float3* trajectories,
    float3* gradients,
    const float3* constraints,
    const int num_points,
    const float learning_rate
);

extern __global__ void magnetic_field_processing_kernel(
    const MagneticFieldMeasurement* measurements,
    const float4* field_grid,
    float3* interpolated_fields,
    const int num_measurements,
    const int3 grid_dims
);

// Kernel launcher implementations
void launch_ekf_prediction(
    NavigationState* states,
    const KalmanParameters* params,
    int num_states,
    cudaStream_t stream
) {
    // Optimal configuration for EKF kernel
    const int block_size = 256;
    const int grid_size = (num_states + block_size - 1) / block_size;
    
    ekf_prediction_kernel<<<grid_size, block_size, 0, stream>>>(
        states, params, num_states
    );
    
    // Check for launch errors
    cudaError_t err = cudaGetLastError();
    if (err != cudaSuccess) {
        fprintf(stderr, "EKF kernel launch failed: %s\n", cudaGetErrorString(err));
    }
}

void launch_matrix_multiply(
    const float* A,
    const float* B,
    float* C,
    int m, int n, int k,
    float alpha, float beta,
    cudaStream_t stream
) {
    // Use 16x16 thread blocks for optimal shared memory usage
    dim3 block_size(16, 16);
    dim3 grid_size(
        (n + block_size.x - 1) / block_size.x,
        (m + block_size.y - 1) / block_size.y
    );
    
    matrix_multiply_kernel<<<grid_size, block_size, 0, stream>>>(
        A, B, C, m, n, k, alpha, beta
    );
    
    cudaError_t err = cudaGetLastError();
    if (err != cudaSuccess) {
        fprintf(stderr, "Matrix multiply kernel launch failed: %s\n", cudaGetErrorString(err));
    }
}

void launch_trajectory_optimization(
    float3* trajectories,
    float3* gradients,
    const float3* constraints,
    int num_points,
    float learning_rate,
    cudaStream_t stream
) {
    const int block_size = 256;
    const int grid_size = (num_points + block_size - 1) / block_size;
    
    trajectory_optimization_kernel<<<grid_size, block_size, 0, stream>>>(
        trajectories, gradients, constraints, num_points, learning_rate
    );
    
    cudaError_t err = cudaGetLastError();
    if (err != cudaSuccess) {
        fprintf(stderr, "Trajectory optimization kernel launch failed: %s\n", 
                cudaGetErrorString(err));
    }
}

void launch_magnetic_field_processing(
    const MagneticFieldMeasurement* measurements,
    const float4* field_grid,
    float3* interpolated_fields,
    int num_measurements,
    int3 grid_dims,
    cudaStream_t stream
) {
    const int block_size = 256;
    const int grid_size = (num_measurements + block_size - 1) / block_size;
    
    // Calculate shared memory size needed
    size_t shared_mem_size = 8 * block_size * sizeof(float);  // For interpolation coefficients
    
    magnetic_field_processing_kernel<<<grid_size, block_size, shared_mem_size, stream>>>(
        measurements, field_grid, interpolated_fields, num_measurements, grid_dims
    );
    
    cudaError_t err = cudaGetLastError();
    if (err != cudaSuccess) {
        fprintf(stderr, "Magnetic field processing kernel launch failed: %s\n", 
                cudaGetErrorString(err));
    }
}

void get_optimal_kernel_config(
    int kernel_type,
    int data_size,
    dim3* block_size,
    dim3* grid_size
) {
    // Get device properties
    cudaDeviceProp prop;
    cudaGetDeviceProperties(&prop, 0);
    
    switch (kernel_type) {
        case 0:  // EKF kernel
            block_size->x = 256;
            block_size->y = 1;
            block_size->z = 1;
            grid_size->x = (data_size + block_size->x - 1) / block_size->x;
            grid_size->y = 1;
            grid_size->z = 1;
            break;
            
        case 1:  // Matrix multiply
            block_size->x = 16;
            block_size->y = 16;
            block_size->z = 1;
            // Grid size depends on matrix dimensions
            break;
            
        case 2:  // Trajectory optimization
            block_size->x = 256;
            block_size->y = 1;
            block_size->z = 1;
            grid_size->x = (data_size + block_size->x - 1) / block_size->x;
            grid_size->y = 1;
            grid_size->z = 1;
            break;
            
        case 3:  // Magnetic field processing
            // Use maximum threads per block for better occupancy
            block_size->x = min(256, prop.maxThreadsPerBlock);
            block_size->y = 1;
            block_size->z = 1;
            grid_size->x = (data_size + block_size->x - 1) / block_size->x;
            grid_size->y = 1;
            grid_size->z = 1;
            break;
            
        default:
            block_size->x = 256;
            block_size->y = 1;
            block_size->z = 1;
            grid_size->x = (data_size + block_size->x - 1) / block_size->x;
            grid_size->y = 1;
            grid_size->z = 1;
    }
    
    // Ensure we don't exceed device limits
    grid_size->x = min(grid_size->x, (unsigned int)prop.maxGridSize[0]);
    grid_size->y = min(grid_size->y, (unsigned int)prop.maxGridSize[1]);
    grid_size->z = min(grid_size->z, (unsigned int)prop.maxGridSize[2]);
}