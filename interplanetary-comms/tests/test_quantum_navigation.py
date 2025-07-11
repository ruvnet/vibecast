#!/usr/bin/env python3
"""
Comprehensive Test Suite for Quantum Navigation System
Tests quantum navigation, position estimation, and trajectory planning
"""

import pytest
import asyncio
import sys
import os
import time
import numpy as np
from unittest.mock import Mock, patch
from typing import Dict, List, Optional

# Add quantum_navigation module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'quantum_navigation'))

from quantum_navigator import QuantumNavigator, NavigationState, QuantumEntanglement
from position_estimator import PositionEstimator, PositionConfidence
from trajectory_planner import TrajectoryPlanner, TrajectoryOptimization
from config import NavigationConfig

class TestQuantumNavigator:
    """Test suite for quantum navigation system"""
    
    @pytest.fixture
    def navigator(self):
        """Create a quantum navigator instance for testing"""
        return QuantumNavigator("test_node")
    
    @pytest.fixture
    def position_estimator(self):
        """Create a position estimator instance for testing"""
        return PositionEstimator()
    
    @pytest.fixture
    def trajectory_planner(self):
        """Create a trajectory planner instance for testing"""
        return TrajectoryPlanner()
    
    def test_quantum_navigator_initialization(self, navigator):
        """Test quantum navigator initialization"""
        assert navigator.node_id == "test_node"
        assert navigator.state == NavigationState.IDLE
        assert len(navigator.entangled_pairs) == 0
        assert navigator.position_history == []
        assert navigator.velocity_history == []
    
    def test_quantum_entanglement_creation(self, navigator):
        """Test quantum entanglement pair creation"""
        entanglement = navigator.create_entanglement_pair("target_node")
        
        assert entanglement.source_node == "test_node"
        assert entanglement.target_node == "target_node"
        assert entanglement.entanglement_strength > 0
        assert entanglement.decoherence_rate > 0
        assert entanglement.quantum_state_fidelity > 0.5
    
    def test_position_measurement(self, navigator):
        """Test quantum position measurement"""
        # Create entanglement pair
        entanglement = navigator.create_entanglement_pair("reference_node")
        
        # Set reference position
        reference_pos = np.array([1.0, 0.0, 0.0])
        navigator.set_reference_position("reference_node", reference_pos)
        
        # Measure position
        position = navigator.measure_position("reference_node")
        
        assert position is not None
        assert len(position) == 3
        assert np.allclose(position, reference_pos, atol=1.0)  # Within 1 AU
    
    def test_navigation_state_transitions(self, navigator):
        """Test navigation state transitions"""
        # Test IDLE -> INITIALIZING
        navigator.start_navigation()
        assert navigator.state == NavigationState.INITIALIZING
        
        # Test INITIALIZING -> CALIBRATING
        navigator.state = NavigationState.CALIBRATING
        assert navigator.state == NavigationState.CALIBRATING
        
        # Test CALIBRATING -> NAVIGATING
        navigator.state = NavigationState.NAVIGATING
        assert navigator.state == NavigationState.NAVIGATING
        
        # Test NAVIGATING -> IDLE
        navigator.stop_navigation()
        assert navigator.state == NavigationState.IDLE
    
    def test_position_history_tracking(self, navigator):
        """Test position history tracking"""
        # Add test positions
        positions = [
            np.array([0.0, 0.0, 0.0]),
            np.array([0.1, 0.0, 0.0]),
            np.array([0.2, 0.0, 0.0])
        ]
        
        for pos in positions:
            navigator.add_position_measurement(pos, 0.95)
        
        assert len(navigator.position_history) == 3
        assert np.allclose(navigator.position_history[-1], positions[-1])
    
    def test_velocity_calculation(self, navigator):
        """Test velocity calculation from position history"""
        # Add positions with time stamps
        t0 = time.time()
        navigator.add_position_measurement(np.array([0.0, 0.0, 0.0]), 0.95, t0)
        
        t1 = t0 + 1.0
        navigator.add_position_measurement(np.array([0.1, 0.0, 0.0]), 0.95, t1)
        
        velocity = navigator.calculate_velocity()
        expected_velocity = np.array([0.1, 0.0, 0.0])  # 0.1 AU/s
        
        assert np.allclose(velocity, expected_velocity, atol=0.01)
    
    def test_quantum_confidence_calculation(self, navigator):
        """Test quantum confidence calculation"""
        # Create entanglement with high fidelity
        entanglement = navigator.create_entanglement_pair("test_target")
        entanglement.quantum_state_fidelity = 0.95
        
        confidence = navigator.calculate_quantum_confidence(entanglement)
        assert confidence > 0.8  # Should be high confidence
        
        # Test with low fidelity
        entanglement.quantum_state_fidelity = 0.5
        confidence = navigator.calculate_quantum_confidence(entanglement)
        assert confidence < 0.7  # Should be lower confidence

