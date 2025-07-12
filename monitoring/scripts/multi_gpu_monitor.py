#!/usr/bin/env python3
"""
Multi-GPU Coordination Monitor
Monitors multi-GPU coordination and synchronization
"""

import os
import sys
import time
import json
import logging
import threading
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass, asdict
import numpy as np
import pynvml
from collections import defaultdict, deque

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/vibecast/multi_gpu_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class GPUTopology:
    """GPU topology information"""
    device_count: int
    topology_matrix: List[List[int]]  # Connection types between GPUs
    p2p_capabilities: Dict[Tuple[int, int], bool]
    nvlink_connections: Dict[Tuple[int, int], int]  # Number of NVLink connections
    bandwidth_matrix: List[List[float]]  # GB/s between GPUs
    numa_affinity: Dict[int, int]  # GPU to NUMA node mapping

@dataclass
class SyncEvent:
    """Multi-GPU synchronization event"""
    timestamp: datetime
    event_type: str  # 'barrier', 'reduction', 'broadcast', 'p2p_copy'
    source_gpu: int
    target_gpu: Optional[int]
    data_size_mb: float
    duration_ms: float
    bandwidth_achieved_gb_s: float
    success: bool
    error_message: Optional[str]

@dataclass
class CoordinationMetrics:
    """Multi-GPU coordination metrics"""
    timestamp: datetime
    active_gpus: Set[int]
    total_sync_events: int
    failed_sync_events: int
    avg_sync_duration_ms: float
    max_sync_duration_ms: float
    p2p_transfer_rate_gb_s: float
    load_imbalance: float  # 0 = perfect balance, 1 = maximum imbalance
    coordination_efficiency: float  # 0-1 scale
    bottleneck_gpu: Optional[int]
    recommendations: List[str]

@dataclass
class MultiGPUAlert:
    """Multi-GPU coordination alert"""
    timestamp: datetime
    alert_type: str
    severity: str
    description: str
    affected_gpus: Set[int]
    impact_level: str  # 'low', 'medium', 'high', 'critical'
    recommended_actions: List[str]

