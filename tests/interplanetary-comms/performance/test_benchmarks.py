"""
Performance benchmark tests for interplanetary communications system.
Tests system performance under various load conditions and scenarios.
"""

import pytest
import time
import asyncio
import numpy as np
import concurrent.futures
from unittest.mock import Mock, patch
from typing import Dict, List, Any, Optional
import psutil
import gc
import sys
import json
from dataclasses import dataclass
from statistics import mean, stdev
import threading

# Add the simulation module to the path
sys.path.insert(0, '/workspaces/vibecast/interplanetary-comms/simulations')

from protocol_simulator import (
    InterplanetaryNetwork, CelestialBody, Message, QuantumChannel,
    ClassicalChannel, RelayStation, OrbitalPosition
)

@dataclass
class BenchmarkResult:
    """Benchmark result data structure"""
    test_name: str
    duration: float
    throughput: float
    latency_mean: float
    latency_std: float
    latency_p95: float
    latency_p99: float
    success_rate: float
    error_rate: float
    cpu_usage: float
    memory_usage: float
    additional_metrics: Dict[str, Any]

class PerformanceMonitor:
    """Monitor system performance during tests"""
    
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.cpu_samples = []
        self.memory_samples = []
        self.monitoring = False
        self.monitor_thread = None
    
    def start(self):
        """Start performance monitoring"""
        self.start_time = time.time()
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
    
    def stop(self):
        """Stop performance monitoring"""
        self.monitoring = False
        self.end_time = time.time()
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)
    
    def _monitor_loop(self):
        """Performance monitoring loop"""
        while self.monitoring:
            try:
                cpu_percent = psutil.cpu_percent(interval=0.1)
                memory_info = psutil.virtual_memory()
                
                self.cpu_samples.append(cpu_percent)
                self.memory_samples.append(memory_info.percent)
                
                time.sleep(0.1)
            except Exception:
                break
    
    def get_metrics(self) -> Dict[str, float]:
        """Get performance metrics"""
        return {
            'duration': self.end_time - self.start_time if self.end_time else 0,
            'avg_cpu': mean(self.cpu_samples) if self.cpu_samples else 0,
            'max_cpu': max(self.cpu_samples) if self.cpu_samples else 0,
            'avg_memory': mean(self.memory_samples) if self.memory_samples else 0,
            'max_memory': max(self.memory_samples) if self.memory_samples else 0
        }

@pytest.fixture
def performance_monitor():
    """Provide performance monitor"""
    return PerformanceMonitor()

