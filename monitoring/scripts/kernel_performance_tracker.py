#!/usr/bin/env python3
"""
Kernel Performance Tracking System
Monitors CUDA kernel execution and tracks performance metrics
"""

import os
import sys
import time
import json
import logging
import threading
import subprocess
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass, asdict
import numpy as np
import pandas as pd
from collections import defaultdict, deque
import matplotlib.pyplot as plt
import seaborn as sns

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/vibecast/kernel_performance.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class KernelExecution:
    """Single kernel execution record"""
    timestamp: datetime
    kernel_name: str
    device_id: int
    process_id: int
    process_name: str
    execution_time_ms: float
    grid_size: Tuple[int, int, int]
    block_size: Tuple[int, int, int]
    shared_memory_kb: float
    registers_per_thread: int
    occupancy: float
    achieved_bandwidth_gb_s: float
    compute_throughput_gflops: float
    memory_efficiency: float
    compute_efficiency: float
    cache_hit_rate: float
    warp_efficiency: float
    instruction_throughput: float
    stall_reasons: List[str]
    energy_consumed_joules: float

@dataclass
class KernelPerformanceProfile:
    """Kernel performance profile over time"""
    kernel_name: str
    device_id: int
    execution_count: int
    avg_execution_time_ms: float
    min_execution_time_ms: float
    max_execution_time_ms: float
    std_execution_time_ms: float
    avg_occupancy: float
    avg_memory_efficiency: float
    avg_compute_efficiency: float
    performance_trend: str  # 'improving', 'degrading', 'stable'
    bottleneck_analysis: List[str]
    optimization_recommendations: List[str]
    last_updated: datetime

@dataclass
class PerformanceAlert:
    """Performance degradation alert"""
    timestamp: datetime
    alert_type: str
    severity: str
    kernel_name: str
    device_id: int
    current_value: float
    baseline_value: float
    threshold_value: float
    description: str
    recommendations: List[str]

