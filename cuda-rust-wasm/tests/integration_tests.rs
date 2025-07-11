//! Integration tests for end-to-end CUDA to WASM workflows

#[cfg(test)]
mod integration_tests {
    use cuda_rust_wasm::{
        transpiler::{CudaTranspiler, TranspilerOptions},
        runtime::{WasmRuntime, RuntimeOptions},
        kernel::{KernelLauncher, LaunchConfig},
        memory::{DeviceMemory, MemoryPool, AllocationStrategy},
        error::CudaError,
    };
    use std::time::Instant;

    #[test]
    fn test_vector_add_end_to_end() {
        // CUDA kernel code
        let cuda_code = r#"
            __global__ void vector_add(float* a, float* b, float* c, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    c[idx] = a[idx] + b[idx];
                }
            }
        "#;
        
        // Step 1: Transpile CUDA to WASM
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
        
        // Step 2: Create runtime and load module
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        // Step 3: Prepare test data
        let n = 10000;
        let a: Vec<f32> = (0..n).map(|i| i as f32).collect();
        let b: Vec<f32> = (0..n).map(|i| (i * 2) as f32).collect();
        let mut c = vec![0.0f32; n];
        
        // Step 4: Allocate device memory
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_a = pool.allocate_and_copy(&a).unwrap();
        let d_b = pool.allocate_and_copy(&b).unwrap();
        let d_c: DeviceMemory<f32> = pool.allocate(n).unwrap();
        
        // Step 5: Launch kernel
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: ((n + 255) / 256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        
        launcher.launch(
            "vector_add",
            config,
            &[d_a.as_arg(), d_b.as_arg(), d_c.as_arg(), n.as_arg()],
        ).unwrap();
        
        // Step 6: Copy results back
        d_c.copy_to_host(&mut c).unwrap();
        
        // Step 7: Verify results
        for i in 0..n {
            assert_eq!(c[i], a[i] + b[i]);
        }
    }

    #[test]
    fn test_matrix_multiply_end_to_end() {
        let cuda_code = r#"
            __global__ void matrix_multiply(float* a, float* b, float* c, int m, int n, int k) {
                int row = blockIdx.y * blockDim.y + threadIdx.y;
                int col = blockIdx.x * blockDim.x + threadIdx.x;
                
                if (row < m && col < n) {
                    float sum = 0.0f;
                    for (int i = 0; i < k; i++) {
                        sum += a[row * k + i] * b[i * n + col];
                    }
                    c[row * n + col] = sum;
                }
            }
        "#;
        
        // Matrix dimensions
        let m = 64;
        let n = 64;
        let k = 64;
        
        // Transpile and setup
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        // Create test matrices
        let a: Vec<f32> = (0..m*k).map(|i| (i % 10) as f32).collect();
        let b: Vec<f32> = (0..k*n).map(|i| (i % 10) as f32).collect();
        let mut c = vec![0.0f32; m * n];
        
        // Allocate device memory
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_a = pool.allocate_and_copy(&a).unwrap();
        let d_b = pool.allocate_and_copy(&b).unwrap();
        let d_c: DeviceMemory<f32> = pool.allocate(m * n).unwrap();
        
        // Launch kernel
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: ((n + 15) / 16, (m + 15) / 16, 1),
            block_size: (16, 16, 1),
            shared_mem_bytes: 0,
        };
        
        launcher.launch(
            "matrix_multiply",
            config,
            &[d_a.as_arg(), d_b.as_arg(), d_c.as_arg(), m.as_arg(), n.as_arg(), k.as_arg()],
        ).unwrap();
        
        // Get results
        d_c.copy_to_host(&mut c).unwrap();
        
