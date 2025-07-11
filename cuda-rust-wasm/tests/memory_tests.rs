//! Unit tests for memory management

#[cfg(test)]
mod memory_tests {
    use cuda_rust_wasm::memory::{
        DeviceMemory, MemoryPool, AllocationStrategy, MemoryInfo,
        UnifiedMemory, PinnedMemory
    };
    use cuda_rust_wasm::error::CudaError;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn test_device_memory_allocation() {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024 * 1024).unwrap();
        
        // Allocate memory for 1000 floats
        let memory: Result<DeviceMemory<f32>, _> = pool.allocate(1000);
        assert!(memory.is_ok());
        
        let mem = memory.unwrap();
        assert_eq!(mem.size(), 1000);
        assert_eq!(mem.size_bytes(), 1000 * std::mem::size_of::<f32>());
    }

    #[test]
    fn test_memory_pool_strategies() {
        let strategies = vec![
            AllocationStrategy::BestFit,
            AllocationStrategy::FirstFit,
            AllocationStrategy::BuddySystem,
        ];
        
        for strategy in strategies {
            let pool = MemoryPool::new(strategy, 1024 * 1024).unwrap();
            
            // Multiple allocations
            let allocs: Vec<_> = (0..10)
                .map(|i| pool.allocate::<f32>(100 * (i + 1)))
                .collect();
            
            // All should succeed
            assert!(allocs.iter().all(|a| a.is_ok()));
            
            // Get pool info
            let info = pool.get_info();
            assert!(info.used_bytes > 0);
            assert!(info.free_bytes < info.total_bytes);
        }
    }

    #[test]
    fn test_memory_deallocation() {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024 * 1024).unwrap();
        
        let initial_info = pool.get_info();
        
        {
            let _mem1: DeviceMemory<f32> = pool.allocate(1000).unwrap();
            let _mem2: DeviceMemory<f32> = pool.allocate(2000).unwrap();
            
            let allocated_info = pool.get_info();
            assert!(allocated_info.used_bytes > initial_info.used_bytes);
        }
        
        // Memory should be freed after going out of scope
        let final_info = pool.get_info();
        assert_eq!(final_info.used_bytes, initial_info.used_bytes);
    }

    #[test]
    fn test_memory_fragmentation() {
        let pool = MemoryPool::new(AllocationStrategy::FirstFit, 1024 * 1024).unwrap();
        
        // Create fragmentation pattern
        let mut allocs = Vec::new();
        
        // Allocate alternating sizes
        for i in 0..20 {
            let size = if i % 2 == 0 { 1000 } else { 100 };
            allocs.push(pool.allocate::<f32>(size).unwrap());
        }
        
        // Free every other allocation
        for i in (0..20).step_by(2) {
            allocs.remove(i / 2);
        }
        
        // Try to allocate a large block
        let large_alloc: Result<DeviceMemory<f32>, _> = pool.allocate(5000);
        
        // Should handle fragmentation (might fail with FirstFit)
        let info = pool.get_info();
        assert!(info.fragmentation_ratio < 0.5);
    }

    #[test]
    fn test_unified_memory() {
        let unified_mem = UnifiedMemory::<f32>::new(1000).unwrap();
        
        // Should be accessible from both host and device
        assert_eq!(unified_mem.size(), 1000);
        assert!(unified_mem.is_unified());
        
        // Test host access
        let host_ptr = unified_mem.as_host_ptr();
        assert!(!host_ptr.is_null());
        
        // Test device access
        let device_ptr = unified_mem.as_device_ptr();
        assert!(!device_ptr.is_null());
    }

    #[test]
    fn test_pinned_memory() {
        let pinned_mem = PinnedMemory::<f32>::new(1000).unwrap();
        
        // Pinned memory should be page-locked
        assert!(pinned_mem.is_pinned());
        assert_eq!(pinned_mem.size(), 1000);
        
        // Should support fast transfers
        assert!(pinned_mem.supports_async_transfer());
    }

    #[test]
    fn test_memory_copy() {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024 * 1024).unwrap();
        
        let src: DeviceMemory<f32> = pool.allocate(1000).unwrap();
        let dst: DeviceMemory<f32> = pool.allocate(1000).unwrap();
        
        // Test device-to-device copy
        let result = src.copy_to(&dst);
        assert!(result.is_ok());
    }

    #[test]
    fn test_memory_set() {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024 * 1024).unwrap();
        let mem: DeviceMemory<f32> = pool.allocate(1000).unwrap();
        
        // Set all elements to a value
        let result = mem.set(3.14);
        assert!(result.is_ok());
    }

    #[test]
    fn test_out_of_memory() {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024).unwrap(); // Small pool
        
        // Try to allocate more than available
        let result: Result<DeviceMemory<f32>, _> = pool.allocate(1000000);
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CudaError::OutOfMemory));
    }

    #[test]
    fn test_concurrent_allocation() {
        let pool = Arc::new(MemoryPool::new(AllocationStrategy::BuddySystem, 10 * 1024 * 1024).unwrap());
        
        let handles: Vec<_> = (0..10)
            .map(|i| {
                let pool_clone = Arc::clone(&pool);
                thread::spawn(move || {
                    let size = 1000 * (i + 1);
                    pool_clone.allocate::<f32>(size)
                })
            })
            .collect();
        
        let results: Vec<_> = handles.into_iter()
            .map(|h| h.join().unwrap())
            .collect();
        
        // All allocations should succeed
        assert!(results.iter().all(|r| r.is_ok()));
    }

    #[test]
    fn test_memory_alignment() {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024 * 1024).unwrap();
        
        // Test different alignment requirements
        let alignments = vec![1, 2, 4, 8, 16, 32, 64, 128, 256];
        
        for alignment in alignments {
            let mem: DeviceMemory<u8> = pool.allocate_aligned(1000, alignment).unwrap();
            
            // Check alignment
            let ptr = mem.as_ptr() as usize;
            assert_eq!(ptr % alignment, 0);
        }
    }

    #[test]
    fn test_memory_pool_compaction() {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024 * 1024).unwrap();
        
        // Create fragmentation
        let mut allocs = Vec::new();
        for i in 0..50 {
            allocs.push(pool.allocate::<f32>(100 * (i % 5 + 1)).unwrap());
        }
        
        // Free some allocations to create gaps
        for i in (0..50).step_by(3) {
            allocs.remove(i / 3);
        }
        
        let before_info = pool.get_info();
        
        // Compact the pool
        let result = pool.compact();
        assert!(result.is_ok());
        
        let after_info = pool.get_info();
        assert!(after_info.fragmentation_ratio <= before_info.fragmentation_ratio);
    }

    #[test]
    fn test_memory_prefetch() {
        let unified_mem = UnifiedMemory::<f32>::new(10000).unwrap();
        
        // Prefetch to device
        let result = unified_mem.prefetch_to_device(0);
        assert!(result.is_ok());
        
        // Prefetch to host
        let result = unified_mem.prefetch_to_host();
        assert!(result.is_ok());
    }

    #[test]
    fn test_memory_usage_tracking() {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024 * 1024).unwrap();
        
        let initial_info = pool.get_info();
        assert_eq!(initial_info.allocation_count, 0);
        
        let _mem1: DeviceMemory<f32> = pool.allocate(1000).unwrap();
        let _mem2: DeviceMemory<f32> = pool.allocate(2000).unwrap();
        
        let info = pool.get_info();
        assert_eq!(info.allocation_count, 2);
        assert_eq!(info.used_bytes, (1000 + 2000) * std::mem::size_of::<f32>());
        
        // Test high water mark
        assert!(info.peak_usage_bytes >= info.used_bytes);
    }

    #[test]
    fn test_memory_zero_copy() {
        // Test zero-copy memory mapping
        let pinned_mem = PinnedMemory::<f32>::new(1000).unwrap();
        
        // Map to device without copying
        let device_view = pinned_mem.map_to_device().unwrap();
        
        assert_eq!(device_view.size(), pinned_mem.size());
        assert!(device_view.is_zero_copy());
    }
}