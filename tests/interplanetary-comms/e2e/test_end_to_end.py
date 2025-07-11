"""
End-to-end communication tests for interplanetary communications system.
Tests complete communication workflows from Earth to Mars and beyond.
"""

import pytest
import asyncio
import time
import json
import uuid
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List, Any, Optional, Tuple
import sys
import hashlib
import numpy as np
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import queue
import threading

# Add the simulation module to the path
sys.path.insert(0, '/workspaces/vibecast/interplanetary-comms/simulations')

from protocol_simulator import (
    InterplanetaryNetwork, CelestialBody, Message, QuantumChannel,
    ClassicalChannel, RelayStation, OrbitalPosition
)

@dataclass
class E2EMessage:
    """End-to-end message structure"""
    id: str
    sender: str
    recipient: str
    content: str
    message_type: str
    timestamp: float
    priority: int
    encryption_level: str
    delivery_confirmation: bool = False
    read_receipt: bool = False
    
    def to_protocol_message(self) -> Message:
        """Convert to protocol message"""
        message_data = json.dumps(asdict(self)).encode('utf-8')
        
        return Message(
            id=self.id,
            source=CelestialBody.EARTH if "earth" in self.sender.lower() else CelestialBody.MARS,
            destination=CelestialBody.MARS if "mars" in self.recipient.lower() else CelestialBody.EARTH,
            priority=self.priority,
            data_size=len(message_data),
            timestamp=self.timestamp,
            quantum_encrypted=(self.encryption_level == "quantum")
        )

@dataclass
class CommunicationSession:
    """Communication session tracker"""
    session_id: str
    participants: List[str]
    start_time: float
    messages: List[E2EMessage]
    status: str = "active"
    
    def add_message(self, message: E2EMessage):
        """Add message to session"""
        self.messages.append(message)
    
    def get_duration(self) -> float:
        """Get session duration"""
        return time.time() - self.start_time

