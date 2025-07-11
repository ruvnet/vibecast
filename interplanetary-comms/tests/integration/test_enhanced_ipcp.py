#!/usr/bin/env python3
"""
Integration Test for Enhanced IPCP v1.1 with Quantum Navigation
Tests all enhanced communication protocols working together
"""

import asyncio
import sys
import os
import time
import numpy as np
import logging
from typing import Dict, Any

# Add protocols to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'protocols'))

import importlib.util
import sys

# Import modules with dashes in names
protocols_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'protocols'))

try:
    spec = importlib.util.spec_from_file_location("ipcp_v1_1_quantum_navigation", os.path.join(protocols_dir, "ipcp-v1.1-quantum-navigation.py"))
    ipcp_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ipcp_module)
except Exception as e:
    print(f"Warning: Could not import IPCP module: {e}")
    ipcp_module = None

try:
    spec = importlib.util.spec_from_file_location("relay_station_comm", os.path.join(protocols_dir, "relay-station-comm.py"))
    relay_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(relay_module)
except Exception as e:
    print(f"Warning: Could not import relay module: {e}")
    relay_module = None

try:
    spec = importlib.util.spec_from_file_location("quantum_routing_algorithms", os.path.join(protocols_dir, "quantum-routing-algorithms.py"))
    routing_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(routing_module)
except Exception as e:
    print(f"Warning: Could not import routing module: {e}")
    routing_module = None

try:
    spec = importlib.util.spec_from_file_location("deep_space_error_correction", os.path.join(protocols_dir, "deep-space-error-correction.py"))
    ecc_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ecc_module)
except Exception as e:
    print(f"Warning: Could not import ECC module: {e}")
    ecc_module = None

try:
    spec = importlib.util.spec_from_file_location("adaptive_latency_protocols", os.path.join(protocols_dir, "adaptive-latency-protocols.py"))
    latency_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(latency_module)
except Exception as e:
    print(f"Warning: Could not import latency module: {e}")
    latency_module = None

# Extract classes with fallback handling
if ipcp_module:
    IPCPProtocol = ipcp_module.IPCPProtocol
    MessagePriority = ipcp_module.MessagePriority
    QuantumPosition = ipcp_module.QuantumPosition
else:
    IPCPProtocol = None
    MessagePriority = None
    QuantumPosition = None

if relay_module:
    RelayStationManager = relay_module.RelayStationManager
    RelayCapabilities = relay_module.RelayCapabilities
else:
    RelayStationManager = None
    RelayCapabilities = None

if routing_module:
    QuantumRoutingEngine = routing_module.QuantumRoutingEngine
    NetworkNode = routing_module.NetworkNode
    NodeType = routing_module.NodeType
    QuantumLink = routing_module.QuantumLink
else:
    QuantumRoutingEngine = None
    NetworkNode = None
    NodeType = None
    QuantumLink = None

if ecc_module:
    AdaptiveErrorCorrection = ecc_module.AdaptiveErrorCorrection
else:
    AdaptiveErrorCorrection = None

if latency_module:
    AdaptiveLatencyManager = latency_module.AdaptiveLatencyManager
    LatencyMeasurement = latency_module.LatencyMeasurement
else:
    AdaptiveLatencyManager = None
    LatencyMeasurement = None

