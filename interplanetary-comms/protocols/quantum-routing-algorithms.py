#!/usr/bin/env python3
"""
Quantum-Enhanced Routing Algorithms for Interplanetary Communication
Implements position-based routing with quantum navigation integration
"""

import numpy as np
import asyncio
import time
import json
import heapq
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import logging
try:
    from scipy.spatial.distance import euclidean
    from scipy.optimize import minimize
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    def euclidean(p1, p2):
        return np.sqrt(np.sum((np.array(p1) - np.array(p2))**2))
    
    def minimize(func, x0, **kwargs):
        # Simple gradient descent fallback
        return {'x': x0, 'success': True}

try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False
    # Mock NetworkX implementation
    class MockGraph:
        def __init__(self):
            self.nodes_dict = {}
            self.edges_dict = {}
            
        def add_node(self, node, **attrs):
            self.nodes_dict[node] = attrs
            
        def add_edge(self, u, v, **attrs):
            self.edges_dict[(u, v)] = attrs
            self.edges_dict[(v, u)] = attrs
            
        def edges(self, data=False):
            if data:
                return [(u, v, attrs) for (u, v), attrs in self.edges_dict.items()]
            return list(self.edges_dict.keys())
            
        def __getitem__(self, node):
            return {v: self.edges_dict.get((node, v), {}) for v in self.nodes_dict if (node, v) in self.edges_dict}
    
    class MockNetworkX:
        @staticmethod
        def Graph():
            return MockGraph()
            
        @staticmethod
        def shortest_path(graph, source, target, weight=None):
            # Simple breadth-first search
            if source == target:
                return [source]
            # For simplicity, return direct path if exists
            if (source, target) in graph.edges_dict:
                return [source, target]
            # Otherwise, try to find path through one intermediate node
            for node in graph.nodes_dict:
                if ((source, node) in graph.edges_dict and 
                    (node, target) in graph.edges_dict):
                    return [source, node, target]
            # No path found
            raise MockNetworkXNoPath()
            
    class MockNetworkXNoPath(Exception):
        pass
    
    # Create mock nx module
    if not HAS_NETWORKX:
        nx = MockNetworkX()
        nx.NetworkXNoPath = MockNetworkXNoPath
        nx.Graph = MockNetworkX.Graph
        nx.shortest_path = MockNetworkX.shortest_path

class RoutingStrategy(Enum):
    """Routing algorithm strategies"""
    SHORTEST_PATH = "shortest_path"
    MINIMUM_DELAY = "minimum_delay"
    MAXIMUM_BANDWIDTH = "maximum_bandwidth"
    LOAD_BALANCED = "load_balanced"
    QUANTUM_OPTIMIZED = "quantum_optimized"
    ADAPTIVE = "adaptive"

class NodeType(Enum):
    """Network node types"""
    PLANET = "planet"
    RELAY = "relay"
    SPACECRAFT = "spacecraft"
    ASTEROID = "asteroid"
    LAGRANGE_POINT = "lagrange_point"

@dataclass
class NetworkNode:
    """Network node with quantum navigation data"""
    node_id: str
    node_type: NodeType
    position: np.ndarray  # [x, y, z] in AU
    velocity: np.ndarray  # [vx, vy, vz] in AU/day
    quantum_accuracy: float  # Position accuracy from quantum navigation
    communication_range: float  # Maximum communication range in AU
    bandwidth_capacity: Dict[str, int]  # Bandwidth to each neighbor
    energy_level: float  # Energy level (0-1)
    last_update: float  # Last position update timestamp
    
    def __post_init__(self):
        if self.position is None:
            self.position = np.zeros(3)
        if self.velocity is None:
            self.velocity = np.zeros(3)

