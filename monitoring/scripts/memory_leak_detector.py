#!/usr/bin/env python3
"""
Memory Leak Detection System for GPU Applications
Monitors memory usage patterns and detects potential leaks
"""

import os
import sys
import time
import json
import logging
import threading
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import numpy as np
import psutil
import pynvml
from collections import deque, defaultdict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/vibecast/memory_leak_detector.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class MemorySnapshot:
    """Memory usage snapshot"""
    timestamp: datetime
    process_id: int
    process_name: str
    gpu_device_id: int
    gpu_memory_used_mb: float
    gpu_memory_total_mb: float
    cpu_memory_used_mb: float
    cpu_memory_percent: float
    cuda_contexts: int
    active_kernels: int
    allocation_count: int
    free_count: int

@dataclass
class LeakDetection:
    """Memory leak detection result"""
    timestamp: datetime
    process_id: int
    process_name: str
    leak_type: str  # 'gpu_memory', 'cpu_memory', 'cuda_context'
    severity: str   # 'low', 'medium', 'high', 'critical'
    growth_rate_mb_per_minute: float
    total_leaked_mb: float
    detection_confidence: float
    recommendations: List[str]

class MemoryLeakDetector:
    """Advanced memory leak detection system"""
    
    def __init__(self, config: Dict = None):
        self.config = config or self._default_config()
        self.running = False
        self.monitor_thread = None
        
        # Data storage
        self.memory_history = defaultdict(deque)  # process_id -> deque of snapshots
        self.leak_detections = []
        
        # Analysis parameters
        self.history_window = timedelta(minutes=self.config.get('history_window_minutes', 30))
        self.detection_threshold = self.config.get('detection_threshold_mb_per_min', 10)
        self.min_samples = self.config.get('min_samples_for_detection', 10)
        
        # Initialize NVML
        try:
            pynvml.nvmlInit()
            self.device_count = pynvml.nvmlDeviceGetCount()
            logger.info(f"Initialized NVML with {self.device_count} GPU devices")
        except Exception as e:
            logger.error(f"Failed to initialize NVML: {e}")
            self.device_count = 0
        
        # Process tracking
        self.monitored_processes = set()
        self.process_patterns = self.config.get('process_patterns', [
            'quantum_navigation', 'signal_processor', 'multi_gpu_coordinator',
            'python.*cuda', 'python.*gpu', '.*\.cu$'
        ])
    
    def _default_config(self) -> Dict:
        """Default configuration"""
        return {
            'history_window_minutes': 30,
            'detection_threshold_mb_per_min': 10,
            'min_samples_for_detection': 10,
            'monitoring_interval_seconds': 30,
            'process_patterns': [
                'quantum_navigation', 'signal_processor', 'multi_gpu_coordinator'
            ],
            'alert_thresholds': {
                'low': 5,      # MB/min
                'medium': 15,  # MB/min
                'high': 30,    # MB/min
                'critical': 50 # MB/min
            }
        }
    
    def find_target_processes(self) -> List[psutil.Process]:
        """Find processes to monitor for memory leaks"""
        target_processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                proc_info = proc.info
                proc_name = proc_info['name']
                cmdline = ' '.join(proc_info['cmdline'] or [])
                
                # Check if process matches monitoring patterns
                for pattern in self.process_patterns:
                    if pattern in proc_name or pattern in cmdline:
                        target_processes.append(proc)
                        break
                        
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        logger.info(f"Found {len(target_processes)} processes to monitor")
        return target_processes
    
    def get_gpu_memory_usage(self, process_id: int) -> Dict[int, float]:
        """Get GPU memory usage for a specific process"""
        gpu_usage = {}
        
        for device_id in range(self.device_count):
            try:
                handle = pynvml.nvmlDeviceGetHandleByIndex(device_id)
                
                # Get running processes on this device
                try:
                    processes = pynvml.nvmlDeviceGetComputeRunningProcesses(handle)
                    for proc in processes:
                        if proc.pid == process_id:
                            gpu_usage[device_id] = proc.usedGpuMemory / (1024 * 1024)  # Convert to MB
                            break
                except:
                    # Try graphics processes if compute fails
                    try:
                        processes = pynvml.nvmlDeviceGetGraphicsRunningProcesses(handle)
                        for proc in processes:
                            if proc.pid == process_id:
                                gpu_usage[device_id] = proc.usedGpuMemory / (1024 * 1024)  # Convert to MB
                                break
                    except:
                        pass
                        
            except Exception as e:
                logger.debug(f"Error getting GPU memory for device {device_id}: {e}")
                continue
        
        return gpu_usage
    
    def get_cuda_context_info(self, process_id: int) -> Dict:
        """Get CUDA context information for a process"""
        try:
            # Use nvidia-smi to get context information
            cmd = f"nvidia-smi pmon -i 0 -c 1 | grep {process_id}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                contexts = len([line for line in lines if str(process_id) in line])
                return {'contexts': contexts, 'active_kernels': 0}  # Simplified
            else:
                return {'contexts': 0, 'active_kernels': 0}
                
        except Exception as e:
            logger.debug(f"Error getting CUDA context info for PID {process_id}: {e}")
            return {'contexts': 0, 'active_kernels': 0}
    
    def collect_memory_snapshot(self, process: psutil.Process) -> Optional[MemorySnapshot]:
        """Collect memory snapshot for a process"""
        try:
            # Basic process info
            process_id = process.pid
            process_name = process.name()
            
            # CPU memory usage
            memory_info = process.memory_info()
            cpu_memory_mb = memory_info.rss / (1024 * 1024)  # Convert to MB
            cpu_memory_percent = process.memory_percent()
            
            # GPU memory usage
            gpu_usage = self.get_gpu_memory_usage(process_id)
            primary_gpu_id = min(gpu_usage.keys()) if gpu_usage else -1
            gpu_memory_mb = gpu_usage.get(primary_gpu_id, 0)
            
            # Get total GPU memory for the primary device
            gpu_total_mb = 0
            if primary_gpu_id >= 0:
                try:
                    handle = pynvml.nvmlDeviceGetHandleByIndex(primary_gpu_id)
                    mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                    gpu_total_mb = mem_info.total / (1024 * 1024)
                except:
                    pass
            
            # CUDA context info
            cuda_info = self.get_cuda_context_info(process_id)
            
            # Create snapshot
            snapshot = MemorySnapshot(
                timestamp=datetime.now(),
                process_id=process_id,
                process_name=process_name,
                gpu_device_id=primary_gpu_id,
                gpu_memory_used_mb=gpu_memory_mb,
                gpu_memory_total_mb=gpu_total_mb,
                cpu_memory_used_mb=cpu_memory_mb,
                cpu_memory_percent=cpu_memory_percent,
                cuda_contexts=cuda_info['contexts'],
                active_kernels=cuda_info['active_kernels'],
                allocation_count=0,  # Would need specific tracking
                free_count=0
            )
            
            return snapshot
            
        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            logger.debug(f"Process {process.pid} no longer accessible: {e}")
            return None
        except Exception as e:
            logger.error(f"Error collecting memory snapshot for process {process.pid}: {e}")
            return None
    
    def analyze_memory_trends(self, process_id: int) -> List[LeakDetection]:
        """Analyze memory trends for leak detection"""
        if process_id not in self.memory_history:
            return []
        
        snapshots = list(self.memory_history[process_id])
        
        if len(snapshots) < self.min_samples:
            return []
        
        # Clean old snapshots
        cutoff_time = datetime.now() - self.history_window
        snapshots = [s for s in snapshots if s.timestamp > cutoff_time]
        
        if len(snapshots) < self.min_samples:
            return []
        
        detections = []
        
        # Analyze GPU memory trend
        gpu_leak = self._analyze_gpu_memory_trend(snapshots)
        if gpu_leak:
            detections.append(gpu_leak)
        
        # Analyze CPU memory trend
        cpu_leak = self._analyze_cpu_memory_trend(snapshots)
        if cpu_leak:
            detections.append(cpu_leak)
        
        # Analyze CUDA context leaks
        context_leak = self._analyze_cuda_context_trend(snapshots)
        if context_leak:
            detections.append(context_leak)
        
        return detections
    
    def _analyze_gpu_memory_trend(self, snapshots: List[MemorySnapshot]) -> Optional[LeakDetection]:
        """Analyze GPU memory usage trend"""
        if not snapshots or snapshots[0].gpu_device_id < 0:
            return None
        
        times = [(s.timestamp - snapshots[0].timestamp).total_seconds() / 60 for s in snapshots]
        gpu_memory = [s.gpu_memory_used_mb for s in snapshots]
        
        if len(set(gpu_memory)) < 2:  # No variation
            return None
        
        # Linear regression to find trend
        coeffs = np.polyfit(times, gpu_memory, 1)
        growth_rate = coeffs[0]  # MB per minute
        
        if growth_rate < self.detection_threshold:
            return None
        
        # Calculate R-squared for confidence
        predicted = np.polyval(coeffs, times)
        ss_tot = np.sum((gpu_memory - np.mean(gpu_memory)) ** 2)
        ss_res = np.sum((gpu_memory - predicted) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        # Determine severity
        thresholds = self.config['alert_thresholds']
        if growth_rate >= thresholds['critical']:
            severity = 'critical'
        elif growth_rate >= thresholds['high']:
            severity = 'high'
        elif growth_rate >= thresholds['medium']:
            severity = 'medium'
        else:
            severity = 'low'
        
        # Calculate total leaked memory
        total_leaked = gpu_memory[-1] - gpu_memory[0]
        
        # Generate recommendations
        recommendations = []
        if growth_rate > 20:
            recommendations.append("Immediate investigation required - rapid memory growth detected")
        recommendations.append("Check for unclosed CUDA contexts or unreleased device memory")
        recommendations.append("Review memory allocation patterns in recent code changes")
        recommendations.append("Consider implementing memory pooling to reduce fragmentation")
        
        return LeakDetection(
            timestamp=datetime.now(),
            process_id=snapshots[0].process_id,
            process_name=snapshots[0].process_name,
            leak_type='gpu_memory',
            severity=severity,
            growth_rate_mb_per_minute=growth_rate,
            total_leaked_mb=total_leaked,
            detection_confidence=r_squared,
            recommendations=recommendations
        )
    
    def _analyze_cpu_memory_trend(self, snapshots: List[MemorySnapshot]) -> Optional[LeakDetection]:
        """Analyze CPU memory usage trend"""
        times = [(s.timestamp - snapshots[0].timestamp).total_seconds() / 60 for s in snapshots]
        cpu_memory = [s.cpu_memory_used_mb for s in snapshots]
        
        if len(set(cpu_memory)) < 2:  # No variation
            return None
        
        # Linear regression
        coeffs = np.polyfit(times, cpu_memory, 1)
        growth_rate = coeffs[0]
        
        if growth_rate < self.detection_threshold:
            return None
        
        # Calculate confidence
        predicted = np.polyval(coeffs, times)
        ss_tot = np.sum((cpu_memory - np.mean(cpu_memory)) ** 2)
        ss_res = np.sum((cpu_memory - predicted) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        # Determine severity
        thresholds = self.config['alert_thresholds']
        if growth_rate >= thresholds['critical']:
            severity = 'critical'
        elif growth_rate >= thresholds['high']:
            severity = 'high'
        elif growth_rate >= thresholds['medium']:
            severity = 'medium'
        else:
            severity = 'low'
        
        total_leaked = cpu_memory[-1] - cpu_memory[0]
        
        recommendations = []
        recommendations.append("Check for memory leaks in host code")
        recommendations.append("Review dynamic memory allocations and ensure proper cleanup")
        recommendations.append("Consider using memory debugging tools like Valgrind")
        
        return LeakDetection(
            timestamp=datetime.now(),
            process_id=snapshots[0].process_id,
            process_name=snapshots[0].process_name,
            leak_type='cpu_memory',
            severity=severity,
            growth_rate_mb_per_minute=growth_rate,
            total_leaked_mb=total_leaked,
            detection_confidence=r_squared,
            recommendations=recommendations
        )
    
    def _analyze_cuda_context_trend(self, snapshots: List[MemorySnapshot]) -> Optional[LeakDetection]:
        """Analyze CUDA context accumulation"""
        context_counts = [s.cuda_contexts for s in snapshots]
        
        # Check for context accumulation
        if len(set(context_counts)) < 2:
            return None
        
        max_contexts = max(context_counts)
        min_contexts = min(context_counts)
        
        if max_contexts - min_contexts < 3:  # Not significant
            return None
        
        # Context leak detected
        recommendations = []
        recommendations.append("CUDA context leak detected - contexts not being properly destroyed")
        recommendations.append("Review CUDA initialization and cleanup code")
        recommendations.append("Ensure cuCtxDestroy() is called for all created contexts")
        
        return LeakDetection(
            timestamp=datetime.now(),
            process_id=snapshots[0].process_id,
            process_name=snapshots[0].process_name,
            leak_type='cuda_context',
            severity='high',
            growth_rate_mb_per_minute=0,
            total_leaked_mb=0,
            detection_confidence=1.0,
            recommendations=recommendations
        )
    
    def start_monitoring(self):
        """Start memory leak monitoring"""
        if self.running:
            logger.warning("Memory leak monitoring already running")
            return
        
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        
        logger.info("Memory leak monitoring started")
    
    def _monitoring_loop(self):
        """Main monitoring loop"""
        monitoring_interval = self.config.get('monitoring_interval_seconds', 30)
        
        while self.running:
            try:
                # Find target processes
                target_processes = self.find_target_processes()
                
                # Collect snapshots
                for process in target_processes:
                    snapshot = self.collect_memory_snapshot(process)
                    if snapshot:
                        process_id = snapshot.process_id
                        
                        # Add to history
                        self.memory_history[process_id].append(snapshot)
                        
                        # Keep only recent history
                        cutoff_time = datetime.now() - self.history_window
                        while (self.memory_history[process_id] and 
                               self.memory_history[process_id][0].timestamp < cutoff_time):
                            self.memory_history[process_id].popleft()
                        
                        # Analyze for leaks
                        detections = self.analyze_memory_trends(process_id)
                        for detection in detections:
                            self._handle_leak_detection(detection)
                
                time.sleep(monitoring_interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(monitoring_interval)
    
    def _handle_leak_detection(self, detection: LeakDetection):
        """Handle detected memory leak"""
        self.leak_detections.append(detection)
        
        # Log detection
        logger.warning(f"MEMORY LEAK DETECTED: {detection.leak_type} in process {detection.process_name} "
                      f"(PID: {detection.process_id}), Growth: {detection.growth_rate_mb_per_minute:.1f} MB/min, "
                      f"Severity: {detection.severity}")
        
        # Send alerts based on severity
        if detection.severity in ['high', 'critical']:
            self._send_alert(detection)
        
        # Save detection details
        self._save_detection_report(detection)
    
    def _send_alert(self, detection: LeakDetection):
        """Send alert for memory leak detection"""
        alert_data = {
            'timestamp': detection.timestamp.isoformat(),
            'process_name': detection.process_name,
            'process_id': detection.process_id,
            'leak_type': detection.leak_type,
            'severity': detection.severity,
            'growth_rate': detection.growth_rate_mb_per_minute,
            'total_leaked': detection.total_leaked_mb,
            'confidence': detection.detection_confidence,
            'recommendations': detection.recommendations
        }
        
        # Would integrate with alerting system
        logger.critical(f"MEMORY LEAK ALERT: {json.dumps(alert_data, indent=2)}")
    
    def _save_detection_report(self, detection: LeakDetection):
        """Save detailed detection report"""
        try:
            report_dir = "/var/log/vibecast/memory_leak_reports"
            os.makedirs(report_dir, exist_ok=True)
            
            timestamp = detection.timestamp.strftime("%Y%m%d_%H%M%S")
            filename = f"{report_dir}/leak_detection_{detection.process_name}_{timestamp}.json"
            
            with open(filename, 'w') as f:
                json.dump(asdict(detection), f, indent=2, default=str)
            
            logger.info(f"Saved leak detection report to {filename}")
            
        except Exception as e:
            logger.error(f"Failed to save detection report: {e}")
    
    def get_monitoring_summary(self) -> Dict:
        """Get monitoring summary"""
        summary = {
            'timestamp': datetime.now().isoformat(),
            'monitored_processes': len(self.memory_history),
            'active_detections': len([d for d in self.leak_detections 
                                    if d.timestamp > datetime.now() - timedelta(hours=1)]),
            'total_detections': len(self.leak_detections),
            'severity_breakdown': defaultdict(int)
        }
        
        for detection in self.leak_detections:
            summary['severity_breakdown'][detection.severity] += 1
        
        return summary
    
    def stop_monitoring(self):
        """Stop memory leak monitoring"""
        logger.info("Stopping memory leak monitoring")
        self.running = False
        
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        
        # Save final report
        summary = self.get_monitoring_summary()
        logger.info(f"Memory leak monitoring stopped. Final summary: {summary}")
        
        # Cleanup NVML
        try:
            pynvml.nvmlShutdown()
        except:
            pass


def main():
    """Main function"""
    config = {
        'history_window_minutes': 30,
        'detection_threshold_mb_per_min': 5,
        'monitoring_interval_seconds': 30,
        'process_patterns': [
            'quantum_navigation', 'signal_processor', 'multi_gpu_coordinator',
            'python.*cuda', 'python.*gpu'
        ]
    }
    
    detector = MemoryLeakDetector(config)
    
    try:
        detector.start_monitoring()
        
        # Keep running until interrupted
        while True:
            time.sleep(10)
            
            # Print summary periodically
            summary = detector.get_monitoring_summary()
            logger.info(f"Monitoring summary: {summary}")
            
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        detector.stop_monitoring()


if __name__ == "__main__":
    main()