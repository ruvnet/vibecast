"""
Test configuration for interplanetary communications system testing.
Provides fixtures and utilities for comprehensive testing.
"""

import pytest
import numpy as np
import asyncio
from typing import Dict, List, Any, Optional
from unittest.mock import Mock, MagicMock
from dataclasses import dataclass
import tempfile
import os
import sys

# Add the simulation module to the path
sys.path.insert(0, '/workspaces/vibecast/interplanetary-comms/simulations')

from protocol_simulator import (
    InterplanetaryNetwork, CelestialBody, Message, QuantumChannel,
    ClassicalChannel, RelayStation, OrbitalPosition
)

@dataclass
class TestConfiguration:
    """Test configuration for different scenarios"""
    magnetic_field_strength: float
    latency_range: tuple
    error_rate: float
    quantum_coherence_time: float
    relay_count: int
    bandwidth: float
    test_duration: int

# Test configurations for different scenarios
TEST_CONFIGS = {
    "mars_optimal": TestConfiguration(
        magnetic_field_strength=1.0,
        latency_range=(4*60, 8*60),  # 4-8 minutes
        error_rate=0.001,
        quantum_coherence_time=1.0,
        relay_count=2,
        bandwidth=1e9,
        test_duration=3600
    ),
    "mars_worst_case": TestConfiguration(
        magnetic_field_strength=0.1,
        latency_range=(20*60, 24*60),  # 20-24 minutes
        error_rate=0.01,
        quantum_coherence_time=0.1,
        relay_count=1,
        bandwidth=1e6,
        test_duration=7200
    ),
    "jupiter_scenario": TestConfiguration(
        magnetic_field_strength=0.05,
        latency_range=(33*60, 54*60),  # 33-54 minutes
        error_rate=0.02,
        quantum_coherence_time=0.05,
        relay_count=4,
        bandwidth=1e5,
        test_duration=10800
    ),
    "solar_storm": TestConfiguration(
        magnetic_field_strength=10.0,
        latency_range=(4*60, 24*60),
        error_rate=0.1,
        quantum_coherence_time=0.01,
        relay_count=3,
        bandwidth=1e8,
        test_duration=1800
    )
}

@pytest.fixture
def test_config():
    """Provide test configuration"""
    return TEST_CONFIGS["mars_optimal"]

@pytest.fixture
def network():
    """Create a test interplanetary network"""
    return InterplanetaryNetwork()

@pytest.fixture
def quantum_channel():
    """Create a test quantum channel"""
    return QuantumChannel(CelestialBody.EARTH, CelestialBody.MARS)

@pytest.fixture
def classical_channel():
    """Create a test classical channel"""
    return ClassicalChannel(CelestialBody.EARTH, CelestialBody.MARS, 1e9)

@pytest.fixture
def relay_station():
    """Create a test relay station"""
    return RelayStation(CelestialBody.L4_EARTH, 100 * 10**15)

@pytest.fixture
def test_message():
    """Create a test message"""
    return Message(
        id="test-001",
        source=CelestialBody.EARTH,
        destination=CelestialBody.MARS,
        priority=1,
        data_size=1024 * 1024,  # 1MB
        timestamp=0,
        quantum_encrypted=True
    )

@pytest.fixture
def mock_quantum_sensors():
    """Mock quantum magnetic sensors"""
    mock = Mock()
    mock.read_field.return_value = np.array([100.0, 200.0, 300.0])  # nT
    mock.sensitivity = 80e-15  # 80 fT/√Hz
    mock.sample_rate = 250  # Hz
    mock.calibrate.return_value = True
    return mock

@pytest.fixture
def mock_navigation_system():
    """Mock navigation system based on quantum magnetic navigation"""
    mock = Mock()
    mock.get_position.return_value = (40.7128, -74.0060)  # NYC coordinates
    mock.get_accuracy.return_value = 20.0  # meters
    mock.update_frequency = 10  # Hz
    return mock

@pytest.fixture
def magnetic_field_scenarios():
    """Different magnetic field scenarios for testing"""
    return {
        "earth_normal": {
            "field_strength": 50000.0,  # nT
            "inclination": 60.0,  # degrees
            "declination": -15.0,  # degrees
            "noise_level": 0.1  # nT RMS
        },
        "mars_surface": {
            "field_strength": 100.0,  # nT (much weaker)
            "inclination": 45.0,
            "declination": 10.0,
            "noise_level": 0.5
        },
        "deep_space": {
            "field_strength": 0.1,  # nT (very weak)
            "inclination": 0.0,
            "declination": 0.0,
            "noise_level": 0.01
        },
        "solar_storm": {
            "field_strength": 100000.0,  # nT (enhanced)
            "inclination": 70.0,
            "declination": 30.0,
            "noise_level": 10.0
        }
    }

@pytest.fixture
def latency_scenarios():
    """Different latency scenarios for testing"""
    return {
        "earth_moon": {"min": 1.3, "max": 1.7, "unit": "seconds"},
        "earth_mars_close": {"min": 4, "max": 8, "unit": "minutes"},
        "earth_mars_far": {"min": 20, "max": 24, "unit": "minutes"},
        "earth_jupiter": {"min": 33, "max": 54, "unit": "minutes"},
        "earth_saturn": {"min": 68, "max": 88, "unit": "minutes"}
    }

@pytest.fixture
def error_correction_scenarios():
    """Different error correction scenarios"""
    return {
        "clean_channel": {"ber": 1e-9, "correction_capability": 0.001},
        "noisy_channel": {"ber": 1e-6, "correction_capability": 0.01},
        "extreme_noise": {"ber": 1e-3, "correction_capability": 0.1},
        "solar_interference": {"ber": 1e-2, "correction_capability": 0.2}
    }

