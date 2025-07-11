//! Benchmarks comparing WASM performance vs native CUDA (simulated)

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, PlotConfiguration};
use cuda_rust_wasm::{
    transpiler::{CudaTranspiler, TranspilerOptions},
    runtime::{WasmRuntime, RuntimeOptions},
    kernel::{KernelLauncher, LaunchConfig},
    memory::{DeviceMemory, MemoryPool, AllocationStrategy},
};
use std::time::{Duration, Instant};

// Simulate native CUDA performance (in real deployment, this would call actual CUDA)
fn simulate_native_cuda_performance(operation: &str, size: usize) -> Duration {
    // These are rough estimates based on typical CUDA performance
    // In production, replace with actual CUDA API calls
    match operation {
        "vector_add" => Duration::from_micros((size as u64) / 1000), // ~1B elements/sec
        "matrix_multiply" => Duration::from_micros(((size * size) as u64) / 100), // O(n^3) complexity
        "reduction" => Duration::from_micros((size as u64) / 500), // ~500M elements/sec
        "elementwise_math" => Duration::from_micros((size as u64) / 200), // ~200M elements/sec
        _ => Duration::from_millis(1),
    }
}

fn benchmark_vector_add_comparison(c: &mut Criterion) {
    let mut group = c.benchmark_group("wasm_vs_native_vector_add");
    group.plot_config(PlotConfiguration::default()
        .summary_scale(criterion::AxisScale::Logarithmic));
    
    let cuda_code = r#"
        __global__ void vector_add(float* a, float* b, float* c, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                c[idx] = a[idx] + b[idx];
            }
        }
    "#;
    
    let sizes = vec![1000, 10000, 100000, 1000000];
    
    for &size in &sizes {
        // Native performance (simulated)
        group.bench_with_input(
            BenchmarkId::new("native", size),
            &size,
            |b, &size| {
                b.iter_custom(|iters| {
                    let mut total = Duration::ZERO;
                    for _ in 0..iters {
                        total += simulate_native_cuda_performance("vector_add", size);
                    }
                    total
                });
            },
        );
        
        // WASM performance
        group.bench_with_input(
            BenchmarkId::new("wasm", size),
            &size,
            |b, &size| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
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
    
    group.finish();
}

fn benchmark_matrix_multiply_comparison(c: &mut Criterion) {
    let mut group = c.benchmark_group("wasm_vs_native_matrix_multiply");
    
    let cuda_code = r#"
        #define TILE_SIZE 16
        
        __global__ void matrix_multiply(float* a, float* b, float* c, int size) {
            __shared__ float tile_a[TILE_SIZE][TILE_SIZE];
            __shared__ float tile_b[TILE_SIZE][TILE_SIZE];
            
            int row = blockIdx.y * TILE_SIZE + threadIdx.y;
            int col = blockIdx.x * TILE_SIZE + threadIdx.x;
            
            float sum = 0.0f;
            
            for (int t = 0; t < (size + TILE_SIZE - 1) / TILE_SIZE; t++) {
                if (row < size && t * TILE_SIZE + threadIdx.x < size) {
                    tile_a[threadIdx.y][threadIdx.x] = a[row * size + t * TILE_SIZE + threadIdx.x];
                } else {
                    tile_a[threadIdx.y][threadIdx.x] = 0.0f;
                }
                
                if (col < size && t * TILE_SIZE + threadIdx.y < size) {
                    tile_b[threadIdx.y][threadIdx.x] = b[(t * TILE_SIZE + threadIdx.y) * size + col];
                } else {
                    tile_b[threadIdx.y][threadIdx.x] = 0.0f;
                }
                
                __syncthreads();
                
                for (int i = 0; i < TILE_SIZE; i++) {
                    sum += tile_a[threadIdx.y][i] * tile_b[i][threadIdx.x];
                }
                
                __syncthreads();
            }
            
            if (row < size && col < size) {
                c[row * size + col] = sum;
            }
        }
    "#;
    
    let matrix_sizes = vec![64, 128, 256];
    
    for &size in &matrix_sizes {
        // Native performance (simulated)
        group.bench_with_input(
            BenchmarkId::new("native", size),
            &size,
            |b, &size| {
                b.iter_custom(|iters| {
                    let mut total = Duration::ZERO;
                    for _ in 0..iters {
                        total += simulate_native_cuda_performance("matrix_multiply", size);
                    }
                    total
                });
            },
        );
        
        // WASM performance
        group.bench_with_input(
            BenchmarkId::new("wasm", size),
            &size,
            |b, &size| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
                let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
                let module = runtime.load_module(&wasm_bytes).unwrap();
                let launcher = KernelLauncher::new(module);
                
                let pool = MemoryPool::new(AllocationStrategy::BestFit, 100 * 1024 * 1024).unwrap();
                
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
                        &[d_a.as_arg(), d_b.as_arg(), d_c.as_arg(), size.as_arg()],
                    ).unwrap();
                    runtime.synchronize().unwrap();
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_reduction_comparison(c: &mut Criterion) {
    let mut group = c.benchmark_group("wasm_vs_native_reduction");
    
    let cuda_code = r#"
        __global__ void reduction_sum(float* input, float* output, int n) {
            extern __shared__ float sdata[];
            
            unsigned int tid = threadIdx.x;
            unsigned int idx = blockIdx.x * blockDim.x * 2 + threadIdx.x;
            
            float sum = 0.0f;
            if (idx < n) sum += input[idx];
            if (idx + blockDim.x < n) sum += input[idx + blockDim.x];
            
            sdata[tid] = sum;
            __syncthreads();
            
            for (unsigned int s = blockDim.x / 2; s > 32; s >>= 1) {
                if (tid < s) {
                    sdata[tid] += sdata[tid + s];
                }
                __syncthreads();
            }
            
            if (tid < 32) {
                volatile float* smem = sdata;
                if (blockDim.x >= 64) smem[tid] += smem[tid + 32];
                if (blockDim.x >= 32) smem[tid] += smem[tid + 16];
                smem[tid] += smem[tid + 8];
                smem[tid] += smem[tid + 4];
                smem[tid] += smem[tid + 2];
                smem[tid] += smem[tid + 1];
            }
            
            if (tid == 0) output[blockIdx.x] = sdata[0];
        }
    "#;
    
    let sizes = vec![10000, 100000, 1000000];
    
    for &size in &sizes {
        // Native performance (simulated)
        group.bench_with_input(
            BenchmarkId::new("native", size),
            &size,
            |b, &size| {
                b.iter_custom(|iters| {
                    let mut total = Duration::ZERO;
                    for _ in 0..iters {
                        total += simulate_native_cuda_performance("reduction", size);
                    }
                    total
                });
            },
        );
        
        // WASM performance
        group.bench_with_input(
            BenchmarkId::new("wasm", size),
            &size,
            |b, &size| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
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

fn benchmark_performance_target_analysis(c: &mut Criterion) {
    let mut group = c.benchmark_group("performance_target_70_percent");
    
    // Complex kernel that tests various features
    let test_kernel = r#"
        __global__ void performance_test(float* data, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                float x = data[idx];
                
                // Arithmetic operations
                x = x * 2.0f + 1.0f;
                x = x / (1.0f + x);
                
                // Math intrinsics
                x = __sinf(x) + __cosf(x);
                x = __sqrtf(x * x + 1.0f);
                x = __expf(x) / (1.0f + __expf(x));
                
                // Memory access pattern
                if (idx > 0 && idx < n - 1) {
                    x += data[idx - 1] * 0.25f;
                    x += data[idx + 1] * 0.25f;
                }
                
                data[idx] = x;
            }
        }
    "#;
    
    let test_sizes = vec![10000, 100000, 1000000];
    
    println!("\n=== Performance Target Analysis (70% of Native) ===");
    
    for &size in &test_sizes {
        let native_time = simulate_native_cuda_performance("elementwise_math", size);
        
        // Measure WASM performance
        let transpiler = CudaTranspiler::new(TranspilerOptions {
            optimization_level: cuda_rust_wasm::transpiler::OptimizationLevel::Aggressive,
            ..Default::default()
        });
        let wasm_bytes = transpiler.transpile(test_kernel).unwrap();
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
        
        // Measure WASM execution time
        let start = Instant::now();
        launcher.launch(
            "performance_test",
            config,
            &[d_data.as_arg(), size.as_arg()],
        ).unwrap();
        runtime.synchronize().unwrap();
        let wasm_time = start.elapsed();
        
        let performance_ratio = wasm_time.as_nanos() as f64 / native_time.as_nanos() as f64;
        let performance_percentage = 100.0 / performance_ratio;
        let meets_target = performance_percentage >= 70.0;
        
        println!("\nSize: {} elements", size);
        println!("Native (simulated): {:?}", native_time);
        println!("WASM: {:?}", wasm_time);
        println!("Performance: {:.1}% of native", performance_percentage);
        println!("Meets 70% target: {}", if meets_target { "✓ YES" } else { "✗ NO" });
        
        group.bench_with_input(
            BenchmarkId::new("size", size),
            &size,
            |b, &size| {
                b.iter(|| {
                    launcher.launch(
                        "performance_test",
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

fn benchmark_optimization_impact_on_ratio(c: &mut Criterion) {
    let mut group = c.benchmark_group("optimization_impact_ratio");
    
    let test_kernel = r#"
        __global__ void optimization_test(float* data, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                float x = data[idx];
                
                #pragma unroll 8
                for (int i = 0; i < 8; i++) {
                    x = fmaf(x, 1.01f, 0.01f);
                    x = __fdividef(x, 1.0f + x * 0.01f);
                }
                
                data[idx] = x;
            }
        }
    "#;
    
    let optimization_configs = vec![
        ("no_opt", cuda_rust_wasm::transpiler::OptimizationLevel::None),
        ("basic_opt", cuda_rust_wasm::transpiler::OptimizationLevel::Basic),
        ("aggressive_opt", cuda_rust_wasm::transpiler::OptimizationLevel::Aggressive),
    ];
    
    let size = 1000000;
    
    for (name, opt_level) in optimization_configs {
        group.bench_with_input(
            BenchmarkId::new("optimization", name),
            &opt_level,
            |b, &opt_level| {
                let options = TranspilerOptions {
                    optimization_level: opt_level,
                    ..Default::default()
                };
                
                let transpiler = CudaTranspiler::new(options);
                let wasm_bytes = transpiler.transpile(test_kernel).unwrap();
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
                        "optimization_test",
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

criterion_group!(
    benches,
    benchmark_vector_add_comparison,
    benchmark_matrix_multiply_comparison,
    benchmark_reduction_comparison,
    benchmark_performance_target_analysis,
    benchmark_optimization_impact_on_ratio
);
criterion_main!(benches);