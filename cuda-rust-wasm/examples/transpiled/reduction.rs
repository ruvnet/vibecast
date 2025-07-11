//! Transpiled reduction kernel
//! Original CUDA kernel:
//! ```cuda
//! __global__ void reduction(float* input, float* output, int n) {
//!     __shared__ float sdata[256];
//!     
//!     int tid = threadIdx.x;
//!     int gid = blockIdx.x * blockDim.x + tid;
//!     
//!     sdata[tid] = (gid < n) ? input[gid] : 0.0f;
//!     __syncthreads();
//!     
//!     for (int s = blockDim.x / 2; s > 0; s >>= 1) {
//!         if (tid < s) {
//!             sdata[tid] += sdata[tid + s];
//!         }
//!         __syncthreads();
//!     }
//!     
//!     if (tid == 0) {
//!         output[blockIdx.x] = sdata[0];
//!     }
//! }
//! ```

use cuda_rust_wasm::runtime::{Grid, Block, thread, block, grid};
use cuda_rust_wasm::memory::{DeviceBuffer, SharedMemory};
use cuda_rust_wasm::kernel::launch_kernel;

#[kernel]
pub fn reduction(
    input: &[f32],
    output: &mut [f32],
    n: u32,
) {
    // Shared memory for partial sums
    #[shared]
    static mut PARTIAL_SUMS: [f32; 256] = [0.0; 256];
    
    let tid = thread::index().x;
    let gid = block::index().x * block::dim().x + tid;
    let block_size = block::dim().x;
    
    // Load data and perform first reduction
    let mut sum = 0.0f32;
    let mut i = gid;
    while i < n {
        sum += input[i as usize];
        i += grid::dim().x * block_size;
    }
    
    // Store to shared memory
    unsafe {
        PARTIAL_SUMS[tid as usize] = sum;
    }
    
    // Synchronize threads
    cuda_rust_wasm::runtime::sync_threads();
    
    // Perform reduction in shared memory
    let mut stride = block_size / 2;
    while stride > 0 {
        if tid < stride {
            unsafe {
                PARTIAL_SUMS[tid as usize] += PARTIAL_SUMS[(tid + stride) as usize];
            }
        }
        cuda_rust_wasm::runtime::sync_threads();
        stride /= 2;
    }
    
    // Write result
    if tid == 0 {
        output[block::index().x as usize] = unsafe { PARTIAL_SUMS[0] };
    }
}

// Optimized version using warp primitives
#[kernel]
pub fn reductionWarp(
    input: &[f32],
    output: &mut [f32],
    n: u32,
) {
    #[shared]
    static mut WARP_SUMS: [f32; 32] = [0.0; 32]; // 32 warps max per block
    
    let tid = thread::index().x;
    let lane_id = tid & 31; // tid % 32
    let warp_id = tid >> 5; // tid / 32
    let gid = block::index().x * block::dim().x + tid;
    let block_size = block::dim().x;
    
    // Load data and accumulate
    let mut sum = 0.0f32;
    let mut i = gid;
    while i < n {
        sum += input[i as usize];
        i += grid::dim().x * block_size;
    }
    
    // Warp-level reduction using shuffle operations
    sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 16);
    sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 8);
    sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 4);
    sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 2);
    sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 1);
    
    // First thread in each warp writes to shared memory
    if lane_id == 0 {
        unsafe {
            WARP_SUMS[warp_id as usize] = sum;
        }
    }
    
    cuda_rust_wasm::runtime::sync_threads();
    
    // Final reduction by first warp
    if warp_id == 0 {
        sum = if tid < (block_size >> 5) {
            unsafe { WARP_SUMS[lane_id as usize] }
        } else {
            0.0
        };
        
        // Warp reduction
        sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 16);
        sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 8);
        sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 4);
        sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 2);
        sum += cuda_rust_wasm::runtime::warp_shuffle_down(sum, 1);
        
        if tid == 0 {
            output[block::index().x as usize] = sum;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cuda_rust_wasm::runtime::CudaRuntime;
    
    #[test]
    fn test_reduction() {
        let runtime = CudaRuntime::new().unwrap();
        
        let n = 1_000_000;
        let data: Vec<f32> = (0..n).map(|i| 1.0).collect(); // All ones for easy verification
        
        // Allocate device memory
        let d_input = DeviceBuffer::from_slice(&data).unwrap();
        
        let block_size = 256;
        let grid_size = (n + block_size - 1) / block_size;
        let mut d_output = DeviceBuffer::new(grid_size).unwrap();
        
        // First level reduction
        launch_kernel!(
            reduction<<<grid_size, block_size>>>(
                d_input.as_slice(),
                d_output.as_mut_slice(),
                n as u32
            )
        );
        
        // Get partial results
        let mut partial_sums = vec![0.0f32; grid_size];
        d_output.copy_to_host(&mut partial_sums).unwrap();
        
        // Final reduction on CPU (or could do another kernel pass)
        let total: f32 = partial_sums.iter().sum();
        
        assert!((total - n as f32).abs() < 1e-3,
                "Expected {}, got {}", n as f32, total);
    }
    
    #[test]
    fn test_reduction_warp() {
        let runtime = CudaRuntime::new().unwrap();
        
        let n = 100_000;
        let data: Vec<f32> = (0..n).map(|i| (i % 10) as f32).collect();
        let expected_sum: f32 = data.iter().sum();
        
        // Allocate device memory
        let d_input = DeviceBuffer::from_slice(&data).unwrap();
        
        let block_size = 256;
        let grid_size = (n + block_size * 4 - 1) / (block_size * 4); // Each thread processes 4 elements
        let mut d_output = DeviceBuffer::new(grid_size).unwrap();
        
        // Launch optimized kernel
        launch_kernel!(
            reductionWarp<<<grid_size, block_size>>>(
                d_input.as_slice(),
                d_output.as_mut_slice(),
                n as u32
            )
        );
        
        // Get partial results and sum on CPU
        let mut partial_sums = vec![0.0f32; grid_size];
        d_output.copy_to_host(&mut partial_sums).unwrap();
        let total: f32 = partial_sums.iter().sum();
        
        assert!((total - expected_sum).abs() < 1e-3,
                "Expected {}, got {}", expected_sum, total);
    }
}