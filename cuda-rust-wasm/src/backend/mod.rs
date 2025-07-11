//! Backend abstraction layer

pub mod backend_trait;
pub mod native_gpu;
pub mod webgpu;
pub mod wasm_runtime;

pub use backend_trait::{Backend, BackendCapabilities};

/// Get the current backend implementation
pub fn get_backend() -> Box<dyn Backend> {
    #[cfg(target_arch = "wasm32")]
    {
        Box::new(webgpu::WebGPUBackend::new())
    }
    
    #[cfg(not(target_arch = "wasm32"))]
    {
        #[cfg(feature = "cuda-backend")]
        {
            if native_gpu::is_cuda_available() {
                return Box::new(native_gpu::NativeGPUBackend::new());
            }
        }
        
        // Fallback to CPU backend
        Box::new(wasm_runtime::WasmRuntime::new())
    }
}