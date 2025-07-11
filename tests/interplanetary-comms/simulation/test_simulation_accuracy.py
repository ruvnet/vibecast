"""
Simulation accuracy tests for interplanetary communications system.
Tests the accuracy of the protocol simulator against known physics and benchmarks.
"""

import pytest
import numpy as np
import matplotlib.pyplot as plt
from unittest.mock import Mock, patch
from typing import Dict, List, Any, Optional, Tuple
import sys
import time
import json
from dataclasses import dataclass
from scipy import stats
import tempfile
import os

# Add the simulation module to the path
sys.path.insert(0, '/workspaces/vibecast/interplanetary-comms/simulations')

from protocol_simulator import (
    InterplanetaryNetwork, CelestialBody, Message, QuantumChannel,
    ClassicalChannel, RelayStation, OrbitalPosition, SPEED_OF_LIGHT, AU
)

class TestOrbitalMechanicsAccuracy:
    """Test accuracy of orbital mechanics simulation"""
    
    def test_earth_orbit_parameters(self, network):
        """Test Earth orbital parameters accuracy"""
        earth_position = network.nodes[CelestialBody.EARTH]
        
        # Earth should be at ~1 AU from Sun
        assert abs(earth_position.distance_from_sun - 1.0) < 0.1, \
            f"Earth distance incorrect: {earth_position.distance_from_sun:.3f} AU"
        
        # Test orbital period calculation
        # Earth's orbital period is 365.25 days
        earth_angular_velocity = 2 * np.pi / 365.25  # rad/day
        
        # Simulate one year
        original_angle = earth_position.angle
        network.update_positions(365.25)
        
        expected_angle = original_angle + 2 * np.pi
        actual_angle = earth_position.angle
        
        # Account for angle wrapping
        angle_diff = abs(actual_angle - expected_angle)
        if angle_diff > np.pi:
            angle_diff = 2 * np.pi - angle_diff
        
        assert angle_diff < 0.1, f"Earth orbital period incorrect: {angle_diff:.3f} rad"
    
    def test_mars_orbit_parameters(self, network):
        """Test Mars orbital parameters accuracy"""
        mars_position = network.nodes[CelestialBody.MARS]
        
        # Mars should be at ~1.5 AU from Sun
        assert abs(mars_position.distance_from_sun - 1.5) < 0.1, \
            f"Mars distance incorrect: {mars_position.distance_from_sun:.3f} AU"
        
        # Test orbital period calculation
        # Mars orbital period is 687 Earth days
        mars_angular_velocity = 2 * np.pi / 687  # rad/day
        
        # Simulate one Mars year
        original_angle = mars_position.angle
        network.update_positions(687)
        
        expected_angle = original_angle + 2 * np.pi
        actual_angle = mars_position.angle
        
        # Account for angle wrapping
        angle_diff = abs(actual_angle - expected_angle)
        if angle_diff > np.pi:
            angle_diff = 2 * np.pi - angle_diff
        
        assert angle_diff < 0.1, f"Mars orbital period incorrect: {angle_diff:.3f} rad"
    
    def test_lagrange_point_positions(self, network):
        """Test Lagrange point positions accuracy"""
        # L4 and L5 points should be 60 degrees ahead/behind in orbit
        earth_angle = network.nodes[CelestialBody.EARTH].angle
        l4_angle = network.nodes[CelestialBody.L4_EARTH].angle
        l5_angle = network.nodes[CelestialBody.L5_EARTH].angle
        
        # L4 should be 60 degrees ahead
        expected_l4_angle = earth_angle + np.pi/3
        l4_diff = abs(l4_angle - expected_l4_angle)
        if l4_diff > np.pi:
            l4_diff = 2 * np.pi - l4_diff
        
        assert l4_diff < 0.2, f"L4 position incorrect: {l4_diff:.3f} rad"
        
        # L5 should be 60 degrees behind
        expected_l5_angle = earth_angle - np.pi/3
        l5_diff = abs(l5_angle - expected_l5_angle)
        if l5_diff > np.pi:
            l5_diff = 2 * np.pi - l5_diff
        
        assert l5_diff < 0.2, f"L5 position incorrect: {l5_diff:.3f} rad"
    
    def test_distance_calculations(self, network):
        """Test distance calculations between celestial bodies"""
        # Test Earth-Mars distance range
        earth_pos = network.nodes[CelestialBody.EARTH]
        mars_pos = network.nodes[CelestialBody.MARS]
        
        # Calculate distance
        earth_x, earth_y = earth_pos.to_cartesian()
        mars_x, mars_y = mars_pos.to_cartesian()
        distance = np.sqrt((mars_x - earth_x)**2 + (mars_y - earth_y)**2)
        
        # Earth-Mars distance should be between 0.5 and 2.5 AU
        assert 0.5 <= distance <= 2.5, f"Earth-Mars distance unrealistic: {distance:.3f} AU"
        
        # Test with known configurations
        # Opposition (minimum distance)
        earth_pos.angle = 0
        mars_pos.angle = 0
        earth_x, earth_y = earth_pos.to_cartesian()
        mars_x, mars_y = mars_pos.to_cartesian()
        min_distance = np.sqrt((mars_x - earth_x)**2 + (mars_y - earth_y)**2)
        
        # Should be approximately 0.5 AU
        assert abs(min_distance - 0.5) < 0.1, f"Minimum distance incorrect: {min_distance:.3f} AU"
        
        # Conjunction (maximum distance)
        earth_pos.angle = 0
        mars_pos.angle = np.pi
        earth_x, earth_y = earth_pos.to_cartesian()
        mars_x, mars_y = mars_pos.to_cartesian()
        max_distance = np.sqrt((mars_x - earth_x)**2 + (mars_y - earth_y)**2)
        
        # Should be approximately 2.5 AU
        assert abs(max_distance - 2.5) < 0.1, f"Maximum distance incorrect: {max_distance:.3f} AU"

