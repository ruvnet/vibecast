#!/usr/bin/env python3
"""
Interplanetary Communication Protocol Simulator
Simulates quantum-classical hybrid communication across the solar system
"""

import numpy as np
import random
import time
from dataclasses import dataclass
from typing import List, Dict, Tuple
from enum import Enum
try:
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    # Mock matplotlib for when it's not available
    class MockPlt:
        @staticmethod
        def figure(**kwargs):
            pass
        @staticmethod
        def scatter(*args, **kwargs):
            pass
        @staticmethod
        def plot(*args, **kwargs):
            pass
        @staticmethod
        def annotate(*args, **kwargs):
            pass
        @staticmethod
        def xlabel(*args, **kwargs):
            pass
        @staticmethod
        def ylabel(*args, **kwargs):
            pass
        @staticmethod
        def title(*args, **kwargs):
            pass
        @staticmethod
        def legend(*args, **kwargs):
            pass
        @staticmethod
        def grid(*args, **kwargs):
            pass
        @staticmethod
        def axis(*args, **kwargs):
            pass
        @staticmethod
        def tight_layout(*args, **kwargs):
            pass
        @staticmethod
        def savefig(*args, **kwargs):
            print(f"Plot would be saved to {args[0] if args else 'unknown'}")
        @staticmethod
        def close(*args, **kwargs):
            pass
        @staticmethod
        def subplots(*args, **kwargs):
            # Return mock figure and axes
            return MockFig(), [MockAxes(), MockAxes(), MockAxes(), MockAxes()]
        @staticmethod
        def setp(*args, **kwargs):
            pass
    
    class MockFig:
        pass
    
    class MockAxes:
        def hist(self, *args, **kwargs):
            pass
        def bar(self, *args, **kwargs):
            pass
        def set_xlabel(self, *args, **kwargs):
            pass
        def set_ylabel(self, *args, **kwargs):
            pass
        def set_title(self, *args, **kwargs):
            pass
        def set_xticks(self, *args, **kwargs):
            pass
        def set_xticklabels(self, *args, **kwargs):
            pass
        @property
        def xaxis(self):
            return MockXAxis()
    
    class MockXAxis:
        def get_majorticklabels(self):
            return []
    
    plt = MockPlt()
from queue import PriorityQueue
import hashlib
# Constants

SPEED_OF_LIGHT = 299792458  # m/s
AU = 149597870700  # meters in 1 AU

class CelestialBody(Enum):
    EARTH = "Earth"
    MARS = "Mars"
    L4_EARTH = "Earth-Sun L4"
    L5_EARTH = "Earth-Sun L5"
    L4_MARS = "Mars-Sun L4"
    L5_MARS = "Mars-Sun L5"

@dataclass
class OrbitalPosition:
    """Represents position of a celestial body"""
    body: CelestialBody
    distance_from_sun: float  # AU
    angle: float  # radians
    
    def to_cartesian(self) -> Tuple[float, float]:
        x = self.distance_from_sun * np.cos(self.angle)
        y = self.distance_from_sun * np.sin(self.angle)
        return x, y

@dataclass
class QuantumState:
    """Represents a quantum state for QKD"""
    bit_value: int
    basis: str  # 'rectilinear' or 'diagonal'
    timestamp: float
    entangled_pair_id: str = None

@dataclass
class Message:
    """Represents a message in the communication system"""
    id: str
    source: CelestialBody
    destination: CelestialBody
    priority: int  # 0-4 (0 highest)
    data_size: int  # bytes
    timestamp: float
    quantum_encrypted: bool = True
    compression_ratio: float = 10.0