class MultiGPUMonitor:
    """Multi-GPU coordination monitoring system"""
    
    def __init__(self, config: Dict = None):
        self.config = config or self._default_config()
        self.running = False
        self.monitor_thread = None
        
        # Initialize NVML
        try:
            pynvml.nvmlInit()
            self.device_count = pynvml.nvmlDeviceGetCount()
            logger.info(f"Initialized NVML with {self.device_count} GPU devices")
        except Exception as e:
            logger.error(f"Failed to initialize NVML: {e}")
            self.device_count = 0
        
        # Data storage
        self.sync_events = deque(maxlen=10000)
        self.coordination_metrics = deque(maxlen=1000)
        self.multi_gpu_alerts = []
        
        # GPU topology
        self.topology = self._discover_gpu_topology()
        
        # Monitoring state
        self.last_metrics = {}
        self.baseline_metrics = {}
        
        # Performance tracking
        self.performance_history = defaultdict(deque)
        
    def _default_config(self) -> Dict:
        """Default configuration"""
        return {
            'monitoring_interval_seconds': 15,
            'sync_detection_window_seconds': 60,
            'alert_thresholds': {
                'sync_failure_rate': 0.05,      # 5% failure rate
                'sync_duration_threshold_ms': 100,
                'load_imbalance_threshold': 0.3,
                'bandwidth_degradation_threshold': 0.7
            },
            'coordination_patterns': [
                'allreduce',
                'allgather',
                'broadcast',
                'reduce_scatter',
                'p2p_copy'
            ]
        }
    
    def _discover_gpu_topology(self) -> GPUTopology:
        """Discover GPU topology and capabilities"""
        if self.device_count == 0:
            return GPUTopology(0, [], {}, {}, [], {})
        
        # Initialize topology matrix
        topology_matrix = [[0 for _ in range(self.device_count)] for _ in range(self.device_count)]
        p2p_capabilities = {}
        nvlink_connections = {}
        bandwidth_matrix = [[0.0 for _ in range(self.device_count)] for _ in range(self.device_count)]
        numa_affinity = {}
        
        for i in range(self.device_count):
            try:
                handle_i = pynvml.nvmlDeviceGetHandleByIndex(i)
                
                # Get NUMA affinity
                try:
                    numa_node = pynvml.nvmlDeviceGetCpuAffinity(handle_i, 1)[0]
                    numa_affinity[i] = numa_node
                except:
                    numa_affinity[i] = 0
                
                for j in range(self.device_count):
                    if i == j:
                        continue
                    
                    try:
                        handle_j = pynvml.nvmlDeviceGetHandleByIndex(j)
                        
                        # Check P2P capability
                        can_access = pynvml.nvmlDeviceGetP2PStatus(handle_i, handle_j, 
                                                                 pynvml.NVML_P2P_CAPS_INDEX_READ)
                        p2p_capabilities[(i, j)] = (can_access == pynvml.NVML_P2P_STATUS_OK)
                        
                        # Get topology relationship
                        try:
                            topo = pynvml.nvmlDeviceGetTopologyCommonAncestor(handle_i, handle_j)
                            topology_matrix[i][j] = topo
                            
                            # Estimate bandwidth based on topology
                            if topo == pynvml.NVML_TOPOLOGY_INTERNAL:
                                bandwidth_matrix[i][j] = 600.0  # NVLink bandwidth
                            elif topo == pynvml.NVML_TOPOLOGY_SINGLE:
                                bandwidth_matrix[i][j] = 50.0   # PCIe bandwidth
                            elif topo == pynvml.NVML_TOPOLOGY_MULTIPLE:
                                bandwidth_matrix[i][j] = 25.0   # Cross-socket
                            elif topo == pynvml.NVML_TOPOLOGY_HOSTBRIDGE:
                                bandwidth_matrix[i][j] = 12.0   # Host bridge
                            elif topo == pynvml.NVML_TOPOLOGY_NODE:
                                bandwidth_matrix[i][j] = 6.0    # NUMA node
                            elif topo == pynvml.NVML_TOPOLOGY_SYSTEM:
                                bandwidth_matrix[i][j] = 3.0    # System level
                            else:
                                bandwidth_matrix[i][j] = 1.0    # Unknown
                                
                        except Exception as e:
                            logger.debug(f"Error getting topology between GPU {i} and {j}: {e}")
                            topology_matrix[i][j] = pynvml.NVML_TOPOLOGY_SYSTEM
                            bandwidth_matrix[i][j] = 1.0
                            
                        # Count NVLink connections (simplified)
                        if bandwidth_matrix[i][j] >= 300:  # Assume NVLink for high bandwidth
                            nvlink_connections[(i, j)] = int(bandwidth_matrix[i][j] / 50)  # Rough estimate
                        else:
                            nvlink_connections[(i, j)] = 0
                            
                    except Exception as e:
                        logger.debug(f"Error checking P2P between GPU {i} and {j}: {e}")
                        p2p_capabilities[(i, j)] = False
                        
            except Exception as e:
                logger.error(f"Error discovering topology for GPU {i}: {e}")
        
        topology = GPUTopology(
            device_count=self.device_count,
            topology_matrix=topology_matrix,
            p2p_capabilities=p2p_capabilities,
            nvlink_connections=nvlink_connections,
            bandwidth_matrix=bandwidth_matrix,
            numa_affinity=numa_affinity
        )
        
        logger.info(f"Discovered GPU topology: {self.device_count} GPUs")
        logger.info(f"P2P capabilities: {sum(p2p_capabilities.values())}/{len(p2p_capabilities)} pairs")
        logger.info(f"NVLink connections: {sum(1 for v in nvlink_connections.values() if v > 0)}")
        
        return topology
    
    def start_monitoring(self):
        """Start multi-GPU monitoring"""
        if self.running:
            logger.warning("Multi-GPU monitoring already running")
            return
        
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        
        logger.info("Multi-GPU monitoring started")
    
    def _monitoring_loop(self):
        """Main monitoring loop"""
        monitoring_interval = self.config.get('monitoring_interval_seconds', 15)
        
        while self.running:
            try:
                current_time = datetime.now()
                
                # Collect multi-GPU metrics
                metrics = self._collect_coordination_metrics()
                if metrics:
                    self.coordination_metrics.append(metrics)
                
                # Detect synchronization patterns
                self._detect_sync_patterns()
                
                # Analyze coordination efficiency
                self._analyze_coordination_efficiency()
                
                # Check for alerts
                self._check_coordination_alerts()
                
                # Update performance baselines
                self._update_baselines()
                
                time.sleep(monitoring_interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(monitoring_interval)
    
    def _collect_coordination_metrics(self) -> Optional[CoordinationMetrics]:
        """Collect multi-GPU coordination metrics"""
        try:
            current_time = datetime.now()
            
            # Get GPU utilization for all devices
            gpu_utilizations = []
            active_gpus = set()
            
            for device_id in range(self.device_count):
                try:
                    handle = pynvml.nvmlDeviceGetHandleByIndex(device_id)
                    util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    gpu_utilizations.append(util.gpu)
                    
                    if util.gpu > 5:  # Consider active if > 5% utilization
                        active_gpus.add(device_id)
                        
                except Exception as e:
                    logger.debug(f"Error getting utilization for GPU {device_id}: {e}")
                    gpu_utilizations.append(0)
            
            # Calculate load imbalance
            if len(active_gpus) > 1:
                active_utils = [gpu_utilizations[i] for i in active_gpus]
                load_imbalance = (max(active_utils) - min(active_utils)) / (max(active_utils) + 1e-6)
            else:
                load_imbalance = 0
            
            # Analyze recent sync events
            recent_window = current_time - timedelta(seconds=self.config.get('sync_detection_window_seconds', 60))
            recent_events = [e for e in self.sync_events if e.timestamp > recent_window]
            
            total_sync_events = len(recent_events)
            failed_sync_events = len([e for e in recent_events if not e.success])
            
            if recent_events:
                avg_sync_duration = np.mean([e.duration_ms for e in recent_events])
                max_sync_duration = max([e.duration_ms for e in recent_events])
                avg_p2p_rate = np.mean([e.bandwidth_achieved_gb_s for e in recent_events 
                                      if e.event_type == 'p2p_copy'])
            else:
                avg_sync_duration = 0
                max_sync_duration = 0
                avg_p2p_rate = 0
            
            # Calculate coordination efficiency
            if total_sync_events > 0:
                sync_success_rate = (total_sync_events - failed_sync_events) / total_sync_events
                efficiency_factors = [
                    sync_success_rate,
                    1 - load_imbalance,
                    min(1.0, avg_p2p_rate / 50.0),  # Normalize to 50 GB/s
                    min(1.0, 100.0 / (avg_sync_duration + 1e-6))  # Favor low sync times
                ]
                coordination_efficiency = np.mean(efficiency_factors)
            else:
                coordination_efficiency = 1.0
            
            # Identify bottleneck GPU
            bottleneck_gpu = None
            if len(active_gpus) > 1:
                bottleneck_gpu = min(active_gpus, key=lambda i: gpu_utilizations[i])
            
            # Generate recommendations
            recommendations = []
            if load_imbalance > 0.3:
                recommendations.append("High load imbalance detected - consider workload redistribution")
            if failed_sync_events > 0:
                recommendations.append("Synchronization failures detected - check network/NVLink connections")
            if avg_sync_duration > 100:
                recommendations.append("High synchronization latency - optimize coordination patterns")
            if coordination_efficiency < 0.8:
                recommendations.append("Low coordination efficiency - review multi-GPU algorithm")
            
            return CoordinationMetrics(
                timestamp=current_time,
                active_gpus=active_gpus,
                total_sync_events=total_sync_events,
                failed_sync_events=failed_sync_events,
                avg_sync_duration_ms=avg_sync_duration,
                max_sync_duration_ms=max_sync_duration,
                p2p_transfer_rate_gb_s=avg_p2p_rate,
                load_imbalance=load_imbalance,
                coordination_efficiency=coordination_efficiency,
                bottleneck_gpu=bottleneck_gpu,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"Error collecting coordination metrics: {e}")
            return None
    
    def _detect_sync_patterns(self):
        """Detect synchronization patterns using system monitoring"""
        try:
            # Use nvidia-smi to detect GPU activities
            cmd = "nvidia-smi pmon -i 0,1,2,3,4,5,6,7 -c 1 -s u"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                gpu_activities = {}
                
                for line in lines:
                    if line.startswith('#') or not line.strip():
                        continue
                    
                    parts = line.split()
                    if len(parts) >= 4:
                        gpu_id = int(parts[0])
                        sm_util = float(parts[3]) if parts[3] != '-' else 0
                        mem_util = float(parts[4]) if parts[4] != '-' else 0
                        
                        gpu_activities[gpu_id] = {
                            'sm_util': sm_util,
                            'mem_util': mem_util
                        }
                
                # Detect synchronization events based on patterns
                self._analyze_activity_patterns(gpu_activities)
                
        except Exception as e:
            logger.debug(f"Error detecting sync patterns: {e}")
    
    def _analyze_activity_patterns(self, gpu_activities: Dict[int, Dict]):
        """Analyze GPU activity patterns to detect sync events"""
        current_time = datetime.now()
        
        # Look for simultaneous activity patterns
        active_gpus = [gpu_id for gpu_id, activity in gpu_activities.items() 
                      if activity['sm_util'] > 10]
        
        if len(active_gpus) > 1:
            # Potential multi-GPU operation detected
            avg_sm_util = np.mean([gpu_activities[gpu_id]['sm_util'] for gpu_id in active_gpus])
            avg_mem_util = np.mean([gpu_activities[gpu_id]['mem_util'] for gpu_id in active_gpus])
            
            # Estimate sync event characteristics
            estimated_duration = max(10, avg_sm_util * 2)  # Rough estimate
            estimated_bandwidth = avg_mem_util * 10  # Rough estimate
            
            # Create synthetic sync event
            sync_event = SyncEvent(
                timestamp=current_time,
                event_type='multi_gpu_operation',
                source_gpu=min(active_gpus),
                target_gpu=max(active_gpus) if len(active_gpus) > 1 else None,
                data_size_mb=estimated_bandwidth,
                duration_ms=estimated_duration,
                bandwidth_achieved_gb_s=estimated_bandwidth / 10,
                success=True,
                error_message=None
            )
            
            self.sync_events.append(sync_event)
    
    def _analyze_coordination_efficiency(self):
        """Analyze coordination efficiency trends"""
        if len(self.coordination_metrics) < 2:
            return
        
        # Calculate efficiency trend
        recent_metrics = list(self.coordination_metrics)[-10:]  # Last 10 measurements
        
        if len(recent_metrics) >= 5:
            efficiency_values = [m.coordination_efficiency for m in recent_metrics]
            
            # Calculate trend
            times = range(len(efficiency_values))
            if len(set(efficiency_values)) > 1:
                trend_coeff = np.polyfit(times, efficiency_values, 1)[0]
                
                if trend_coeff < -0.01:  # Decreasing efficiency
                    logger.warning("Coordination efficiency trend is decreasing")
                    
                    # Generate alert
                    alert = MultiGPUAlert(
                        timestamp=datetime.now(),
                        alert_type='efficiency_degradation',
                        severity='warning',
                        description=f"Coordination efficiency declining (trend: {trend_coeff:.4f})",
                        affected_gpus=recent_metrics[-1].active_gpus,
                        impact_level='medium',
                        recommended_actions=[
                            "Investigate workload changes",
                            "Check for resource contention",
                            "Review synchronization patterns"
                        ]
                    )
                    
                    self._handle_multi_gpu_alert(alert)
    
    def _check_coordination_alerts(self):
        """Check for coordination-related alerts"""
        if not self.coordination_metrics:
            return
        
        latest_metrics = self.coordination_metrics[-1]
        thresholds = self.config.get('alert_thresholds', {})
        
        # Check sync failure rate
        if latest_metrics.total_sync_events > 0:
            failure_rate = latest_metrics.failed_sync_events / latest_metrics.total_sync_events
            if failure_rate > thresholds.get('sync_failure_rate', 0.05):
                alert = MultiGPUAlert(
                    timestamp=datetime.now(),
                    alert_type='high_sync_failure_rate',
                    severity='critical',
                    description=f"High synchronization failure rate: {failure_rate:.2%}",
                    affected_gpus=latest_metrics.active_gpus,
                    impact_level='high',
                    recommended_actions=[
                        "Check GPU health and connections",
                        "Verify NVLink/PCIe status",
                        "Review synchronization code"
                    ]
                )
                self._handle_multi_gpu_alert(alert)
        
        # Check load imbalance
        if latest_metrics.load_imbalance > thresholds.get('load_imbalance_threshold', 0.3):
            alert = MultiGPUAlert(
                timestamp=datetime.now(),
                alert_type='high_load_imbalance',
                severity='warning',
                description=f"High load imbalance: {latest_metrics.load_imbalance:.2%}",
                affected_gpus=latest_metrics.active_gpus,
                impact_level='medium',
                recommended_actions=[
                    "Rebalance workload distribution",
                    "Check for GPU performance differences",
                    "Review data partitioning strategy"
                ]
            )
            self._handle_multi_gpu_alert(alert)
        
        # Check sync duration
        if latest_metrics.avg_sync_duration_ms > thresholds.get('sync_duration_threshold_ms', 100):
            alert = MultiGPUAlert(
                timestamp=datetime.now(),
                alert_type='high_sync_duration',
                severity='warning',
                description=f"High synchronization duration: {latest_metrics.avg_sync_duration_ms:.1f}ms",
                affected_gpus=latest_metrics.active_gpus,
                impact_level='medium',
                recommended_actions=[
                    "Optimize synchronization algorithms",
                    "Check network/NVLink bandwidth",
                    "Consider async operations where possible"
                ]
            )
            self._handle_multi_gpu_alert(alert)
    
    def _handle_multi_gpu_alert(self, alert: MultiGPUAlert):
        """Handle multi-GPU alert"""
        self.multi_gpu_alerts.append(alert)
        
        # Log alert
        logger.warning(f"MULTI-GPU ALERT: {alert.alert_type} - {alert.description}")
        
        # Save alert details
        self._save_alert_report(alert)
    
    def _save_alert_report(self, alert: MultiGPUAlert):
        """Save alert report"""
        try:
            report_dir = "/var/log/vibecast/multi_gpu_alerts"
            os.makedirs(report_dir, exist_ok=True)
            
            timestamp = alert.timestamp.strftime("%Y%m%d_%H%M%S")
            filename = f"{report_dir}/alert_{alert.alert_type}_{timestamp}.json"
            
            with open(filename, 'w') as f:
                json.dump(asdict(alert), f, indent=2, default=str)
            
            logger.info(f"Saved multi-GPU alert report to {filename}")
            
        except Exception as e:
            logger.error(f"Failed to save alert report: {e}")
    
    def _update_baselines(self):
        """Update performance baselines"""
        if len(self.coordination_metrics) >= 20:  # Need enough data
            recent_metrics = list(self.coordination_metrics)[-20:]
            
            self.baseline_metrics = {
                'avg_coordination_efficiency': np.mean([m.coordination_efficiency for m in recent_metrics]),
                'avg_sync_duration_ms': np.mean([m.avg_sync_duration_ms for m in recent_metrics]),
                'avg_load_imbalance': np.mean([m.load_imbalance for m in recent_metrics]),
                'avg_p2p_rate_gb_s': np.mean([m.p2p_transfer_rate_gb_s for m in recent_metrics]),
                'last_updated': datetime.now()
            }
    
    def get_monitoring_summary(self) -> Dict:
        """Get multi-GPU monitoring summary"""
        summary = {
            'timestamp': datetime.now().isoformat(),
            'gpu_count': self.device_count,
            'topology': asdict(self.topology),
            'recent_metrics': asdict(self.coordination_metrics[-1]) if self.coordination_metrics else None,
            'active_alerts': len([a for a in self.multi_gpu_alerts 
                                if a.timestamp > datetime.now() - timedelta(hours=1)]),
            'total_sync_events': len(self.sync_events),
            'baselines': self.baseline_metrics
        }
        
        return summary
    
    def export_monitoring_report(self, output_path: str):
        """Export detailed monitoring report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': self.get_monitoring_summary(),
            'topology': asdict(self.topology),
            'recent_metrics': [asdict(m) for m in list(self.coordination_metrics)[-50:]],
            'recent_sync_events': [asdict(e) for e in list(self.sync_events)[-100:]],
            'recent_alerts': [asdict(a) for a in self.multi_gpu_alerts[-20:]],
            'baselines': self.baseline_metrics,
            'configuration': self.config
        }
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        logger.info(f"Exported multi-GPU monitoring report to {output_path}")
    
    def stop_monitoring(self):
        """Stop multi-GPU monitoring"""
        logger.info("Stopping multi-GPU monitoring")
        self.running = False
        
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        
        # Export final report
        final_report_path = f"/var/log/vibecast/final_multi_gpu_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        self.export_monitoring_report(final_report_path)
        
        summary = self.get_monitoring_summary()
        logger.info(f"Multi-GPU monitoring stopped. Final summary: {summary}")
        
        # Cleanup NVML
        try:
            pynvml.nvmlShutdown()
        except:
            pass


def main():
    """Main function"""
    config = {
        'monitoring_interval_seconds': 15,
        'sync_detection_window_seconds': 60,
        'alert_thresholds': {
            'sync_failure_rate': 0.05,
            'sync_duration_threshold_ms': 100,
            'load_imbalance_threshold': 0.3
        }
    }
    
    monitor = MultiGPUMonitor(config)
    
    try:
        monitor.start_monitoring()
        
        # Keep running until interrupted
        while True:
            time.sleep(30)
            
            # Print summary periodically
            summary = monitor.get_monitoring_summary()
            logger.info(f"Multi-GPU monitoring summary: {summary}")
            
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        monitor.stop_monitoring()


if __name__ == "__main__":
    main()