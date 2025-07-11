//! Common test utilities and helpers for cuda-rust-wasm tests

use cuda_rust_wasm::{
    transpiler::{CudaTranspiler, TranspilerOptions},
    kernel::{KernelLauncher, LaunchConfig, KernelModule},
    memory::{DeviceMemory, MemoryPool, AllocationStrategy},
    error::CudaError,
    runtime::{WasmRuntime, RuntimeOptions},
};
use std::path::PathBuf;
use std::time::{Duration, Instant};

/// Test configuration for benchmarking
pub struct BenchmarkConfig {
    pub warmup_iterations: usize,
    pub test_iterations: usize,
    pub timeout: Duration,
}

impl Default for BenchmarkConfig {
    fn default() -> Self {
        Self {
            warmup_iterations: 10,
            test_iterations: 100,
            timeout: Duration::from_secs(30),
        }
    }
}

/// Helper to create a test CUDA kernel
pub fn create_test_kernel(name: &str, code: &str) -> KernelModule {
    KernelModule::new(name.to_string(), code.to_string())
}

/// Helper to transpile CUDA code to WASM
pub fn transpile_cuda_to_wasm(cuda_code: &str) -> Result<Vec<u8>, CudaError> {
    let transpiler = CudaTranspiler::new(TranspilerOptions::default());
    transpiler.transpile(cuda_code)
}

/// Helper to create and initialize runtime
pub fn create_test_runtime() -> Result<WasmRuntime, CudaError> {
    let options = RuntimeOptions {
        memory_limit: 1024 * 1024 * 1024, // 1GB
        enable_profiling: true,
        optimization_level: 2,
    };
    WasmRuntime::new(options)
}

/// Helper to allocate device memory
pub fn allocate_test_memory<T>(size: usize) -> Result<DeviceMemory<T>, CudaError> {
    let pool = MemoryPool::new(AllocationStrategy::BestFit, 1024 * 1024 * 512)?; // 512MB pool
    pool.allocate(size)
}

/// Helper to measure execution time
pub fn measure_execution_time<F, R>(f: F) -> (R, Duration)
where
    F: FnOnce() -> R,
{
    let start = Instant::now();
    let result = f();
    let duration = start.elapsed();
    (result, duration)
}

/// Helper to run benchmarks with warmup
pub fn run_benchmark<F>(config: BenchmarkConfig, mut f: F) -> BenchmarkResult
where
    F: FnMut() -> Result<(), CudaError>,
{
    // Warmup phase
    for _ in 0..config.warmup_iterations {
        if let Err(e) = f() {
            return BenchmarkResult::error(e);
        }
    }

    // Benchmark phase
    let mut durations = Vec::with_capacity(config.test_iterations);
    let mut errors = 0;

    for _ in 0..config.test_iterations {
        let (result, duration) = measure_execution_time(|| f());
        
        match result {
            Ok(_) => durations.push(duration),
            Err(_) => errors += 1,
        }
    }

    BenchmarkResult::from_durations(durations, errors)
}

/// Benchmark result statistics
#[derive(Debug, Clone)]
pub struct BenchmarkResult {
    pub mean: Duration,
    pub median: Duration,
    pub min: Duration,
    pub max: Duration,
    pub std_dev: Duration,
    pub percentile_95: Duration,
    pub percentile_99: Duration,
    pub error_count: usize,
    pub sample_count: usize,
}

impl BenchmarkResult {
    fn from_durations(mut durations: Vec<Duration>, errors: usize) -> Self {
        if durations.is_empty() {
            return Self::empty(errors);
        }

        durations.sort();
        
        let sample_count = durations.len();
        let mean = durations.iter().sum::<Duration>() / sample_count as u32;
        let median = durations[sample_count / 2];
        let min = durations[0];
        let max = durations[sample_count - 1];
        
        // Calculate standard deviation
        let variance = durations.iter()
            .map(|d| {
                let diff = if *d > mean {
                    d.as_nanos() - mean.as_nanos()
                } else {
                    mean.as_nanos() - d.as_nanos()
                };
                diff * diff
            })
            .sum::<u128>() / sample_count as u128;
        
        let std_dev = Duration::from_nanos((variance as f64).sqrt() as u64);
        
        // Calculate percentiles
        let p95_idx = (sample_count as f64 * 0.95) as usize;
        let p99_idx = (sample_count as f64 * 0.99) as usize;
        
        Self {
            mean,
            median,
            min,
            max,
            std_dev,
            percentile_95: durations[p95_idx.min(sample_count - 1)],
            percentile_99: durations[p99_idx.min(sample_count - 1)],
            error_count: errors,
            sample_count,
        }
    }