class QuantumChannel:
    """Simulates quantum communication channel"""
    
    def __init__(self, source: CelestialBody, destination: CelestialBody):
        self.source = source
        self.destination = destination
        self.qber = 0.03  # Quantum Bit Error Rate (3%)
        self.key_buffer = []
        self.entanglement_fidelity = 0.95
        
    def generate_quantum_key(self, length: int) -> Tuple[List[int], float]:
        """Generate quantum key using BB84 protocol"""
        # Alice generates random bits and bases
        alice_bits = [random.randint(0, 1) for _ in range(length * 2)]
        alice_bases = [random.choice(['rectilinear', 'diagonal']) for _ in range(length * 2)]
        
        # Bob chooses random measurement bases
        bob_bases = [random.choice(['rectilinear', 'diagonal']) for _ in range(length * 2)]
        
        # Sifting - keep only matching bases
        sifted_key = []
        for i in range(length * 2):
            if alice_bases[i] == bob_bases[i]:
                # Add quantum noise
                if random.random() < self.qber:
                    sifted_key.append(1 - alice_bits[i])  # Bit flip error
                else:
                    sifted_key.append(alice_bits[i])
        
        # Privacy amplification (simple XOR compression)
        final_key = []
        for i in range(0, len(sifted_key) - 1, 2):
            if i + 1 < len(sifted_key):
                final_key.append(sifted_key[i] ^ sifted_key[i + 1])
        
        # Calculate key generation rate (bits/second)
        # Accounting for sifting loss and privacy amplification
        efficiency = len(final_key) / (length * 2)
        key_rate = efficiency * 1e6  # Assuming 1 MHz photon rate
        
        return final_key[:length], key_rate
    
    def test_bell_inequality(self) -> bool:
        """Test CHSH Bell inequality for entanglement verification"""
        # Simulate measurements at different angles
        measurements = 1000
        correlations = []
        
        angles = [(0, np.pi/8), (0, 3*np.pi/8), (np.pi/4, np.pi/8), (np.pi/4, 3*np.pi/8)]
        
        for a1, a2 in angles:
            correlation = 0
            for _ in range(measurements):
                # Quantum correlation for entangled states
                if random.random() < self.entanglement_fidelity:
                    # Perfect correlation
                    correlation += np.cos(2 * (a1 - a2))
                else:
                    # Random correlation (noise)
                    correlation += random.uniform(-1, 1)
            correlations.append(correlation / measurements)
        
        # CHSH value
        S = abs(correlations[0] - correlations[1] + correlations[2] + correlations[3])
        
        return S > 2  # Violation of classical bound

class ClassicalChannel:
    """Simulates classical communication channel"""
    
    def __init__(self, source: CelestialBody, destination: CelestialBody, bandwidth: float):
        self.source = source
        self.destination = destination
        self.bandwidth = bandwidth  # bits/second
        self.packet_loss_rate = 0.001
        self.bit_error_rate = 1e-9
        
    def calculate_delay(self, source_pos: OrbitalPosition, dest_pos: OrbitalPosition) -> float:
        """Calculate propagation delay between two positions"""
        x1, y1 = source_pos.to_cartesian()
        x2, y2 = dest_pos.to_cartesian()
        
        distance_au = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
        distance_m = distance_au * AU
        delay_seconds = distance_m / SPEED_OF_LIGHT
        
        return delay_seconds
    
    def transmit_message(self, message: Message, delay: float) -> Tuple[bool, float]:
        """Simulate message transmission"""
        # Check for packet loss
        if random.random() < self.packet_loss_rate:
            return False, 0
        
        # Calculate transmission time
        effective_size = message.data_size / message.compression_ratio
        transmission_time = effective_size * 8 / self.bandwidth
        
        # Total time including propagation delay
        total_time = delay + transmission_time
        
        # Simulate bit errors
        bit_errors = np.random.binomial(effective_size * 8, self.bit_error_rate)
        
        # Reed-Solomon can correct up to t errors where t = (n-k)/2
        # Assuming 25% overhead, we can correct ~12.5% errors
        max_correctable = int(effective_size * 8 * 0.125)
        
        success = bit_errors <= max_correctable
        
        return success, total_time

