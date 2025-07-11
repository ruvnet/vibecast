#!/usr/bin/env python3
"""
Protocol Validation Test Suite
Validates all interplanetary communication protocols for correctness and performance
"""

import pytest
import asyncio
import sys
import os
import time
import numpy as np
import json
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, List, Any, Optional

# Add protocols to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'protocols'))

# Import modules with dynamic loading due to dashes in filenames
import importlib.util

def load_protocol_module(module_name: str, file_path: str):
    """Load protocol module dynamically"""
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

# Load all protocol modules
protocols_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'protocols'))

ipcp_module = load_protocol_module(
    "ipcp_v1_1_quantum_navigation", 
    os.path.join(protocols_dir, "ipcp-v1.1-quantum-navigation.py")
)

relay_module = load_protocol_module(
    "relay_station_comm", 
    os.path.join(protocols_dir, "relay-station-comm.py")
)

routing_module = load_protocol_module(
    "quantum_routing_algorithms", 
    os.path.join(protocols_dir, "quantum-routing-algorithms.py")
)

ecc_module = load_protocol_module(
    "deep_space_error_correction", 
    os.path.join(protocols_dir, "deep-space-error-correction.py")
)

latency_module = load_protocol_module(
    "adaptive_latency_protocols", 
    os.path.join(protocols_dir, "adaptive-latency-protocols.py")
)

class TestIPCPProtocol:
    """Test suite for IPCP v1.1 protocol"""
    
    @pytest.fixture
    def ipcp_protocol(self):
        """Create IPCP protocol instance"""
        return ipcp_module.IPCPProtocol("test_node")
    
    def test_protocol_initialization(self, ipcp_protocol):
        """Test protocol initialization"""
        assert ipcp_protocol.node_id == "test_node"
        assert ipcp_protocol.quantum_key_manager is not None
        assert ipcp_protocol.quantum_nav is not None
        assert ipcp_protocol.routing_engine is not None
        assert ipcp_protocol.error_correction is not None
    
    @pytest.mark.asyncio
    async def test_message_sending(self, ipcp_protocol):
        """Test message sending functionality"""
        # Mock quantum navigation to return a position
        mock_position = ipcp_module.QuantumPosition(
            x=1.0, y=0.0, z=0.0,
            accuracy=10.0,
            timestamp=time.time(),
            quantum_confidence=0.95,
            entanglement_id="test_ent"
        )
        
        ipcp_protocol.quantum_nav.get_current_position = Mock(return_value=mock_position)
        ipcp_protocol.routing_engine.calculate_optimal_route = AsyncMock(return_value=["test_node", "destination"])
        
        # Send message
        message_id = await ipcp_protocol.send_message(
            destination="test_destination",
            payload=b"test message",
            priority=ipcp_module.MessagePriority.P1_CRITICAL
        )
        
        assert message_id is not None
        assert len(message_id) == 16  # SHA256 hash truncated to 16 chars
        assert message_id in ipcp_protocol.sent_messages
    
    @pytest.mark.asyncio
    async def test_message_receiving(self, ipcp_protocol):
        """Test message receiving functionality"""
        # Create test message data
        message_data = {
            'message_id': 'test_msg_001',
            'source_node': 'sender',
            'destination_node': 'test_node',
            'priority': 1,
            'timestamp': time.time(),
            'ttl': 3600,
            'source_position': {
                'x': 0.0, 'y': 0.0, 'z': 0.0,
                'accuracy': 10.0, 'timestamp': time.time(),
                'quantum_confidence': 0.95, 'entanglement_id': 'test_ent'
            },
            'destination_position': None,
            'relay_path': ['sender', 'test_node'],
            'quantum_signature': 'test_signature',
            'payload': b'test payload'
        }
        
        # Mock quantum key generation
        ipcp_protocol.quantum_key_manager.generate_quantum_key = AsyncMock(return_value=b'test_key')
        
        # Receive message
        received_message = await ipcp_protocol.receive_message(message_data)
        
        assert received_message is not None
        assert received_message.message_id == 'test_msg_001'
        assert received_message.source_node == 'sender'
        assert received_message.payload == b'test payload'
    
    def test_quantum_position_class(self):
        """Test QuantumPosition class"""
        position = ipcp_module.QuantumPosition(
            x=1.5, y=2.0, z=0.5,
            accuracy=15.0,
            timestamp=time.time(),
            quantum_confidence=0.85,
            entanglement_id="test_entanglement"
        )
        
        assert position.x == 1.5
        assert position.y == 2.0
        assert position.z == 0.5
        assert position.accuracy == 15.0
        assert position.quantum_confidence == 0.85
        assert position.entanglement_id == "test_entanglement"
        
        # Test to_dict method
        position_dict = position.to_dict()
        assert position_dict['x'] == 1.5
        assert position_dict['quantum_confidence'] == 0.85
    
    def test_message_priority_enum(self):
        """Test MessagePriority enum"""
        assert ipcp_module.MessagePriority.P1_CRITICAL.value == 1
        assert ipcp_module.MessagePriority.P2_URGENT.value == 2
        assert ipcp_module.MessagePriority.P3_SCIENTIFIC.value == 3
        assert ipcp_module.MessagePriority.P4_ROUTINE.value == 4

