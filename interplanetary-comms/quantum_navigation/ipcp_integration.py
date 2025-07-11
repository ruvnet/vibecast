"""IPCP integration for quantum-magnetic navigation.

This module provides integration between the quantum navigation system
and the Interplanetary Communication Protocol (IPCP) for position-aware
routing and communication optimization.
"""

from __future__ import annotations

import logging
import json
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import time
import math

from .quantum_navigator import QuantumNavigator, NavigationFix
from .position_estimator import PositionEstimator, EstimationResult
from .trajectory_planner import TrajectoryPlanner, Trajectory, TrajectoryType

# Import from the quantum-magnetic-navigation codebase
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../quantum-magnetic-navigation/src'))

from qmag_nav.models.geo import LatLon

logger = logging.getLogger(__name__)


class IPCPPriority(Enum):
    """IPCP message priority levels."""
    EMERGENCY = 5
    CRITICAL = 4
    HIGH = 3
    NORMAL = 2
    LOW = 1


class RouteOptimization(Enum):
    """Route optimization strategies."""
    SHORTEST_PATH = "shortest_path"
    FASTEST_ROUTE = "fastest_route"
    MOST_RELIABLE = "most_reliable"
    ENERGY_EFFICIENT = "energy_efficient"


@dataclass
class IPCPNode:
    """IPCP network node with position information."""
    node_id: str
    position: LatLon
    altitude: float
    capabilities: List[str]
    status: str
    last_seen: float
    reliability_score: float
    bandwidth_capacity: float
    latency_ms: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "node_id": self.node_id,
            "position": {
                "latitude": self.position.lat,
                "longitude": self.position.lon,
                "altitude": self.altitude
            },
            "capabilities": self.capabilities,
            "status": self.status,
            "last_seen": self.last_seen,
            "reliability_score": self.reliability_score,
            "bandwidth_capacity": self.bandwidth_capacity,
            "latency_ms": self.latency_ms
        }


@dataclass
class IPCPMessage:
    """IPCP message with routing information."""
    message_id: str
    source_node: str
    destination_node: str
    priority: IPCPPriority
    payload: bytes
    timestamp: float
    route_hint: Optional[List[str]] = None
    max_hops: int = 10
    ttl: float = 3600.0  # Time to live in seconds
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "message_id": self.message_id,
            "source_node": self.source_node,
            "destination_node": self.destination_node,
            "priority": self.priority.value,
            "payload_size": len(self.payload),
            "timestamp": self.timestamp,
            "route_hint": self.route_hint,
            "max_hops": self.max_hops,
            "ttl": self.ttl
        }


@dataclass
class RouteMetrics:
    """Metrics for route evaluation."""
    total_distance: float
    estimated_latency: float
    reliability_score: float
    energy_cost: float
    hop_count: int
    confidence: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)