class TestQuantumNavigationPerformance:
    """Performance tests for quantum navigation system"""
    
    def test_sensor_reading_throughput(self, performance_monitor):
        """Test quantum sensor reading throughput"""
        performance_monitor.start()
        
        # Simulate high-frequency sensor readings
        sample_rate = 250  # Hz
        duration = 5.0  # seconds
        expected_samples = int(sample_rate * duration)
        
        start_time = time.time()
        samples = []
        
        for i in range(expected_samples):
            # Simulate quantum magnetometer reading
            reading = np.random.normal(50000, 100, 3)  # [X, Y, Z] in nT
            samples.append(reading)
            
            # Maintain sample rate
            elapsed = time.time() - start_time
            expected_time = i / sample_rate
            if elapsed < expected_time:
                time.sleep(expected_time - elapsed)
        
        actual_duration = time.time() - start_time
        actual_sample_rate = len(samples) / actual_duration
        
        performance_monitor.stop()
        metrics = performance_monitor.get_metrics()
        
        # Verify performance requirements
        assert actual_sample_rate >= 240, f"Sample rate too low: {actual_sample_rate:.1f} Hz"
        assert metrics['avg_cpu'] < 50, f"CPU usage too high: {metrics['avg_cpu']:.1f}%"
        
        # Test data quality
        sample_array = np.array(samples)
        assert sample_array.shape == (expected_samples, 3)
        assert np.all(np.isfinite(sample_array))
    
    def test_navigation_filter_performance(self, performance_monitor):
        """Test navigation filter processing performance"""
        performance_monitor.start()
        
        # Test EKF update rate
        update_rate = 10  # Hz
        duration = 10.0  # seconds
        num_updates = int(update_rate * duration)
        
        # Simulate EKF updates
        state = np.array([40.7128, -74.0060, 0.0, 0.0])  # [lat, lon, dlat, dlon]
        covariance = np.eye(4) * 0.1
        
        start_time = time.time()
        update_times = []
        
        for i in range(num_updates):
            update_start = time.time()
            
            # Simulate EKF predict step
            dt = 1.0 / update_rate
            F = np.array([[1, 0, dt, 0],
                         [0, 1, 0, dt],
                         [0, 0, 1, 0],
                         [0, 0, 0, 1]])
            Q = np.eye(4) * 0.01
            
            state = F @ state
            covariance = F @ covariance @ F.T + Q
            
            # Simulate EKF update step
            measurement = np.array([100.0, 200.0, 300.0])  # Magnetic field
            H = np.random.rand(3, 4)  # Measurement matrix
            R = np.eye(3) * 0.05  # Measurement noise
            
            innovation = measurement - H @ state[:3]  # Simplified
            S = H @ covariance @ H.T + R
            K = covariance @ H.T @ np.linalg.inv(S)
            
            state = state + K @ innovation
            covariance = (np.eye(4) - K @ H) @ covariance
            
            update_times.append(time.time() - update_start)
        
        total_duration = time.time() - start_time
        actual_update_rate = num_updates / total_duration
        
        performance_monitor.stop()
        metrics = performance_monitor.get_metrics()
        
        # Verify performance requirements
        assert actual_update_rate >= 9, f"Update rate too low: {actual_update_rate:.1f} Hz"
        assert mean(update_times) < 0.05, f"Update time too high: {mean(update_times):.4f} s"
        assert metrics['avg_cpu'] < 30, f"CPU usage too high: {metrics['avg_cpu']:.1f}%"
        
        # Test convergence
        position_error = np.sqrt(np.trace(covariance[:2, :2]))
        assert position_error < 0.1, f"Position error too high: {position_error:.4f}"
    
    def test_magnetic_field_interpolation_performance(self, performance_monitor):
        """Test magnetic field interpolation performance"""
        performance_monitor.start()
        
        # Create synthetic magnetic field map
        map_size = 1000
        lat_range = np.linspace(40, 41, map_size)
        lon_range = np.linspace(-75, -74, map_size)
        
        # Generate field data
        field_map = np.zeros((map_size, map_size, 3))
        for i in range(map_size):
            for j in range(map_size):
                lat, lon = lat_range[i], lon_range[j]
                field_map[i, j, 0] = 50000 + 100 * np.sin(lat * np.pi / 180)
                field_map[i, j, 1] = 5000 + 50 * np.cos(lon * np.pi / 180)
                field_map[i, j, 2] = 45000 + 20 * (lat - 40.5)
        
        # Test interpolation performance
        num_interpolations = 10000
        interpolation_points = [
            (40.0 + np.random.random(), -75.0 + np.random.random())
            for _ in range(num_interpolations)
        ]
        
        start_time = time.time()
        interpolation_times = []
        
        for lat, lon in interpolation_points:
            interp_start = time.time()
            
            # Bilinear interpolation
            lat_idx = np.interp(lat, lat_range, range(map_size))
            lon_idx = np.interp(lon, lon_range, range(map_size))
            
            lat_low = int(lat_idx)
            lat_high = min(lat_low + 1, map_size - 1)
            lon_low = int(lon_idx)
            lon_high = min(lon_low + 1, map_size - 1)
            
            # Interpolate
            field_interp = (
                field_map[lat_low, lon_low] * (lat_high - lat_idx) * (lon_high - lon_idx) +
                field_map[lat_high, lon_low] * (lat_idx - lat_low) * (lon_high - lon_idx) +
                field_map[lat_low, lon_high] * (lat_high - lat_idx) * (lon_idx - lon_low) +
                field_map[lat_high, lon_high] * (lat_idx - lat_low) * (lon_idx - lon_low)
            )
            
            interpolation_times.append(time.time() - interp_start)
        
        total_duration = time.time() - start_time
        interpolation_rate = num_interpolations / total_duration
        
        performance_monitor.stop()
        metrics = performance_monitor.get_metrics()
        
        # Verify performance requirements
        assert interpolation_rate >= 1000, f"Interpolation rate too low: {interpolation_rate:.1f} Hz"
        assert mean(interpolation_times) < 0.001, f"Interpolation time too high: {mean(interpolation_times):.6f} s"
        assert metrics['avg_cpu'] < 40, f"CPU usage too high: {metrics['avg_cpu']:.1f}%"