class TestRelayStationProtocol:
    """Test suite for relay station protocols"""
    
    @pytest.fixture
    def relay_station(self):
        """Create relay station instance"""
        capabilities = relay_module.RelayCapabilities(
            max_bandwidth=1000000000,
            storage_capacity=1000000000,
            quantum_processing=True,
            autonomous_operation=True
        )
        return relay_module.RelayStationManager("test_relay", "test_location", capabilities)
    
    @pytest.mark.asyncio
    async def test_relay_initialization(self, relay_station):
        """Test relay station initialization"""
        await relay_station.initialize_station()
        
        assert relay_station.station_id == "test_relay"
        assert relay_station.location == "test_location"
        assert relay_station.capabilities.quantum_processing is True
        assert relay_station.state == relay_module.RelayState.DEGRADED  # Expected state after init
    
    @pytest.mark.asyncio
    async def test_message_storage(self, relay_station):
        """Test message storage functionality"""
        await relay_station.initialize_station()
        
        test_message = {
            'message_id': 'storage_test_001',
            'source': 'earth',
            'destination': 'mars',
            'priority': 1,
            'payload': b'test storage message',
            'ttl': 3600
        }
        
        stored = await relay_station.store_message(test_message)
        assert stored is True
        
        status = relay_station.get_status()
        assert status['stored_messages'] == 1
    
    @pytest.mark.asyncio
    async def test_handoff_request(self, relay_station):
        """Test handoff request functionality"""
        await relay_station.initialize_station()
        
        handoff_id = await relay_station.request_handoff(
            source_relay="source_relay",
            message_id="handoff_test_001",
            priority=1
        )
        
        assert handoff_id is not None
        assert len(handoff_id) == 16  # Expected handoff ID length
    
    def test_relay_capabilities(self):
        """Test relay capabilities configuration"""
        capabilities = relay_module.RelayCapabilities(
            max_bandwidth=2000000000,
            storage_capacity=2000000000,
            quantum_processing=False,
            autonomous_operation=True
        )
        
        assert capabilities.max_bandwidth == 2000000000
        assert capabilities.storage_capacity == 2000000000
        assert capabilities.quantum_processing is False
        assert capabilities.autonomous_operation is True
    
    def test_relay_state_enum(self):
        """Test RelayState enum"""
        assert relay_module.RelayState.OFFLINE.value == "offline"
        assert relay_module.RelayState.INITIALIZING.value == "initializing"
        assert relay_module.RelayState.ACTIVE.value == "active"
        assert relay_module.RelayState.DEGRADED.value == "degraded"
        assert relay_module.RelayState.MAINTENANCE.value == "maintenance"