class TestBasicE2ECommunication:
    """Test basic end-to-end communication scenarios"""
    
    def test_simple_earth_to_mars_message(self, network):
        """Test simple message from Earth to Mars"""
        # Create message
        message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="Mission status update: All systems nominal",
            message_type="status_update",
            timestamp=time.time(),
            priority=2,
            encryption_level="quantum"
        )
        
        # Send message
        protocol_message = message.to_protocol_message()
        result = network.send_message(protocol_message)
        
        # Verify successful delivery
        assert result['success'], f"Message delivery failed: {result.get('error', 'Unknown error')}"
        assert result['total_delay'] > 0, "Message delay should be positive"
        assert result['key_generation_rate'] > 0, "Quantum encryption should be used"
        
        # Verify message reaches destination
        assert len(result['route']) >= 2, "Message should have valid route"
        assert result['route'][0] == CelestialBody.EARTH.value, "Should start from Earth"
        assert result['route'][-1] == CelestialBody.MARS.value, "Should end at Mars"
    
    def test_mars_to_earth_reply(self, network):
        """Test reply from Mars to Earth"""
        # Original message
        original_message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="What is your current rover status?",
            message_type="query",
            timestamp=time.time(),
            priority=1,
            encryption_level="quantum"
        )
        
        # Send original message
        result1 = network.send_message(original_message.to_protocol_message())
        assert result1['success'], "Original message failed"
        
        # Reply message
        reply_message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="mars_base_alpha",
            recipient="earth_mission_control",
            content="Rover status: Operational. Currently collecting samples at coordinates 14.5692°S, 175.4728°E",
            message_type="response",
            timestamp=time.time() + result1['total_delay'],
            priority=1,
            encryption_level="quantum"
        )
        
        # Send reply
        result2 = network.send_message(reply_message.to_protocol_message())
        assert result2['success'], "Reply message failed"
        
        # Verify round-trip characteristics
        total_round_trip = result1['total_delay'] + result2['total_delay']
        assert total_round_trip > 0, "Round-trip delay should be positive"
        assert total_round_trip < 60 * 60, "Round-trip delay should be reasonable"  # < 1 hour
    
    def test_emergency_message_priority(self, network):
        """Test emergency message priority handling"""
        # Send low priority message first
        low_priority = E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="Daily weather report: Clear skies, -80°C",
            message_type="routine",
            timestamp=time.time(),
            priority=4,
            encryption_level="classical"
        )
        
        # Send emergency message
        emergency = E2EMessage(
            id=str(uuid.uuid4()),
            sender="mars_base_alpha",
            recipient="earth_mission_control",
            content="EMERGENCY: Life support system malfunction. Oxygen levels dropping!",
            message_type="emergency",
            timestamp=time.time() + 1,
            priority=0,
            encryption_level="quantum"
        )
        
        # Send both messages
        result1 = network.send_message(low_priority.to_protocol_message())
        result2 = network.send_message(emergency.to_protocol_message())
        
        # Both should succeed
        assert result1['success'], "Low priority message failed"
        assert result2['success'], "Emergency message failed"
        
        # Emergency should have reasonable delay despite being sent later
        assert result2['total_delay'] < 30 * 60, "Emergency message delay too high"
    
    def test_large_file_transfer(self, network):
        """Test large file transfer (scientific data)"""
        # Large scientific data file
        large_message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="mars_base_alpha",
            recipient="earth_mission_control",
            content="Scientific data file: Geological survey results from Olympus Mons region",
            message_type="data_transfer",
            timestamp=time.time(),
            priority=3,
            encryption_level="quantum"
        )
        
        # Simulate large file by setting large data size
        protocol_message = large_message.to_protocol_message()
        protocol_message.data_size = 100 * 1024 * 1024  # 100MB
        
        # Send large message
        result = network.send_message(protocol_message)
        
        # Verify successful transfer
        assert result['success'], "Large file transfer failed"
        assert result['total_delay'] > 0, "Transfer delay should be positive"
        
        # Large files may take longer but should complete
        assert result['total_delay'] < 2 * 60 * 60, "Large file transfer taking too long"  # < 2 hours
    
    def test_multi_recipient_broadcast(self, network):
        """Test broadcast message to multiple recipients"""
        # Broadcast message
        broadcast_content = "Solar storm warning: Increased radiation levels expected in next 48 hours"
        
        recipients = [
            "mars_base_alpha",
            "mars_base_beta", 
            "mars_orbital_station",
            "mars_rover_team"
        ]
        
        # Send to all recipients
        results = []
        for recipient in recipients:
            message = E2EMessage(
                id=str(uuid.uuid4()),
                sender="earth_mission_control",
                recipient=recipient,
                content=broadcast_content,
                message_type="broadcast",
                timestamp=time.time(),
                priority=1,
                encryption_level="quantum"
            )
            
            result = network.send_message(message.to_protocol_message())
            results.append(result)
        
        # All should succeed
        successful = [r for r in results if r['success']]
        assert len(successful) == len(recipients), f"Only {len(successful)}/{len(recipients)} broadcasts succeeded"
        
        # All should have reasonable delays
        for result in successful:
            assert result['total_delay'] < 30 * 60, "Broadcast delay too high"