class RelayStation:
    """Represents a relay station at Lagrange point"""
    
    def __init__(self, location: CelestialBody, storage_capacity: int):
        self.location = location
        self.storage_capacity = storage_capacity  # bytes
        self.storage_used = 0
        self.message_queue = PriorityQueue()
        self.cached_data = {}
        self.quantum_memory_coherence = 1.0  # seconds
        
    def store_message(self, message: Message) -> bool:
        """Store message in relay station"""
        if self.storage_used + message.data_size > self.storage_capacity:
            return False
        
        self.storage_used += message.data_size
        self.message_queue.put((message.priority, message.timestamp, message))
        return True
    
    def retrieve_message(self) -> Message:
        """Retrieve highest priority message"""
        if not self.message_queue.empty():
            _, _, message = self.message_queue.get()
            self.storage_used -= message.data_size
            return message
        return None
    
    def cache_hit_rate(self) -> float:
        """Calculate cache hit rate for predictive caching"""
        # Simplified cache simulation
        return 0.6  # 60% hit rate

class InterplanetaryNetwork:
    """Main simulation class for the interplanetary communication network"""
    
    def __init__(self):
        self.nodes = {}
        self.quantum_channels = {}
        self.classical_channels = {}
        self.relay_stations = {}
        self.current_time = 0
        self.message_log = []
        
        # Initialize network topology
        self._initialize_network()
        
    def _initialize_network(self):
        """Set up the network with all nodes and channels"""
        # Initialize positions (simplified circular orbits)
        self.nodes = {
            CelestialBody.EARTH: OrbitalPosition(CelestialBody.EARTH, 1.0, 0),
            CelestialBody.MARS: OrbitalPosition(CelestialBody.MARS, 1.5, np.pi/4),
            CelestialBody.L4_EARTH: OrbitalPosition(CelestialBody.L4_EARTH, 1.0, np.pi/3),
            CelestialBody.L5_EARTH: OrbitalPosition(CelestialBody.L5_EARTH, 1.0, -np.pi/3),
            CelestialBody.L4_MARS: OrbitalPosition(CelestialBody.L4_MARS, 1.5, np.pi/4 + np.pi/3),
            CelestialBody.L5_MARS: OrbitalPosition(CelestialBody.L5_MARS, 1.5, np.pi/4 - np.pi/3)
        }
        
        # Initialize relay stations (100 PB each)
        for body in [CelestialBody.L4_EARTH, CelestialBody.L5_EARTH, 
                    CelestialBody.L4_MARS, CelestialBody.L5_MARS]:
            self.relay_stations[body] = RelayStation(body, 100 * 10**15)
        
        # Initialize channels between all pairs
        bodies = list(CelestialBody)
        for i, source in enumerate(bodies):
            for destination in bodies[i+1:]:
                # Quantum channels (lower bandwidth)
                self.quantum_channels[(source, destination)] = QuantumChannel(source, destination)
                self.quantum_channels[(destination, source)] = QuantumChannel(destination, source)
                
                # Classical channels (high bandwidth for direct, lower for relayed)
                if source in [CelestialBody.EARTH, CelestialBody.MARS] and \
                   destination in [CelestialBody.EARTH, CelestialBody.MARS]:
                    bandwidth = 1e9  # 1 Gbps direct link
                else:
                    bandwidth = 1e8  # 100 Mbps relay link
                    
                self.classical_channels[(source, destination)] = ClassicalChannel(source, destination, bandwidth)
                self.classical_channels[(destination, source)] = ClassicalChannel(destination, source, bandwidth)
    
    def update_positions(self, time_days: float):
        """Update orbital positions based on time"""
        # Simplified orbital mechanics
        earth_angular_velocity = 2 * np.pi / 365.25  # rad/day
        mars_angular_velocity = 2 * np.pi / 687  # rad/day
        
        for body, position in self.nodes.items():
            if 'EARTH' in body.value:
                position.angle += earth_angular_velocity * time_days
            elif 'MARS' in body.value:
                position.angle += mars_angular_velocity * time_days
    
    def find_best_route(self, source: CelestialBody, destination: CelestialBody) -> List[CelestialBody]:
        """Find optimal route considering current positions and relay availability"""
        # Direct route if no obstruction
        direct_delay = self._calculate_total_delay([source, destination])
        
        # Check if Sun is blocking direct path (simplified)
        source_angle = self.nodes[source].angle
        dest_angle = self.nodes[destination].angle
        angle_diff = abs(source_angle - dest_angle)
        
        if angle_diff > np.pi * 0.9 and angle_diff < np.pi * 1.1:
            # Sun is in the way, must use relay
            best_route = None
            best_delay = float('inf')
            
            # Try all relay combinations
            for relay in self.relay_stations:
                route = [source, relay, destination]
                delay = self._calculate_total_delay(route)
                if delay < best_delay:
                    best_delay = delay
                    best_route = route
            
            return best_route
        else:
            return [source, destination]
    
    def _calculate_total_delay(self, route: List[CelestialBody]) -> float:
        """Calculate total delay for a route"""
        total_delay = 0
        for i in range(len(route) - 1):
            source_pos = self.nodes[route[i]]
            dest_pos = self.nodes[route[i + 1]]
            channel = self.classical_channels[(route[i], route[i + 1])]
            total_delay += channel.calculate_delay(source_pos, dest_pos)
        return total_delay
    
    def send_message(self, message: Message) -> Dict:
        """Send a message through the network"""
        result = {
            'message_id': message.id,
            'success': False,
            'route': [],
            'total_delay': 0,
            'key_generation_rate': 0,
            'hops': 0
        }
        
        # Find best route
        route = self.find_best_route(message.source, message.destination)
        result['route'] = [body.value for body in route]
        result['hops'] = len(route) - 1
        
        # Generate quantum key if needed
        if message.quantum_encrypted:
            qchannel = self.quantum_channels[(route[0], route[-1])]
            key, key_rate = qchannel.generate_quantum_key(1024)
            result['key_generation_rate'] = key_rate
            
            # Verify quantum channel security
            if not qchannel.test_bell_inequality():
                result['error'] = "Quantum channel compromised"
                return result
        
        # Transmit through route
        current_position = 0
        total_delay = 0
        
        for i in range(len(route) - 1):
            source = route[i]
            destination = route[i + 1]
            
            # Use relay if intermediate hop
            if i > 0 and source in self.relay_stations:
                relay = self.relay_stations[source]
                if not relay.store_message(message):
                    result['error'] = f"Relay storage full at {source.value}"
                    return result
                
                # Simulate processing delay at relay
                total_delay += 0.1  # 100ms processing
                
                # Retrieve and forward
                message = relay.retrieve_message()
            
            # Transmit over classical channel
            channel = self.classical_channels[(source, destination)]
            source_pos = self.nodes[source]
            dest_pos = self.nodes[destination]
            delay = channel.calculate_delay(source_pos, dest_pos)
            
            success, transmission_time = channel.transmit_message(message, delay)
            
            if not success:
                result['error'] = f"Transmission failed between {source.value} and {destination.value}"
                return result
            
            total_delay += transmission_time
        
        result['success'] = True
        result['total_delay'] = total_delay
        
        # Log the message
        self.message_log.append({
            'timestamp': self.current_time,
            'message': message,
            'result': result
        })
        
        return result
    
    def simulate_traffic(self, duration_hours: int, messages_per_hour: int):
        """Simulate network traffic over time"""
        results = []
        
        for hour in range(duration_hours):
            # Update positions (1 hour = 1/24 day)
            self.update_positions(1/24)
            self.current_time = hour
            
            # Generate random messages
            for _ in range(messages_per_hour):
                # Random source and destination
                source = random.choice([CelestialBody.EARTH, CelestialBody.MARS])
                destination = CelestialBody.MARS if source == CelestialBody.EARTH else CelestialBody.EARTH
                
                # Random priority and size
                priority = random.choices([0, 1, 2, 3, 4], weights=[5, 10, 30, 40, 15])[0]
                data_size = random.randint(1024, 10 * 1024 * 1024)  # 1KB to 10MB
                
                message = Message(
                    id=hashlib.md5(f"{hour}_{_}".encode()).hexdigest()[:8],
                    source=source,
                    destination=destination,
                    priority=priority,
                    data_size=data_size,
                    timestamp=self.current_time,
                    quantum_encrypted=(priority <= 2)  # Encrypt high priority
                )
                
                result = self.send_message(message)
                results.append(result)
        
        return results
    
    def generate_performance_report(self, results: List[Dict]) -> Dict:
        """Generate network performance statistics"""
        successful = [r for r in results if r['success']]
        failed = [r for r in results if not r['success']]
        
        if not successful:
            return {"error": "No successful transmissions"}
        
        delays = [r['total_delay'] for r in successful]
        hops = [r['hops'] for r in successful]
        
        report = {
            'total_messages': len(results),
            'successful': len(successful),
            'failed': len(failed),
            'success_rate': len(successful) / len(results) * 100,
            'average_delay': np.mean(delays),
            'max_delay': np.max(delays),
            'min_delay': np.min(delays),
            'average_hops': np.mean(hops),
            'relay_usage': sum(1 for r in successful if r['hops'] > 1) / len(successful) * 100
        }
        
        # Priority breakdown
        for priority in range(5):
            priority_results = []
            for r in successful:
                try:
                    idx = results.index(r)
                    if idx < len(self.message_log) and self.message_log[idx]['message'].priority == priority:
                        priority_results.append(r)
                except (ValueError, IndexError):
                    continue
            if priority_results:
                report[f'priority_{priority}_avg_delay'] = np.mean([r['total_delay'] for r in priority_results])
        
        return report

