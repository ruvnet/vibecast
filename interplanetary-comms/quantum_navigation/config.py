"""Configuration module for quantum navigation system.

This module provides configuration management for the quantum-magnetic
navigation system integration with IPCP.
"""

from __future__ import annotations

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path


@dataclass
class NavigationConfig:
    """Configuration for quantum navigation system."""
    
    # EKF Parameters
    process_noise: float = 0.01
    measurement_noise: float = 0.05
    position_uncertainty: float = 1.0
    velocity_uncertainty: float = 0.01
    
    # Magnetic Map
    magnetic_map_path: Optional[str] = None
    interpolation_method: str = "bilinear"
    
    # Navigation System
    max_history_size: int = 1000
    update_interval: float = 1.0  # seconds
    
    # Trajectory Planning
    default_trajectory_duration: float = 3600.0  # seconds
    default_waypoint_count: int = 10
    max_trajectory_cache_size: int = 100
    
    # Planetary Parameters
    planetary_radius: float = 6371000.0  # Earth radius in meters
    gravitational_parameter: float = 3.986004418e14  # Earth GM in m³/s²
    rotation_rate: float = 7.292115e-5  # Earth rotation rate in rad/s
    atmosphere_height: float = 100000.0  # meters
    magnetic_field_strength: float = 50000.0  # nT
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "ekf": {
                "process_noise": self.process_noise,
                "measurement_noise": self.measurement_noise,
                "position_uncertainty": self.position_uncertainty,
                "velocity_uncertainty": self.velocity_uncertainty
            },
            "magnetic_map": {
                "path": self.magnetic_map_path,
                "interpolation_method": self.interpolation_method
            },
            "navigation": {
                "max_history_size": self.max_history_size,
                "update_interval": self.update_interval
            },
            "trajectory": {
                "default_duration": self.default_trajectory_duration,
                "default_waypoint_count": self.default_waypoint_count,
                "max_cache_size": self.max_trajectory_cache_size
            },
            "planetary": {
                "radius": self.planetary_radius,
                "gravitational_parameter": self.gravitational_parameter,
                "rotation_rate": self.rotation_rate,
                "atmosphere_height": self.atmosphere_height,
                "magnetic_field_strength": self.magnetic_field_strength
            }
        }


@dataclass
class IPCPConfig:
    """Configuration for IPCP integration."""
    
    # Network Parameters
    node_id: str = "quantum_nav_node"
    max_communication_range: float = 1000000.0  # 1000 km
    default_bandwidth: float = 1000000.0  # 1 Mbps
    default_latency: float = 100.0  # 100 ms
    
    # Routing
    route_cache_ttl: float = 300.0  # seconds
    max_route_cache_size: int = 1000
    max_hops: int = 10
    
    # Message Queue
    max_queue_size: int = 1000
    default_message_ttl: float = 3600.0  # seconds
    
    # Reliability
    default_reliability_score: float = 0.8
    min_reliability_threshold: float = 0.5
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "network": {
                "node_id": self.node_id,
                "max_communication_range": self.max_communication_range,
                "default_bandwidth": self.default_bandwidth,
                "default_latency": self.default_latency
            },
            "routing": {
                "cache_ttl": self.route_cache_ttl,
                "max_cache_size": self.max_route_cache_size,
                "max_hops": self.max_hops
            },
            "messaging": {
                "max_queue_size": self.max_queue_size,
                "default_ttl": self.default_message_ttl
            },
            "reliability": {
                "default_score": self.default_reliability_score,
                "min_threshold": self.min_reliability_threshold
            }
        }


@dataclass
class SystemConfig:
    """Complete system configuration."""
    
    navigation: NavigationConfig
    ipcp: IPCPConfig
    
    # Logging
    log_level: str = "INFO"
    log_file: Optional[str] = None
    
    # Data Storage
    data_directory: str = "./quantum_nav_data"
    backup_interval: float = 300.0  # seconds
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "navigation": self.navigation.to_dict(),
            "ipcp": self.ipcp.to_dict(),
            "logging": {
                "level": self.log_level,
                "file": self.log_file
            },
            "storage": {
                "data_directory": self.data_directory,
                "backup_interval": self.backup_interval
            }
        }


