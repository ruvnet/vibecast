#!/usr/bin/env python3
"""
Adaptive Latency Protocols for Interplanetary Communication
Implements dynamic protocol adaptation for variable round-trip times
"""

import asyncio
import time
import math
import numpy as np
from typing import Dict, List, Optional, Tuple, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import deque, defaultdict
import logging
import json

class LatencyProfile(Enum):
    """Communication latency profiles"""
    NEAR_REAL_TIME = "near_real_time"      # < 1 second (Earth-Moon)
    INTERACTIVE = "interactive"            # 1-60 seconds
    DELAYED_INTERACTIVE = "delayed_interactive"  # 1-30 minutes
    STORE_AND_FORWARD = "store_and_forward"  # > 30 minutes
    OPPORTUNISTIC = "opportunistic"        # Variable, opportunistic

class ProtocolMode(Enum):
    """Adaptive protocol modes"""
    REAL_TIME = "real_time"
    BURST = "burst"
    STREAMING = "streaming"
    BATCH = "batch"
    HYBRID = "hybrid"

class CongestionState(Enum):
    """Network congestion states"""
    CLEAR = "clear"
    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"
    CONGESTED = "congested"

@dataclass
class LatencyMeasurement:
    """Latency measurement record"""
    timestamp: float
    source: str
    destination: str
    round_trip_time: float
    one_way_latency: float
    jitter: float
    packet_loss: float
    bandwidth: float
    congestion_level: float

@dataclass
class ProtocolParameters:
    """Adaptive protocol parameters"""
    mode: ProtocolMode
    window_size: int
    timeout: float
    retry_attempts: int
    packet_size: int
    burst_size: int
    flow_control: bool
    congestion_control: bool
    priority_queueing: bool
    
    # Adaptive parameters
    adaptation_interval: float = 30.0  # seconds
    min_window_size: int = 1
    max_window_size: int = 1000
    min_timeout: float = 1.0
    max_timeout: float = 3600.0

@dataclass
class CommunicationSession:
    """Active communication session"""
    session_id: str
    source: str
    destination: str
    created_time: float
    last_activity: float
    protocol_params: ProtocolParameters
    statistics: Dict[str, Any] = field(default_factory=dict)
    
    # Adaptive state
    current_rtt: float = 0.0
    rtt_history: deque = field(default_factory=lambda: deque(maxlen=100))
    throughput_history: deque = field(default_factory=lambda: deque(maxlen=100))
    error_history: deque = field(default_factory=lambda: deque(maxlen=100))