class TestPositionEstimator:
    """Test suite for position estimation"""
    
    def test_position_estimator_initialization(self, position_estimator):
        """Test position estimator initialization"""
        assert position_estimator.filter_state is not None
        assert position_estimator.measurement_history == []
        assert position_estimator.confidence_level == PositionConfidence.MEDIUM
    
    def test_kalman_filter_prediction(self, position_estimator):
        """Test Kalman filter prediction step"""
        # Set initial state
        initial_state = np.array([0.0, 0.0, 0.0, 0.1, 0.0, 0.0])  # pos + vel
        position_estimator.filter_state = initial_state
        
        # Predict next state
        dt = 1.0
        predicted_state = position_estimator.predict(dt)
        
        # Position should have changed due to velocity
        assert predicted_state[0] > 0.0  # x position increased
        assert np.allclose(predicted_state[3:], initial_state[3:])  # velocity unchanged
    
    def test_measurement_update(self, position_estimator):
        """Test measurement update in Kalman filter"""
        # Initialize with some state
        position_estimator.filter_state = np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
        
        # Add measurement
        measurement = np.array([0.1, 0.0, 0.0])
        position_estimator.add_measurement(measurement, 0.95)
        
        # State should have been updated
        assert len(position_estimator.measurement_history) == 1
        assert np.allclose(position_estimator.filter_state[:3], measurement, atol=0.1)
    
    def test_confidence_level_calculation(self, position_estimator):
        """Test confidence level calculation"""
        # High accuracy measurements should increase confidence
        for i in range(5):
            measurement = np.array([i * 0.1, 0.0, 0.0])
            position_estimator.add_measurement(measurement, 0.95)
        
        position_estimator.update_confidence_level()
        assert position_estimator.confidence_level == PositionConfidence.HIGH
    
    def test_uncertainty_estimation(self, position_estimator):
        """Test position uncertainty estimation"""
        # Add measurements with varying accuracy
        measurements = [
            (np.array([0.0, 0.0, 0.0]), 0.95),
            (np.array([0.1, 0.0, 0.0]), 0.90),
            (np.array([0.2, 0.0, 0.0]), 0.85)
        ]
        
        for pos, accuracy in measurements:
            position_estimator.add_measurement(pos, accuracy)
        
        uncertainty = position_estimator.get_position_uncertainty()
        assert uncertainty > 0.0
        assert uncertainty < 1.0  # Should be reasonable