class TestQuantumRoutingAlgorithms:
    """Test suite for quantum routing algorithms"""
    
    @pytest.fixture
    def routing_engine(self):
        """Create routing engine instance"""
        return routing_module.QuantumRoutingEngine()
    
    def test_routing_engine_initialization(self, routing_engine):
        """Test routing engine initialization"""
        assert routing_engine.network_graph is not None
        assert routing_engine.nodes == {}
        assert routing_engine.links == {}
        assert routing_engine.routing_cache == {}
    
    def test_network_node_creation(self):
        """Test network node creation"""
        node = routing_module.NetworkNode(
            node_id="test_node",
            node_type=routing_module.NodeType.PLANET,
            position=np.array([1.0, 0.0, 0.0]),
            velocity=np.array([0.0, 0.1, 0.0]),
            quantum_accuracy=0.95,
            communication_range=2.0,
            bandwidth_capacity={"target": 1000000000},
            energy_level=0.8,
            last_update=time.time()
        )
        
        assert node.node_id == "test_node"
        assert node.node_type == routing_module.NodeType.PLANET
        assert np.allclose(node.position, [1.0, 0.0, 0.0])
        assert node.quantum_accuracy == 0.95
        assert node.energy_level == 0.8
    
    def test_quantum_link_creation(self):
        """Test quantum link creation"""
        link = routing_module.QuantumLink(
            source="earth",
            destination="mars",
            distance=1.5,
            bandwidth=1000000000,
            latency=500.0,
            reliability=0.95,
            quantum_key_rate=100000,
            energy_cost=0.1
        )
        
        assert link.source == "earth"
        assert link.destination == "mars"
        assert link.distance == 1.5
        assert link.bandwidth == 1000000000
        assert link.latency == 500.0
        assert link.reliability == 0.95
    
    def test_node_and_link_addition(self, routing_engine):
        """Test adding nodes and links to routing engine"""
        # Create test node
        node = routing_module.NetworkNode(
            node_id="test_node",
            node_type=routing_module.NodeType.PLANET,
            position=np.array([0.0, 0.0, 0.0]),
            velocity=np.array([0.0, 0.0, 0.0]),
            quantum_accuracy=0.95,
            communication_range=2.0,
            bandwidth_capacity={},
            energy_level=1.0,
            last_update=time.time()
        )
        
        # Add node
        routing_engine.add_node(node)
        assert "test_node" in routing_engine.nodes
        
        # Create and add link
        link = routing_module.QuantumLink(
            source="test_node",
            destination="target_node",
            distance=1.0,
            bandwidth=1000000000,
            latency=100.0,
            reliability=0.98,
            quantum_key_rate=50000,
            energy_cost=0.05
        )
        
        routing_engine.add_link(link)
        assert "test_node_target_node" in routing_engine.links
    
    @pytest.mark.asyncio
    async def test_route_finding(self, routing_engine):
        """Test route finding functionality"""
        # Create test network
        earth = routing_module.NetworkNode(
            node_id="earth",
            node_type=routing_module.NodeType.PLANET,
            position=np.array([0.0, 0.0, 0.0]),
            velocity=np.array([0.0, 0.0, 0.0]),
            quantum_accuracy=0.99,
            communication_range=3.0,
            bandwidth_capacity={"relay": 1000000000},
            energy_level=1.0,
            last_update=time.time()
        )
        
        mars = routing_module.NetworkNode(
            node_id="mars",
            node_type=routing_module.NodeType.PLANET,
            position=np.array([1.5, 0.0, 0.0]),
            velocity=np.array([0.0, 0.02, 0.0]),
            quantum_accuracy=0.95,
            communication_range=2.0,
            bandwidth_capacity={"relay": 1000000000},
            energy_level=0.8,
            last_update=time.time()
        )
        
        relay = routing_module.NetworkNode(
            node_id="relay",
            node_type=routing_module.NodeType.LAGRANGE_POINT,
            position=np.array([0.8, 0.8, 0.0]),
            velocity=np.array([0.0, 0.0, 0.0]),
            quantum_accuracy=0.98,
            communication_range=2.5,
            bandwidth_capacity={"earth": 1000000000, "mars": 1000000000},
            energy_level=0.9,
            last_update=time.time()
        )
        
        # Add nodes
        routing_engine.add_node(earth)
        routing_engine.add_node(mars)
        routing_engine.add_node(relay)
        
        # Add links
        earth_relay_link = routing_module.QuantumLink(
            source="earth",
            destination="relay",
            distance=1.13,
            bandwidth=1000000000,
            latency=564,
            reliability=0.99,
            quantum_key_rate=100000,
            energy_cost=0.1
        )
        
        relay_mars_link = routing_module.QuantumLink(
            source="relay",
            destination="mars",
            distance=0.85,
            bandwidth=1000000000,
            latency=424,
            reliability=0.95,
            quantum_key_rate=50000,
            energy_cost=0.15
        )
        
        routing_engine.add_link(earth_relay_link)
        routing_engine.add_link(relay_mars_link)
        
        # Create routing request
        request = routing_module.RoutingRequest(
            request_id="test_route_001",
            source="earth",
            destination="mars",
            data_size=1024 * 1024,
            priority=1,
            max_latency=1000,
            min_bandwidth=1000000,
            quantum_security_required=True,
            timestamp=time.time(),
            source_position=earth.position
        )
        
        # Find route
        route = await routing_engine.find_optimal_route(request, routing_module.RoutingStrategy.SHORTEST_PATH)
        
        assert route is not None
        assert len(route) > 0
        assert route[0] == "earth"
        assert route[-1] == "mars"
    
    def test_routing_strategy_enum(self):
        """Test RoutingStrategy enum"""
        assert routing_module.RoutingStrategy.SHORTEST_PATH.value == "shortest_path"
        assert routing_module.RoutingStrategy.MINIMUM_DELAY.value == "minimum_delay"
        assert routing_module.RoutingStrategy.MAXIMUM_BANDWIDTH.value == "maximum_bandwidth"
        assert routing_module.RoutingStrategy.QUANTUM_OPTIMIZED.value == "quantum_optimized"