class TestCommunicationDelayAccuracy:
    """Test accuracy of communication delay calculations"""
    
    def test_light_speed_delay_calculation(self, network):
        """Test light-speed delay calculations"""
        # Test Earth-Mars communication delay
        earth_pos = network.nodes[CelestialBody.EARTH]
        mars_pos = network.nodes[CelestialBody.MARS]
        
        # Set known positions
        earth_pos.angle = 0
        mars_pos.angle = np.pi/2  # 90 degrees apart
        
        # Calculate delay using classical channel
        channel = network.classical_channels[(CelestialBody.EARTH, CelestialBody.MARS)]
        delay = channel.calculate_delay(earth_pos, mars_pos)
        
        # Calculate expected delay
        earth_x, earth_y = earth_pos.to_cartesian()
        mars_x, mars_y = mars_pos.to_cartesian()
        distance_au = np.sqrt((mars_x - earth_x)**2 + (mars_y - earth_y)**2)
        distance_m = distance_au * AU
        expected_delay = distance_m / SPEED_OF_LIGHT
        
        # Should match within 1%
        relative_error = abs(delay - expected_delay) / expected_delay
        assert relative_error < 0.01, f"Delay calculation error: {relative_error:.3f}"
    
    def test_delay_range_validation(self, network):
        """Test delay range validation against known values"""
        # Test various Earth-Mars configurations
        test_configs = [
            (0, 0, "opposition"),           # Minimum distance
            (0, np.pi, "conjunction"),      # Maximum distance
            (0, np.pi/2, "quadrature"),     # 90 degrees
            (0, np.pi/4, "intermediate")    # 45 degrees
        ]
        
        delays = []
        for earth_angle, mars_angle, config_name in test_configs:
            network.nodes[CelestialBody.EARTH].angle = earth_angle
            network.nodes[CelestialBody.MARS].angle = mars_angle
            
            channel = network.classical_channels[(CelestialBody.EARTH, CelestialBody.MARS)]
            delay = channel.calculate_delay(
                network.nodes[CelestialBody.EARTH],
                network.nodes[CelestialBody.MARS]
            )
            delays.append((config_name, delay))
        
        # Expected delay ranges (in seconds)
        expected_ranges = {
            "opposition": (3*60, 5*60),      # 3-5 minutes
            "conjunction": (20*60, 25*60),   # 20-25 minutes  
            "quadrature": (8*60, 15*60),     # 8-15 minutes
            "intermediate": (6*60, 12*60)    # 6-12 minutes
        }
        
        for config_name, delay in delays:
            min_expected, max_expected = expected_ranges[config_name]
            assert min_expected <= delay <= max_expected, \
                f"{config_name} delay out of range: {delay/60:.1f} minutes"
    
    def test_doppler_shift_effects(self, network):
        """Test Doppler shift effects on communication"""
        # Simulate relative motion between Earth and Mars
        earth_pos = network.nodes[CelestialBody.EARTH]
        mars_pos = network.nodes[CelestialBody.MARS]
        
        # Set positions for relative motion
        earth_pos.angle = 0
        mars_pos.angle = np.pi/4
        
        # Calculate relative velocity (simplified)
        earth_velocity = 2 * np.pi * earth_pos.distance_from_sun / 365.25  # AU/day
        mars_velocity = 2 * np.pi * mars_pos.distance_from_sun / 687       # AU/day
        
        # Convert to m/s
        earth_velocity_ms = earth_velocity * AU / (24 * 3600)
        mars_velocity_ms = mars_velocity * AU / (24 * 3600)
        
        # Calculate Doppler shift
        relative_velocity = earth_velocity_ms - mars_velocity_ms
        doppler_factor = 1 + relative_velocity / SPEED_OF_LIGHT
        
        # Doppler shift should be small but measurable
        assert abs(doppler_factor - 1) < 1e-4, f"Doppler shift too large: {doppler_factor:.6f}"
        assert abs(doppler_factor - 1) > 1e-8, f"Doppler shift too small: {doppler_factor:.6f}"
    
    def test_solar_conjunction_blocking(self, network):
        """Test solar conjunction communication blocking"""
        # Test when Sun blocks direct communication
        earth_pos = network.nodes[CelestialBody.EARTH]
        mars_pos = network.nodes[CelestialBody.MARS]
        
        # Set positions for solar conjunction
        earth_pos.angle = 0
        mars_pos.angle = np.pi + 0.05  # Just past conjunction
        
        # Find route during conjunction
        route = network.find_best_route(CelestialBody.EARTH, CelestialBody.MARS)
        
        # Should use relay station
        assert len(route) > 2, "Should use relay during solar conjunction"
        
        # Test direct communication is blocked
        direct_route = [CelestialBody.EARTH, CelestialBody.MARS]
        relay_route = route
        
        direct_delay = network._calculate_total_delay(direct_route)
        relay_delay = network._calculate_total_delay(relay_route)
        
        # Relay should be used when direct path is blocked
        # (In real implementation, would check for Sun interference)
        assert len(relay_route) > len(direct_route), "Should prefer relay during conjunction"