class TestTrajectoryPlanner:
    """Test suite for trajectory planning"""
    
    def test_trajectory_planner_initialization(self, trajectory_planner):
        """Test trajectory planner initialization"""
        assert trajectory_planner.optimization_method == TrajectoryOptimization.LEAST_SQUARES
        assert trajectory_planner.trajectory_history == []
        assert trajectory_planner.waypoints == []
    
    def test_waypoint_management(self, trajectory_planner):
        """Test waypoint addition and management"""
        # Add waypoints
        waypoints = [
            np.array([0.0, 0.0, 0.0]),
            np.array([1.0, 0.0, 0.0]),
            np.array([2.0, 0.0, 0.0])
        ]
        
        for wp in waypoints:
            trajectory_planner.add_waypoint(wp)
        
        assert len(trajectory_planner.waypoints) == 3
        assert np.allclose(trajectory_planner.waypoints[-1], waypoints[-1])
    
    def test_trajectory_optimization(self, trajectory_planner):
        """Test trajectory optimization"""
        # Set up waypoints
        start = np.array([0.0, 0.0, 0.0])
        end = np.array([1.0, 1.0, 0.0])
        
        trajectory_planner.add_waypoint(start)
        trajectory_planner.add_waypoint(end)
        
        # Optimize trajectory
        optimized_trajectory = trajectory_planner.optimize_trajectory(
            start_velocity=np.array([0.1, 0.0, 0.0]),
            end_velocity=np.array([0.0, 0.1, 0.0]),
            time_horizon=10.0
        )
        
        assert len(optimized_trajectory) > 0
        assert np.allclose(optimized_trajectory[0], start, atol=0.1)
        assert np.allclose(optimized_trajectory[-1], end, atol=0.1)
    
    def test_trajectory_validation(self, trajectory_planner):
        """Test trajectory validation"""
        # Create valid trajectory
        valid_trajectory = [
            np.array([0.0, 0.0, 0.0]),
            np.array([0.5, 0.5, 0.0]),
            np.array([1.0, 1.0, 0.0])
        ]
        
        is_valid = trajectory_planner.validate_trajectory(valid_trajectory)
        assert is_valid
        
        # Create invalid trajectory (too large jumps)
        invalid_trajectory = [
            np.array([0.0, 0.0, 0.0]),
            np.array([10.0, 10.0, 0.0]),  # Too large jump
            np.array([1.0, 1.0, 0.0])
        ]
        
        is_valid = trajectory_planner.validate_trajectory(invalid_trajectory)
        assert not is_valid
    
    def test_fuel_optimization(self, trajectory_planner):
        """Test fuel-optimal trajectory planning"""
        # Set optimization method to fuel optimal
        trajectory_planner.optimization_method = TrajectoryOptimization.FUEL_OPTIMAL
        
        start = np.array([0.0, 0.0, 0.0])
        end = np.array([1.0, 0.0, 0.0])
        
        trajectory_planner.add_waypoint(start)
        trajectory_planner.add_waypoint(end)
        
        # Optimize for fuel
        fuel_optimal_trajectory = trajectory_planner.optimize_trajectory(
            start_velocity=np.array([0.0, 0.0, 0.0]),
            end_velocity=np.array([0.0, 0.0, 0.0]),
            time_horizon=20.0
        )
        
        assert len(fuel_optimal_trajectory) > 0
        # Fuel-optimal should be more direct
        assert len(fuel_optimal_trajectory) <= 10