class TestErrorCorrectionProtocols:
    """Test suite for error correction protocols"""
    
    @pytest.fixture
    def error_correction(self):
        """Create error correction instance"""
        return ecc_module.AdaptiveErrorCorrection()
    
    def test_error_correction_initialization(self, error_correction):
        """Test error correction initialization"""
        assert error_correction.rs_code is not None
        assert error_correction.available_codes is not None
        assert len(error_correction.available_codes) > 0
    
    @pytest.mark.asyncio
    async def test_reed_solomon_encoding(self, error_correction):
        """Test Reed-Solomon encoding"""
        test_data = b"Reed-Solomon test data for error correction"
        
        encoded_data, config = await error_correction.encode_adaptive(test_data, target_ber=1e-6)
        
        assert encoded_data is not None
        assert len(encoded_data) > len(test_data)
        assert config.code_type == ecc_module.ErrorCorrectionType.REED_SOLOMON
        assert config.code_rate > 0
        assert config.code_rate <= 1.0
    
    @pytest.mark.asyncio
    async def test_error_correction_decoding(self, error_correction):
        """Test error correction decoding"""
        test_data = b"Error correction decoding test"
        
        # Encode data
        encoded_data, config = await error_correction.encode_adaptive(test_data, target_ber=1e-6)
        
        # Decode without errors
        decoded_data, errors_corrected = await error_correction.decode_adaptive(encoded_data, config)
        
        assert decoded_data == test_data
        assert errors_corrected >= 0
    
    def test_error_correction_types(self):
        """Test error correction types"""
        assert ecc_module.ErrorCorrectionType.REED_SOLOMON.value == "reed_solomon"
        assert ecc_module.ErrorCorrectionType.LDPC.value == "ldpc"
        assert ecc_module.ErrorCorrectionType.TURBO.value == "turbo"
        assert ecc_module.ErrorCorrectionType.FOUNTAIN.value == "fountain"
    
    def test_error_correction_config(self):
        """Test error correction configuration"""
        config = ecc_module.ErrorCorrectionConfig(
            code_type=ecc_module.ErrorCorrectionType.REED_SOLOMON,
            code_rate=0.8,
            block_size=255,
            parameters={'n': 255, 'k': 204}
        )
        
        assert config.code_type == ecc_module.ErrorCorrectionType.REED_SOLOMON
        assert config.code_rate == 0.8
        assert config.block_size == 255
        assert config.parameters['n'] == 255
        assert config.parameters['k'] == 204

