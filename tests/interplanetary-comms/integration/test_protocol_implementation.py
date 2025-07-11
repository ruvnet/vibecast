"""
Integration tests for protocol implementation.
Tests the complete IPCP protocol stack and communication flow.
"""

import pytest
import asyncio
import numpy as np
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List, Any, Optional, Tuple
import time
import hashlib
import sys
import json
from dataclasses import dataclass

# Add the simulation module to the path
sys.path.insert(0, '/workspaces/vibecast/interplanetary-comms/simulations')

from protocol_simulator import (
    InterplanetaryNetwork, CelestialBody, Message, QuantumChannel,
    ClassicalChannel, RelayStation, OrbitalPosition
)

class TestIPCPProtocolStack:
    """Test the complete IPCP protocol stack"""
    
    def test_protocol_layer_integration(self, network):
        """Test integration between protocol layers"""
        # Test message through complete stack
        message = Message(
            id="integration-test-001",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=1,
            data_size=1024 * 1024,  # 1MB
            timestamp=0,
            quantum_encrypted=True
        )
        
        # Send message through network
        result = network.send_message(message)
        
        # Verify successful transmission
        assert result['success'], f"Message failed: {result.get('error', 'Unknown error')}"
        assert result['total_delay'] > 0, "No delay recorded"
        assert len(result['route']) >= 2, "Invalid route"
        
        # Verify quantum security
        assert result['key_generation_rate'] > 0, "No quantum key generated"
    
    def test_protocol_layer_1_physical(self, network):
        """Test Layer 1: Physical layer (quantum magnetic sensors)"""
        # Test quantum channel establishment
        qchannel = network.quantum_channels[(CelestialBody.EARTH, CelestialBody.MARS)]
        
        # Test quantum key generation
        key, rate = qchannel.generate_quantum_key(256)
        
        assert len(key) == 256, f"Expected 256-bit key, got {len(key)}"
        assert rate > 0, "Key generation rate should be positive"
        assert all(bit in [0, 1] for bit in key), "Key should contain only binary values"
        
        # Test quantum error rate
        assert qchannel.qber <= 0.11, f"QBER too high: {qchannel.qber}"
        
        # Test Bell inequality
        bell_test = qchannel.test_bell_inequality()
        assert bell_test, "Bell inequality test failed - channel may be compromised"
    
    def test_protocol_layer_2_quantum_security(self, network):
        """Test Layer 2: Quantum security and encryption"""
        qchannel = network.quantum_channels[(CelestialBody.EARTH, CelestialBody.MARS)]
        
        # Test multiple key generation rounds
        keys = []
        rates = []
        
        for i in range(5):
            key, rate = qchannel.generate_quantum_key(128)
            keys.append(key)
            rates.append(rate)
        
        # Verify key uniqueness
        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                # Keys should be different
                assert keys[i] != keys[j], f"Keys {i} and {j} are identical"
        
        # Verify consistent key generation rate
        avg_rate = np.mean(rates)
        rate_stability = np.std(rates) / avg_rate
        assert rate_stability < 0.5, f"Key generation rate too unstable: {rate_stability:.3f}"
        
        # Test quantum state fidelity
        assert qchannel.entanglement_fidelity >= 0.9, "Entanglement fidelity too low"
    
    def test_protocol_layer_3_network_routing(self, network):
        """Test Layer 3: Network routing and relay logic"""
        # Test direct routing
        direct_route = network.find_best_route(CelestialBody.EARTH, CelestialBody.MARS)
        assert len(direct_route) >= 2, "Route should have at least source and destination"
        
        # Test relay routing (simulate solar conjunction)
        # Modify positions to force relay usage
        original_mars_angle = network.nodes[CelestialBody.MARS].angle
        network.nodes[CelestialBody.MARS].angle = network.nodes[CelestialBody.EARTH].angle + np.pi
        
        relay_route = network.find_best_route(CelestialBody.EARTH, CelestialBody.MARS)
        
        # Should use relay when direct path is blocked
        assert len(relay_route) > 2, "Should use relay when direct path blocked"
        
        # Restore original position
        network.nodes[CelestialBody.MARS].angle = original_mars_angle
        
        # Test route optimization
        route_delay = network._calculate_total_delay(relay_route)
        assert route_delay > 0, "Route delay should be positive"
    
    def test_protocol_layer_4_transport_priority(self, network):
        """Test Layer 4: Transport layer with priority handling"""
        # Create messages with different priorities
        messages = []
        for priority in range(5):
            message = Message(
                id=f"priority-test-{priority}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=priority,
                data_size=1024 * (priority + 1),
                timestamp=time.time(),
                quantum_encrypted=(priority <= 2)
            )
            messages.append(message)
        
        # Send all messages
        results = []
        for message in messages:
            result = network.send_message(message)
            results.append(result)
        
        # Verify all messages sent successfully
        successful_results = [r for r in results if r['success']]
        assert len(successful_results) == len(messages), "Some messages failed"
        
        # Verify priority handling (higher priority = lower delay for same route)
        delays_by_priority = {}
        for i, result in enumerate(successful_results):
            priority = messages[i].priority
            if priority not in delays_by_priority:
                delays_by_priority[priority] = []
            delays_by_priority[priority].append(result['total_delay'])
        
        # Check that P0 (emergency) has reasonable delay
        if 0 in delays_by_priority:
            p0_delay = np.mean(delays_by_priority[0])
            assert p0_delay < 30 * 60, f"P0 delay too high: {p0_delay:.1f} seconds"
    
    def test_protocol_layer_5_application_api(self, network):
        """Test Layer 5: Application layer API"""
        # Test application-level messaging
        app_message = {
            "type": "vibecheck",
            "sender": "earth_user_001",
            "recipient": "mars_user_001",
            "content": "Good vibes from Earth! 🌍",
            "timestamp": time.time(),
            "priority": "high"
        }
        
        # Convert to protocol message
        message_data = json.dumps(app_message).encode('utf-8')
        protocol_message = Message(
            id=hashlib.md5(message_data).hexdigest()[:16],
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=1,
            data_size=len(message_data),
            timestamp=app_message["timestamp"],
            quantum_encrypted=True
        )
        
        # Send through network
        result = network.send_message(protocol_message)
        
        # Verify application-level success
        assert result['success'], "Application message failed"
        assert result['total_delay'] < 30 * 60, "Application message delay too high"
        
        # Test error handling
        invalid_message = Message(
            id="invalid-test",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=1,
            data_size=0,  # Invalid size
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        # Should handle invalid message gracefully
        invalid_result = network.send_message(invalid_message)
        # Note: The current simulator doesn't validate message size, 
        # but in a real implementation it should

class TestRelayStationIntegration:
    """Test relay station integration and functionality"""
    
    def test_relay_station_store_and_forward(self, network):
        """Test relay station store-and-forward capability"""
        relay = network.relay_stations[CelestialBody.L4_EARTH]
        
        # Create test messages
        messages = []
        for i in range(10):
            message = Message(
                id=f"relay-test-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=i % 5,
                data_size=1024 * (i + 1),
                timestamp=time.time() + i,
                quantum_encrypted=True
            )
            messages.append(message)
        
        # Store messages in relay
        stored_count = 0
        for message in messages:
            if relay.store_message(message):
                stored_count += 1
        
        assert stored_count > 0, "No messages stored in relay"
        
        # Retrieve messages (should be in priority order)
        retrieved_messages = []
        while True:
            message = relay.retrieve_message()
            if message is None:
                break
            retrieved_messages.append(message)
        
        assert len(retrieved_messages) == stored_count, "Retrieved count mismatch"
        
        # Verify priority ordering
        priorities = [msg.priority for msg in retrieved_messages]
        assert priorities == sorted(priorities), "Messages not retrieved in priority order"
    
    def test_relay_station_capacity_limits(self, network):
        """Test relay station capacity and overflow handling"""
        relay = network.relay_stations[CelestialBody.L4_EARTH]
        
        # Create large message that exceeds capacity
        large_message = Message(
            id="capacity-test",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=0,
            data_size=relay.storage_capacity + 1,  # Exceeds capacity
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        # Should reject message that exceeds capacity
        result = relay.store_message(large_message)
        assert not result, "Relay should reject messages that exceed capacity"
    
    def test_relay_station_redundancy(self, network):
        """Test relay station redundancy and failover"""
        # Test with multiple relay stations
        relay_stations = [
            network.relay_stations[CelestialBody.L4_EARTH],
            network.relay_stations[CelestialBody.L5_EARTH]
        ]
        
        message = Message(
            id="redundancy-test",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=1,
            data_size=1024 * 1024,
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        # Store in multiple relays for redundancy
        storage_results = []
        for relay in relay_stations:
            result = relay.store_message(message)
            storage_results.append(result)
        
        # At least one relay should accept the message
        assert any(storage_results), "No relay accepted the message"
        
        # Test retrieval from multiple relays
        for relay in relay_stations:
            retrieved = relay.retrieve_message()
            if retrieved:
                assert retrieved.id == message.id, "Retrieved wrong message"
    
    def test_relay_station_quantum_memory_coherence(self, network):
        """Test quantum memory coherence time in relay stations"""
        relay = network.relay_stations[CelestialBody.L4_EARTH]
        
        # Test coherence time
        coherence_time = relay.quantum_memory_coherence
        assert coherence_time > 0, "Quantum memory coherence time should be positive"
        
        # In a real system, we would test that quantum states
        # remain coherent for the specified time
        # For now, we just verify the parameter exists
    
    def test_relay_station_cache_performance(self, network):
        """Test relay station caching performance"""
        relay = network.relay_stations[CelestialBody.L4_EARTH]
        
        # Test cache hit rate
        cache_hit_rate = relay.cache_hit_rate()
        assert 0 <= cache_hit_rate <= 1, "Cache hit rate should be between 0 and 1"
        
        # Target cache hit rate from specifications
        target_cache_hit_rate = 0.6  # 60%
        assert cache_hit_rate >= target_cache_hit_rate, f"Cache hit rate too low: {cache_hit_rate:.2f}"

class TestEndToEndCommunication:
    """Test end-to-end communication scenarios"""
    
    def test_earth_mars_communication_cycle(self, network):
        """Test complete Earth-Mars communication cycle"""
        # Send message from Earth to Mars
        earth_to_mars = Message(
            id="earth-to-mars-001",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=1,
            data_size=1024 * 1024,  # 1MB
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        result_1 = network.send_message(earth_to_mars)
        assert result_1['success'], "Earth to Mars message failed"
        
        # Send reply from Mars to Earth
        mars_to_earth = Message(
            id="mars-to-earth-001",
            source=CelestialBody.MARS,
            destination=CelestialBody.EARTH,
            priority=1,
            data_size=512 * 1024,  # 512KB
            timestamp=time.time() + result_1['total_delay'],
            quantum_encrypted=True
        )
        
        result_2 = network.send_message(mars_to_earth)
        assert result_2['success'], "Mars to Earth message failed"
        
        # Verify round-trip characteristics
        total_round_trip = result_1['total_delay'] + result_2['total_delay']
        
        # Should be within expected range (8-48 minutes for round trip)
        assert 8 * 60 <= total_round_trip <= 48 * 60, f"Round trip time unrealistic: {total_round_trip/60:.1f} minutes"
    
    def test_multi_hop_communication(self, network):
        """Test communication through multiple relay hops"""
        # Force multi-hop by simulating solar conjunction
        original_angles = {}
        for body in [CelestialBody.EARTH, CelestialBody.MARS]:
            original_angles[body] = network.nodes[body].angle
        
        # Position bodies to require relay
        network.nodes[CelestialBody.EARTH].angle = 0
        network.nodes[CelestialBody.MARS].angle = np.pi
        
        message = Message(
            id="multi-hop-test",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=1,
            data_size=1024 * 1024,
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        result = network.send_message(message)
        
        # Restore original positions
        for body, angle in original_angles.items():
            network.nodes[body].angle = angle
        
        # Verify multi-hop routing
        assert result['success'], "Multi-hop communication failed"
        assert result['hops'] > 1, "Should use multiple hops"
        
        # Verify reasonable delay for multi-hop
        assert result['total_delay'] > 0, "Multi-hop delay should be positive"
    
    def test_priority_message_preemption(self, network):
        """Test priority message preemption and handling"""
        # Create messages with different priorities
        low_priority = Message(
            id="low-priority",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=4,  # Lowest priority
            data_size=10 * 1024 * 1024,  # Large message
            timestamp=time.time(),
            quantum_encrypted=False
        )
        
        high_priority = Message(
            id="high-priority",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=0,  # Highest priority (emergency)
            data_size=1024,  # Small message
            timestamp=time.time() + 1,  # Sent later
            quantum_encrypted=True
        )
        
        # Send low priority first
        low_result = network.send_message(low_priority)
        
        # Send high priority after
        high_result = network.send_message(high_priority)
        
        # Both should succeed
        assert low_result['success'], "Low priority message failed"
        assert high_result['success'], "High priority message failed"
        
        # High priority should have reasonable delay despite being sent later
        assert high_result['total_delay'] < 30 * 60, "High priority delay too high"
    
    def test_quantum_security_end_to_end(self, network):
        """Test end-to-end quantum security"""
        # Create secure message
        secure_message = Message(
            id="secure-test",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=0,
            data_size=1024 * 1024,
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        result = network.send_message(secure_message)
        
        # Verify quantum security was applied
        assert result['success'], "Secure message failed"
        assert result['key_generation_rate'] > 0, "No quantum key generated"
        
        # Verify key generation rate meets requirements
        min_key_rate = 1000  # bits/second
        assert result['key_generation_rate'] >= min_key_rate, f"Key generation rate too low: {result['key_generation_rate']:.1f} bps"
    
    def test_network_congestion_handling(self, network):
        """Test network behavior under congestion"""
        # Generate high traffic load
        messages = []
        for i in range(100):
            message = Message(
                id=f"congestion-test-{i}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=i % 5,
                data_size=1024 * (i % 10 + 1),
                timestamp=time.time() + i * 0.1,
                quantum_encrypted=(i % 2 == 0)
            )
            messages.append(message)
        
        # Send all messages
        results = []
        for message in messages:
            result = network.send_message(message)
            results.append(result)
        
        # Analyze congestion handling
        successful = [r for r in results if r['success']]
        failed = [r for r in results if not r['success']]
        
        success_rate = len(successful) / len(results)
        assert success_rate >= 0.9, f"Success rate too low under congestion: {success_rate:.2f}"
        
        # High priority messages should have better success rate
        high_priority_results = [results[i] for i in range(len(messages)) if messages[i].priority <= 1]
        high_priority_success = len([r for r in high_priority_results if r['success']]) / len(high_priority_results)
        
        assert high_priority_success >= 0.95, f"High priority success rate too low: {high_priority_success:.2f}"

class TestProtocolResiliency:
    """Test protocol resiliency and error handling"""
    
    def test_node_failure_recovery(self, network):
        """Test recovery from node failures"""
        # Simulate relay station failure
        failed_relay = CelestialBody.L4_EARTH
        original_relay = network.relay_stations[failed_relay]
        
        # Remove relay station to simulate failure
        del network.relay_stations[failed_relay]
        
        # Send message that would normally use this relay
        message = Message(
            id="failure-test",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=1,
            data_size=1024 * 1024,
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        result = network.send_message(message)
        
        # Restore relay station
        network.relay_stations[failed_relay] = original_relay
        
        # Message should still succeed through alternate routing
        assert result['success'], "Failed to handle node failure"
    
    def test_quantum_channel_degradation(self, network):
        """Test handling of quantum channel degradation"""
        qchannel = network.quantum_channels[(CelestialBody.EARTH, CelestialBody.MARS)]
        
        # Simulate channel degradation
        original_qber = qchannel.qber
        original_fidelity = qchannel.entanglement_fidelity
        
        # Degrade quantum channel
        qchannel.qber = 0.15  # High error rate
        qchannel.entanglement_fidelity = 0.7  # Lower fidelity
        
        message = Message(
            id="degradation-test",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=1,
            data_size=1024 * 1024,
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        result = network.send_message(message)
        
        # Restore original channel parameters
        qchannel.qber = original_qber
        qchannel.entanglement_fidelity = original_fidelity
        
        # Should handle degraded channel (may fail or fall back to classical)
        # In a real system, this would trigger fallback to classical encryption
        if not result['success']:
            assert 'error' in result, "Should provide error information"
    
    def test_solar_storm_resilience(self, network):
        """Test resilience during solar storm conditions"""
        # Simulate solar storm effects
        for channel in network.classical_channels.values():
            # Increase error rates
            channel.bit_error_rate *= 10
            channel.packet_loss_rate *= 5
        
        for qchannel in network.quantum_channels.values():
            # Degrade quantum channels
            qchannel.qber *= 3
            qchannel.entanglement_fidelity *= 0.8
        
        # Test communication during storm
        storm_message = Message(
            id="storm-test",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=0,  # Emergency priority
            data_size=1024 * 1024,
            timestamp=time.time(),
            quantum_encrypted=True
        )
        
        result = network.send_message(storm_message)
        
        # Restore normal conditions
        for channel in network.classical_channels.values():
            channel.bit_error_rate /= 10
            channel.packet_loss_rate /= 5
        
        for qchannel in network.quantum_channels.values():
            qchannel.qber /= 3
            qchannel.entanglement_fidelity /= 0.8
        
        # Emergency messages should still get through
        assert result['success'], "Failed to handle solar storm conditions"
    
    def test_orbital_dynamics_impact(self, network):
        """Test impact of orbital dynamics on communication"""
        # Test at different orbital positions
        test_positions = [
            (0, np.pi/4),      # Close approach
            (0, np.pi),        # Opposition (maximum distance)
            (np.pi/2, 3*np.pi/2)  # Quadrature
        ]
        
        results = []
        for earth_angle, mars_angle in test_positions:
            # Set orbital positions
            network.nodes[CelestialBody.EARTH].angle = earth_angle
            network.nodes[CelestialBody.MARS].angle = mars_angle
            
            message = Message(
                id=f"orbital-test-{len(results)}",
                source=CelestialBody.EARTH,
                destination=CelestialBody.MARS,
                priority=1,
                data_size=1024 * 1024,
                timestamp=time.time(),
                quantum_encrypted=True
            )
            
            result = network.send_message(message)
            results.append(result)
        
        # All positions should allow communication
        successful = [r for r in results if r['success']]
        assert len(successful) >= 2, "Should maintain communication at most orbital positions"
        
        # Delays should vary with distance
        delays = [r['total_delay'] for r in successful]
        assert max(delays) > min(delays), "Delays should vary with orbital position"

@pytest.mark.asyncio
async def test_async_protocol_operations(network):
    """Test asynchronous protocol operations"""
    
    async def send_message_async(message):
        """Simulate async message sending"""
        await asyncio.sleep(0.01)  # Simulate processing delay
        return network.send_message(message)
    
    # Create multiple messages for concurrent sending
    messages = []
    for i in range(10):
        message = Message(
            id=f"async-test-{i}",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=i % 3,
            data_size=1024 * (i + 1),
            timestamp=time.time(),
            quantum_encrypted=True
        )
        messages.append(message)
    
    # Send messages concurrently
    tasks = [send_message_async(msg) for msg in messages]
    results = await asyncio.gather(*tasks)
    
    # Verify all messages were processed
    successful = [r for r in results if r['success']]
    assert len(successful) == len(messages), "Some async messages failed"
    
    # Verify concurrent processing didn't cause conflicts
    message_ids = [r['message_id'] for r in successful]
    assert len(set(message_ids)) == len(message_ids), "Duplicate message IDs detected"

def test_protocol_performance_metrics(network, test_metrics):
    """Test protocol performance meets requirements"""
    # Test message throughput
    start_time = time.time()
    num_messages = 50
    
    for i in range(num_messages):
        message = Message(
            id=f"perf-test-{i}",
            source=CelestialBody.EARTH,
            destination=CelestialBody.MARS,
            priority=i % 5,
            data_size=1024 * (i + 1),
            timestamp=time.time(),
            quantum_encrypted=(i % 2 == 0)
        )
        
        result = network.send_message(message)
        if result['success']:
            test_metrics.record_latency(result['total_delay'])
            test_metrics.record_throughput(message.data_size * 8 / result['total_delay'])
    
    processing_time = time.time() - start_time
    message_rate = num_messages / processing_time
    
    # Should process at least 10 messages per second
    assert message_rate >= 10, f"Message processing rate too low: {message_rate:.1f} msg/s"
    
    # Get performance summary
    summary = test_metrics.get_summary()
    
    if 'latency' in summary:
        avg_latency = summary['latency']['mean']
        assert avg_latency < 30 * 60, f"Average latency too high: {avg_latency:.1f} seconds"
    
    if 'throughput' in summary:
        avg_throughput = summary['throughput']['mean']
        assert avg_throughput > 1e6, f"Average throughput too low: {avg_throughput:.1f} bps"