//! Device abstraction for different backends

use crate::{Result, runtime_error};
use std::sync::Arc;

/// Device properties
#[derive(Debug, Clone)]
pub struct DeviceProperties {
    pub name: String,
    pub total_memory: usize,
    pub max_threads_per_block: u32,
    pub max_blocks_per_grid: u32,
    pub warp_size: u32,
    pub compute_capability: (u32, u32),
}

/// Backend type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendType {
    Native,
    WebGPU,
    CPU,
}

/// Device abstraction
pub struct Device {
    backend: BackendType,
    properties: DeviceProperties,
    id: usize,
}

impl Device {
    /// Get the default device
    pub fn get_default() -> Result<Arc<Self>> {
        // Detect available backend
        let backend = Self::detect_backend();
        
        let properties = match backend {
            BackendType::Native => Self::get_native_properties()?,
            BackendType::WebGPU => Self::get_webgpu_properties()?,
            BackendType::CPU => Self::get_cpu_properties(),
        };
        
        Ok(Arc::new(Self {
            backend,
            properties,
            id: 0,
        }))
    }
    
    /// Get device by ID
    pub fn get_by_id(id: usize) -> Result<Arc<Self>> {
        // For now, only support device 0
        if id != 0 {
            return Err(runtime_error!("Device {} not found", id));
        }
        Self::get_default()
    }
    
    /// Get device count
    pub fn count() -> Result<usize> {
        // For now, always return 1
        Ok(1)
    }
    
    /// Get device properties
    pub fn properties(&self) -> &DeviceProperties {
        &self.properties
    }
    
    /// Get backend type
    pub fn backend(&self) -> BackendType {
        self.backend
    }
    
    /// Get device ID
    pub fn id(&self) -> usize {
        self.id
    }
    
    /// Detect available backend
    fn detect_backend() -> BackendType {
        #[cfg(target_arch = "wasm32")]
        {
            BackendType::WebGPU
        }
        
        #[cfg(not(target_arch = "wasm32"))]
        {
            // Check for native GPU support
            #[cfg(feature = "cuda-backend")]
            {
                if Self::has_cuda() {
                    return BackendType::Native;
                }
            }
            
            // Fallback to CPU
            BackendType::CPU
        }
    }
    
    /// Check if CUDA is available
    #[cfg(feature = "cuda-backend")]
    fn has_cuda() -> bool {
        // TODO: Actually check for CUDA availability
        false
    }
    
    /// Get native GPU properties
    fn get_native_properties() -> Result<DeviceProperties> {
        // TODO: Query actual GPU properties
        Ok(DeviceProperties {
            name: "NVIDIA GPU (Simulated)".to_string(),
            total_memory: 8 * 1024 * 1024 * 1024, // 8GB
            max_threads_per_block: 1024,
            max_blocks_per_grid: 65535,
            warp_size: 32,
            compute_capability: (8, 0),
        })
    }
    
    /// Get WebGPU properties
    fn get_webgpu_properties() -> Result<DeviceProperties> {
        Ok(DeviceProperties {
            name: "WebGPU Device".to_string(),
            total_memory: 2 * 1024 * 1024 * 1024, // 2GB
            max_threads_per_block: 256,
            max_blocks_per_grid: 65535,
            warp_size: 32,
            compute_capability: (1, 0),
        })
    }
    
    /// Get CPU properties
    fn get_cpu_properties() -> DeviceProperties {
        DeviceProperties {
            name: "CPU Device".to_string(),
            total_memory: 16 * 1024 * 1024 * 1024, // 16GB
            max_threads_per_block: 1024,
            max_blocks_per_grid: 65535,
            warp_size: 1, // No warps on CPU
            compute_capability: (0, 0),
        }
    }
}