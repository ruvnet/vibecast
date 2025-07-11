//! Runtime performance profiling

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use crate::error::CudaError;

/// Runtime operation types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum OperationType {
    ModuleLoad,
    ModuleCompile,
    KernelLaunch,
    MemoryTransfer,
    Synchronization,
    RuntimeInit,
    RuntimeShutdown,
    Custom(u32),
}

/// Runtime operation event
#[derive(Debug, Clone)]
pub struct OperationEvent {
    pub operation_type: OperationType,
    pub name: String,
    pub start_time: Instant,
    pub duration: Duration,
    pub metadata: HashMap<String, String>,
}

/// Runtime profiler for tracking WASM runtime performance
pub struct RuntimeProfiler {
    events: Arc<Mutex<Vec<OperationEvent>>>,
    operation_stats: Arc<Mutex<HashMap<OperationType, OperationStats>>>,
    enabled: bool,
    start_time: Instant,
}

#[derive(Debug, Clone)]
pub struct OperationStats {
    pub count: usize,
    pub total_time: Duration,
    pub min_time: Duration,
    pub max_time: Duration,
    pub average_time: Duration,
}

impl OperationStats {
    fn new() -> Self {
        Self {
            count: 0,
            total_time: Duration::ZERO,
            min_time: Duration::MAX,
            max_time: Duration::ZERO,
            average_time: Duration::ZERO,
        }
    }

    fn update(&mut self, duration: Duration) {
        self.count += 1;
        self.total_time += duration;
        self.average_time = self.total_time / self.count as u32;
        
        if duration < self.min_time {
            self.min_time = duration;
        }
        if duration > self.max_time {
            self.max_time = duration;
        }
    }
}