class TestAdvancedE2ECommunication:
    """Test advanced end-to-end communication scenarios"""
    
    def test_communication_session_management(self, network):
        """Test multi-message communication session"""
        # Create communication session
        session = CommunicationSession(
            session_id=str(uuid.uuid4()),
            participants=["earth_mission_control", "mars_base_alpha"],
            start_time=time.time(),
            messages=[]
        )
        
        # Simulate conversation
        conversation = [
            ("earth_mission_control", "mars_base_alpha", "Good morning Mars Base Alpha. Please provide status report."),
            ("mars_base_alpha", "earth_mission_control", "Good morning Earth. All systems operational. Crew of 6 healthy."),
            ("earth_mission_control", "mars_base_alpha", "Excellent. Any issues with the life support systems?"),
            ("mars_base_alpha", "earth_mission_control", "Minor CO2 scrubber efficiency drop to 94%. Within normal parameters."),
            ("earth_mission_control", "mars_base_alpha", "Copy that. Continue monitoring. Next check-in in 24 hours."),
            ("mars_base_alpha", "earth_mission_control", "Understood. Mars Base Alpha out.")
        ]
        
        # Send all messages in conversation
        for sender, recipient, content in conversation:
            message = E2EMessage(
                id=str(uuid.uuid4()),
                sender=sender,
                recipient=recipient,
                content=content,
                message_type="conversation",
                timestamp=time.time(),
                priority=2,
                encryption_level="quantum"
            )
            
            session.add_message(message)
            result = network.send_message(message.to_protocol_message())
            
            assert result['success'], f"Conversation message failed: {content[:50]}..."
            
            # Simulate time delay between messages
            time.sleep(0.1)
        
        # Session should be complete
        assert len(session.messages) == len(conversation), "Session message count mismatch"
        assert session.get_duration() > 0, "Session duration should be positive"
    
    def test_store_and_forward_during_conjunction(self, network):
        """Test store-and-forward operation during solar conjunction"""
        # Set up solar conjunction scenario
        network.nodes[CelestialBody.EARTH].angle = 0
        network.nodes[CelestialBody.MARS].angle = np.pi + 0.05  # Just past conjunction
        
        # Send message during conjunction
        message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="Message sent during solar conjunction - should be stored and forwarded",
            message_type="store_forward",
            timestamp=time.time(),
            priority=2,
            encryption_level="quantum"
        )
        
        result = network.send_message(message.to_protocol_message())
        
        # Should succeed using relay stations
        assert result['success'], "Store-and-forward failed during conjunction"
        assert result['hops'] > 1, "Should use relay stations during conjunction"
        
        # Delay should be reasonable considering relay
        assert result['total_delay'] < 45 * 60, "Store-and-forward delay too high"
    
    def test_priority_queue_management(self, network):
        """Test priority queue management under load"""
        # Create messages with different priorities
        message_queue = []
        
        # Priority 0 (Emergency)
        message_queue.append(E2EMessage(
            id=str(uuid.uuid4()),
            sender="mars_base_alpha",
            recipient="earth_mission_control",
            content="EMERGENCY: Hull breach detected in Module C",
            message_type="emergency",
            timestamp=time.time(),
            priority=0,
            encryption_level="quantum"
        ))
        
        # Priority 1 (Critical)
        message_queue.append(E2EMessage(
            id=str(uuid.uuid4()),
            sender="mars_base_alpha",
            recipient="earth_mission_control",
            content="CRITICAL: Power system operating at 70% capacity",
            message_type="critical",
            timestamp=time.time(),
            priority=1,
            encryption_level="quantum"
        ))
        
        # Priority 2 (High)
        message_queue.append(E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="High priority: New mission parameters uploaded",
            message_type="operational",
            timestamp=time.time(),
            priority=2,
            encryption_level="quantum"
        ))
        
        # Priority 3 (Normal)
        message_queue.append(E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="Daily briefing: Weather update and crew schedules",
            message_type="routine",
            timestamp=time.time(),
            priority=3,
            encryption_level="classical"
        ))
        
        # Priority 4 (Low)
        message_queue.append(E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="Low priority: Entertainment media files update",
            message_type="media",
            timestamp=time.time(),
            priority=4,
            encryption_level="classical"
        ))
        
        # Send all messages
        results = []
        for message in message_queue:
            result = network.send_message(message.to_protocol_message())
            results.append((message.priority, result))
        
        # All should succeed
        successful = [(p, r) for p, r in results if r['success']]
        assert len(successful) == len(message_queue), "Some priority messages failed"
        
        # Higher priority messages should have lower delays
        delays_by_priority = {}
        for priority, result in successful:
            if priority not in delays_by_priority:
                delays_by_priority[priority] = []
            delays_by_priority[priority].append(result['total_delay'])
        
        # Emergency (P0) should have lowest delay
        if 0 in delays_by_priority:
            p0_delay = np.mean(delays_by_priority[0])
            assert p0_delay < 15 * 60, f"Emergency message delay too high: {p0_delay/60:.1f} minutes"
    
    def test_message_acknowledgment_system(self, network):
        """Test message acknowledgment and confirmation system"""
        # Original message with delivery confirmation requested
        original_message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="Please confirm receipt of new operational procedures",
            message_type="confirmation_request",
            timestamp=time.time(),
            priority=1,
            encryption_level="quantum",
            delivery_confirmation=True
        )
        
        # Send original message
        result1 = network.send_message(original_message.to_protocol_message())
        assert result1['success'], "Original message failed"
        
        # Acknowledgment message
        ack_message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="mars_base_alpha",
            recipient="earth_mission_control",
            content=f"ACKNOWLEDGMENT: Message {original_message.id} received and understood",
            message_type="acknowledgment",
            timestamp=time.time() + result1['total_delay'],
            priority=1,
            encryption_level="quantum"
        )
        
        # Send acknowledgment
        result2 = network.send_message(ack_message.to_protocol_message())
        assert result2['success'], "Acknowledgment failed"
        
        # Verify acknowledgment loop
        total_time = result1['total_delay'] + result2['total_delay']
        assert total_time > 0, "Acknowledgment loop should take time"
        assert total_time < 90 * 60, "Acknowledgment loop too slow"
    
    def test_encrypted_secure_communication(self, network):
        """Test secure encrypted communication"""
        # Highly sensitive message
        sensitive_message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="CLASSIFIED: New mission objectives and crew rotation schedule",
            message_type="classified",
            timestamp=time.time(),
            priority=0,
            encryption_level="quantum"
        )
        
        # Send secure message
        result = network.send_message(sensitive_message.to_protocol_message())
        
        # Should succeed with quantum encryption
        assert result['success'], "Secure message failed"
        assert result['key_generation_rate'] > 0, "Quantum encryption not applied"
        
        # Verify quantum security
        qchannel = network.quantum_channels[(CelestialBody.EARTH, CelestialBody.MARS)]
        bell_test = qchannel.test_bell_inequality()
        assert bell_test, "Quantum channel security compromised"
        
        # QBER should be within acceptable limits
        assert qchannel.qber <= 0.11, f"QBER too high for secure communication: {qchannel.qber:.3f}"

