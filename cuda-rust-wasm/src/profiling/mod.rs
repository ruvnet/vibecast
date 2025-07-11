//! Performance profiling tools for cuda-rust-wasm

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use crate::error::CudaError;

pub mod kernel_profiler;
pub mod memory_profiler;
pub mod runtime_profiler;

pub use kernel_profiler::KernelProfiler;
pub use memory_profiler::MemoryProfiler;
pub use runtime_profiler::RuntimeProfiler;

/// Performance metrics collected during profiling
#[derive(Debug, Clone)]
pub struct ProfileMetrics {
    pub name: String,
    pub total_time: Duration,
    pub average_time: Duration,
    pub min_time: Duration,
    pub max_time: Duration,
    pub count: usize,
    pub memory_allocated: usize,
    pub memory_freed: usize,
    pub peak_memory: usize,
    pub custom_metrics: HashMap<String, f64>,
}

impl ProfileMetrics {
    pub fn new(name: String) -> Self {
        Self {
            name,
            total_time: Duration::ZERO,
            average_time: Duration::ZERO,
            min_time: Duration::MAX,
            max_time: Duration::ZERO,
            count: 0,
            memory_allocated: 0,
            memory_freed: 0,
            peak_memory: 0,
            custom_metrics: HashMap::new(),
        }
    }

    pub fn record_duration(&mut self, duration: Duration) {
        self.total_time += duration;
        self.count += 1;
        self.average_time = self.total_time / self.count as u32;
        
        if duration < self.min_time {
            self.min_time = duration;
        }
        if duration > self.max_time {
            self.max_time = duration;
        }
    }

    pub fn print_summary(&self) {
        println!("\n=== Profile: {} ===", self.name);
        println!("Executions: {}", self.count);
        println!("Total time: {:?}", self.total_time);
        println!("Average time: {:?}", self.average_time);
        println!("Min time: {:?}", self.min_time);
        println!("Max time: {:?}", self.max_time);
        
        if self.memory_allocated > 0 || self.memory_freed > 0 {
            println!("\nMemory stats:");
            println!("  Allocated: {} bytes", self.memory_allocated);
            println!("  Freed: {} bytes", self.memory_freed);
            println!("  Peak usage: {} bytes", self.peak_memory);
        }
        
        if !self.custom_metrics.is_empty() {
            println!("\nCustom metrics:");
            for (key, value) in &self.custom_metrics {
                println!("  {}: {:.2}", key, value);
            }
        }
    }
}

/// Global profiler for collecting performance data
pub struct GlobalProfiler {
    profiles: Arc<Mutex<HashMap<String, ProfileMetrics>>>,
    enabled: Arc<Mutex<bool>>,
}

impl GlobalProfiler {
    pub fn new() -> Self {
        Self {
            profiles: Arc::new(Mutex::new(HashMap::new())),
            enabled: Arc::new(Mutex::new(false)),
        }
    }

    pub fn enable(&self) {
        *self.enabled.lock().unwrap() = true;
    }

    pub fn disable(&self) {
        *self.enabled.lock().unwrap() = false;
    }

    pub fn is_enabled(&self) -> bool {
        *self.enabled.lock().unwrap()
    }

    pub fn record_event(&self, name: &str, duration: Duration) {
        if !self.is_enabled() {
            return;
        }

        let mut profiles = self.profiles.lock().unwrap();
        profiles
            .entry(name.to_string())
            .or_insert_with(|| ProfileMetrics::new(name.to_string()))
            .record_duration(duration);
    }

    pub fn record_memory_event(&self, name: &str, allocated: usize, freed: usize) {
        if !self.is_enabled() {
            return;
        }

        let mut profiles = self.profiles.lock().unwrap();
        let profile = profiles
            .entry(name.to_string())
            .or_insert_with(|| ProfileMetrics::new(name.to_string()));
        
        profile.memory_allocated += allocated;
        profile.memory_freed += freed;
        
        let current_usage = profile.memory_allocated - profile.memory_freed;
        if current_usage > profile.peak_memory {
            profile.peak_memory = current_usage;
        }
    }

    pub fn record_custom_metric(&self, name: &str, metric_name: &str, value: f64) {
        if !self.is_enabled() {
            return;
        }

        let mut profiles = self.profiles.lock().unwrap();
        profiles
            .entry(name.to_string())
            .or_insert_with(|| ProfileMetrics::new(name.to_string()))
            .custom_metrics
            .insert(metric_name.to_string(), value);
    }

    pub fn get_profile(&self, name: &str) -> Option<ProfileMetrics> {
        self.profiles.lock().unwrap().get(name).cloned()
    }

    pub fn get_all_profiles(&self) -> Vec<ProfileMetrics> {
        self.profiles.lock().unwrap().values().cloned().collect()
    }