def visualize_network_topology(network: InterplanetaryNetwork):
    """Create visualization of network topology"""
    plt.figure(figsize=(12, 10))
    
    # Plot Sun at center
    plt.scatter(0, 0, c='yellow', s=500, marker='*', label='Sun')
    
    # Plot planets and Lagrange points
    for body, position in network.nodes.items():
        x, y = position.to_cartesian()
        if body in [CelestialBody.EARTH, CelestialBody.MARS]:
            plt.scatter(x, y, c='blue' if 'EARTH' in body.value else 'red', 
                       s=200, label=body.value)
        else:
            plt.scatter(x, y, c='green', s=100, marker='^', alpha=0.7)
            plt.annotate(body.value, (x, y), fontsize=8)
    
    # Plot communication links
    bodies = list(network.nodes.keys())
    for i, source in enumerate(bodies):
        for destination in bodies[i+1:]:
            if (source, destination) in network.classical_channels:
                x1, y1 = network.nodes[source].to_cartesian()
                x2, y2 = network.nodes[destination].to_cartesian()
                plt.plot([x1, x2], [y1, y2], 'gray', alpha=0.3, linewidth=0.5)
    
    plt.xlabel('Distance (AU)')
    plt.ylabel('Distance (AU)')
    plt.title('Interplanetary Communication Network Topology')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.axis('equal')
    plt.tight_layout()
    plt.savefig('network_topology.png', dpi=150)
    plt.close()

