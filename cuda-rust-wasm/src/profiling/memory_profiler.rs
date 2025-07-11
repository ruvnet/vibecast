//! Memory usage profiling

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use crate::error::CudaError;

/// Memory allocation event
#[derive(Debug, Clone)]
pub struct AllocationEvent {
    pub timestamp: Instant,
    pub size: usize,
    pub address: usize,
    pub allocation_type: AllocationType,
    pub tag: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AllocationType {
    DeviceMemory,
    UnifiedMemory,
    PinnedMemory,
    SharedMemory,
}

/// Memory profiler for tracking allocations
pub struct MemoryProfiler {
    allocations: Arc<Mutex<HashMap<usize, AllocationEvent>>>,
    allocation_history: Arc<Mutex<Vec<AllocationEvent>>>,
    current_usage: Arc<Mutex<HashMap<AllocationType, usize>>>,
    peak_usage: Arc<Mutex<HashMap<AllocationType, usize>>>,
    enabled: bool,
}

impl MemoryProfiler {
    pub fn new() -> Self {
        let mut current_usage = HashMap::new();
        let mut peak_usage = HashMap::new();
        
        for alloc_type in &[
            AllocationType::DeviceMemory,
            AllocationType::UnifiedMemory,
            AllocationType::PinnedMemory,
            AllocationType::SharedMemory,
        ] {
            current_usage.insert(*alloc_type, 0);
            peak_usage.insert(*alloc_type, 0);
        }
        
        Self {
            allocations: Arc::new(Mutex::new(HashMap::new())),
            allocation_history: Arc::new(Mutex::new(Vec::new())),
            current_usage: Arc::new(Mutex::new(current_usage)),
            peak_usage: Arc::new(Mutex::new(peak_usage)),
            enabled: false,
        }
    }

    pub fn enable(&mut self) {
        self.enabled = true;
    }

    pub fn disable(&mut self) {
        self.enabled = false;
    }

    pub fn track_allocation(
        &self,
        address: usize,
        size: usize,
        alloc_type: AllocationType,
        tag: Option<String>,
    ) {
        if !self.enabled {
            return;
        }

        let event = AllocationEvent {
            timestamp: Instant::now(),
            size,
            address,
            allocation_type: alloc_type,
            tag,
        };

        // Record allocation
        {
            let mut allocations = self.allocations.lock().unwrap();
            allocations.insert(address, event.clone());
        }

        // Add to history
        {
            let mut history = self.allocation_history.lock().unwrap();
            history.push(event);
        }

        // Update usage
        {
            let mut current = self.current_usage.lock().unwrap();
            let mut peak = self.peak_usage.lock().unwrap();
            
            *current.get_mut(&alloc_type).unwrap() += size;
            
            let current_total = *current.get(&alloc_type).unwrap();
            let peak_total = peak.get_mut(&alloc_type).unwrap();
            
            if current_total > *peak_total {
                *peak_total = current_total;
            }
        }
    }

    pub fn track_deallocation(&self, address: usize) {
        if !self.enabled {
            return;
        }

        let mut allocations = self.allocations.lock().unwrap();
        
        if let Some(event) = allocations.remove(&address) {
            let mut current = self.current_usage.lock().unwrap();
            *current.get_mut(&event.allocation_type).unwrap() -= event.size;
        }
    }

    pub fn get_current_usage(&self) -> HashMap<AllocationType, usize> {
        self.current_usage.lock().unwrap().clone()
    }

    pub fn get_peak_usage(&self) -> HashMap<AllocationType, usize> {
        self.peak_usage.lock().unwrap().clone()
    }

    pub fn get_total_current_usage(&self) -> usize {
        self.current_usage.lock().unwrap().values().sum()
    }

    pub fn get_total_peak_usage(&self) -> usize {
        self.peak_usage.lock().unwrap().values().sum()
    }

    pub fn get_active_allocations(&self) -> Vec<AllocationEvent> {
        self.allocations.lock().unwrap().values().cloned().collect()
    }

    pub fn get_allocation_history(&self) -> Vec<AllocationEvent> {
        self.allocation_history.lock().unwrap().clone()
    }

    pub fn find_leaks(&self) -> Vec<AllocationEvent> {
        self.allocations.lock().unwrap().values().cloned().collect()
    }