class TestProtocolPerformance:
    """Performance tests for communication protocols"""
    
    def test_message_throughput(self, network, performance_monitor):
        """Test message throughput performance"""
        performance_monitor.start()
        
        # Test parameters
        num_messages = 1000
        message_sizes = [1024, 10240, 102400, 1024000]  # 1KB to 1MB
        
        results = []
        start_time = time.time()
        
        for i in range(num_messages):
            message_size = message_sizes[i % len(message_sizes)]
            
            message = Message(
                id=f"throughput-test-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=i % 5,
                data_size=message_size,
                timestamp=time.time(),
                quantum_encrypted=(i % 2 == 0)
            )
            
            msg_start = time.time()
            result = network.send_message(message)
            msg_duration = time.time() - msg_start
            
            results.append({
                'success': result['success'],
                'size': message_size,
                'duration': msg_duration,
                'total_delay': result.get('total_delay', 0),
                'hops': result.get('hops', 0)
            })
        
        total_duration = time.time() - start_time
        performance_monitor.stop()
        metrics = performance_monitor.get_metrics()
        
        # Analyze results
        successful = [r for r in results if r['success']]
        total_bytes = sum(r['size'] for r in successful)
        throughput = total_bytes / total_duration
        
        # Performance requirements
        assert len(successful) >= 0.95 * num_messages, f"Success rate too low: {len(successful)/num_messages:.2f}"
        assert throughput >= 1e6, f"Throughput too low: {throughput:.1f} bytes/s"
        
        # Latency analysis
        processing_times = [r['duration'] for r in successful]
        avg_processing_time = mean(processing_times)
        
        assert avg_processing_time < 0.1, f"Processing time too high: {avg_processing_time:.4f} s"
        assert metrics['avg_cpu'] < 60, f"CPU usage too high: {metrics['avg_cpu']:.1f}%"
    
    def test_quantum_key_generation_performance(self, network, performance_monitor):
        """Test quantum key generation performance"""
        performance_monitor.start()
        
        qchannel = network.quantum_channels[(CelestialBody.EARTH, CelestialBody.MARS)]
        
        # Test key generation rate
        num_keys = 100
        key_sizes = [128, 256, 512, 1024]
        
        key_generation_times = []
        key_rates = []
        
        start_time = time.time()
        
        for i in range(num_keys):
            key_size = key_sizes[i % len(key_sizes)]
            
            key_start = time.time()
            key, rate = qchannel.generate_quantum_key(key_size)
            key_duration = time.time() - key_start
            
            key_generation_times.append(key_duration)
            key_rates.append(rate)
            
            # Verify key quality
            assert len(key) == key_size
            assert all(bit in [0, 1] for bit in key)
        
        total_duration = time.time() - start_time
        
        performance_monitor.stop()
        metrics = performance_monitor.get_metrics()
        
        # Analyze performance
        avg_generation_time = mean(key_generation_times)
        avg_key_rate = mean(key_rates)
        
        # Performance requirements
        assert avg_generation_time < 0.1, f"Key generation time too high: {avg_generation_time:.4f} s"
        assert avg_key_rate >= 1000, f"Key generation rate too low: {avg_key_rate:.1f} bps"
        
        # Rate stability
        rate_std = stdev(key_rates)
        rate_stability = rate_std / avg_key_rate
        assert rate_stability < 0.3, f"Key generation rate too unstable: {rate_stability:.3f}"
    
    def test_relay_station_performance(self, network, performance_monitor):
        """Test relay station performance under load"""
        performance_monitor.start()
        
        relay = network.relay_stations[CelestialBody.L4_EARTH]
        
        # Test store and retrieve performance
        num_messages = 10000
        message_sizes = [1024, 10240, 102400]
        
        store_times = []
        retrieve_times = []
        
        # Store messages
        store_start = time.time()
        stored_messages = []
        
        for i in range(num_messages):
            message_size = message_sizes[i % len(message_sizes)]
            
            message = Message(
                id=f"relay-perf-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=i % 5,
                data_size=message_size,
                timestamp=time.time(),
                quantum_encrypted=True
            )
            
            msg_start = time.time()
            success = relay.store_message(message)
            store_time = time.time() - msg_start
            
            if success:
                stored_messages.append(message)
                store_times.append(store_time)
        
        store_duration = time.time() - store_start
        
        # Retrieve messages
        retrieve_start = time.time()
        retrieved_messages = []
        
        while True:
            msg_start = time.time()
            message = relay.retrieve_message()
            retrieve_time = time.time() - msg_start
            
            if message is None:
                break
            
            retrieved_messages.append(message)
            retrieve_times.append(retrieve_time)
        
        retrieve_duration = time.time() - retrieve_start
        
        performance_monitor.stop()
        metrics = performance_monitor.get_metrics()
        
        # Analyze performance
        store_rate = len(stored_messages) / store_duration
        retrieve_rate = len(retrieved_messages) / retrieve_duration
        
        # Performance requirements
        assert store_rate >= 1000, f"Store rate too low: {store_rate:.1f} msg/s"
        assert retrieve_rate >= 1000, f"Retrieve rate too low: {retrieve_rate:.1f} msg/s"
        
        # Latency requirements
        avg_store_time = mean(store_times)
        avg_retrieve_time = mean(retrieve_times)
        
        assert avg_store_time < 0.001, f"Store time too high: {avg_store_time:.6f} s"
        assert avg_retrieve_time < 0.001, f"Retrieve time too high: {avg_retrieve_time:.6f} s"
        
        # Verify message integrity
        assert len(retrieved_messages) == len(stored_messages), "Message count mismatch"
    
    def test_network_scalability(self, performance_monitor):
        """Test network scalability with multiple nodes"""
        performance_monitor.start()
        
        # Create larger network
        network = InterplanetaryNetwork()
        
        # Add more celestial bodies
        additional_bodies = [
            (CelestialBody.L4_EARTH, 2.0, np.pi/6),
            (CelestialBody.L5_EARTH, 2.0, -np.pi/6),
            (CelestialBody.L4_MARS, 3.0, np.pi/3),
            (CelestialBody.L5_MARS, 3.0, -np.pi/3)
        ]
        
        for body, distance, angle in additional_bodies:
            network.nodes[body] = OrbitalPosition(body, distance, angle)
        
        # Test with high message volume
        num_messages = 5000
        concurrent_messages = 100
        
        start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            
            for i in range(num_messages):
                message = Message(
                    id=f"scale-test-{i}",
                    source=CelestialBody.EARTH,
                    destination=CelestialBody.MARS,
                    priority=i % 5,
                    data_size=1024 * (i % 10 + 1),
                    timestamp=time.time(),
                    quantum_encrypted=(i % 2 == 0)
                )
                
                future = executor.submit(network.send_message, message)
                futures.append(future)
                
                # Control concurrency
                if len(futures) >= concurrent_messages:
                    # Wait for some to complete
                    done, _ = concurrent.futures.wait(futures, return_when=concurrent.futures.FIRST_COMPLETED)
                    for f in done:
                        futures.remove(f)
            
            # Wait for all remaining
            concurrent.futures.wait(futures)
        
        total_duration = time.time() - start_time
        message_rate = num_messages / total_duration
        
        performance_monitor.stop()
        metrics = performance_monitor.get_metrics()
        
        # Scalability requirements
        assert message_rate >= 100, f"Message rate too low: {message_rate:.1f} msg/s"
        assert metrics['avg_cpu'] < 80, f"CPU usage too high: {metrics['avg_cpu']:.1f}%"
        assert metrics['avg_memory'] < 80, f"Memory usage too high: {metrics['avg_memory']:.1f}%"

