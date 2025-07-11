//! Unit tests for the CUDA parser module

#[cfg(test)]
mod parser_tests {
    use cuda_rust_wasm::parser::{CudaParser, CudaAst, ParserOptions};
    use cuda_rust_wasm::error::CudaError;

    #[test]
    fn test_parse_empty_kernel() {
        let cuda_code = r#"
            __global__ void empty_kernel() {
            }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.kernels.len(), 1);
        assert_eq!(ast.kernels[0].name, "empty_kernel");
    }

    #[test]
    fn test_parse_kernel_with_parameters() {
        let cuda_code = r#"
            __global__ void vector_add(float* a, float* b, float* c, int n) {
                int idx = blockIdx.x * blockDim.x + threadIdx.x;
                if (idx < n) {
                    c[idx] = a[idx] + b[idx];
                }
            }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.kernels[0].parameters.len(), 4);
    }

    #[test]
    fn test_parse_multiple_kernels() {
        let cuda_code = r#"
            __global__ void kernel1() { }
            __global__ void kernel2() { }
            __device__ void device_func() { }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.kernels.len(), 2);
        assert_eq!(ast.device_functions.len(), 1);
    }

    #[test]
    fn test_parse_shared_memory() {
        let cuda_code = r#"
            __global__ void reduction_kernel(float* input, float* output) {
                extern __shared__ float sdata[];
                sdata[threadIdx.x] = input[threadIdx.x];
                __syncthreads();
            }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert!(ast.kernels[0].uses_shared_memory);
    }

    #[test]
    fn test_parse_atomic_operations() {
        let cuda_code = r#"
            __global__ void atomic_add_kernel(int* counter) {
                atomicAdd(counter, 1);
            }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert!(ast.kernels[0].uses_atomics);
    }

    #[test]
    fn test_parse_texture_memory() {
        let cuda_code = r#"
            texture<float, 2> tex2D;
            
            __global__ void texture_kernel(float* output, int width, int height) {
                int x = blockIdx.x * blockDim.x + threadIdx.x;
                int y = blockIdx.y * blockDim.y + threadIdx.y;
                
                if (x < width && y < height) {
                    output[y * width + x] = tex2D(x, y);
                }
            }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.textures.len(), 1);
    }

    #[test]
    fn test_parse_constant_memory() {
        let cuda_code = r#"
            __constant__ float kernel_weights[256];
            
            __global__ void convolution_kernel(float* input, float* output) {
                // kernel implementation
            }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.constant_memory.len(), 1);
    }

    #[test]
    fn test_parse_cuda_math_functions() {
        let cuda_code = r#"
            __global__ void math_kernel(float* a, float* b, float* c) {
                int idx = threadIdx.x;
                c[idx] = __fmaf_rn(a[idx], b[idx], 1.0f);
                c[idx] = __sinf(c[idx]);
                c[idx] = __expf(c[idx]);
            }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert!(ast.kernels[0].uses_cuda_math);
    }

    #[test]
    fn test_parse_warp_primitives() {
        let cuda_code = r#"
            __global__ void warp_shuffle_kernel(int* data) {
                int value = data[threadIdx.x];
                value = __shfl_xor_sync(0xffffffff, value, 1);
                data[threadIdx.x] = value;
            }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert!(ast.kernels[0].uses_warp_primitives);
    }

    #[test]
    fn test_parse_invalid_syntax() {
        let invalid_cases = vec![
            "__global__ void kernel( {}", // Missing closing parenthesis
            "__global__ kernel() {}", // Missing return type
            "__global void kernel() {}", // Missing underscore
            "__global__ void __kernel() {}", // Invalid kernel name
        ];
        
        let parser = CudaParser::new(ParserOptions::default());
        
        for invalid_code in invalid_cases {
            let result = parser.parse(invalid_code);
            assert!(result.is_err());
        }
    }

    #[test]
    fn test_parse_complex_kernel() {
        let cuda_code = r#"
            #define BLOCK_SIZE 16
            
            __constant__ float c_kernel[9];
            
            __device__ float clamp(float value, float min, float max) {
                return fminf(fmaxf(value, min), max);
            }
            
            __global__ void image_filter(
                float* input,
                float* output,
                int width,
                int height
            ) {
                extern __shared__ float tile[];
                
                int x = blockIdx.x * blockDim.x + threadIdx.x;
                int y = blockIdx.y * blockDim.y + threadIdx.y;
                
                int tid_x = threadIdx.x;
                int tid_y = threadIdx.y;
                
                // Load tile with padding
                if (x < width && y < height) {
                    tile[tid_y * BLOCK_SIZE + tid_x] = input[y * width + x];
                }
                
                __syncthreads();
                
                // Apply convolution
                if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                    float sum = 0.0f;
                    
                    for (int ky = -1; ky <= 1; ky++) {
                        for (int kx = -1; kx <= 1; kx++) {
                            int tile_y = tid_y + ky;
                            int tile_x = tid_x + kx;
                            
                            if (tile_y >= 0 && tile_y < BLOCK_SIZE &&
                                tile_x >= 0 && tile_x < BLOCK_SIZE) {
                                float pixel = tile[tile_y * BLOCK_SIZE + tile_x];
                                float weight = c_kernel[(ky + 1) * 3 + (kx + 1)];
                                sum += pixel * weight;
                            }
                        }
                    }
                    
                    output[y * width + x] = clamp(sum, 0.0f, 255.0f);
                }
            }
        "#;
        
        let parser = CudaParser::new(ParserOptions::default());
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
        let ast = result.unwrap();
        assert_eq!(ast.kernels.len(), 1);
        assert_eq!(ast.device_functions.len(), 1);
        assert_eq!(ast.constant_memory.len(), 1);
        assert!(ast.kernels[0].uses_shared_memory);
        assert_eq!(ast.kernels[0].name, "image_filter");
    }

    #[test]
    fn test_parser_options() {
        let cuda_code = r#"
            __global__ void test_kernel() {
                int idx = threadIdx.x;
            }
        "#;
        
        let options = ParserOptions {
            strict_mode: true,
            allow_extensions: false,
            max_kernel_size: 1000,
        };
        
        let parser = CudaParser::new(options);
        let result = parser.parse(cuda_code);
        
        assert!(result.is_ok());
    }
}