class TestAdaptiveLatencyProtocols:
    """Test suite for adaptive latency protocols"""
    
    @pytest.fixture
    def latency_manager(self):
        """Create adaptive latency manager instance"""
        return latency_module.AdaptiveLatencyManager()
    
    def test_latency_manager_initialization(self, latency_manager):
        """Test latency manager initialization"""
        assert latency_manager.latency_measurements == {}
        assert latency_manager.active_sessions == {}
        assert latency_manager.protocol_stats == {}
    
    def test_latency_measurement(self):
        """Test latency measurement creation"""
        measurement = latency_module.LatencyMeasurement(
            timestamp=time.time(),
            source="earth",
            destination="mars",
            round_trip_time=720.0,
            one_way_latency=360.0,
            jitter=5.0,
            packet_loss=0.001,
            bandwidth=1e9,
            congestion_level=0.1
        )
        
        assert measurement.source == "earth"
        assert measurement.destination == "mars"
        assert measurement.round_trip_time == 720.0
        assert measurement.one_way_latency == 360.0
        assert measurement.jitter == 5.0
        assert measurement.packet_loss == 0.001
    
    def test_latency_profile_classification(self, latency_manager):
        """Test latency profile classification"""
        # Add measurements
        measurement = latency_module.LatencyMeasurement(
            timestamp=time.time(),
            source="earth",
            destination="mars",
            round_trip_time=720.0,
            one_way_latency=360.0,
            jitter=5.0,
            packet_loss=0.001,
            bandwidth=1e9,
            congestion_level=0.1
        )
        
        latency_manager.add_latency_measurement(measurement)
        
        profile = latency_manager.get_latency_profile("earth", "mars")
        assert profile in [
            latency_module.LatencyProfile.NEAR_REAL_TIME,
            latency_module.LatencyProfile.INTERACTIVE,
            latency_module.LatencyProfile.DELAYED_INTERACTIVE,
            latency_module.LatencyProfile.BATCH_PROCESSING
        ]
    
    @pytest.mark.asyncio
    async def test_adaptive_session_creation(self, latency_manager):
        """Test adaptive session creation"""
        # Add latency measurement first
        measurement = latency_module.LatencyMeasurement(
            timestamp=time.time(),
            source="earth",
            destination="mars",
            round_trip_time=720.0,
            one_way_latency=360.0,
            jitter=5.0,
            packet_loss=0.001,
            bandwidth=1e9,
            congestion_level=0.1
        )
        
        latency_manager.add_latency_measurement(measurement)
        
        # Create adaptive session
        session_id = await latency_manager.create_adaptive_session("earth", "mars")
        
        assert session_id is not None
        assert session_id in latency_manager.active_sessions
        
        # Get session parameters
        params = latency_manager.get_session_parameters(session_id)
        assert params is not None
        assert params.mode is not None
        assert params.window_size > 0
        assert params.timeout > 0
    
    def test_latency_profile_enum(self):
        """Test LatencyProfile enum"""
        assert latency_module.LatencyProfile.NEAR_REAL_TIME.value == "near_real_time"
        assert latency_module.LatencyProfile.INTERACTIVE.value == "interactive"
        assert latency_module.LatencyProfile.DELAYED_INTERACTIVE.value == "delayed_interactive"
        assert latency_module.LatencyProfile.BATCH_PROCESSING.value == "batch_processing"
    
    def test_protocol_mode_enum(self):
        """Test ProtocolMode enum"""
        assert latency_module.ProtocolMode.BURST.value == "burst"
        assert latency_module.ProtocolMode.STREAMING.value == "streaming"
        assert latency_module.ProtocolMode.BATCH.value == "batch"
        assert latency_module.ProtocolMode.ADAPTIVE.value == "adaptive"