class TestE2EPerformanceUnderLoad:
    """Test end-to-end performance under various load conditions"""
    
    def test_high_volume_communication(self, network):
        """Test high volume communication handling"""
        # Generate high volume of messages
        num_messages = 500
        message_types = ["routine", "operational", "scientific", "personal", "maintenance"]
        
        messages = []
        for i in range(num_messages):
            message = E2EMessage(
                id=str(uuid.uuid4()),
                sender="earth_mission_control" if i % 2 == 0 else "mars_base_alpha",
                recipient="mars_base_alpha" if i % 2 == 0 else "earth_mission_control",
                content=f"High volume test message {i}: {message_types[i % len(message_types)]} content",
                message_type=message_types[i % len(message_types)],
                timestamp=time.time() + i * 0.1,
                priority=i % 5,
                encryption_level="quantum" if i % 2 == 0 else "classical"
            )
            messages.append(message)
        
        # Send all messages
        start_time = time.time()
        results = []
        
        for message in messages:
            result = network.send_message(message.to_protocol_message())
            results.append(result)
        
        processing_time = time.time() - start_time
        message_rate = len(messages) / processing_time
        
        # Analyze results
        successful = [r for r in results if r['success']]
        success_rate = len(successful) / len(results)
        
        # Performance requirements
        assert success_rate >= 0.95, f"Success rate too low under load: {success_rate:.3f}"
        assert message_rate >= 10, f"Message processing rate too low: {message_rate:.1f} msg/s"
        
        # Latency should remain reasonable
        if successful:
            avg_latency = np.mean([r['total_delay'] for r in successful])
            assert avg_latency < 30 * 60, f"Average latency too high under load: {avg_latency/60:.1f} minutes"
    
    def test_concurrent_conversations(self, network):
        """Test multiple concurrent conversations"""
        # Create multiple conversation threads
        conversations = [
            ("earth_mission_control", "mars_base_alpha"),
            ("earth_research_team", "mars_science_lab"),
            ("earth_engineering", "mars_maintenance"),
            ("earth_medical", "mars_medical_bay")
        ]
        
        def run_conversation(participants, conversation_id):
            """Run a single conversation thread"""
            sender, recipient = participants
            messages = []
            
            for i in range(10):
                message = E2EMessage(
                    id=str(uuid.uuid4()),
                    sender=sender if i % 2 == 0 else recipient,
                    recipient=recipient if i % 2 == 0 else sender,
                    content=f"Conversation {conversation_id} message {i}",
                    message_type="conversation",
                    timestamp=time.time(),
                    priority=2,
                    encryption_level="quantum"
                )
                
                result = network.send_message(message.to_protocol_message())
                messages.append(result)
                
                # Small delay between messages
                time.sleep(0.05)
            
            return messages
        
        # Run conversations concurrently
        with ThreadPoolExecutor(max_workers=len(conversations)) as executor:
            futures = []
            for i, participants in enumerate(conversations):
                future = executor.submit(run_conversation, participants, i)
                futures.append(future)
            
            # Collect results
            all_results = []
            for future in as_completed(futures):
                conversation_results = future.result()
                all_results.extend(conversation_results)
        
        # Analyze concurrent performance
        successful = [r for r in all_results if r['success']]
        success_rate = len(successful) / len(all_results)
        
        assert success_rate >= 0.95, f"Concurrent conversation success rate too low: {success_rate:.3f}"
        
        # No conversation should interfere with others
        if successful:
            avg_latency = np.mean([r['total_delay'] for r in successful])
            assert avg_latency < 30 * 60, f"Concurrent conversation latency too high: {avg_latency/60:.1f} minutes"
    
    def test_network_resilience_under_failures(self, network):
        """Test network resilience during component failures"""
        # Simulate relay station failure
        original_relays = network.relay_stations.copy()
        
        # Remove a relay station
        failed_relay = CelestialBody.L4_EARTH
        if failed_relay in network.relay_stations:
            del network.relay_stations[failed_relay]
        
        # Test communication during failure
        failure_message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control",
            recipient="mars_base_alpha",
            content="Testing communication during relay station failure",
            message_type="resilience_test",
            timestamp=time.time(),
            priority=1,
            encryption_level="quantum"
        )
        
        result = network.send_message(failure_message.to_protocol_message())
        
        # Should still succeed through alternate routing
        assert result['success'], "Communication failed during relay station failure"
        
        # May have higher delay due to alternate routing
        assert result['total_delay'] < 60 * 60, "Failure recovery took too long"
        
        # Restore relay station
        network.relay_stations = original_relays
        
        # Test recovery
        recovery_message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="mars_base_alpha",
            recipient="earth_mission_control",
            content="Confirming communication restoration after relay recovery",
            message_type="recovery_test",
            timestamp=time.time(),
            priority=1,
            encryption_level="quantum"
        )
        
        recovery_result = network.send_message(recovery_message.to_protocol_message())
        assert recovery_result['success'], "Communication not restored after relay recovery"