    fn empty(errors: usize) -> Self {
        Self {
            mean: Duration::ZERO,
            median: Duration::ZERO,
            min: Duration::ZERO,
            max: Duration::ZERO,
            std_dev: Duration::ZERO,
            percentile_95: Duration::ZERO,
            percentile_99: Duration::ZERO,
            error_count: errors,
            sample_count: 0,
        }
    }

    fn error(e: CudaError) -> Self {
        Self::empty(1)
    }

    pub fn print_summary(&self) {
        println!("Benchmark Results:");
        println!("  Samples: {}", self.sample_count);
        println!("  Errors: {}", self.error_count);
        println!("  Mean: {:?}", self.mean);
        println!("  Median: {:?}", self.median);
        println!("  Min: {:?}", self.min);
        println!("  Max: {:?}", self.max);
        println!("  Std Dev: {:?}", self.std_dev);
        println!("  95th percentile: {:?}", self.percentile_95);
        println!("  99th percentile: {:?}", self.percentile_99);
    }
}

/// Helper to compare native CUDA vs WASM performance
pub struct PerformanceComparison {
    pub native_result: BenchmarkResult,
    pub wasm_result: BenchmarkResult,
}

impl PerformanceComparison {
    pub fn performance_ratio(&self) -> f64 {
        self.wasm_result.mean.as_nanos() as f64 / self.native_result.mean.as_nanos() as f64
    }

    pub fn meets_target(&self, target_percentage: f64) -> bool {
        self.performance_ratio() <= (100.0 / target_percentage)
    }

    pub fn print_comparison(&self) {
        println!("\nPerformance Comparison:");
        println!("Native CUDA:");
        self.native_result.print_summary();
        println!("\nWASM:");
        self.wasm_result.print_summary();
        println!("\nPerformance Ratio: {:.2}x slower", self.performance_ratio());
        println!("WASM achieves {:.1}% of native performance", 100.0 / self.performance_ratio());
    }
}

/// Test data generators
pub mod generators {
    use rand::{thread_rng, Rng};
    
    pub fn generate_float_array(size: usize) -> Vec<f32> {
        let mut rng = thread_rng();
        (0..size).map(|_| rng.gen_range(-1000.0..1000.0)).collect()
    }
    
    pub fn generate_int_array(size: usize) -> Vec<i32> {
        let mut rng = thread_rng();
        (0..size).map(|_| rng.gen_range(-1000000..1000000)).collect()
    }
    
    pub fn generate_matrix(rows: usize, cols: usize) -> Vec<f32> {
        generate_float_array(rows * cols)
    }
}

/// CUDA kernel templates for testing
pub mod kernel_templates {
    pub const VECTOR_ADD: &str = r#"
__global__ void vector_add(float* a, float* b, float* c, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}
"#;

    pub const MATRIX_MULTIPLY: &str = r#"
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

    pub const REDUCTION: &str = r#"
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_benchmark_result_calculation() {
        let durations = vec![
            Duration::from_millis(10),
            Duration::from_millis(12),
            Duration::from_millis(11),
            Duration::from_millis(13),
            Duration::from_millis(14),
        ];
        
        let result = BenchmarkResult::from_durations(durations, 0);
        
        assert_eq!(result.sample_count, 5);
        assert_eq!(result.error_count, 0);
        assert_eq!(result.min, Duration::from_millis(10));
        assert_eq!(result.max, Duration::from_millis(14));
        assert_eq!(result.median, Duration::from_millis(12));
    }
}