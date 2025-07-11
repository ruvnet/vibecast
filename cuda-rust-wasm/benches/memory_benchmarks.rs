//! Benchmarks for memory allocation and management

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use cuda_rust_wasm::memory::{
    DeviceMemory, MemoryPool, AllocationStrategy, UnifiedMemory, PinnedMemory
};
use std::time::Duration;

fn benchmark_allocation_strategies(c: &mut Criterion) {
    let mut group = c.benchmark_group("allocation_strategies");
    
    let strategies = vec![
        ("BestFit", AllocationStrategy::BestFit),
        ("FirstFit", AllocationStrategy::FirstFit),
        ("BuddySystem", AllocationStrategy::BuddySystem),
    ];
    
    let sizes = vec![1024, 4096, 16384, 65536, 262144]; // 1KB to 256KB
    
    for (name, strategy) in strategies {
        for &size in &sizes {
            group.throughput(Throughput::Bytes(size as u64));
            group.bench_with_input(
                BenchmarkId::new(name, size),
                &size,
                |b, &size| {
                    let pool = MemoryPool::new(strategy.clone(), 100 * 1024 * 1024).unwrap();
                    b.iter(|| {
                        let mem: DeviceMemory<u8> = pool.allocate(black_box(size)).unwrap();
                        black_box(mem);
                    });
                },
            );
        }
    }
    
    group.finish();
}

