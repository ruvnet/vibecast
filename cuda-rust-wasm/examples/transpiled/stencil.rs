//! Transpiled stencil computation kernel
//! Original CUDA kernel:
//! ```cuda
//! __global__ void stencil2D(float* input, float* output, int width, int height) {
//!     int x = threadIdx.x + blockIdx.x * blockDim.x;
//!     int y = threadIdx.y + blockIdx.y * blockDim.y;
//!     
//!     if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
//!         int idx = y * width + x;
//!         output[idx] = 0.2f * (input[idx] + 
//!                              input[idx - 1] + 
//!                              input[idx + 1] + 
//!                              input[idx - width] + 
//!                              input[idx + width]);
//!     }
//! }
//! ```

use cuda_rust_wasm::runtime::{Grid, Block, thread, block, grid};
use cuda_rust_wasm::memory::{DeviceBuffer, SharedMemory};
use cuda_rust_wasm::kernel::launch_kernel;

#[kernel]
pub fn stencil2D(
    input: &[f32],
    output: &mut [f32],
    width: u32,
    height: u32,
) {
    let x = thread::index().x + block::index().x * block::dim().x;
    let y = thread::index().y + block::index().y * block::dim().y;
    
    if x > 0 && x < width - 1 && y > 0 && y < height - 1 {
        let idx = (y * width + x) as usize;
        let idx_n = ((y - 1) * width + x) as usize;
        let idx_s = ((y + 1) * width + x) as usize;
        let idx_e = (y * width + (x + 1)) as usize;
        let idx_w = (y * width + (x - 1)) as usize;
        
        // 5-point stencil
        output[idx] = 0.2 * (
            input[idx] +
            input[idx_n] +
            input[idx_s] +
            input[idx_e] +
            input[idx_w]
        );
    }
}

// Optimized version using shared memory for halo regions
#[kernel]
pub fn stencil2DShared(
    input: &[f32],
    output: &mut [f32],
    width: u32,
    height: u32,
) {
    const TILE_SIZE: usize = 16;
    const HALO: usize = 1;
    const SHARED_SIZE: usize = TILE_SIZE + 2 * HALO;
    
    #[shared]
    static mut TILE: [[f32; SHARED_SIZE]; SHARED_SIZE] = [[0.0; SHARED_SIZE]; SHARED_SIZE];
    
    let tx = thread::index().x as usize;
    let ty = thread::index().y as usize;
    let x = block::index().x * TILE_SIZE as u32 + tx as u32;
    let y = block::index().y * TILE_SIZE as u32 + ty as u32;
    
    // Load main tile data
    if x < width && y < height {
        unsafe {
            TILE[ty + HALO][tx + HALO] = input[(y * width + x) as usize];
        }
    }
    
    // Load halo regions
    // Left halo
    if tx == 0 && x > 0 {
        unsafe {
            TILE[ty + HALO][0] = input[(y * width + x - 1) as usize];
        }
    }
    // Right halo
    if tx == TILE_SIZE - 1 && x < width - 1 {
        unsafe {
            TILE[ty + HALO][SHARED_SIZE - 1] = input[(y * width + x + 1) as usize];
        }
    }
    // Top halo
    if ty == 0 && y > 0 {
        unsafe {
            TILE[0][tx + HALO] = input[((y - 1) * width + x) as usize];
        }
    }
    // Bottom halo
    if ty == TILE_SIZE - 1 && y < height - 1 {
        unsafe {
            TILE[SHARED_SIZE - 1][tx + HALO] = input[((y + 1) * width + x) as usize];
        }
    }
    
    // Synchronize to ensure tile is loaded
    cuda_rust_wasm::runtime::sync_threads();
    
    // Apply stencil from shared memory
    if x > 0 && x < width - 1 && y > 0 && y < height - 1 {
        let sx = tx + HALO;
        let sy = ty + HALO;
        
        unsafe {
            output[(y * width + x) as usize] = 0.2 * (
                TILE[sy][sx] +
                TILE[sy - 1][sx] +
                TILE[sy + 1][sx] +
                TILE[sy][sx - 1] +
                TILE[sy][sx + 1]
            );
        }
    }
}

