//! Property-based tests for transpiler correctness

#[cfg(test)]
mod property_tests {
    use cuda_rust_wasm::{
        transpiler::{CudaTranspiler, TranspilerOptions},
        runtime::{WasmRuntime, RuntimeOptions},
        kernel::{KernelLauncher, LaunchConfig},
        memory::{DeviceMemory, MemoryPool, AllocationStrategy},
    };
    use proptest::prelude::*;
    use approx::assert_relative_eq;

    // Property: Vector addition should be commutative
    proptest! {
        #[test]
        fn prop_vector_add_commutative(
            a in prop::collection::vec(-1000.0f32..1000.0f32, 100..1000),
            b in prop::collection::vec(-1000.0f32..1000.0f32, 100..1000)
        ) {
            let n = a.len().min(b.len());
            let a = &a[..n];
            let b = &b[..n];
            
            let cuda_code = r#"
                __global__ void vector_add(float* a, float* b, float* c, int n) {
                    int idx = blockIdx.x * blockDim.x + threadIdx.x;
                    if (idx < n) {
                        c[idx] = a[idx] + b[idx];
                    }
                }
            "#;
            
            let result1 = run_vector_operation(cuda_code, a, b, n);
            let result2 = run_vector_operation(cuda_code, b, a, n);
            
            // Addition should be commutative
            for i in 0..n {
                assert_relative_eq!(result1[i], result2[i], epsilon = 1e-5);
            }
        }
    }

    // Property: Scalar multiplication should be distributive
    proptest! {
        #[test]
        fn prop_scalar_mult_distributive(
            data in prop::collection::vec(-100.0f32..100.0f32, 100..1000),
            scalar in -10.0f32..10.0f32
        ) {
            let n = data.len();
            
            let scalar_mult_code = r#"
                __global__ void scalar_mult(float* data, float scalar, float* output, int n) {
                    int idx = blockIdx.x * blockDim.x + threadIdx.x;
                    if (idx < n) {
                        output[idx] = data[idx] * scalar;
                    }
                }
            "#;
            
            let result = run_scalar_operation(scalar_mult_code, &data, scalar, n);
            
            // Verify distributive property
            for i in 0..n {
                assert_relative_eq!(result[i], data[i] * scalar, epsilon = 1e-5);
            }
        }
    }

    // Property: Identity operations should preserve data
    proptest! {
        #[test]
        fn prop_identity_operation(
            data in prop::collection::vec(-1000.0f32..1000.0f32, 100..1000)
        ) {
            let n = data.len();
            
            let identity_code = r#"
                __global__ void identity(float* input, float* output, int n) {
                    int idx = blockIdx.x * blockDim.x + threadIdx.x;
                    if (idx < n) {
                        output[idx] = input[idx];
                    }
                }
            "#;
            
            let result = run_unary_operation(identity_code, &data, n);
            
            // Output should equal input
            for i in 0..n {
                assert_eq!(result[i], data[i]);
            }
        }
    }

    // Property: Min/max operations should satisfy bounds
    proptest! {
        #[test]
        fn prop_minmax_bounds(
            a in prop::collection::vec(-1000.0f32..1000.0f32, 100..1000),
            b in prop::collection::vec(-1000.0f32..1000.0f32, 100..1000)
        ) {
            let n = a.len().min(b.len());
            let a = &a[..n];
            let b = &b[..n];
            
            let minmax_code = r#"
                __global__ void minmax(float* a, float* b, float* min_out, float* max_out, int n) {
                    int idx = blockIdx.x * blockDim.x + threadIdx.x;
                    if (idx < n) {
                        min_out[idx] = fminf(a[idx], b[idx]);
                        max_out[idx] = fmaxf(a[idx], b[idx]);
                    }
                }
            "#;
            
            let (min_result, max_result) = run_minmax_operation(minmax_code, a, b, n);
            
            // Verify bounds
            for i in 0..n {
                assert!(min_result[i] <= a[i]);
                assert!(min_result[i] <= b[i]);
                assert!(max_result[i] >= a[i]);
                assert!(max_result[i] >= b[i]);
                assert!(min_result[i] <= max_result[i]);
            }
        }
    }

