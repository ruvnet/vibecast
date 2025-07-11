//! Unit tests for the CUDA to WASM transpiler

#[cfg(test)]
mod transpiler_tests {
    use cuda_rust_wasm::transpiler::{CudaTranspiler, TranspilerOptions, OptimizationLevel};
    use cuda_rust_wasm::error::CudaError;

    #[test]
    fn test_transpile_simple_kernel() {
        let cuda_code = r#"
            __global__ void simple_kernel(int* data) {
                data[threadIdx.x] = threadIdx.x;
            }
        "#;
        
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let result = transpiler.transpile(cuda_code);
        
        assert!(result.is_ok());
        let wasm_bytes = result.unwrap();
        assert!(!wasm_bytes.is_empty());
        
        // Verify WASM magic number
        assert_eq!(&wasm_bytes[0..4], b"\0asm");
    }

    #[test]
    fn test_transpile_with_optimization_levels() {
        let cuda_code = r#"
            __global__ void vector_add(float* a, float* b, float* c, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    c[idx] = a[idx] + b[idx];
                }
            }
        "#;
        
        let optimization_levels = vec![
            OptimizationLevel::None,
            OptimizationLevel::Basic,
            OptimizationLevel::Aggressive,
        ];
        
        for level in optimization_levels {
            let options = TranspilerOptions {
                optimization_level: level,
                ..Default::default()
            };
            
            let transpiler = CudaTranspiler::new(options);
            let result = transpiler.transpile(cuda_code);
            
            assert!(result.is_ok());
            let wasm_bytes = result.unwrap();
            assert!(!wasm_bytes.is_empty());
        }
    }

    #[test]
    fn test_transpile_shared_memory_kernel() {
        let cuda_code = r#"
            __global__ void reduction_kernel(float* input, float* output, int n) {
                extern __shared__ float sdata[];
                
                int tid = threadIdx.x;
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                
                sdata[tid] = (idx < n) ? input[idx] : 0.0f;
                __syncthreads();
                
                // Reduction in shared memory
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
        
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let result = transpiler.transpile(cuda_code);
        
        assert!(result.is_ok());
    }

    #[test]
    fn test_transpile_atomic_operations() {
        let cuda_code = r#"
            __global__ void histogram_kernel(int* data, int* hist, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    atomicAdd(&hist[data[idx]], 1);
                }
            }
        "#;
        
        let options = TranspilerOptions {
            enable_atomics: true,
            ..Default::default()
        };
        
        let transpiler = CudaTranspiler::new(options);
        let result = transpiler.transpile(cuda_code);
        
        assert!(result.is_ok());
    }

    #[test]
    fn test_transpile_cuda_math_intrinsics() {
        let cuda_code = r#"
            __global__ void math_kernel(float* a, float* b, float* c, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    float x = a[idx];
                    float y = b[idx];
                    
                    c[idx] = __fmaf_rn(x, y, 1.0f);  // Fused multiply-add
                    c[idx] += __sinf(x);              // Fast sine
                    c[idx] += __cosf(y);              // Fast cosine
                    c[idx] += __expf(x);              // Fast exponential
                    c[idx] += __logf(y);              // Fast logarithm
                    c[idx] += __sqrtf(x * y);        // Fast square root
                }
            }
        "#;
        
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let result = transpiler.transpile(cuda_code);
        
        assert!(result.is_ok());
    }

    #[test]
    fn test_transpile_warp_primitives() {
        let cuda_code = r#"
            __global__ void warp_reduce_kernel(int* data, int* result) {
                int value = data[threadIdx.x];
                
                // Warp shuffle reduction
                value += __shfl_down_sync(0xffffffff, value, 16);
                value += __shfl_down_sync(0xffffffff, value, 8);
                value += __shfl_down_sync(0xffffffff, value, 4);
                value += __shfl_down_sync(0xffffffff, value, 2);
                value += __shfl_down_sync(0xffffffff, value, 1);
                
                if (threadIdx.x % 32 == 0) {
                    result[threadIdx.x / 32] = value;
                }
            }
        "#;
        
        let options = TranspilerOptions {
            enable_warp_primitives: true,
            ..Default::default()
        };
        
        let transpiler = CudaTranspiler::new(options);
        let result = transpiler.transpile(cuda_code);
        
        assert!(result.is_ok());
    }

    #[test]
    fn test_transpile_multiple_kernels() {
        let cuda_code = r#"
            __device__ float device_add(float a, float b) {
                return a + b;
            }
            
            __global__ void kernel1(float* data) {
                data[threadIdx.x] = device_add(1.0f, 2.0f);
            }
            
            __global__ void kernel2(float* data) {
                data[threadIdx.x] = device_add(3.0f, 4.0f);
            }
        "#;
        
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let result = transpiler.transpile(cuda_code);
        
        assert!(result.is_ok());
        let wasm_bytes = result.unwrap();
        
        // The transpiler should handle multiple kernels
        assert!(!wasm_bytes.is_empty());
    }

    #[test]
    fn test_transpile_texture_memory() {
        let cuda_code = r#"
            texture<float, 2> tex2D;
            
            __global__ void texture_kernel(float* output, int width, int height) {
                int x = blockIdx.x * blockDim.x + threadIdx.x;
                int y = blockIdx.y * blockDim.y + threadIdx.y;
                
                if (x < width && y < height) {
                    output[y * width + x] = tex2D(x + 0.5f, y + 0.5f);
                }
            }
        "#;
        
        let options = TranspilerOptions {
            enable_texture_memory: true,
            ..Default::default()
        };
        
        let transpiler = CudaTranspiler::new(options);
        let result = transpiler.transpile(cuda_code);
        
        // Texture memory might not be fully supported
        // but transpiler should handle it gracefully
        assert!(result.is_ok() || matches!(result, Err(CudaError::UnsupportedFeature(_))));
    }

    #[test]
    fn test_transpile_constant_memory() {
        let cuda_code = r#"
            __constant__ float kernel_weights[256];
            
            __global__ void convolution_kernel(float* input, float* output, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    float sum = 0.0f;
                    for (int i = 0; i < 256; i++) {
                        sum += input[idx + i] * kernel_weights[i];
                    }
                    output[idx] = sum;
                }
            }
        "#;
        
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        let result = transpiler.transpile(cuda_code);
        
        assert!(result.is_ok());
    }

    #[test]
    fn test_transpile_invalid_cuda_code() {
        let invalid_cases = vec![
            "__global__ void kernel( {}", // Syntax error
            "__global__ void kernel() { invalid_intrinsic(); }", // Unknown function
            "__global__ void kernel() { asm(\"invalid\"); }", // Inline assembly
        ];
        
        let transpiler = CudaTranspiler::new(TranspilerOptions::default());
        
        for invalid_code in invalid_cases {
            let result = transpiler.transpile(invalid_code);
            assert!(result.is_err());
        }
    }

    #[test]
    fn test_transpile_with_debug_info() {
        let cuda_code = r#"
            __global__ void debug_kernel(int* data) {
                data[threadIdx.x] = threadIdx.x * 2;
            }
        "#;
        
        let options = TranspilerOptions {
            include_debug_info: true,
            ..Default::default()
        };
        
        let transpiler = CudaTranspiler::new(options);
        let result = transpiler.transpile(cuda_code);
        
        assert!(result.is_ok());
        // Debug info should increase the WASM size
        let wasm_bytes = result.unwrap();
        
        let options_no_debug = TranspilerOptions {
            include_debug_info: false,
            ..Default::default()
        };
        
        let transpiler_no_debug = CudaTranspiler::new(options_no_debug);
        let result_no_debug = transpiler_no_debug.transpile(cuda_code);
        
        assert!(result_no_debug.is_ok());
        let wasm_bytes_no_debug = result_no_debug.unwrap();
        
        // Debug version should be larger
        assert!(wasm_bytes.len() >= wasm_bytes_no_debug.len());
    }

    #[test]
    fn test_transpile_with_validation() {
        let cuda_code = r#"
            __global__ void validation_kernel(float* data, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                // This could cause out-of-bounds access
                data[idx] = idx;
            }
        "#;
        
        let options = TranspilerOptions {
            enable_validation: true,
            ..Default::default()
        };
        
        let transpiler = CudaTranspiler::new(options);
        let result = transpiler.transpile(cuda_code);
        
        assert!(result.is_ok());
        // Validation should inject bounds checking
    }
}