impl RuntimeProfiler {
    pub fn new() -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            operation_stats: Arc::new(Mutex::new(HashMap::new())),
            enabled: false,
            start_time: Instant::now(),
        }
    }

    pub fn enable(&mut self) {
        self.enabled = true;
        self.start_time = Instant::now();
    }

    pub fn disable(&mut self) {
        self.enabled = false;
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn start_operation(&self, operation_type: OperationType, name: &str) -> OperationTimer {
        OperationTimer::new(
            self.enabled,
            operation_type,
            name.to_string(),
            Instant::now(),
        )
    }

    pub fn end_operation(&self, timer: OperationTimer, metadata: HashMap<String, String>) {
        if !self.enabled || !timer.enabled {
            return;
        }

        let duration = timer.start_time.elapsed();
        
        let event = OperationEvent {
            operation_type: timer.operation_type,
            name: timer.name,
            start_time: timer.start_time,
            duration,
            metadata,
        };

        // Record event
        {
            let mut events = self.events.lock().unwrap();
            events.push(event);
        }

        // Update statistics
        {
            let mut stats = self.operation_stats.lock().unwrap();
            stats
                .entry(timer.operation_type)
                .or_insert_with(OperationStats::new)
                .update(duration);
        }
    }

    pub fn get_events(&self) -> Vec<OperationEvent> {
        self.events.lock().unwrap().clone()
    }

    pub fn get_stats(&self) -> HashMap<OperationType, OperationStats> {
        self.operation_stats.lock().unwrap().clone()
    }

    pub fn get_total_runtime(&self) -> Duration {
        self.start_time.elapsed()
    }

    pub fn print_summary(&self) {
        println!("\n========== RUNTIME PROFILING SUMMARY ==========");
        
        let stats = self.get_stats();
        let total_runtime = self.get_total_runtime();
        
        println!("\nTotal Runtime: {:?}", total_runtime);
        
        // Sort operations by total time
        let mut sorted_ops: Vec<_> = stats.iter().collect();
        sorted_ops.sort_by(|a, b| b.1.total_time.cmp(&a.1.total_time));
        
        println!("\nOperation Statistics:");
        for (op_type, stat) in sorted_ops {
            let percentage = (stat.total_time.as_secs_f64() / total_runtime.as_secs_f64()) * 100.0;
            
            println!("\n{:?}:", op_type);
            println!("  Count: {}", stat.count);
            println!("  Total time: {:?} ({:.1}%)", stat.total_time, percentage);
            println!("  Average: {:?}", stat.average_time);
            println!("  Min/Max: {:?} / {:?}", stat.min_time, stat.max_time);
        }
        
        // Timeline analysis
        self.print_timeline_analysis();
        
        println!("==============================================\n");
    }

    fn print_timeline_analysis(&self) {
        let events = self.get_events();
        if events.is_empty() {
            return;
        }
        
        println!("\nTimeline Analysis:");
        
        // Find critical path
        let mut critical_path_time = Duration::ZERO;
        let mut last_end_time = self.start_time;
        
        for event in &events {
            let event_end = event.start_time + event.duration;
            if event.start_time >= last_end_time {
                critical_path_time += event.duration;
                last_end_time = event_end;
            }
        }
        
        println!("  Critical path time: {:?}", critical_path_time);
        println!("  Parallelization efficiency: {:.1}%", 
            (critical_path_time.as_secs_f64() / self.get_total_runtime().as_secs_f64()) * 100.0
        );
        
        // Find longest operations
        let mut longest_ops = events.clone();
        longest_ops.sort_by(|a, b| b.duration.cmp(&a.duration));
        
        println!("\n  Longest operations:");
        for (i, event) in longest_ops.iter().take(5).enumerate() {
            println!("    {}. {} ({:?}): {:?}",
                i + 1,
                event.name,
                event.operation_type,
                event.duration
            );
        }
    }

    pub fn export_trace(&self, path: &str) -> Result<(), CudaError> {
        use std::fs::File;
        use std::io::Write;

        let events = self.get_events();
        let mut file = File::create(path)?;

        // Write Chrome Tracing Format
        writeln!(file, "[")?;

        for (i, event) in events.iter().enumerate() {
            let start_us = event.start_time.duration_since(self.start_time).as_micros();
            let duration_us = event.duration.as_micros();
            
            let trace_event = format!(
                r#"{{
    "name": "{}",
    "cat": "{:?}",
    "ph": "X",
    "ts": {},
    "dur": {},
    "pid": 1,
    "tid": 1,
    "args": {{}}
}}"#,
                event.name,
                event.operation_type,
                start_us,
                duration_us
            );
            
            if i < events.len() - 1 {
                writeln!(file, "{},", trace_event)?;
            } else {
                writeln!(file, "{}", trace_event)?;
            }
        }

        writeln!(file, "]")?;

        Ok(())
    }

    pub fn analyze_bottlenecks(&self) -> BottleneckAnalysis {
        let stats = self.get_stats();
        let total_runtime = self.get_total_runtime();
        
        // Find operations that take most time
        let mut time_by_operation: Vec<_> = stats.iter()
            .map(|(op, stat)| (*op, stat.total_time))
            .collect();
        time_by_operation.sort_by(|a, b| b.1.cmp(&a.1));
        
        let primary_bottleneck = time_by_operation.first()
            .map(|(op, _)| *op)
            .unwrap_or(OperationType::Custom(0));
        
        // Calculate time distribution
        let mut time_distribution = HashMap::new();
        for (op, stat) in &stats {
            let percentage = (stat.total_time.as_secs_f64() / total_runtime.as_secs_f64()) * 100.0;
            time_distribution.insert(*op, percentage);
        }
        
        // Find operations with high variance
        let mut high_variance_ops = Vec::new();
        for (op, stat) in &stats {
            if stat.count > 1 {
                let range = stat.max_time.as_secs_f64() - stat.min_time.as_secs_f64();
                let variance_ratio = range / stat.average_time.as_secs_f64();
                if variance_ratio > 2.0 {
                    high_variance_ops.push((*op, variance_ratio));
                }
            }
        }
        
        BottleneckAnalysis {
            primary_bottleneck,
            time_distribution,
            high_variance_operations: high_variance_ops,
            total_runtime,
        }
    }

    pub fn clear(&self) {
        self.events.lock().unwrap().clear();
        self.operation_stats.lock().unwrap().clear();
    }
}

/// Timer for runtime operations
pub struct OperationTimer {
    enabled: bool,
    operation_type: OperationType,
    name: String,
    start_time: Instant,
}

impl OperationTimer {
    fn new(enabled: bool, operation_type: OperationType, name: String, start_time: Instant) -> Self {
        Self {
            enabled,
            operation_type,
            name,
            start_time,
        }
    }
}

/// Bottleneck analysis results
#[derive(Debug, Clone)]
pub struct BottleneckAnalysis {
    pub primary_bottleneck: OperationType,
    pub time_distribution: HashMap<OperationType, f64>,
    pub high_variance_operations: Vec<(OperationType, f64)>,
    pub total_runtime: Duration,
}

impl BottleneckAnalysis {
    pub fn print_analysis(&self) {
        println!("\n=== Bottleneck Analysis ===");
        println!("Total runtime: {:?}", self.total_runtime);
        println!("Primary bottleneck: {:?}", self.primary_bottleneck);
        
        println!("\nTime distribution:");
        let mut sorted_dist: Vec<_> = self.time_distribution.iter().collect();
        sorted_dist.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());
        
        for (op, percentage) in sorted_dist {
            println!("  {:?}: {:.1}%", op, percentage);
        }
        
