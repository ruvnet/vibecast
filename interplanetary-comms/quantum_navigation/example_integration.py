#!/usr/bin/env python3
"""Example integration script for quantum-magnetic navigation with IPCP.

This script demonstrates how to integrate the quantum-magnetic navigation
system with the Interplanetary Communication Protocol (IPCP) for
position-aware routing and communication optimization.
"""

import logging
import time
import random
from typing import Dict, Any, Optional

# Import quantum navigation components
from quantum_navigator import QuantumNavigator
from position_estimator import PositionEstimator, EstimationParameters
from trajectory_planner import TrajectoryPlanner, PlanetaryParameters, TrajectoryType
from ipcp_integration import IPCPPositionProvider, IPCPNode, IPCPMessage, IPCPPriority, RouteOptimization
from config import ConfigManager, create_default_config_file

# Import from the quantum-magnetic-navigation codebase
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../quantum-magnetic-navigation/src'))

from qmag_nav.models.geo import LatLon
from qmag_nav.models.sensor import MagnetometerReading

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class QuantumNavigationDemo:
    """Demonstration of quantum navigation integration with IPCP."""
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize the demonstration.
        
        Args:
            config_path: Path to configuration file
        """
        # Load configuration
        if config_path is None:
            config_path = "quantum_nav_config.json"
            create_default_config_file(config_path)
        
        self.config_manager = ConfigManager(config_path)
        self.nav_config = self.config_manager.get_navigation_config()
        self.ipcp_config = self.config_manager.get_ipcp_config()
        
        # Initialize components
        self.quantum_navigator: Optional[QuantumNavigator] = None
        self.position_estimator: Optional[PositionEstimator] = None
        self.trajectory_planner: Optional[TrajectoryPlanner] = None
        self.ipcp_provider: Optional[IPCPPositionProvider] = None
        
        logger.info("Quantum Navigation Demo initialized")
    
    def setup_navigation_system(self):
        """Set up the quantum navigation system."""
        logger.info("Setting up quantum navigation system...")
        
        # Initialize quantum navigator
        initial_position = LatLon(lat=40.7128, lon=-74.0060)  # NYC coordinates
        self.quantum_navigator = QuantumNavigator(
            magnetic_map_path=self.nav_config.magnetic_map_path,
            process_noise=self.nav_config.process_noise,
            measurement_noise=self.nav_config.measurement_noise,
            initial_position=initial_position,
            initial_velocity=(0.0, 0.0)
        )
        
        # Initialize position estimator
        estimation_params = EstimationParameters(
            process_noise=self.nav_config.process_noise,
            measurement_noise=self.nav_config.measurement_noise,
            position_uncertainty=self.nav_config.position_uncertainty,
            velocity_uncertainty=self.nav_config.velocity_uncertainty,
            magnetic_map_path=self.nav_config.magnetic_map_path
        )
        
        self.position_estimator = PositionEstimator(estimation_params)
        self.position_estimator.initialize(initial_position)
        
        # Initialize trajectory planner
        planetary_params = PlanetaryParameters(
            planetary_radius=self.nav_config.planetary_radius,
            gravitational_parameter=self.nav_config.gravitational_parameter,
            rotation_rate=self.nav_config.rotation_rate,
            atmosphere_height=self.nav_config.atmosphere_height,
            magnetic_field_strength=self.nav_config.magnetic_field_strength
        )
        
        self.trajectory_planner = TrajectoryPlanner(planetary_params)
        
        logger.info("Quantum navigation system setup complete")
    
    def setup_ipcp_integration(self):
        """Set up IPCP integration."""
        logger.info("Setting up IPCP integration...")
        
        # Initialize IPCP provider
        self.ipcp_provider = IPCPPositionProvider(
            quantum_navigator=self.quantum_navigator,
            position_estimator=self.position_estimator,
            trajectory_planner=self.trajectory_planner,
            node_id=self.ipcp_config.node_id
        )
        
        # Register some example nodes for demonstration
        self._register_example_nodes()
        
        logger.info("IPCP integration setup complete")
    
    def _register_example_nodes(self):
        """Register example nodes for demonstration."""
        # Earth stations
        earth_station_1 = IPCPNode(
            node_id="earth_station_1",
            position=LatLon(lat=40.7128, lon=-74.0060),  # NYC
            altitude=100.0,
            capabilities=["laser_comm", "radio_comm", "quantum_key_dist"],
            status="active",
            last_seen=time.time(),
            reliability_score=0.95,
            bandwidth_capacity=1000000000,  # 1 Gbps
            latency_ms=50.0
        )
        
        earth_station_2 = IPCPNode(
            node_id="earth_station_2",
            position=LatLon(lat=51.5074, lon=-0.1278),  # London
            altitude=150.0,
            capabilities=["laser_comm", "radio_comm", "quantum_key_dist"],
            status="active",
            last_seen=time.time(),
            reliability_score=0.92,
            bandwidth_capacity=800000000,  # 800 Mbps
            latency_ms=60.0
        )
        
        # Lagrange point relay
        l4_relay = IPCPNode(
            node_id="earth_sun_l4_relay",
            position=LatLon(lat=0.0, lon=60.0),  # Approximate L4 position
            altitude=150000000.0,  # 150,000 km from Earth
            capabilities=["laser_comm", "radio_comm", "quantum_key_dist", "relay"],
            status="active",
            last_seen=time.time(),
            reliability_score=0.85,
            bandwidth_capacity=500000000,  # 500 Mbps
            latency_ms=500.0
        )
        
        # Mars station
        mars_station = IPCPNode(
            node_id="mars_station_1",
            position=LatLon(lat=-14.5684, lon=175.4725),  # Mars coordinates
            altitude=1000.0,
            capabilities=["laser_comm", "radio_comm", "quantum_key_dist"],
            status="active",
            last_seen=time.time(),
            reliability_score=0.80,
            bandwidth_capacity=100000000,  # 100 Mbps
            latency_ms=1200.0  # Higher latency due to distance
        )
        
        # Register nodes
        self.ipcp_provider.register_node(earth_station_1)
        self.ipcp_provider.register_node(earth_station_2)
        self.ipcp_provider.register_node(l4_relay)
        self.ipcp_provider.register_node(mars_station)
        
        logger.info("Registered 4 example nodes")
    
    def simulate_magnetic_measurements(self, duration: float = 60.0, interval: float = 1.0):
        """Simulate magnetic field measurements and navigation updates.
        
        Args:
            duration: Total simulation duration in seconds
            interval: Measurement interval in seconds
        """
        logger.info(f"Starting magnetic measurement simulation for {duration} seconds...")
        
        start_time = time.time()
        measurement_count = 0
        
        while time.time() - start_time < duration:
            # Simulate magnetometer reading
            # In a real system, this would come from actual sensors
            magnetic_reading = MagnetometerReading(
                timestamp=time.time(),
                bx=random.uniform(-65000, -45000),  # Earth's magnetic field range
                by=random.uniform(-5000, 5000),
                bz=random.uniform(20000, 40000),
                quality=random.uniform(0.8, 1.0)
            )
            
            # Update navigation systems
            nav_fix = self.quantum_navigator.update_position(magnetic_reading, interval)
            est_result = self.position_estimator.update(magnetic_reading, interval)
            
            measurement_count += 1
            
            # Log progress every 10 measurements
            if measurement_count % 10 == 0:
                if nav_fix:
                    logger.info(f"Navigation fix #{measurement_count}: "
                              f"({nav_fix.latitude:.6f}, {nav_fix.longitude:.6f}) "
                              f"quality={nav_fix.quality_factor:.3f}")
                
                if est_result:
                    logger.info(f"Estimation result #{measurement_count}: "
                              f"({est_result.position.lat:.6f}, {est_result.position.lon:.6f}) "
                              f"convergence={est_result.convergence_status}")
            
            time.sleep(interval)
        
        logger.info(f"Magnetic measurement simulation complete. Total measurements: {measurement_count}")
    
    def demonstrate_trajectory_planning(self):
        """Demonstrate trajectory planning capabilities."""
        logger.info("Demonstrating trajectory planning...")
        
        # Get current position
        current_position = self.quantum_navigator.current_fix
        if not current_position:
            logger.error("No current position available for trajectory planning")
            return
        
        start_pos = LatLon(lat=current_position.latitude, lon=current_position.longitude)
        start_vel = (current_position.velocity_north, current_position.velocity_east)
        
        # Plan different types of trajectories
        trajectory_types = [
            TrajectoryType.LINEAR,
            TrajectoryType.ORBITAL,
            TrajectoryType.INTERPLANETARY,
            TrajectoryType.EMERGENCY
        ]
        
        for traj_type in trajectory_types:
            # Target position (Mars for interplanetary, nearby for others)
            if traj_type == TrajectoryType.INTERPLANETARY:
                target_pos = LatLon(lat=-14.5684, lon=175.4725)  # Mars
                duration = 86400 * 300  # 300 days
            else:
                target_pos = LatLon(lat=start_pos.lat + 10, lon=start_pos.lon + 10)
                duration = 3600  # 1 hour
            
            trajectory = self.trajectory_planner.plan_trajectory(
                start_position=start_pos,
                start_velocity=start_vel,
                target_position=target_pos,
                trajectory_type=traj_type,
                duration=duration,
                num_waypoints=5
            )
            
            if trajectory:
                logger.info(f"{traj_type.value} trajectory planned: "
                          f"{len(trajectory.waypoints)} waypoints, "
                          f"distance={trajectory.total_distance:.0f}m, "
                          f"confidence={trajectory.confidence:.3f}")
            else:
                logger.warning(f"Failed to plan {traj_type.value} trajectory")
        
        logger.info("Trajectory planning demonstration complete")
    
    def demonstrate_ipcp_routing(self):
        """Demonstrate IPCP routing capabilities."""
        logger.info("Demonstrating IPCP routing...")
        
        # Test different routing strategies
        optimization_strategies = [
            RouteOptimization.SHORTEST_PATH,
            RouteOptimization.FASTEST_ROUTE,
            RouteOptimization.MOST_RELIABLE,
            RouteOptimization.ENERGY_EFFICIENT
        ]
        
        source_node = "earth_station_1"
        destination_node = "mars_station_1"
        
        for optimization in optimization_strategies:
            route_result = self.ipcp_provider.calculate_route(
                source_node=source_node,
                destination_node=destination_node,
                optimization=optimization
            )
            
            if route_result:
                route, metrics = route_result
                logger.info(f"{optimization.value} route: {' -> '.join(route)}")
                logger.info(f"  Distance: {metrics.total_distance:.0f}m")
                logger.info(f"  Latency: {metrics.estimated_latency:.3f}s")
                logger.info(f"  Reliability: {metrics.reliability_score:.3f}")
                logger.info(f"  Hops: {metrics.hop_count}")
            else:
                logger.warning(f"No route found using {optimization.value}")
        
        logger.info("IPCP routing demonstration complete")
    
    def demonstrate_message_handling(self):
        """Demonstrate message queuing and handling."""
        logger.info("Demonstrating message handling...")
        
        # Create test messages
        messages = [
            IPCPMessage(
                message_id="msg_001",
                source_node="earth_station_1",
                destination_node="mars_station_1",
                priority=IPCPPriority.HIGH,
                payload=b"High priority scientific data",
                timestamp=time.time()
            ),
            IPCPMessage(
                message_id="msg_002",
                source_node="earth_station_2",
                destination_node="earth_sun_l4_relay",
                priority=IPCPPriority.NORMAL,
                payload=b"Routine telemetry update",
                timestamp=time.time()
            ),
            IPCPMessage(
                message_id="msg_003",
                source_node="mars_station_1",
                destination_node="earth_station_1",
                priority=IPCPPriority.EMERGENCY,
                payload=b"Emergency status report",
                timestamp=time.time()
            )
        ]
        
        # Queue messages
        for message in messages:
            self.ipcp_provider.queue_message(message)
            logger.info(f"Queued message {message.message_id} "
                      f"({message.priority.name} priority)")
        
        # Process message queue
        deliverable_messages = self.ipcp_provider.process_message_queue()
        logger.info(f"Found {len(deliverable_messages)} deliverable messages")
        
        for message in deliverable_messages:
            logger.info(f"Message {message.message_id} ready for delivery")
        
        logger.info("Message handling demonstration complete")
    
    def print_system_status(self):
        """Print comprehensive system status."""
        logger.info("=== QUANTUM NAVIGATION SYSTEM STATUS ===")
        
        # Navigation system status
        nav_status = self.quantum_navigator.get_navigation_status()
        logger.info(f"Navigation State: {nav_status['state']}")
        logger.info(f"Total Fixes: {nav_status['statistics']['total_fixes']}")
        logger.info(f"Success Rate: {nav_status['statistics']['success_rate']:.3f}")
        
        if nav_status['current_fix']:
            fix = nav_status['current_fix']
            logger.info(f"Current Position: ({fix['latitude']:.6f}, {fix['longitude']:.6f})")
            logger.info(f"Quality Factor: {fix['quality_factor']:.3f}")
        
        # Position estimator status
        est_stats = self.position_estimator.get_estimation_statistics()
        logger.info(f"Estimation Success Rate: {est_stats['success_rate']:.3f}")
        logger.info(f"Average Quality Score: {est_stats['average_quality_score']:.3f}")
        
        # Trajectory planner status
        traj_stats = self.trajectory_planner.get_planning_statistics()
        logger.info(f"Trajectory Planning Success Rate: {traj_stats['success_rate']:.3f}")
        logger.info(f"Cached Trajectories: {traj_stats['cached_trajectories']}")
        
        # IPCP network status
        network_status = self.ipcp_provider.get_network_status()
        logger.info(f"Network Nodes: {network_status['total_nodes']} "
                  f"({network_status['active_nodes']} active)")
        logger.info(f"Cached Routes: {network_status['cached_routes']}")
        logger.info(f"Message Queue: {network_status['message_queue_size']} messages")
        
        logger.info("=== STATUS REPORT COMPLETE ===")
    
    def run_comprehensive_demo(self):
        """Run a comprehensive demonstration of all capabilities."""
        logger.info("Starting comprehensive quantum navigation demonstration...")
        
        try:
            # Setup systems
            self.setup_navigation_system()
            self.setup_ipcp_integration()
            
            # Run magnetic measurement simulation
            self.simulate_magnetic_measurements(duration=30.0, interval=1.0)
            
            # Demonstrate trajectory planning
            self.demonstrate_trajectory_planning()
            
            # Demonstrate IPCP routing
            self.demonstrate_ipcp_routing()
            
            # Demonstrate message handling
            self.demonstrate_message_handling()
            
            # Print final status
            self.print_system_status()
            
            logger.info("Comprehensive demonstration completed successfully!")
            
        except Exception as e:
            logger.error(f"Demonstration failed: {e}")
            raise


def main():
    """Main function."""
    logger.info("Quantum Navigation IPCP Integration Demo")
    logger.info("=" * 50)
    
    # Create and run demonstration
    demo = QuantumNavigationDemo()
    demo.run_comprehensive_demo()


if __name__ == "__main__":
    main()