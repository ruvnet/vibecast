//! Benchmarks for CUDA to WASM transpilation performance

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use cuda_rust_wasm::transpiler::{CudaTranspiler, TranspilerOptions, OptimizationLevel};

fn benchmark_transpile_simple_kernels(c: &mut Criterion) {
    let mut group = c.benchmark_group("transpile_simple");
    
    let kernels = vec![
        ("empty", r#"
            __global__ void empty_kernel() {
            }
        "#),
        ("simple_compute", r#"
            __global__ void simple_compute(float* data, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    data[idx] = data[idx] * 2.0f + 1.0f;
                }
            }
        "#),
        ("with_shared_memory", r#"
            __global__ void with_shared_memory(float* data, int n) {
                extern __shared__ float sdata[];
                int tid = threadIdx.x;
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                
                if (idx < n) {
                    sdata[tid] = data[idx];
                    __syncthreads();
                    data[idx] = sdata[tid] * 2.0f;
                }
            }
        "#),
        ("with_atomics", r#"
            __global__ void with_atomics(int* counter, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    atomicAdd(counter, 1);
                }
            }
        "#),
    ];
    
    for (name, code) in kernels {
        group.bench_with_input(
            BenchmarkId::new("kernel", name),
            code,
            |b, code| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                b.iter(|| {
                    let result = transpiler.transpile(black_box(code));
                    black_box(result.unwrap());
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_transpile_complex_kernels(c: &mut Criterion) {
    let mut group = c.benchmark_group("transpile_complex");
    
    let complex_kernels = vec![
        ("matrix_multiply", r#"
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
        "#),
        ("convolution", r#"
            #define FILTER_SIZE 5
            #define TILE_SIZE 16
            #define APRON_SIZE 2
            
            __constant__ float filter[FILTER_SIZE][FILTER_SIZE];
            
            __global__ void convolution(float* input, float* output, int width, int height) {
                __shared__ float tile[TILE_SIZE + 2 * APRON_SIZE][TILE_SIZE + 2 * APRON_SIZE];
                
                int x = blockIdx.x * TILE_SIZE + threadIdx.x;
                int y = blockIdx.y * TILE_SIZE + threadIdx.y;
                
                // Load tile with apron
                int tile_x = threadIdx.x + APRON_SIZE;
                int tile_y = threadIdx.y + APRON_SIZE;
                
                if (x < width && y < height) {
                    tile[tile_y][tile_x] = input[y * width + x];
                }
                
                // Load apron regions
                if (threadIdx.x < APRON_SIZE) {
                    if (x >= APRON_SIZE) {
                        tile[tile_y][threadIdx.x] = input[y * width + (x - APRON_SIZE)];
                    }
                    if (x + TILE_SIZE < width) {
                        tile[tile_y][tile_x + TILE_SIZE] = input[y * width + (x + TILE_SIZE)];
                    }
                }
                
                if (threadIdx.y < APRON_SIZE) {
                    if (y >= APRON_SIZE) {
                        tile[threadIdx.y][tile_x] = input[(y - APRON_SIZE) * width + x];
                    }
                    if (y + TILE_SIZE < height) {
                        tile[tile_y + TILE_SIZE][tile_x] = input[(y + TILE_SIZE) * width + x];
                    }
                }
                
                __syncthreads();
                
                // Apply convolution
                if (x < width && y < height) {
                    float sum = 0.0f;
                    
                    for (int fy = 0; fy < FILTER_SIZE; fy++) {
                        for (int fx = 0; fx < FILTER_SIZE; fx++) {
                            int ty = tile_y + fy - FILTER_SIZE / 2;
                            int tx = tile_x + fx - FILTER_SIZE / 2;
                            
                            if (ty >= 0 && ty < TILE_SIZE + 2 * APRON_SIZE &&
                                tx >= 0 && tx < TILE_SIZE + 2 * APRON_SIZE) {
                                sum += tile[ty][tx] * filter[fy][fx];
                            }
                        }
                    }
                    
                    output[y * width + x] = sum;
                }
            }
        "#),
        ("reduction_optimized", r#"
            template <unsigned int blockSize>
            __global__ void reduction_optimized(float* input, float* output, int n) {
                extern __shared__ float sdata[];
                
                unsigned int tid = threadIdx.x;
                unsigned int idx = blockIdx.x * blockSize * 2 + threadIdx.x;
                unsigned int gridSize = blockSize * 2 * gridDim.x;
                
                float sum = 0.0f;
                
                // Grid stride loop for large arrays
                while (idx < n) {
                    sum += input[idx];
                    if (idx + blockSize < n) {
                        sum += input[idx + blockSize];
                    }
                    idx += gridSize;
                }
                
                sdata[tid] = sum;
                __syncthreads();
                
                // Unrolled reduction
                if (blockSize >= 512) {
                    if (tid < 256) sdata[tid] += sdata[tid + 256];
                    __syncthreads();
                }
                if (blockSize >= 256) {
                    if (tid < 128) sdata[tid] += sdata[tid + 128];
                    __syncthreads();
                }
                if (blockSize >= 128) {
                    if (tid < 64) sdata[tid] += sdata[tid + 64];
                    __syncthreads();
                }
                
                // Warp reduction
                if (tid < 32) {
                    volatile float* smem = sdata;
                    if (blockSize >= 64) smem[tid] += smem[tid + 32];
                    if (blockSize >= 32) smem[tid] += smem[tid + 16];
                    if (blockSize >= 16) smem[tid] += smem[tid + 8];
                    if (blockSize >= 8) smem[tid] += smem[tid + 4];
                    if (blockSize >= 4) smem[tid] += smem[tid + 2];
                    if (blockSize >= 2) smem[tid] += smem[tid + 1];
                }
                
                if (tid == 0) output[blockIdx.x] = sdata[0];
            }
        "#),
    ];
    
    for (name, code) in complex_kernels {
        group.bench_with_input(
            BenchmarkId::new("kernel", name),
            code,
            |b, code| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                b.iter(|| {
                    let result = transpiler.transpile(black_box(code));
                    black_box(result.unwrap());
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_transpile_optimization_impact(c: &mut Criterion) {
    let mut group = c.benchmark_group("transpile_optimization");
    
    let test_kernel = r#"
        __global__ void compute_intensive(float* data, int n) {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < n) {
                float x = data[idx];
                
                // Many operations for optimization testing
                for (int i = 0; i < 100; i++) {
                    x = __sinf(x) * __cosf(x);
                    x = __sqrtf(x * x + 1.0f);
                    x = __expf(x) / (1.0f + __expf(x));
                    x = __logf(1.0f + __fabsf(x));
                    x = __powf(x, 0.5f) + __powf(x, 2.0f);
                    x = fmaf(x, 2.0f, 1.0f);
                    x = __fdividef(x, 1.0f + x);
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
                b.iter(|| {
                    let result = transpiler.transpile(black_box(test_kernel));
                    black_box(result.unwrap());
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_transpile_feature_combinations(c: &mut Criterion) {
    let mut group = c.benchmark_group("transpile_features");
    
    let feature_kernel = r#"
        __constant__ float constants[256];
        texture<float, 2> tex2D;
        
        __global__ void feature_kernel(float* data, int* counters, int n) {
            extern __shared__ float sdata[];
            
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            int tid = threadIdx.x;
            
            if (idx < n) {
                // Shared memory usage
                sdata[tid] = data[idx];
                __syncthreads();
                
                // Texture memory access
                float tex_val = tex2D(idx % 32, idx / 32);
                
                // Constant memory access
                float const_val = constants[tid % 256];
                
                // Atomic operation
                atomicAdd(&counters[idx % 10], 1);
                
                // Warp primitive
                float warp_sum = __shfl_down_sync(0xffffffff, sdata[tid], 1);
                
                // Math intrinsics
                float result = __fmaf_rn(tex_val, const_val, warp_sum);
                result = __sinf(result) + __cosf(result);
                
                data[idx] = result;
            }
        }
    "#;
    
    let feature_combinations = vec![
        ("default", TranspilerOptions::default()),
        ("all_features", TranspilerOptions {
            enable_atomics: true,
            enable_texture_memory: true,
            enable_warp_primitives: true,
            include_debug_info: false,
            optimization_level: OptimizationLevel::Basic,
            enable_validation: false,
        }),
        ("with_validation", TranspilerOptions {
            enable_atomics: true,
            enable_texture_memory: true,
            enable_warp_primitives: true,
            include_debug_info: false,
            optimization_level: OptimizationLevel::Basic,
            enable_validation: true,
        }),
        ("with_debug", TranspilerOptions {
            enable_atomics: true,
            enable_texture_memory: true,
            enable_warp_primitives: true,
            include_debug_info: true,
            optimization_level: OptimizationLevel::Basic,
            enable_validation: false,
        }),
    ];
    
    for (name, options) in feature_combinations {
        group.bench_with_input(
            BenchmarkId::new("features", name),
            &options,
            |b, options| {
                let transpiler = CudaTranspiler::new(options.clone());
                b.iter(|| {
                    let result = transpiler.transpile(black_box(feature_kernel));
                    black_box(result);
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_transpile_code_size_impact(c: &mut Criterion) {
    let mut group = c.benchmark_group("transpile_code_size");
    
    // Generate kernels of different sizes
    fn generate_kernel(num_operations: usize) -> String {
        let mut code = String::from("__global__ void generated_kernel(float* data, int n) {\n");
        code.push_str("    int idx = blockIdx.x * blockDim.x + threadIdx.x;\n");
        code.push_str("    if (idx < n) {\n");
        code.push_str("        float x = data[idx];\n");
        
        for i in 0..num_operations {
            code.push_str(&format!("        x = x * {}.0f + {}.0f;\n", i + 1, i));
        }
        
        code.push_str("        data[idx] = x;\n");
        code.push_str("    }\n");
        code.push_str("}\n");
        
        code
    }
    
    let kernel_sizes = vec![10, 50, 100, 500, 1000];
    
    for &size in &kernel_sizes {
        let kernel = generate_kernel(size);
        let kernel_bytes = kernel.len() as u64;
        
        group.throughput(Throughput::Bytes(kernel_bytes));
        group.bench_with_input(
            BenchmarkId::new("operations", size),
            &kernel,
            |b, kernel| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                b.iter(|| {
                    let result = transpiler.transpile(black_box(kernel));
                    black_box(result.unwrap());
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_transpile_multi_kernel(c: &mut Criterion) {
    let mut group = c.benchmark_group("transpile_multi_kernel");
    
    fn generate_multi_kernel_code(num_kernels: usize) -> String {
        let mut code = String::new();
        
        // Add some device functions
        code.push_str("__device__ float device_add(float a, float b) { return a + b; }\n");
        code.push_str("__device__ float device_mul(float a, float b) { return a * b; }\n\n");
        
        // Generate multiple kernels
        for i in 0..num_kernels {
            code.push_str(&format!(
                "__global__ void kernel{}(float* data, int n) {{\n", i
            ));
            code.push_str("    int idx = blockIdx.x * blockDim.x + threadIdx.x;\n");
            code.push_str("    if (idx < n) {\n");
            code.push_str("        float x = data[idx];\n");
            code.push_str("        x = device_add(x, 1.0f);\n");
            code.push_str("        x = device_mul(x, 2.0f);\n");
            code.push_str("        data[idx] = x;\n");
            code.push_str("    }\n");
            code.push_str("}\n\n");
        }
        
        code
    }
    
    let kernel_counts = vec![1, 5, 10, 20, 50];
    
    for &count in &kernel_counts {
        let code = generate_multi_kernel_code(count);
        
        group.bench_with_input(
            BenchmarkId::new("kernels", count),
            &code,
            |b, code| {
                let transpiler = CudaTranspiler::new(TranspilerOptions::default());
                b.iter(|| {
                    let result = transpiler.transpile(black_box(code));
                    black_box(result.unwrap());
                });
            },
        );
    }
    
    group.finish();
}

criterion_group!(
    benches,
    benchmark_transpile_simple_kernels,
    benchmark_transpile_complex_kernels,
    benchmark_transpile_optimization_impact,
    benchmark_transpile_feature_combinations,
    benchmark_transpile_code_size_impact,
    benchmark_transpile_multi_kernel
);
criterion_main!(benches);