class TestLatencyPerformance:
    """Test latency performance under various conditions"""
    
    @pytest.mark.parametrize("scenario", [
        "mars_close", "mars_far", "jupiter", "saturn"
    ])
    def test_latency_by_distance(self, network, scenario, performance_monitor):
        """Test latency performance by distance"""
        performance_monitor.start()
        
        # Configure network for scenario
        distance_configs = {
            "mars_close": (1.0, 1.4),      # Earth-Mars minimum distance
            "mars_far": (1.0, 2.6),        # Earth-Mars maximum distance
            "jupiter": (1.0, 5.2),         # Earth-Jupiter average
            "saturn": (1.0, 9.5)           # Earth-Saturn average
        }
        
        earth_dist, target_dist = distance_configs[scenario]
        network.nodes[CelestialBody.EARTH].distance_from_sun = earth_dist
        network.nodes[CelestialBody.MARS].distance_from_sun = target_dist
        
        # Test messages
        num_messages = 100
        latencies = []
        
        start_time = time.time()
        
        for i in range(num_messages):
            message = Message(
                id=f"latency-{scenario}-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=1,
                data_size=1024,
                timestamp=time.time(),
                quantum_encrypted=True
            )
            
            result = network.send_message(message)
            if result['success']:
                latencies.append(result['total_delay'])
        
        performance_monitor.stop()
        
        # Analyze latency
        avg_latency = mean(latencies)
        latency_std = stdev(latencies)
        
        # Expected latency ranges (in seconds)
        expected_ranges = {
            "mars_close": (4 * 60, 8 * 60),     # 4-8 minutes
            "mars_far": (20 * 60, 24 * 60),     # 20-24 minutes
            "jupiter": (33 * 60, 54 * 60),      # 33-54 minutes
            "saturn": (68 * 60, 88 * 60)        # 68-88 minutes
        }
        
        min_expected, max_expected = expected_ranges[scenario]
        assert min_expected <= avg_latency <= max_expected, f"Latency out of range: {avg_latency/60:.1f} minutes"
        
        # Latency stability
        latency_cv = latency_std / avg_latency
        assert latency_cv < 0.2, f"Latency too unstable: {latency_cv:.3f}"
    
    def test_priority_latency_performance(self, network, performance_monitor):
        """Test latency performance by message priority"""
        performance_monitor.start()
        
        # Send messages with different priorities
        priorities = [0, 1, 2, 3, 4]  # 0 = highest, 4 = lowest
        messages_per_priority = 50
        
        results_by_priority = {p: [] for p in priorities}
        
        start_time = time.time()
        
        for priority in priorities:
            for i in range(messages_per_priority):
                message = Message(
                    id=f"priority-latency-{priority}-{i}",
                    source=CelestialBody.EARTH,
                    destination=CelestialBody.MARS,
                    priority=priority,
                    data_size=1024 * (i + 1),
                    timestamp=time.time(),
                    quantum_encrypted=(priority <= 2)
                )
                
                result = network.send_message(message)
                if result['success']:
                    results_by_priority[priority].append(result['total_delay'])
        
        performance_monitor.stop()
        
        # Analyze priority-based latency
        avg_latencies = {}
        for priority, latencies in results_by_priority.items():
            if latencies:
                avg_latencies[priority] = mean(latencies)
        
        # Higher priority should have lower or equal latency
        for p in range(len(priorities) - 1):
            if p in avg_latencies and (p + 1) in avg_latencies:
                assert avg_latencies[p] <= avg_latencies[p + 1] * 1.1, \
                    f"Priority {p} latency ({avg_latencies[p]:.1f}s) should be <= priority {p+1} ({avg_latencies[p+1]:.1f}s)"
        
        # P0 (emergency) should meet strict requirements
        if 0 in avg_latencies:
            assert avg_latencies[0] < 30 * 60, f"P0 latency too high: {avg_latencies[0]/60:.1f} minutes"