@dataclass
class QuantumLink:
    """Quantum-enhanced communication link"""
    source: str
    destination: str
    distance: float
    bandwidth: int
    latency: float
    reliability: float
    quantum_key_rate: float
    energy_cost: float
    congestion_level: float = 0.0
    last_used: float = 0.0
    
    def get_link_score(self, weight_bandwidth=0.3, weight_latency=0.3, 
                      weight_reliability=0.2, weight_energy=0.2) -> float:
        """Calculate composite link score"""
        # Normalize metrics (higher is better)
        norm_bandwidth = self.bandwidth / 1e9  # Normalize to Gbps
        norm_latency = 1.0 / max(self.latency, 0.1)  # Inverse latency
        norm_reliability = self.reliability
        norm_energy = 1.0 / max(self.energy_cost, 0.1)  # Inverse energy cost
        
        # Weight congestion negatively
        congestion_penalty = 1.0 - self.congestion_level
        
        score = (weight_bandwidth * norm_bandwidth +
                weight_latency * norm_latency +
                weight_reliability * norm_reliability +
                weight_energy * norm_energy) * congestion_penalty
        
        return score

@dataclass
class RoutingRequest:
    """Routing request with quantum navigation context"""
    request_id: str
    source: str
    destination: str
    data_size: int
    priority: int
    max_latency: float
    min_bandwidth: int
    quantum_security_required: bool
    timestamp: float
    source_position: np.ndarray
    destination_position: Optional[np.ndarray] = None
    