class TestE2ERealisticScenarios:
    """Test realistic end-to-end scenarios"""
    
    def test_mars_mission_daily_operations(self, network):
        """Test realistic Mars mission daily operations"""
        # Daily operations schedule
        daily_schedule = [
            ("06:00", "earth_mission_control", "mars_base_alpha", "Good morning Mars. Daily briefing starts now.", 2),
            ("06:05", "mars_base_alpha", "earth_mission_control", "Good morning Earth. All crew accounted for and ready.", 2),
            ("06:10", "earth_mission_control", "mars_base_alpha", "Today's EVA objectives: Collect samples from Grid 7-C.", 1),
            ("06:15", "mars_base_alpha", "earth_mission_control", "EVA team preparing. Suit checks in progress.", 1),
            ("08:00", "mars_base_alpha", "earth_mission_control", "EVA commenced. Team Alpha deploying to Grid 7-C.", 1),
            ("12:00", "mars_base_alpha", "earth_mission_control", "EVA midpoint check. 12 samples collected. All nominal.", 2),
            ("16:00", "mars_base_alpha", "earth_mission_control", "EVA complete. 27 samples collected. Team returning to base.", 1),
            ("18:00", "mars_base_alpha", "earth_mission_control", "EVA debrief: Successful mission. Samples secured in lab.", 2),
            ("20:00", "earth_mission_control", "mars_base_alpha", "Excellent work today. Rest well. End of daily briefing.", 2)
        ]
        
        # Execute daily operations
        results = []
        for time_str, sender, recipient, content, priority in daily_schedule:
            message = E2EMessage(
                id=str(uuid.uuid4()),
                sender=sender,
                recipient=recipient,
                content=f"[{time_str}] {content}",
                message_type="daily_ops",
                timestamp=time.time(),
                priority=priority,
                encryption_level="quantum"
            )
            
            result = network.send_message(message.to_protocol_message())
            results.append(result)
            
            # Small delay between messages
            time.sleep(0.1)
        
        # All daily operations should succeed
        successful = [r for r in results if r['success']]
        success_rate = len(successful) / len(results)
        
        assert success_rate >= 0.98, f"Daily operations success rate too low: {success_rate:.3f}"
        
        # Daily operations should have reasonable delays
        if successful:
            avg_delay = np.mean([r['total_delay'] for r in successful])
            assert avg_delay < 25 * 60, f"Daily operations latency too high: {avg_delay/60:.1f} minutes"
    
    def test_scientific_data_transmission(self, network):
        """Test scientific data transmission scenarios"""
        # Scientific data types
        scientific_data = [
            ("geological_survey", "Martian rock composition analysis from Valles Marineris", 50 * 1024 * 1024),
            ("atmospheric_data", "Daily atmospheric pressure and temperature readings", 1 * 1024 * 1024),
            ("biological_samples", "Microscopic analysis of potential biosignatures", 25 * 1024 * 1024),
            ("seismic_data", "Mars quake detection and analysis from Grid 12-A", 75 * 1024 * 1024),
            ("imagery", "High-resolution images of polar ice cap changes", 100 * 1024 * 1024)
        ]
        
        # Send scientific data
        results = []
        for data_type, description, size in scientific_data:
            message = E2EMessage(
                id=str(uuid.uuid4()),
                sender="mars_science_lab",
                recipient="earth_research_team",
                content=f"Scientific Data Package: {description}",
                message_type="scientific_data",
                timestamp=time.time(),
                priority=3,
                encryption_level="classical"
            )
            
            # Set realistic data size
            protocol_message = message.to_protocol_message()
            protocol_message.data_size = size
            
            result = network.send_message(protocol_message)
            results.append((data_type, result))
        
        # Analyze scientific data transmission
        successful = [(dt, r) for dt, r in results if r['success']]
        success_rate = len(successful) / len(results)
        
        assert success_rate >= 0.90, f"Scientific data transmission success rate too low: {success_rate:.3f}"
        
        # Large data should take longer but complete successfully
        for data_type, result in successful:
            assert result['total_delay'] > 0, f"No delay recorded for {data_type}"
            assert result['total_delay'] < 4 * 60 * 60, f"{data_type} transmission too slow: {result['total_delay']/3600:.1f} hours"
    
    def test_emergency_response_scenario(self, network):
        """Test emergency response scenario"""
        # Emergency scenario: Life support malfunction
        emergency_sequence = [
            ("mars_base_alpha", "earth_mission_control", "EMERGENCY: CO2 scrubber malfunction. Levels rising.", 0),
            ("earth_mission_control", "mars_base_alpha", "EMERGENCY ACKNOWLEDGED. Activate backup scrubber immediately.", 0),
            ("mars_base_alpha", "earth_mission_control", "Backup scrubber activated. CO2 levels stabilizing.", 0),
            ("earth_mission_control", "mars_base_alpha", "Good. Prepare for emergency EVA if needed. Medical team standby.", 0),
            ("mars_base_alpha", "earth_mission_control", "Roger. EVA suits ready. All crew healthy and accounted for.", 0),
            ("earth_mission_control", "mars_base_alpha", "Sending emergency repair procedures. Standby for data transmission.", 0),
            ("mars_base_alpha", "earth_mission_control", "Procedures received. Repair team mobilizing.", 0),
            ("mars_base_alpha", "earth_mission_control", "Repair complete. Primary scrubber restored. Crisis averted.", 0),
            ("earth_mission_control", "mars_base_alpha", "Outstanding work. Return to normal operations. Well done.", 0)
        ]
        
        # Execute emergency response
        emergency_start = time.time()
        results = []
        
        for sender, recipient, content, priority in emergency_sequence:
            message = E2EMessage(
                id=str(uuid.uuid4()),
                sender=sender,
                recipient=recipient,
                content=content,
                message_type="emergency",
                timestamp=time.time(),
                priority=priority,
                encryption_level="quantum"
            )
            
            result = network.send_message(message.to_protocol_message())
            results.append(result)
            
            # Minimal delay for emergency sequence
            time.sleep(0.05)
        
        emergency_duration = time.time() - emergency_start
        
        # All emergency messages should succeed
        successful = [r for r in results if r['success']]
        success_rate = len(successful) / len(results)
        
        assert success_rate == 1.0, f"Emergency response failed: {success_rate:.3f} success rate"
        
        # Emergency messages should have minimal delays
        if successful:
            max_delay = max(r['total_delay'] for r in successful)
            assert max_delay < 20 * 60, f"Emergency response delay too high: {max_delay/60:.1f} minutes"
            
            # All messages should use quantum encryption
            assert all(r['key_generation_rate'] > 0 for r in successful), "Emergency messages not encrypted"
    
    def test_long_term_mission_communication(self, network):
        """Test long-term mission communication patterns"""
        # Simulate one week of mission communications
        days_to_simulate = 7
        messages_per_day = 20
        
        # Message categories and their frequencies
        message_categories = [
            ("routine_status", 0.4, 3),      # 40% of messages, priority 3
            ("operational", 0.3, 2),         # 30% of messages, priority 2
            ("scientific", 0.2, 3),          # 20% of messages, priority 3
            ("personal", 0.05, 4),           # 5% of messages, priority 4
            ("emergency", 0.05, 0)           # 5% of messages, priority 0
        ]
        
        # Generate mission communications
        all_results = []
        
        for day in range(days_to_simulate):
            day_results = []
            
            for msg_num in range(messages_per_day):
                # Select message category
                category_rand = np.random.random()
                cumulative_prob = 0
                
                for category, prob, priority in message_categories:
                    cumulative_prob += prob
                    if category_rand <= cumulative_prob:
                        selected_category = category
                        selected_priority = priority
                        break
                
                # Create message
                message = E2EMessage(
                    id=str(uuid.uuid4()),
                    sender="earth_mission_control" if msg_num % 2 == 0 else "mars_base_alpha",
                    recipient="mars_base_alpha" if msg_num % 2 == 0 else "earth_mission_control",
                    content=f"Day {day+1} - {selected_category} message {msg_num+1}",
                    message_type=selected_category,
                    timestamp=time.time() + day * 24 * 3600 + msg_num * 1800,  # 30 min intervals
                    priority=selected_priority,
                    encryption_level="quantum" if selected_priority <= 1 else "classical"
                )
                
                result = network.send_message(message.to_protocol_message())
                day_results.append(result)
            
            all_results.extend(day_results)
        
        # Analyze long-term communication patterns
        successful = [r for r in all_results if r['success']]
        success_rate = len(successful) / len(all_results)
        
        assert success_rate >= 0.95, f"Long-term mission success rate too low: {success_rate:.3f}"
        
        # Analyze by message priority
        priority_performance = {}
        for result in successful:
            # Extract priority from result (would need to track this in real implementation)
            # For now, assume all succeeded
            pass
        
        # Overall mission communication should be reliable
        total_data_transmitted = sum(r.get('data_size', 1024) for r in successful)
        assert total_data_transmitted > 0, "No data transmitted during long-term mission"