class TestProtocolIntegration:
    """Test suite for protocol integration"""
    
    @pytest.mark.asyncio
    async def test_full_protocol_stack(self):
        """Test complete protocol stack integration"""
        # Create protocol instances
        ipcp = ipcp_module.IPCPProtocol("earth")
        
        # Mock dependencies
        mock_position = ipcp_module.QuantumPosition(
            x=0.0, y=0.0, z=0.0,
            accuracy=5.0,
            timestamp=time.time(),
            quantum_confidence=0.95,
            entanglement_id="test_ent"
        )
        
        ipcp.quantum_nav.get_current_position = Mock(return_value=mock_position)
        ipcp.routing_engine.calculate_optimal_route = AsyncMock(return_value=["earth", "mars"])
        
        # Send message through full stack
        message_id = await ipcp.send_message(
            destination="mars",
            payload=b"Full protocol stack test message",
            priority=ipcp_module.MessagePriority.P1_CRITICAL
        )
        
        assert message_id is not None
        assert message_id in ipcp.sent_messages
        
        # Verify message structure
        sent_message = ipcp.sent_messages[message_id]
        assert sent_message.source_node == "earth"
        assert sent_message.destination_node == "mars"
        assert sent_message.priority == ipcp_module.MessagePriority.P1_CRITICAL
        assert sent_message.source_position == mock_position
    
    def test_protocol_compatibility(self):
        """Test protocol compatibility across modules"""
        # Test that enums and classes are compatible
        assert hasattr(ipcp_module, 'MessagePriority')
        assert hasattr(relay_module, 'RelayState')
        assert hasattr(routing_module, 'RoutingStrategy')
        assert hasattr(ecc_module, 'ErrorCorrectionType')
        assert hasattr(latency_module, 'LatencyProfile')
    
    def test_protocol_versioning(self):
        """Test protocol versioning"""
        ipcp = ipcp_module.IPCPProtocol("version_test")
        
        # Check that protocol reports correct version
        network_status = asyncio.run(ipcp.get_network_status())
        assert network_status['protocol_version'] == '1.1'
    
    @pytest.mark.asyncio
    async def test_error_handling_integration(self):
        """Test error handling across protocols"""
        ipcp = ipcp_module.IPCPProtocol("error_test")
        
        # Test error when quantum navigation is offline
        ipcp.quantum_nav.get_current_position = Mock(return_value=None)
        
        with pytest.raises(RuntimeError, match="Quantum navigation system offline"):
            await ipcp.send_message(
                destination="mars",
                payload=b"test message",
                priority=ipcp_module.MessagePriority.P3_SCIENTIFIC
            )

# Performance and load testing
class TestProtocolPerformance:
    """Test suite for protocol performance"""
    
    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_message_throughput(self):
        """Test message throughput performance"""
        ipcp = ipcp_module.IPCPProtocol("throughput_test")
        
        # Mock dependencies for performance testing
        mock_position = ipcp_module.QuantumPosition(
            x=0.0, y=0.0, z=0.0,
            accuracy=5.0,
            timestamp=time.time(),
            quantum_confidence=0.95,
            entanglement_id="test_ent"
        )
        
        ipcp.quantum_nav.get_current_position = Mock(return_value=mock_position)
        ipcp.routing_engine.calculate_optimal_route = AsyncMock(return_value=["earth", "mars"])
        
        # Measure throughput
        start_time = time.time()
        message_ids = []
        
        for i in range(10):
            message_id = await ipcp.send_message(
                destination="mars",
                payload=f"Performance test message {i}".encode(),
                priority=ipcp_module.MessagePriority.P3_SCIENTIFIC
            )
            message_ids.append(message_id)
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Verify all messages were sent
        assert len(message_ids) == 10
        assert all(msg_id in ipcp.sent_messages for msg_id in message_ids)
        
        # Performance assertion
        assert duration < 5.0  # Should send 10 messages in less than 5 seconds
    
    @pytest.mark.benchmark
    def test_routing_performance(self):
        """Test routing algorithm performance"""
        routing_engine = routing_module.QuantumRoutingEngine()
        
        # Create large network
        start_time = time.time()
        
        # Add many nodes
        for i in range(100):
            node = routing_module.NetworkNode(
                node_id=f"node_{i}",
                node_type=routing_module.NodeType.RELAY,
                position=np.random.rand(3) * 10,
                velocity=np.random.rand(3) * 0.1,
                quantum_accuracy=0.9 + np.random.rand() * 0.1,
                communication_range=2.0,
                bandwidth_capacity={},
                energy_level=0.8 + np.random.rand() * 0.2,
                last_update=time.time()
            )
            routing_engine.add_node(node)
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Performance assertion
        assert duration < 2.0  # Should add 100 nodes in less than 2 seconds
        assert len(routing_engine.nodes) == 100

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])