class TestResourceUtilization:
    """Test resource utilization and efficiency"""
    
    def test_memory_usage_efficiency(self, network, performance_monitor):
        """Test memory usage efficiency"""
        performance_monitor.start()
        
        # Baseline memory usage
        gc.collect()
        initial_memory = psutil.Process().memory_info().rss
        
        # Load test with large messages
        num_messages = 1000
        message_size = 1024 * 1024  # 1MB
        
        messages = []
        for i in range(num_messages):
            message = Message(
                id=f"memory-test-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=i % 5,
                data_size=message_size,
                timestamp=time.time(),
                quantum_encrypted=True
            )
            messages.append(message)
        
        # Process messages
        for message in messages:
            network.send_message(message)
        
        # Check memory usage
        current_memory = psutil.Process().memory_info().rss
        memory_increase = current_memory - initial_memory
        
        performance_monitor.stop()
        metrics = performance_monitor.get_metrics()
        
        # Memory efficiency requirements
        expected_memory = num_messages * message_size
        memory_overhead = memory_increase / expected_memory
        
        assert memory_overhead < 2.0, f"Memory overhead too high: {memory_overhead:.2f}x"
        assert metrics['max_memory'] < 90, f"Memory usage too high: {metrics['max_memory']:.1f}%"
        
        # Cleanup and verify memory is freed
        del messages
        gc.collect()
        
        final_memory = psutil.Process().memory_info().rss
        memory_freed = current_memory - final_memory
        
        # Should free at least 50% of allocated memory
        assert memory_freed > memory_increase * 0.5, "Memory not properly freed"
    
    def test_cpu_usage_efficiency(self, network, performance_monitor):
        """Test CPU usage efficiency"""
        performance_monitor.start()
        
        # CPU-intensive workload
        num_messages = 5000
        concurrent_limit = 50
        
        start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrent_limit) as executor:
            futures = []
            
            for i in range(num_messages):
                message = Message(
                    id=f"cpu-test-{i}",
                    source=CelestialBody.EARTH,
                    destination=CelestialBody.MARS,
                    priority=i % 5,
                    data_size=1024 * (i % 10 + 1),
                    timestamp=time.time(),
                    quantum_encrypted=True
                )
                
                future = executor.submit(network.send_message, message)
                futures.append(future)
            
            # Wait for completion
            concurrent.futures.wait(futures)
        
        total_duration = time.time() - start_time
        message_rate = num_messages / total_duration
        
        performance_monitor.stop()
        metrics = performance_monitor.get_metrics()
        
        # CPU efficiency requirements
        assert message_rate >= 500, f"Message rate too low: {message_rate:.1f} msg/s"
        assert metrics['avg_cpu'] < 70, f"CPU usage too high: {metrics['avg_cpu']:.1f}%"
        
        # CPU utilization should be reasonable
        cpu_per_message = metrics['avg_cpu'] / message_rate
        assert cpu_per_message < 0.1, f"CPU per message too high: {cpu_per_message:.4f}%"
    
    def test_network_bandwidth_efficiency(self, network, performance_monitor):
        """Test network bandwidth efficiency"""
        performance_monitor.start()
        
        # Test with different message sizes
        message_sizes = [1024, 10240, 102400, 1024000]  # 1KB to 1MB
        messages_per_size = 100
        
        bandwidth_results = []
        
        for msg_size in message_sizes:
            size_start = time.time()
            successful_bytes = 0
            
            for i in range(messages_per_size):
                message = Message(
                    id=f"bandwidth-{msg_size}-{i}",
                    source=CelestialBody.EARTH,
                    destination=CelestialBody.MARS,
                    priority=1,
                    data_size=msg_size,
                    timestamp=time.time(),
                    quantum_encrypted=True
                )
                
                result = network.send_message(message)
                if result['success']:
                    successful_bytes += msg_size
            
            size_duration = time.time() - size_start
            bandwidth = successful_bytes / size_duration
            
            bandwidth_results.append({
                'size': msg_size,
                'bandwidth': bandwidth,
                'duration': size_duration
            })
        
        performance_monitor.stop()
        
        # Analyze bandwidth efficiency
        avg_bandwidth = mean([r['bandwidth'] for r in bandwidth_results])
        
        # Bandwidth requirements
        assert avg_bandwidth >= 1e6, f"Bandwidth too low: {avg_bandwidth:.1f} bytes/s"
        
        # Bandwidth should scale with message size (larger messages = better efficiency)
        small_msg_bw = [r['bandwidth'] for r in bandwidth_results if r['size'] <= 10240]
        large_msg_bw = [r['bandwidth'] for r in bandwidth_results if r['size'] >= 102400]
        
        if small_msg_bw and large_msg_bw:
            assert mean(large_msg_bw) >= mean(small_msg_bw), "Bandwidth doesn't scale with message size"