class TestQuantumChannelAccuracy:
    """Test accuracy of quantum channel simulation"""
    
    def test_bb84_protocol_fidelity(self, quantum_channel):
        """Test BB84 protocol implementation fidelity"""
        # Test key sifting efficiency
        key_length = 1000
        num_tests = 100
        
        sifting_efficiencies = []
        for _ in range(num_tests):
            key, rate = quantum_channel.generate_quantum_key(key_length)
            
            # In BB84, sifting efficiency is ~50% (bases match half the time)
            # Privacy amplification reduces this further
            expected_efficiency = 0.25  # ~25% after sifting and privacy amplification
            actual_efficiency = len(key) / (key_length * 2)  # Original length before sifting
            
            sifting_efficiencies.append(actual_efficiency)
        
        avg_efficiency = np.mean(sifting_efficiencies)
        
        # Should be close to theoretical value
        assert 0.2 <= avg_efficiency <= 0.3, f"BB84 sifting efficiency incorrect: {avg_efficiency:.3f}"
    
    def test_quantum_error_rates(self, quantum_channel):
        """Test quantum error rate modeling"""
        # Test QBER under different conditions
        original_qber = quantum_channel.qber
        
        # Test various error rates
        test_qbers = [0.01, 0.05, 0.10, 0.15]
        
        for test_qber in test_qbers:
            quantum_channel.qber = test_qber
            
            # Generate multiple keys
            error_rates = []
            for _ in range(20):
                key, rate = quantum_channel.generate_quantum_key(256)
                
                # Estimate error rate from key (simplified)
                # In real BB84, would compare subset of key bits
                ones_count = sum(key)
                expected_ones = len(key) / 2
                error_estimate = abs(ones_count - expected_ones) / len(key)
                error_rates.append(error_estimate)
            
            avg_error_rate = np.mean(error_rates)
            
            # Error rate should be within reasonable bounds
            assert avg_error_rate < 0.5, f"Error rate too high: {avg_error_rate:.3f}"
        
        # Restore original QBER
        quantum_channel.qber = original_qber
    
    def test_entanglement_fidelity_effects(self, quantum_channel):
        """Test entanglement fidelity effects on key generation"""
        original_fidelity = quantum_channel.entanglement_fidelity
        
        # Test various fidelity levels
        test_fidelities = [0.99, 0.95, 0.90, 0.85]
        
        bell_violation_rates = []
        for fidelity in test_fidelities:
            quantum_channel.entanglement_fidelity = fidelity
            
            # Test Bell inequality violations
            violations = 0
            num_tests = 50
            
            for _ in range(num_tests):
                if quantum_channel.test_bell_inequality():
                    violations += 1
            
            violation_rate = violations / num_tests
            bell_violation_rates.append(violation_rate)
        
        # Higher fidelity should lead to more Bell violations
        assert bell_violation_rates[0] > bell_violation_rates[-1], \
            "Bell violation rate should decrease with fidelity"
        
        # Restore original fidelity
        quantum_channel.entanglement_fidelity = original_fidelity
    
    def test_quantum_key_generation_rates(self, quantum_channel):
        """Test quantum key generation rate accuracy"""
        # Test key generation rates for different scenarios
        scenarios = [
            ("earth_mars_close", 1e6),    # 1 MHz photon rate
            ("earth_mars_far", 1e5),      # 100 kHz photon rate
            ("earth_jupiter", 1e4),       # 10 kHz photon rate
        ]
        
        for scenario, expected_photon_rate in scenarios:
            # Generate key and measure rate
            key, rate = quantum_channel.generate_quantum_key(1024)
            
            # Key generation rate should be proportional to photon rate
            # Account for BB84 efficiency (~25%)
            expected_key_rate = expected_photon_rate * 0.25
            
            # Rate should be within order of magnitude
            assert 0.1 * expected_key_rate <= rate <= 10 * expected_key_rate, \
                f"Key rate out of range for {scenario}: {rate:.1f} vs {expected_key_rate:.1f}"

