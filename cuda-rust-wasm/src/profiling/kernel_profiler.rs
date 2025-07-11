//! Kernel execution profiling

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use crate::kernel::LaunchConfig;
use crate::error::CudaError;

/// Detailed kernel execution statistics
#[derive(Debug, Clone)]
pub struct KernelStats {
    pub name: String,
    pub launch_count: usize,
    pub total_time: Duration,
    pub average_time: Duration,
    pub min_time: Duration,
    pub max_time: Duration,
    pub total_threads: usize,
    pub total_blocks: usize,
    pub shared_memory_bytes: usize,
    pub occupancy: f32,
    pub throughput_gbps: f32,
    pub flops: f64,
}

impl KernelStats {
    pub fn new(name: String) -> Self {
        Self {
            name,
            launch_count: 0,
            total_time: Duration::ZERO,
            average_time: Duration::ZERO,
            min_time: Duration::MAX,
            max_time: Duration::ZERO,
            total_threads: 0,
            total_blocks: 0,
            shared_memory_bytes: 0,
            occupancy: 0.0,
            throughput_gbps: 0.0,
            flops: 0.0,
        }
    }

    pub fn record_launch(
        &mut self,
        duration: Duration,
        config: &LaunchConfig,
        bytes_processed: usize,
        operations: f64,
    ) {
        self.launch_count += 1;
        self.total_time += duration;
        self.average_time = self.total_time / self.launch_count as u32;
        
        if duration < self.min_time {
            self.min_time = duration;
        }
        if duration > self.max_time {
            self.max_time = duration;
        }
        
        // Calculate thread and block counts
        let blocks = config.grid_size.0 * config.grid_size.1 * config.grid_size.2;
        let threads_per_block = config.block_size.0 * config.block_size.1 * config.block_size.2;
        
        self.total_blocks += blocks as usize;
        self.total_threads += (blocks * threads_per_block) as usize;
        self.shared_memory_bytes += config.shared_mem_bytes;
        
        // Calculate throughput (GB/s)
        if duration.as_secs_f64() > 0.0 {
            self.throughput_gbps = (bytes_processed as f64 / 1e9) / duration.as_secs_f64() as f32;
            self.flops = operations / duration.as_secs_f64();
        }
        
        // Estimate occupancy (simplified - would need hardware specs for accurate calculation)
        let max_threads_per_sm = 2048; // Typical for modern GPUs
        let threads_per_sm = threads_per_block.min(max_threads_per_sm);
        self.occupancy = (threads_per_sm as f32 / max_threads_per_sm as f32) * 100.0;
    }

    pub fn print_summary(&self) {
        println!("\n=== Kernel: {} ===", self.name);
        println!("Launches: {}", self.launch_count);
        println!("Total time: {:?}", self.total_time);
        println!("Average time: {:?}", self.average_time);
        println!("Min/Max time: {:?} / {:?}", self.min_time, self.max_time);
        println!("Total threads: {}", self.total_threads);
        println!("Total blocks: {}", self.total_blocks);
        println!("Shared memory: {} bytes/launch", 
            self.shared_memory_bytes / self.launch_count.max(1));
        println!("Occupancy: {:.1}%", self.occupancy);
        println!("Throughput: {:.2} GB/s", self.throughput_gbps);
        println!("FLOPS: {:.2e}", self.flops);
    }
}

/// Profiler for kernel execution
pub struct KernelProfiler {
    stats: Arc<Mutex<HashMap<String, KernelStats>>>,
    enabled: bool,
}

impl KernelProfiler {
    pub fn new() -> Self {
        Self {
            stats: Arc::new(Mutex::new(HashMap::new())),
            enabled: false,
        }
    }

    pub fn enable(&mut self) {
        self.enabled = true;
    }

