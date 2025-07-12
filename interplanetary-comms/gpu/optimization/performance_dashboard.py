"""
Real-time GPU Performance Monitoring Dashboard
Provides live monitoring and visualization of GPU performance metrics
"""

import os
import json
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.gridspec import GridSpec
import seaborn as sns
import pynvml
import queue

@dataclass
class GPUMetrics:
    """Real-time GPU metrics"""
    timestamp: datetime
    gpu_utilization: float  # Percent
    memory_utilization: float  # Percent
    memory_used_gb: float
    memory_total_gb: float
    temperature_c: float
    power_draw_w: float
    clock_speed_mhz: int
    memory_clock_mhz: int
    pcie_throughput_mb: float
    fan_speed_percent: float
    
@dataclass
class KernelExecutionMetrics:
    """Metrics for kernel execution"""
    kernel_name: str
    start_time: datetime
    end_time: datetime
    execution_time_ms: float
    grid_size: Tuple[int, int, int]
    block_size: Tuple[int, int, int]
    shared_memory_kb: float
    registers_per_thread: int
    achieved_occupancy: float
    memory_throughput_gb_s: float
    compute_throughput_gflops: float

class PerformanceMonitor:
    """Real-time GPU performance monitoring"""
    
    def __init__(self, device_id: int = 0, history_minutes: int = 5):
        self.device_id = device_id
        self.history_minutes = history_minutes
        self.metrics_queue = queue.Queue()
        self.kernel_metrics_queue = queue.Queue()
        self.monitoring = False
        self.monitor_thread = None
        
        # Initialize NVML
        pynvml.nvmlInit()
        self.handle = pynvml.nvmlDeviceGetHandleByIndex(device_id)
        self.device_name = pynvml.nvmlDeviceGetName(self.handle).decode()
        
        # Historical data storage
        self.gpu_metrics_history: List[GPUMetrics] = []
        self.kernel_metrics_history: List[KernelExecutionMetrics] = []
        
        # Performance thresholds
        self.thresholds = {
            'gpu_utilization_high': 90,
            'memory_utilization_high': 85,
            'temperature_critical': 85,
            'power_limit_percent': 90
        }
        
        # Alerts
        self.alerts: List[Dict] = []
        
    def start_monitoring(self):
        """Start the monitoring thread"""
        if not self.monitoring:
            self.monitoring = True
            self.monitor_thread = threading.Thread(target=self._monitor_loop)
            self.monitor_thread.daemon = True
            self.monitor_thread.start()
    
    def stop_monitoring(self):
        """Stop the monitoring thread"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join()
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.monitoring:
            try:
                metrics = self._collect_gpu_metrics()
                self.metrics_queue.put(metrics)
                self.gpu_metrics_history.append(metrics)
                
                # Check for alerts
                self._check_alerts(metrics)
                
                # Clean old history
                self._clean_history()
                
                time.sleep(0.5)  # 2Hz sampling rate
            except Exception as e:
                print(f"Monitoring error: {e}")
                time.sleep(1)
    
    def _collect_gpu_metrics(self) -> GPUMetrics:
        """Collect current GPU metrics"""
        # GPU utilization
        util = pynvml.nvmlDeviceGetUtilizationRates(self.handle)
        gpu_util = util.gpu
        mem_util = util.memory
        
        # Memory info
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(self.handle)
        mem_used_gb = mem_info.used / (1024**3)
        mem_total_gb = mem_info.total / (1024**3)
        
        # Temperature
        try:
            temp = pynvml.nvmlDeviceGetTemperature(self.handle, 
                                                  pynvml.NVML_TEMPERATURE_GPU)
        except:
            temp = 0
        
        # Power
        try:
            power = pynvml.nvmlDeviceGetPowerUsage(self.handle) / 1000  # mW to W
        except:
            power = 0
        
        # Clocks
        try:
            gpu_clock = pynvml.nvmlDeviceGetClockInfo(self.handle, 
                                                     pynvml.NVML_CLOCK_GRAPHICS)
            mem_clock = pynvml.nvmlDeviceGetClockInfo(self.handle, 
                                                     pynvml.NVML_CLOCK_MEM)
        except:
            gpu_clock = 0
            mem_clock = 0
        
        # PCIe throughput
        try:
            pcie_tx = pynvml.nvmlDeviceGetPcieThroughput(self.handle, 
                                                        pynvml.NVML_PCIE_UTIL_TX_BYTES)
            pcie_rx = pynvml.nvmlDeviceGetPcieThroughput(self.handle, 
                                                        pynvml.NVML_PCIE_UTIL_RX_BYTES)
            pcie_throughput = (pcie_tx + pcie_rx) / (1024**2)  # MB/s
        except:
            pcie_throughput = 0
        
        # Fan speed
        try:
            fan_speed = pynvml.nvmlDeviceGetFanSpeed(self.handle)
        except:
            fan_speed = 0
        
        return GPUMetrics(
            timestamp=datetime.now(),
            gpu_utilization=gpu_util,
            memory_utilization=mem_util,
            memory_used_gb=mem_used_gb,
            memory_total_gb=mem_total_gb,
            temperature_c=temp,
            power_draw_w=power,
            clock_speed_mhz=gpu_clock,
            memory_clock_mhz=mem_clock,
            pcie_throughput_mb=pcie_throughput,
            fan_speed_percent=fan_speed
        )
    
    def _check_alerts(self, metrics: GPUMetrics):
        """Check for performance alerts"""
        alerts = []
        
        if metrics.gpu_utilization > self.thresholds['gpu_utilization_high']:
            alerts.append({
                'type': 'high_gpu_utilization',
                'severity': 'warning',
                'message': f'GPU utilization high: {metrics.gpu_utilization:.1f}%',
                'timestamp': metrics.timestamp
            })
        
        if metrics.memory_utilization > self.thresholds['memory_utilization_high']:
            alerts.append({
                'type': 'high_memory_utilization',
                'severity': 'warning',
                'message': f'Memory utilization high: {metrics.memory_utilization:.1f}%',
                'timestamp': metrics.timestamp
            })
        
        if metrics.temperature_c > self.thresholds['temperature_critical']:
            alerts.append({
                'type': 'high_temperature',
                'severity': 'critical',
                'message': f'GPU temperature critical: {metrics.temperature_c}°C',
                'timestamp': metrics.timestamp
            })
        
        # Throttling detection
        max_clock = 2100  # Typical max clock for high-end GPUs
        if metrics.clock_speed_mhz < max_clock * 0.8 and metrics.gpu_utilization > 80:
            alerts.append({
                'type': 'throttling',
                'severity': 'warning',
                'message': f'GPU may be throttling: {metrics.clock_speed_mhz} MHz',
                'timestamp': metrics.timestamp
            })
        
        self.alerts.extend(alerts)
    
    def _clean_history(self):
        """Remove old metrics from history"""
        cutoff = datetime.now() - timedelta(minutes=self.history_minutes)
        
        self.gpu_metrics_history = [m for m in self.gpu_metrics_history 
                                   if m.timestamp > cutoff]
        self.kernel_metrics_history = [m for m in self.kernel_metrics_history 
                                      if m.start_time > cutoff]
        self.alerts = [a for a in self.alerts if a['timestamp'] > cutoff]
    
    def record_kernel_execution(self, kernel_metrics: KernelExecutionMetrics):
        """Record kernel execution metrics"""
        self.kernel_metrics_queue.put(kernel_metrics)
        self.kernel_metrics_history.append(kernel_metrics)
    
    def create_live_dashboard(self, output_path: Optional[str] = None):
        """Create live performance dashboard"""
        fig = plt.figure(figsize=(20, 12))
        gs = GridSpec(4, 3, figure=fig, hspace=0.3, wspace=0.3)
        
        # GPU Utilization
        ax_gpu_util = fig.add_subplot(gs[0, 0])
        ax_gpu_util.set_title('GPU Utilization')
        ax_gpu_util.set_ylabel('Utilization %')
        ax_gpu_util.set_ylim(0, 105)
        line_gpu_util, = ax_gpu_util.plot([], [], 'b-', linewidth=2)
        
        # Memory Utilization
        ax_mem_util = fig.add_subplot(gs[0, 1])
        ax_mem_util.set_title('Memory Utilization')
        ax_mem_util.set_ylabel('Utilization %')
        ax_mem_util.set_ylim(0, 105)
        line_mem_util, = ax_mem_util.plot([], [], 'g-', linewidth=2)
        
        # Temperature and Power
        ax_temp_power = fig.add_subplot(gs[0, 2])
        ax_temp_power.set_title('Temperature & Power')
        ax_temp_power.set_ylabel('Temperature (°C)', color='r')
        ax_temp_power.tick_params(axis='y', labelcolor='r')
        line_temp, = ax_temp_power.plot([], [], 'r-', linewidth=2)
        
        ax_power = ax_temp_power.twinx()
        ax_power.set_ylabel('Power (W)', color='orange')
        ax_power.tick_params(axis='y', labelcolor='orange')
        line_power, = ax_power.plot([], [], 'orange', linewidth=2)
        
        # Clock Speeds
        ax_clocks = fig.add_subplot(gs[1, 0])
        ax_clocks.set_title('Clock Speeds')
        ax_clocks.set_ylabel('Frequency (MHz)')
        line_gpu_clock, = ax_clocks.plot([], [], 'b-', linewidth=2, label='GPU')
        line_mem_clock, = ax_clocks.plot([], [], 'g-', linewidth=2, label='Memory')
        ax_clocks.legend()
        
        # Memory Usage
        ax_memory = fig.add_subplot(gs[1, 1])
        ax_memory.set_title('Memory Usage')
        ax_memory.set_ylabel('Memory (GB)')
        
        # Kernel Performance
        ax_kernel = fig.add_subplot(gs[1, 2])
        ax_kernel.set_title('Recent Kernel Executions')
        ax_kernel.set_ylabel('Execution Time (ms)')
        
        # Throughput
        ax_throughput = fig.add_subplot(gs[2, :])
        ax_throughput.set_title('Memory Bandwidth & Compute Throughput')
        ax_throughput.set_ylabel('Throughput')
        
        # Alerts
        ax_alerts = fig.add_subplot(gs[3, :])
        ax_alerts.set_title('Alerts & Warnings')
        ax_alerts.axis('off')
        
        # Animation update function
        def update(frame):
            if not self.gpu_metrics_history:
                return
            
            # Get recent data
            recent_cutoff = datetime.now() - timedelta(seconds=30)
            recent_metrics = [m for m in self.gpu_metrics_history 
                            if m.timestamp > recent_cutoff]
            
            if not recent_metrics:
                return
            
            # Time axis
            times = [(m.timestamp - recent_metrics[0].timestamp).total_seconds() 
                    for m in recent_metrics]
            
            # Update GPU utilization
            gpu_utils = [m.gpu_utilization for m in recent_metrics]
            line_gpu_util.set_data(times, gpu_utils)
            ax_gpu_util.set_xlim(0, 30)
            
            # Update memory utilization
            mem_utils = [m.memory_utilization for m in recent_metrics]
            line_mem_util.set_data(times, mem_utils)
            ax_mem_util.set_xlim(0, 30)
            
            # Update temperature and power
            temps = [m.temperature_c for m in recent_metrics]
            powers = [m.power_draw_w for m in recent_metrics]
            line_temp.set_data(times, temps)
            line_power.set_data(times, powers)
            ax_temp_power.set_xlim(0, 30)
            ax_power.set_xlim(0, 30)
            
            # Update clocks
            gpu_clocks = [m.clock_speed_mhz for m in recent_metrics]
            mem_clocks = [m.memory_clock_mhz for m in recent_metrics]
            line_gpu_clock.set_data(times, gpu_clocks)
            line_mem_clock.set_data(times, mem_clocks)
            ax_clocks.set_xlim(0, 30)
            ax_clocks.relim()
            ax_clocks.autoscale_view()
            
            # Update memory usage bar
            ax_memory.clear()
            latest = recent_metrics[-1]
            ax_memory.bar(['Used', 'Free'], 
                         [latest.memory_used_gb, 
                          latest.memory_total_gb - latest.memory_used_gb],
                         color=['red', 'green'])
            ax_memory.set_ylim(0, latest.memory_total_gb * 1.1)
            ax_memory.set_title(f'Memory Usage ({latest.memory_used_gb:.1f}/{latest.memory_total_gb:.1f} GB)')
            
            # Update kernel performance
            ax_kernel.clear()
            recent_kernels = [k for k in self.kernel_metrics_history 
                            if k.start_time > recent_cutoff]
            if recent_kernels:
                kernel_names = [k.kernel_name for k in recent_kernels[-10:]]
                exec_times = [k.execution_time_ms for k in recent_kernels[-10:]]
                ax_kernel.barh(kernel_names, exec_times)
                ax_kernel.set_xlabel('Execution Time (ms)')
            
            # Update throughput
            ax_throughput.clear()
            if recent_kernels:
                kernel_times = [(k.start_time - recent_metrics[0].timestamp).total_seconds() 
                               for k in recent_kernels]
                mem_throughputs = [k.memory_throughput_gb_s for k in recent_kernels]
                compute_throughputs = [k.compute_throughput_gflops for k in recent_kernels]
                
                ax_throughput.plot(kernel_times, mem_throughputs, 'b-o', 
                                 label='Memory (GB/s)')
                ax_throughput_compute = ax_throughput.twinx()
                ax_throughput_compute.plot(kernel_times, compute_throughputs, 'g-o', 
                                         label='Compute (GFLOPS)')
                ax_throughput.set_xlim(0, 30)
                ax_throughput.legend(loc='upper left')
                ax_throughput_compute.legend(loc='upper right')
            
            # Update alerts
            ax_alerts.clear()
            ax_alerts.axis('off')
            recent_alerts = [a for a in self.alerts 
                           if a['timestamp'] > recent_cutoff]
            
            alert_text = "Recent Alerts:\n"
            for i, alert in enumerate(recent_alerts[-5:]):
                severity_color = 'red' if alert['severity'] == 'critical' else 'orange'
                alert_text += f"[{alert['timestamp'].strftime('%H:%M:%S')}] "
                alert_text += f"{alert['message']}\n"
            
            ax_alerts.text(0.05, 0.95, alert_text, transform=ax_alerts.transAxes,
                         verticalalignment='top', fontfamily='monospace')
            
            # Add current stats
            stats_text = f"Device: {self.device_name}\n"
            stats_text += f"Current GPU: {latest.gpu_utilization:.1f}%\n"
            stats_text += f"Current Mem: {latest.memory_utilization:.1f}%\n"
            stats_text += f"Temp: {latest.temperature_c}°C\n"
            stats_text += f"Power: {latest.power_draw_w:.1f}W"
            
            ax_alerts.text(0.7, 0.95, stats_text, transform=ax_alerts.transAxes,
                         verticalalignment='top', fontfamily='monospace',
                         bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        # Create animation
        ani = animation.FuncAnimation(fig, update, interval=500)  # Update every 500ms
        
        plt.suptitle(f'GPU Performance Dashboard - {self.device_name}', fontsize=16)
        
        if output_path:
            plt.savefig(output_path, dpi=150, bbox_inches='tight')
        else:
            plt.show()
        
        return fig, ani
    
    def generate_performance_report(self, output_path: str):
        """Generate comprehensive performance report"""
        report = {
            'device': self.device_name,
            'monitoring_period': {
                'start': min(m.timestamp for m in self.gpu_metrics_history).isoformat() 
                        if self.gpu_metrics_history else None,
                'end': max(m.timestamp for m in self.gpu_metrics_history).isoformat()
                       if self.gpu_metrics_history else None,
                'duration_minutes': self.history_minutes
            },
            'summary_statistics': self._calculate_summary_statistics(),
            'kernel_performance': self._analyze_kernel_performance(),
            'bottleneck_analysis': self._identify_bottlenecks(),
            'alerts_summary': self._summarize_alerts(),
            'recommendations': self._generate_recommendations()
        }
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        return report
    
    def _calculate_summary_statistics(self) -> Dict:
        """Calculate summary statistics from metrics history"""
        if not self.gpu_metrics_history:
            return {}
        
        df = pd.DataFrame([asdict(m) for m in self.gpu_metrics_history])
        
        return {
            'gpu_utilization': {
                'mean': df['gpu_utilization'].mean(),
                'max': df['gpu_utilization'].max(),
                'min': df['gpu_utilization'].min(),
                'std': df['gpu_utilization'].std()
            },
            'memory_utilization': {
                'mean': df['memory_utilization'].mean(),
                'max': df['memory_utilization'].max(),
                'peak_usage_gb': df['memory_used_gb'].max()
            },
            'temperature': {
                'mean': df['temperature_c'].mean(),
                'max': df['temperature_c'].max(),
                'min': df['temperature_c'].min()
            },
            'power': {
                'mean': df['power_draw_w'].mean(),
                'max': df['power_draw_w'].max(),
                'total_energy_kwh': df['power_draw_w'].sum() / (3600 * 1000 * 2)  # 2Hz sampling
            },
            'clock_speeds': {
                'gpu_mean_mhz': df['clock_speed_mhz'].mean(),
                'gpu_max_mhz': df['clock_speed_mhz'].max(),
                'memory_mean_mhz': df['memory_clock_mhz'].mean()
            }
        }
    
    def _analyze_kernel_performance(self) -> Dict:
        """Analyze kernel execution performance"""
        if not self.kernel_metrics_history:
            return {}
        
        kernel_stats = {}
        
        # Group by kernel name
        for kernel in self.kernel_metrics_history:
            name = kernel.kernel_name
            if name not in kernel_stats:
                kernel_stats[name] = {
                    'executions': 0,
                    'total_time_ms': 0,
                    'min_time_ms': float('inf'),
                    'max_time_ms': 0,
                    'avg_occupancy': 0,
                    'avg_memory_throughput_gb_s': 0,
                    'avg_compute_throughput_gflops': 0
                }
            
            stats = kernel_stats[name]
            stats['executions'] += 1
            stats['total_time_ms'] += kernel.execution_time_ms
            stats['min_time_ms'] = min(stats['min_time_ms'], kernel.execution_time_ms)
            stats['max_time_ms'] = max(stats['max_time_ms'], kernel.execution_time_ms)
            stats['avg_occupancy'] += kernel.achieved_occupancy
            stats['avg_memory_throughput_gb_s'] += kernel.memory_throughput_gb_s
            stats['avg_compute_throughput_gflops'] += kernel.compute_throughput_gflops
        
        # Calculate averages
        for name, stats in kernel_stats.items():
            n = stats['executions']
            stats['avg_time_ms'] = stats['total_time_ms'] / n
            stats['avg_occupancy'] /= n
            stats['avg_memory_throughput_gb_s'] /= n
            stats['avg_compute_throughput_gflops'] /= n
        
        return kernel_stats
    
    def _identify_bottlenecks(self) -> List[str]:
        """Identify performance bottlenecks"""
        bottlenecks = []
        
        if not self.gpu_metrics_history:
            return bottlenecks
        
        # Analyze GPU metrics
        df = pd.DataFrame([asdict(m) for m in self.gpu_metrics_history])
        
        # Consistent low GPU utilization
        if df['gpu_utilization'].mean() < 50:
            bottlenecks.append("Low GPU utilization - possible CPU bottleneck or inefficient kernels")
        
        # Memory bandwidth saturation
        if df['memory_utilization'].mean() > 90:
            bottlenecks.append("High memory utilization - memory bandwidth may be limiting factor")
        
        # Thermal throttling
        if df['temperature_c'].max() > 83:
            bottlenecks.append("High temperatures detected - possible thermal throttling")
        
        # Power throttling
        high_util_low_clock = (df['gpu_utilization'] > 80) & (df['clock_speed_mhz'] < 1500)
        if high_util_low_clock.any():
            bottlenecks.append("Clock speed drops during high utilization - power throttling likely")
        
        # Kernel analysis
        if self.kernel_metrics_history:
            avg_occupancy = np.mean([k.achieved_occupancy for k in self.kernel_metrics_history])
            if avg_occupancy < 0.5:
                bottlenecks.append("Low kernel occupancy - consider optimizing block dimensions")
        
        return bottlenecks
    
    def _summarize_alerts(self) -> Dict:
        """Summarize alerts by type and severity"""
        alert_summary = {
            'total_alerts': len(self.alerts),
            'by_severity': {},
            'by_type': {}
        }
        
        for alert in self.alerts:
            severity = alert['severity']
            alert_type = alert['type']
            
            alert_summary['by_severity'][severity] = alert_summary['by_severity'].get(severity, 0) + 1
            alert_summary['by_type'][alert_type] = alert_summary['by_type'].get(alert_type, 0) + 1
        
        return alert_summary
    
    def _generate_recommendations(self) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        if not self.gpu_metrics_history:
            return recommendations
        
        df = pd.DataFrame([asdict(m) for m in self.gpu_metrics_history])
        
        # GPU utilization recommendations
        avg_gpu_util = df['gpu_utilization'].mean()
        if avg_gpu_util < 50:
            recommendations.append("Increase batch size or parallelize more work to improve GPU utilization")
        elif avg_gpu_util > 95:
            recommendations.append("GPU is fully utilized - consider multi-GPU scaling")
        
        # Memory recommendations
        max_mem_used = df['memory_used_gb'].max()
        total_mem = df['memory_total_gb'].iloc[0]
        if max_mem_used / total_mem > 0.9:
            recommendations.append("Memory usage near limit - optimize memory allocation or use memory pooling")
        
        # Temperature recommendations
        if df['temperature_c'].max() > 80:
            recommendations.append("High temperatures observed - ensure adequate cooling")
        
        # Kernel recommendations
        if self.kernel_metrics_history:
            avg_occupancy = np.mean([k.achieved_occupancy for k in self.kernel_metrics_history])
            if avg_occupancy < 0.5:
                recommendations.append("Low kernel occupancy - tune block dimensions and reduce register usage")
            
            # Check for kernel diversity
            unique_kernels = len(set(k.kernel_name for k in self.kernel_metrics_history))
            if unique_kernels > 10:
                recommendations.append("Many different kernels - consider kernel fusion to reduce overhead")
        
        return recommendations
    
    def cleanup(self):
        """Clean up resources"""
        self.stop_monitoring()
        pynvml.nvmlShutdown()


# Example usage
if __name__ == "__main__":
    monitor = PerformanceMonitor(device_id=0)
    
    # Start monitoring
    monitor.start_monitoring()
    
    # Simulate some kernel executions
    import random
    for i in range(10):
        kernel_metrics = KernelExecutionMetrics(
            kernel_name=f"test_kernel_{i % 3}",
            start_time=datetime.now(),
            end_time=datetime.now() + timedelta(milliseconds=random.uniform(1, 10)),
            execution_time_ms=random.uniform(1, 10),
            grid_size=(256, 1, 1),
            block_size=(256, 1, 1),
            shared_memory_kb=16,
            registers_per_thread=32,
            achieved_occupancy=random.uniform(0.5, 0.9),
            memory_throughput_gb_s=random.uniform(100, 500),
            compute_throughput_gflops=random.uniform(1000, 5000)
        )
        monitor.record_kernel_execution(kernel_metrics)
        time.sleep(0.5)
    
    # Generate static dashboard
    time.sleep(2)  # Let some metrics accumulate
    monitor.create_live_dashboard(
        "/workspaces/vibecast/interplanetary-comms/gpu/optimization/performance_dashboard.png"
    )
    
    # Generate report
    report = monitor.generate_performance_report(
        "/workspaces/vibecast/interplanetary-comms/gpu/optimization/performance_report.json"
    )
    
    # Cleanup
    monitor.cleanup()