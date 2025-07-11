//! Device memory allocation and management

use crate::{Result, runtime_error};
use crate::runtime::{Device, BackendType};
use std::marker::PhantomData;
use std::sync::Arc;
use std::alloc::{alloc, dealloc, Layout};

/// Raw device memory pointer
pub struct DevicePtr {
    raw: *mut u8,
    size: usize,
    backend: BackendType,
}

impl DevicePtr {
    /// Allocate raw device memory
    pub fn allocate(size: usize, device: &Arc<Device>) -> Result<Self> {
        if size == 0 {
            return Err(runtime_error!("Cannot allocate zero-sized buffer"));
        }

        let backend = device.backend();
        let raw = match backend {
            BackendType::Native => {
                // TODO: Real CUDA allocation
                // For now, use host memory as placeholder
                unsafe {
                    let layout = Layout::from_size_align(size, 8)
                        .map_err(|e| runtime_error!("Invalid layout: {}", e))?;
                    alloc(layout)
                }
            }
            BackendType::WebGPU => {
                // TODO: WebGPU buffer allocation
                unsafe {
                    let layout = Layout::from_size_align(size, 8)
                        .map_err(|e| runtime_error!("Invalid layout: {}", e))?;
                    alloc(layout)
                }
            }
            BackendType::CPU => {
                // CPU backend uses regular heap allocation
                unsafe {
                    let layout = Layout::from_size_align(size, 8)
                        .map_err(|e| runtime_error!("Invalid layout: {}", e))?;
                    alloc(layout)
                }
            }
        };

        if raw.is_null() {
            return Err(runtime_error!("Failed to allocate {} bytes of device memory", size));
        }

        Ok(Self { raw, size, backend })
    }

    /// Get raw pointer
    pub fn as_ptr(&self) -> *const u8 {
        self.raw
    }

    /// Get mutable raw pointer
    pub fn as_mut_ptr(&mut self) -> *mut u8 {
        self.raw
    }

    /// Get allocation size
    pub fn size(&self) -> usize {
        self.size
    }
}

impl Drop for DevicePtr {
    fn drop(&mut self) {
        if !self.raw.is_null() {
            match self.backend {
                BackendType::Native => {
                    // TODO: Real CUDA deallocation
                    unsafe {
                        if let Ok(layout) = Layout::from_size_align(self.size, 8) {
                            dealloc(self.raw, layout);
                        }
                    }
                }
                BackendType::WebGPU => {
                    // TODO: WebGPU buffer deallocation
                    unsafe {
                        if let Ok(layout) = Layout::from_size_align(self.size, 8) {
                            dealloc(self.raw, layout);
                        }
                    }
                }
                BackendType::CPU => {
                    unsafe {
                        if let Ok(layout) = Layout::from_size_align(self.size, 8) {
                            dealloc(self.raw, layout);
                        }
                    }
                }
            }
        }
    }
}

/// Device memory buffer
pub struct DeviceBuffer<T> {
    ptr: DevicePtr,
    len: usize,
    device: Arc<Device>,
    phantom: PhantomData<T>,
}

impl<T: Copy> DeviceBuffer<T> {
    /// Allocate a new device buffer
    pub fn new(len: usize, device: Arc<Device>) -> Result<Self> {
        if len == 0 {
            return Err(runtime_error!("Cannot allocate zero-length buffer"));
        }

        let size = len * std::mem::size_of::<T>();
        let ptr = DevicePtr::allocate(size, &device)?;

        Ok(Self {
            ptr,
            len,
            device,
            phantom: PhantomData,
        })
    }
    
    /// Get buffer length
    pub fn len(&self) -> usize {
        self.len
    }
    
    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Get the device this buffer is allocated on
    pub fn device(&self) -> &Arc<Device> {
        &self.device
    }

    /// Get raw device pointer
    pub unsafe fn as_ptr(&self) -> *const T {
        self.ptr.as_ptr() as *const T
    }

    /// Get mutable raw device pointer
    pub unsafe fn as_mut_ptr(&mut self) -> *mut T {
        self.ptr.as_mut_ptr() as *mut T
    }
    
    /// Copy from host memory
    pub fn copy_from_host(&mut self, data: &[T]) -> Result<()> {
        if data.len() != self.len {
            return Err(runtime_error!(
                "Host buffer length {} doesn't match device buffer length {}",
                data.len(),
                self.len
            ));
        }

        let size = self.len * std::mem::size_of::<T>();
        
        match self.device.backend() {
            BackendType::Native => {
                // TODO: Real CUDA memcpy
                unsafe {
                    std::ptr::copy_nonoverlapping(
                        data.as_ptr() as *const u8,
                        self.ptr.as_mut_ptr(),
                        size
                    );
                }
            }
            BackendType::WebGPU => {
                // TODO: WebGPU buffer write
                unsafe {
                    std::ptr::copy_nonoverlapping(
                        data.as_ptr() as *const u8,
                        self.ptr.as_mut_ptr(),
                        size
                    );
                }
            }
            BackendType::CPU => {
                unsafe {
                    std::ptr::copy_nonoverlapping(
                        data.as_ptr() as *const u8,
                        self.ptr.as_mut_ptr(),
                        size
                    );
                }
            }
        }

        Ok(())
    }
    
    /// Copy to host memory
    pub fn copy_to_host(&self, data: &mut [T]) -> Result<()> {
        if data.len() != self.len {
            return Err(runtime_error!(
                "Host buffer length {} doesn't match device buffer length {}",
                data.len(),
                self.len
            ));
        }

        let size = self.len * std::mem::size_of::<T>();
        
        match self.device.backend() {
            BackendType::Native => {
                // TODO: Real CUDA memcpy
                unsafe {
                    std::ptr::copy_nonoverlapping(
                        self.ptr.as_ptr(),
                        data.as_mut_ptr() as *mut u8,
                        size
                    );
                }
            }
            BackendType::WebGPU => {
                // TODO: WebGPU buffer read
                unsafe {
                    std::ptr::copy_nonoverlapping(
                        self.ptr.as_ptr(),
                        data.as_mut_ptr() as *mut u8,
                        size
                    );
                }
            }
            BackendType::CPU => {
                unsafe {
                    std::ptr::copy_nonoverlapping(
                        self.ptr.as_ptr(),
                        data.as_mut_ptr() as *mut u8,
                        size
                    );
                }
            }
        }

        Ok(())
    }

    /// Fill buffer with a value
    pub fn fill(&mut self, value: T) -> Result<()> {
        // For now, copy to host, fill, and copy back
        // TODO: Optimize with kernel-based fill
        let mut host_data = vec![value; self.len];
        self.copy_from_host(&host_data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::Device;

    #[test]
    fn test_device_buffer_allocation() {
        let device = Device::get_default().unwrap();
        let buffer = DeviceBuffer::<f32>::new(1024, device).unwrap();
        assert_eq!(buffer.len(), 1024);
        assert!(!buffer.is_empty());
    }

    #[test]
    fn test_host_device_copy() {
        let device = Device::get_default().unwrap();
        let mut buffer = DeviceBuffer::<f32>::new(100, device).unwrap();
        
        // Create test data
        let host_data: Vec<f32> = (0..100).map(|i| i as f32).collect();
        
        // Copy to device
        buffer.copy_from_host(&host_data).unwrap();
        
        // Copy back
        let mut result = vec![0.0; 100];
        buffer.copy_to_host(&mut result).unwrap();
        
        // Verify
        assert_eq!(host_data, result);
    }
}