    pub fn disable(&mut self) {
        self.enabled = false;
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn start_kernel(&self, name: &str) -> KernelTimer {
        KernelTimer::new(name.to_string(), self.enabled)
    }

    pub fn end_kernel(
        &self,
        timer: KernelTimer,
        config: &LaunchConfig,
        bytes_processed: usize,
        operations: f64,
    ) {
        if !self.enabled || !timer.enabled {
            return;
        }

        let duration = timer.start.elapsed();
        let mut stats = self.stats.lock().unwrap();
        
        stats
            .entry(timer.name.clone())
            .or_insert_with(|| KernelStats::new(timer.name.clone()))
            .record_launch(duration, config, bytes_processed, operations);
    }

    pub fn get_stats(&self, name: &str) -> Option<KernelStats> {
        self.stats.lock().unwrap().get(name).cloned()
    }

    pub fn get_all_stats(&self) -> Vec<KernelStats> {
        self.stats.lock().unwrap().values().cloned().collect()
    }

    pub fn print_summary(&self) {
        let stats = self.stats.lock().unwrap();
        
        println!("\n========== KERNEL PROFILING SUMMARY ==========");
        
        // Sort by total time
        let mut sorted_stats: Vec<_> = stats.values().collect();
        sorted_stats.sort_by(|a, b| b.total_time.cmp(&a.total_time));
        
        for stat in sorted_stats {
            stat.print_summary();
        }
        
        // Overall statistics
        let total_time: Duration = stats.values().map(|s| s.total_time).sum();
        let total_launches: usize = stats.values().map(|s| s.launch_count).sum();
        
        println!("\n=== Overall Statistics ===");
        println!("Total kernels: {}", stats.len());
        println!("Total launches: {}", total_launches);
        println!("Total GPU time: {:?}", total_time);
        
        println!("==============================================\n");
    }

    pub fn export_json(&self, path: &str) -> Result<(), CudaError> {
        use std::fs::File;
        use std::io::Write;

        let stats = self.stats.lock().unwrap();
        let mut data = Vec::new();

        for stat in stats.values() {
            let json = format!(
                r#"{{
    "name": "{}",
    "launch_count": {},
    "total_time_us": {},
    "average_time_us": {},
    "min_time_us": {},
    "max_time_us": {},
    "total_threads": {},
    "total_blocks": {},
    "occupancy": {:.2},
    "throughput_gbps": {:.2},
    "flops": {:.2e}
}}"#,
                stat.name,
                stat.launch_count,
                stat.total_time.as_micros(),
                stat.average_time.as_micros(),
                stat.min_time.as_micros(),
                stat.max_time.as_micros(),
                stat.total_threads,
                stat.total_blocks,
                stat.occupancy,
                stat.throughput_gbps,
                stat.flops
            );
            data.push(json);
        }

        let mut file = File::create(path)?;
        writeln!(file, "[{}]", data.join(",\n"))?;

        Ok(())
    }

    pub fn clear(&self) {
        self.stats.lock().unwrap().clear();
    }

    /// Compare performance between two kernels
    pub fn compare_kernels(&self, kernel1: &str, kernel2: &str) -> Option<KernelComparison> {
        let stats = self.stats.lock().unwrap();
        
        let stat1 = stats.get(kernel1)?;
        let stat2 = stats.get(kernel2)?;
        
        Some(KernelComparison {
            kernel1: stat1.clone(),
            kernel2: stat2.clone(),
            speedup: stat1.average_time.as_secs_f64() / stat2.average_time.as_secs_f64(),
            throughput_ratio: stat2.throughput_gbps / stat1.throughput_gbps,
            flops_ratio: stat2.flops / stat1.flops,
        })
    }
}

/// Timer for kernel execution
pub struct KernelTimer {
    name: String,
    start: Instant,
    enabled: bool,
}

impl KernelTimer {
    fn new(name: String, enabled: bool) -> Self {
        Self {
            name,
            start: Instant::now(),
            enabled,
        }
    }
}

/// Comparison between two kernels
#[derive(Debug, Clone)]
pub struct KernelComparison {
    pub kernel1: KernelStats,
    pub kernel2: KernelStats,
    pub speedup: f64,
    pub throughput_ratio: f32,
    pub flops_ratio: f64,
}