class TestQuantumNavigationIntegration:
    """Test suite for integrated quantum navigation system"""
    
    def test_full_navigation_cycle(self):
        """Test complete navigation cycle"""
        # Create navigator
        navigator = QuantumNavigator("earth_station")
        
        # Start navigation
        navigator.start_navigation()
        
        # Create entanglement with target
        entanglement = navigator.create_entanglement_pair("mars_station")
        
        # Set reference position
        mars_position = np.array([1.5, 0.0, 0.0])  # Mars position
        navigator.set_reference_position("mars_station", mars_position)
        
        # Measure position
        measured_position = navigator.measure_position("mars_station")
        
        # Verify measurement
        assert measured_position is not None
        assert len(measured_position) == 3
        
        # Stop navigation
        navigator.stop_navigation()
        assert navigator.state == NavigationState.IDLE
    
    def test_multi_node_navigation(self):
        """Test navigation with multiple reference nodes"""
        navigator = QuantumNavigator("spacecraft")
        
        # Create entanglements with multiple nodes
        reference_nodes = {
            "earth": np.array([0.0, 0.0, 0.0]),
            "mars": np.array([1.5, 0.0, 0.0]),
            "jupiter": np.array([5.2, 0.0, 0.0])
        }
        
        for node_name, position in reference_nodes.items():
            navigator.create_entanglement_pair(node_name)
            navigator.set_reference_position(node_name, position)
        
        # Measure positions
        measurements = {}
        for node_name in reference_nodes:
            measurements[node_name] = navigator.measure_position(node_name)
        
        # Verify all measurements
        for node_name, measurement in measurements.items():
            assert measurement is not None
            expected_pos = reference_nodes[node_name]
            assert np.allclose(measurement, expected_pos, atol=1.0)
    
    def test_navigation_error_handling(self):
        """Test error handling in navigation system"""
        navigator = QuantumNavigator("test_node")
        
        # Test measurement without entanglement
        with pytest.raises(ValueError):
            navigator.measure_position("non_existent_node")
        
        # Test measurement without reference position
        navigator.create_entanglement_pair("target")
        with pytest.raises(ValueError):
            navigator.measure_position("target")
    
    def test_quantum_decoherence_simulation(self):
        """Test quantum decoherence effects"""
        navigator = QuantumNavigator("test_node")
        
        # Create entanglement
        entanglement = navigator.create_entanglement_pair("target")
        initial_fidelity = entanglement.quantum_state_fidelity
        
        # Simulate time passage
        navigator.simulate_decoherence(entanglement, time_elapsed=100.0)
        
        # Fidelity should decrease
        assert entanglement.quantum_state_fidelity < initial_fidelity
    
    def test_navigation_performance_metrics(self):
        """Test navigation performance metrics"""
        navigator = QuantumNavigator("performance_test")
        
        # Add multiple position measurements
        for i in range(10):
            position = np.array([i * 0.1, 0.0, 0.0])
            navigator.add_position_measurement(position, 0.9)
        
        # Calculate performance metrics
        metrics = navigator.get_performance_metrics()
        
        assert 'average_accuracy' in metrics
        assert 'position_stability' in metrics
        assert 'measurement_frequency' in metrics
        assert metrics['average_accuracy'] > 0.8

# Test configuration
@pytest.fixture
def navigation_config():
    """Test navigation configuration"""
    return NavigationConfig(
        measurement_interval=1.0,
        decoherence_rate=0.01,
        quantum_confidence_threshold=0.8,
        position_uncertainty_threshold=0.1
    )

def test_navigation_config(navigation_config):
    """Test navigation configuration"""
    assert navigation_config.measurement_interval == 1.0
    assert navigation_config.decoherence_rate == 0.01
    assert navigation_config.quantum_confidence_threshold == 0.8
    assert navigation_config.position_uncertainty_threshold == 0.1

# Performance benchmarks
@pytest.mark.benchmark
def test_navigation_performance_benchmark():
    """Benchmark navigation performance"""
    navigator = QuantumNavigator("benchmark_test")
    
    # Benchmark position measurement
    start_time = time.time()
    
    for i in range(100):
        position = np.array([i * 0.01, 0.0, 0.0])
        navigator.add_position_measurement(position, 0.9)
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Should process 100 measurements in reasonable time
    assert duration < 1.0  # Less than 1 second
    
    # Benchmark trajectory optimization
    planner = TrajectoryPlanner()
    
    start_time = time.time()
    
    # Add waypoints
    for i in range(10):
        planner.add_waypoint(np.array([i, 0.0, 0.0]))
    
    # Optimize trajectory
    optimized = planner.optimize_trajectory(
        start_velocity=np.array([0.1, 0.0, 0.0]),
        end_velocity=np.array([0.0, 0.0, 0.0]),
        time_horizon=10.0
    )
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Should optimize trajectory in reasonable time
    assert duration < 2.0  # Less than 2 seconds
    assert len(optimized) > 0

if __name__ == "__main__":
    pytest.main([__file__, "-v"])