@pytest.mark.asyncio
async def test_async_performance_benchmarks(network, performance_monitor):
    """Test asynchronous performance benchmarks"""
    performance_monitor.start()
    
    async def send_message_async(message):
        """Async message sending simulation"""
        await asyncio.sleep(0.001)  # Simulate async processing
        return network.send_message(message)
    
    # Test concurrent message processing
    num_messages = 1000
    batch_size = 100
    
    start_time = time.time()
    all_results = []
    
    for batch_start in range(0, num_messages, batch_size):
        batch_end = min(batch_start + batch_size, num_messages)
        batch_messages = []
        
        for i in range(batch_start, batch_end):
            message = Message(
                id=f"async-perf-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=i % 5,
                data_size=1024 * (i % 10 + 1),
                timestamp=time.time(),
                quantum_encrypted=True
            )
            batch_messages.append(message)
        
        # Process batch concurrently
        tasks = [send_message_async(msg) for msg in batch_messages]
        batch_results = await asyncio.gather(*tasks)
        all_results.extend(batch_results)
    
    total_duration = time.time() - start_time
    message_rate = num_messages / total_duration
    
    performance_monitor.stop()
    metrics = performance_monitor.get_metrics()
    
    # Async performance requirements
    successful = [r for r in all_results if r['success']]
    success_rate = len(successful) / len(all_results)
    
    assert success_rate >= 0.95, f"Async success rate too low: {success_rate:.2f}"
    assert message_rate >= 500, f"Async message rate too low: {message_rate:.1f} msg/s"
    assert metrics['avg_cpu'] < 60, f"Async CPU usage too high: {metrics['avg_cpu']:.1f}%"