impl KernelComparison {
    pub fn print_comparison(&self) {
        println!("\n=== Kernel Comparison ===");
        println!("Kernel 1: {}", self.kernel1.name);
        println!("Kernel 2: {}", self.kernel2.name);
        println!("\nPerformance:");
        println!("  Speedup: {:.2}x", self.speedup);
        println!("  Throughput ratio: {:.2}x", self.throughput_ratio);
        println!("  FLOPS ratio: {:.2}x", self.flops_ratio);
        println!("\nKernel 1 avg time: {:?}", self.kernel1.average_time);
        println!("Kernel 2 avg time: {:?}", self.kernel2.average_time);
    }
}

/// Roofline model for performance analysis
pub struct RooflineModel {
    pub peak_memory_bandwidth_gbps: f32,
    pub peak_compute_gflops: f32,
}

impl RooflineModel {
    pub fn new(peak_memory_bandwidth_gbps: f32, peak_compute_gflops: f32) -> Self {
        Self {
            peak_memory_bandwidth_gbps,
            peak_compute_gflops,
        }
    }

    pub fn analyze_kernel(&self, stats: &KernelStats, arithmetic_intensity: f32) -> RooflineAnalysis {
        let memory_bound_gflops = self.peak_memory_bandwidth_gbps * arithmetic_intensity;
        let achievable_gflops = memory_bound_gflops.min(self.peak_compute_gflops);
        let actual_gflops = (stats.flops / 1e9) as f32;
        
        let efficiency = actual_gflops / achievable_gflops * 100.0;
        let is_memory_bound = memory_bound_gflops < self.peak_compute_gflops;
        
        RooflineAnalysis {
            arithmetic_intensity,
            achievable_gflops,
            actual_gflops,
            efficiency,
            is_memory_bound,
            bottleneck: if is_memory_bound { "Memory" } else { "Compute" }.to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct RooflineAnalysis {
    pub arithmetic_intensity: f32,
    pub achievable_gflops: f32,
    pub actual_gflops: f32,
    pub efficiency: f32,
    pub is_memory_bound: bool,
    pub bottleneck: String,
}

impl RooflineAnalysis {
    pub fn print_analysis(&self) {
        println!("\n=== Roofline Analysis ===");
        println!("Arithmetic intensity: {:.2} FLOP/byte", self.arithmetic_intensity);
        println!("Achievable performance: {:.2} GFLOPS", self.achievable_gflops);
        println!("Actual performance: {:.2} GFLOPS", self.actual_gflops);
        println!("Efficiency: {:.1}%", self.efficiency);
        println!("Bottleneck: {}", self.bottleneck);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kernel_profiler() {
        let mut profiler = KernelProfiler::new();
        profiler.enable();

        let config = LaunchConfig {
            grid_size: (256, 1, 1),
            block_size: (256, 1, 1),
            shared_mem_bytes: 1024,
        };

        // Simulate kernel execution
        let timer = profiler.start_kernel("test_kernel");
        std::thread::sleep(Duration::from_millis(10));
        profiler.end_kernel(timer, &config, 1024 * 1024, 1000000.0);

        let stats = profiler.get_stats("test_kernel").unwrap();
        assert_eq!(stats.launch_count, 1);
        assert!(stats.total_time >= Duration::from_millis(10));
    }

    #[test]
    fn test_roofline_model() {
        let model = RooflineModel::new(1000.0, 5000.0); // 1TB/s, 5TFLOPS
        
        let mut stats = KernelStats::new("test".to_string());
        stats.flops = 1e12; // 1 TFLOPS actual
        
        // Memory bound scenario
        let analysis1 = model.analyze_kernel(&stats, 0.5); // Low arithmetic intensity
        assert!(analysis1.is_memory_bound);
        assert_eq!(analysis1.achievable_gflops, 500.0);
        
        // Compute bound scenario
        let analysis2 = model.analyze_kernel(&stats, 10.0); // High arithmetic intensity
        assert!(!analysis2.is_memory_bound);
        assert_eq!(analysis2.achievable_gflops, 5000.0);
    }
}