//! Kernel launch functionality

use crate::{Result, runtime_error};
use super::{Grid, Block, Device, Stream};
use std::sync::Arc;
use std::marker::PhantomData;

/// Kernel function trait
pub trait KernelFunction<Args> {
    /// Execute the kernel with given arguments
    fn execute(&self, args: Args, thread_ctx: ThreadContext);
    
    /// Get kernel name for debugging
    fn name(&self) -> &str;
}

/// Thread context provided to kernels
#[derive(Debug, Clone, Copy)]
pub struct ThreadContext {
    /// Thread index within block
    pub thread_idx: super::grid::Dim3,
    /// Block index within grid
    pub block_idx: super::grid::Dim3,
    /// Block dimensions
    pub block_dim: super::grid::Dim3,
    /// Grid dimensions
    pub grid_dim: super::grid::Dim3,
}

impl ThreadContext {
    /// Get global thread ID (1D)
    pub fn global_thread_id(&self) -> usize {
        let block_offset = self.block_idx.x as usize * self.block_dim.x as usize;
        (block_offset + self.thread_idx.x as usize)
    }
    
    /// Get global thread ID (2D)
    pub fn global_thread_id_2d(&self) -> (usize, usize) {
        let x = self.block_idx.x as usize * self.block_dim.x as usize + self.thread_idx.x as usize;
        let y = self.block_idx.y as usize * self.block_dim.y as usize + self.thread_idx.y as usize;
        (x, y)
    }
    
    /// Get global thread ID (3D)
    pub fn global_thread_id_3d(&self) -> (usize, usize, usize) {
        let x = self.block_idx.x as usize * self.block_dim.x as usize + self.thread_idx.x as usize;
        let y = self.block_idx.y as usize * self.block_dim.y as usize + self.thread_idx.y as usize;
        let z = self.block_idx.z as usize * self.block_dim.z as usize + self.thread_idx.z as usize;
        (x, y, z)
    }
}

/// Kernel launch configuration
pub struct LaunchConfig {
    pub grid: Grid,
    pub block: Block,
    pub stream: Option<Arc<Stream>>,
    pub shared_memory_bytes: usize,
}

impl LaunchConfig {
    /// Create a new launch configuration
    pub fn new(grid: Grid, block: Block) -> Self {
        Self {
            grid,
            block,
            stream: None,
            shared_memory_bytes: 0,
        }
    }
    
    /// Set the stream for kernel execution
    pub fn with_stream(mut self, stream: Arc<Stream>) -> Self {
        self.stream = Some(stream);
        self
    }
    
    /// Set shared memory size
    pub fn with_shared_memory(mut self, bytes: usize) -> Self {
        self.shared_memory_bytes = bytes;
        self
    }
}

/// CPU backend kernel executor
struct CpuKernelExecutor<K, Args> {
    kernel: K,
    phantom: PhantomData<Args>,
}

impl<K, Args> CpuKernelExecutor<K, Args>
where
    K: KernelFunction<Args>,
    Args: Clone + Send + Sync,
{
    fn execute(&self, config: &LaunchConfig, args: Args) -> Result<()> {
        let total_blocks = config.grid.num_blocks();
        let threads_per_block = config.block.num_threads();
        
        // For CPU backend, we execute sequentially
        // In a real implementation, this could use rayon for parallelism
        for block_id in 0..total_blocks {
            // Convert linear block ID to 3D
            let block_idx = super::grid::Dim3 {
                x: block_id % config.grid.dim.x,
                y: (block_id / config.grid.dim.x) % config.grid.dim.y,
                z: block_id / (config.grid.dim.x * config.grid.dim.y),
            };
            
            for thread_id in 0..threads_per_block {
                // Convert linear thread ID to 3D
                let thread_idx = super::grid::Dim3 {
                    x: thread_id % config.block.dim.x,
                    y: (thread_id / config.block.dim.x) % config.block.dim.y,
                    z: thread_id / (config.block.dim.x * config.block.dim.y),
                };
                
                let thread_ctx = ThreadContext {
                    thread_idx,
                    block_idx,
                    block_dim: config.block.dim,
                    grid_dim: config.grid.dim,
                };
                
                self.kernel.execute(args.clone(), thread_ctx);
            }
        }
        
        Ok(())
    }
}

/// Launch a kernel function
pub fn launch_kernel<K, Args>(
    kernel: K,
    config: LaunchConfig,
    args: Args,
) -> Result<()>
where
    K: KernelFunction<Args>,
    Args: Clone + Send + Sync,
{
    // Validate block configuration
    config.block.validate()?;
    
    // Get device from stream or use default
    let device = if let Some(ref stream) = config.stream {
        stream.device()
    } else {
        Device::get_default()?
    };
    
    // Dispatch based on backend
    match device.backend() {
        super::BackendType::CPU => {
            let executor = CpuKernelExecutor {
                kernel,
                phantom: PhantomData,
            };
            executor.execute(&config, args)?;
        }
        super::BackendType::Native => {
            // TODO: Native GPU execution
            return Err(runtime_error!("Native GPU backend not yet implemented"));
        }
        super::BackendType::WebGPU => {
            // TODO: WebGPU execution
            return Err(runtime_error!("WebGPU backend not yet implemented"));
        }
    }
    
    Ok(())
}

/// Helper macro to define kernel functions
#[macro_export]
macro_rules! kernel_function {
    ($name:ident, $args:ty, |$args_pat:pat, $ctx:ident| $body:block) => {
        struct $name;
        
        impl $crate::runtime::kernel::KernelFunction<$args> for $name {
            fn execute(&self, $args_pat: $args, $ctx: $crate::runtime::kernel::ThreadContext) {
                $body
            }
            
            fn name(&self) -> &str {
                stringify!($name)
            }
        }
    };
}