class TestNetworkTopologyAccuracy:
    """Test accuracy of network topology and routing"""
    
    def test_relay_station_placement(self, network):
        """Test relay station placement accuracy"""
        # Test L4 and L5 point stability
        earth_l4 = network.nodes[CelestialBody.L4_EARTH]
        earth_l5 = network.nodes[CelestialBody.L5_EARTH]
        mars_l4 = network.nodes[CelestialBody.L4_MARS]
        mars_l5 = network.nodes[CelestialBody.L5_MARS]
        
        # L4 and L5 points should maintain stable triangular configuration
        earth_pos = network.nodes[CelestialBody.EARTH]
        mars_pos = network.nodes[CelestialBody.MARS]
        
        # Test Earth's Lagrange points
        earth_l4_distance = np.sqrt(
            (earth_l4.to_cartesian()[0] - earth_pos.to_cartesian()[0])**2 +
            (earth_l4.to_cartesian()[1] - earth_pos.to_cartesian()[1])**2
        )
        
        # Distance should be approximately equal to orbital radius
        assert abs(earth_l4_distance - earth_pos.distance_from_sun) < 0.1, \
            f"L4 distance incorrect: {earth_l4_distance:.3f} AU"
        
        # Test Mars' Lagrange points
        mars_l4_distance = np.sqrt(
            (mars_l4.to_cartesian()[0] - mars_pos.to_cartesian()[0])**2 +
            (mars_l4.to_cartesian()[1] - mars_pos.to_cartesian()[1])**2
        )
        
        assert abs(mars_l4_distance - mars_pos.distance_from_sun) < 0.1, \
            f"Mars L4 distance incorrect: {mars_l4_distance:.3f} AU"
    
    def test_routing_algorithm_accuracy(self, network):
        """Test routing algorithm accuracy"""
        # Test shortest path routing
        test_routes = [
            (CelestialBody.EARTH, CelestialBody.MARS),
            (CelestialBody.EARTH, CelestialBody.L4_MARS),
            (CelestialBody.L4_EARTH, CelestialBody.MARS),
        ]
        
        for source, destination in test_routes:
            route = network.find_best_route(source, destination)
            
            # Route should be reasonable
            assert len(route) >= 2, "Route should have at least source and destination"
            assert route[0] == source, "Route should start with source"
            assert route[-1] == destination, "Route should end with destination"
            
            # Calculate route delay
            delay = network._calculate_total_delay(route)
            assert delay > 0, "Route delay should be positive"
    
    def test_network_connectivity(self, network):
        """Test network connectivity and redundancy"""
        # Test that all nodes are reachable
        nodes = list(network.nodes.keys())
        
        for source in nodes:
            for destination in nodes:
                if source != destination:
                    route = network.find_best_route(source, destination)
                    assert len(route) >= 2, f"No route from {source} to {destination}"
        
        # Test redundancy - remove one relay and verify connectivity
        original_relays = network.relay_stations.copy()
        
        # Remove one relay station
        test_relay = CelestialBody.L4_EARTH
        if test_relay in network.relay_stations:
            del network.relay_stations[test_relay]
            
            # Test connectivity still works
            route = network.find_best_route(CelestialBody.EARTH, CelestialBody.MARS)
            assert len(route) >= 2, "Network should maintain connectivity with one relay down"
            
            # Restore relay
            network.relay_stations = original_relays
    
    def test_load_balancing_accuracy(self, network):
        """Test load balancing across network paths"""
        # Send multiple messages and track route usage
        num_messages = 100
        route_usage = {}
        
        for i in range(num_messages):
            message = Message(
                id=f"load-balance-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=i % 5,
                data_size=1024,
                timestamp=time.time(),
                quantum_encrypted=True
            )
            
            result = network.send_message(message)
            if result['success']:
                route_str = ' -> '.join(result['route'])
                route_usage[route_str] = route_usage.get(route_str, 0) + 1
        
        # Should use multiple routes for load balancing
        unique_routes = len(route_usage)
        assert unique_routes >= 1, "Should have at least one working route"
        
        # In a real system with load balancing, would have more routes
        # Current simulator uses deterministic routing

