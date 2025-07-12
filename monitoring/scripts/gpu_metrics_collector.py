#!/usr/bin/env python3
"""
Production GPU Metrics Collector
Collects comprehensive GPU metrics for monitoring system
"""

import os
import sys
import time
import json
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import numpy as np
import pynvml
import psutil
import yaml
from prometheus_client import Counter, Gauge, Histogram, start_http_server
from prometheus_client.core import CollectorRegistry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/vibecast/gpu_metrics.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class GPUMetrics:
    """Comprehensive GPU metrics"""
    timestamp: datetime
    device_id: int
    device_name: str
    gpu_utilization: float
    memory_utilization: float
    memory_used_gb: float
    memory_total_gb: float
    temperature_c: float
    power_draw_w: float
    power_limit_w: float
    clock_speed_mhz: int
    memory_clock_mhz: int
    pcie_throughput_mb_s: float
    fan_speed_percent: float
    ecc_errors: int
    compute_mode: str
    performance_state: str
    throttle_reasons: List[str]

@dataclass
class KernelMetrics:
    """Kernel execution metrics"""
    timestamp: datetime
    kernel_name: str
    device_id: int
    execution_time_ms: float
    occupancy: float
    memory_bandwidth_gb_s: float
    compute_throughput_gflops: float
    registers_per_thread: int
    shared_memory_bytes: int
    grid_size: Tuple[int, int, int]
    block_size: Tuple[int, int, int]

@dataclass
class SystemMetrics:
    """System-level metrics"""
    timestamp: datetime
    cpu_usage_percent: float
    memory_usage_percent: float
    disk_usage_percent: float
    network_bytes_sent: int
    network_bytes_recv: int
    load_average: Tuple[float, float, float]
    process_count: int