        // Verify a few elements
        for i in 0..5 {
            for j in 0..5 {
                let mut expected = 0.0f32;
                for l in 0..k {
                    expected += a[i * k + l] * b[l * n + j];
                }
                assert!((c[i * n + j] - expected).abs() < 1e-5);
            }
        }
    }

    #[test]
    fn test_reduction_with_shared_memory() {
        let cuda_code = r#"
            __global__ void reduction_sum(float* input, float* output, int n) {
                extern __shared__ float sdata[];
                
                unsigned int tid = threadIdx.x;
                unsigned int idx = blockIdx.x * blockDim.x + threadIdx.x;
                
                sdata[tid] = (idx < n) ? input[idx] : 0.0f;
                __syncthreads();
                
                for (unsigned int s = blockDim.x / 2; s > 0; s >>= 1) {
                    if (tid < s) {
                        sdata[tid] += sdata[tid + s];
                    }
                    __syncthreads();
                }
                
                if (tid == 0) {
                    output[blockIdx.x] = sdata[0];
                }
            }
        "#;
        
        // Transpile
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        // Test data
        let n = 10000;
        let input: Vec<f32> = (0..n).map(|i| 1.0).collect(); // All ones
        let block_size = 256;
        let grid_size = (n + block_size - 1) / block_size;
        let mut output = vec![0.0f32; grid_size];
        
        // Allocate memory
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_input = pool.allocate_and_copy(&input).unwrap();
        let d_output: DeviceMemory<f32> = pool.allocate(grid_size).unwrap();
        
        // Launch kernel
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: (grid_size as u32, 1, 1),
            block_size: (block_size as u32, 1, 1),
            shared_mem_bytes: block_size * std::mem::size_of::<f32>(),
        };
        
        launcher.launch(
            "reduction_sum",
            config,
            &[d_input.as_arg(), d_output.as_arg(), n.as_arg()],
        ).unwrap();
        
        // Get results
        d_output.copy_to_host(&mut output).unwrap();
        
        // Sum the partial results
        let total: f32 = output.iter().sum();
        assert_eq!(total, n as f32);
    }

    #[test]
    fn test_atomic_histogram() {
        let cuda_code = r#"
            __global__ void histogram(int* data, int* hist, int n, int nbins) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    int bin = data[idx] % nbins;
                    atomicAdd(&hist[bin], 1);
                }
            }
        "#;
        
        // Enable atomics in transpiler
        let options = TranspilerOptions {
            enable_atomics: true,
            ..Default::default()
        };
        
        let transpiler = CudaTranspiler::new(options);
        let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        // Test data
        let n = 10000;
        let nbins = 10;
        let data: Vec<i32> = (0..n).map(|i| i as i32).collect();
        let mut hist = vec![0i32; nbins];
        
        // Allocate memory
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_data = pool.allocate_and_copy(&data).unwrap();
        let d_hist = pool.allocate_and_copy(&hist).unwrap();
        
        // Launch kernel
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: ((n + 255) / 256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        
        launcher.launch(
            "histogram",
            config,
            &[d_data.as_arg(), d_hist.as_arg(), n.as_arg(), nbins.as_arg()],
        ).unwrap();
        
        // Get results
        d_hist.copy_to_host(&mut hist).unwrap();
        
        // Verify histogram
        for i in 0..nbins {
            assert_eq!(hist[i], (n / nbins) as i32);
        }
    }

    #[test]
    fn test_performance_measurement() {
        let cuda_code = r#"
            __global__ void compute_intensive(float* data, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    float x = data[idx];
                    // Perform many operations
                    for (int i = 0; i < 100; i++) {
                        x = __sinf(x) + __cosf(x);
                        x = __expf(x) / (1.0f + __expf(x));
                        x = __sqrtf(x * x + 1.0f);
                    }
                    data[idx] = x;
                }
            }
        "#;
        
        // Transpile with optimizations
        let options = TranspilerOptions {
            optimization_level: cuda_rust_wasm::transpiler::OptimizationLevel::Aggressive,
            ..Default::default()
        };
        
        let transpiler = CudaTranspiler::new(options);
        let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        // Test data
        let n = 100000;
        let mut data: Vec<f32> = (0..n).map(|i| (i as f32) / 1000.0).collect();
        
        // Allocate memory
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_data = pool.allocate_and_copy(&data).unwrap();
        
        // Launch kernel and measure time
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: ((n + 255) / 256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        
        let start = Instant::now();
        
        launcher.launch(
            "compute_intensive",
            config,
            &[d_data.as_arg(), n.as_arg()],
        ).unwrap();
        
        // Synchronize
        runtime.synchronize().unwrap();
        
        let duration = start.elapsed();
        
        // Get results
        d_data.copy_to_host(&mut data).unwrap();
        
        println!("Compute intensive kernel took: {:?}", duration);
        
        // Performance should be reasonable
        assert!(duration.as_millis() < 1000); // Should complete in under 1 second
    }

    #[test]
    fn test_multi_kernel_workflow() {
        // First kernel: scale data
        let scale_kernel = r#"
            __global__ void scale(float* data, float factor, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    data[idx] *= factor;
                }
            }
        "#;
        
        // Second kernel: add bias
        let bias_kernel = r#"
            __global__ void add_bias(float* data, float bias, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    data[idx] += bias;
                }
            }
        "#;
        
        // Transpile both kernels
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let scale_wasm = transpiler.transpile(scale_kernel).unwrap();
        let bias_wasm = transpiler.transpile(bias_kernel).unwrap();
        
        // Create runtime
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let scale_module = runtime.load_module(&scale_wasm).unwrap();
        let bias_module = runtime.load_module(&bias_wasm).unwrap();
        
        // Test data
        let n = 1000;
        let mut data: Vec<f32> = (0..n).map(|i| i as f32).collect();
        let factor = 2.0f32;
        let bias = 10.0f32;
        
        // Allocate memory
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_data = pool.allocate_and_copy(&data).unwrap();
        
        // Launch first kernel
        let config = LaunchConfig {
            grid_size: ((n + 255) / 256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        
        let launcher1 = KernelLauncher::new(scale_module);
        launcher1.launch(
            "scale",
            config,
            &[d_data.as_arg(), factor.as_arg(), n.as_arg()],
        ).unwrap();
        
        // Launch second kernel
        let launcher2 = KernelLauncher::new(bias_module);
        launcher2.launch(
            "add_bias",
            config,
            &[d_data.as_arg(), bias.as_arg(), n.as_arg()],
        ).unwrap();
        
        // Get results
        d_data.copy_to_host(&mut data).unwrap();
        
        // Verify
        for i in 0..n {
            let expected = (i as f32) * factor + bias;
            assert_eq!(data[i], expected);
        }
    }

    #[test]
    fn test_error_handling() {
        // Test various error conditions
        
        // 1. Invalid CUDA code
        let invalid_code = "__global__ void invalid( {}";
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        assert!(transpiler.transpile(invalid_code).is_err());
        
        // 2. Out of memory
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024).unwrap(); // Small pool
        let huge_alloc: Result<DeviceMemory<f32>, _> = pool.allocate(1000000);
        assert!(matches!(huge_alloc, Err(CudaError::OutOfMemory)));
        
        // 3. Invalid kernel name
        let cuda_code = "__global__ void test_kernel() {}";
        let wasm_bytes = transpiler.transpile(cuda_code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        let launcher = KernelLauncher::new(module);
        
        let config = LaunchConfig {
            grid_size: (1, 1, 1),
            block_size: (1, 1, 1),
            shared_mem_bytes: 0,
        };
        
        let result = launcher.launch("non_existent_kernel", config, &[]);
        assert!(matches!(result, Err(CudaError::KernelNotFound(_))));
    }
}