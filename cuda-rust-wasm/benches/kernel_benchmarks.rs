//! Benchmarks for kernel execution performance

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use cuda_rust_wasm::{
    transpiler::{CudaTranspiler, TranspilerOptions, OptimizationLevel},
    runtime::{WasmRuntime, RuntimeOptions},
    kernel::{KernelLauncher, LaunchConfig},
    memory::{DeviceMemory, MemoryPool, AllocationStrategy},
};
use std::time::Duration;

fn benchmark_kernel_launch_overhead(c: &mut Criterion) {
    let mut group = c.benchmark_group("kernel_launch_overhead");
    
    // Simple kernel that does minimal work
    let cuda_code = r#"
        __global__ void empty_kernel() {
        }
    "#;
    
    let transpiler = CudaTranspiler::new(TranspilerOptions::default());
    let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
    let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
    let module = runtime.load_module(&wasm_bytes).unwrap();
    let launcher = KernelLauncher::new(module);
    
    let grid_sizes = vec![1, 10, 100, 1000];
    
    for &grid_size in &grid_sizes {
        group.bench_with_input(
            BenchmarkId::new("grid_size", grid_size),
            &grid_size,
            |b, &grid_size| {
                let config = LaunchConfig {
                    grid_size: (grid_size, 1, 1),
                    block_size: (256, 1, 1),
                    shared_mem_bytes: 0,
                };
                
                b.iter(|| {
                    launcher.launch("empty_kernel", config, &[]).unwrap();
                    runtime.synchronize().unwrap();
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_vector_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("vector_operations");
    
    let sizes = vec![1024, 16384, 262144, 1048576]; // 1K to 1M elements
    
    // Vector addition kernel
    let vector_add_code = r#"
        __global__ void vector_add(float* a, float* b, float* c, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                c[idx] = a[idx] + b[idx];
            }
        }
    "#;
    
    for &size in &sizes {
        group.throughput(Throughput::Elements(size as u64));
        
        group.bench_with_input(
            BenchmarkId::new("vector_add", size),
            &size,
            |b, &size| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                let wasm_bytes = transpiler.transpile(vector_add_code).unwrap();
                let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
                let module = runtime.load_module(&wasm_bytes).unwrap();
                let launcher = KernelLauncher::new(module);
                
                let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
                let data: Vec<f32> = (0..size).map(|i| i as f32).collect();
                
                let d_a = pool.allocate_and_copy(&data).unwrap();
                let d_b = pool.allocate_and_copy(&data).unwrap();
                let d_c: DeviceMemory<f32> = pool.allocate(size).unwrap();
                
                let config = LaunchConfig {
                    grid_size: ((size + 255) / 256, 1, 1),
                    block_size: (256, 1, 1),
                    shared_mem_bytes: 0,
                };
                
                b.iter(|| {
                    launcher.launch(
                        "vector_add",
                        config,
                        &[d_a.as_arg(), d_b.as_arg(), d_c.as_arg(), size.as_arg()],
                    ).unwrap();
                    runtime.synchronize().unwrap();
                });
            },
        );
    }
    
    // Elementwise operations
    let elementwise_code = r#"
        __global__ void elementwise_ops(float* data, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                float x = data[idx];
                x = __sinf(x) + __cosf(x);
                x = __sqrtf(x * x + 1.0f);
                x = __expf(x) / (1.0f + __expf(x));
                data[idx] = x;
            }
        }
    "#;
    
    for &size in &sizes {
        group.throughput(Throughput::Elements(size as u64));
        
        group.bench_with_input(
            BenchmarkId::new("elementwise_ops", size),
            &size,
            |b, &size| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                let wasm_bytes = transpiler.transpile(elementwise_code).unwrap();
                let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
                let module = runtime.load_module(&wasm_bytes).unwrap();
                let launcher = KernelLauncher::new(module);
                
                let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
                let data: Vec<f32> = (0..size).map(|i| (i as f32) / 1000.0).collect();
                let d_data = pool.allocate_and_copy(&data).unwrap();
                
                let config = LaunchConfig {
                    grid_size: ((size + 255) / 256, 1, 1),
                    block_size: (256, 1, 1),
                    shared_mem_bytes: 0,
                };
                
                b.iter(|| {
                    launcher.launch(
                        "elementwise_ops",
                        config,
                        &[d_data.as_arg(), size.as_arg()],
                    ).unwrap();
                    runtime.synchronize().unwrap();
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_matrix_multiply(c: &mut Criterion) {
    let mut group = c.benchmark_group("matrix_multiply");
    group.measurement_time(Duration::from_secs(10));
    
    let matrix_multiply_code = r#"
        #define TILE_SIZE 16
        
        __global__ void matrix_multiply(float* a, float* b, float* c, int m, int n, int k) {
            __shared__ float tile_a[TILE_SIZE][TILE_SIZE];
            __shared__ float tile_b[TILE_SIZE][TILE_SIZE];
            
            int row = blockIdx.y * TILE_SIZE + threadIdx.y;
            int col = blockIdx.x * TILE_SIZE + threadIdx.x;
            
            float sum = 0.0f;
            
            for (int t = 0; t < (k + TILE_SIZE - 1) / TILE_SIZE; t++) {
                if (row < m && t * TILE_SIZE + threadIdx.x < k) {
                    tile_a[threadIdx.y][threadIdx.x] = a[row * k + t * TILE_SIZE + threadIdx.x];
                } else {
                    tile_a[threadIdx.y][threadIdx.x] = 0.0f;
                }
                
                if (col < n && t * TILE_SIZE + threadIdx.y < k) {
                    tile_b[threadIdx.y][threadIdx.x] = b[(t * TILE_SIZE + threadIdx.y) * n + col];
                } else {
                    tile_b[threadIdx.y][threadIdx.x] = 0.0f;
                }
                
                __syncthreads();
                
                for (int i = 0; i < TILE_SIZE; i++) {
                    sum += tile_a[threadIdx.y][i] * tile_b[i][threadIdx.x];
                }
                
                __syncthreads();
            }
            
            if (row < m && col < n) {
                c[row * n + col] = sum;
            }
        }
    "#;
    
    let matrix_sizes = vec![64, 128, 256, 512];
    
    for &size in &matrix_sizes {
        group.throughput(Throughput::Elements((size * size) as u64));
        
        group.bench_with_input(
            BenchmarkId::new("tiled", size),
            &size,
            |b, &size| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                let wasm_bytes = transpiler.transpile(matrix_multiply_code).unwrap();
                let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
                let module = runtime.load_module(&wasm_bytes).unwrap();
                let launcher = KernelLauncher::new(module);
                
                let pool = MemoryPool::new(AllocationStrategy::BestFit, 500 * 1024 * 1024).unwrap();
                
                let a: Vec<f32> = (0..size*size).map(|i| (i % 10) as f32).collect();
                let b: Vec<f32> = (0..size*size).map(|i| (i % 10) as f32).collect();
                
                let d_a = pool.allocate_and_copy(&a).unwrap();
                let d_b = pool.allocate_and_copy(&b).unwrap();
                let d_c: DeviceMemory<f32> = pool.allocate(size * size).unwrap();
                
                let config = LaunchConfig {
                    grid_size: ((size + 15) / 16, (size + 15) / 16, 1),
                    block_size: (16, 16, 1),
                    shared_mem_bytes: 2 * 16 * 16 * std::mem::size_of::<f32>(),
                };
                
                b.iter(|| {
                    launcher.launch(
                        "matrix_multiply",
                        config,
                        &[d_a.as_arg(), d_b.as_arg(), d_c.as_arg(), 
                          size.as_arg(), size.as_arg(), size.as_arg()],
                    ).unwrap();
                    runtime.synchronize().unwrap();
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_reduction(c: &mut Criterion) {
    let mut group = c.benchmark_group("reduction");
    
    let reduction_code = r#"
        __global__ void reduction_sum(float* input, float* output, int n) {
            extern __shared__ float sdata[];
            
            unsigned int tid = threadIdx.x;
            unsigned int idx = blockIdx.x * blockDim.x * 2 + threadIdx.x;
            
            // Load and add during load for better performance
            float sum = 0.0f;
            if (idx < n) sum += input[idx];
            if (idx + blockDim.x < n) sum += input[idx + blockDim.x];
            
            sdata[tid] = sum;
            __syncthreads();
            
            // Unrolled reduction
            if (blockDim.x >= 512) {
                if (tid < 256) sdata[tid] += sdata[tid + 256];
                __syncthreads();
            }
            if (blockDim.x >= 256) {
                if (tid < 128) sdata[tid] += sdata[tid + 128];
                __syncthreads();
            }
            if (blockDim.x >= 128) {
                if (tid < 64) sdata[tid] += sdata[tid + 64];
                __syncthreads();
            }
            
            // Warp reduction
            if (tid < 32) {
                volatile float* smem = sdata;
                if (blockDim.x >= 64) smem[tid] += smem[tid + 32];
                if (blockDim.x >= 32) smem[tid] += smem[tid + 16];
                if (blockDim.x >= 16) smem[tid] += smem[tid + 8];
                if (blockDim.x >= 8) smem[tid] += smem[tid + 4];
                if (blockDim.x >= 4) smem[tid] += smem[tid + 2];
                if (blockDim.x >= 2) smem[tid] += smem[tid + 1];
            }
            
            if (tid == 0) output[blockIdx.x] = sdata[0];
        }
    "#;
    
    let sizes = vec![1024, 16384, 262144, 1048576];
    
    for &size in &sizes {
        group.throughput(Throughput::Elements(size as u64));
        
        group.bench_with_input(
            BenchmarkId::new("sum", size),
            &size,
            |b, &size| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                let wasm_bytes = transpiler.transpile(reduction_code).unwrap();
                let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
                let module = runtime.load_module(&wasm_bytes).unwrap();
                let launcher = KernelLauncher::new(module);
                
                let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
                let data: Vec<f32> = (0..size).map(|_| 1.0).collect();
                
                let block_size = 256;
                let grid_size = (size + block_size * 2 - 1) / (block_size * 2);
                
                let d_input = pool.allocate_and_copy(&data).unwrap();
                let d_output: DeviceMemory<f32> = pool.allocate(grid_size).unwrap();
                
                let config = LaunchConfig {
                    grid_size: (grid_size as u32, 1, 1),
                    block_size: (block_size as u32, 1, 1),
                    shared_mem_bytes: block_size * std::mem::size_of::<f32>(),
                };
                
                b.iter(|| {
                    launcher.launch(
                        "reduction_sum",
                        config,
                        &[d_input.as_arg(), d_output.as_arg(), size.as_arg()],
                    ).unwrap();
                    runtime.synchronize().unwrap();
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_optimization_levels(c: &mut Criterion) {
    let mut group = c.benchmark_group("optimization_levels");
    
    let compute_intensive_code = r#"
        __global__ void compute_intensive(float* data, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                float x = data[idx];
                
                // Many operations to test optimization impact
                for (int i = 0; i < 10; i++) {
                    x = __sinf(x) * __cosf(x);
                    x = __sqrtf(x * x + 1.0f);
                    x = __expf(x) / (1.0f + __expf(x));
                    x = __logf(1.0f + __fabsf(x));
                    x = __powf(x, 0.5f) + __powf(x, 2.0f);
                }
                
                data[idx] = x;
            }
        }
    "#;
    
    let optimization_levels = vec![
        ("None", OptimizationLevel::None),
        ("Basic", OptimizationLevel::Basic),
        ("Aggressive", OptimizationLevel::Aggressive),
    ];
    
    let size = 100000;
    
    for (name, level) in optimization_levels {
        group.bench_with_input(
            BenchmarkId::new("level", name),
            &level,
            |b, &level| {
                let options = TranspilerOptions {
                    optimization_level: level,
                    ..Default::default()
                };
                
                let transpiler = CudaTranspiler::new(options);
                let wasm_bytes = transpiler.transpile(compute_intensive_code).unwrap();
                let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
                let module = runtime.load_module(&wasm_bytes).unwrap();
                let launcher = KernelLauncher::new(module);
                
                let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
                let data: Vec<f32> = (0..size).map(|i| (i as f32) / 1000.0).collect();
                let d_data = pool.allocate_and_copy(&data).unwrap();
                
                let config = LaunchConfig {
                    grid_size: ((size + 255) / 256, 1, 1),
                    block_size: (256, 1, 1),
                    shared_mem_bytes: 0,
                };
                
                b.iter(|| {
                    launcher.launch(
                        "compute_intensive",
                        config,
                        &[d_data.as_arg(), size.as_arg()],
                    ).unwrap();
                    runtime.synchronize().unwrap();
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_atomic_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("atomic_operations");
    
    let atomic_histogram_code = r#"
        __global__ void atomic_histogram(int* data, int* hist, int n, int nbins) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                int bin = data[idx] % nbins;
                atomicAdd(&hist[bin], 1);
            }
        }
    "#;
    
    let sizes = vec![10000, 100000, 1000000];
    let nbins = 256;
    
    for &size in &sizes {
        group.throughput(Throughput::Elements(size as u64));
        
        group.bench_with_input(
            BenchmarkId::new("histogram", size),
            &size,
            |b, &size| {
                let options = TranspilerOptions {
                    enable_atomics: true,
                    ..Default::default()
                };
                
                let transpiler = CudaTranspiler::new(options);
                let wasm_bytes = transpiler.transpile(atomic_histogram_code).unwrap();
                let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
                let module = runtime.load_module(&wasm_bytes).unwrap();
                let launcher = KernelLauncher::new(module);
                
                let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
                
                let data: Vec<i32> = (0..size).map(|i| i as i32).collect();
                let hist = vec![0i32; nbins];
                
                let d_data = pool.allocate_and_copy(&data).unwrap();
                let d_hist = pool.allocate_and_copy(&hist).unwrap();
                
                let config = LaunchConfig {
                    grid_size: ((size + 255) / 256, 1, 1),
                    block_size: (256, 1, 1),
                    shared_mem_bytes: 0,
                };
                
                b.iter(|| {
                    // Clear histogram
                    d_hist.set(0).unwrap();
                    
                    launcher.launch(
                        "atomic_histogram",
                        config,
                        &[d_data.as_arg(), d_hist.as_arg(), size.as_arg(), nbins.as_arg()],
                    ).unwrap();
                    runtime.synchronize().unwrap();
                });
            },
        );
    }
    
    group.finish();
}

criterion_group!(
    benches,
    benchmark_kernel_launch_overhead,
    benchmark_vector_operations,
    benchmark_matrix_multiply,
    benchmark_reduction,
    benchmark_optimization_levels,
    benchmark_atomic_operations
);
criterion_main!(benches);