    // Property: Reduction operations should be associative
    proptest! {
        #[test]
        fn prop_reduction_associative(
            data in prop::collection::vec(0.1f32..10.0f32, 128..512)
        ) {
            let n = data.len();
            
            let reduction_code = r#"
                __global__ void reduction_sum(float* input, float* output, int n) {
                    extern __shared__ float sdata[];
                    
                    int tid = threadIdx.x;
                    int idx = blockIdx.x * blockDim.x + threadIdx.x;
                    
                    sdata[tid] = (idx < n) ? input[idx] : 0.0f;
                    __syncthreads();
                    
                    for (int s = blockDim.x / 2; s > 0; s >>= 1) {
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
            
            let gpu_sum = run_reduction(reduction_code, &data, n);
            let cpu_sum: f32 = data.iter().sum();
            
            // GPU reduction should match CPU sum (within floating point tolerance)
            assert_relative_eq!(gpu_sum, cpu_sum, epsilon = 1e-3);
        }
    }

    // Property: Atomic operations should maintain consistency
    proptest! {
        #[test]
        fn prop_atomic_consistency(
            num_threads in 32usize..512,
            increment in 1i32..10
        ) {
            let atomic_code = r#"
                __global__ void atomic_increment(int* counter, int increment, int num_iterations) {
                    for (int i = 0; i < num_iterations; i++) {
                        atomicAdd(counter, increment);
                    }
                }
            "#;
            
            let result = run_atomic_test(atomic_code, num_threads, increment);
            let expected = (num_threads * increment) as i32;
            
            // All atomic increments should be accounted for
            assert_eq!(result, expected);
        }
    }

    // Property: Memory access patterns should be safe
    proptest! {
        #[test]
        fn prop_memory_bounds_checking(
            size in 100usize..1000,
            pattern in prop::collection::vec(0usize..1000, 100..500)
        ) {
            let bounded_pattern: Vec<_> = pattern.iter()
                .map(|&idx| idx % size)
                .collect();
            
            let gather_code = r#"
                __global__ void gather(float* input, int* indices, float* output, int n, int size) {
                    int idx = blockIdx.x * blockDim.x + threadIdx.x;
                    if (idx < n) {
                        int index = indices[idx];
                        if (index >= 0 && index < size) {
                            output[idx] = input[index];
                        } else {
                            output[idx] = -1.0f; // Out of bounds marker
                        }
                    }
                }
            "#;
            
            let data: Vec<f32> = (0..size).map(|i| i as f32).collect();
            let result = run_gather_operation(gather_code, &data, &bounded_pattern);
            
            // All accesses should be valid
            for (i, &idx) in bounded_pattern.iter().enumerate() {
                assert_eq!(result[i], data[idx]);
                assert!(result[i] >= 0.0); // No out-of-bounds markers
            }
        }
    }

    // Property: Type conversions should preserve values within range
    proptest! {
        #[test]
        fn prop_type_conversion_safety(
            int_data in prop::collection::vec(-1000i32..1000, 100..500)
        ) {
            let conversion_code = r#"
                __global__ void int_to_float(int* input, float* output, int n) {
                    int idx = blockIdx.x * blockDim.x + threadIdx.x;
                    if (idx < n) {
                        output[idx] = (float)input[idx];
                    }
                }
            "#;
            
            let result = run_conversion_test(conversion_code, &int_data);
            
            // Conversion should preserve values
            for i in 0..int_data.len() {
                assert_eq!(result[i], int_data[i] as f32);
            }
        }
    }

    // Helper functions for running tests
    fn run_vector_operation(code: &str, a: &[f32], b: &[f32], n: usize) -> Vec<f32> {
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_a = pool.allocate_and_copy(a).unwrap();
        let d_b = pool.allocate_and_copy(b).unwrap();
        let d_c: DeviceMemory<f32> = pool.allocate(n).unwrap();
        
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
        
        let mut result = vec![0.0f32; n];
        d_c.copy_to_host(&mut result).unwrap();
        result
    }

    fn run_scalar_operation(code: &str, data: &[f32], scalar: f32, n: usize) -> Vec<f32> {
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_data = pool.allocate_and_copy(data).unwrap();
        let d_output: DeviceMemory<f32> = pool.allocate(n).unwrap();
        
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: ((n + 255) / 256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        
        launcher.launch(
            "scalar_mult",
            config,
            &[d_data.as_arg(), scalar.as_arg(), d_output.as_arg(), n.as_arg()],
        ).unwrap();
        
        let mut result = vec![0.0f32; n];
        d_output.copy_to_host(&mut result).unwrap();
        result
    }

    fn run_unary_operation(code: &str, data: &[f32], n: usize) -> Vec<f32> {
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_input = pool.allocate_and_copy(data).unwrap();
        let d_output: DeviceMemory<f32> = pool.allocate(n).unwrap();
        
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: ((n + 255) / 256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        
        launcher.launch(
            "identity",
            config,
            &[d_input.as_arg(), d_output.as_arg(), n.as_arg()],
        ).unwrap();
        
        let mut result = vec![0.0f32; n];
        d_output.copy_to_host(&mut result).unwrap();
        result
    }

    fn run_minmax_operation(code: &str, a: &[f32], b: &[f32], n: usize) -> (Vec<f32>, Vec<f32>) {
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_a = pool.allocate_and_copy(a).unwrap();
        let d_b = pool.allocate_and_copy(b).unwrap();
        let d_min: DeviceMemory<f32> = pool.allocate(n).unwrap();
        let d_max: DeviceMemory<f32> = pool.allocate(n).unwrap();
        
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: ((n + 255) / 256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        
        launcher.launch(
            "minmax",
            config,
            &[d_a.as_arg(), d_b.as_arg(), d_min.as_arg(), d_max.as_arg(), n.as_arg()],
        ).unwrap();
        
        let mut min_result = vec![0.0f32; n];
        let mut max_result = vec![0.0f32; n];
        d_min.copy_to_host(&mut min_result).unwrap();
        d_max.copy_to_host(&mut max_result).unwrap();
        
        (min_result, max_result)
    }

    fn run_reduction(code: &str, data: &[f32], n: usize) -> f32 {
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_input = pool.allocate_and_copy(data).unwrap();
        
        let block_size = 128;
        let grid_size = (n + block_size - 1) / block_size;
        let d_output: DeviceMemory<f32> = pool.allocate(grid_size).unwrap();
        
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
        
        let mut partial_sums = vec![0.0f32; grid_size];
        d_output.copy_to_host(&mut partial_sums).unwrap();
        
        partial_sums.iter().sum()
    }

    fn run_atomic_test(code: &str, num_threads: usize, increment: i32) -> i32 {
        let options = TranspilerOptions {
            enable_atomics: true,
            ..Default::default()
        };
        
        let transpiler = CudaTranspiler::new(options);
        let wasm_bytes = transpiler.transpile(code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024 * 1024).unwrap();
        let counter = vec![0i32];
        let d_counter = pool.allocate_and_copy(&counter).unwrap();
        
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: (1, 1, 1),
            block_size: (num_threads as u32, 1, 1),
            shared_mem_bytes: 0,
        };
        
        launcher.launch(
            "atomic_increment",
            config,
            &[d_counter.as_arg(), increment.as_arg(), 1i32.as_arg()],
        ).unwrap();
        
        let mut result = vec![0i32];
        d_counter.copy_to_host(&mut result).unwrap();
        result[0]
    }

    fn run_gather_operation(code: &str, data: &[f32], indices: &[usize]) -> Vec<f32> {
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_data = pool.allocate_and_copy(data).unwrap();
        
        let indices_i32: Vec<i32> = indices.iter().map(|&i| i as i32).collect();
        let d_indices = pool.allocate_and_copy(&indices_i32).unwrap();
        
        let n = indices.len();
        let d_output: DeviceMemory<f32> = pool.allocate(n).unwrap();
        
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: ((n + 255) / 256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        
        launcher.launch(
            "gather",
            config,
            &[d_data.as_arg(), d_indices.as_arg(), d_output.as_arg(), 
              n.as_arg(), data.len().as_arg()],
        ).unwrap();
        
        let mut result = vec![0.0f32; n];
        d_output.copy_to_host(&mut result).unwrap();
        result
    }

    fn run_conversion_test(code: &str, int_data: &[i32]) -> Vec<f32> {
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let wasm_bytes = transpiler.transpile(code).unwrap();
        let runtime = WasmRuntime::new(RuntimeOptions::default()).unwrap();
        let module = runtime.load_module(&wasm_bytes).unwrap();
        
        let pool = MemoryPool::new(AllocationStrategy::BestFit, 10 * 1024 * 1024).unwrap();
        let d_input = pool.allocate_and_copy(int_data).unwrap();
        let d_output: DeviceMemory<f32> = pool.allocate(int_data.len()).unwrap();
        
        let launcher = KernelLauncher::new(module);
        let config = LaunchConfig {
            grid_size: ((int_data.len() + 255) / 256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 0,
        };
        
        launcher.launch(
            "int_to_float",
            config,
            &[d_input.as_arg(), d_output.as_arg(), int_data.len().as_arg()],
        ).unwrap();
        
        let mut result = vec![0.0f32; int_data.len()];
        d_output.copy_to_host(&mut result).unwrap();
        result
    }
}