@pytest.fixture
def performance_benchmarks():
    """Performance benchmarks for testing"""
    return {
        "quantum_key_generation": {
            "min_rate": 1000,  # bits/second
            "target_rate": 10000,
            "max_latency": 1.0  # seconds
        },
        "message_throughput": {
            "min_rate": 1e6,  # bits/second
            "target_rate": 1e9,
            "max_latency": 0.1
        },
        "relay_processing": {
            "max_delay": 0.1,  # seconds
            "min_throughput": 1e8,
            "max_memory_usage": 1e15  # bytes
        }
    }

@pytest.fixture
def security_test_vectors():
    """Security test vectors for validation"""
    return {
        "bb84_protocol": {
            "key_length": 1024,
            "expected_sift_rate": 0.5,
            "max_qber": 0.11,  # 11% quantum bit error rate threshold
            "privacy_amplification_ratio": 0.5
        },
        "post_quantum_crypto": {
            "kyber_security_level": 5,
            "dilithium_security_level": 5,
            "key_sizes": {
                "kyber": 1568,
                "dilithium": 2592
            }
        }
    }

@pytest.fixture
def temp_directory():
    """Create temporary directory for test files"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

@pytest.fixture
def mock_hardware():
    """Mock hardware interfaces"""
    hardware = Mock()
    hardware.quantum_sensors = Mock()
    hardware.quantum_sensors.read.return_value = np.random.normal(0, 100, 3)
    hardware.transmitters = Mock()
    hardware.transmitters.send.return_value = True
    hardware.receivers = Mock()
    hardware.receivers.receive.return_value = b"test_data"
    return hardware

@pytest.fixture
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

# Test utilities
def generate_test_magnetic_field(scenario: str, duration: float, sample_rate: float) -> np.ndarray:
    """Generate synthetic magnetic field data for testing"""
    scenarios = {
        "earth_normal": lambda t: 50000 + 100 * np.sin(2 * np.pi * t) + np.random.normal(0, 0.1, len(t)),
        "mars_surface": lambda t: 100 + 10 * np.sin(2 * np.pi * t * 0.1) + np.random.normal(0, 0.5, len(t)),
        "deep_space": lambda t: 0.1 + 0.01 * np.sin(2 * np.pi * t * 0.01) + np.random.normal(0, 0.01, len(t)),
        "solar_storm": lambda t: 100000 + 10000 * np.sin(2 * np.pi * t * 10) + np.random.normal(0, 10, len(t))
    }
    
    t = np.linspace(0, duration, int(duration * sample_rate))
    return scenarios[scenario](t)

def calculate_navigation_accuracy(magnetic_field: np.ndarray, reference_position: tuple) -> float:
    """Calculate navigation accuracy for testing"""
    # Simplified accuracy calculation based on field strength and noise
    field_strength = np.mean(np.abs(magnetic_field))
    noise_level = np.std(magnetic_field)
    snr = field_strength / noise_level if noise_level > 0 else float('inf')
    
    # Accuracy improves with SNR (simplified model)
    accuracy = 100 / (1 + snr / 10)  # meters
    return accuracy

def validate_quantum_key(key: List[int], test_vectors: Dict[str, Any]) -> bool:
    """Validate quantum key against test vectors"""
    if len(key) != test_vectors["key_length"]:
        return False
    
    # Check for proper randomness (simplified)
    ones_count = sum(key)
    expected_ones = len(key) / 2
    tolerance = len(key) * 0.1
    
    return abs(ones_count - expected_ones) <= tolerance

def emulate_network_delay(source: CelestialBody, destination: CelestialBody, scenario: str) -> float:
    """Emulate network delay for testing"""
    delay_map = {
        ("earth", "moon"): 1.5,
        ("earth", "mars"): 12 * 60,  # average
        ("earth", "jupiter"): 43.5 * 60,
        ("earth", "saturn"): 78 * 60
    }
    
    key = (source.value.lower(), destination.value.lower())
    base_delay = delay_map.get(key, 0)
    
    # Add scenario-specific variations
    if scenario == "worst_case":
        base_delay *= 2
    elif scenario == "solar_storm":
        base_delay *= 1.5
    
    return base_delay

class TestMetrics:
    """Collect and analyze test metrics"""
    
    def __init__(self):
        self.metrics = {
            "latency": [],
            "throughput": [],
            "error_rate": [],
            "success_rate": [],
            "resource_usage": []
        }
    
    def record_latency(self, latency: float):
        self.metrics["latency"].append(latency)
    
    def record_throughput(self, throughput: float):
        self.metrics["throughput"].append(throughput)
    
    def record_error_rate(self, error_rate: float):
        self.metrics["error_rate"].append(error_rate)
    
    def record_success_rate(self, success_rate: float):
        self.metrics["success_rate"].append(success_rate)
    
    def record_resource_usage(self, usage: Dict[str, Any]):
        self.metrics["resource_usage"].append(usage)
    
    def get_summary(self) -> Dict[str, Any]:
        summary = {}
        for metric, values in self.metrics.items():
            if values:
                summary[metric] = {
                    "mean": np.mean(values),
                    "std": np.std(values),
                    "min": np.min(values),
                    "max": np.max(values),
                    "count": len(values)
                }
        return summary

@pytest.fixture
def test_metrics():
    """Provide test metrics collector"""
    return TestMetrics()