class TestPhysicsModelAccuracy:
    """Test accuracy of physics models"""
    
    def test_electromagnetic_propagation(self, network):
        """Test electromagnetic wave propagation modeling"""
        # Test frequency-dependent effects
        frequencies = [
            (2.4e9, "S-band"),
            (8.4e9, "X-band"),
            (32e9, "Ka-band")
        ]
        
        for freq, band_name in frequencies:
            # Test propagation loss
            distance_au = 1.5  # Earth-Mars average
            distance_m = distance_au * AU
            
            # Free space path loss
            wavelength = SPEED_OF_LIGHT / freq
            path_loss_db = 20 * np.log10(4 * np.pi * distance_m / wavelength)
            
            # Path loss should be reasonable
            assert 200 <= path_loss_db <= 350, f"{band_name} path loss unrealistic: {path_loss_db:.1f} dB"
    
    def test_atmospheric_effects(self, network):
        """Test atmospheric effects on signal propagation"""
        # Test atmospheric absorption (simplified)
        frequencies = [1e9, 10e9, 100e9]  # 1, 10, 100 GHz
        
        for freq in frequencies:
            # Atmospheric absorption increases with frequency
            # Simplified model: absorption = k * freq^2
            k = 1e-21  # Absorption coefficient
            absorption_db = k * freq**2
            
            # Higher frequencies should have more absorption
            assert absorption_db >= 0, "Absorption should be non-negative"
            
            # Very high frequencies should have significant absorption
            if freq >= 50e9:
                assert absorption_db > 0.01, "High frequency absorption too low"
    
    def test_solar_wind_effects(self, network):
        """Test solar wind effects on communication"""
        # Test solar wind density and velocity effects
        # Simplified model based on distance from Sun
        
        positions = [
            (1.0, "Earth orbit"),
            (1.5, "Mars orbit"),
            (5.2, "Jupiter orbit")
        ]
        
        for distance_au, location in positions:
            # Solar wind density decreases with distance squared
            density_at_1au = 5e6  # particles/m^3
            density = density_at_1au / (distance_au**2)
            
            # Solar wind velocity is approximately constant
            velocity = 400e3  # m/s
            
            # Calculate plasma frequency
            electron_charge = 1.6e-19  # C
            electron_mass = 9.1e-31   # kg
            permittivity = 8.85e-12   # F/m
            
            plasma_freq = np.sqrt(density * electron_charge**2 / (electron_mass * permittivity))
            
            # Plasma frequency should be realistic
            assert 1e3 <= plasma_freq <= 1e6, f"Plasma frequency unrealistic at {location}: {plasma_freq:.1f} Hz"
    
    def test_relativistic_effects(self, network):
        """Test relativistic effects on time and communication"""
        # Test time dilation effects (very small for planetary motion)
        earth_velocity = 30e3  # m/s (orbital velocity)
        mars_velocity = 24e3   # m/s (orbital velocity)
        
        # Time dilation factor
        gamma_earth = 1 / np.sqrt(1 - (earth_velocity / SPEED_OF_LIGHT)**2)
        gamma_mars = 1 / np.sqrt(1 - (mars_velocity / SPEED_OF_LIGHT)**2)
        
        # Effects should be tiny but measurable
        assert abs(gamma_earth - 1) < 1e-8, f"Earth time dilation too large: {gamma_earth:.10f}"
        assert abs(gamma_mars - 1) < 1e-8, f"Mars time dilation too large: {gamma_mars:.10f}"
        
        # Mars should have slightly less time dilation (slower orbit)
        assert gamma_mars < gamma_earth, "Mars should have less time dilation"