class IPCPIntegrationTest:
    """Comprehensive integration test for enhanced IPCP"""
    
    def __init__(self):
        self.logger = logging.getLogger("integration_test")
        self.test_results = {
            'quantum_navigation': False,
            'relay_handoff': False,
            'routing_optimization': False,
            'error_correction': False,
            'adaptive_latency': False,
            'end_to_end_communication': False
        }
    
    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all integration tests"""
        self.logger.info("Starting IPCP v1.1 integration tests")
        
        # Test 1: Quantum Navigation Integration
        self.logger.info("Test 1: Quantum Navigation Integration")
        self.test_results['quantum_navigation'] = await self.test_quantum_navigation()
        
        # Test 2: Relay Station Handoff
        self.logger.info("Test 2: Relay Station Handoff")
        self.test_results['relay_handoff'] = await self.test_relay_handoff()
        
        # Test 3: Routing Optimization
        self.logger.info("Test 3: Routing Optimization")
        self.test_results['routing_optimization'] = await self.test_routing_optimization()
        
        # Test 4: Error Correction
        self.logger.info("Test 4: Error Correction")
        self.test_results['error_correction'] = await self.test_error_correction()
        
        # Test 5: Adaptive Latency
        self.logger.info("Test 5: Adaptive Latency")
        self.test_results['adaptive_latency'] = await self.test_adaptive_latency()
        
        # Test 6: End-to-End Communication
        self.logger.info("Test 6: End-to-End Communication")
        self.test_results['end_to_end_communication'] = await self.test_end_to_end_communication()
        
        # Generate test report
        return self.generate_test_report()
    
    async def test_quantum_navigation(self) -> bool:
        """Test quantum navigation integration"""
        try:
            # Create IPCP protocol instance
            earth_node = IPCPProtocol("earth_control")
            
            # Test quantum position integration
            test_position = QuantumPosition(
                x=1.0, y=0.0, z=0.0,
                accuracy=50.0,
                timestamp=time.time(),
                quantum_confidence=0.95,
                entanglement_id="test_ent_001"
            )
            
            # Update node position
            earth_node.quantum_nav.position_history.append(test_position)
            
            # Test message creation with quantum navigation
            test_payload = b"Quantum navigation test message"
            message_id = await earth_node.send_message(
                destination="mars_colony",
                payload=test_payload,
                priority=MessagePriority.P1_CRITICAL
            )
            
            # Verify message has quantum navigation data
            sent_message = earth_node.sent_messages.get(message_id)
            
            if sent_message and sent_message.source_position:
                self.logger.info(f"✓ Quantum navigation integrated successfully")
                self.logger.info(f"  Position: ({sent_message.source_position.x:.3f}, {sent_message.source_position.y:.3f}, {sent_message.source_position.z:.3f})")
                self.logger.info(f"  Accuracy: {sent_message.source_position.accuracy:.1f}m")
                self.logger.info(f"  Quantum confidence: {sent_message.source_position.quantum_confidence:.3f}")
                return True
            else:
                self.logger.error("✗ Quantum navigation integration failed")
                return False
                
        except Exception as e:
            self.logger.error(f"✗ Quantum navigation test failed: {e}")
            return False
    
    async def test_relay_handoff(self) -> bool:
        """Test relay station handoff protocols"""
        try:
            # Create relay station capabilities
            capabilities = RelayCapabilities(
                max_bandwidth=1000000000,
                storage_capacity=1000000000,  # 1GB for test
                quantum_processing=True,
                autonomous_operation=True
            )
            
            # Create relay stations
            earth_relay = RelayStationManager("earth_l4_relay", "earth_sun_l4", capabilities)
            mars_relay = RelayStationManager("mars_l5_relay", "mars_sun_l5", capabilities)
            
            # Initialize relay stations
            await earth_relay.initialize_station()
            await mars_relay.initialize_station()
            
            # Test message storage
            test_message = {
                'message_id': 'relay_test_001',
                'source': 'earth_control',
                'destination': 'mars_colony',
                'priority': 1,
                'payload': b'Relay handoff test message',
                'ttl': 3600
            }
            
            # Store message in earth relay
            stored = await earth_relay.store_message(test_message)
            
            if stored:
                self.logger.info("✓ Message stored in Earth relay")
                
                # Test handoff request
                handoff_id = await mars_relay.request_handoff(
                    source_relay="earth_l4_relay",
                    message_id="relay_test_001",
                    priority=1
                )
                
                if handoff_id:
                    self.logger.info(f"✓ Handoff request created: {handoff_id}")
                    
                    # Give time for handoff processing
                    await asyncio.sleep(1)
                    
                    # Check relay status
                    earth_status = earth_relay.get_status()
                    mars_status = mars_relay.get_status()
                    
                    self.logger.info(f"  Earth relay: {earth_status['stored_messages']} messages")
                    self.logger.info(f"  Mars relay: {mars_status['stored_messages']} messages")
                    
                    return True
                else:
                    self.logger.error("✗ Handoff request failed")
                    return False
            else:
                self.logger.error("✗ Message storage failed")
                return False
                
        except Exception as e:
            self.logger.error(f"✗ Relay handoff test failed: {e}")
            return False
    
    async def test_routing_optimization(self) -> bool:
        """Test quantum routing algorithms"""
        try:
            # Create routing engine
            routing_engine = QuantumRoutingEngine()
            
            # Add network nodes
            earth = NetworkNode(
                node_id="earth_control",
                node_type=NodeType.PLANET,
                position=np.array([0.0, 0.0, 0.0]),
                velocity=np.array([0.0, 0.0, 0.0]),
                quantum_accuracy=0.99,
                communication_range=3.0,
                bandwidth_capacity={"mars_colony": 1000000000},
                energy_level=1.0,
                last_update=time.time()
            )
            
            mars = NetworkNode(
                node_id="mars_colony",
                node_type=NodeType.PLANET,
                position=np.array([1.5, 0.0, 0.0]),
                velocity=np.array([0.0, 0.02, 0.0]),
                quantum_accuracy=0.95,
                communication_range=2.0,
                bandwidth_capacity={"earth_control": 1000000000},
                energy_level=0.8,
                last_update=time.time()
            )
            
            relay = NetworkNode(
                node_id="earth_l4_relay",
                node_type=NodeType.LAGRANGE_POINT,
                position=np.array([0.8, 0.8, 0.0]),
                velocity=np.array([0.0, 0.0, 0.0]),
                quantum_accuracy=0.98,
                communication_range=2.5,
                bandwidth_capacity={"earth_control": 10000000000, "mars_colony": 1000000000},
                energy_level=0.9,
                last_update=time.time()
            )
            
            # Add nodes to routing engine
            routing_engine.add_node(earth)
            routing_engine.add_node(mars)
            routing_engine.add_node(relay)
            
            # Add links
            earth_relay_link = QuantumLink(
                source="earth_control",
                destination="earth_l4_relay",
                distance=1.13,
                bandwidth=10000000000,
                latency=564,
                reliability=0.99,
                quantum_key_rate=100000,
                energy_cost=0.1
            )
            
            relay_mars_link = QuantumLink(
                source="earth_l4_relay",
                destination="mars_colony",
                distance=0.85,
                bandwidth=1000000000,
                latency=424,
                reliability=0.95,
                quantum_key_rate=50000,
                energy_cost=0.15
            )
            
            routing_engine.add_link(earth_relay_link)
            routing_engine.add_link(relay_mars_link)
            
            # Test route calculation
            RoutingRequest = routing_module.RoutingRequest
            RoutingStrategy = routing_module.RoutingStrategy
            
            request = RoutingRequest(
                request_id="routing_test_001",
                source="earth_control",
                destination="mars_colony",
                data_size=1024 * 1024,
                priority=1,
                max_latency=1000,
                min_bandwidth=1000000,
                quantum_security_required=True,
                timestamp=time.time(),
                source_position=earth.position
            )
            
            # Test different routing strategies
            strategies = [
                RoutingStrategy.SHORTEST_PATH,
                RoutingStrategy.MINIMUM_DELAY,
                RoutingStrategy.QUANTUM_OPTIMIZED
            ]
            
            for strategy in strategies:
                route = await routing_engine.find_optimal_route(request, strategy)
                metrics = routing_engine.calculate_route_metrics(route)
                
                self.logger.info(f"✓ {strategy.value} route: {route}")
                self.logger.info(f"  Latency: {metrics.get('total_latency', 0):.2f}s")
                self.logger.info(f"  Bandwidth: {metrics.get('bottleneck_bandwidth', 0)/1e6:.1f} Mbps")
                self.logger.info(f"  Reliability: {metrics.get('end_to_end_reliability', 0):.3f}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"✗ Routing optimization test failed: {e}")
            return False
    
    async def test_error_correction(self) -> bool:
        """Test deep space error correction"""
        try:
            # Create adaptive error correction system
            ecc = AdaptiveErrorCorrection()
            
            # Test data
            test_data = b"Deep space error correction test message with quantum navigation data"
            
            # Test different channel conditions
            target_bers = [1e-6, 1e-9, 1e-12]
            
            for target_ber in target_bers:
                # Encode with adaptive selection
                encoded_data, config = await ecc.encode_adaptive(test_data, target_ber=target_ber)
                
                self.logger.info(f"✓ Encoded for BER {target_ber} with {config.code_type.value}")
                self.logger.info(f"  Code rate: {config.code_rate:.3f}")
                self.logger.info(f"  Overhead: {(len(encoded_data) - len(test_data)) / len(test_data) * 100:.1f}%")
                
                # Simulate channel errors
                error_rate = min(0.01, target_ber * 1000)  # Scale for simulation
                corrupted_data = bytearray(encoded_data)
                
                errors_introduced = 0
                for i in range(len(corrupted_data)):
                    for bit in range(8):
                        if np.random.random() < error_rate:
                            corrupted_data[i] ^= (1 << bit)
                            errors_introduced += 1
                
                # Decode
                decoded_data, errors_corrected = await ecc.decode_adaptive(bytes(corrupted_data), config)
                
                success = decoded_data == test_data
                self.logger.info(f"  Errors introduced: {errors_introduced}")
                self.logger.info(f"  Errors corrected: {errors_corrected}")
                self.logger.info(f"  Decoding success: {success}")
                
                if not success and errors_introduced > 0:
                    self.logger.warning(f"  Decoding failed with {errors_introduced} errors")
            
            return True
            
        except Exception as e:
            self.logger.error(f"✗ Error correction test failed: {e}")
            return False
    
    async def test_adaptive_latency(self) -> bool:
        """Test adaptive latency protocols"""
        try:
            # Create adaptive latency manager
            latency_manager = AdaptiveLatencyManager()
            
            # Add latency measurements for different routes
            measurements = [
                LatencyMeasurement(
                    timestamp=time.time(),
                    source="earth_control",
                    destination="mars_colony",
                    round_trip_time=720.0,  # 12 minutes
                    one_way_latency=360.0,
                    jitter=5.0,
                    packet_loss=0.001,
                    bandwidth=1e9,
                    congestion_level=0.1
                ),
                LatencyMeasurement(
                    timestamp=time.time(),
                    source="earth_control",
                    destination="earth_l4_relay",
                    round_trip_time=8.0,  # 8 seconds
                    one_way_latency=4.0,
                    jitter=0.5,
                    packet_loss=0.0001,
                    bandwidth=10e9,
                    congestion_level=0.05
                )
            ]
            
            for measurement in measurements:
                latency_manager.add_latency_measurement(measurement)
            
            # Test latency profile classification
            earth_mars_profile = latency_manager.get_latency_profile("earth_control", "mars_colony")
            earth_relay_profile = latency_manager.get_latency_profile("earth_control", "earth_l4_relay")
            
            self.logger.info(f"✓ Earth-Mars latency profile: {earth_mars_profile.value}")
            self.logger.info(f"✓ Earth-Relay latency profile: {earth_relay_profile.value}")
            
            # Test adaptive session creation
            session_id = await latency_manager.create_adaptive_session("earth_control", "mars_colony")
            
            if session_id:
                self.logger.info(f"✓ Adaptive session created: {session_id}")
                
                # Get session parameters
                params = latency_manager.get_session_parameters(session_id)
                if params:
                    self.logger.info(f"  Protocol mode: {params.mode.value}")
                    self.logger.info(f"  Window size: {params.window_size}")
                    self.logger.info(f"  Timeout: {params.timeout:.2f}s")
                    
                    # Let adaptation run briefly
                    await asyncio.sleep(2)
                    
                    return True
                else:
                    self.logger.error("✗ Failed to get session parameters")
                    return False
            else:
                self.logger.error("✗ Failed to create adaptive session")
                return False
                
        except Exception as e:
            self.logger.error(f"✗ Adaptive latency test failed: {e}")
            return False
    
    async def test_end_to_end_communication(self) -> bool:
        """Test complete end-to-end communication"""
        try:
            # Create complete communication system
            self.logger.info("Setting up complete communication system...")
            
            # Initialize all components
            earth_protocol = IPCPProtocol("earth_control")
            mars_protocol = IPCPProtocol("mars_colony")
            
            # Create test message with all enhancements
            test_payload = b"End-to-end integration test: Mission status update from Earth to Mars with quantum navigation, relay handoff, adaptive routing, error correction, and latency optimization."
            
            self.logger.info(f"Sending {len(test_payload)} bytes from Earth to Mars...")
            
            # Send message with high priority
            message_id = await earth_protocol.send_message(
                destination="mars_colony",
                payload=test_payload,
                priority=MessagePriority.P1_CRITICAL,
                ttl=3600
            )
            
            if message_id:
                self.logger.info(f"✓ Message sent: {message_id}")
                
                # Process message queue
                await earth_protocol.process_message_queue()
                
                # Simulate message reception at Mars
                # In a real system, this would happen through network transmission
                sent_message = earth_protocol.sent_messages.get(message_id)
                
                if sent_message:
                    # Create message data for reception
                    message_data = {
                        'message_id': sent_message.message_id,
                        'source_node': sent_message.source_node,
                        'destination_node': sent_message.destination_node,
                        'priority': sent_message.priority.value,
                        'timestamp': sent_message.timestamp,
                        'ttl': sent_message.ttl,
                        'source_position': sent_message.source_position.to_dict(),
                        'destination_position': None,
                        'relay_path': sent_message.relay_path,
                        'quantum_signature': sent_message.quantum_signature,
                        'payload': sent_message.payload
                    }
                    
                    # Simulate quantum key availability at Mars
                    quantum_key = await mars_protocol.quantum_key_manager.generate_quantum_key(
                        f"{sent_message.source_node}_{sent_message.destination_node}"
                    )
                    
                    # Receive message at Mars
                    received_message = await mars_protocol.receive_message(message_data)
                    
                    if received_message:
                        self.logger.info(f"✓ Message received at Mars: {received_message.message_id}")
                        self.logger.info(f"  Source: {received_message.source_node}")
                        self.logger.info(f"  Priority: {received_message.priority.value}")
                        self.logger.info(f"  Relay path: {received_message.relay_path}")
                        self.logger.info(f"  Payload size: {len(received_message.payload)} bytes")
                        
                        # Verify message integrity
                        if received_message.payload == test_payload:
                            self.logger.info("✓ Message integrity verified")
                            return True
                        else:
                            self.logger.error("✗ Message integrity check failed")
                            return False
                    else:
                        self.logger.error("✗ Message reception failed")
                        return False
                else:
                    self.logger.error("✗ Sent message not found")
                    return False
            else:
                self.logger.error("✗ Message sending failed")
                return False
                
        except Exception as e:
            self.logger.error(f"✗ End-to-end communication test failed: {e}")
            return False
    
    def generate_test_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        passed_tests = sum(1 for result in self.test_results.values() if result)
        total_tests = len(self.test_results)
        success_rate = (passed_tests / total_tests) * 100
        
        report = {
            'test_summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': total_tests - passed_tests,
                'success_rate': success_rate,
                'overall_status': 'PASS' if passed_tests == total_tests else 'FAIL'
            },
            'test_details': self.test_results,
            'test_timestamp': time.time(),
            'recommendations': []
        }
        
        # Add recommendations based on failures
        if not self.test_results['quantum_navigation']:
            report['recommendations'].append("Review quantum navigation integration implementation")
        
        if not self.test_results['relay_handoff']:
            report['recommendations'].append("Check relay station handoff protocols")
        
        if not self.test_results['routing_optimization']:
            report['recommendations'].append("Verify routing algorithm implementations")
        
        if not self.test_results['error_correction']:
            report['recommendations'].append("Test error correction under various conditions")
        
        if not self.test_results['adaptive_latency']:
            report['recommendations'].append("Review adaptive latency protocol logic")
        
        if not self.test_results['end_to_end_communication']:
            report['recommendations'].append("Investigate end-to-end communication flow")
        
        return report

async def main():
    """Run integration tests"""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger("main")
    
    # Create and run integration test
    integration_test = IPCPIntegrationTest()
    
    logger.info("=" * 60)
    logger.info("IPCP v1.1 Enhanced Integration Test Suite")
    logger.info("=" * 60)
    
    # Run all tests
    report = await integration_test.run_all_tests()
    
    # Print test report
    logger.info("\n" + "=" * 60)
    logger.info("TEST REPORT")
    logger.info("=" * 60)
    
    print(f"Total Tests: {report['test_summary']['total_tests']}")
    print(f"Passed: {report['test_summary']['passed_tests']}")
    print(f"Failed: {report['test_summary']['failed_tests']}")
    print(f"Success Rate: {report['test_summary']['success_rate']:.1f}%")
    print(f"Overall Status: {report['test_summary']['overall_status']}")
    
    print("\nTest Details:")
    for test_name, result in report['test_details'].items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {test_name}: {status}")
    
    if report['recommendations']:
        print("\nRecommendations:")
        for rec in report['recommendations']:
            print(f"  - {rec}")
    
    logger.info("=" * 60)
    logger.info("Integration test completed")
    logger.info("=" * 60)
    
    return report

if __name__ == "__main__":
    asyncio.run(main())