class MetricsCollector:
    """Production GPU metrics collector with Prometheus integration"""
    
    def __init__(self, config_path: str = "/workspaces/vibecast/monitoring/config/production_monitor.yaml"):
        self.config = self._load_config(config_path)
        self.running = False
        self.collection_threads = []
        
        # Initialize NVML
        try:
            pynvml.nvmlInit()
            self.device_count = pynvml.nvmlDeviceGetCount()
            logger.info(f"Initialized NVML with {self.device_count} GPU devices")
        except Exception as e:
            logger.error(f"Failed to initialize NVML: {e}")
            sys.exit(1)
            
        # Initialize Prometheus metrics
        self.registry = CollectorRegistry()
        self._setup_prometheus_metrics()
        
        # Data storage
        self.metrics_buffer = []
        self.kernel_metrics_buffer = []
        self.system_metrics_buffer = []
        
        # Alert state tracking
        self.alert_states = {}
        
    def _load_config(self, config_path: str) -> Dict:
        """Load monitoring configuration"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"Loaded configuration from {config_path}")
            return config
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            # Return default configuration
            return {
                'gpu_monitoring': {
                    'enabled': True,
                    'collection_interval': 5,
                    'metrics': {
                        'utilization': {
                            'gpu_utilization': {'threshold_warning': 70, 'threshold_critical': 90}
                        }
                    }
                }
            }
    
    def _setup_prometheus_metrics(self):
        """Setup Prometheus metrics"""
        # GPU Metrics
        self.gpu_utilization = Gauge('gpu_utilization_percent', 'GPU utilization percentage', 
                                   ['device_id', 'device_name'], registry=self.registry)
        self.gpu_memory_utilization = Gauge('gpu_memory_utilization_percent', 'GPU memory utilization percentage',
                                          ['device_id', 'device_name'], registry=self.registry)
        self.gpu_memory_used = Gauge('gpu_memory_used_bytes', 'GPU memory used in bytes',
                                   ['device_id', 'device_name'], registry=self.registry)
        self.gpu_temperature = Gauge('gpu_temperature_celsius', 'GPU temperature in Celsius',
                                   ['device_id', 'device_name'], registry=self.registry)
        self.gpu_power_draw = Gauge('gpu_power_draw_watts', 'GPU power draw in watts',
                                  ['device_id', 'device_name'], registry=self.registry)
        self.gpu_clock_speed = Gauge('gpu_clock_speed_mhz', 'GPU clock speed in MHz',
                                   ['device_id', 'device_name'], registry=self.registry)
        self.gpu_memory_clock = Gauge('gpu_memory_clock_mhz', 'GPU memory clock in MHz',
                                    ['device_id', 'device_name'], registry=self.registry)
        self.gpu_fan_speed = Gauge('gpu_fan_speed_percent', 'GPU fan speed percentage',
                                 ['device_id', 'device_name'], registry=self.registry)
        self.gpu_ecc_errors = Counter('gpu_ecc_errors_total', 'Total ECC errors',
                                    ['device_id', 'device_name', 'error_type'], registry=self.registry)
        
        # Kernel Metrics
        self.kernel_execution_time = Histogram('kernel_execution_time_seconds', 'Kernel execution time',
                                             ['device_id', 'kernel_name'], registry=self.registry)
        self.kernel_occupancy = Gauge('kernel_occupancy_percent', 'Kernel occupancy percentage',
                                    ['device_id', 'kernel_name'], registry=self.registry)
        self.kernel_memory_bandwidth = Gauge('kernel_memory_bandwidth_gb_s', 'Kernel memory bandwidth GB/s',
                                           ['device_id', 'kernel_name'], registry=self.registry)
        
        # System Metrics
        self.system_cpu_usage = Gauge('system_cpu_usage_percent', 'System CPU usage percentage', registry=self.registry)
        self.system_memory_usage = Gauge('system_memory_usage_percent', 'System memory usage percentage', registry=self.registry)
        self.system_disk_usage = Gauge('system_disk_usage_percent', 'System disk usage percentage', 
                                     ['mountpoint'], registry=self.registry)
        
        # Alert Metrics
        self.alert_fired = Counter('monitoring_alerts_fired_total', 'Total alerts fired',
                                 ['alert_name', 'severity'], registry=self.registry)
        self.alert_active = Gauge('monitoring_alerts_active', 'Currently active alerts',
                                ['alert_name', 'severity'], registry=self.registry)
    
    def collect_gpu_metrics(self, device_id: int) -> GPUMetrics:
        """Collect metrics for a specific GPU device"""
        try:
            handle = pynvml.nvmlDeviceGetHandleByIndex(device_id)
            
            # Basic device info
            device_name = pynvml.nvmlDeviceGetName(handle).decode()
            
            # Utilization
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            gpu_util = util.gpu
            mem_util = util.memory
            
            # Memory
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            mem_used_gb = mem_info.used / (1024**3)
            mem_total_gb = mem_info.total / (1024**3)
            
            # Temperature
            try:
                temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
            except:
                temp = 0
                
            # Power
            try:
                power = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000  # mW to W
                power_limit = pynvml.nvmlDeviceGetPowerManagementLimitConstraints(handle)[1] / 1000
            except:
                power = 0
                power_limit = 0
                
            # Clocks
            try:
                gpu_clock = pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_GRAPHICS)
                mem_clock = pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_MEM)
            except:
                gpu_clock = 0
                mem_clock = 0
                
            # PCIe throughput
            try:
                pcie_tx = pynvml.nvmlDeviceGetPcieThroughput(handle, pynvml.NVML_PCIE_UTIL_TX_BYTES)
                pcie_rx = pynvml.nvmlDeviceGetPcieThroughput(handle, pynvml.NVML_PCIE_UTIL_RX_BYTES)
                pcie_throughput = (pcie_tx + pcie_rx) / (1024**2)  # MB/s
            except:
                pcie_throughput = 0
                
            # Fan speed
            try:
                fan_speed = pynvml.nvmlDeviceGetFanSpeed(handle)
            except:
                fan_speed = 0
                
            # ECC errors
            try:
                ecc_single = pynvml.nvmlDeviceGetTotalEccErrors(handle, pynvml.NVML_SINGLE_BIT_ECC, pynvml.NVML_VOLATILE_ECC)
                ecc_double = pynvml.nvmlDeviceGetTotalEccErrors(handle, pynvml.NVML_DOUBLE_BIT_ECC, pynvml.NVML_VOLATILE_ECC)
                ecc_errors = ecc_single + ecc_double
            except:
                ecc_errors = 0
                
            # Compute mode
            try:
                compute_mode = pynvml.nvmlDeviceGetComputeMode(handle)
                compute_mode_str = {
                    0: "Default",
                    1: "Exclusive_Thread",
                    2: "Prohibited",
                    3: "Exclusive_Process"
                }.get(compute_mode, "Unknown")
            except:
                compute_mode_str = "Unknown"
                
            # Performance state
            try:
                perf_state = pynvml.nvmlDeviceGetPerformanceState(handle)
                perf_state_str = f"P{perf_state}"
            except:
                perf_state_str = "Unknown"
                
            # Throttle reasons
            throttle_reasons = []
            try:
                reasons = pynvml.nvmlDeviceGetCurrentClocksThrottleReasons(handle)
                if reasons & pynvml.nvmlClocksThrottleReasonGpuIdle:
                    throttle_reasons.append("GPU_Idle")
                if reasons & pynvml.nvmlClocksThrottleReasonApplicationsClocksSetting:
                    throttle_reasons.append("Applications_Clocks_Setting")
                if reasons & pynvml.nvmlClocksThrottleReasonSwPowerCap:
                    throttle_reasons.append("SW_Power_Cap")
                if reasons & pynvml.nvmlClocksThrottleReasonHwSlowdown:
                    throttle_reasons.append("HW_Slowdown")
                if reasons & pynvml.nvmlClocksThrottleReasonSyncBoost:
                    throttle_reasons.append("Sync_Boost")
                if reasons & pynvml.nvmlClocksThrottleReasonSwThermalSlowdown:
                    throttle_reasons.append("SW_Thermal_Slowdown")
                if reasons & pynvml.nvmlClocksThrottleReasonHwThermalSlowdown:
                    throttle_reasons.append("HW_Thermal_Slowdown")
                if reasons & pynvml.nvmlClocksThrottleReasonHwPowerBrakeSlowdown:
                    throttle_reasons.append("HW_Power_Brake_Slowdown")
            except:
                pass
                
            return GPUMetrics(
                timestamp=datetime.now(),
                device_id=device_id,
                device_name=device_name,
                gpu_utilization=gpu_util,
                memory_utilization=mem_util,
                memory_used_gb=mem_used_gb,
                memory_total_gb=mem_total_gb,
                temperature_c=temp,
                power_draw_w=power,
                power_limit_w=power_limit,
                clock_speed_mhz=gpu_clock,
                memory_clock_mhz=mem_clock,
                pcie_throughput_mb_s=pcie_throughput,
                fan_speed_percent=fan_speed,
                ecc_errors=ecc_errors,
                compute_mode=compute_mode_str,
                performance_state=perf_state_str,
                throttle_reasons=throttle_reasons
            )
            
        except Exception as e:
            logger.error(f"Failed to collect GPU metrics for device {device_id}: {e}")
            return None
    
    def collect_system_metrics(self) -> SystemMetrics:
        """Collect system-level metrics"""
        try:
            # CPU usage
            cpu_usage = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_usage = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_usage = disk.percent
            
            # Network I/O
            net_io = psutil.net_io_counters()
            net_sent = net_io.bytes_sent
            net_recv = net_io.bytes_recv
            
            # Load average
            load_avg = psutil.getloadavg()
            
            # Process count
            process_count = len(psutil.pids())
            
            return SystemMetrics(
                timestamp=datetime.now(),
                cpu_usage_percent=cpu_usage,
                memory_usage_percent=memory_usage,
                disk_usage_percent=disk_usage,
                network_bytes_sent=net_sent,
                network_bytes_recv=net_recv,
                load_average=load_avg,
                process_count=process_count
            )
            
        except Exception as e:
            logger.error(f"Failed to collect system metrics: {e}")
            return None
    
    def update_prometheus_metrics(self, gpu_metrics: GPUMetrics, system_metrics: SystemMetrics):
        """Update Prometheus metrics"""
        if gpu_metrics:
            device_id = str(gpu_metrics.device_id)
            device_name = gpu_metrics.device_name
            
            # Update GPU metrics
            self.gpu_utilization.labels(device_id=device_id, device_name=device_name).set(gpu_metrics.gpu_utilization)
            self.gpu_memory_utilization.labels(device_id=device_id, device_name=device_name).set(gpu_metrics.memory_utilization)
            self.gpu_memory_used.labels(device_id=device_id, device_name=device_name).set(gpu_metrics.memory_used_gb * 1024**3)
            self.gpu_temperature.labels(device_id=device_id, device_name=device_name).set(gpu_metrics.temperature_c)
            self.gpu_power_draw.labels(device_id=device_id, device_name=device_name).set(gpu_metrics.power_draw_w)
            self.gpu_clock_speed.labels(device_id=device_id, device_name=device_name).set(gpu_metrics.clock_speed_mhz)
            self.gpu_memory_clock.labels(device_id=device_id, device_name=device_name).set(gpu_metrics.memory_clock_mhz)
            self.gpu_fan_speed.labels(device_id=device_id, device_name=device_name).set(gpu_metrics.fan_speed_percent)
            
        if system_metrics:
            # Update system metrics
            self.system_cpu_usage.set(system_metrics.cpu_usage_percent)
            self.system_memory_usage.set(system_metrics.memory_usage_percent)
            self.system_disk_usage.labels(mountpoint="/").set(system_metrics.disk_usage_percent)
    
    def check_alerts(self, metrics: GPUMetrics):
        """Check for alert conditions"""
        if not metrics:
            return
            
        device_id = metrics.device_id
        alerts_config = self.config.get('alerting', {}).get('rules', [])
        
        for rule in alerts_config:
            alert_name = rule.get('alert', '')
            severity = rule.get('severity', 'warning')
            
            triggered = False
            
            if alert_name == 'HighGPUUtilization':
                if metrics.gpu_utilization > 90:
                    triggered = True
            elif alert_name == 'CriticalGPUUtilization':
                if metrics.gpu_utilization > 95:
                    triggered = True
            elif alert_name == 'GPUTemperatureHigh':
                if metrics.temperature_c > 85:
                    triggered = True
            elif alert_name == 'MemoryUtilizationHigh':
                if metrics.memory_utilization > 85:
                    triggered = True
                    
            if triggered:
                self._fire_alert(alert_name, severity, device_id, rule.get('annotations', {}))
    
    def _fire_alert(self, alert_name: str, severity: str, device_id: int, annotations: Dict):
        """Fire an alert"""
        alert_key = f"{alert_name}_{device_id}"
        
        # Check if alert is already active
        if alert_key in self.alert_states:
            return
            
        # Mark alert as active
        self.alert_states[alert_key] = {
            'timestamp': datetime.now(),
            'severity': severity,
            'device_id': device_id
        }
        
        # Update Prometheus metrics
        self.alert_fired.labels(alert_name=alert_name, severity=severity).inc()
        self.alert_active.labels(alert_name=alert_name, severity=severity).set(1)
        
        # Log alert
        logger.warning(f"ALERT FIRED: {alert_name} (severity: {severity}) on device {device_id}")
        
        # Send notifications (implementation depends on configured channels)
        self._send_notifications(alert_name, severity, device_id, annotations)
    
    def _send_notifications(self, alert_name: str, severity: str, device_id: int, annotations: Dict):
        """Send alert notifications"""
        # Implementation would depend on configured notification channels
        # (Slack, email, PagerDuty, etc.)
        message = f"🚨 {alert_name}: {annotations.get('summary', 'Alert triggered')} on GPU {device_id}"
        logger.info(f"Notification sent: {message}")
    
    def start_collection(self):
        """Start metrics collection"""
        if self.running:
            logger.warning("Metrics collection already running")
            return
            
        self.running = True
        logger.info("Starting metrics collection")
        
        # Start Prometheus HTTP server
        start_http_server(8000, registry=self.registry)
        logger.info("Prometheus metrics server started on port 8000")
        
        # Start GPU metrics collection threads
        for device_id in range(self.device_count):
            thread = threading.Thread(target=self._gpu_collection_loop, args=(device_id,))
            thread.daemon = True
            thread.start()
            self.collection_threads.append(thread)
            
        # Start system metrics collection
        system_thread = threading.Thread(target=self._system_collection_loop)
        system_thread.daemon = True
        system_thread.start()
        self.collection_threads.append(system_thread)
        
        # Start metrics persistence thread
        persistence_thread = threading.Thread(target=self._persistence_loop)
        persistence_thread.daemon = True
        persistence_thread.start()
        self.collection_threads.append(persistence_thread)
        
        logger.info(f"Started {len(self.collection_threads)} collection threads")
    
    def _gpu_collection_loop(self, device_id: int):
        """GPU metrics collection loop"""
        collection_interval = self.config.get('gpu_monitoring', {}).get('collection_interval', 5)
        
        while self.running:
            try:
                metrics = self.collect_gpu_metrics(device_id)
                if metrics:
                    self.metrics_buffer.append(metrics)
                    self.update_prometheus_metrics(metrics, None)
                    self.check_alerts(metrics)
                    
                time.sleep(collection_interval)
                
            except Exception as e:
                logger.error(f"Error in GPU collection loop for device {device_id}: {e}")
                time.sleep(collection_interval)
    
    def _system_collection_loop(self):
        """System metrics collection loop"""
        collection_interval = 30  # 30 seconds for system metrics
        
        while self.running:
            try:
                metrics = self.collect_system_metrics()
                if metrics:
                    self.system_metrics_buffer.append(metrics)
                    self.update_prometheus_metrics(None, metrics)
                    
                time.sleep(collection_interval)
                
            except Exception as e:
                logger.error(f"Error in system collection loop: {e}")
                time.sleep(collection_interval)
    
    def _persistence_loop(self):
        """Metrics persistence loop"""
        while self.running:
            try:
                # Persist metrics to disk every 5 minutes
                if self.metrics_buffer:
                    self._persist_metrics()
                    
                time.sleep(300)  # 5 minutes
                
            except Exception as e:
                logger.error(f"Error in persistence loop: {e}")
                time.sleep(300)
    
    def _persist_metrics(self):
        """Persist metrics to disk"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # GPU metrics
            if self.metrics_buffer:
                filename = f"/var/log/vibecast/gpu_metrics_{timestamp}.json"
                with open(filename, 'w') as f:
                    json.dump([asdict(m) for m in self.metrics_buffer], f, default=str)
                
                logger.info(f"Persisted {len(self.metrics_buffer)} GPU metrics to {filename}")
                self.metrics_buffer.clear()
            
            # System metrics
            if self.system_metrics_buffer:
                filename = f"/var/log/vibecast/system_metrics_{timestamp}.json"
                with open(filename, 'w') as f:
                    json.dump([asdict(m) for m in self.system_metrics_buffer], f, default=str)
                
                logger.info(f"Persisted {len(self.system_metrics_buffer)} system metrics to {filename}")
                self.system_metrics_buffer.clear()
                
        except Exception as e:
            logger.error(f"Failed to persist metrics: {e}")
    
    def stop_collection(self):
        """Stop metrics collection"""
        logger.info("Stopping metrics collection")
        self.running = False
        
        # Wait for threads to finish
        for thread in self.collection_threads:
            thread.join(timeout=5)
        
        # Final metrics persistence
        self._persist_metrics()
        
        # Cleanup NVML
        pynvml.nvmlShutdown()
        
        logger.info("Metrics collection stopped")


def main():
    """Main function"""
    collector = MetricsCollector()
    
    try:
        collector.start_collection()
        
        # Keep running until interrupted
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        collector.stop_collection()


if __name__ == "__main__":
    main()