    pub fn print_summary(&self) {
        println!("\n========== MEMORY PROFILING SUMMARY ==========");
        
        let current = self.get_current_usage();
        let peak = self.get_peak_usage();
        
        println!("\nCurrent Memory Usage:");
        for (alloc_type, size) in &current {
            println!("  {:?}: {} MB", alloc_type, size / (1024 * 1024));
        }
        println!("  Total: {} MB", self.get_total_current_usage() / (1024 * 1024));
        
        println!("\nPeak Memory Usage:");
        for (alloc_type, size) in &peak {
            println!("  {:?}: {} MB", alloc_type, size / (1024 * 1024));
        }
        println!("  Total: {} MB", self.get_total_peak_usage() / (1024 * 1024));
        
        let active_allocations = self.get_active_allocations();
        println!("\nActive Allocations: {}", active_allocations.len());
        
        // Show largest allocations
        let mut sorted_allocs = active_allocations.clone();
        sorted_allocs.sort_by(|a, b| b.size.cmp(&a.size));
        
        if !sorted_allocs.is_empty() {
            println!("\nLargest Active Allocations:");
            for (i, alloc) in sorted_allocs.iter().take(10).enumerate() {
                println!("  {}. {} MB - {:?} {}",
                    i + 1,
                    alloc.size / (1024 * 1024),
                    alloc.allocation_type,
                    alloc.tag.as_ref().unwrap_or(&"<untagged>".to_string())
                );
            }
        }
        
        println!("==============================================\n");
    }

    pub fn analyze_fragmentation(&self) -> FragmentationAnalysis {
        let allocations = self.allocations.lock().unwrap();
        
        if allocations.is_empty() {
            return FragmentationAnalysis {
                total_allocations: 0,
                total_size: 0,
                average_size: 0,
                fragmentation_score: 0.0,
                size_distribution: HashMap::new(),
            };
        }
        
        let total_allocations = allocations.len();
        let total_size: usize = allocations.values().map(|a| a.size).sum();
        let average_size = total_size / total_allocations;
        
        // Calculate size distribution
        let mut size_distribution: HashMap<String, usize> = HashMap::new();
        
        for alloc in allocations.values() {
            let size_category = match alloc.size {
                0..=1024 => "0-1KB",
                1025..=65536 => "1KB-64KB",
                65537..=1048576 => "64KB-1MB",
                1048577..=16777216 => "1MB-16MB",
                _ => ">16MB",
            };
            
            *size_distribution.entry(size_category.to_string()).or_insert(0) += 1;
        }
        
        // Simple fragmentation score based on allocation size variance
        let variance: f64 = allocations.values()
            .map(|a| {
                let diff = a.size as f64 - average_size as f64;
                diff * diff
            })
            .sum::<f64>() / total_allocations as f64;
        
        let std_dev = variance.sqrt();
        let fragmentation_score = (std_dev / average_size as f64).min(1.0) * 100.0;
        
        FragmentationAnalysis {
            total_allocations,
            total_size,
            average_size,
            fragmentation_score,
            size_distribution,
        }
    }

    pub fn export_timeline(&self, path: &str) -> Result<(), CudaError> {
        use std::fs::File;
        use std::io::Write;

        let history = self.allocation_history.lock().unwrap();
        let mut file = File::create(path)?;

        writeln!(file, "timestamp_us,event_type,size,allocation_type,tag")?;

        let start_time = history.first().map(|e| e.timestamp).unwrap_or_else(Instant::now);

        for event in history.iter() {
            let timestamp_us = event.timestamp.duration_since(start_time).as_micros();
            writeln!(
                file,
                "{},allocation,{},{:?},{}",
                timestamp_us,
                event.size,
                event.allocation_type,
                event.tag.as_ref().unwrap_or(&"".to_string())
            )?;
        }

        Ok(())
    }