// 9-point stencil (includes diagonals)
#[kernel]
pub fn stencil2D9Point(
    input: &[f32],
    output: &mut [f32],
    width: u32,
    height: u32,
) {
    let x = thread::index().x + block::index().x * block::dim().x;
    let y = thread::index().y + block::index().y * block::dim().y;
    
    if x > 0 && x < width - 1 && y > 0 && y < height - 1 {
        let idx = (y * width + x) as usize;
        
        // Center weight
        let center_weight = 0.5;
        // Adjacent weights
        let adjacent_weight = 0.1;
        // Diagonal weights
        let diagonal_weight = 0.025;
        
        output[idx] = 
            center_weight * input[idx] +
            // Adjacent cells
            adjacent_weight * (
                input[((y - 1) * width + x) as usize] +  // North
                input[((y + 1) * width + x) as usize] +  // South
                input[(y * width + (x - 1)) as usize] +  // West
                input[(y * width + (x + 1)) as usize]    // East
            ) +
            // Diagonal cells
            diagonal_weight * (
                input[((y - 1) * width + (x - 1)) as usize] +  // NW
                input[((y - 1) * width + (x + 1)) as usize] +  // NE
                input[((y + 1) * width + (x - 1)) as usize] +  // SW
                input[((y + 1) * width + (x + 1)) as usize]    // SE
            );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cuda_rust_wasm::runtime::CudaRuntime;
    
    #[test]
    fn test_stencil_2d() {
        let runtime = CudaRuntime::new().unwrap();
        
        let width = 128;
        let height = 128;
        let size = width * height;
        
        // Initialize input with test pattern
        let mut input = vec![0.0f32; size];
        for y in 0..height {
            for x in 0..width {
                // Create a simple pattern
                input[y * width + x] = ((x + y) % 10) as f32;
            }
        }
        
        // Allocate device memory
        let d_input = DeviceBuffer::from_slice(&input).unwrap();
        let mut d_output = DeviceBuffer::new(size).unwrap();
        
        // Launch kernel
        let block_size = (16, 16);
        let grid_size = (
            (width + block_size.0 - 1) / block_size.0,
            (height + block_size.1 - 1) / block_size.1
        );
        
        launch_kernel!(
            stencil2DShared<<<grid_size, block_size>>>(
                d_input.as_slice(),
                d_output.as_mut_slice(),
                width as u32,
                height as u32
            )
        );
        
        // Copy result back
        let mut output = vec![0.0f32; size];
        d_output.copy_to_host(&mut output).unwrap();
        
        // Verify interior points (skip boundaries)
        for y in 1..height-1 {
            for x in 1..width-1 {
                let idx = y * width + x;
                let expected = 0.2 * (
                    input[idx] +
                    input[idx - 1] +
                    input[idx + 1] +
                    input[idx - width] +
                    input[idx + width]
                );
                assert!((output[idx] - expected).abs() < 1e-5,
                        "Mismatch at ({}, {}): {} vs {}", x, y, output[idx], expected);
            }
        }
    }
    
    #[test]
    fn test_stencil_9_point() {
        let runtime = CudaRuntime::new().unwrap();
        
        let width = 64;
        let height = 64;
        let size = width * height;
        
        // Initialize with constant value for easy verification
        let input = vec![1.0f32; size];
        
        // Allocate device memory
        let d_input = DeviceBuffer::from_slice(&input).unwrap();
        let mut d_output = DeviceBuffer::new(size).unwrap();
        
        // Launch kernel
        let block_size = (16, 16);
        let grid_size = (
            (width + block_size.0 - 1) / block_size.0,
            (height + block_size.1 - 1) / block_size.1
        );
        
        launch_kernel!(
            stencil2D9Point<<<grid_size, block_size>>>(
                d_input.as_slice(),
                d_output.as_mut_slice(),
                width as u32,
                height as u32
            )
        );
        
        // Copy result back
        let mut output = vec![0.0f32; size];
        d_output.copy_to_host(&mut output).unwrap();
        
        // For constant input, 9-point stencil should give:
        // 0.5 * 1 + 0.1 * 4 + 0.025 * 4 = 0.5 + 0.4 + 0.1 = 1.0
        for y in 1..height-1 {
            for x in 1..width-1 {
                let idx = y * width + x;
                assert!((output[idx] - 1.0).abs() < 1e-5,
                        "Unexpected value at ({}, {}): {}", x, y, output[idx]);
            }
        }
    }
}