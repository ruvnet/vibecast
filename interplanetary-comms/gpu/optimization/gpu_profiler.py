"""
GPU Performance Profiler for Quantum Navigation System
Implements comprehensive profiling for CUDA kernels with nvprof and Nsight integration
"""

import os
import sys
import time
import json
import subprocess
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from dataclasses import dataclass, asdict
import pycuda.driver as cuda
import pycuda.autoinit
from pycuda import gpuarray
from pycuda.compiler import SourceModule

@dataclass
class KernelMetrics:
    """Metrics for individual kernel performance"""
    name: str
    execution_time_ms: float
    memory_bandwidth_gb_s: float
    occupancy: float
    registers_per_thread: int
    shared_memory_bytes: int
    global_memory_reads_gb: float
    global_memory_writes_gb: float
    sm_efficiency: float
    warp_efficiency: float
    cache_hit_rate: float
    flops_achieved: float
    
@dataclass
class OptimizationReport:
    """Comprehensive optimization report"""
    timestamp: str
    kernel_metrics: List[KernelMetrics]
    bottlenecks: List[str]
    recommendations: List[str]
    performance_gain: float
    memory_optimization_potential: float
    compute_optimization_potential: float

class GPUProfiler:
    """Advanced GPU profiling and optimization analysis"""
    
    def __init__(self):
        self.device = cuda.Device(0)
        self.context = self.device.make_context()
        self.device_properties = self._get_device_properties()
        self.baseline_metrics = {}
        self.optimization_history = []
        
    def _get_device_properties(self) -> Dict:
        """Get comprehensive GPU device properties"""
        props = {
            'name': self.device.name(),
            'compute_capability': self.device.compute_capability(),
            'total_memory_gb': self.device.total_memory() / (1024**3),
            'multiprocessor_count': self.device.get_attribute(cuda.device_attribute.MULTIPROCESSOR_COUNT),
            'max_threads_per_block': self.device.get_attribute(cuda.device_attribute.MAX_THREADS_PER_BLOCK),
            'max_threads_per_mp': self.device.get_attribute(cuda.device_attribute.MAX_THREADS_PER_MULTIPROCESSOR),
            'warp_size': self.device.get_attribute(cuda.device_attribute.WARP_SIZE),
            'max_shared_memory_per_block': self.device.get_attribute(cuda.device_attribute.MAX_SHARED_MEMORY_PER_BLOCK),
            'max_registers_per_block': self.device.get_attribute(cuda.device_attribute.MAX_REGISTERS_PER_BLOCK),
            'memory_clock_rate_khz': self.device.get_attribute(cuda.device_attribute.MEMORY_CLOCK_RATE),
            'memory_bus_width': self.device.get_attribute(cuda.device_attribute.GLOBAL_MEMORY_BUS_WIDTH),
            'l2_cache_size': self.device.get_attribute(cuda.device_attribute.L2_CACHE_SIZE),
        }
        
        # Calculate theoretical peak performance
        sm_clock_mhz = self.device.get_attribute(cuda.device_attribute.CLOCK_RATE) / 1000
        cores_per_sm = self._get_cores_per_sm(props['compute_capability'])
        props['theoretical_flops_tflops'] = (props['multiprocessor_count'] * cores_per_sm * sm_clock_mhz * 2) / 1e6
        props['theoretical_bandwidth_gb_s'] = (props['memory_clock_rate_khz'] * 2 * props['memory_bus_width'] / 8) / 1e6
        
        return props
    
    def _get_cores_per_sm(self, compute_capability: Tuple[int, int]) -> int:
        """Get CUDA cores per SM based on compute capability"""
        major, minor = compute_capability
        if major == 7:
            return 64  # Volta/Turing
        elif major == 8:
            return 64 if minor < 6 else 128  # Ampere
        elif major == 9:
            return 128  # Hopper
        else:
            return 32  # Default
    
    def profile_kernel(self, kernel_code: str, kernel_name: str, 
                      grid_dim: Tuple[int, int, int], 
                      block_dim: Tuple[int, int, int],
                      args: List, iterations: int = 100) -> KernelMetrics:
        """Profile a single kernel with detailed metrics"""
        
        # Compile kernel
        mod = SourceModule(kernel_code)
        kernel = mod.get_function(kernel_name)
        
        # Configure kernel
        kernel.prepare(args)
        
        # Warm up
        for _ in range(10):
            kernel.prepared_call(grid_dim, block_dim)
        
        # Profile execution time
        start_event = cuda.Event()
        end_event = cuda.Event()
        
        cuda.Context.synchronize()
        start_event.record()
        
        for _ in range(iterations):
            kernel.prepared_call(grid_dim, block_dim)
        
        end_event.record()
        end_event.synchronize()
        
        execution_time_ms = start_event.time_till(end_event) / iterations
        
        # Run nvprof for detailed metrics
        metrics = self._run_nvprof_analysis(kernel_code, kernel_name, grid_dim, block_dim, args)
        
        # Calculate occupancy
        occupancy = self._calculate_occupancy(kernel, block_dim)
        
        # Analyze memory patterns
        memory_metrics = self._analyze_memory_patterns(kernel_code, kernel_name)
        
        return KernelMetrics(
            name=kernel_name,
            execution_time_ms=execution_time_ms,
            memory_bandwidth_gb_s=metrics.get('memory_bandwidth', 0),
            occupancy=occupancy,
            registers_per_thread=kernel.num_regs,
            shared_memory_bytes=kernel.shared_size_bytes,
            global_memory_reads_gb=memory_metrics['reads_gb'],
            global_memory_writes_gb=memory_metrics['writes_gb'],
            sm_efficiency=metrics.get('sm_efficiency', 0),
            warp_efficiency=metrics.get('warp_efficiency', 0),
            cache_hit_rate=metrics.get('cache_hit_rate', 0),
            flops_achieved=metrics.get('flops_achieved', 0)
        )
    
    def _run_nvprof_analysis(self, kernel_code: str, kernel_name: str,
                            grid_dim: Tuple, block_dim: Tuple, args: List) -> Dict:
        """Run nvprof to get detailed performance metrics"""
        # Create temporary file for kernel
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.cu', delete=False) as f:
            f.write(kernel_code.encode())
            kernel_file = f.name
        
        try:
            # Run nvprof
            cmd = [
                'nvprof',
                '--metrics', 'gld_throughput,gst_throughput,sm_efficiency,achieved_occupancy,warp_execution_efficiency,l2_cache_hit_rate,flop_sp_efficiency',
                '--csv',
                'python', '-c', f'import pycuda.driver as cuda; cuda.init(); exec(open("{kernel_file}").read())'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            # Parse CSV output
            metrics = self._parse_nvprof_output(result.stdout)
            return metrics
        except Exception as e:
            print(f"Warning: nvprof analysis failed: {e}")
            return {}
        finally:
            os.unlink(kernel_file)
    
    def _parse_nvprof_output(self, output: str) -> Dict:
        """Parse nvprof CSV output"""
        metrics = {}
        lines = output.strip().split('\n')
        
        for line in lines:
            if ',' in line and not line.startswith('=='):
                parts = line.split(',')
                if len(parts) >= 8:
                    metric_name = parts[3].strip()
                    value = parts[7].strip()
                    
                    try:
                        # Convert percentages
                        if '%' in value:
                            value = float(value.replace('%', '')) / 100
                        else:
                            value = float(value)
                        
                        metrics[metric_name] = value
                    except:
                        pass
        
        return metrics
    
    def _calculate_occupancy(self, kernel, block_dim: Tuple[int, int, int]) -> float:
        """Calculate theoretical occupancy"""
        threads_per_block = block_dim[0] * block_dim[1] * block_dim[2]
        
        # Get limits
        max_threads_per_mp = self.device_properties['max_threads_per_mp']
        max_blocks_per_mp = 32  # Architecture dependent
        registers_per_mp = self.device_properties['max_registers_per_block']
        
        # Calculate limits
        reg_limit = registers_per_mp // (kernel.num_regs * threads_per_block) if kernel.num_regs > 0 else max_blocks_per_mp
        thread_limit = max_threads_per_mp // threads_per_block
        block_limit = max_blocks_per_mp
        
        blocks_per_mp = min(reg_limit, thread_limit, block_limit)
        active_threads = blocks_per_mp * threads_per_block
        
        return min(1.0, active_threads / max_threads_per_mp)
    
    def _analyze_memory_patterns(self, kernel_code: str, kernel_name: str) -> Dict:
        """Analyze memory access patterns in kernel"""
        # Simple pattern analysis - in production would use more sophisticated tools
        reads_gb = 0
        writes_gb = 0
        
        # Count memory operations in kernel code
        global_loads = kernel_code.count('__global__') * kernel_code.count('[')
        global_stores = kernel_code.count('=') - kernel_code.count('==')
        
        # Estimate based on typical data sizes
        element_size = 4  # float
        estimated_elements = 1024 * 1024  # 1M elements typical
        
        reads_gb = (global_loads * element_size * estimated_elements) / (1024**3)
        writes_gb = (global_stores * element_size * estimated_elements) / (1024**3)
        
        return {'reads_gb': reads_gb, 'writes_gb': writes_gb}
    
    def analyze_bottlenecks(self, metrics: List[KernelMetrics]) -> List[str]:
        """Identify performance bottlenecks"""
        bottlenecks = []
        
        for metric in metrics:
            # Memory bandwidth bottleneck
            bandwidth_utilization = metric.memory_bandwidth_gb_s / self.device_properties['theoretical_bandwidth_gb_s']
            if bandwidth_utilization > 0.8:
                bottlenecks.append(f"{metric.name}: Memory bandwidth limited ({bandwidth_utilization:.1%} utilization)")
            
            # Low occupancy
            if metric.occupancy < 0.5:
                bottlenecks.append(f"{metric.name}: Low occupancy ({metric.occupancy:.1%})")
            
            # Register pressure
            if metric.registers_per_thread > 32:
                bottlenecks.append(f"{metric.name}: High register pressure ({metric.registers_per_thread} registers)")
            
            # Low SM efficiency
            if metric.sm_efficiency < 0.7:
                bottlenecks.append(f"{metric.name}: Low SM efficiency ({metric.sm_efficiency:.1%})")
            
            # Poor cache utilization
            if metric.cache_hit_rate < 0.5:
                bottlenecks.append(f"{metric.name}: Poor cache utilization ({metric.cache_hit_rate:.1%} hit rate)")
        
        return bottlenecks
    
    def generate_optimization_recommendations(self, metrics: List[KernelMetrics], 
                                           bottlenecks: List[str]) -> List[str]:
        """Generate specific optimization recommendations"""
        recommendations = []
        
        for metric in metrics:
            # Memory optimizations
            if metric.memory_bandwidth_gb_s / self.device_properties['theoretical_bandwidth_gb_s'] > 0.8:
                recommendations.append(f"{metric.name}: Implement memory coalescing and use shared memory")
                recommendations.append(f"{metric.name}: Consider using texture memory for read-only data")
            
            # Occupancy optimizations
            if metric.occupancy < 0.5:
                if metric.registers_per_thread > 32:
                    recommendations.append(f"{metric.name}: Reduce register usage through variable reuse")
                if metric.shared_memory_bytes > 16384:
                    recommendations.append(f"{metric.name}: Reduce shared memory usage or use dynamic allocation")
                recommendations.append(f"{metric.name}: Adjust block dimensions for better occupancy")
            
            # Computation optimizations
            if metric.sm_efficiency < 0.7:
                recommendations.append(f"{metric.name}: Minimize divergent branches within warps")
                recommendations.append(f"{metric.name}: Use loop unrolling and instruction-level parallelism")
            
            # Cache optimizations
            if metric.cache_hit_rate < 0.5:
                recommendations.append(f"{metric.name}: Improve data locality and access patterns")
                recommendations.append(f"{metric.name}: Use __restrict__ pointers for better compiler optimization")
        
        return recommendations
    
    def optimize_kernel_parameters(self, kernel_code: str, kernel_name: str,
                                 data_size: int) -> Dict:
        """Auto-tune kernel parameters for optimal performance"""
        best_config = {
            'block_size': (32, 1, 1),
            'grid_size': (1, 1, 1),
            'execution_time': float('inf')
        }
        
        # Test different configurations
        block_sizes = [(32, 1, 1), (64, 1, 1), (128, 1, 1), (256, 1, 1),
                      (16, 16, 1), (32, 8, 1), (32, 32, 1)]
        
        for block_size in block_sizes:
            threads = block_size[0] * block_size[1] * block_size[2]
            if threads > self.device_properties['max_threads_per_block']:
                continue
            
            # Calculate grid size
            grid_size = ((data_size + threads - 1) // threads, 1, 1)
            
            # Profile configuration
            try:
                metrics = self.profile_kernel(kernel_code, kernel_name, 
                                           grid_size, block_size, [], iterations=10)
                
                if metrics.execution_time_ms < best_config['execution_time']:
                    best_config = {
                        'block_size': block_size,
                        'grid_size': grid_size,
                        'execution_time': metrics.execution_time_ms,
                        'occupancy': metrics.occupancy,
                        'bandwidth': metrics.memory_bandwidth_gb_s
                    }
            except:
                continue
        
        return best_config
    
    def generate_performance_report(self, kernel_metrics: List[KernelMetrics]) -> OptimizationReport:
        """Generate comprehensive performance optimization report"""
        bottlenecks = self.analyze_bottlenecks(kernel_metrics)
        recommendations = self.generate_optimization_recommendations(kernel_metrics, bottlenecks)
        
        # Calculate optimization potential
        memory_opt_potential = self._calculate_memory_optimization_potential(kernel_metrics)
        compute_opt_potential = self._calculate_compute_optimization_potential(kernel_metrics)
        
        # Calculate overall performance gain
        if self.baseline_metrics:
            current_time = sum(m.execution_time_ms for m in kernel_metrics)
            baseline_time = sum(self.baseline_metrics.get(m.name, m.execution_time_ms) 
                              for m in kernel_metrics)
            performance_gain = (baseline_time - current_time) / baseline_time if baseline_time > 0 else 0
        else:
            performance_gain = 0
            # Store baseline
            self.baseline_metrics = {m.name: m.execution_time_ms for m in kernel_metrics}
        
        report = OptimizationReport(
            timestamp=datetime.now().isoformat(),
            kernel_metrics=kernel_metrics,
            bottlenecks=bottlenecks,
            recommendations=recommendations,
            performance_gain=performance_gain,
            memory_optimization_potential=memory_opt_potential,
            compute_optimization_potential=compute_opt_potential
        )
        
        self.optimization_history.append(report)
        return report
    
    def _calculate_memory_optimization_potential(self, metrics: List[KernelMetrics]) -> float:
        """Calculate potential memory optimization improvements"""
        potential = 0.0
        
        for metric in metrics:
            # Check bandwidth utilization
            bandwidth_util = metric.memory_bandwidth_gb_s / self.device_properties['theoretical_bandwidth_gb_s']
            if bandwidth_util > 0.5:
                # Potential improvement through better access patterns
                potential += (1.0 - metric.cache_hit_rate) * 0.3
                
                # Potential from shared memory usage
                if metric.shared_memory_bytes < 1024:
                    potential += 0.2
        
        return min(1.0, potential / len(metrics)) if metrics else 0
    
    def _calculate_compute_optimization_potential(self, metrics: List[KernelMetrics]) -> float:
        """Calculate potential compute optimization improvements"""
        potential = 0.0
        
        for metric in metrics:
            # Low occupancy optimization potential
            if metric.occupancy < 0.7:
                potential += (0.7 - metric.occupancy)
            
            # SM efficiency improvements
            if metric.sm_efficiency < 0.8:
                potential += (0.8 - metric.sm_efficiency) * 0.5
            
            # Warp efficiency improvements
            if metric.warp_efficiency < 0.9:
                potential += (0.9 - metric.warp_efficiency) * 0.3
        
        return min(1.0, potential / len(metrics)) if metrics else 0
    
    def visualize_performance(self, report: OptimizationReport, output_path: str):
        """Create performance visualization dashboard"""
        fig, axes = plt.subplots(2, 3, figsize=(18, 10))
        fig.suptitle('GPU Performance Optimization Dashboard', fontsize=16)
        
        # Kernel execution times
        ax = axes[0, 0]
        kernel_names = [m.name for m in report.kernel_metrics]
        exec_times = [m.execution_time_ms for m in report.kernel_metrics]
        ax.bar(kernel_names, exec_times)
        ax.set_title('Kernel Execution Times')
        ax.set_ylabel('Time (ms)')
        ax.tick_params(axis='x', rotation=45)
        
        # Memory bandwidth utilization
        ax = axes[0, 1]
        bandwidth_utils = [m.memory_bandwidth_gb_s / self.device_properties['theoretical_bandwidth_gb_s'] 
                          for m in report.kernel_metrics]
        ax.bar(kernel_names, bandwidth_utils)
        ax.axhline(y=0.8, color='r', linestyle='--', label='80% threshold')
        ax.set_title('Memory Bandwidth Utilization')
        ax.set_ylabel('Utilization %')
        ax.set_ylim(0, 1.1)
        ax.legend()
        ax.tick_params(axis='x', rotation=45)
        
        # Occupancy
        ax = axes[0, 2]
        occupancies = [m.occupancy for m in report.kernel_metrics]
        ax.bar(kernel_names, occupancies)
        ax.axhline(y=0.5, color='r', linestyle='--', label='50% threshold')
        ax.set_title('Kernel Occupancy')
        ax.set_ylabel('Occupancy %')
        ax.set_ylim(0, 1.1)
        ax.legend()
        ax.tick_params(axis='x', rotation=45)
        
        # SM and Warp efficiency
        ax = axes[1, 0]
        sm_effs = [m.sm_efficiency for m in report.kernel_metrics]
        warp_effs = [m.warp_efficiency for m in report.kernel_metrics]
        x = np.arange(len(kernel_names))
        width = 0.35
        ax.bar(x - width/2, sm_effs, width, label='SM Efficiency')
        ax.bar(x + width/2, warp_effs, width, label='Warp Efficiency')
        ax.set_title('Execution Efficiency')
        ax.set_ylabel('Efficiency %')
        ax.set_xticks(x)
        ax.set_xticklabels(kernel_names, rotation=45)
        ax.legend()
        
        # Cache hit rates
        ax = axes[1, 1]
        cache_rates = [m.cache_hit_rate for m in report.kernel_metrics]
        ax.bar(kernel_names, cache_rates)
        ax.axhline(y=0.5, color='r', linestyle='--', label='50% threshold')
        ax.set_title('Cache Hit Rates')
        ax.set_ylabel('Hit Rate %')
        ax.set_ylim(0, 1.1)
        ax.legend()
        ax.tick_params(axis='x', rotation=45)
        
        # Optimization potential
        ax = axes[1, 2]
        categories = ['Memory\nOptimization', 'Compute\nOptimization', 'Overall\nGain']
        values = [report.memory_optimization_potential, 
                 report.compute_optimization_potential,
                 report.performance_gain]
        colors = ['blue', 'green', 'orange']
        ax.bar(categories, values, color=colors)
        ax.set_title('Optimization Potential')
        ax.set_ylabel('Potential Improvement %')
        ax.set_ylim(0, 1.1)
        
        # Add value labels on bars
        for i, v in enumerate(values):
            ax.text(i, v + 0.02, f'{v:.1%}', ha='center')
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        # Save detailed report
        report_path = output_path.replace('.png', '_report.json')
        with open(report_path, 'w') as f:
            json.dump(asdict(report), f, indent=2)
    
    def export_nsight_config(self, kernel_metrics: List[KernelMetrics], output_path: str):
        """Export configuration for NVIDIA Nsight profiling"""
        config = {
            'version': '2023.3',
            'project_name': 'VibeCast_GPU_Optimization',
            'kernels': [],
            'metrics': [
                'sm__cycles_elapsed.avg',
                'sm__cycles_elapsed.avg.per_second',
                'sm__throughput.avg.pct_of_peak_sustained_elapsed',
                'gpu__compute_memory_throughput.avg.pct_of_peak_sustained_elapsed',
                'l1tex__throughput.avg.pct_of_peak_sustained_active',
                'lts__throughput.avg.pct_of_peak_sustained_elapsed',
                'sm__warps_active.avg.pct_of_peak_sustained_active',
                'gpu__dram_throughput.avg.pct_of_peak_sustained_elapsed'
            ],
            'sampling': {
                'enabled': True,
                'interval_ms': 1,
                'buffer_size_mb': 256
            }
        }
        
        for metric in kernel_metrics:
            kernel_config = {
                'name': metric.name,
                'expected_runtime_ms': metric.execution_time_ms,
                'focus_metrics': []
            }
            
            # Add specific metrics based on bottlenecks
            if metric.memory_bandwidth_gb_s / self.device_properties['theoretical_bandwidth_gb_s'] > 0.8:
                kernel_config['focus_metrics'].extend([
                    'dram__bytes_read.sum',
                    'dram__bytes_write.sum',
                    'l1tex__data_bank_conflicts_pipe_lsu_mem_shared.sum'
                ])
            
            if metric.occupancy < 0.5:
                kernel_config['focus_metrics'].extend([
                    'sm__maximum_warps_per_active_cycle_pct',
                    'launch__registers_per_thread',
                    'launch__shared_mem_per_block_static'
                ])
            
            config['kernels'].append(kernel_config)
        
        with open(output_path, 'w') as f:
            json.dump(config, f, indent=2)
    
    def cleanup(self):
        """Clean up GPU context"""
        self.context.pop()
        self.context = None


# Example usage for testing
if __name__ == "__main__":
    profiler = GPUProfiler()
    
    # Example kernel code (placeholder)
    test_kernel = """
    __global__ void vector_add(float *a, float *b, float *c, int n) {
        int idx = blockIdx.x * blockDim.x + threadIdx.x;
        if (idx < n) {
            c[idx] = a[idx] + b[idx];
        }
    }
    """
    
    # Profile the kernel
    metrics = profiler.profile_kernel(test_kernel, "vector_add", 
                                    (256, 1, 1), (256, 1, 1), [], 100)
    
    # Generate report
    report = profiler.generate_performance_report([metrics])
    
    # Visualize results
    profiler.visualize_performance(report, 
                                  "/workspaces/vibecast/interplanetary-comms/gpu/optimization/performance_analysis.png")
    
    # Export Nsight config
    profiler.export_nsight_config([metrics], 
                                 "/workspaces/vibecast/interplanetary-comms/gpu/optimization/nsight_config.json")
    
    profiler.cleanup()