fn benchmark_memory_types(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_types");
    
    let sizes = vec![1024, 16384, 262144, 1048576]; // 1KB to 1MB
    
    for &size in &sizes {
        group.throughput(Throughput::Bytes(size as u64 * 4)); // f32 = 4 bytes
        
        // Device memory allocation
        group.bench_with_input(
            BenchmarkId::new("DeviceMemory", size),
            &size,
            |b, &size| {
                let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
                b.iter(|| {
                    let mem: DeviceMemory<f32> = pool.allocate(black_box(size)).unwrap();
                    black_box(mem);
                });
            },
        );
        
        // Unified memory allocation
        group.bench_with_input(
            BenchmarkId::new("UnifiedMemory", size),
            &size,
            |b, &size| {
                b.iter(|| {
                    let mem = UnifiedMemory::<f32>::new(black_box(size)).unwrap();
                    black_box(mem);
                });
            },
        );
        
        // Pinned memory allocation
        group.bench_with_input(
            BenchmarkId::new("PinnedMemory", size),
            &size,
            |b, &size| {
                b.iter(|| {
                    let mem = PinnedMemory::<f32>::new(black_box(size)).unwrap();
                    black_box(mem);
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_memory_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_operations");
    
    let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
    let sizes = vec![1024, 16384, 262144, 1048576]; // 1KB to 1MB
    
    for &size in &sizes {
        let data: Vec<f32> = (0..size).map(|i| i as f32).collect();
        
        group.throughput(Throughput::Bytes(size as u64 * 4));
        
        // Host to device copy
        group.bench_with_input(
            BenchmarkId::new("host_to_device", size),
            &size,
            |b, &size| {
                let d_mem: DeviceMemory<f32> = pool.allocate(size).unwrap();
                b.iter(|| {
                    d_mem.copy_from_host(black_box(&data)).unwrap();
                });
            },
        );
        
        // Device to host copy
        group.bench_with_input(
            BenchmarkId::new("device_to_host", size),
            &size,
            |b, &size| {
                let d_mem: DeviceMemory<f32> = pool.allocate(size).unwrap();
                d_mem.copy_from_host(&data).unwrap();
                let mut host_buffer = vec![0.0f32; size];
                
                b.iter(|| {
                    d_mem.copy_to_host(black_box(&mut host_buffer)).unwrap();
                });
            },
        );
        
        // Device to device copy
        group.bench_with_input(
            BenchmarkId::new("device_to_device", size),
            &size,
            |b, &size| {
                let d_src: DeviceMemory<f32> = pool.allocate(size).unwrap();
                let d_dst: DeviceMemory<f32> = pool.allocate(size).unwrap();
                d_src.copy_from_host(&data).unwrap();
                
                b.iter(|| {
                    d_src.copy_to(black_box(&d_dst)).unwrap();
                });
            },
        );
        
        // Memory set
        group.bench_with_input(
            BenchmarkId::new("memset", size),
            &size,
            |b, &size| {
                let d_mem: DeviceMemory<f32> = pool.allocate(size).unwrap();
                
                b.iter(|| {
                    d_mem.set(black_box(0.0)).unwrap();
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_concurrent_allocation(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_allocation");
    group.measurement_time(Duration::from_secs(10));
    
    let thread_counts = vec![1, 2, 4, 8, 16];
    let allocation_size = 16384; // 16KB per allocation
    
    for &num_threads in &thread_counts {
        group.bench_with_input(
            BenchmarkId::new("threads", num_threads),
            &num_threads,
            |b, &num_threads| {
                use std::sync::{Arc, Barrier};
                use std::thread;
                
                b.iter(|| {
                    let pool = Arc::new(
                        MemoryPool::new(AllocationStrategy::BuddySystem, 1024 * 1024 * 1024).unwrap()
                    );
                    let barrier = Arc::new(Barrier::new(num_threads));
                    
                    let handles: Vec<_> = (0..num_threads)
                        .map(|_| {
                            let pool = Arc::clone(&pool);
                            let barrier = Arc::clone(&barrier);
                            
                            thread::spawn(move || {
                                barrier.wait();
                                
                                for _ in 0..100 {
                                    let mem: DeviceMemory<f32> = pool.allocate(allocation_size).unwrap();
                                    black_box(mem);
                                }
                            })
                        })
                        .collect();
                    
                    for handle in handles {
                        handle.join().unwrap();
                    }
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_fragmentation_impact(c: &mut Criterion) {
    let mut group = c.benchmark_group("fragmentation_impact");
    
    group.bench_function("no_fragmentation", |b| {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
        
        b.iter(|| {
            // Allocate and free in order
            let mut allocations = Vec::new();
            for i in 0..100 {
                let size = 1024 * (i % 10 + 1);
                let mem: DeviceMemory<u8> = pool.allocate(size).unwrap();
                allocations.push(mem);
            }
            black_box(allocations);
        });
    });
    
    group.bench_function("high_fragmentation", |b| {
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
        
        // Create fragmentation
        let mut persistent = Vec::new();
        for i in 0..50 {
            let mem1: DeviceMemory<u8> = pool.allocate(1024).unwrap();
            let mem2: DeviceMemory<u8> = pool.allocate(1024).unwrap();
            if i % 2 == 0 {
                persistent.push(mem1);
            }
            // mem2 is freed, creating gaps
        }
        
        b.iter(|| {
            // Try to allocate in fragmented pool
            let mut allocations = Vec::new();
            for _ in 0..50 {
                if let Ok(mem) = pool.allocate::<u8>(2048) {
                    allocations.push(mem);
                }
            }
            black_box(allocations);
        });
    });
    
    group.finish();
}

fn benchmark_memory_pool_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_pool_scaling");
    
    let pool_sizes = vec![
        1024 * 1024,           // 1MB
        10 * 1024 * 1024,      // 10MB
        100 * 1024 * 1024,     // 100MB
        1024 * 1024 * 1024,    // 1GB
    ];
    
    for &pool_size in &pool_sizes {
        group.bench_with_input(
            BenchmarkId::new("pool_size", pool_size / (1024 * 1024)),
            &pool_size,
            |b, &pool_size| {
                let pool = MemoryPool::new(AllocationStrategy::BuddySystem, pool_size).unwrap();
                
                b.iter(|| {
                    // Allocate 1% of pool size
                    let allocation_size = pool_size / 100;
                    let mem: DeviceMemory<u8> = pool.allocate(allocation_size).unwrap();
                    black_box(mem);
                });
            },
        );
    }
    
    group.finish();
}

criterion_group!(
    benches,
    benchmark_allocation_strategies,
    benchmark_memory_types,
    benchmark_memory_operations,
    benchmark_concurrent_allocation,
    benchmark_fragmentation_impact,
    benchmark_memory_pool_scaling
);
criterion_main!(benches);