class AdaptiveLatencyManager:
    """Adaptive latency management system"""
    
    def __init__(self):
        self.latency_measurements: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.protocol_configurations: Dict[str, ProtocolParameters] = {}
        self.active_sessions: Dict[str, CommunicationSession] = {}
        
        # Adaptation algorithms
        self.rtt_estimator = RTTEstimator()
        self.congestion_detector = CongestionDetector()
        self.protocol_optimizer = ProtocolOptimizer()
        
        # Orbital mechanics predictor
        self.orbital_predictor = OrbitalLatencyPredictor()
        
        self.logger = logging.getLogger("adaptive_latency")
    
    def add_latency_measurement(self, measurement: LatencyMeasurement) -> None:
        """Add new latency measurement"""
        route_key = f"{measurement.source}_{measurement.destination}"
        self.latency_measurements[route_key].append(measurement)
        
        # Update RTT estimator
        self.rtt_estimator.update_rtt(route_key, measurement.round_trip_time)
        
        # Update congestion detector
        self.congestion_detector.update_metrics(
            route_key, measurement.packet_loss, measurement.congestion_level
        )
        
        self.logger.debug(f"Added latency measurement: {route_key} RTT={measurement.round_trip_time:.2f}s")
    
    def get_latency_profile(self, source: str, destination: str) -> LatencyProfile:
        """Determine latency profile for route"""
        route_key = f"{source}_{destination}"
        
        if route_key not in self.latency_measurements:
            return LatencyProfile.INTERACTIVE  # Default
        
        measurements = self.latency_measurements[route_key]
        if not measurements:
            return LatencyProfile.INTERACTIVE
        
        # Calculate average RTT
        avg_rtt = np.mean([m.round_trip_time for m in measurements])
        
        # Classify latency profile
        if avg_rtt < 1.0:
            return LatencyProfile.NEAR_REAL_TIME
        elif avg_rtt < 60.0:
            return LatencyProfile.INTERACTIVE
        elif avg_rtt < 1800.0:  # 30 minutes
            return LatencyProfile.DELAYED_INTERACTIVE
        else:
            return LatencyProfile.STORE_AND_FORWARD
    
    async def create_adaptive_session(self, source: str, destination: str) -> str:
        """Create new adaptive communication session"""
        session_id = f"{source}_{destination}_{int(time.time())}"
        
        # Determine initial protocol parameters
        latency_profile = self.get_latency_profile(source, destination)
        protocol_params = await self._get_optimal_protocol_params(source, destination, latency_profile)
        
        # Create session
        session = CommunicationSession(
            session_id=session_id,
            source=source,
            destination=destination,
            created_time=time.time(),
            last_activity=time.time(),
            protocol_params=protocol_params
        )
        
        self.active_sessions[session_id] = session
        
        # Start adaptation loop
        asyncio.create_task(self._adaptation_loop(session_id))
        
        self.logger.info(f"Created adaptive session: {session_id}")
        return session_id
    
    async def _get_optimal_protocol_params(self, source: str, destination: str, 
                                         latency_profile: LatencyProfile) -> ProtocolParameters:
        """Get optimal protocol parameters for latency profile"""
        route_key = f"{source}_{destination}"
        
        # Get current RTT estimate
        current_rtt = self.rtt_estimator.get_rtt_estimate(route_key)
        
        # Get congestion state
        congestion_state = self.congestion_detector.get_congestion_state(route_key)
        
        # Base parameters by latency profile
        if latency_profile == LatencyProfile.NEAR_REAL_TIME:
            base_params = ProtocolParameters(
                mode=ProtocolMode.REAL_TIME,
                window_size=10,
                timeout=current_rtt * 2,
                retry_attempts=3,
                packet_size=1500,
                burst_size=1,
                flow_control=True,
                congestion_control=True,
                priority_queueing=True
            )
        
        elif latency_profile == LatencyProfile.INTERACTIVE:
            base_params = ProtocolParameters(
                mode=ProtocolMode.STREAMING,
                window_size=min(100, max(1, int(current_rtt * 10))),
                timeout=current_rtt * 3,
                retry_attempts=5,
                packet_size=9000,  # Jumbo frames
                burst_size=10,
                flow_control=True,
                congestion_control=True,
                priority_queueing=True
            )
        
        elif latency_profile == LatencyProfile.DELAYED_INTERACTIVE:
            base_params = ProtocolParameters(
                mode=ProtocolMode.BURST,
                window_size=min(1000, max(10, int(current_rtt * 5))),
                timeout=current_rtt * 2,
                retry_attempts=3,
                packet_size=65536,  # Large packets
                burst_size=100,
                flow_control=False,
                congestion_control=False,
                priority_queueing=True
            )
        
        else:  # STORE_AND_FORWARD
            base_params = ProtocolParameters(
                mode=ProtocolMode.BATCH,
                window_size=10000,
                timeout=current_rtt * 1.5,
                retry_attempts=10,
                packet_size=1048576,  # 1MB packets
                burst_size=1000,
                flow_control=False,
                congestion_control=False,
                priority_queueing=False
            )
        
        # Adjust for congestion
        if congestion_state in [CongestionState.HEAVY, CongestionState.CONGESTED]:
            base_params.window_size = max(1, base_params.window_size // 2)
            base_params.timeout *= 2
            base_params.congestion_control = True
        
        return base_params
    
    async def _adaptation_loop(self, session_id: str) -> None:
        """Continuous adaptation loop for session"""
        while session_id in self.active_sessions:
            try:
                session = self.active_sessions[session_id]
                
                # Check if session is still active
                if time.time() - session.last_activity > 3600:  # 1 hour timeout
                    await self._close_session(session_id)
                    break
                
                # Perform adaptation
                await self._adapt_session_parameters(session)
                
                # Sleep based on adaptation interval
                await asyncio.sleep(session.protocol_params.adaptation_interval)
                
            except Exception as e:
                self.logger.error(f"Adaptation loop error for session {session_id}: {e}")
                await asyncio.sleep(60)  # Retry in 1 minute
    
    async def _adapt_session_parameters(self, session: CommunicationSession) -> None:
        """Adapt session parameters based on current conditions"""
        route_key = f"{session.source}_{session.destination}"
        
        # Get current metrics
        current_rtt = self.rtt_estimator.get_rtt_estimate(route_key)
        congestion_state = self.congestion_detector.get_congestion_state(route_key)
        
        # Update session RTT
        session.current_rtt = current_rtt
        session.rtt_history.append(current_rtt)
        
        # Predict future latency
        predicted_rtt = await self.orbital_predictor.predict_rtt(
            session.source, session.destination, time.time() + 3600
        )
        
        # Adapt parameters
        old_params = session.protocol_params
        new_params = await self._calculate_optimal_parameters(
            session, current_rtt, predicted_rtt, congestion_state
        )
        
        # Update session parameters
        session.protocol_params = new_params
        
        # Log adaptation
        if (new_params.window_size != old_params.window_size or 
            abs(new_params.timeout - old_params.timeout) > 1.0):
            self.logger.info(
                f"Adapted session {session.session_id}: "
                f"window_size {old_params.window_size}->{new_params.window_size}, "
                f"timeout {old_params.timeout:.2f}->{new_params.timeout:.2f}"
            )
    
    async def _calculate_optimal_parameters(self, session: CommunicationSession,
                                          current_rtt: float, predicted_rtt: float,
                                          congestion_state: CongestionState) -> ProtocolParameters:
        """Calculate optimal parameters using ML/optimization"""
        
        # Start with current parameters
        new_params = ProtocolParameters(**session.protocol_params.__dict__)
        
        # Adapt window size based on bandwidth-delay product
        if session.rtt_history:
            avg_rtt = np.mean(session.rtt_history)
            rtt_variance = np.var(session.rtt_history)
            
            # Bandwidth-delay product estimation
            if session.throughput_history:
                avg_throughput = np.mean(session.throughput_history)
                bdp = avg_throughput * avg_rtt
                
                # Optimal window size
                optimal_window = max(1, int(bdp / new_params.packet_size))
                
                # Smooth adaptation
                alpha = 0.1  # Smoothing factor
                new_params.window_size = int(
                    alpha * optimal_window + (1 - alpha) * new_params.window_size
                )
        
        # Adapt timeout based on RTT statistics
        if session.rtt_history:
            rtt_mean = np.mean(session.rtt_history)
            rtt_std = np.std(session.rtt_history)
            
            # Jacobson's algorithm for RTO
            new_params.timeout = rtt_mean + 4 * rtt_std
        
        # Use predicted RTT for future adaptation
        if predicted_rtt > current_rtt * 1.5:
            # Latency is increasing, be more conservative
            new_params.window_size = max(1, new_params.window_size // 2)
            new_params.timeout = predicted_rtt * 3
        
        # Congestion control
        if congestion_state == CongestionState.CONGESTED:
            new_params.window_size = max(1, new_params.window_size // 4)
            new_params.timeout *= 2
            new_params.congestion_control = True
        elif congestion_state == CongestionState.CLEAR:
            new_params.window_size = min(new_params.max_window_size, 
                                       new_params.window_size * 2)
        
        # Clamp parameters to valid ranges
        new_params.window_size = max(new_params.min_window_size, 
                                   min(new_params.max_window_size, new_params.window_size))
        new_params.timeout = max(new_params.min_timeout, 
                               min(new_params.max_timeout, new_params.timeout))
        
        return new_params
    
    async def _close_session(self, session_id: str) -> None:
        """Close adaptive session"""
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
            self.logger.info(f"Closed adaptive session: {session_id}")
    
    def get_session_parameters(self, session_id: str) -> Optional[ProtocolParameters]:
        """Get current session parameters"""
        session = self.active_sessions.get(session_id)
        return session.protocol_params if session else None
    
    def update_session_activity(self, session_id: str) -> None:
        """Update session activity timestamp"""
        if session_id in self.active_sessions:
            self.active_sessions[session_id].last_activity = time.time()
    
    def get_adaptation_statistics(self) -> Dict:
        """Get adaptation statistics"""
        stats = {
            'active_sessions': len(self.active_sessions),
            'total_measurements': sum(len(measurements) for measurements in self.latency_measurements.values()),
            'routes_monitored': len(self.latency_measurements),
            'timestamp': time.time()
        }
        
        # Session statistics
        if self.active_sessions:
            session_ages = [time.time() - s.created_time for s in self.active_sessions.values()]
            stats['average_session_age'] = np.mean(session_ages)
            stats['oldest_session_age'] = np.max(session_ages)
            
            # Protocol mode distribution
            mode_counts = defaultdict(int)
            for session in self.active_sessions.values():
                mode_counts[session.protocol_params.mode.value] += 1
            stats['protocol_mode_distribution'] = dict(mode_counts)
        
        return stats

class RTTEstimator:
    """Round-trip time estimator with smoothing"""
    
    def __init__(self):
        self.rtt_estimates: Dict[str, float] = {}
        self.rtt_variance: Dict[str, float] = {}
        self.alpha = 0.125  # Smoothing factor for RTT
        self.beta = 0.25    # Smoothing factor for variance
    
    def update_rtt(self, route_key: str, measured_rtt: float) -> None:
        """Update RTT estimate using exponential smoothing"""
        if route_key not in self.rtt_estimates:
            self.rtt_estimates[route_key] = measured_rtt
            self.rtt_variance[route_key] = measured_rtt / 2
        else:
            # Jacobson's algorithm
            error = measured_rtt - self.rtt_estimates[route_key]
            self.rtt_estimates[route_key] += self.alpha * error
            self.rtt_variance[route_key] += self.beta * (abs(error) - self.rtt_variance[route_key])
    
    def get_rtt_estimate(self, route_key: str) -> float:
        """Get current RTT estimate"""
        return self.rtt_estimates.get(route_key, 10.0)  # Default 10 seconds
    
    def get_rtt_variance(self, route_key: str) -> float:
        """Get RTT variance estimate"""
        return self.rtt_variance.get(route_key, 1.0)

class CongestionDetector:
    """Network congestion detection"""
    
    def __init__(self):
        self.packet_loss_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.congestion_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.congestion_states: Dict[str, CongestionState] = {}
    
    def update_metrics(self, route_key: str, packet_loss: float, congestion_level: float) -> None:
        """Update congestion detection metrics"""
        self.packet_loss_history[route_key].append(packet_loss)
        self.congestion_history[route_key].append(congestion_level)
        
        # Detect congestion state
        self._detect_congestion(route_key)
    
    def _detect_congestion(self, route_key: str) -> None:
        """Detect congestion state based on metrics"""
        if route_key not in self.packet_loss_history:
            return
        
        loss_history = self.packet_loss_history[route_key]
        congestion_history = self.congestion_history[route_key]
        
        if not loss_history or not congestion_history:
            return
        
        # Calculate recent averages
        recent_loss = np.mean(list(loss_history)[-10:])  # Last 10 measurements
        recent_congestion = np.mean(list(congestion_history)[-10:])
        
        # Classify congestion state
        if recent_loss > 0.1 or recent_congestion > 0.8:
            state = CongestionState.CONGESTED
        elif recent_loss > 0.05 or recent_congestion > 0.6:
            state = CongestionState.HEAVY
        elif recent_loss > 0.02 or recent_congestion > 0.4:
            state = CongestionState.MODERATE
        elif recent_loss > 0.01 or recent_congestion > 0.2:
            state = CongestionState.LIGHT
        else:
            state = CongestionState.CLEAR
        
        self.congestion_states[route_key] = state
    
    def get_congestion_state(self, route_key: str) -> CongestionState:
        """Get current congestion state"""
        return self.congestion_states.get(route_key, CongestionState.CLEAR)

class ProtocolOptimizer:
    """Protocol parameter optimization using machine learning"""
    
    def __init__(self):
        self.performance_history: List[Dict] = []
        self.optimization_weights = {
            'throughput': 0.4,
            'latency': 0.3,
            'reliability': 0.2,
            'efficiency': 0.1
        }
    
    def record_performance(self, session_id: str, params: ProtocolParameters, 
                          throughput: float, latency: float, reliability: float) -> None:
        """Record protocol performance"""
        record = {
            'timestamp': time.time(),
            'session_id': session_id,
            'params': params.__dict__,
            'throughput': throughput,
            'latency': latency,
            'reliability': reliability,
            'efficiency': throughput / max(params.window_size, 1)
        }
        
        self.performance_history.append(record)
        
        # Keep only recent history
        if len(self.performance_history) > 10000:
            self.performance_history = self.performance_history[-5000:]
    
    def optimize_parameters(self, current_params: ProtocolParameters, 
                          constraints: Dict) -> ProtocolParameters:
        """Optimize parameters using historical performance"""
        # Simple optimization based on historical performance
        # In practice, use more sophisticated ML algorithms
        
        if len(self.performance_history) < 10:
            return current_params
        
        # Find similar configurations
        similar_configs = self._find_similar_configurations(current_params)
        
        if not similar_configs:
            return current_params
        
        # Calculate performance scores
        best_config = max(similar_configs, key=lambda x: self._calculate_performance_score(x))
        
        # Create optimized parameters
        optimized_params = ProtocolParameters(**best_config['params'])
        
        # Apply constraints
        optimized_params = self._apply_constraints(optimized_params, constraints)
        
        return optimized_params
    
    def _find_similar_configurations(self, target_params: ProtocolParameters) -> List[Dict]:
        """Find similar configurations in history"""
        similar = []
        
        for record in self.performance_history[-1000:]:  # Recent history
            params = record['params']
            
            # Simple similarity metric
            similarity = 0
            if params['mode'] == target_params.mode.value:
                similarity += 1
            
            window_ratio = min(params['window_size'], target_params.window_size) / max(params['window_size'], target_params.window_size)
            similarity += window_ratio
            
            timeout_ratio = min(params['timeout'], target_params.timeout) / max(params['timeout'], target_params.timeout)
            similarity += timeout_ratio
            
            if similarity > 2.0:  # Threshold for similarity
                similar.append(record)
        
        return similar
    
    def _calculate_performance_score(self, record: Dict) -> float:
        """Calculate performance score for a record"""
        score = (
            self.optimization_weights['throughput'] * record['throughput'] +
            self.optimization_weights['latency'] * (1.0 / max(record['latency'], 0.1)) +
            self.optimization_weights['reliability'] * record['reliability'] +
            self.optimization_weights['efficiency'] * record['efficiency']
        )
        
        return score
    
    def _apply_constraints(self, params: ProtocolParameters, constraints: Dict) -> ProtocolParameters:
        """Apply constraints to parameters"""
        if 'max_window_size' in constraints:
            params.window_size = min(params.window_size, constraints['max_window_size'])
        
        if 'max_timeout' in constraints:
            params.timeout = min(params.timeout, constraints['max_timeout'])
        
        if 'min_timeout' in constraints:
            params.timeout = max(params.timeout, constraints['min_timeout'])
        
        return params

class OrbitalLatencyPredictor:
    """Orbital mechanics-based latency prediction"""
    
    def __init__(self):
        self.orbital_data: Dict[str, Dict] = {
            'earth_control': {
                'semi_major_axis': 1.0,  # AU
                'eccentricity': 0.0167,
                'orbital_period': 365.25,  # days
                'current_position': np.array([1.0, 0.0, 0.0])
            },
            'mars_colony': {
                'semi_major_axis': 1.524,  # AU
                'eccentricity': 0.0934,
                'orbital_period': 686.98,  # days
                'current_position': np.array([1.524, 0.0, 0.0])
            },
            'earth_l4_relay': {
                'semi_major_axis': 1.0,  # AU
                'eccentricity': 0.0,
                'orbital_period': 365.25,  # days
                'current_position': np.array([0.5, 0.866, 0.0])  # 60 degrees ahead
            }
        }
    
    async def predict_rtt(self, source: str, destination: str, future_time: float) -> float:
        """Predict RTT at future time using orbital mechanics"""
        if source not in self.orbital_data or destination not in self.orbital_data:
            return 600.0  # Default 10 minutes
        
        # Get orbital positions at future time
        source_pos = self._calculate_orbital_position(source, future_time)
        dest_pos = self._calculate_orbital_position(destination, future_time)
        
        # Calculate distance
        distance = np.linalg.norm(dest_pos - source_pos)  # AU
        
        # Light travel time (round trip)
        light_travel_time = distance * 2 * 499.0  # seconds per AU
        
        # Add processing delays
        processing_delay = 2.0  # seconds
        
        return light_travel_time + processing_delay
    
    def _calculate_orbital_position(self, node: str, time: float) -> np.ndarray:
        """Calculate orbital position at given time"""
        if node not in self.orbital_data:
            return np.array([0.0, 0.0, 0.0])
        
        data = self.orbital_data[node]
        
        # Simplified circular orbit calculation
        # In practice, use full Keplerian elements
        
        # Mean motion
        n = 2 * np.pi / (data['orbital_period'] * 86400)  # rad/s
        
        # Mean anomaly
        M = n * time
        
        # True anomaly (simplified, assuming circular orbit)
        nu = M
        
        # Position in orbital plane
        r = data['semi_major_axis']
        x = r * np.cos(nu)
        y = r * np.sin(nu)
        z = 0.0
        
        return np.array([x, y, z])

class LatencyAwareApplication:
    """Application layer with latency awareness"""
    
    def __init__(self, latency_manager: AdaptiveLatencyManager):
        self.latency_manager = latency_manager
        self.active_transfers: Dict[str, Dict] = {}
        self.logger = logging.getLogger("latency_aware_app")
    
    async def send_data(self, source: str, destination: str, data: bytes, 
                       priority: int = 3, timeout: Optional[float] = None) -> str:
        """Send data with latency-aware protocol selection"""
        # Create or get existing session
        session_id = await self.latency_manager.create_adaptive_session(source, destination)
        
        # Get current protocol parameters
        params = self.latency_manager.get_session_parameters(session_id)
        
        if not params:
            raise RuntimeError("Failed to get session parameters")
        
        # Adapt transfer strategy based on latency profile
        latency_profile = self.latency_manager.get_latency_profile(source, destination)
        
        transfer_id = f"transfer_{int(time.time())}_{len(data)}"
        
        # Select transfer strategy
        if latency_profile == LatencyProfile.NEAR_REAL_TIME:
            result = await self._real_time_transfer(session_id, data, params)
        elif latency_profile == LatencyProfile.INTERACTIVE:
            result = await self._interactive_transfer(session_id, data, params)
        elif latency_profile == LatencyProfile.DELAYED_INTERACTIVE:
            result = await self._burst_transfer(session_id, data, params)
        else:
            result = await self._batch_transfer(session_id, data, params)
        
        # Update session activity
        self.latency_manager.update_session_activity(session_id)
        
        self.logger.info(f"Data transfer completed: {transfer_id}")
        return transfer_id
    
    async def _real_time_transfer(self, session_id: str, data: bytes, 
                                params: ProtocolParameters) -> Dict:
        """Real-time transfer with immediate feedback"""
        # Small packets, immediate transmission
        packet_size = min(params.packet_size, 1500)
        packets = [data[i:i+packet_size] for i in range(0, len(data), packet_size)]
        
        results = {
            'packets_sent': len(packets),
            'bytes_sent': len(data),
            'start_time': time.time()
        }
        
        # Send packets with immediate ACK
        for i, packet in enumerate(packets):
            await self._send_packet_with_ack(session_id, packet, params.timeout)
            
            # Brief pause to avoid overwhelming
            await asyncio.sleep(0.001)
        
        results['end_time'] = time.time()
        results['duration'] = results['end_time'] - results['start_time']
        
        return results
    
    async def _interactive_transfer(self, session_id: str, data: bytes, 
                                  params: ProtocolParameters) -> Dict:
        """Interactive transfer with flow control"""
        # Windowed transmission
        packet_size = params.packet_size
        window_size = params.window_size
        
        packets = [data[i:i+packet_size] for i in range(0, len(data), packet_size)]
        
        results = {
            'packets_sent': len(packets),
            'bytes_sent': len(data),
            'start_time': time.time()
        }
        
        # Send packets in windows
        for i in range(0, len(packets), window_size):
            window = packets[i:i+window_size]
            
            # Send window
            send_tasks = []
            for packet in window:
                task = asyncio.create_task(self._send_packet_with_ack(session_id, packet, params.timeout))
                send_tasks.append(task)
            
            # Wait for window acknowledgments
            await asyncio.gather(*send_tasks)
            
            # Brief pause for flow control
            await asyncio.sleep(0.01)
        
        results['end_time'] = time.time()
        results['duration'] = results['end_time'] - results['start_time']
        
        return results
    
    async def _burst_transfer(self, session_id: str, data: bytes, 
                            params: ProtocolParameters) -> Dict:
        """Burst transfer for high-latency links"""
        # Large packets, minimal acknowledgments
        packet_size = max(params.packet_size, 65536)
        packets = [data[i:i+packet_size] for i in range(0, len(data), packet_size)]
        
        results = {
            'packets_sent': len(packets),
            'bytes_sent': len(data),
            'start_time': time.time()
        }
        
        # Send all packets in burst
        send_tasks = []
        for packet in packets:
            task = asyncio.create_task(self._send_packet_reliable(session_id, packet, params))
            send_tasks.append(task)
        
        # Wait for all packets to be sent
        await asyncio.gather(*send_tasks)
        
        results['end_time'] = time.time()
        results['duration'] = results['end_time'] - results['start_time']
        
        return results
    
    async def _batch_transfer(self, session_id: str, data: bytes, 
                            params: ProtocolParameters) -> Dict:
        """Batch transfer for store-and-forward"""
        # Very large packets, no flow control
        packet_size = max(params.packet_size, 1048576)  # 1MB
        packets = [data[i:i+packet_size] for i in range(0, len(data), packet_size)]
        
        results = {
            'packets_sent': len(packets),
            'bytes_sent': len(data),
            'start_time': time.time()
        }
        
        # Send all packets without waiting
        for packet in packets:
            asyncio.create_task(self._send_packet_fire_and_forget(session_id, packet))
        
        results['end_time'] = time.time()
        results['duration'] = results['end_time'] - results['start_time']
        
        return results
    
    async def _send_packet_with_ack(self, session_id: str, packet: bytes, timeout: float) -> bool:
        """Send packet with acknowledgment"""
        # Simulate packet transmission with ACK
        await asyncio.sleep(0.001)  # Transmission time
        
        # Simulate ACK wait
        await asyncio.sleep(min(timeout, 0.1))
        
        return True
    
    async def _send_packet_reliable(self, session_id: str, packet: bytes, 
                                  params: ProtocolParameters) -> bool:
        """Send packet with retries"""
        for attempt in range(params.retry_attempts):
            try:
                await asyncio.sleep(0.001)  # Transmission time
                
                # Simulate success/failure
                if np.random.random() > 0.1:  # 90% success rate
                    return True
                
            except Exception as e:
                self.logger.warning(f"Packet send attempt {attempt + 1} failed: {e}")
                await asyncio.sleep(0.1)
        
        return False
    
    async def _send_packet_fire_and_forget(self, session_id: str, packet: bytes) -> None:
        """Send packet without waiting for acknowledgment"""
        await asyncio.sleep(0.001)  # Transmission time

# Example usage and testing
async def main():
    """Example usage of adaptive latency protocols"""
    
    # Create adaptive latency manager
    latency_manager = AdaptiveLatencyManager()
    
    # Create latency-aware application
    app = LatencyAwareApplication(latency_manager)
    
    # Add some latency measurements
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
    
    # Test latency profiles
    earth_mars_profile = latency_manager.get_latency_profile("earth_control", "mars_colony")
    earth_relay_profile = latency_manager.get_latency_profile("earth_control", "earth_l4_relay")
    
    print(f"Earth-Mars latency profile: {earth_mars_profile.value}")
    print(f"Earth-Relay latency profile: {earth_relay_profile.value}")
    
    # Test adaptive data transfer
    test_data = b"Mission status update: All systems nominal. Quantum navigation locked. Proceeding to Mars orbit insertion." * 100
    
    print(f"Sending {len(test_data)} bytes from Earth to Mars...")
    
    transfer_id = await app.send_data("earth_control", "mars_colony", test_data, priority=2)
    print(f"Transfer completed: {transfer_id}")
    
    # Get adaptation statistics
    stats = latency_manager.get_adaptation_statistics()
    print(f"Adaptation statistics: {json.dumps(stats, indent=2)}")
    
    # Let adaptation run for a bit
    await asyncio.sleep(5)
    
    # Test real-time transfer
    print(f"Sending {len(test_data)} bytes from Earth to L4 relay...")
    
    transfer_id = await app.send_data("earth_control", "earth_l4_relay", test_data, priority=1)
    print(f"Transfer completed: {transfer_id}")
    
    # Final statistics
    final_stats = latency_manager.get_adaptation_statistics()
    print(f"Final adaptation statistics: {json.dumps(final_stats, indent=2)}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())