//! Host (CPU) memory management

use crate::{Result, runtime_error};
use std::alloc::{alloc, dealloc, Layout};
use std::marker::PhantomData;
use std::ptr::NonNull;

/// Page-locked host memory for efficient transfers
pub struct HostBuffer<T> {
    ptr: NonNull<T>,
    len: usize,
    layout: Layout,
    phantom: PhantomData<T>,
}

impl<T: Copy> HostBuffer<T> {
    /// Allocate a new pinned host buffer
    pub fn new(len: usize) -> Result<Self> {
        if len == 0 {
            return Err(runtime_error!("Cannot allocate zero-length buffer"));
        }
        
        let size = len * std::mem::size_of::<T>();
        let align = std::mem::align_of::<T>();
        
        let layout = Layout::from_size_align(size, align)
            .map_err(|e| runtime_error!("Invalid layout: {}", e))?;
        
        unsafe {
            let raw_ptr = alloc(layout);
            if raw_ptr.is_null() {
                return Err(runtime_error!(
                    "Failed to allocate {} bytes of host memory",
                    size
                ));
            }
            
            let ptr = NonNull::new_unchecked(raw_ptr as *mut T);
            
            Ok(Self {
                ptr,
                len,
                layout,
                phantom: PhantomData,
            })
        }
    }
    
    /// Get buffer length
    pub fn len(&self) -> usize {
        self.len
    }
    
    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
    
    /// Get a slice view of the buffer
    pub fn as_slice(&self) -> &[T] {
        unsafe {
            std::slice::from_raw_parts(self.ptr.as_ptr(), self.len)
        }
    }
    
    /// Get a mutable slice view of the buffer
    pub fn as_mut_slice(&mut self) -> &mut [T] {
        unsafe {
            std::slice::from_raw_parts_mut(self.ptr.as_ptr(), self.len)
        }
    }
    
    /// Copy from a slice
    pub fn copy_from_slice(&mut self, src: &[T]) -> Result<()> {
        if src.len() != self.len {
            return Err(runtime_error!(
                "Source length {} doesn't match buffer length {}",
                src.len(),
                self.len
            ));
        }
        
        self.as_mut_slice().copy_from_slice(src);
        Ok(())
    }
    
    /// Copy to a slice
    pub fn copy_to_slice(&self, dst: &mut [T]) -> Result<()> {
        if dst.len() != self.len {
            return Err(runtime_error!(
                "Destination length {} doesn't match buffer length {}",
                dst.len(),
                self.len
            ));
        }
        
        dst.copy_from_slice(self.as_slice());
        Ok(())
    }
    
    /// Fill buffer with a value
    pub fn fill(&mut self, value: T) {
        for elem in self.as_mut_slice() {
            *elem = value;
        }
    }
}

impl<T> Drop for HostBuffer<T> {
    fn drop(&mut self) {
        unsafe {
            dealloc(self.ptr.as_ptr() as *mut u8, self.layout);
        }
    }
}

// Implement Index traits for convenient access
impl<T> std::ops::Index<usize> for HostBuffer<T> {
    type Output = T;
    
    fn index(&self, index: usize) -> &Self::Output {
        &self.as_slice()[index]
    }
}

impl<T> std::ops::IndexMut<usize> for HostBuffer<T> {
    fn index_mut(&mut self, index: usize) -> &mut Self::Output {
        &mut self.as_mut_slice()[index]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_host_buffer_allocation() {
        let buffer = HostBuffer::<f32>::new(1024).unwrap();
        assert_eq!(buffer.len(), 1024);
        assert!(!buffer.is_empty());
    }
    
    #[test]
    fn test_host_buffer_copy() {
        let mut buffer = HostBuffer::<i32>::new(10).unwrap();
        let data: Vec<i32> = (0..10).collect();
        
        buffer.copy_from_slice(&data).unwrap();
        
        let mut result = vec![0; 10];
        buffer.copy_to_slice(&mut result).unwrap();
        
        assert_eq!(data, result);
    }
    
    #[test]
    fn test_host_buffer_fill() {
        let mut buffer = HostBuffer::<f64>::new(100).unwrap();
        buffer.fill(3.14);
        
        for i in 0..100 {
            assert_eq!(buffer[i], 3.14);
        }
    }
}