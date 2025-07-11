//! Prelude module for convenient imports

pub use crate::error::{CudaRustError, Result};
pub use crate::runtime::{
    Runtime, Device, BackendType, Stream,
    Grid, Block, Dim3,
    launch_kernel, LaunchConfig, KernelFunction, ThreadContext,
};
pub use crate::memory::{DeviceBuffer, HostBuffer};

// Re-export macros
pub use crate::{
    parse_error,
    translation_error,
    runtime_error,
    kernel_function,
};