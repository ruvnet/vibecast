#!/usr/bin/env python3
"""
Automated Health Checker
Performs comprehensive health checks for the monitoring system
"""

import os
import sys
import time
import json
import logging
import subprocess
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import psutil
import requests
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/vibecast/health_checker.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class HealthCheck:
    """Individual health check result"""
    name: str
    category: str
    status: str  # 'healthy', 'warning', 'critical', 'unknown'
    message: str
    timestamp: datetime
    duration_ms: float
    details: Dict
    recommendations: List[str]

@dataclass
class SystemHealth:
    """Overall system health status"""
    timestamp: datetime
    overall_status: str
    health_score: float  # 0-100
    checks_passed: int
    checks_failed: int
    checks_warning: int
    categories: Dict[str, str]  # category -> status
    critical_issues: List[str]
    recommendations: List[str]

class HealthChecker:
    """Comprehensive system health checker"""
    
    def __init__(self, config: Dict = None):
        self.config = config or self._default_config()
        self.running = False
        self.check_thread = None
        
        # Health check results
        self.health_history = []
        self.current_health = None
        
        # Check categories
        self.check_categories = {
            'gpu': 'GPU Hardware',
            'memory': 'Memory Systems',
            'storage': 'Storage Systems',
            'network': 'Network Connectivity',
            'processes': 'Process Health',
            'monitoring': 'Monitoring Systems',
            'performance': 'Performance Metrics'
        }
        
        # Health check registry
        self.health_checks = self._register_health_checks()
        
    def _default_config(self) -> Dict:
        """Default configuration"""
        return {
            'check_interval_seconds': 60,
            'health_retention_hours': 24,
            'critical_threshold': 0.8,
            'warning_threshold': 0.6,
            'timeout_seconds': 30,
            'enabled_categories': ['gpu', 'memory', 'storage', 'network', 'processes', 'monitoring'],
            'endpoints': {
                'prometheus': 'http://localhost:8000/metrics',
                'grafana': 'http://localhost:3000/api/health',
                'elasticsearch': 'http://localhost:9200/_cluster/health'
            }
        }
    
    def _register_health_checks(self) -> Dict:
        """Register all health checks"""
        return {
            'gpu': [
                self._check_gpu_availability,
                self._check_gpu_temperature,
                self._check_gpu_memory,
                self._check_cuda_runtime,
                self._check_nvml_status
            ],
            'memory': [
                self._check_system_memory,
                self._check_memory_leaks,
                self._check_swap_usage
            ],
            'storage': [
                self._check_disk_space,
                self._check_disk_io,
                self._check_log_rotation
            ],
            'network': [
                self._check_network_connectivity,
                self._check_dns_resolution,
                self._check_port_availability
            ],
            'processes': [
                self._check_critical_processes,
                self._check_process_health,
                self._check_zombie_processes
            ],
            'monitoring': [
                self._check_prometheus_health,
                self._check_grafana_health,
                self._check_log_aggregation
            ],
            'performance': [
                self._check_cpu_usage,
                self._check_load_average,
                self._check_io_wait
            ]
        }
    
    def start_health_checking(self):
        """Start health checking"""
        if self.running:
            logger.warning("Health checking already running")
            return
        
        self.running = True
        self.check_thread = threading.Thread(target=self._health_check_loop)
        self.check_thread.daemon = True
        self.check_thread.start()
        
        logger.info("Health checking started")
    
    def _health_check_loop(self):
        """Main health check loop"""
        check_interval = self.config.get('check_interval_seconds', 60)
        
        while self.running:
            try:
                start_time = time.time()
                
                # Run all health checks
                health_results = self._run_all_health_checks()
                
                # Calculate overall health
                system_health = self._calculate_system_health(health_results)
                
                # Store results
                self.current_health = system_health
                self.health_history.append(system_health)
                
                # Clean old history
                cutoff_time = datetime.now() - timedelta(hours=self.config.get('health_retention_hours', 24))
                self.health_history = [h for h in self.health_history if h.timestamp > cutoff_time]
                
                # Log health status
                self._log_health_status(system_health)
                
                # Send alerts if needed
                self._check_health_alerts(system_health)
                
                # Calculate sleep time
                elapsed = time.time() - start_time
                sleep_time = max(0, check_interval - elapsed)
                time.sleep(sleep_time)
                
            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
                time.sleep(check_interval)
    
    def _run_all_health_checks(self) -> List[HealthCheck]:
        """Run all enabled health checks"""
        results = []
        enabled_categories = self.config.get('enabled_categories', [])
        
        for category in enabled_categories:
            if category not in self.health_checks:
                continue
                
            for check_func in self.health_checks[category]:
                try:
                    start_time = time.time()
                    result = check_func()
                    duration = (time.time() - start_time) * 1000  # Convert to ms
                    
                    if result:
                        result.duration_ms = duration
                        results.append(result)
                        
                except Exception as e:
                    logger.error(f"Error running health check {check_func.__name__}: {e}")
                    
                    # Create error result
                    error_result = HealthCheck(
                        name=check_func.__name__,
                        category=category,
                        status='critical',
                        message=f"Health check failed: {e}",
                        timestamp=datetime.now(),
                        duration_ms=0,
                        details={'error': str(e)},
                        recommendations=['Investigate health check failure']
                    )
                    results.append(error_result)
        
        return results
    
    def _calculate_system_health(self, health_results: List[HealthCheck]) -> SystemHealth:
        """Calculate overall system health"""
        if not health_results:
            return SystemHealth(
                timestamp=datetime.now(),
                overall_status='unknown',
                health_score=0,
                checks_passed=0,
                checks_failed=0,
                checks_warning=0,
                categories={},
                critical_issues=[],
                recommendations=[]
            )
        
        # Count statuses
        status_counts = {'healthy': 0, 'warning': 0, 'critical': 0, 'unknown': 0}
        category_statuses = {}
        critical_issues = []
        recommendations = []
        
        for result in health_results:
            status_counts[result.status] += 1
            
            # Track category status (worst case wins)
            if result.category not in category_statuses:
                category_statuses[result.category] = result.status
            else:
                current = category_statuses[result.category]
                if self._status_priority(result.status) > self._status_priority(current):
                    category_statuses[result.category] = result.status
            
            # Collect critical issues
            if result.status == 'critical':
                critical_issues.append(result.message)
            
            # Collect recommendations
            recommendations.extend(result.recommendations)
        
        # Calculate health score
        total_checks = len(health_results)
        health_score = (
            (status_counts['healthy'] * 1.0 + 
             status_counts['warning'] * 0.5 + 
             status_counts['critical'] * 0.0 + 
             status_counts['unknown'] * 0.0) / total_checks
        ) * 100
        
        # Determine overall status
        if status_counts['critical'] > 0:
            overall_status = 'critical'
        elif status_counts['warning'] > 0:
            overall_status = 'warning'
        elif status_counts['healthy'] > 0:
            overall_status = 'healthy'
        else:
            overall_status = 'unknown'
        
        # Remove duplicate recommendations
        recommendations = list(set(recommendations))
        
        return SystemHealth(
            timestamp=datetime.now(),
            overall_status=overall_status,
            health_score=health_score,
            checks_passed=status_counts['healthy'],
            checks_failed=status_counts['critical'],
            checks_warning=status_counts['warning'],
            categories=category_statuses,
            critical_issues=critical_issues,
            recommendations=recommendations
        )
    
    def _status_priority(self, status: str) -> int:
        """Get priority of status (higher = worse)"""
        return {'healthy': 0, 'unknown': 1, 'warning': 2, 'critical': 3}.get(status, 0)
    
    # GPU Health Checks
    def _check_gpu_availability(self) -> HealthCheck:
        """Check if GPUs are available"""
        try:
            result = subprocess.run(['nvidia-smi', '--query-gpu=count', '--format=csv,noheader'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                gpu_count = int(result.stdout.strip())
                if gpu_count > 0:
                    return HealthCheck(
                        name='GPU Availability',
                        category='gpu',
                        status='healthy',
                        message=f'{gpu_count} GPUs detected',
                        timestamp=datetime.now(),
                        duration_ms=0,
                        details={'gpu_count': gpu_count},
                        recommendations=[]
                    )
                else:
                    return HealthCheck(
                        name='GPU Availability',
                        category='gpu',
                        status='critical',
                        message='No GPUs detected',
                        timestamp=datetime.now(),
                        duration_ms=0,
                        details={},
                        recommendations=['Check GPU installation and drivers']
                    )
            else:
                return HealthCheck(
                    name='GPU Availability',
                    category='gpu',
                    status='critical',
                    message='nvidia-smi command failed',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'error': result.stderr},
                    recommendations=['Check NVIDIA driver installation']
                )
        except Exception as e:
            return HealthCheck(
                name='GPU Availability',
                category='gpu',
                status='critical',
                message=f'GPU check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check GPU and driver installation']
            )
    
    def _check_gpu_temperature(self) -> HealthCheck:
        """Check GPU temperatures"""
        try:
            result = subprocess.run(['nvidia-smi', '--query-gpu=temperature.gpu', '--format=csv,noheader,nounits'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                temperatures = [int(temp.strip()) for temp in result.stdout.strip().split('\n') if temp.strip()]
                max_temp = max(temperatures)
                avg_temp = sum(temperatures) / len(temperatures)
                
                if max_temp > 85:
                    status = 'critical'
                    message = f'GPU temperature critical: {max_temp}°C'
                    recommendations = ['Check cooling system', 'Reduce workload']
                elif max_temp > 80:
                    status = 'warning'
                    message = f'GPU temperature high: {max_temp}°C'
                    recommendations = ['Monitor cooling', 'Check thermal throttling']
                else:
                    status = 'healthy'
                    message = f'GPU temperatures normal: avg {avg_temp:.1f}°C'
                    recommendations = []
                
                return HealthCheck(
                    name='GPU Temperature',
                    category='gpu',
                    status=status,
                    message=message,
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'max_temp': max_temp, 'avg_temp': avg_temp, 'all_temps': temperatures},
                    recommendations=recommendations
                )
            else:
                return HealthCheck(
                    name='GPU Temperature',
                    category='gpu',
                    status='unknown',
                    message='Could not read GPU temperatures',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={},
                    recommendations=['Check nvidia-smi access']
                )
        except Exception as e:
            return HealthCheck(
                name='GPU Temperature',
                category='gpu',
                status='unknown',
                message=f'Temperature check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check GPU monitoring capabilities']
            )
    
    def _check_gpu_memory(self) -> HealthCheck:
        """Check GPU memory usage"""
        try:
            result = subprocess.run(['nvidia-smi', '--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                memory_data = []
                for line in result.stdout.strip().split('\n'):
                    if line.strip():
                        used, total = map(int, line.split(', '))
                        memory_data.append({'used': used, 'total': total, 'percent': (used / total) * 100})
                
                max_usage = max(data['percent'] for data in memory_data)
                avg_usage = sum(data['percent'] for data in memory_data) / len(memory_data)
                
                if max_usage > 95:
                    status = 'critical'
                    message = f'GPU memory critical: {max_usage:.1f}%'
                    recommendations = ['Free GPU memory', 'Check for memory leaks']
                elif max_usage > 85:
                    status = 'warning'
                    message = f'GPU memory high: {max_usage:.1f}%'
                    recommendations = ['Monitor memory usage', 'Consider memory optimization']
                else:
                    status = 'healthy'
                    message = f'GPU memory normal: avg {avg_usage:.1f}%'
                    recommendations = []
                
                return HealthCheck(
                    name='GPU Memory',
                    category='gpu',
                    status=status,
                    message=message,
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'max_usage': max_usage, 'avg_usage': avg_usage, 'memory_data': memory_data},
                    recommendations=recommendations
                )
            else:
                return HealthCheck(
                    name='GPU Memory',
                    category='gpu',
                    status='unknown',
                    message='Could not read GPU memory',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={},
                    recommendations=['Check nvidia-smi access']
                )
        except Exception as e:
            return HealthCheck(
                name='GPU Memory',
                category='gpu',
                status='unknown',
                message=f'Memory check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check GPU memory monitoring']
            )
    
    def _check_cuda_runtime(self) -> HealthCheck:
        """Check CUDA runtime"""
        try:
            result = subprocess.run(['nvcc', '--version'], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                version_info = result.stdout
                return HealthCheck(
                    name='CUDA Runtime',
                    category='gpu',
                    status='healthy',
                    message='CUDA runtime available',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'version_info': version_info},
                    recommendations=[]
                )
            else:
                return HealthCheck(
                    name='CUDA Runtime',
                    category='gpu',
                    status='warning',
                    message='CUDA compiler not available',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={},
                    recommendations=['Install CUDA toolkit']
                )
        except Exception as e:
            return HealthCheck(
                name='CUDA Runtime',
                category='gpu',
                status='warning',
                message=f'CUDA check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check CUDA installation']
            )
    
    def _check_nvml_status(self) -> HealthCheck:
        """Check NVML status"""
        try:
            import pynvml
            pynvml.nvmlInit()
            device_count = pynvml.nvmlDeviceGetCount()
            pynvml.nvmlShutdown()
            
            return HealthCheck(
                name='NVML Status',
                category='gpu',
                status='healthy',
                message=f'NVML working with {device_count} devices',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'device_count': device_count},
                recommendations=[]
            )
        except Exception as e:
            return HealthCheck(
                name='NVML Status',
                category='gpu',
                status='warning',
                message=f'NVML not available: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Install pynvml', 'Check NVIDIA drivers']
            )
    
    # System Health Checks
    def _check_system_memory(self) -> HealthCheck:
        """Check system memory usage"""
        try:
            memory = psutil.virtual_memory()
            usage_percent = memory.percent
            
            if usage_percent > 90:
                status = 'critical'
                message = f'System memory critical: {usage_percent:.1f}%'
                recommendations = ['Free system memory', 'Check for memory leaks']
            elif usage_percent > 80:
                status = 'warning'
                message = f'System memory high: {usage_percent:.1f}%'
                recommendations = ['Monitor memory usage']
            else:
                status = 'healthy'
                message = f'System memory normal: {usage_percent:.1f}%'
                recommendations = []
            
            return HealthCheck(
                name='System Memory',
                category='memory',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={
                    'usage_percent': usage_percent,
                    'used_gb': memory.used / (1024**3),
                    'total_gb': memory.total / (1024**3)
                },
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='System Memory',
                category='memory',
                status='unknown',
                message=f'Memory check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check system memory monitoring']
            )
    
    def _check_memory_leaks(self) -> HealthCheck:
        """Check for memory leaks in critical processes"""
        try:
            # Check if memory leak detector is running
            leak_detector_running = any('memory_leak_detector' in p.name() for p in psutil.process_iter())
            
            if leak_detector_running:
                # Check for recent leak reports
                leak_reports_dir = Path('/var/log/vibecast/memory_leak_reports')
                if leak_reports_dir.exists():
                    recent_reports = [f for f in leak_reports_dir.glob('*.json') 
                                    if f.stat().st_mtime > (datetime.now() - timedelta(hours=1)).timestamp()]
                    
                    if recent_reports:
                        return HealthCheck(
                            name='Memory Leaks',
                            category='memory',
                            status='warning',
                            message=f'{len(recent_reports)} memory leak reports in last hour',
                            timestamp=datetime.now(),
                            duration_ms=0,
                            details={'recent_reports': len(recent_reports)},
                            recommendations=['Review memory leak reports', 'Investigate leaking processes']
                        )
                    else:
                        return HealthCheck(
                            name='Memory Leaks',
                            category='memory',
                            status='healthy',
                            message='No memory leaks detected',
                            timestamp=datetime.now(),
                            duration_ms=0,
                            details={},
                            recommendations=[]
                        )
                else:
                    return HealthCheck(
                        name='Memory Leaks',
                        category='memory',
                        status='warning',
                        message='Memory leak detector not generating reports',
                        timestamp=datetime.now(),
                        duration_ms=0,
                        details={},
                        recommendations=['Check memory leak detector configuration']
                    )
            else:
                return HealthCheck(
                    name='Memory Leaks',
                    category='memory',
                    status='warning',
                    message='Memory leak detector not running',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={},
                    recommendations=['Start memory leak detector']
                )
        except Exception as e:
            return HealthCheck(
                name='Memory Leaks',
                category='memory',
                status='unknown',
                message=f'Memory leak check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check memory leak detection system']
            )
    
    def _check_swap_usage(self) -> HealthCheck:
        """Check swap usage"""
        try:
            swap = psutil.swap_memory()
            usage_percent = swap.percent
            
            if usage_percent > 50:
                status = 'warning'
                message = f'Swap usage high: {usage_percent:.1f}%'
                recommendations = ['Investigate high swap usage', 'Consider adding more RAM']
            elif usage_percent > 80:
                status = 'critical'
                message = f'Swap usage critical: {usage_percent:.1f}%'
                recommendations = ['Free memory immediately', 'Check for memory leaks']
            else:
                status = 'healthy'
                message = f'Swap usage normal: {usage_percent:.1f}%'
                recommendations = []
            
            return HealthCheck(
                name='Swap Usage',
                category='memory',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={
                    'usage_percent': usage_percent,
                    'used_gb': swap.used / (1024**3),
                    'total_gb': swap.total / (1024**3)
                },
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='Swap Usage',
                category='memory',
                status='unknown',
                message=f'Swap check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check swap monitoring']
            )
    
    # Storage Health Checks
    def _check_disk_space(self) -> HealthCheck:
        """Check disk space usage"""
        try:
            disk_usage = psutil.disk_usage('/')
            usage_percent = (disk_usage.used / disk_usage.total) * 100
            
            if usage_percent > 90:
                status = 'critical'
                message = f'Disk space critical: {usage_percent:.1f}%'
                recommendations = ['Free disk space immediately', 'Clean up logs']
            elif usage_percent > 80:
                status = 'warning'
                message = f'Disk space high: {usage_percent:.1f}%'
                recommendations = ['Monitor disk usage', 'Plan cleanup']
            else:
                status = 'healthy'
                message = f'Disk space normal: {usage_percent:.1f}%'
                recommendations = []
            
            return HealthCheck(
                name='Disk Space',
                category='storage',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={
                    'usage_percent': usage_percent,
                    'used_gb': disk_usage.used / (1024**3),
                    'total_gb': disk_usage.total / (1024**3),
                    'free_gb': disk_usage.free / (1024**3)
                },
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='Disk Space',
                category='storage',
                status='unknown',
                message=f'Disk space check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check disk space monitoring']
            )
    
    def _check_disk_io(self) -> HealthCheck:
        """Check disk I/O performance"""
        try:
            disk_io = psutil.disk_io_counters()
            
            # Simple check - would need more sophisticated monitoring for real analysis
            if disk_io:
                return HealthCheck(
                    name='Disk I/O',
                    category='storage',
                    status='healthy',
                    message='Disk I/O functioning',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={
                        'read_count': disk_io.read_count,
                        'write_count': disk_io.write_count,
                        'read_bytes': disk_io.read_bytes,
                        'write_bytes': disk_io.write_bytes
                    },
                    recommendations=[]
                )
            else:
                return HealthCheck(
                    name='Disk I/O',
                    category='storage',
                    status='unknown',
                    message='Could not read disk I/O stats',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={},
                    recommendations=['Check disk I/O monitoring']
                )
        except Exception as e:
            return HealthCheck(
                name='Disk I/O',
                category='storage',
                status='unknown',
                message=f'Disk I/O check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check disk I/O monitoring']
            )
    
    def _check_log_rotation(self) -> HealthCheck:
        """Check log rotation status"""
        try:
            log_dir = Path('/var/log/vibecast')
            if log_dir.exists():
                log_files = list(log_dir.glob('*.log'))
                large_logs = [f for f in log_files if f.stat().st_size > 100 * 1024 * 1024]  # >100MB
                
                if large_logs:
                    return HealthCheck(
                        name='Log Rotation',
                        category='storage',
                        status='warning',
                        message=f'{len(large_logs)} large log files detected',
                        timestamp=datetime.now(),
                        duration_ms=0,
                        details={'large_logs': [str(f) for f in large_logs]},
                        recommendations=['Configure log rotation', 'Clean up old logs']
                    )
                else:
                    return HealthCheck(
                        name='Log Rotation',
                        category='storage',
                        status='healthy',
                        message='Log files normal size',
                        timestamp=datetime.now(),
                        duration_ms=0,
                        details={'log_count': len(log_files)},
                        recommendations=[]
                    )
            else:
                return HealthCheck(
                    name='Log Rotation',
                    category='storage',
                    status='warning',
                    message='Log directory not found',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={},
                    recommendations=['Create log directory']
                )
        except Exception as e:
            return HealthCheck(
                name='Log Rotation',
                category='storage',
                status='unknown',
                message=f'Log rotation check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check log rotation system']
            )
    
    # Network Health Checks
    def _check_network_connectivity(self) -> HealthCheck:
        """Check network connectivity"""
        try:
            # Test connectivity to common services
            test_hosts = ['8.8.8.8', '1.1.1.1', 'google.com']
            connectivity_results = []
            
            for host in test_hosts:
                result = subprocess.run(['ping', '-c', '1', '-W', '5', host], 
                                      capture_output=True, text=True)
                connectivity_results.append({
                    'host': host,
                    'success': result.returncode == 0,
                    'response': result.stdout if result.returncode == 0 else result.stderr
                })
            
            successful_tests = sum(1 for r in connectivity_results if r['success'])
            
            if successful_tests == 0:
                status = 'critical'
                message = 'No network connectivity'
                recommendations = ['Check network configuration', 'Verify internet connection']
            elif successful_tests < len(test_hosts):
                status = 'warning'
                message = f'Partial network connectivity ({successful_tests}/{len(test_hosts)})'
                recommendations = ['Check DNS resolution', 'Verify network configuration']
            else:
                status = 'healthy'
                message = 'Network connectivity healthy'
                recommendations = []
            
            return HealthCheck(
                name='Network Connectivity',
                category='network',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={'test_results': connectivity_results},
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='Network Connectivity',
                category='network',
                status='unknown',
                message=f'Network check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check network monitoring']
            )
    
    def _check_dns_resolution(self) -> HealthCheck:
        """Check DNS resolution"""
        try:
            import socket
            
            test_domains = ['google.com', 'github.com', 'nvidia.com']
            resolution_results = []
            
            for domain in test_domains:
                try:
                    ip = socket.gethostbyname(domain)
                    resolution_results.append({
                        'domain': domain,
                        'success': True,
                        'ip': ip
                    })
                except Exception as e:
                    resolution_results.append({
                        'domain': domain,
                        'success': False,
                        'error': str(e)
                    })
            
            successful_resolutions = sum(1 for r in resolution_results if r['success'])
            
            if successful_resolutions == 0:
                status = 'critical'
                message = 'DNS resolution failed'
                recommendations = ['Check DNS configuration', 'Verify DNS servers']
            elif successful_resolutions < len(test_domains):
                status = 'warning'
                message = f'Partial DNS resolution ({successful_resolutions}/{len(test_domains)})'
                recommendations = ['Check DNS configuration']
            else:
                status = 'healthy'
                message = 'DNS resolution healthy'
                recommendations = []
            
            return HealthCheck(
                name='DNS Resolution',
                category='network',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={'resolution_results': resolution_results},
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='DNS Resolution',
                category='network',
                status='unknown',
                message=f'DNS check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check DNS monitoring']
            )
    
    def _check_port_availability(self) -> HealthCheck:
        """Check critical port availability"""
        try:
            import socket
            
            critical_ports = [
                ('localhost', 8000, 'Prometheus metrics'),
                ('localhost', 3000, 'Grafana dashboard'),
                ('localhost', 9200, 'Elasticsearch')
            ]
            
            port_results = []
            
            for host, port, description in critical_ports:
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(5)
                    result = sock.connect_ex((host, port))
                    sock.close()
                    
                    port_results.append({
                        'host': host,
                        'port': port,
                        'description': description,
                        'available': result == 0
                    })
                except Exception as e:
                    port_results.append({
                        'host': host,
                        'port': port,
                        'description': description,
                        'available': False,
                        'error': str(e)
                    })
            
            available_ports = sum(1 for r in port_results if r['available'])
            
            if available_ports == 0:
                status = 'critical'
                message = 'No critical services responding'
                recommendations = ['Check service status', 'Verify port configuration']
            elif available_ports < len(critical_ports):
                status = 'warning'
                message = f'Some services not responding ({available_ports}/{len(critical_ports)})'
                recommendations = ['Check service status']
            else:
                status = 'healthy'
                message = 'All critical services responding'
                recommendations = []
            
            return HealthCheck(
                name='Port Availability',
                category='network',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={'port_results': port_results},
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='Port Availability',
                category='network',
                status='unknown',
                message=f'Port check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check port monitoring']
            )
    
    # Process Health Checks
    def _check_critical_processes(self) -> HealthCheck:
        """Check critical process status"""
        try:
            critical_processes = [
                'gpu_metrics_collector',
                'memory_leak_detector',
                'kernel_performance_tracker',
                'multi_gpu_monitor'
            ]
            
            process_results = []
            
            for process_name in critical_processes:
                running = any(process_name in p.name() for p in psutil.process_iter())
                process_results.append({
                    'name': process_name,
                    'running': running
                })
            
            running_processes = sum(1 for r in process_results if r['running'])
            
            if running_processes == 0:
                status = 'critical'
                message = 'No critical processes running'
                recommendations = ['Start monitoring processes', 'Check process configuration']
            elif running_processes < len(critical_processes):
                status = 'warning'
                message = f'Some processes not running ({running_processes}/{len(critical_processes)})'
                recommendations = ['Start missing processes']
            else:
                status = 'healthy'
                message = 'All critical processes running'
                recommendations = []
            
            return HealthCheck(
                name='Critical Processes',
                category='processes',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={'process_results': process_results},
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='Critical Processes',
                category='processes',
                status='unknown',
                message=f'Process check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check process monitoring']
            )
    
    def _check_process_health(self) -> HealthCheck:
        """Check overall process health"""
        try:
            # Check for high CPU/memory usage processes
            high_cpu_processes = []
            high_memory_processes = []
            
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    if proc.info['cpu_percent'] > 80:
                        high_cpu_processes.append(proc.info)
                    if proc.info['memory_percent'] > 10:
                        high_memory_processes.append(proc.info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            issues = []
            recommendations = []
            
            if high_cpu_processes:
                issues.append(f'{len(high_cpu_processes)} high CPU processes')
                recommendations.append('Investigate high CPU usage')
            
            if high_memory_processes:
                issues.append(f'{len(high_memory_processes)} high memory processes')
                recommendations.append('Investigate high memory usage')
            
            if issues:
                status = 'warning'
                message = f'Process health issues: {", ".join(issues)}'
            else:
                status = 'healthy'
                message = 'Process health normal'
            
            return HealthCheck(
                name='Process Health',
                category='processes',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={
                    'high_cpu_processes': high_cpu_processes,
                    'high_memory_processes': high_memory_processes
                },
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='Process Health',
                category='processes',
                status='unknown',
                message=f'Process health check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check process monitoring']
            )
    
    def _check_zombie_processes(self) -> HealthCheck:
        """Check for zombie processes"""
        try:
            zombie_count = 0
            for proc in psutil.process_iter(['pid', 'status']):
                try:
                    if proc.info['status'] == psutil.STATUS_ZOMBIE:
                        zombie_count += 1
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            if zombie_count > 10:
                status = 'warning'
                message = f'{zombie_count} zombie processes detected'
                recommendations = ['Investigate zombie processes', 'Check parent process cleanup']
            elif zombie_count > 0:
                status = 'healthy'
                message = f'{zombie_count} zombie processes (normal)'
                recommendations = []
            else:
                status = 'healthy'
                message = 'No zombie processes'
                recommendations = []
            
            return HealthCheck(
                name='Zombie Processes',
                category='processes',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={'zombie_count': zombie_count},
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='Zombie Processes',
                category='processes',
                status='unknown',
                message=f'Zombie process check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check process monitoring']
            )
    
    # Monitoring Health Checks
    def _check_prometheus_health(self) -> HealthCheck:
        """Check Prometheus health"""
        try:
            prometheus_url = self.config.get('endpoints', {}).get('prometheus', 'http://localhost:8000/metrics')
            
            response = requests.get(prometheus_url, timeout=10)
            
            if response.status_code == 200:
                return HealthCheck(
                    name='Prometheus Health',
                    category='monitoring',
                    status='healthy',
                    message='Prometheus responding',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'response_code': response.status_code},
                    recommendations=[]
                )
            else:
                return HealthCheck(
                    name='Prometheus Health',
                    category='monitoring',
                    status='warning',
                    message=f'Prometheus returned {response.status_code}',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'response_code': response.status_code},
                    recommendations=['Check Prometheus configuration']
                )
        except requests.RequestException as e:
            return HealthCheck(
                name='Prometheus Health',
                category='monitoring',
                status='critical',
                message=f'Prometheus not responding: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check Prometheus service', 'Verify network connectivity']
            )
        except Exception as e:
            return HealthCheck(
                name='Prometheus Health',
                category='monitoring',
                status='unknown',
                message=f'Prometheus check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check Prometheus monitoring']
            )
    
    def _check_grafana_health(self) -> HealthCheck:
        """Check Grafana health"""
        try:
            grafana_url = self.config.get('endpoints', {}).get('grafana', 'http://localhost:3000/api/health')
            
            response = requests.get(grafana_url, timeout=10)
            
            if response.status_code == 200:
                return HealthCheck(
                    name='Grafana Health',
                    category='monitoring',
                    status='healthy',
                    message='Grafana responding',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'response_code': response.status_code},
                    recommendations=[]
                )
            else:
                return HealthCheck(
                    name='Grafana Health',
                    category='monitoring',
                    status='warning',
                    message=f'Grafana returned {response.status_code}',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'response_code': response.status_code},
                    recommendations=['Check Grafana configuration']
                )
        except requests.RequestException as e:
            return HealthCheck(
                name='Grafana Health',
                category='monitoring',
                status='warning',
                message=f'Grafana not responding: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check Grafana service', 'Verify network connectivity']
            )
        except Exception as e:
            return HealthCheck(
                name='Grafana Health',
                category='monitoring',
                status='unknown',
                message=f'Grafana check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check Grafana monitoring']
            )
    
    def _check_log_aggregation(self) -> HealthCheck:
        """Check log aggregation health"""
        try:
            es_url = self.config.get('endpoints', {}).get('elasticsearch', 'http://localhost:9200/_cluster/health')
            
            response = requests.get(es_url, timeout=10)
            
            if response.status_code == 200:
                health_data = response.json()
                status_map = {
                    'green': 'healthy',
                    'yellow': 'warning',
                    'red': 'critical'
                }
                
                es_status = health_data.get('status', 'unknown')
                mapped_status = status_map.get(es_status, 'unknown')
                
                return HealthCheck(
                    name='Log Aggregation',
                    category='monitoring',
                    status=mapped_status,
                    message=f'Elasticsearch cluster {es_status}',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'cluster_health': health_data},
                    recommendations=[] if mapped_status == 'healthy' else ['Check Elasticsearch cluster']
                )
            else:
                return HealthCheck(
                    name='Log Aggregation',
                    category='monitoring',
                    status='warning',
                    message=f'Elasticsearch returned {response.status_code}',
                    timestamp=datetime.now(),
                    duration_ms=0,
                    details={'response_code': response.status_code},
                    recommendations=['Check Elasticsearch configuration']
                )
        except requests.RequestException as e:
            return HealthCheck(
                name='Log Aggregation',
                category='monitoring',
                status='warning',
                message=f'Elasticsearch not responding: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check Elasticsearch service', 'Verify network connectivity']
            )
        except Exception as e:
            return HealthCheck(
                name='Log Aggregation',
                category='monitoring',
                status='unknown',
                message=f'Log aggregation check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check log aggregation monitoring']
            )
    
    # Performance Health Checks
    def _check_cpu_usage(self) -> HealthCheck:
        """Check CPU usage"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            
            if cpu_percent > 90:
                status = 'critical'
                message = f'CPU usage critical: {cpu_percent:.1f}%'
                recommendations = ['Investigate high CPU usage', 'Check for runaway processes']
            elif cpu_percent > 80:
                status = 'warning'
                message = f'CPU usage high: {cpu_percent:.1f}%'
                recommendations = ['Monitor CPU usage']
            else:
                status = 'healthy'
                message = f'CPU usage normal: {cpu_percent:.1f}%'
                recommendations = []
            
            return HealthCheck(
                name='CPU Usage',
                category='performance',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={'cpu_percent': cpu_percent},
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='CPU Usage',
                category='performance',
                status='unknown',
                message=f'CPU usage check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check CPU monitoring']
            )
    
    def _check_load_average(self) -> HealthCheck:
        """Check load average"""
        try:
            load_avg = psutil.getloadavg()
            cpu_count = psutil.cpu_count()
            
            # Use 5-minute load average
            load_5min = load_avg[1]
            load_ratio = load_5min / cpu_count
            
            if load_ratio > 2.0:
                status = 'critical'
                message = f'Load average critical: {load_5min:.2f} ({load_ratio:.2f}x cores)'
                recommendations = ['Reduce system load', 'Check for resource contention']
            elif load_ratio > 1.5:
                status = 'warning'
                message = f'Load average high: {load_5min:.2f} ({load_ratio:.2f}x cores)'
                recommendations = ['Monitor system load']
            else:
                status = 'healthy'
                message = f'Load average normal: {load_5min:.2f} ({load_ratio:.2f}x cores)'
                recommendations = []
            
            return HealthCheck(
                name='Load Average',
                category='performance',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={
                    'load_1min': load_avg[0],
                    'load_5min': load_avg[1],
                    'load_15min': load_avg[2],
                    'cpu_count': cpu_count,
                    'load_ratio': load_ratio
                },
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='Load Average',
                category='performance',
                status='unknown',
                message=f'Load average check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check load average monitoring']
            )
    
    def _check_io_wait(self) -> HealthCheck:
        """Check I/O wait time"""
        try:
            # Get CPU times including iowait
            cpu_times = psutil.cpu_times()
            iowait_percent = getattr(cpu_times, 'iowait', 0)
            
            # Calculate as percentage of total CPU time
            total_time = sum(cpu_times)
            iowait_ratio = (iowait_percent / total_time) * 100 if total_time > 0 else 0
            
            if iowait_ratio > 20:
                status = 'critical'
                message = f'I/O wait critical: {iowait_ratio:.1f}%'
                recommendations = ['Investigate I/O bottlenecks', 'Check disk performance']
            elif iowait_ratio > 10:
                status = 'warning'
                message = f'I/O wait high: {iowait_ratio:.1f}%'
                recommendations = ['Monitor I/O performance']
            else:
                status = 'healthy'
                message = f'I/O wait normal: {iowait_ratio:.1f}%'
                recommendations = []
            
            return HealthCheck(
                name='I/O Wait',
                category='performance',
                status=status,
                message=message,
                timestamp=datetime.now(),
                duration_ms=0,
                details={
                    'iowait_percent': iowait_percent,
                    'iowait_ratio': iowait_ratio,
                    'total_time': total_time
                },
                recommendations=recommendations
            )
        except Exception as e:
            return HealthCheck(
                name='I/O Wait',
                category='performance',
                status='unknown',
                message=f'I/O wait check failed: {e}',
                timestamp=datetime.now(),
                duration_ms=0,
                details={'error': str(e)},
                recommendations=['Check I/O wait monitoring']
            )
    
    def _log_health_status(self, system_health: SystemHealth):
        """Log health status"""
        if system_health.overall_status == 'critical':
            logger.error(f"SYSTEM HEALTH CRITICAL: Score {system_health.health_score:.1f}%, "
                        f"{system_health.checks_failed} failed checks")
        elif system_health.overall_status == 'warning':
            logger.warning(f"SYSTEM HEALTH WARNING: Score {system_health.health_score:.1f}%, "
                          f"{system_health.checks_warning} warnings")
        else:
            logger.info(f"SYSTEM HEALTH OK: Score {system_health.health_score:.1f}%, "
                       f"{system_health.checks_passed} passed checks")
    
    def _check_health_alerts(self, system_health: SystemHealth):
        """Check for health-based alerts"""
        # Implementation would depend on alerting system
        if system_health.overall_status == 'critical':
            logger.critical(f"HEALTH ALERT: System health critical - {system_health.health_score:.1f}%")
        elif system_health.health_score < 70:
            logger.warning(f"HEALTH ALERT: System health degraded - {system_health.health_score:.1f}%")
    
    def get_health_summary(self) -> Dict:
        """Get health summary"""
        if not self.current_health:
            return {'status': 'unknown', 'message': 'No health data available'}
        
        return {
            'timestamp': self.current_health.timestamp.isoformat(),
            'overall_status': self.current_health.overall_status,
            'health_score': self.current_health.health_score,
            'checks_passed': self.current_health.checks_passed,
            'checks_failed': self.current_health.checks_failed,
            'checks_warning': self.current_health.checks_warning,
            'categories': self.current_health.categories,
            'critical_issues': self.current_health.critical_issues,
            'recommendations': self.current_health.recommendations
        }
    
    def export_health_report(self, output_path: str):
        """Export detailed health report"""
        if not self.current_health:
            logger.warning("No health data to export")
            return
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'current_health': asdict(self.current_health),
            'health_history': [asdict(h) for h in self.health_history[-24:]],  # Last 24 hours
            'configuration': self.config
        }
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        logger.info(f"Exported health report to {output_path}")
    
    def stop_health_checking(self):
        """Stop health checking"""
        logger.info("Stopping health checking")
        self.running = False
        
        if self.check_thread:
            self.check_thread.join(timeout=10)
        
        # Export final report
        if self.current_health:
            final_report_path = f"/var/log/vibecast/final_health_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            self.export_health_report(final_report_path)
        
        summary = self.get_health_summary()
        logger.info(f"Health checking stopped. Final summary: {summary}")


def main():
    """Main function"""
    config = {
        'check_interval_seconds': 60,
        'health_retention_hours': 24,
        'enabled_categories': ['gpu', 'memory', 'storage', 'network', 'processes', 'monitoring', 'performance']
    }
    
    health_checker = HealthChecker(config)
    
    try:
        health_checker.start_health_checking()
        
        # Keep running until interrupted
        while True:
            time.sleep(30)
            
            # Print summary periodically
            summary = health_checker.get_health_summary()
            if summary.get('status') != 'unknown':
                logger.info(f"Health summary: {summary}")
            
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        health_checker.stop_health_checking()


if __name__ == "__main__":
    main()