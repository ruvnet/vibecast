//! Transpiled vector addition kernel
//! Original CUDA kernel:
//! ```cuda
//! __global__ void vectorAdd(float* a, float* b, float* c, int n) {
//!     int idx = threadIdx.x + blockIdx.x * blockDim.x;
//!     if (idx < n) {
//!         c[idx] = a[idx] + b[idx];
//!     }
//! }
//! ```

use cuda_rust_wasm::runtime::{Grid, Block, thread, block, grid};
use cuda_rust_wasm::memory::{DeviceBuffer, SharedMemory};
use cuda_rust_wasm::kernel::launch_kernel;

#[kernel]
pub fn vectorAdd(a: &[f32], b: &[f32], c: &mut [f32], n: i32) {
    let idx = thread::index().x + block::index().x * block::dim().x;
    if idx < n as u32 {
        c[idx as usize] = a[idx as usize] + b[idx as usize];
    }
}

// Example usage
#[cfg(test)]
mod tests {
    use super::*;
    use cuda_rust_wasm::runtime::CudaRuntime;
    
    #[test]
    fn test_vector_add() {
        let runtime = CudaRuntime::new().unwrap();
        
        let n = 1024;
        let a: Vec<f32> = (0..n).map(|i| i as f32).collect();
        let b: Vec<f32> = (0..n).map(|i| (i * 2) as f32).collect();
        let mut c = vec![0.0f32; n];
        
        // Allocate device memory
        let d_a = DeviceBuffer::from_slice(&a).unwrap();
        let d_b = DeviceBuffer::from_slice(&b).unwrap();
        let mut d_c = DeviceBuffer::new(n).unwrap();
        
        // Launch kernel
        let block_size = 256;
        let grid_size = (n + block_size - 1) / block_size;
        
        launch_kernel!(
            vectorAdd<<<grid_size, block_size>>>(
                d_a.as_slice(),
                d_b.as_slice(),
                d_c.as_mut_slice(),
                n as i32
            )
        );
        
        // Copy result back
        d_c.copy_to_host(&mut c).unwrap();
        
        // Verify results
        for i in 0..n {
            assert_eq!(c[i], a[i] + b[i]);
        }
    }
}