class KernelPerformanceTracker:
    """Advanced kernel performance tracking and analysis"""
    
    def __init__(self, config: Dict = None):
        self.config = config or self._default_config()
        self.running = False
        self.tracking_thread = None
        
        # Data storage
        self.kernel_executions = deque(maxlen=10000)  # Recent executions
        self.kernel_profiles = {}  # kernel_name -> KernelPerformanceProfile
        self.performance_alerts = []
        
        # Analysis parameters
        self.baseline_window = timedelta(hours=self.config.get('baseline_window_hours', 24))
        self.analysis_window = timedelta(minutes=self.config.get('analysis_window_minutes', 15))
        self.alert_thresholds = self.config.get('alert_thresholds', {})
        
        # Performance baselines
        self.baselines = {}  # kernel_name -> baseline metrics
        
        # Profiling tools
        self.profiling_active = False
        self.profiling_tools = ['nvprof', 'nsys', 'ncu']
        
    def _default_config(self) -> Dict:
        """Default configuration"""
        return {
            'baseline_window_hours': 24,
            'analysis_window_minutes': 15,
            'tracking_interval_seconds': 10,
            'profiling_interval_seconds': 60,
            'alert_thresholds': {
                'execution_time_degradation': 1.5,  # 50% increase
                'occupancy_degradation': 0.8,       # 20% decrease
                'memory_efficiency_degradation': 0.8,
                'compute_efficiency_degradation': 0.8
            },
            'target_kernels': [
                'quantum_navigation_kernel',
                'signal_processing_kernel',
                'compression_kernel',
                'multi_gpu_sync_kernel'
            ],
            'profiling_enabled': True,
            'advanced_metrics': True
        }
    
    def start_tracking(self):
        """Start kernel performance tracking"""
        if self.running:
            logger.warning("Kernel performance tracking already running")
            return
        
        self.running = True
        self.tracking_thread = threading.Thread(target=self._tracking_loop)
        self.tracking_thread.daemon = True
        self.tracking_thread.start()
        
        logger.info("Kernel performance tracking started")
    
    def _tracking_loop(self):
        """Main tracking loop"""
        tracking_interval = self.config.get('tracking_interval_seconds', 10)
        profiling_interval = self.config.get('profiling_interval_seconds', 60)
        
        last_profiling = datetime.now()
        
        while self.running:
            try:
                current_time = datetime.now()
                
                # Basic kernel execution tracking
                self._track_kernel_executions()
                
                # Advanced profiling (less frequent)
                if (current_time - last_profiling).total_seconds() >= profiling_interval:
                    if self.config.get('profiling_enabled', True):
                        self._run_advanced_profiling()
                    last_profiling = current_time
                
                # Performance analysis
                self._analyze_performance()
                
                # Check for alerts
                self._check_performance_alerts()
                
                time.sleep(tracking_interval)
                
            except Exception as e:
                logger.error(f"Error in tracking loop: {e}")
                time.sleep(tracking_interval)
    
    def _track_kernel_executions(self):
        """Track kernel executions using nvidia-smi and process monitoring"""
        try:
            # Get GPU process information
            cmd = "nvidia-smi pmon -i 0 -c 1 -s u"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode != 0:
                return
            
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if line.startswith('#') or not line.strip():
                    continue
                
                parts = line.split()
                if len(parts) >= 6:
                    gpu_id = int(parts[0])
                    pid = int(parts[1])
                    process_name = parts[2]
                    sm_util = float(parts[3]) if parts[3] != '-' else 0
                    mem_util = float(parts[4]) if parts[4] != '-' else 0
                    enc_util = float(parts[5]) if parts[5] != '-' else 0
                    dec_util = float(parts[6]) if len(parts) > 6 and parts[6] != '-' else 0
                    
                    # Create execution record (simplified)
                    execution = KernelExecution(
                        timestamp=datetime.now(),
                        kernel_name=f"{process_name}_kernel",
                        device_id=gpu_id,
                        process_id=pid,
                        process_name=process_name,
                        execution_time_ms=0,  # Would need more detailed profiling
                        grid_size=(0, 0, 0),
                        block_size=(0, 0, 0),
                        shared_memory_kb=0,
                        registers_per_thread=0,
                        occupancy=sm_util / 100.0,
                        achieved_bandwidth_gb_s=0,
                        compute_throughput_gflops=0,
                        memory_efficiency=mem_util / 100.0,
                        compute_efficiency=sm_util / 100.0,
                        cache_hit_rate=0,
                        warp_efficiency=0,
                        instruction_throughput=0,
                        stall_reasons=[],
                        energy_consumed_joules=0
                    )
                    
                    self.kernel_executions.append(execution)
                    
        except Exception as e:
            logger.debug(f"Error tracking kernel executions: {e}")
    
    def _run_advanced_profiling(self):
        """Run advanced profiling using NVIDIA tools"""
        if self.profiling_active:
            return
        
        self.profiling_active = True
        
        try:
            # Get list of running GPU processes
            gpu_processes = self._get_gpu_processes()
            
            for process_info in gpu_processes:
                pid = process_info['pid']
                process_name = process_info['name']
                
                # Skip if not a target process
                if not any(target in process_name for target in self.config.get('target_kernels', [])):
                    continue
                
                # Run profiling
                profiling_data = self._profile_process(pid, process_name)
                if profiling_data:
                    self._process_profiling_data(profiling_data)
                    
        except Exception as e:
            logger.error(f"Error in advanced profiling: {e}")
        finally:
            self.profiling_active = False
    
    def _get_gpu_processes(self) -> List[Dict]:
        """Get list of GPU processes"""
        processes = []
        
        try:
            cmd = "nvidia-smi --query-compute-apps=pid,name,used_memory --format=csv,noheader,nounits"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.strip():
                        parts = line.split(', ')
                        if len(parts) >= 3:
                            processes.append({
                                'pid': int(parts[0]),
                                'name': parts[1],
                                'memory_mb': int(parts[2])
                            })
                            
        except Exception as e:
            logger.debug(f"Error getting GPU processes: {e}")
        
        return processes
    
    def _profile_process(self, pid: int, process_name: str) -> Optional[Dict]:
        """Profile a specific process using NVIDIA tools"""
        try:
            # Use nsys for lightweight profiling
            with tempfile.NamedTemporaryFile(suffix='.nsys-rep', delete=False) as f:
                output_file = f.name
            
            cmd = [
                'nsys', 'profile',
                '--trace=cuda,cudnn,cublas',
                '--sample=cpu',
                '--duration=10',
                '--output', output_file,
                '--target-processes', str(pid)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                # Parse the profiling results
                stats = self._parse_nsys_output(output_file)
                return stats
            else:
                logger.debug(f"nsys profiling failed for PID {pid}: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            logger.warning(f"Profiling timeout for PID {pid}")
        except Exception as e:
            logger.debug(f"Error profiling process {pid}: {e}")
        finally:
            # Cleanup
            try:
                os.unlink(output_file)
            except:
                pass
        
        return None
    
    def _parse_nsys_output(self, output_file: str) -> Dict:
        """Parse nsys profiling output"""
        stats = {}
        
        try:
            # Use nsys stats to get kernel information
            cmd = ['nsys', 'stats', '--report', 'gputrace', '--format', 'csv', output_file]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                if len(lines) > 1:  # Skip header
                    # Parse CSV data
                    import csv
                    reader = csv.DictReader(lines)
                    
                    kernel_stats = []
                    for row in reader:
                        kernel_stats.append({
                            'name': row.get('Name', ''),
                            'duration_ns': float(row.get('Duration (ns)', 0)),
                            'grid_size': row.get('Grid Size', ''),
                            'block_size': row.get('Block Size', ''),
                            'registers': row.get('Registers Per Thread', 0),
                            'shared_memory': row.get('Shared Memory Size', 0)
                        })
                    
                    stats['kernels'] = kernel_stats
                    
        except Exception as e:
            logger.debug(f"Error parsing nsys output: {e}")
        
        return stats
    
    def _process_profiling_data(self, profiling_data: Dict):
        """Process profiling data and update kernel profiles"""
        kernels = profiling_data.get('kernels', [])
        
        for kernel_data in kernels:
            kernel_name = kernel_data['name']
            
            # Create detailed execution record
            execution = KernelExecution(
                timestamp=datetime.now(),
                kernel_name=kernel_name,
                device_id=0,  # Would need to extract from profiling
                process_id=0,
                process_name='',
                execution_time_ms=kernel_data['duration_ns'] / 1e6,
                grid_size=self._parse_grid_size(kernel_data.get('grid_size', '')),
                block_size=self._parse_block_size(kernel_data.get('block_size', '')),
                shared_memory_kb=float(kernel_data.get('shared_memory', 0)) / 1024,
                registers_per_thread=int(kernel_data.get('registers', 0)),
                occupancy=0,  # Would need additional analysis
                achieved_bandwidth_gb_s=0,
                compute_throughput_gflops=0,
                memory_efficiency=0,
                compute_efficiency=0,
                cache_hit_rate=0,
                warp_efficiency=0,
                instruction_throughput=0,
                stall_reasons=[],
                energy_consumed_joules=0
            )
            
            self.kernel_executions.append(execution)
            
            # Update kernel profile
            self._update_kernel_profile(kernel_name, execution)
    
    def _parse_grid_size(self, grid_str: str) -> Tuple[int, int, int]:
        """Parse grid size string"""
        try:
            if '(' in grid_str and ')' in grid_str:
                coords = grid_str.strip('()').split(',')
                return tuple(int(x.strip()) for x in coords)
        except:
            pass
        return (0, 0, 0)
    
    def _parse_block_size(self, block_str: str) -> Tuple[int, int, int]:
        """Parse block size string"""
        try:
            if '(' in block_str and ')' in block_str:
                coords = block_str.strip('()').split(',')
                return tuple(int(x.strip()) for x in coords)
        except:
            pass
        return (0, 0, 0)
    
    def _update_kernel_profile(self, kernel_name: str, execution: KernelExecution):
        """Update kernel performance profile"""
        if kernel_name not in self.kernel_profiles:
            self.kernel_profiles[kernel_name] = KernelPerformanceProfile(
                kernel_name=kernel_name,
                device_id=execution.device_id,
                execution_count=0,
                avg_execution_time_ms=0,
                min_execution_time_ms=float('inf'),
                max_execution_time_ms=0,
                std_execution_time_ms=0,
                avg_occupancy=0,
                avg_memory_efficiency=0,
                avg_compute_efficiency=0,
                performance_trend='stable',
                bottleneck_analysis=[],
                optimization_recommendations=[],
                last_updated=datetime.now()
            )
        
        profile = self.kernel_profiles[kernel_name]
        
        # Update statistics
        profile.execution_count += 1
        profile.min_execution_time_ms = min(profile.min_execution_time_ms, execution.execution_time_ms)
        profile.max_execution_time_ms = max(profile.max_execution_time_ms, execution.execution_time_ms)
        
        # Update averages (running average)
        alpha = 0.1  # Exponential smoothing factor
        profile.avg_execution_time_ms = (1 - alpha) * profile.avg_execution_time_ms + alpha * execution.execution_time_ms
        profile.avg_occupancy = (1 - alpha) * profile.avg_occupancy + alpha * execution.occupancy
        profile.avg_memory_efficiency = (1 - alpha) * profile.avg_memory_efficiency + alpha * execution.memory_efficiency
        profile.avg_compute_efficiency = (1 - alpha) * profile.avg_compute_efficiency + alpha * execution.compute_efficiency
        
        profile.last_updated = datetime.now()
        
        # Analyze performance trend
        self._analyze_performance_trend(kernel_name)
        
        # Update bottleneck analysis
        self._analyze_bottlenecks(kernel_name)
    
    def _analyze_performance_trend(self, kernel_name: str):
        """Analyze performance trend for a kernel"""
        # Get recent executions for this kernel
        recent_executions = [e for e in self.kernel_executions 
                           if e.kernel_name == kernel_name and 
                           e.timestamp > datetime.now() - self.analysis_window]
        
        if len(recent_executions) < 5:
            return
        
        # Calculate trend in execution time
        times = [(e.timestamp - recent_executions[0].timestamp).total_seconds() 
                for e in recent_executions]
        exec_times = [e.execution_time_ms for e in recent_executions]
        
        if len(set(exec_times)) > 1:
            # Linear regression
            coeffs = np.polyfit(times, exec_times, 1)
            trend_slope = coeffs[0]
            
            profile = self.kernel_profiles[kernel_name]
            
            if trend_slope > 0.1:  # Degrading
                profile.performance_trend = 'degrading'
            elif trend_slope < -0.1:  # Improving
                profile.performance_trend = 'improving'
            else:
                profile.performance_trend = 'stable'
    
    def _analyze_bottlenecks(self, kernel_name: str):
        """Analyze bottlenecks for a kernel"""
        profile = self.kernel_profiles[kernel_name]
        bottlenecks = []
        recommendations = []
        
        # Low occupancy
        if profile.avg_occupancy < 0.5:
            bottlenecks.append("Low occupancy")
            recommendations.append("Increase block size or reduce register/shared memory usage")
        
        # Memory efficiency
        if profile.avg_memory_efficiency < 0.7:
            bottlenecks.append("Low memory efficiency")
            recommendations.append("Optimize memory access patterns for coalescing")
        
        # Compute efficiency
        if profile.avg_compute_efficiency < 0.7:
            bottlenecks.append("Low compute efficiency")
            recommendations.append("Reduce branch divergence and improve instruction throughput")
        
        # High execution time variance
        if profile.max_execution_time_ms > profile.avg_execution_time_ms * 2:
            bottlenecks.append("High execution time variance")
            recommendations.append("Investigate inconsistent performance causes")
        
        profile.bottleneck_analysis = bottlenecks
        profile.optimization_recommendations = recommendations
    
    def _analyze_performance(self):
        """Analyze overall performance"""
        # Update baselines
        self._update_baselines()
        
        # Generate performance reports
        self._generate_performance_insights()
    
    def _update_baselines(self):
        """Update performance baselines"""
        cutoff_time = datetime.now() - self.baseline_window
        
        for kernel_name, profile in self.kernel_profiles.items():
            # Get baseline executions
            baseline_executions = [e for e in self.kernel_executions 
                                 if e.kernel_name == kernel_name and 
                                 e.timestamp > cutoff_time]
            
            if len(baseline_executions) >= 10:
                exec_times = [e.execution_time_ms for e in baseline_executions]
                occupancies = [e.occupancy for e in baseline_executions]
                
                self.baselines[kernel_name] = {
                    'avg_execution_time_ms': np.mean(exec_times),
                    'std_execution_time_ms': np.std(exec_times),
                    'avg_occupancy': np.mean(occupancies),
                    'sample_count': len(baseline_executions),
                    'last_updated': datetime.now()
                }
    
    def _generate_performance_insights(self):
        """Generate performance insights"""
        insights = []
        
        for kernel_name, profile in self.kernel_profiles.items():
            if profile.performance_trend == 'degrading':
                insights.append(f"Performance degradation detected in {kernel_name}")
            
            if profile.avg_occupancy < 0.3:
                insights.append(f"Very low occupancy in {kernel_name}: {profile.avg_occupancy:.1%}")
            
            if profile.bottleneck_analysis:
                insights.append(f"Bottlenecks in {kernel_name}: {', '.join(profile.bottleneck_analysis)}")
        
        if insights:
            logger.info(f"Performance insights: {'; '.join(insights)}")
    
    def _check_performance_alerts(self):
        """Check for performance alerts"""
        thresholds = self.alert_thresholds
        
        for kernel_name, profile in self.kernel_profiles.items():
            if kernel_name not in self.baselines:
                continue
            
            baseline = self.baselines[kernel_name]
            
            # Check execution time degradation
            if (profile.avg_execution_time_ms > 
                baseline['avg_execution_time_ms'] * thresholds.get('execution_time_degradation', 1.5)):
                
                alert = PerformanceAlert(
                    timestamp=datetime.now(),
                    alert_type='execution_time_degradation',
                    severity='warning',
                    kernel_name=kernel_name,
                    device_id=profile.device_id,
                    current_value=profile.avg_execution_time_ms,
                    baseline_value=baseline['avg_execution_time_ms'],
                    threshold_value=baseline['avg_execution_time_ms'] * thresholds.get('execution_time_degradation', 1.5),
                    description=f"Execution time increased by {((profile.avg_execution_time_ms / baseline['avg_execution_time_ms']) - 1) * 100:.1f}%",
                    recommendations=profile.optimization_recommendations
                )
                
                self._handle_performance_alert(alert)
            
            # Check occupancy degradation
            if (profile.avg_occupancy < 
                baseline['avg_occupancy'] * thresholds.get('occupancy_degradation', 0.8)):
                
                alert = PerformanceAlert(
                    timestamp=datetime.now(),
                    alert_type='occupancy_degradation',
                    severity='warning',
                    kernel_name=kernel_name,
                    device_id=profile.device_id,
                    current_value=profile.avg_occupancy,
                    baseline_value=baseline['avg_occupancy'],
                    threshold_value=baseline['avg_occupancy'] * thresholds.get('occupancy_degradation', 0.8),
                    description=f"Occupancy decreased by {((1 - profile.avg_occupancy / baseline['avg_occupancy']) * 100):.1f}%",
                    recommendations=profile.optimization_recommendations
                )
                
                self._handle_performance_alert(alert)
    
    def _handle_performance_alert(self, alert: PerformanceAlert):
        """Handle performance alert"""
        self.performance_alerts.append(alert)
        
        # Log alert
        logger.warning(f"PERFORMANCE ALERT: {alert.alert_type} in {alert.kernel_name} - {alert.description}")
        
        # Save alert details
        self._save_alert_report(alert)
    
    def _save_alert_report(self, alert: PerformanceAlert):
        """Save alert report"""
        try:
            report_dir = "/var/log/vibecast/performance_alerts"
            os.makedirs(report_dir, exist_ok=True)
            
            timestamp = alert.timestamp.strftime("%Y%m%d_%H%M%S")
            filename = f"{report_dir}/alert_{alert.kernel_name}_{timestamp}.json"
            
            with open(filename, 'w') as f:
                json.dump(asdict(alert), f, indent=2, default=str)
            
            logger.info(f"Saved performance alert report to {filename}")
            
        except Exception as e:
            logger.error(f"Failed to save alert report: {e}")
    
    def get_performance_summary(self) -> Dict:
        """Get performance summary"""
        summary = {
            'timestamp': datetime.now().isoformat(),
            'tracked_kernels': len(self.kernel_profiles),
            'total_executions': len(self.kernel_executions),
            'active_alerts': len([a for a in self.performance_alerts 
                                if a.timestamp > datetime.now() - timedelta(hours=1)]),
            'kernel_profiles': {}
        }
        
        for kernel_name, profile in self.kernel_profiles.items():
            summary['kernel_profiles'][kernel_name] = {
                'execution_count': profile.execution_count,
                'avg_execution_time_ms': profile.avg_execution_time_ms,
                'avg_occupancy': profile.avg_occupancy,
                'performance_trend': profile.performance_trend,
                'bottlenecks': profile.bottleneck_analysis
            }
        
        return summary
    
    def export_performance_report(self, output_path: str):
        """Export detailed performance report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': self.get_performance_summary(),
            'kernel_profiles': {name: asdict(profile) for name, profile in self.kernel_profiles.items()},
            'recent_alerts': [asdict(alert) for alert in self.performance_alerts[-10:]],
            'baselines': self.baselines,
            'configuration': self.config
        }
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        logger.info(f"Exported performance report to {output_path}")
    
    def stop_tracking(self):
        """Stop kernel performance tracking"""
        logger.info("Stopping kernel performance tracking")
        self.running = False
        
        if self.tracking_thread:
            self.tracking_thread.join(timeout=5)
        
        # Export final report
        final_report_path = f"/var/log/vibecast/final_performance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        self.export_performance_report(final_report_path)
        
        summary = self.get_performance_summary()
        logger.info(f"Kernel performance tracking stopped. Final summary: {summary}")


def main():
    """Main function"""
    config = {
        'baseline_window_hours': 24,
        'analysis_window_minutes': 15,
        'tracking_interval_seconds': 30,
        'profiling_interval_seconds': 120,
        'profiling_enabled': True,
        'target_kernels': [
            'quantum_navigation',
            'signal_processing',
            'compression',
            'multi_gpu_sync'
        ]
    }
    
    tracker = KernelPerformanceTracker(config)
    
    try:
        tracker.start_tracking()
        
        # Keep running until interrupted
        while True:
            time.sleep(30)
            
            # Print summary periodically
            summary = tracker.get_performance_summary()
            logger.info(f"Performance summary: {summary}")
            
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        tracker.stop_tracking()


if __name__ == "__main__":
    main()