class IPCPPositionProvider:
    """Main IPCP integration class providing position-aware routing.
    
    This class integrates quantum-magnetic navigation with IPCP protocol
    to provide position-aware routing, trajectory-based communication
    optimization, and adaptive protocol selection.
    """
    
    def __init__(
        self,
        quantum_navigator: QuantumNavigator,
        position_estimator: PositionEstimator,
        trajectory_planner: TrajectoryPlanner,
        node_id: str,
        network_config: Optional[Dict[str, Any]] = None
    ):
        """Initialize the IPCP position provider.
        
        Args:
            quantum_navigator: Quantum navigation system
            position_estimator: Position estimation system
            trajectory_planner: Trajectory planning system
            node_id: Unique identifier for this node
            network_config: Optional network configuration
        """
        self.quantum_navigator = quantum_navigator
        self.position_estimator = position_estimator
        self.trajectory_planner = trajectory_planner
        self.node_id = node_id
        self.network_config = network_config or {}
        
        # Network topology
        self.known_nodes: Dict[str, IPCPNode] = {}
        self.routing_table: Dict[str, List[str]] = {}
        self.route_cache: Dict[str, Tuple[List[str], float]] = {}  # (route, timestamp)
        self.cache_ttl = 300.0  # Cache TTL in seconds
        
        # Performance metrics
        self.routing_statistics = {
            "total_routes_calculated": 0,
            "successful_routes": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "average_route_calculation_time": 0.0
        }
        
        # Message queue for store-and-forward
        self.message_queue: List[IPCPMessage] = []
        self.max_queue_size = 1000
        
        logger.info(f"IPCP Position Provider initialized for node {node_id}")
    
    def register_node(self, node: IPCPNode):
        """Register a new node in the network.
        
        Args:
            node: Node to register
        """
        self.known_nodes[node.node_id] = node
        logger.info(f"Registered node {node.node_id} at position {node.position}")
        
        # Clear route cache as topology has changed
        self.route_cache.clear()
    
    def update_node_position(self, node_id: str, position: LatLon, altitude: float = 0.0):
        """Update position of a known node.
        
        Args:
            node_id: Node identifier
            position: New position
            altitude: New altitude
        """
        if node_id in self.known_nodes:
            self.known_nodes[node_id].position = position
            self.known_nodes[node_id].altitude = altitude
            self.known_nodes[node_id].last_seen = time.time()
            
            # Clear affected routes from cache
            self._clear_routes_involving_node(node_id)
            
            logger.debug(f"Updated position for node {node_id}")
    
    def calculate_route(
        self,
        source_node: str,
        destination_node: str,
        optimization: RouteOptimization = RouteOptimization.SHORTEST_PATH,
        constraints: Optional[Dict[str, Any]] = None
    ) -> Optional[Tuple[List[str], RouteMetrics]]:
        """Calculate optimal route between two nodes.
        
        Args:
            source_node: Source node ID
            destination_node: Destination node ID
            optimization: Route optimization strategy
            constraints: Optional routing constraints
            
        Returns:
            Tuple of (route, metrics) or None if no route found
        """
        start_time = time.time()
        self.routing_statistics["total_routes_calculated"] += 1
        
        # Check cache first
        cache_key = f"{source_node}_{destination_node}_{optimization.value}"
        cached_route = self.route_cache.get(cache_key)
        
        if cached_route and (time.time() - cached_route[1]) < self.cache_ttl:
            self.routing_statistics["cache_hits"] += 1
            # Still need to calculate metrics for cached route
            metrics = self._calculate_route_metrics(cached_route[0], optimization)
            return cached_route[0], metrics
        
        self.routing_statistics["cache_misses"] += 1
        
        try:
            # Ensure nodes exist
            if source_node not in self.known_nodes or destination_node not in self.known_nodes:
                logger.warning(f"Unknown node in route calculation: {source_node} -> {destination_node}")
                return None
            
            # Calculate route based on optimization strategy
            if optimization == RouteOptimization.SHORTEST_PATH:
                route = self._calculate_shortest_path(source_node, destination_node, constraints)
            elif optimization == RouteOptimization.FASTEST_ROUTE:
                route = self._calculate_fastest_route(source_node, destination_node, constraints)
            elif optimization == RouteOptimization.MOST_RELIABLE:
                route = self._calculate_most_reliable_route(source_node, destination_node, constraints)
            elif optimization == RouteOptimization.ENERGY_EFFICIENT:
                route = self._calculate_energy_efficient_route(source_node, destination_node, constraints)
            else:
                logger.error(f"Unknown optimization strategy: {optimization}")
                return None
            
            if not route:
                logger.warning(f"No route found from {source_node} to {destination_node}")
                return None
            
            # Calculate route metrics
            metrics = self._calculate_route_metrics(route, optimization)
            
            # Cache the route
            self.route_cache[cache_key] = (route, time.time())
            
            # Update statistics
            self.routing_statistics["successful_routes"] += 1
            calculation_time = time.time() - start_time
            self._update_average_calculation_time(calculation_time)
            
            logger.info(f"Calculated route {source_node} -> {destination_node}: {' -> '.join(route)}")
            return route, metrics
            
        except Exception as e:
            logger.error(f"Failed to calculate route: {e}")
            return None
    
    def _calculate_shortest_path(
        self,
        source: str,
        destination: str,
        constraints: Optional[Dict[str, Any]]
    ) -> Optional[List[str]]:
        """Calculate shortest path using Dijkstra's algorithm."""
        # Simple implementation - in practice, this would use a proper graph algorithm
        distances = {node_id: float('inf') for node_id in self.known_nodes}
        distances[source] = 0.0
        previous = {}
        unvisited = set(self.known_nodes.keys())
        
        while unvisited:
            # Find node with minimum distance
            current = min(unvisited, key=lambda x: distances[x])
            
            if current == destination:
                break
            
            unvisited.remove(current)
            
            # Update distances to neighbors
            for neighbor in self._get_neighbors(current):
                if neighbor in unvisited:
                    distance = self._calculate_distance(current, neighbor)
                    alt_distance = distances[current] + distance
                    
                    if alt_distance < distances[neighbor]:
                        distances[neighbor] = alt_distance
                        previous[neighbor] = current
        
        # Reconstruct path
        if destination not in previous and destination != source:
            return None
        
        path = []
        current = destination
        while current is not None:
            path.append(current)
            current = previous.get(current)
        
        path.reverse()
        return path
    
    def _calculate_fastest_route(
        self,
        source: str,
        destination: str,
        constraints: Optional[Dict[str, Any]]
    ) -> Optional[List[str]]:
        """Calculate fastest route considering latency."""
        # Similar to shortest path but using latency as weight
        latencies = {node_id: float('inf') for node_id in self.known_nodes}
        latencies[source] = 0.0
        previous = {}
        unvisited = set(self.known_nodes.keys())
        
        while unvisited:
            current = min(unvisited, key=lambda x: latencies[x])
            
            if current == destination:
                break
            
            unvisited.remove(current)
            
            for neighbor in self._get_neighbors(current):
                if neighbor in unvisited:
                    latency = self._calculate_latency(current, neighbor)
                    alt_latency = latencies[current] + latency
                    
                    if alt_latency < latencies[neighbor]:
                        latencies[neighbor] = alt_latency
                        previous[neighbor] = current
        
        # Reconstruct path
        if destination not in previous and destination != source:
            return None
        
        path = []
        current = destination
        while current is not None:
            path.append(current)
            current = previous.get(current)
        
        path.reverse()
        return path
    
    def _calculate_most_reliable_route(
        self,
        source: str,
        destination: str,
        constraints: Optional[Dict[str, Any]]
    ) -> Optional[List[str]]:
        """Calculate most reliable route based on node reliability scores."""
        # Use reliability scores as weights (higher is better, so invert)
        reliabilities = {node_id: 0.0 for node_id in self.known_nodes}
        reliabilities[source] = 1.0
        previous = {}
        unvisited = set(self.known_nodes.keys())
        
        while unvisited:
            current = max(unvisited, key=lambda x: reliabilities[x])
            
            if current == destination:
                break
            
            if reliabilities[current] == 0.0:
                break  # No path available
            
            unvisited.remove(current)
            
            for neighbor in self._get_neighbors(current):
                if neighbor in unvisited:
                    neighbor_reliability = self.known_nodes[neighbor].reliability_score
                    path_reliability = reliabilities[current] * neighbor_reliability
                    
                    if path_reliability > reliabilities[neighbor]:
                        reliabilities[neighbor] = path_reliability
                        previous[neighbor] = current
        
        # Reconstruct path
        if destination not in previous and destination != source:
            return None
        
        path = []
        current = destination
        while current is not None:
            path.append(current)
            current = previous.get(current)
        
        path.reverse()
        return path
    
    def _calculate_energy_efficient_route(
        self,
        source: str,
        destination: str,
        constraints: Optional[Dict[str, Any]]
    ) -> Optional[List[str]]:
        """Calculate energy-efficient route."""
        # Simplified energy calculation based on distance and transmission power
        energies = {node_id: float('inf') for node_id in self.known_nodes}
        energies[source] = 0.0
        previous = {}
        unvisited = set(self.known_nodes.keys())
        
        while unvisited:
            current = min(unvisited, key=lambda x: energies[x])
            
            if current == destination:
                break
            
            unvisited.remove(current)
            
            for neighbor in self._get_neighbors(current):
                if neighbor in unvisited:
                    # Energy cost proportional to distance squared
                    distance = self._calculate_distance(current, neighbor)
                    energy_cost = distance ** 2
                    alt_energy = energies[current] + energy_cost
                    
                    if alt_energy < energies[neighbor]:
                        energies[neighbor] = alt_energy
                        previous[neighbor] = current
        
        # Reconstruct path
        if destination not in previous and destination != source:
            return None
        
        path = []
        current = destination
        while current is not None:
            path.append(current)
            current = previous.get(current)
        
        path.reverse()
        return path
    
    def _get_neighbors(self, node_id: str) -> List[str]:
        """Get neighboring nodes within communication range."""
        neighbors = []
        current_node = self.known_nodes[node_id]
        
        for other_id, other_node in self.known_nodes.items():
            if other_id != node_id and other_node.status == "active":
                distance = self._calculate_distance(node_id, other_id)
                # Assume communication range based on node capabilities
                max_range = 1000000  # 1000 km default range
                if distance <= max_range:
                    neighbors.append(other_id)
        
        return neighbors
    
    def _calculate_distance(self, node1_id: str, node2_id: str) -> float:
        """Calculate distance between two nodes."""
        node1 = self.known_nodes[node1_id]
        node2 = self.known_nodes[node2_id]
        
        # Great circle distance
        lat1, lon1 = math.radians(node1.position.lat), math.radians(node1.position.lon)
        lat2, lon2 = math.radians(node2.position.lat), math.radians(node2.position.lon)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        R = 6371000  # Earth radius in meters
        return R * c
    
    def _calculate_latency(self, node1_id: str, node2_id: str) -> float:
        """Calculate communication latency between two nodes."""
        distance = self._calculate_distance(node1_id, node2_id)
        speed_of_light = 299792458  # m/s
        
        # Propagation delay
        propagation_delay = distance / speed_of_light
        
        # Add processing delays
        node1_latency = self.known_nodes[node1_id].latency_ms / 1000.0
        node2_latency = self.known_nodes[node2_id].latency_ms / 1000.0
        
        return propagation_delay + node1_latency + node2_latency
    
    def _calculate_route_metrics(self, route: List[str], optimization: RouteOptimization) -> RouteMetrics:
        """Calculate comprehensive metrics for a route."""
        if len(route) < 2:
            return RouteMetrics(0.0, 0.0, 1.0, 0.0, 0, 1.0)
        
        total_distance = 0.0
        total_latency = 0.0
        total_energy = 0.0
        reliability_product = 1.0
        
        for i in range(len(route) - 1):
            current = route[i]
            next_node = route[i + 1]
            
            # Distance
            distance = self._calculate_distance(current, next_node)
            total_distance += distance
            
            # Latency
            latency = self._calculate_latency(current, next_node)
            total_latency += latency
            
            # Energy (simplified)
            energy = distance ** 2
            total_energy += energy
            
            # Reliability
            reliability = self.known_nodes[next_node].reliability_score
            reliability_product *= reliability
        
        # Confidence based on optimization strategy
        confidence = 0.8  # Base confidence
        if optimization == RouteOptimization.SHORTEST_PATH:
            confidence = 0.9
        elif optimization == RouteOptimization.FASTEST_ROUTE:
            confidence = 0.85
        elif optimization == RouteOptimization.MOST_RELIABLE:
            confidence = reliability_product
        elif optimization == RouteOptimization.ENERGY_EFFICIENT:
            confidence = 0.75
        
        return RouteMetrics(
            total_distance=total_distance,
            estimated_latency=total_latency,
            reliability_score=reliability_product,
            energy_cost=total_energy,
            hop_count=len(route) - 1,
            confidence=confidence
        )
    
    def _clear_routes_involving_node(self, node_id: str):
        """Clear cached routes involving a specific node."""
        keys_to_remove = []
        for key in self.route_cache:
            if node_id in key:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.route_cache[key]
    
    def _update_average_calculation_time(self, calculation_time: float):
        """Update running average of route calculation time."""
        current_avg = self.routing_statistics["average_route_calculation_time"]
        total_calcs = self.routing_statistics["total_routes_calculated"]
        
        new_avg = (current_avg * (total_calcs - 1) + calculation_time) / total_calcs
        self.routing_statistics["average_route_calculation_time"] = new_avg
    
    def get_current_position(self) -> Optional[Dict[str, Any]]:
        """Get current position from quantum navigator."""
        return self.quantum_navigator.get_position_for_routing()
    
    def predict_position(self, duration: float) -> Optional[Dict[str, Any]]:
        """Predict position after specified duration."""
        trajectory = self.trajectory_planner.plan_trajectory(
            start_position=self.quantum_navigator.current_fix.position if self.quantum_navigator.current_fix else LatLon(0, 0),
            start_velocity=(0, 0),
            target_position=LatLon(0, 0),  # Placeholder
            duration=duration
        )
        
        if trajectory and trajectory.waypoints:
            final_waypoint = trajectory.waypoints[-1]
            return {
                "position": {
                    "latitude": final_waypoint.latitude,
                    "longitude": final_waypoint.longitude,
                    "altitude": final_waypoint.altitude
                },
                "velocity": {
                    "north": final_waypoint.velocity_north,
                    "east": final_waypoint.velocity_east,
                    "up": final_waypoint.velocity_up
                },
                "timestamp": final_waypoint.timestamp
            }
        
        return None
    
    def get_network_status(self) -> Dict[str, Any]:
        """Get comprehensive network status."""
        active_nodes = sum(1 for node in self.known_nodes.values() if node.status == "active")
        
        return {
            "node_id": self.node_id,
            "total_nodes": len(self.known_nodes),
            "active_nodes": active_nodes,
            "cached_routes": len(self.route_cache),
            "routing_statistics": self.routing_statistics,
            "current_position": self.get_current_position(),
            "message_queue_size": len(self.message_queue)
        }
    
    def queue_message(self, message: IPCPMessage):
        """Queue a message for store-and-forward delivery."""
        if len(self.message_queue) >= self.max_queue_size:
            # Remove oldest message
            self.message_queue.pop(0)
        
        self.message_queue.append(message)
        logger.info(f"Queued message {message.message_id} for store-and-forward")
    
    def process_message_queue(self) -> List[IPCPMessage]:
        """Process queued messages and return deliverable ones."""
        deliverable = []
        remaining = []
        
        for message in self.message_queue:
            # Check if message has expired
            if time.time() - message.timestamp > message.ttl:
                logger.info(f"Message {message.message_id} expired")
                continue
            
            # Check if destination is now reachable
            route_result = self.calculate_route(self.node_id, message.destination_node)
            if route_result:
                deliverable.append(message)
                logger.info(f"Message {message.message_id} now deliverable")
            else:
                remaining.append(message)
        
        self.message_queue = remaining
        return deliverable