    pub fn print_all_summaries(&self) {
        let profiles = self.profiles.lock().unwrap();
        
        println!("\n========== PROFILING SUMMARY ==========");
        for profile in profiles.values() {
            profile.print_summary();
        }
        println!("======================================\n");
    }

    pub fn clear(&self) {
        self.profiles.lock().unwrap().clear();
    }

    pub fn export_csv(&self, path: &str) -> Result<(), CudaError> {
        use std::fs::File;
        use std::io::Write;

        let profiles = self.profiles.lock().unwrap();
        let mut file = File::create(path)?;

        // Write CSV header
        writeln!(file, "Name,Count,Total_us,Average_us,Min_us,Max_us,Memory_Allocated,Memory_Freed,Peak_Memory")?;

        // Write data
        for profile in profiles.values() {
            writeln!(
                file,
                "{},{},{},{},{},{},{},{},{}",
                profile.name,
                profile.count,
                profile.total_time.as_micros(),
                profile.average_time.as_micros(),
                profile.min_time.as_micros(),
                profile.max_time.as_micros(),
                profile.memory_allocated,
                profile.memory_freed,
                profile.peak_memory
            )?;
        }

        Ok(())
    }
}

/// Scoped timer for automatic duration measurement
pub struct ScopedTimer<'a> {
    profiler: &'a GlobalProfiler,
    name: String,
    start: Instant,
}

impl<'a> ScopedTimer<'a> {
    pub fn new(profiler: &'a GlobalProfiler, name: String) -> Self {
        Self {
            profiler,
            name,
            start: Instant::now(),
        }
    }
}

impl<'a> Drop for ScopedTimer<'a> {
    fn drop(&mut self) {
        let duration = self.start.elapsed();
        self.profiler.record_event(&self.name, duration);
    }
}

/// Macro for easy profiling
#[macro_export]
macro_rules! profile_scope {
    ($profiler:expr, $name:expr) => {
        let _timer = $crate::profiling::ScopedTimer::new($profiler, $name.to_string());
    };
}

/// Performance counter for tracking specific metrics
pub struct PerformanceCounter {
    name: String,
    value: Arc<Mutex<f64>>,
}

impl PerformanceCounter {
    pub fn new(name: String) -> Self {
        Self {
            name,
            value: Arc::new(Mutex::new(0.0)),
        }
    }

    pub fn increment(&self, amount: f64) {
        *self.value.lock().unwrap() += amount;
    }

    pub fn set(&self, value: f64) {
        *self.value.lock().unwrap() = value;
    }

    pub fn get(&self) -> f64 {
        *self.value.lock().unwrap()
    }

    pub fn reset(&self) {
        *self.value.lock().unwrap() = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_global_profiler() {
        let profiler = GlobalProfiler::new();
        profiler.enable();

        // Record some events
        profiler.record_event("test_op", Duration::from_millis(10));
        profiler.record_event("test_op", Duration::from_millis(20));
        profiler.record_event("test_op", Duration::from_millis(15));

        let profile = profiler.get_profile("test_op").unwrap();
        assert_eq!(profile.count, 3);
        assert_eq!(profile.total_time, Duration::from_millis(45));
        assert_eq!(profile.average_time, Duration::from_millis(15));
        assert_eq!(profile.min_time, Duration::from_millis(10));
        assert_eq!(profile.max_time, Duration::from_millis(20));
    }

    #[test]
    fn test_scoped_timer() {
        let profiler = GlobalProfiler::new();
        profiler.enable();

        {
            let _timer = ScopedTimer::new(&profiler, "scoped_test".to_string());
            thread::sleep(Duration::from_millis(10));
        }

        let profile = profiler.get_profile("scoped_test").unwrap();
        assert_eq!(profile.count, 1);
        assert!(profile.total_time >= Duration::from_millis(10));
    }

    #[test]
    fn test_memory_profiling() {
        let profiler = GlobalProfiler::new();
        profiler.enable();

        profiler.record_memory_event("memory_test", 1000, 0);
        profiler.record_memory_event("memory_test", 500, 200);
        profiler.record_memory_event("memory_test", 0, 800);

        let profile = profiler.get_profile("memory_test").unwrap();
        assert_eq!(profile.memory_allocated, 1500);
        assert_eq!(profile.memory_freed, 1000);
        assert_eq!(profile.peak_memory, 1300); // Peak was after second allocation
    }

    #[test]
    fn test_performance_counter() {
        let counter = PerformanceCounter::new("test_counter".to_string());
        
        counter.increment(10.0);
        counter.increment(5.0);
        assert_eq!(counter.get(), 15.0);
        
        counter.set(100.0);
        assert_eq!(counter.get(), 100.0);
        
        counter.reset();
        assert_eq!(counter.get(), 0.0);
    }
}