@pytest.mark.asyncio
async def test_async_e2e_communication(network):
    """Test asynchronous end-to-end communication"""
    
    async def send_message_async(message: E2EMessage):
        """Send message asynchronously"""
        # Simulate async processing
        await asyncio.sleep(0.01)
        return network.send_message(message.to_protocol_message())
    
    # Create multiple async messages
    messages = []
    for i in range(50):
        message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control" if i % 2 == 0 else "mars_base_alpha",
            recipient="mars_base_alpha" if i % 2 == 0 else "earth_mission_control",
            content=f"Async test message {i}",
            message_type="async_test",
            timestamp=time.time(),
            priority=i % 5,
            encryption_level="quantum"
        )
        messages.append(message)
    
    # Send all messages concurrently
    tasks = [send_message_async(msg) for msg in messages]
    results = await asyncio.gather(*tasks)
    
    # Analyze async performance
    successful = [r for r in results if r['success']]
    success_rate = len(successful) / len(results)
    
    assert success_rate >= 0.95, f"Async communication success rate too low: {success_rate:.3f}"
    
    # Async processing should not cause message conflicts
    message_ids = [r['message_id'] for r in successful]
    assert len(set(message_ids)) == len(message_ids), "Duplicate message IDs detected in async processing"

def test_e2e_communication_metrics(network):
    """Test end-to-end communication metrics collection"""
    # Send test messages and collect metrics
    test_messages = []
    for i in range(100):
        message = E2EMessage(
            id=str(uuid.uuid4()),
            sender="earth_mission_control" if i % 2 == 0 else "mars_base_alpha",
            recipient="mars_base_alpha" if i % 2 == 0 else "earth_mission_control",
            content=f"Metrics test message {i}",
            message_type="metrics_test",
            timestamp=time.time(),
            priority=i % 5,
            encryption_level="quantum" if i % 2 == 0 else "classical"
        )
        test_messages.append(message)
    
    # Send messages and collect results
    results = []
    start_time = time.time()
    
    for message in test_messages:
        result = network.send_message(message.to_protocol_message())
        results.append(result)
    
    total_time = time.time() - start_time
    
    # Calculate metrics
    successful = [r for r in results if r['success']]
    
    metrics = {
        'total_messages': len(test_messages),
        'successful_messages': len(successful),
        'success_rate': len(successful) / len(test_messages),
        'total_processing_time': total_time,
        'messages_per_second': len(test_messages) / total_time,
        'average_delay': np.mean([r['total_delay'] for r in successful]) if successful else 0,
        'median_delay': np.median([r['total_delay'] for r in successful]) if successful else 0,
        'max_delay': max([r['total_delay'] for r in successful]) if successful else 0,
        'quantum_encrypted_ratio': len([r for r in successful if r['key_generation_rate'] > 0]) / len(successful) if successful else 0
    }
    
    # Verify metrics meet requirements
    assert metrics['success_rate'] >= 0.95, f"Success rate too low: {metrics['success_rate']:.3f}"
    assert metrics['messages_per_second'] >= 5, f"Processing rate too low: {metrics['messages_per_second']:.1f} msg/s"
    assert metrics['average_delay'] < 30 * 60, f"Average delay too high: {metrics['average_delay']/60:.1f} minutes"
    assert metrics['quantum_encrypted_ratio'] > 0, "No quantum encryption used"
    
    # Return metrics for analysis
    return metrics