        if !self.high_variance_operations.is_empty() {
            println!("\nHigh variance operations:");
            for (op, ratio) in &self.high_variance_operations {
                println!("  {:?}: {:.1}x variance", op, ratio);
            }
        }
    }
}

/// Performance optimization suggestions
pub struct OptimizationSuggestions {
    suggestions: Vec<Suggestion>,
}

#[derive(Debug, Clone)]
pub struct Suggestion {
    pub severity: SuggestionSeverity,
    pub category: SuggestionCategory,
    pub message: String,
    pub expected_improvement: Option<f64>,
}

#[derive(Debug, Clone, Copy)]
pub enum SuggestionSeverity {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy)]
pub enum SuggestionCategory {
    MemoryOptimization,
    KernelOptimization,
    RuntimeOptimization,
    Parallelization,
}

impl OptimizationSuggestions {
    pub fn analyze(profiler: &RuntimeProfiler) -> Self {
        let mut suggestions = Vec::new();
        let analysis = profiler.analyze_bottlenecks();
        
        // Check for module loading bottleneck
        if let Some(percentage) = analysis.time_distribution.get(&OperationType::ModuleLoad) {
            if *percentage > 20.0 {
                suggestions.push(Suggestion {
                    severity: SuggestionSeverity::High,
                    category: SuggestionCategory::RuntimeOptimization,
                    message: "Module loading takes >20% of runtime. Consider caching compiled modules.".to_string(),
                    expected_improvement: Some(percentage * 0.8),
                });
            }
        }
        
        // Check for compilation bottleneck
        if let Some(percentage) = analysis.time_distribution.get(&OperationType::ModuleCompile) {
            if *percentage > 30.0 {
                suggestions.push(Suggestion {
                    severity: SuggestionSeverity::High,
                    category: SuggestionCategory::RuntimeOptimization,
                    message: "Compilation takes >30% of runtime. Use pre-compiled WASM modules.".to_string(),
                    expected_improvement: Some(percentage * 0.9),
                });
            }
        }
        
        // Check for memory transfer bottleneck
        if let Some(percentage) = analysis.time_distribution.get(&OperationType::MemoryTransfer) {
            if *percentage > 40.0 {
                suggestions.push(Suggestion {
                    severity: SuggestionSeverity::High,
                    category: SuggestionCategory::MemoryOptimization,
                    message: "Memory transfers dominate runtime. Consider unified memory or reducing transfers.".to_string(),
                    expected_improvement: Some(percentage * 0.5),
                });
            }
        }
        
        Self { suggestions }
    }
    
    pub fn print_suggestions(&self) {
        if self.suggestions.is_empty() {
            println!("\nNo optimization suggestions found.");
            return;
        }
        
        println!("\n=== Optimization Suggestions ===");
        
        for (i, suggestion) in self.suggestions.iter().enumerate() {
            println!("\n{}. {:?} - {:?}", i + 1, suggestion.severity, suggestion.category);
            println!("   {}", suggestion.message);
            if let Some(improvement) = suggestion.expected_improvement {
                println!("   Expected improvement: {:.1}%", improvement);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_runtime_profiler() {
        let mut profiler = RuntimeProfiler::new();
        profiler.enable();

        // Simulate operations
        let timer1 = profiler.start_operation(OperationType::ModuleLoad, "test_module");
        std::thread::sleep(Duration::from_millis(10));
        profiler.end_operation(timer1, HashMap::new());

        let timer2 = profiler.start_operation(OperationType::KernelLaunch, "test_kernel");
        std::thread::sleep(Duration::from_millis(5));
        profiler.end_operation(timer2, HashMap::new());

        let stats = profiler.get_stats();
        assert_eq!(stats.len(), 2);
        assert_eq!(stats[&OperationType::ModuleLoad].count, 1);
        assert_eq!(stats[&OperationType::KernelLaunch].count, 1);
    }

    #[test]
    fn test_bottleneck_analysis() {
        let mut profiler = RuntimeProfiler::new();
        profiler.enable();

        // Create a bottleneck scenario
        for _ in 0..10 {
            let timer = profiler.start_operation(OperationType::MemoryTransfer, "transfer");
            std::thread::sleep(Duration::from_millis(10));
            profiler.end_operation(timer, HashMap::new());
        }

        let timer = profiler.start_operation(OperationType::KernelLaunch, "kernel");
        std::thread::sleep(Duration::from_millis(5));
        profiler.end_operation(timer, HashMap::new());

        let analysis = profiler.analyze_bottlenecks();
        assert_eq!(analysis.primary_bottleneck, OperationType::MemoryTransfer);
    }
}