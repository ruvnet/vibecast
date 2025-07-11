#!/usr/bin/env python3
"""
Quantum Signature Verification Debug Test
Specifically tests and debugs the quantum signature verification issue
"""

import sys
import os
import time
import hashlib
import asyncio
from unittest.mock import Mock, AsyncMock

# Add protocols to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'protocols'))

# Import IPCP module
import importlib.util
protocols_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'protocols'))
spec = importlib.util.spec_from_file_location("ipcp_module", os.path.join(protocols_dir, "ipcp-v1.1-quantum-navigation.py"))
ipcp_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ipcp_module)

class QuantumSignatureDebugTest:
    """Debug test for quantum signature verification"""
    
    def __init__(self):
        self.results = []
        
    def log_result(self, test_name: str, status: str, details: str = ""):
        """Log test result"""
        self.results.append({
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': time.time()
        })
        print(f"{'✅' if status == 'PASS' else '❌'} {test_name}: {status}")
        if details:
            print(f"   Details: {details}")
    
    async def test_quantum_key_generation(self):
        """Test quantum key generation"""
        try:
            # Create IPCP protocol
            earth_protocol = ipcp_module.IPCPProtocol("earth_debug")
            
            # Test quantum key generation
            key_id = "earth_mars_debug"
            quantum_key = await earth_protocol.quantum_key_manager.generate_quantum_key(key_id)
            
            if quantum_key:
                self.log_result("quantum_key_generation", "PASS", f"Key generated: {len(quantum_key)} bytes")
                return quantum_key
            else:
                self.log_result("quantum_key_generation", "FAIL", "No key generated")
                return None
                
        except Exception as e:
            self.log_result("quantum_key_generation", "FAIL", f"Exception: {str(e)}")
            return None
    
    async def test_signature_creation(self):
        """Test quantum signature creation"""
        try:
            # Create IPCP protocol
            earth_protocol = ipcp_module.IPCPProtocol("earth_debug")
            
            # Test data
            test_payload = b"Debug test payload for signature verification"
            
            # Generate quantum key
            key_id = "earth_mars_debug"
            quantum_key = await earth_protocol.quantum_key_manager.generate_quantum_key(key_id)
            
            if quantum_key:
                # Create signature manually (same as in protocol)
                signature = hashlib.sha256(quantum_key + test_payload).hexdigest()
                
                self.log_result("signature_creation", "PASS", f"Signature: {signature[:16]}...")
                return signature, quantum_key, test_payload
            else:
                self.log_result("signature_creation", "FAIL", "No quantum key available")
                return None, None, None
                
        except Exception as e:
            self.log_result("signature_creation", "FAIL", f"Exception: {str(e)}")
            return None, None, None
    
    async def test_signature_verification(self):
        """Test quantum signature verification"""
        try:
            # Create protocols for sender and receiver
            earth_protocol = ipcp_module.IPCPProtocol("earth_debug")
            mars_protocol = ipcp_module.IPCPProtocol("mars_debug")
            
            # Test data
            test_payload = b"Debug test payload for signature verification"
            
            # Generate quantum key on sender side
            key_id = "earth_mars_debug"
            earth_quantum_key = await earth_protocol.quantum_key_manager.generate_quantum_key(key_id)
            
            # Create signature on sender side
            signature = hashlib.sha256(earth_quantum_key + test_payload).hexdigest()
            
            # Simulate receiving the quantum key on receiver side
            # In real implementation, this would be done through quantum key distribution
            mars_quantum_key = await mars_protocol.quantum_key_manager.generate_quantum_key(key_id)
            
            # Verify signature on receiver side
            expected_signature = hashlib.sha256(mars_quantum_key + test_payload).hexdigest()
            
            if signature == expected_signature:
                self.log_result("signature_verification", "PASS", "Signatures match")
                return True
            else:
                self.log_result("signature_verification", "FAIL", 
                               f"Signature mismatch: {signature[:16]}... vs {expected_signature[:16]}...")
                return False
                
        except Exception as e:
            self.log_result("signature_verification", "FAIL", f"Exception: {str(e)}")
            return False
    
    async def test_message_send_receive_cycle(self):
        """Test complete message send/receive cycle"""
        try:
            # Create protocols
            earth_protocol = ipcp_module.IPCPProtocol("earth_debug")
            mars_protocol = ipcp_module.IPCPProtocol("mars_debug")
            
            # Mock quantum navigation
            mock_position = ipcp_module.QuantumPosition(
                x=0.0, y=0.0, z=0.0,
                accuracy=5.0,
                timestamp=time.time(),
                quantum_confidence=0.95,
                entanglement_id="debug_ent"
            )
            
            earth_protocol.quantum_nav.get_current_position = Mock(return_value=mock_position)
            earth_protocol.routing_engine.calculate_optimal_route = AsyncMock(return_value=["earth_debug", "mars_debug"])
            
            # Send message
            test_payload = b"Debug end-to-end message test"
            message_id = await earth_protocol.send_message(
                destination="mars_debug",
                payload=test_payload,
                priority=ipcp_module.MessagePriority.P1_CRITICAL
            )
            
            if not message_id:
                self.log_result("message_send", "FAIL", "No message ID returned")
                return False
            
            # Get sent message
            sent_message = earth_protocol.sent_messages.get(message_id)
            if not sent_message:
                self.log_result("message_send", "FAIL", "Sent message not found")
                return False
            
            self.log_result("message_send", "PASS", f"Message sent: {message_id}")
            
            # Prepare message data for reception
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
            
            # Debug: Print signature info
            print(f"🔍 DEBUG: Signature being verified: {sent_message.quantum_signature}")
            
            # Generate quantum key for Mars (should match Earth's key for same key ID)
            mars_key = await mars_protocol.quantum_key_manager.generate_quantum_key(
                f"{sent_message.source_node}_{sent_message.destination_node}"
            )
            
            print(f"🔍 DEBUG: Mars quantum key generated: {mars_key[:10] if mars_key else 'None'}...")
            
            # Attempt to receive message
            received_message = await mars_protocol.receive_message(message_data)
            
            if received_message:
                self.log_result("message_receive", "PASS", f"Message received: {received_message.message_id}")
                
                # Verify payload integrity
                if received_message.payload == test_payload:
                    self.log_result("payload_integrity", "PASS", "Payload matches")
                    return True
                else:
                    self.log_result("payload_integrity", "FAIL", "Payload mismatch")
                    return False
            else:
                self.log_result("message_receive", "FAIL", "Message reception failed")
                return False
                
        except Exception as e:
            self.log_result("message_send_receive", "FAIL", f"Exception: {str(e)}")
            return False
    
    async def test_quantum_key_consistency(self):
        """Test if quantum keys are consistent between nodes"""
        try:
            # Create two protocols
            earth_protocol = ipcp_module.IPCPProtocol("earth_debug")
            mars_protocol = ipcp_module.IPCPProtocol("mars_debug")
            
            # Generate keys with same ID
            key_id = "consistency_test"
            earth_key = await earth_protocol.quantum_key_manager.generate_quantum_key(key_id)
            mars_key = await mars_protocol.quantum_key_manager.generate_quantum_key(key_id)
            
            if earth_key and mars_key:
                if earth_key == mars_key:
                    self.log_result("quantum_key_consistency", "PASS", "Keys are consistent")
                    return True
                else:
                    self.log_result("quantum_key_consistency", "FAIL", 
                                   f"Keys differ: Earth={earth_key[:10]}..., Mars={mars_key[:10]}...")
                    return False
            else:
                self.log_result("quantum_key_consistency", "FAIL", "One or both keys failed to generate")
                return False
                
        except Exception as e:
            self.log_result("quantum_key_consistency", "FAIL", f"Exception: {str(e)}")
            return False
    
    async def run_all_debug_tests(self):
        """Run all debug tests"""
        print("🔍 Starting Quantum Signature Debug Tests")
        print("=" * 60)
        
        # Test quantum key generation
        await self.test_quantum_key_generation()
        
        # Test signature creation
        await self.test_signature_creation()
        
        # Test signature verification
        await self.test_signature_verification()
        
        # Test quantum key consistency
        await self.test_quantum_key_consistency()
        
        # Test complete message cycle
        await self.test_message_send_receive_cycle()
        
        # Generate summary
        self.generate_debug_summary()
    
    def generate_debug_summary(self):
        """Generate debug summary"""
        passed = sum(1 for r in self.results if r['status'] == 'PASS')
        failed = sum(1 for r in self.results if r['status'] == 'FAIL')
        total = len(self.results)
        
        print("\n" + "=" * 60)
        print("DEBUG TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if failed > 0:
            print("\nFailed Tests:")
            for result in self.results:
                if result['status'] == 'FAIL':
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print("\nRecommendations:")
        if any('quantum_key_consistency' in r['test'] and r['status'] == 'FAIL' for r in self.results):
            print("  • Quantum key generation is not deterministic - implement proper key distribution")
        
        if any('signature_verification' in r['test'] and r['status'] == 'FAIL' for r in self.results):
            print("  • Signature verification algorithm needs review")
        
        if any('message_receive' in r['test'] and r['status'] == 'FAIL' for r in self.results):
            print("  • Message reception logic has issues with quantum signature validation")
        
        print("=" * 60)

async def main():
    """Main debug test function"""
    debug_test = QuantumSignatureDebugTest()
    await debug_test.run_all_debug_tests()

if __name__ == "__main__":
    asyncio.run(main())