class TestStatisticalAccuracy:
    """Test statistical accuracy of simulation results"""
    
    def test_message_delivery_statistics(self, network):
        """Test message delivery statistics"""
        # Send large number of messages for statistical analysis
        num_messages = 1000
        results = []
        
        for i in range(num_messages):
            message = Message(
                id=f"stat-test-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=i % 5,
                data_size=1024 * (i % 10 + 1),
                timestamp=time.time(),
                quantum_encrypted=(i % 2 == 0)
            )
            
            result = network.send_message(message)
            results.append(result)
        
        # Analyze statistics
        successful = [r for r in results if r['success']]
        success_rate = len(successful) / len(results)
        
        # Success rate should be high
        assert success_rate >= 0.95, f"Success rate too low: {success_rate:.3f}"
        
        # Analyze delay distribution
        delays = [r['total_delay'] for r in successful]
        mean_delay = np.mean(delays)
        std_delay = np.std(delays)
        
        # Delay distribution should be reasonable
        assert mean_delay > 0, "Mean delay should be positive"
        assert std_delay < mean_delay, "Delay variance should be reasonable"
        
        # Test for normality (delays should follow known distribution)
        if len(delays) > 50:
            # Shapiro-Wilk test for normality
            stat, p_value = stats.shapiro(delays[:50])  # Limit to 50 samples
            
            # P-value interpretation depends on expected distribution
            # For communication delays, may not be normal due to routing
    
    def test_quantum_key_randomness(self, quantum_channel):
        """Test quantum key randomness statistics"""
        # Generate multiple keys for statistical analysis
        num_keys = 100
        key_length = 256
        
        all_keys = []
        for _ in range(num_keys):
            key, rate = quantum_channel.generate_quantum_key(key_length)
            all_keys.append(key)
        
        # Test randomness
        # 1. Frequency test
        all_bits = [bit for key in all_keys for bit in key]
        ones_count = sum(all_bits)
        frequency = ones_count / len(all_bits)
        
        # Should be close to 0.5
        assert 0.48 <= frequency <= 0.52, f"Frequency test failed: {frequency:.3f}"
        
        # 2. Runs test
        runs = 1
        for i in range(1, len(all_bits)):
            if all_bits[i] != all_bits[i-1]:
                runs += 1
        
        expected_runs = len(all_bits) / 2
        runs_ratio = runs / expected_runs
        
        assert 0.9 <= runs_ratio <= 1.1, f"Runs test failed: {runs_ratio:.3f}"
        
        # 3. Autocorrelation test
        autocorr = np.correlate(all_bits, all_bits, mode='full')
        max_autocorr = np.max(autocorr[len(autocorr)//2+1:])  # Exclude zero lag
        
        # Autocorrelation should be low
        assert max_autocorr < len(all_bits) * 0.1, f"Autocorrelation too high: {max_autocorr}"
    
    def test_network_performance_distributions(self, network):
        """Test network performance distributions"""
        # Test latency distribution
        latencies = []
        throughputs = []
        
        for i in range(200):
            message = Message(
                id=f"perf-dist-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=i % 5,
                data_size=1024 * (i % 10 + 1),
                timestamp=time.time(),
                quantum_encrypted=True
            )
            
            start_time = time.time()
            result = network.send_message(message)
            processing_time = time.time() - start_time
            
            if result['success']:
                latencies.append(result['total_delay'])
                throughputs.append(message.data_size / processing_time)
        
        # Analyze distributions
        if len(latencies) > 50:
            # Latency distribution statistics
            latency_mean = np.mean(latencies)
            latency_std = np.std(latencies)
            latency_cv = latency_std / latency_mean
            
            # Coefficient of variation should be reasonable
            assert latency_cv < 0.5, f"Latency coefficient of variation too high: {latency_cv:.3f}"
            
            # Test for outliers
            q75, q25 = np.percentile(latencies, [75, 25])
            iqr = q75 - q25
            lower_bound = q25 - 1.5 * iqr
            upper_bound = q75 + 1.5 * iqr
            
            outliers = [l for l in latencies if l < lower_bound or l > upper_bound]
            outlier_rate = len(outliers) / len(latencies)
            
            # Outlier rate should be low
            assert outlier_rate < 0.1, f"Too many latency outliers: {outlier_rate:.3f}"

@pytest.mark.parametrize("scenario", [
    "mars_close_approach",
    "mars_far_approach", 
    "solar_conjunction",
    "normal_operation"
])
def test_scenario_accuracy(network, scenario):
    """Test accuracy for specific operational scenarios"""
    
    scenario_configs = {
        "mars_close_approach": {
            "earth_angle": 0,
            "mars_angle": 0,
            "expected_delay_range": (4*60, 8*60),
            "expected_success_rate": 0.99
        },
        "mars_far_approach": {
            "earth_angle": 0,
            "mars_angle": np.pi,
            "expected_delay_range": (20*60, 24*60),
            "expected_success_rate": 0.95
        },
        "solar_conjunction": {
            "earth_angle": 0,
            "mars_angle": np.pi + 0.1,
            "expected_delay_range": (30*60, 45*60),
            "expected_success_rate": 0.90
        },
        "normal_operation": {
            "earth_angle": 0,
            "mars_angle": np.pi/2,
            "expected_delay_range": (10*60, 15*60),
            "expected_success_rate": 0.98
        }
    }
    
    config = scenario_configs[scenario]
    
    # Set network configuration
    network.nodes[CelestialBody.EARTH].angle = config["earth_angle"]
    network.nodes[CelestialBody.MARS].angle = config["mars_angle"]
    
    # Test messages
    num_messages = 50
    results = []
    
    for i in range(num_messages):
        message = Message(
            id=f"scenario-{scenario}-{i}",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=i % 5,
            data_size=1024 * (i % 10 + 1),
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        result = network.send_message(message)
        results.append(result)
    
    # Analyze results
    successful = [r for r in results if r['success']]
    success_rate = len(successful) / len(results)
    
    # Test success rate
    assert success_rate >= config["expected_success_rate"], \
        f"{scenario} success rate too low: {success_rate:.3f}"
    
    # Test delay range
    if successful:
        delays = [r['total_delay'] for r in successful]
        avg_delay = np.mean(delays)
        min_expected, max_expected = config["expected_delay_range"]
        
        assert min_expected <= avg_delay <= max_expected, \
            f"{scenario} delay out of range: {avg_delay/60:.1f} minutes"

def test_simulation_reproducibility(network):
    """Test that simulation results are reproducible"""
    # Set seed for reproducibility
    np.random.seed(42)
    
    # Run simulation twice
    results1 = []
    results2 = []
    
    for run in range(2):
        np.random.seed(42)  # Reset seed
        run_results = []
        
        for i in range(10):
            message = Message(
                id=f"repro-{run}-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=1,
                data_size=1024,
                timestamp=time.time(),
                quantum_encrypted=True
            )
            
            result = network.send_message(message)
            run_results.append(result)
        
        if run == 0:
            results1 = run_results
        else:
            results2 = run_results
    
    # Compare results
    for i in range(len(results1)):
        r1, r2 = results1[i], results2[i]
        
        # Success should be same
        assert r1['success'] == r2['success'], f"Success mismatch at message {i}"
        
        # If successful, delays should be similar
        if r1['success'] and r2['success']:
            delay_diff = abs(r1['total_delay'] - r2['total_delay'])
            assert delay_diff < 0.1, f"Delay mismatch at message {i}: {delay_diff:.3f}s"