"""Trajectory planner for interplanetary navigation.

This module provides trajectory planning and prediction capabilities
for interplanetary communications using quantum-magnetic navigation.
"""

from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass
from enum import Enum
import time

# Import from the quantum-magnetic-navigation codebase
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../quantum-magnetic-navigation/src'))

from qmag_nav.models.geo import LatLon

logger = logging.getLogger(__name__)


class TrajectoryType(Enum):
    """Types of trajectories."""
    LINEAR = "linear"
    ORBITAL = "orbital"
    INTERPLANETARY = "interplanetary"
    EMERGENCY = "emergency"


@dataclass
class Waypoint:
    """Waypoint in a trajectory."""
    latitude: float
    longitude: float
    altitude: float
    timestamp: float
    velocity_north: float
    velocity_east: float
    velocity_up: float
    waypoint_id: str
    waypoint_type: str = "normal"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "altitude": self.altitude,
            "timestamp": self.timestamp,
            "velocity": {
                "north": self.velocity_north,
                "east": self.velocity_east,
                "up": self.velocity_up
            },
            "waypoint_id": self.waypoint_id,
            "waypoint_type": self.waypoint_type
        }
    
    def distance_to(self, other: Waypoint) -> float:
        """Calculate distance to another waypoint in meters."""
        return self._great_circle_distance(
            self.latitude, self.longitude,
            other.latitude, other.longitude
        )
    
    @staticmethod
    def _great_circle_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate great circle distance between two points."""
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth radius in meters (or celestial body radius)
        R = 6371000  # Earth radius
        return R * c


@dataclass
class Trajectory:
    """Complete trajectory with waypoints and metadata."""
    waypoints: List[Waypoint]
    trajectory_id: str
    trajectory_type: TrajectoryType
    start_time: float
    end_time: float
    total_distance: float
    confidence: float
    parameters: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "trajectory_id": self.trajectory_id,
            "trajectory_type": self.trajectory_type.value,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "total_distance": self.total_distance,
            "confidence": self.confidence,
            "parameters": self.parameters,
            "waypoints": [wp.to_dict() for wp in self.waypoints]
        }
    
    def get_waypoint_at_time(self, timestamp: float) -> Optional[Waypoint]:
        """Get waypoint at specific time (interpolated if necessary)."""
        if not self.waypoints:
            return None
        
        # Find the two waypoints that bracket the timestamp
        for i in range(len(self.waypoints) - 1):
            if self.waypoints[i].timestamp <= timestamp <= self.waypoints[i + 1].timestamp:
                # Interpolate between waypoints
                return self._interpolate_waypoints(
                    self.waypoints[i], self.waypoints[i + 1], timestamp
                )
        
        # Return closest waypoint if outside range
        if timestamp < self.waypoints[0].timestamp:
            return self.waypoints[0]
        else:
            return self.waypoints[-1]
    
    def _interpolate_waypoints(self, wp1: Waypoint, wp2: Waypoint, timestamp: float) -> Waypoint:
        """Interpolate between two waypoints."""
        if wp1.timestamp == wp2.timestamp:
            return wp1
        
        # Linear interpolation factor
        t = (timestamp - wp1.timestamp) / (wp2.timestamp - wp1.timestamp)
        
        # Interpolate position
        lat = wp1.latitude + t * (wp2.latitude - wp1.latitude)
        lon = wp1.longitude + t * (wp2.longitude - wp1.longitude)
        alt = wp1.altitude + t * (wp2.altitude - wp1.altitude)
        
        # Interpolate velocity
        vel_n = wp1.velocity_north + t * (wp2.velocity_north - wp1.velocity_north)
        vel_e = wp1.velocity_east + t * (wp2.velocity_east - wp1.velocity_east)
        vel_u = wp1.velocity_up + t * (wp2.velocity_up - wp1.velocity_up)
        
        return Waypoint(
            latitude=lat,
            longitude=lon,
            altitude=alt,
            timestamp=timestamp,
            velocity_north=vel_n,
            velocity_east=vel_e,
            velocity_up=vel_u,
            waypoint_id=f"interp_{timestamp}",
            waypoint_type="interpolated"
        )


@dataclass
class PlanetaryParameters:
    """Parameters for planetary navigation."""
    planetary_radius: float = 6371000  # Earth radius in meters
    gravitational_parameter: float = 3.986004418e14  # Earth GM in m³/s²
    rotation_rate: float = 7.292115e-5  # Earth rotation rate in rad/s
    atmosphere_height: float = 100000  # Atmosphere height in meters
    magnetic_field_strength: float = 50000  # Typical magnetic field in nT


class TrajectoryPlanner:
    """Advanced trajectory planner for interplanetary communications.
    
    This class provides sophisticated trajectory planning capabilities
    for quantum-magnetic navigation in interplanetary communications.
    """
    
    def __init__(self, planetary_params: Optional[PlanetaryParameters] = None):
        """Initialize the trajectory planner.
        
        Args:
            planetary_params: Parameters for the planetary body
        """
        self.planetary_params = planetary_params or PlanetaryParameters()
        self.trajectory_cache: Dict[str, Trajectory] = {}
        self.max_cache_size = 100
        
        # Planning statistics
        self.total_plans = 0
        self.successful_plans = 0
        self.planning_time_history: List[float] = []
    
    def plan_trajectory(
        self,
        start_position: LatLon,
        start_velocity: Tuple[float, float],
        target_position: LatLon,
        trajectory_type: TrajectoryType = TrajectoryType.LINEAR,
        duration: float = 3600.0,
        num_waypoints: int = 10,
        constraints: Optional[Dict[str, Any]] = None
    ) -> Optional[Trajectory]:
        """Plan a trajectory from start to target position.
        
        Args:
            start_position: Starting position
            start_velocity: Starting velocity (north, east) in m/s
            target_position: Target position
            trajectory_type: Type of trajectory to plan
            duration: Total trajectory duration in seconds
            num_waypoints: Number of waypoints to generate
            constraints: Optional constraints for planning
            
        Returns:
            Planned trajectory or None if planning failed
        """
        start_time = time.time()
        self.total_plans += 1
        
        try:
            # Generate trajectory ID
            trajectory_id = f"{trajectory_type.value}_{int(time.time())}"
            
            # Plan based on trajectory type
            if trajectory_type == TrajectoryType.LINEAR:
                waypoints = self._plan_linear_trajectory(
                    start_position, start_velocity, target_position, duration, num_waypoints
                )
            elif trajectory_type == TrajectoryType.ORBITAL:
                waypoints = self._plan_orbital_trajectory(
                    start_position, start_velocity, target_position, duration, num_waypoints
                )
            elif trajectory_type == TrajectoryType.INTERPLANETARY:
                waypoints = self._plan_interplanetary_trajectory(
                    start_position, start_velocity, target_position, duration, num_waypoints
                )
            elif trajectory_type == TrajectoryType.EMERGENCY:
                waypoints = self._plan_emergency_trajectory(
                    start_position, start_velocity, target_position, duration, num_waypoints
                )
            else:
                logger.error(f"Unsupported trajectory type: {trajectory_type}")
                return None
            
            if not waypoints:
                logger.error("Failed to generate waypoints")
                return None
            
            # Calculate total distance
            total_distance = self._calculate_total_distance(waypoints)
            
            # Estimate confidence based on trajectory type and constraints
            confidence = self._estimate_trajectory_confidence(
                trajectory_type, waypoints, constraints
            )
            
            # Create trajectory
            trajectory = Trajectory(
                waypoints=waypoints,
                trajectory_id=trajectory_id,
                trajectory_type=trajectory_type,
                start_time=waypoints[0].timestamp,
                end_time=waypoints[-1].timestamp,
                total_distance=total_distance,
                confidence=confidence,
                parameters={
                    "duration": duration,
                    "num_waypoints": num_waypoints,
                    "constraints": constraints or {}
                }
            )
            
            # Cache the trajectory
            self._cache_trajectory(trajectory)
            
            # Update statistics
            self.successful_plans += 1
            planning_time = time.time() - start_time
            self.planning_time_history.append(planning_time)
            
            if len(self.planning_time_history) > 100:
                self.planning_time_history.pop(0)
            
            logger.info(f"Planned {trajectory_type.value} trajectory with {len(waypoints)} waypoints")
            return trajectory
            
        except Exception as e:
            logger.error(f"Failed to plan trajectory: {e}")
            return None
    
    def _plan_linear_trajectory(
        self,
        start_pos: LatLon,
        start_vel: Tuple[float, float],
        target_pos: LatLon,
        duration: float,
        num_waypoints: int
    ) -> List[Waypoint]:
        """Plan a linear trajectory."""
        waypoints = []
        dt = duration / (num_waypoints - 1)
        
        # Calculate total distance and direction
        total_distance = Waypoint._great_circle_distance(
            start_pos.lat, start_pos.lon,
            target_pos.lat, target_pos.lon
        )
        
        # Calculate average velocity needed
        avg_velocity = total_distance / duration
        
        # Calculate bearing
        bearing = self._calculate_bearing(start_pos, target_pos)
        
        for i in range(num_waypoints):
            t = i * dt
            timestamp = time.time() + t
            
            # Linear interpolation of position
            progress = i / (num_waypoints - 1)
            lat = start_pos.lat + progress * (target_pos.lat - start_pos.lat)
            lon = start_pos.lon + progress * (target_pos.lon - start_pos.lon)
            
            # Constant velocity components
            vel_north = avg_velocity * math.cos(bearing)
            vel_east = avg_velocity * math.sin(bearing)
            
            waypoint = Waypoint(
                latitude=lat,
                longitude=lon,
                altitude=0.0,  # Assume surface level for now
                timestamp=timestamp,
                velocity_north=vel_north,
                velocity_east=vel_east,
                velocity_up=0.0,
                waypoint_id=f"linear_{i}",
                waypoint_type="linear"
            )
            
            waypoints.append(waypoint)
        
        return waypoints
    
    def _plan_orbital_trajectory(
        self,
        start_pos: LatLon,
        start_vel: Tuple[float, float],
        target_pos: LatLon,
        duration: float,
        num_waypoints: int
    ) -> List[Waypoint]:
        """Plan an orbital trajectory (simplified)."""
        waypoints = []
        dt = duration / (num_waypoints - 1)
        
        # Simplified orbital mechanics - assume circular orbit
        orbit_radius = self.planetary_params.planetary_radius + 400000  # 400km altitude
        orbital_velocity = math.sqrt(
            self.planetary_params.gravitational_parameter / orbit_radius
        )
        
        # Calculate orbital period
        orbital_period = 2 * math.pi * math.sqrt(
            orbit_radius**3 / self.planetary_params.gravitational_parameter
        )
        
        # Starting orbital position
        start_angle = math.atan2(start_pos.lon, start_pos.lat)
        angular_velocity = 2 * math.pi / orbital_period
        
        for i in range(num_waypoints):
            t = i * dt
            timestamp = time.time() + t
            
            # Calculate orbital position
            angle = start_angle + angular_velocity * t
            
            # Convert to lat/lon (simplified)
            lat = math.degrees(math.sin(angle) * orbit_radius / self.planetary_params.planetary_radius)
            lon = math.degrees(math.cos(angle) * orbit_radius / self.planetary_params.planetary_radius)
            
            # Orbital velocity components
            vel_north = -orbital_velocity * math.sin(angle)
            vel_east = orbital_velocity * math.cos(angle)
            
            waypoint = Waypoint(
                latitude=lat,
                longitude=lon,
                altitude=orbit_radius - self.planetary_params.planetary_radius,
                timestamp=timestamp,
                velocity_north=vel_north,
                velocity_east=vel_east,
                velocity_up=0.0,
                waypoint_id=f"orbital_{i}",
                waypoint_type="orbital"
            )
            
            waypoints.append(waypoint)
        
        return waypoints
    
    def _plan_interplanetary_trajectory(
        self,
        start_pos: LatLon,
        start_vel: Tuple[float, float],
        target_pos: LatLon,
        duration: float,
        num_waypoints: int
    ) -> List[Waypoint]:
        """Plan an interplanetary trajectory (simplified Hohmann transfer)."""
        waypoints = []
        dt = duration / (num_waypoints - 1)
        
        # Simplified interplanetary transfer
        # This is a basic implementation - real interplanetary trajectories
        # would require much more sophisticated orbital mechanics
        
        # Assume we're transferring between planetary orbits
        departure_distance = self.planetary_params.planetary_radius * 1.5  # 1.5 planetary radii
        arrival_distance = self.planetary_params.planetary_radius * 2.0    # 2.0 planetary radii
        
        for i in range(num_waypoints):
            t = i * dt
            timestamp = time.time() + t
            progress = i / (num_waypoints - 1)
            
            # Interpolate between departure and arrival
            current_distance = departure_distance + progress * (arrival_distance - departure_distance)
            
            # Calculate position (simplified)
            lat = start_pos.lat + progress * (target_pos.lat - start_pos.lat)
            lon = start_pos.lon + progress * (target_pos.lon - start_pos.lon)
            alt = current_distance - self.planetary_params.planetary_radius
            
            # Calculate velocity for transfer orbit
            transfer_velocity = math.sqrt(
                self.planetary_params.gravitational_parameter * 
                (2 / current_distance - 1 / ((departure_distance + arrival_distance) / 2))
            )
            
            # Velocity components (simplified)
            bearing = self._calculate_bearing(start_pos, target_pos)
            vel_north = transfer_velocity * math.cos(bearing)
            vel_east = transfer_velocity * math.sin(bearing)
            
            waypoint = Waypoint(
                latitude=lat,
                longitude=lon,
                altitude=alt,
                timestamp=timestamp,
                velocity_north=vel_north,
                velocity_east=vel_east,
                velocity_up=0.0,
                waypoint_id=f"interplanetary_{i}",
                waypoint_type="interplanetary"
            )
            
            waypoints.append(waypoint)
        
        return waypoints
    
    def _plan_emergency_trajectory(
        self,
        start_pos: LatLon,
        start_vel: Tuple[float, float],
        target_pos: LatLon,
        duration: float,
        num_waypoints: int
    ) -> List[Waypoint]:
        """Plan an emergency trajectory (direct, fastest route)."""
        waypoints = []
        dt = duration / (num_waypoints - 1)
        
        # Emergency trajectory - direct path with maximum safe velocity
        max_velocity = 1000.0  # Maximum safe velocity in m/s
        
        # Calculate direct distance
        direct_distance = Waypoint._great_circle_distance(
            start_pos.lat, start_pos.lon,
            target_pos.lat, target_pos.lon
        )
        
        # Calculate required velocity
        required_velocity = direct_distance / duration
        actual_velocity = min(required_velocity, max_velocity)
        
        # Calculate bearing
        bearing = self._calculate_bearing(start_pos, target_pos)
        
        for i in range(num_waypoints):
            t = i * dt
            timestamp = time.time() + t
            progress = i / (num_waypoints - 1)
            
            # Direct interpolation
            lat = start_pos.lat + progress * (target_pos.lat - start_pos.lat)
            lon = start_pos.lon + progress * (target_pos.lon - start_pos.lon)
            
            # Constant velocity
            vel_north = actual_velocity * math.cos(bearing)
            vel_east = actual_velocity * math.sin(bearing)
            
            waypoint = Waypoint(
                latitude=lat,
                longitude=lon,
                altitude=0.0,
                timestamp=timestamp,
                velocity_north=vel_north,
                velocity_east=vel_east,
                velocity_up=0.0,
                waypoint_id=f"emergency_{i}",
                waypoint_type="emergency"
            )
            
            waypoints.append(waypoint)
        
        return waypoints
    
    def _calculate_bearing(self, start_pos: LatLon, target_pos: LatLon) -> float:
        """Calculate bearing from start to target position."""
        lat1, lon1 = math.radians(start_pos.lat), math.radians(start_pos.lon)
        lat2, lon2 = math.radians(target_pos.lat), math.radians(target_pos.lon)
        
        dlon = lon2 - lon1
        
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        
        bearing = math.atan2(y, x)
        return bearing
    
    def _calculate_total_distance(self, waypoints: List[Waypoint]) -> float:
        """Calculate total distance of trajectory."""
        total_distance = 0.0
        
        for i in range(len(waypoints) - 1):
            distance = waypoints[i].distance_to(waypoints[i + 1])
            total_distance += distance
        
        return total_distance
    
    def _estimate_trajectory_confidence(
        self,
        trajectory_type: TrajectoryType,
        waypoints: List[Waypoint],
        constraints: Optional[Dict[str, Any]]
    ) -> float:
        """Estimate confidence in trajectory accuracy."""
        base_confidence = {
            TrajectoryType.LINEAR: 0.9,
            TrajectoryType.ORBITAL: 0.8,
            TrajectoryType.INTERPLANETARY: 0.6,
            TrajectoryType.EMERGENCY: 0.7
        }
        
        confidence = base_confidence.get(trajectory_type, 0.5)
        
        # Adjust based on constraints
        if constraints:
            if constraints.get("high_accuracy", False):
                confidence *= 0.9  # Slightly lower confidence for high accuracy requirements
            if constraints.get("real_time", False):
                confidence *= 0.8  # Lower confidence for real-time requirements
        
        # Adjust based on trajectory length
        if len(waypoints) > 50:
            confidence *= 0.9  # Slightly lower confidence for long trajectories
        
        return max(0.1, min(1.0, confidence))
    
    def _cache_trajectory(self, trajectory: Trajectory):
        """Cache a trajectory for future use."""
        self.trajectory_cache[trajectory.trajectory_id] = trajectory
        
        # Limit cache size
        if len(self.trajectory_cache) > self.max_cache_size:
            # Remove oldest trajectory
            oldest_id = min(self.trajectory_cache.keys())
            del self.trajectory_cache[oldest_id]
    
    def get_trajectory(self, trajectory_id: str) -> Optional[Trajectory]:
        """Get a cached trajectory by ID."""
        return self.trajectory_cache.get(trajectory_id)
    
    def get_planning_statistics(self) -> Dict[str, Any]:
        """Get trajectory planning statistics."""
        success_rate = (self.successful_plans / self.total_plans) if self.total_plans > 0 else 0.0
        avg_planning_time = sum(self.planning_time_history) / len(self.planning_time_history) if self.planning_time_history else 0.0
        
        return {
            "total_plans": self.total_plans,
            "successful_plans": self.successful_plans,
            "success_rate": success_rate,
            "average_planning_time": avg_planning_time,
            "cached_trajectories": len(self.trajectory_cache),
            "planetary_parameters": {
                "radius": self.planetary_params.planetary_radius,
                "gravitational_parameter": self.planetary_params.gravitational_parameter,
                "rotation_rate": self.planetary_params.rotation_rate
            }
        }
    
    def clear_cache(self):
        """Clear the trajectory cache."""
        self.trajectory_cache.clear()
        logger.info("Trajectory cache cleared")