def plot_performance_metrics(results: List[Dict]):
    """Plot network performance metrics"""
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    
    # Delay distribution
    delays = [r['total_delay'] / 60 for r in results if r['success']]  # Convert to minutes
    axes[0, 0].hist(delays, bins=30, edgecolor='black')
    axes[0, 0].set_xlabel('Total Delay (minutes)')
    axes[0, 0].set_ylabel('Frequency')
    axes[0, 0].set_title('Message Delay Distribution')
    
    # Success rate by priority
    priorities = list(range(5))
    success_rates = []
    for p in priorities:
        p_results = [r for r in results if r.get('priority', -1) == p]
        if p_results:
            success_rates.append(sum(1 for r in p_results if r['success']) / len(p_results) * 100)
        else:
            success_rates.append(0)
    
    axes[0, 1].bar(priorities, success_rates)
    axes[0, 1].set_xlabel('Priority Level')
    axes[0, 1].set_ylabel('Success Rate (%)')
    axes[0, 1].set_title('Success Rate by Priority')
    axes[0, 1].set_xticks(priorities)
    axes[0, 1].set_xticklabels(['P0 (Emergency)', 'P1 (Critical)', 'P2 (High)', 'P3 (Normal)', 'P4 (Low)'])
    plt.setp(axes[0, 1].xaxis.get_majorticklabels(), rotation=45)
    
    # Route usage
    routes = [' → '.join(r['route']) for r in results if r['success']]
    route_counts = {}
    for route in routes:
        route_counts[route] = route_counts.get(route, 0) + 1
    
    top_routes = sorted(route_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    axes[1, 0].bar(range(len(top_routes)), [count for _, count in top_routes])
    axes[1, 0].set_xlabel('Route')
    axes[1, 0].set_ylabel('Usage Count')
    axes[1, 0].set_title('Top 5 Most Used Routes')
    axes[1, 0].set_xticks(range(len(top_routes)))
    axes[1, 0].set_xticklabels([route for route, _ in top_routes], rotation=45, ha='right')
    
    # Hop count distribution
    hops = [r['hops'] for r in results if r['success']]
    hop_counts = {h: hops.count(h) for h in set(hops)}
    axes[1, 1].bar(hop_counts.keys(), hop_counts.values())
    axes[1, 1].set_xlabel('Number of Hops')
    axes[1, 1].set_ylabel('Frequency')
    axes[1, 1].set_title('Message Hop Count Distribution')
    axes[1, 1].set_xticks(list(hop_counts.keys()))
    
    plt.tight_layout()
    plt.savefig('performance_metrics.png', dpi=150)
    plt.close()

def main():
    """Run the simulation"""
    print("Initializing Interplanetary Communication Network Simulator...")
    
    # Create network
    network = InterplanetaryNetwork()
    
    # Visualize topology
    visualize_network_topology(network)
    print("Network topology saved to 'network_topology.png'")
    
    # Run simulation
    print("\nRunning 24-hour traffic simulation...")
    results = network.simulate_traffic(duration_hours=24, messages_per_hour=100)
    
    # Generate report
    report = network.generate_performance_report(results)
    
    print("\n=== SIMULATION RESULTS ===")
    print(f"Total Messages: {report['total_messages']}")
    print(f"Successful: {report['successful']} ({report['success_rate']:.1f}%)")
    print(f"Failed: {report['failed']}")
    print(f"\nAverage Delay: {report['average_delay']/60:.1f} minutes")
    print(f"Min Delay: {report['min_delay']/60:.1f} minutes")
    print(f"Max Delay: {report['max_delay']/60:.1f} minutes")
    print(f"\nAverage Hops: {report['average_hops']:.1f}")
    print(f"Relay Usage: {report['relay_usage']:.1f}%")
    
    print("\nDelay by Priority:")
    for p in range(5):
        if f'priority_{p}_avg_delay' in report:
            print(f"  P{p}: {report[f'priority_{p}_avg_delay']/60:.1f} minutes")
    
    # Plot performance metrics
    plot_performance_metrics(results)
    print("\nPerformance metrics saved to 'performance_metrics.png'")
    
    # Test quantum security
    print("\n=== QUANTUM SECURITY TEST ===")
    qchannel = network.quantum_channels[(CelestialBody.EARTH, CelestialBody.MARS)]
    key, rate = qchannel.generate_quantum_key(1024)
    bell_test = qchannel.test_bell_inequality()
    
    print(f"Quantum Key Length: {len(key)} bits")
    print(f"Key Generation Rate: {rate/1e6:.2f} Mbps")
    print(f"Bell Inequality Test: {'PASSED' if bell_test else 'FAILED'}")
    print(f"Channel Secure: {'YES' if bell_test else 'NO'}")

if __name__ == "__main__":
    main()