class QuantumRoutingEngine:
    """Quantum-enhanced routing engine for interplanetary networks"""
    
    def __init__(self):
        self.nodes: Dict[str, NetworkNode] = {}
        self.links: Dict[Tuple[str, str], QuantumLink] = {}
        self.topology_graph = nx.Graph()
        self.routing_cache: Dict[str, List[str]] = {}
        self.cache_ttl = 300  # 5 minutes
        self.cache_timestamps: Dict[str, float] = {}
        
        # Quantum navigation integration
        self.position_predictor = QuantumPositionPredictor()
        self.orbital_mechanics = OrbitalMechanicsEngine()
        
        # Performance metrics
        self.routing_decisions = 0
        self.cache_hits = 0
        self.cache_misses = 0
        
        self.logger = logging.getLogger("quantum_routing")
    
    def add_node(self, node: NetworkNode) -> None:
        """Add network node"""
        self.nodes[node.node_id] = node
        self.topology_graph.add_node(node.node_id, **node.__dict__)
        self.logger.info(f"Added node: {node.node_id}")
    
    def add_link(self, link: QuantumLink) -> None:
        """Add quantum communication link"""
        self.links[(link.source, link.destination)] = link
        self.links[(link.destination, link.source)] = link  # Bidirectional
        
        # Update topology graph
        self.topology_graph.add_edge(
            link.source, link.destination,
            weight=link.latency,
            bandwidth=link.bandwidth,
            reliability=link.reliability
        )
        
        self.logger.info(f"Added link: {link.source} <-> {link.destination}")
    
    def update_node_position(self, node_id: str, position: np.ndarray, 
                           velocity: np.ndarray = None, quantum_accuracy: float = None) -> None:
        """Update node position from quantum navigation"""
        if node_id not in self.nodes:
            return
        
        node = self.nodes[node_id]
        node.position = position
        if velocity is not None:
            node.velocity = velocity
        if quantum_accuracy is not None:
            node.quantum_accuracy = quantum_accuracy
        node.last_update = time.time()
        
        # Update affected links
        self._update_links_for_node(node_id)
        
        # Invalidate routing cache
        self._invalidate_cache()
    
    def _update_links_for_node(self, node_id: str) -> None:
        """Update links affected by node position change"""
        node = self.nodes[node_id]
        
        # Update all links involving this node
        for link_key, link in self.links.items():
            if link.source == node_id or link.destination == node_id:
                # Recalculate link properties
                source_node = self.nodes[link.source]
                dest_node = self.nodes[link.destination]
                
                # Update distance
                distance = np.linalg.norm(dest_node.position - source_node.position)
                link.distance = distance
                
                # Update latency (speed of light) - corrected calculation
                # Light travel time: distance in AU * 499 seconds/AU
                link.latency = distance * 499.0  # seconds per AU (one-way)
                
                # Update reliability based on distance
                link.reliability = max(0.1, 1.0 - distance / 10.0)  # Degrade with distance
                
                # Update quantum key rate
                link.quantum_key_rate = max(1000, 100000 / distance)  # bps
    
    def _invalidate_cache(self) -> None:
        """Invalidate routing cache"""
        self.routing_cache.clear()
        self.cache_timestamps.clear()
    
    async def find_optimal_route(self, request: RoutingRequest, 
                               strategy: RoutingStrategy = RoutingStrategy.ADAPTIVE) -> List[str]:
        """Find optimal route using specified strategy"""
        self.routing_decisions += 1
        
        # Check cache first
        cache_key = f"{request.source}_{request.destination}_{strategy.value}"
        if self._is_cache_valid(cache_key):
            self.cache_hits += 1
            return self.routing_cache[cache_key]
        
        self.cache_misses += 1
        
        # Update positions if needed
        await self._update_predicted_positions(request)
        
        # Apply routing strategy
        if strategy == RoutingStrategy.SHORTEST_PATH:
            route = self._shortest_path_routing(request)
        elif strategy == RoutingStrategy.MINIMUM_DELAY:
            route = self._minimum_delay_routing(request)
        elif strategy == RoutingStrategy.MAXIMUM_BANDWIDTH:
            route = self._maximum_bandwidth_routing(request)
        elif strategy == RoutingStrategy.LOAD_BALANCED:
            route = self._load_balanced_routing(request)
        elif strategy == RoutingStrategy.QUANTUM_OPTIMIZED:
            route = self._quantum_optimized_routing(request)
        elif strategy == RoutingStrategy.ADAPTIVE:
            route = await self._adaptive_routing(request)
        else:
            route = self._shortest_path_routing(request)
        
        # Cache result
        self.routing_cache[cache_key] = route
        self.cache_timestamps[cache_key] = time.time()
        
        return route
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cache entry is valid"""
        if cache_key not in self.routing_cache:
            return False
        
        timestamp = self.cache_timestamps.get(cache_key, 0)
        return time.time() - timestamp < self.cache_ttl
    
    async def _update_predicted_positions(self, request: RoutingRequest) -> None:
        """Update predicted positions for routing"""
        current_time = time.time()
        
        # Predict positions for all nodes
        for node_id, node in self.nodes.items():
            if current_time - node.last_update > 60:  # Update if older than 1 minute
                predicted_pos = await self.position_predictor.predict_position(node, current_time)
                node.position = predicted_pos
                node.last_update = current_time
        
        # Update links
        for node_id in self.nodes:
            self._update_links_for_node(node_id)
    
    def _shortest_path_routing(self, request: RoutingRequest) -> List[str]:
        """Find shortest path by hop count"""
        try:
            path = nx.shortest_path(self.topology_graph, request.source, request.destination)
            return path
        except nx.NetworkXNoPath:
            return []
    
    def _minimum_delay_routing(self, request: RoutingRequest) -> List[str]:
        """Find path with minimum total delay"""
        try:
            # Use Dijkstra with latency as weight
            path = nx.shortest_path(
                self.topology_graph, 
                request.source, 
                request.destination,
                weight='weight'
            )
            return path
        except nx.NetworkXNoPath:
            return []
    
    def _maximum_bandwidth_routing(self, request: RoutingRequest) -> List[str]:
        """Find path with maximum bottleneck bandwidth"""
        try:
            # Create graph with bandwidth weights (inverse for shortest path)
            G = self.topology_graph.copy()
            for u, v, data in G.edges(data=True):
                # Use inverse bandwidth as weight
                G[u][v]['weight'] = 1.0 / max(data.get('bandwidth', 1), 1)
            
            path = nx.shortest_path(G, request.source, request.destination, weight='weight')
            return path
        except nx.NetworkXNoPath:
            return []
    
    def _load_balanced_routing(self, request: RoutingRequest) -> List[str]:
        """Find path considering current load"""
        try:
            # Create graph with load-adjusted weights
            G = self.topology_graph.copy()
            
            for u, v, data in G.edges(data=True):
                link = self.links.get((u, v))
                if link:
                    # Factor in congestion
                    congestion_factor = 1.0 + link.congestion_level
                    adjusted_weight = data.get('weight', 1) * congestion_factor
                    G[u][v]['weight'] = adjusted_weight
            
            path = nx.shortest_path(G, request.source, request.destination, weight='weight')
            return path
        except nx.NetworkXNoPath:
            return []
    
    def _quantum_optimized_routing(self, request: RoutingRequest) -> List[str]:
        """Find path optimized for quantum communication"""
        try:
            # Create graph with quantum-specific weights
            G = self.topology_graph.copy()
            
            for u, v, data in G.edges(data=True):
                link = self.links.get((u, v))
                if link:
                    # Weight based on quantum key rate and reliability
                    quantum_weight = (1.0 / max(link.quantum_key_rate, 1)) * (1.0 / max(link.reliability, 0.1))
                    G[u][v]['weight'] = quantum_weight
            
            path = nx.shortest_path(G, request.source, request.destination, weight='weight')
            return path
        except nx.NetworkXNoPath:
            return []
    
    async def _adaptive_routing(self, request: RoutingRequest) -> List[str]:
        """Adaptive routing based on request characteristics"""
        # Analyze request characteristics
        if request.quantum_security_required:
            # Prefer quantum-optimized routing
            route = self._quantum_optimized_routing(request)
            if route:
                return route
        
        if request.priority <= 1:  # High priority
            # Prefer minimum delay
            route = self._minimum_delay_routing(request)
            if route:
                return route
        
        if request.data_size > 1024 * 1024 * 1024:  # Large data (>1GB)
            # Prefer maximum bandwidth
            route = self._maximum_bandwidth_routing(request)
            if route:
                return route
        
        # Default to load-balanced routing
        return self._load_balanced_routing(request)
    
    def calculate_route_metrics(self, route: List[str]) -> Dict:
        """Calculate comprehensive metrics for a route"""
        if len(route) < 2:
            return {}
        
        total_latency = 0
        min_bandwidth = float('inf')
        total_reliability = 1.0
        total_energy_cost = 0
        total_distance = 0
        quantum_key_rate = float('inf')
        
        for i in range(len(route) - 1):
            source = route[i]
            destination = route[i + 1]
            
            link = self.links.get((source, destination))
            if not link:
                continue
            
            total_latency += link.latency
            min_bandwidth = min(min_bandwidth, link.bandwidth)
            total_reliability *= link.reliability
            total_energy_cost += link.energy_cost
            total_distance += link.distance
            quantum_key_rate = min(quantum_key_rate, link.quantum_key_rate)
        
        return {
            'total_latency': total_latency,
            'bottleneck_bandwidth': min_bandwidth if min_bandwidth != float('inf') else 0,
            'end_to_end_reliability': total_reliability,
            'total_energy_cost': total_energy_cost,
            'total_distance': total_distance,
            'quantum_key_rate': quantum_key_rate if quantum_key_rate != float('inf') else 0,
            'hop_count': len(route) - 1
        }
    
    def update_link_congestion(self, source: str, destination: str, 
                             data_size: int, transmission_time: float) -> None:
        """Update link congestion metrics"""
        link = self.links.get((source, destination))
        if not link:
            return
        
        # Calculate congestion level
        utilization = data_size / (link.bandwidth * transmission_time)
        
        # Exponential moving average
        alpha = 0.1
        link.congestion_level = alpha * utilization + (1 - alpha) * link.congestion_level
        link.last_used = time.time()
    
    def get_network_topology(self) -> Dict:
        """Get current network topology"""
        return {
            'nodes': {
                node_id: {
                    'type': node.node_type.value,
                    'position': node.position.tolist(),
                    'velocity': node.velocity.tolist(),
                    'quantum_accuracy': node.quantum_accuracy,
                    'energy_level': node.energy_level,
                    'last_update': node.last_update
                }
                for node_id, node in self.nodes.items()
            },
            'links': {
                f"{link.source}->{link.destination}": {
                    'distance': link.distance,
                    'bandwidth': link.bandwidth,
                    'latency': link.latency,
                    'reliability': link.reliability,
                    'quantum_key_rate': link.quantum_key_rate,
                    'congestion_level': link.congestion_level,
                    'energy_cost': link.energy_cost
                }
                for link in self.links.values()
            }
        }
    
    def get_routing_statistics(self) -> Dict:
        """Get routing performance statistics"""
        cache_hit_rate = self.cache_hits / max(self.routing_decisions, 1)
        
        return {
            'routing_decisions': self.routing_decisions,
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'cache_hit_rate': cache_hit_rate,
            'cached_routes': len(self.routing_cache),
            'network_nodes': len(self.nodes),
            'network_links': len(self.links) // 2,  # Bidirectional links
            'timestamp': time.time()
        }

class QuantumPositionPredictor:
    """Quantum-enhanced position prediction"""
    
    def __init__(self):
        self.prediction_cache: Dict[str, Tuple[np.ndarray, float]] = {}
        self.cache_ttl = 60  # 1 minute
    
    async def predict_position(self, node: NetworkNode, target_time: float) -> np.ndarray:
        """Predict node position at target time"""
        cache_key = f"{node.node_id}_{target_time}"
        
        # Check cache
        if cache_key in self.prediction_cache:
            position, timestamp = self.prediction_cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                return position
        
        # Time difference
        dt = target_time - node.last_update
        
        # Simple ballistic prediction (in real implementation, use full orbital mechanics)
        predicted_position = node.position + node.velocity * dt
        
        # Add quantum navigation uncertainty
        uncertainty = np.random.normal(0, 1 - node.quantum_accuracy, 3) * 0.001  # Small uncertainty
        predicted_position += uncertainty
        
        # Cache result
        self.prediction_cache[cache_key] = (predicted_position, time.time())
        
        return predicted_position

class OrbitalMechanicsEngine:
    """Orbital mechanics calculations for routing"""
    
    def __init__(self):
        self.gravitational_constant = 1.327e11  # km³/s² for Sun
        self.au_to_km = 1.496e8  # km per AU
    
    def calculate_orbital_period(self, semi_major_axis: float) -> float:
        """Calculate orbital period using Kepler's third law"""
        # T² = (4π²/GM) * a³
        a_km = semi_major_axis * self.au_to_km
        period_seconds = 2 * np.pi * np.sqrt(a_km**3 / self.gravitational_constant)
        return period_seconds / 86400  # Convert to days
    
    def predict_orbital_position(self, node: NetworkNode, target_time: float) -> np.ndarray:
        """Predict orbital position using Kepler's laws"""
        # Simplified orbital prediction
        # In real implementation, use full ephemeris calculations
        
        if node.node_type == NodeType.PLANET:
            # Planetary motion
            period = self.calculate_orbital_period(np.linalg.norm(node.position))
            angular_velocity = 2 * np.pi / (period * 86400)  # rad/s
            
            dt = target_time - node.last_update
            angle_change = angular_velocity * dt
            
            # Rotate position vector
            cos_theta = np.cos(angle_change)
            sin_theta = np.sin(angle_change)
            
            rotation_matrix = np.array([
                [cos_theta, -sin_theta, 0],
                [sin_theta, cos_theta, 0],
                [0, 0, 1]
            ])
            
            return rotation_matrix @ node.position
        
        else:
            # Station-keeping or ballistic trajectory
            return node.position + node.velocity * (target_time - node.last_update)
    
    def calculate_hohmann_transfer(self, start_pos: np.ndarray, 
                                 end_pos: np.ndarray) -> Dict:
        """Calculate Hohmann transfer orbit parameters"""
        r1 = np.linalg.norm(start_pos)
        r2 = np.linalg.norm(end_pos)
        
        # Semi-major axis of transfer orbit
        a = (r1 + r2) / 2
        
        # Transfer time
        transfer_time = np.pi * np.sqrt(a**3 / self.gravitational_constant)
        
        # Delta-V requirements
        v1 = np.sqrt(self.gravitational_constant / r1)
        v2 = np.sqrt(self.gravitational_constant / r2)
        v_transfer_1 = np.sqrt(self.gravitational_constant * (2/r1 - 1/a))
        v_transfer_2 = np.sqrt(self.gravitational_constant * (2/r2 - 1/a))
        
        delta_v1 = abs(v_transfer_1 - v1)
        delta_v2 = abs(v2 - v_transfer_2)
        
        return {
            'transfer_time': transfer_time,
            'delta_v_departure': delta_v1,
            'delta_v_arrival': delta_v2,
            'total_delta_v': delta_v1 + delta_v2,
            'semi_major_axis': a
        }

