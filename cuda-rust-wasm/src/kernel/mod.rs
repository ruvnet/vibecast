//! Kernel execution module

pub mod grid;
pub mod thread;
pub mod shared_memory;
pub mod warp;

pub use crate::runtime::kernel::{launch_kernel, LaunchConfig, KernelFunction, ThreadContext};
pub use crate::runtime::{Grid, Block, Dim3};

// Re-export the kernel_function macro
pub use crate::kernel_function;