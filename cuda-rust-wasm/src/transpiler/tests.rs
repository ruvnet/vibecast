//! Tests for CUDA to Rust transpiler

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::Parser;
    use crate::transpiler::Transpiler;
    use crate::transpiler::kernel_translator::{KernelTranslator, KernelPattern};
    
    #[test]
    fn test_vector_add_transpilation() {
        let cuda_code = r#"
        __global__ void vectorAdd(float* a, float* b, float* c, int n) {
            int idx = threadIdx.x + blockIdx.x * blockDim.x;
            if (idx < n) {
                c[idx] = a[idx] + b[idx];
            }
        }
        "#;
        
        let mut parser = Parser::new(cuda_code);
        let ast = parser.parse().expect("Failed to parse CUDA code");
        
        let transpiler = Transpiler::new();
        let rust_code = transpiler.transpile(ast).expect("Failed to transpile");
        
        assert!(rust_code.contains("#[kernel]"));
        assert!(rust_code.contains("pub fn vectorAdd"));
        assert!(rust_code.contains("thread::index().x"));
        assert!(rust_code.contains("block::index().x"));
    }
    
    #[test]
    fn test_matrix_multiply_transpilation() {
        let cuda_code = r#"
        __global__ void matrixMul(float* a, float* b, float* c, int m, int n, int k) {
            int row = threadIdx.y + blockIdx.y * blockDim.y;
            int col = threadIdx.x + blockIdx.x * blockDim.x;
            
            if (row < m && col < n) {
                float sum = 0.0f;
                for (int i = 0; i < k; i++) {
                    sum += a[row * k + i] * b[i * n + col];
                }
                c[row * n + col] = sum;
            }
        }
        "#;
        
        let mut parser = Parser::new(cuda_code);
        let ast = parser.parse().expect("Failed to parse CUDA code");
        
        let transpiler = Transpiler::new();
        let rust_code = transpiler.transpile(ast).expect("Failed to transpile");
        
        assert!(rust_code.contains("thread::index().y"));
        assert!(rust_code.contains("thread::index().x"));
        assert!(rust_code.contains("for"));
    }
    
    #[test]
    fn test_shared_memory_transpilation() {
        let cuda_code = r#"
        __global__ void reduction(float* input, float* output, int n) {
            __shared__ float sdata[256];
            
            int tid = threadIdx.x;
            int gid = blockIdx.x * blockDim.x + tid;
            
            sdata[tid] = (gid < n) ? input[gid] : 0.0f;
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
        
        let mut parser = Parser::new(cuda_code);
        let ast = parser.parse().expect("Failed to parse CUDA code");
        
        let transpiler = Transpiler::new();
        let rust_code = transpiler.transpile(ast).expect("Failed to transpile");
        
        assert!(rust_code.contains("#[shared]"));
        assert!(rust_code.contains("sync_threads()"));
    }
    
    #[test]
    fn test_device_function_transpilation() {
        let cuda_code = r#"
        __device__ float square(float x) {
            return x * x;
        }
        
        __global__ void squareKernel(float* data, int n) {
            int idx = threadIdx.x + blockIdx.x * blockDim.x;
            if (idx < n) {
                data[idx] = square(data[idx]);
            }
        }
        "#;
        
        let mut parser = Parser::new(cuda_code);
        let ast = parser.parse().expect("Failed to parse CUDA code");
        
        let transpiler = Transpiler::new();
        let rust_code = transpiler.transpile(ast).expect("Failed to transpile");
        
        assert!(rust_code.contains("#[device_function]"));
        assert!(rust_code.contains("pub fn square"));
        assert!(rust_code.contains("square(data[idx"));
    }
    
    #[test]
    fn test_type_conversion() {
        let cuda_code = r#"
        __global__ void typeTest(int* a, float* b, double* c, unsigned int n) {
            int idx = threadIdx.x;
            float f = (float)a[idx];
            double d = (double)b[idx];
            c[idx] = d + f;
        }
        "#;
        
        let mut parser = Parser::new(cuda_code);
        let ast = parser.parse().expect("Failed to parse CUDA code");
        
        let transpiler = Transpiler::new();
        let rust_code = transpiler.transpile(ast).expect("Failed to transpile");
        
        assert!(rust_code.contains("as f32"));
        assert!(rust_code.contains("as f64"));
        assert!(rust_code.contains("i32"));
        assert!(rust_code.contains("u32"));
    }
    
    #[test]
    fn test_kernel_pattern_detection() {
        let cuda_vector_add = r#"
        __global__ void vectorAdd(float* a, float* b, float* c, int n) {
            int idx = threadIdx.x + blockIdx.x * blockDim.x;
            if (idx < n) {
                c[idx] = a[idx] + b[idx];
            }
        }
        "#;
        
        let mut parser = Parser::new(cuda_vector_add);
        let ast = parser.parse().expect("Failed to parse");
        
        let translator = KernelTranslator::new();
        if let Some(kernel) = ast.items.iter().find_map(|item| {
            if let crate::parser::ast::Item::Kernel(k) = item {
                Some(k)
            } else {
                None
            }
        }) {
            let pattern = translator.detect_pattern(kernel);
            assert_eq!(pattern, KernelPattern::VectorAdd);
        }
    }
    
    #[test]
    fn test_warp_primitives() {
        let cuda_code = r#"
        __global__ void warpReduce(float* data) {
            int tid = threadIdx.x;
            float val = data[tid];
            
            val += __shfl_down_sync(0xffffffff, val, 16);
            val += __shfl_down_sync(0xffffffff, val, 8);
            val += __shfl_down_sync(0xffffffff, val, 4);
            val += __shfl_down_sync(0xffffffff, val, 2);
            val += __shfl_down_sync(0xffffffff, val, 1);
            
            if (tid == 0) {
                data[0] = val;
            }
        }
        "#;
        
        let mut parser = Parser::new(cuda_code);
        let ast = parser.parse().expect("Failed to parse CUDA code");
        
        let transpiler = Transpiler::new();
        let rust_code = transpiler.transpile(ast).expect("Failed to transpile");
        
        assert!(rust_code.contains("warp_shuffle_down"));
    }
    
    #[test]
    fn test_for_loop_transpilation() {
        let cuda_code = r#"
        __global__ void forLoopKernel(float* data, int n) {
            int idx = threadIdx.x + blockIdx.x * blockDim.x;
            if (idx < n) {
                float sum = 0.0f;
                for (int i = 0; i < 10; i++) {
                    sum += data[idx] * i;
                }
                data[idx] = sum;
            }
        }
        "#;
        
        let mut parser = Parser::new(cuda_code);
        let ast = parser.parse().expect("Failed to parse CUDA code");
        
        let transpiler = Transpiler::new();
        let rust_code = transpiler.transpile(ast).expect("Failed to transpile");
        
        // For loops are translated to while loops
        assert!(rust_code.contains("while"));
        assert!(rust_code.contains("let mut i: i32 = 0"));
    }
    
    #[test]
    fn test_stencil_pattern() {
        let cuda_code = r#"
        __global__ void stencil2D(float* input, float* output, int width, int height) {
            int x = threadIdx.x + blockIdx.x * blockDim.x;
            int y = threadIdx.y + blockIdx.y * blockDim.y;
            
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                int idx = y * width + x;
                output[idx] = 0.2f * (input[idx] + 
                                     input[idx - 1] + 
                                     input[idx + 1] + 
                                     input[idx - width] + 
                                     input[idx + width]);
            }
        }
        "#;
        
        let mut parser = Parser::new(cuda_code);
        let ast = parser.parse().expect("Failed to parse CUDA code");
        
        let translator = KernelTranslator::new();
        if let Some(kernel) = ast.items.iter().find_map(|item| {
            if let crate::parser::ast::Item::Kernel(k) = item {
                Some(k)
            } else {
                None
            }
        }) {
            let pattern = translator.detect_pattern(kernel);
            assert_eq!(pattern, KernelPattern::Stencil);
        }
    }
    
    #[test]
    fn test_constant_memory() {
        let cuda_code = r#"
        __constant__ float coefficients[5] = {0.1f, 0.2f, 0.4f, 0.2f, 0.1f};
        
        __global__ void convolution(float* input, float* output, int n) {
            int idx = threadIdx.x + blockIdx.x * blockDim.x;
            if (idx >= 2 && idx < n - 2) {
                float sum = 0.0f;
                for (int i = -2; i <= 2; i++) {
                    sum += input[idx + i] * coefficients[i + 2];
                }
                output[idx] = sum;
            }
        }
        "#;
        
        let mut parser = Parser::new(cuda_code);
        let ast = parser.parse().expect("Failed to parse CUDA code");
        
        let transpiler = Transpiler::new();
        let rust_code = transpiler.transpile(ast).expect("Failed to transpile");
        
        assert!(rust_code.contains("#[constant]"));
        assert!(rust_code.contains("static coefficients"));
    }
}