class AdaptiveRoutingOptimizer:
    """Machine learning-based routing optimization"""
    
    def __init__(self, routing_engine: QuantumRoutingEngine):
        self.routing_engine = routing_engine
        self.performance_history: List[Dict] = []
        self.learning_rate = 0.01
        self.weights = {
            'latency': 0.25,
            'bandwidth': 0.25,
            'reliability': 0.25,
            'energy': 0.25
        }
    
    def record_performance(self, request: RoutingRequest, route: List[str], 
                          actual_metrics: Dict) -> None:
        """Record routing performance for learning"""
        predicted_metrics = self.routing_engine.calculate_route_metrics(route)
        
        performance_record = {
            'timestamp': time.time(),
            'request': request.__dict__,
            'route': route,
            'predicted_metrics': predicted_metrics,
            'actual_metrics': actual_metrics,
            'error': self._calculate_prediction_error(predicted_metrics, actual_metrics)
        }
        
        self.performance_history.append(performance_record)
        
        # Update weights based on performance
        self._update_weights(performance_record)
    
    def _calculate_prediction_error(self, predicted: Dict, actual: Dict) -> float:
        """Calculate prediction error"""
        error = 0
        count = 0
        
        for key in ['total_latency', 'bottleneck_bandwidth', 'end_to_end_reliability']:
            if key in predicted and key in actual:
                if actual[key] != 0:
                    error += abs(predicted[key] - actual[key]) / actual[key]
                    count += 1
        
        return error / max(count, 1)
    
    def _update_weights(self, performance_record: Dict) -> None:
        """Update routing weights based on performance"""
        error = performance_record['error']
        
        # Simple gradient descent weight update
        if error > 0.1:  # High error threshold
            # Adjust weights to reduce error
            for key in self.weights:
                self.weights[key] *= (1 - self.learning_rate * error)
        
        # Normalize weights
        total_weight = sum(self.weights.values())
        for key in self.weights:
            self.weights[key] /= total_weight
    
    def get_optimized_weights(self) -> Dict:
        """Get current optimized weights"""
        return self.weights.copy()

# Example usage and testing
async def main():
    """Example usage of quantum routing algorithms"""
    
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
    
    # Create routing request
    request = RoutingRequest(
        request_id="test_001",
        source="earth_control",
        destination="mars_colony",
        data_size=1024 * 1024,  # 1 MB
        priority=1,
        max_latency=1000,
        min_bandwidth=1000000,
        quantum_security_required=True,
        timestamp=time.time(),
        source_position=earth.position
    )
    
    # Find optimal route
    route = await routing_engine.find_optimal_route(request, RoutingStrategy.QUANTUM_OPTIMIZED)
    print(f"Optimal route: {route}")
    
    # Calculate route metrics
    metrics = routing_engine.calculate_route_metrics(route)
    print(f"Route metrics: {json.dumps(metrics, indent=2)}")
    
    # Get network topology
    topology = routing_engine.get_network_topology()
    print(f"Network topology: {json.dumps(topology, indent=2)}")
    
    # Get routing statistics
    stats = routing_engine.get_routing_statistics()
    print(f"Routing statistics: {json.dumps(stats, indent=2)}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())