class ConfigManager:
    """Configuration manager for the quantum navigation system."""
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize configuration manager.
        
        Args:
            config_path: Path to configuration file
        """
        self.config_path = config_path
        self.config = self._load_default_config()
        
        if config_path and os.path.exists(config_path):
            self._load_from_file(config_path)
    
    def _load_default_config(self) -> SystemConfig:
        """Load default configuration."""
        nav_config = NavigationConfig()
        ipcp_config = IPCPConfig()
        
        return SystemConfig(
            navigation=nav_config,
            ipcp=ipcp_config
        )
    
    def _load_from_file(self, config_path: str):
        """Load configuration from file.
        
        Args:
            config_path: Path to configuration file
        """
        try:
            import json
            with open(config_path, 'r') as f:
                config_data = json.load(f)
            
            # Update configuration with file data
            self._update_from_dict(config_data)
            
        except Exception as e:
            import logging
            logging.error(f"Failed to load configuration from {config_path}: {e}")
    
    def _update_from_dict(self, config_data: Dict[str, Any]):
        """Update configuration from dictionary.
        
        Args:
            config_data: Configuration dictionary
        """
        # Update navigation config
        if "navigation" in config_data:
            nav_data = config_data["navigation"]
            
            if "ekf" in nav_data:
                ekf_data = nav_data["ekf"]
                self.config.navigation.process_noise = ekf_data.get("process_noise", self.config.navigation.process_noise)
                self.config.navigation.measurement_noise = ekf_data.get("measurement_noise", self.config.navigation.measurement_noise)
                self.config.navigation.position_uncertainty = ekf_data.get("position_uncertainty", self.config.navigation.position_uncertainty)
                self.config.navigation.velocity_uncertainty = ekf_data.get("velocity_uncertainty", self.config.navigation.velocity_uncertainty)
            
            if "magnetic_map" in nav_data:
                map_data = nav_data["magnetic_map"]
                self.config.navigation.magnetic_map_path = map_data.get("path", self.config.navigation.magnetic_map_path)
                self.config.navigation.interpolation_method = map_data.get("interpolation_method", self.config.navigation.interpolation_method)
            
            if "trajectory" in nav_data:
                traj_data = nav_data["trajectory"]
                self.config.navigation.default_trajectory_duration = traj_data.get("default_duration", self.config.navigation.default_trajectory_duration)
                self.config.navigation.default_waypoint_count = traj_data.get("default_waypoint_count", self.config.navigation.default_waypoint_count)
        
        # Update IPCP config
        if "ipcp" in config_data:
            ipcp_data = config_data["ipcp"]
            
            if "network" in ipcp_data:
                net_data = ipcp_data["network"]
                self.config.ipcp.node_id = net_data.get("node_id", self.config.ipcp.node_id)
                self.config.ipcp.max_communication_range = net_data.get("max_communication_range", self.config.ipcp.max_communication_range)
            
            if "routing" in ipcp_data:
                route_data = ipcp_data["routing"]
                self.config.ipcp.route_cache_ttl = route_data.get("cache_ttl", self.config.ipcp.route_cache_ttl)
                self.config.ipcp.max_hops = route_data.get("max_hops", self.config.ipcp.max_hops)
    
    def save_to_file(self, config_path: str):
        """Save configuration to file.
        
        Args:
            config_path: Path to save configuration
        """
        try:
            import json
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(config_path), exist_ok=True)
            
            with open(config_path, 'w') as f:
                json.dump(self.config.to_dict(), f, indent=2)
                
        except Exception as e:
            import logging
            logging.error(f"Failed to save configuration to {config_path}: {e}")
    
    def get_navigation_config(self) -> NavigationConfig:
        """Get navigation configuration."""
        return self.config.navigation
    
    def get_ipcp_config(self) -> IPCPConfig:
        """Get IPCP configuration."""
        return self.config.ipcp
    
    def get_system_config(self) -> SystemConfig:
        """Get complete system configuration."""
        return self.config
    
    def update_navigation_config(self, **kwargs):
        """Update navigation configuration parameters."""
        for key, value in kwargs.items():
            if hasattr(self.config.navigation, key):
                setattr(self.config.navigation, key, value)
    
    def update_ipcp_config(self, **kwargs):
        """Update IPCP configuration parameters."""
        for key, value in kwargs.items():
            if hasattr(self.config.ipcp, key):
                setattr(self.config.ipcp, key, value)
    
    def validate_config(self) -> bool:
        """Validate configuration parameters.
        
        Returns:
            True if configuration is valid, False otherwise
        """
        # Check navigation parameters
        if self.config.navigation.process_noise <= 0:
            return False
        
        if self.config.navigation.measurement_noise <= 0:
            return False
        
        if self.config.navigation.position_uncertainty <= 0:
            return False
        
        # Check IPCP parameters
        if self.config.ipcp.max_communication_range <= 0:
            return False
        
        if self.config.ipcp.route_cache_ttl <= 0:
            return False
        
        if self.config.ipcp.max_hops <= 0:
            return False
        
        # Check magnetic map path if provided
        if self.config.navigation.magnetic_map_path:
            if not os.path.exists(self.config.navigation.magnetic_map_path):
                return False
        
        return True


def create_default_config_file(config_path: str):
    """Create a default configuration file.
    
    Args:
        config_path: Path where to create the configuration file
    """
    config_manager = ConfigManager()
    config_manager.save_to_file(config_path)


def load_config(config_path: Optional[str] = None) -> ConfigManager:
    """Load configuration from file or create default.
    
    Args:
        config_path: Optional path to configuration file
        
    Returns:
        ConfigManager instance
    """
    return ConfigManager(config_path)