def test_performance_regression_detection(network, performance_monitor):
    """Test performance regression detection"""
    performance_monitor.start()
    
    # Baseline performance test
    baseline_messages = 1000
    baseline_start = time.time()
    baseline_results = []
    
    for i in range(baseline_messages):
        message = Message(
            id=f"baseline-{i}",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=i % 5,
            data_size=1024 * (i % 10 + 1),
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        result = network.send_message(message)
        baseline_results.append(result)
    
    baseline_duration = time.time() - baseline_start
    baseline_rate = baseline_messages / baseline_duration
    
    # Compare with expected benchmarks
    expected_min_rate = 100  # messages/second
    expected_max_latency = 30 * 60  # 30 minutes
    
    # Performance regression checks
    assert baseline_rate >= expected_min_rate, f"Performance regression: rate {baseline_rate:.1f} < {expected_min_rate} msg/s"
    
    successful_results = [r for r in baseline_results if r['success']]
    if successful_results:
        avg_latency = mean([r['total_delay'] for r in successful_results])
        assert avg_latency <= expected_max_latency, f"Performance regression: latency {avg_latency:.1f}s > {expected_max_latency}s"
    
    performance_monitor.stop()
    metrics = performance_monitor.get_metrics()
    
    # Store performance baseline for future comparisons
    performance_baseline = {
        'message_rate': baseline_rate,
        'avg_latency': avg_latency if successful_results else 0,
        'cpu_usage': metrics['avg_cpu'],
        'memory_usage': metrics['avg_memory'],
        'success_rate': len(successful_results) / len(baseline_results)
    }
    
    # In a real system, this would be stored and compared with historical data
    assert performance_baseline['success_rate'] >= 0.95, "Success rate regression detected"