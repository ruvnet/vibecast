//! Transpiled matrix multiplication kernel
//! Original CUDA kernel:
//! ```cuda
//! __global__ void matrixMul(float* a, float* b, float* c, int m, int n, int k) {
//!     int row = threadIdx.y + blockIdx.y * blockDim.y;
//!     int col = threadIdx.x + blockIdx.x * blockDim.x;
//!     
//!     if (row < m && col < n) {
//!         float sum = 0.0f;
//!         for (int i = 0; i < k; i++) {
//!             sum += a[row * k + i] * b[i * n + col];
//!         }
//!         c[row * n + col] = sum;
//!     }
//! }
//! ```

use cuda_rust_wasm::runtime::{Grid, Block, thread, block, grid};
use cuda_rust_wasm::memory::{DeviceBuffer, SharedMemory};
use cuda_rust_wasm::kernel::launch_kernel;

#[kernel]
pub fn matrixMul(
    a: &[f32],
    b: &[f32],
    c: &mut [f32],
    m: u32,
    n: u32,
    k: u32,
) {
    let row = thread::index().y + block::index().y * block::dim().y;
    let col = thread::index().x + block::index().x * block::dim().x;
    
    if row < m && col < n {
        let mut sum = 0.0f32;
        let mut i: u32 = 0;
        while i < k {
            sum += a[(row * k + i) as usize] * b[(i * n + col) as usize];
            i += 1;
        }
        c[(row * n + col) as usize] = sum;
    }
}

// Optimized version with shared memory tiling
#[kernel]
pub fn matrixMulTiled(
    a: &[f32],
    b: &[f32],
    c: &mut [f32],
    m: u32,
    n: u32,
    k: u32,
) {
    const TILE_SIZE: usize = 16;
    
    #[shared]
    static mut A_TILE: [[f32; TILE_SIZE]; TILE_SIZE] = [[0.0; TILE_SIZE]; TILE_SIZE];
    #[shared]
    static mut B_TILE: [[f32; TILE_SIZE]; TILE_SIZE] = [[0.0; TILE_SIZE]; TILE_SIZE];
    
    let row = thread::index().y + block::index().y * block::dim().y;
    let col = thread::index().x + block::index().x * block::dim().x;
    let ty = thread::index().y as usize;
    let tx = thread::index().x as usize;
    
    let mut sum = 0.0f32;
    
    // Loop over tiles
    let num_tiles = (k + TILE_SIZE as u32 - 1) / TILE_SIZE as u32;
    let mut tile: u32 = 0;
    while tile < num_tiles {
        // Load tile from A
        let a_row = row;
        let a_col = tile * TILE_SIZE as u32 + tx as u32;
        if a_row < m && a_col < k {
            unsafe {
                A_TILE[ty][tx] = a[(a_row * k + a_col) as usize];
            }
        } else {
            unsafe {
                A_TILE[ty][tx] = 0.0;
            }
        }
        
        // Load tile from B
        let b_row = tile * TILE_SIZE as u32 + ty as u32;
        let b_col = col;
        if b_row < k && b_col < n {
            unsafe {
                B_TILE[ty][tx] = b[(b_row * n + b_col) as usize];
            }
        } else {
            unsafe {
                B_TILE[ty][tx] = 0.0;
            }
        }
        
        // Synchronize to ensure tiles are loaded
        cuda_rust_wasm::runtime::sync_threads();
        
        // Compute partial product
        let mut i: usize = 0;
        while i < TILE_SIZE {
            unsafe {
                sum += A_TILE[ty][i] * B_TILE[i][tx];
            }
            i += 1;
        }
        
        // Synchronize before loading next tile
        cuda_rust_wasm::runtime::sync_threads();
        
        tile += 1;
    }
    
    // Write result
    if row < m && col < n {
        c[(row * n + col) as usize] = sum;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cuda_rust_wasm::runtime::CudaRuntime;
    
    #[test]
    fn test_matrix_multiply() {
        let runtime = CudaRuntime::new().unwrap();
        
        // Small test matrices
        let m = 64;
        let n = 48;
        let k = 32;
        
        // Initialize matrices
        let mut a = vec![0.0f32; m * k];
        let mut b = vec![0.0f32; k * n];
        let mut c = vec![0.0f32; m * n];
        let mut c_expected = vec![0.0f32; m * n];
        
        // Fill with test data
        for i in 0..m {
            for j in 0..k {
                a[i * k + j] = (i + j) as f32;
            }
        }
        
        for i in 0..k {
            for j in 0..n {
                b[i * n + j] = (i - j) as f32;
            }
        }
        
        // Calculate expected result on CPU
        for i in 0..m {
            for j in 0..n {
                let mut sum = 0.0f32;
                for l in 0..k {
                    sum += a[i * k + l] * b[l * n + j];
                }
                c_expected[i * n + j] = sum;
            }
        }
        
        // Allocate device memory
        let d_a = DeviceBuffer::from_slice(&a).unwrap();
        let d_b = DeviceBuffer::from_slice(&b).unwrap();
        let mut d_c = DeviceBuffer::new(m * n).unwrap();
        
        // Launch kernel
        let block_size = (16, 16);
        let grid_size = (
            (n + block_size.0 - 1) / block_size.0,
            (m + block_size.1 - 1) / block_size.1
        );
        
        launch_kernel!(
            matrixMulTiled<<<grid_size, block_size>>>(
                d_a.as_slice(),
                d_b.as_slice(),
                d_c.as_mut_slice(),
                m as u32,
                n as u32,
                k as u32
            )
        );
        
        // Copy result back
        d_c.copy_to_host(&mut c).unwrap();
        
        // Verify results
        for i in 0..m*n {
            assert!((c[i] - c_expected[i]).abs() < 1e-5,
                    "Mismatch at {}: {} vs {}", i, c[i], c_expected[i]);
        }
    }
}