    pub fn clear(&self) {
        self.allocations.lock().unwrap().clear();
        self.allocation_history.lock().unwrap().clear();
        
        let mut current = self.current_usage.lock().unwrap();
        for value in current.values_mut() {
            *value = 0;
        }
    }
}

#[derive(Debug, Clone)]
pub struct FragmentationAnalysis {
    pub total_allocations: usize,
    pub total_size: usize,
    pub average_size: usize,
    pub fragmentation_score: f64,
    pub size_distribution: HashMap<String, usize>,
}

impl FragmentationAnalysis {
    pub fn print_analysis(&self) {
        println!("\n=== Memory Fragmentation Analysis ===");
        println!("Total allocations: {}", self.total_allocations);
        println!("Total size: {} MB", self.total_size / (1024 * 1024));
        println!("Average allocation size: {} KB", self.average_size / 1024);
        println!("Fragmentation score: {:.1}%", self.fragmentation_score);
        
        println!("\nSize distribution:");
        let mut categories: Vec<_> = self.size_distribution.iter().collect();
        categories.sort_by_key(|(k, _)| k.as_str());
        
        for (category, count) in categories {
            println!("  {}: {} allocations", category, count);
        }
    }
}

/// Memory pressure monitor
pub struct MemoryPressureMonitor {
    threshold_percent: f32,
    total_memory: usize,
    callback: Option<Box<dyn Fn(MemoryPressureEvent) + Send + Sync>>,
}

#[derive(Debug, Clone)]
pub struct MemoryPressureEvent {
    pub current_usage: usize,
    pub total_memory: usize,
    pub usage_percent: f32,
    pub pressure_level: PressureLevel,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PressureLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl MemoryPressureMonitor {
    pub fn new(total_memory: usize, threshold_percent: f32) -> Self {
        Self {
            threshold_percent,
            total_memory,
            callback: None,
        }
    }

    pub fn set_callback<F>(&mut self, callback: F)
    where
        F: Fn(MemoryPressureEvent) + Send + Sync + 'static,
    {
        self.callback = Some(Box::new(callback));
    }

    pub fn check_pressure(&self, current_usage: usize) -> Option<MemoryPressureEvent> {
        let usage_percent = (current_usage as f32 / self.total_memory as f32) * 100.0;
        
        let pressure_level = match usage_percent {
            p if p < 50.0 => PressureLevel::Low,
            p if p < 75.0 => PressureLevel::Medium,
            p if p < 90.0 => PressureLevel::High,
            _ => PressureLevel::Critical,
        };
        
        let event = MemoryPressureEvent {
            current_usage,
            total_memory: self.total_memory,
            usage_percent,
            pressure_level,
        };
        
        if usage_percent >= self.threshold_percent {
            if let Some(callback) = &self.callback {
                callback(event.clone());
            }
            Some(event)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_profiler() {
        let mut profiler = MemoryProfiler::new();
        profiler.enable();

        // Track some allocations
        profiler.track_allocation(0x1000, 1024, AllocationType::DeviceMemory, Some("test1".to_string()));
        profiler.track_allocation(0x2000, 2048, AllocationType::DeviceMemory, Some("test2".to_string()));
        profiler.track_allocation(0x3000, 4096, AllocationType::UnifiedMemory, None);

        let current = profiler.get_current_usage();
        assert_eq!(current[&AllocationType::DeviceMemory], 3072);
        assert_eq!(current[&AllocationType::UnifiedMemory], 4096);

        // Track deallocation
        profiler.track_deallocation(0x1000);
        
        let current = profiler.get_current_usage();
        assert_eq!(current[&AllocationType::DeviceMemory], 2048);

        // Peak should remain unchanged
        let peak = profiler.get_peak_usage();
        assert_eq!(peak[&AllocationType::DeviceMemory], 3072);
    }

    #[test]
    fn test_fragmentation_analysis() {
        let mut profiler = MemoryProfiler::new();
        profiler.enable();

        // Create fragmented allocation pattern
        for i in 0..100 {
            let size = if i % 2 == 0 { 1024 } else { 1024 * 1024 };
            profiler.track_allocation(i, size, AllocationType::DeviceMemory, None);
        }

        let analysis = profiler.analyze_fragmentation();
        assert_eq!(analysis.total_allocations, 100);
        assert!(analysis.fragmentation_score > 0.0);
    }

    #[test]
    fn test_memory_pressure_monitor() {
        let mut monitor = MemoryPressureMonitor::new(1024 * 1024 * 1024, 80.0); // 1GB total, 80% threshold
        
        let low_pressure = monitor.check_pressure(500 * 1024 * 1024); // 50% usage
        assert!(low_pressure.is_none());
        
        let high_pressure = monitor.check_pressure(900 * 1024 * 1024); // 90% usage
        assert!(high_pressure.is_some());
        
        let event = high_pressure.unwrap();
        assert_eq!(event.pressure_level, PressureLevel::High);
    }
}