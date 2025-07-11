#!/usr/bin/env python3
"""
Quantum Magnetic Navigation Link Simulator for Mars-Earth Communication
Simulates the performance of quantum magnetometer arrays for interplanetary distances
"""

import numpy as np
import matplotlib.pyplot as plt
from dataclasses import dataclass
from typing import Tuple, List
import json
from datetime import datetime, timedelta

@dataclass
class PlanetaryPosition:
    """Orbital position of a planet"""
    distance_from_sun: float  # AU
    angle: float  # radians
    name: str

@dataclass
class QuantumSensor:
    """Quantum magnetometer specifications"""
    sensitivity: float  # Tesla/sqrt(Hz)
    bandwidth: float  # Hz
    integration_time: float  # seconds
    array_size: Tuple[int, int]  # Array dimensions
    
class InterplanetaryMagneticField:
    """Model interplanetary magnetic field conditions"""
    
    def __init__(self):
        self.base_field = 5e-9  # 5 nT typical interplanetary field
        self.solar_wind_speed = 400e3  # m/s
        
    def calculate_field_strength(self, distance_au: float) -> float:
        """Calculate magnetic field strength at given distance from Sun"""
        # Parker spiral model
        return self.base_field * (1.0 / distance_au) ** 2
    
    def add_solar_wind_variation(self, field: float, time: float) -> float:
        """Add time-varying solar wind effects"""
        variation = 0.3 * field * np.sin(2 * np.pi * time / 3600)  # Hourly variation
        return field + variation

class QuantumChannel:
    """Simulate quantum communication channel between planets"""
    
    def __init__(self, sensor: QuantumSensor):
        self.sensor = sensor
        self.field_model = InterplanetaryMagneticField()
        
    def calculate_snr(self, distance_km: float, tx_power: float) -> float:
        """Calculate signal-to-noise ratio for quantum channel"""
        # Free space path loss for magnetic fields
        distance_m = distance_km * 1000
        wavelength = 3e8 / 1e3  # 1 kHz carrier
        path_loss = (wavelength / (4 * np.pi * distance_m)) ** 2
        
        # Received signal strength
        rx_signal = tx_power * path_loss
        
        # Noise power
        noise_power = self.sensor.sensitivity ** 2 * self.sensor.bandwidth
        
        # Array gain
        array_gain = self.sensor.array_size[0] * self.sensor.array_size[1]
        
        # SNR with integration gain
        integration_gain = np.sqrt(self.sensor.integration_time * self.sensor.bandwidth)
        snr = (rx_signal / noise_power) * array_gain * integration_gain
        
        return 10 * np.log10(snr)  # dB
    
    def calculate_bit_error_rate(self, snr_db: float) -> float:
        """Calculate quantum bit error rate from SNR"""
        snr_linear = 10 ** (snr_db / 10)
        # Quantum bit error rate approximation
        qber = 0.5 * np.exp(-snr_linear / 2)
        return qber
    
    def calculate_data_rate(self, snr_db: float) -> float:
        """Calculate achievable data rate based on SNR"""
        if snr_db < 0:
            return 0
        
        # Shannon capacity with quantum efficiency factor
        quantum_efficiency = 0.7  # Typical for quantum systems
        snr_linear = 10 ** (snr_db / 10)
        capacity = self.sensor.bandwidth * np.log2(1 + snr_linear) * quantum_efficiency
        
        return capacity

class MarsEarthSimulation:
    """Simulate Mars-Earth quantum communication link"""
    
    def __init__(self):
        # Initialize quantum sensor array
        self.sensor = QuantumSensor(
            sensitivity=10e-15,  # 10 femtoTesla
            bandwidth=1000,      # 1 kHz
            integration_time=10, # 10 seconds
            array_size=(3, 3)    # 3x3 array
        )
        
        self.channel = QuantumChannel(self.sensor)
        self.results = []
        
    def calculate_mars_earth_distance(self, day: int) -> float:
        """Calculate Mars-Earth distance for given day (simplified model)"""
        # Synodic period ~780 days
        angle = 2 * np.pi * day / 780
        
        # Distance varies from 0.52 AU (opposition) to 2.67 AU (conjunction)
        mars_orbit = 1.52  # AU
        earth_orbit = 1.0  # AU
        
        # Simplified distance calculation
        distance_au = np.sqrt(mars_orbit**2 + earth_orbit**2 - 
                             2 * mars_orbit * earth_orbit * np.cos(angle))
        
        return distance_au * 1.496e8  # Convert to km
    
    def run_simulation(self, duration_days: int = 780):
        """Run full synodic period simulation"""
        print("Starting Mars-Earth Quantum Communication Simulation...")
        print(f"Sensor: {self.sensor.array_size[0]}x{self.sensor.array_size[1]} array")
        print(f"Sensitivity: {self.sensor.sensitivity*1e15:.1f} femtoTesla")
        print("-" * 60)
        
        days = range(0, duration_days, 10)  # Sample every 10 days
        
        for day in days:
            # Calculate distance
            distance_km = self.calculate_mars_earth_distance(day)
            distance_au = distance_km / 1.496e8
            
            # Transmit power (magnetic field modulation strength)
            tx_power = 1e-12  # 1 picoTesla modulation
            
            # Calculate link performance
            snr_db = self.channel.calculate_snr(distance_km, tx_power)
            qber = self.channel.calculate_bit_error_rate(snr_db)
            data_rate = self.channel.calculate_data_rate(snr_db)
            
            # Calculate delay
            light_speed = 3e5  # km/s
            delay_minutes = distance_km / light_speed / 60
            
            result = {
                'day': day,
                'distance_km': distance_km,
                'distance_au': distance_au,
                'snr_db': snr_db,
                'qber': qber,
                'data_rate_bps': data_rate,
                'delay_minutes': delay_minutes
            }
            
            self.results.append(result)
            
            if day % 100 == 0:
                print(f"Day {day:3d}: Distance={distance_au:.2f} AU, "
                      f"SNR={snr_db:+.1f} dB, Rate={data_rate/1000:.1f} kbps, "
                      f"Delay={delay_minutes:.1f} min")
        
        self.analyze_results()
        self.plot_results()
        
    def analyze_results(self):
        """Analyze simulation results"""
        print("\n" + "="*60)
        print("SIMULATION RESULTS SUMMARY")
        print("="*60)
        
        # Extract metrics
        distances = [r['distance_au'] for r in self.results]
        snrs = [r['snr_db'] for r in self.results]
        rates = [r['data_rate_bps'] for r in self.results]
        qbers = [r['qber'] for r in self.results]
        
        # Find key metrics
        min_distance_idx = np.argmin(distances)
        max_distance_idx = np.argmax(distances)
        
        print(f"\nBest Case (Opposition - {distances[min_distance_idx]:.2f} AU):")
        print(f"  SNR: {snrs[min_distance_idx]:+.1f} dB")
        print(f"  Data Rate: {rates[min_distance_idx]/1e6:.2f} Mbps")
        print(f"  QBER: {qbers[min_distance_idx]:.2e}")
        print(f"  Delay: {self.results[min_distance_idx]['delay_minutes']:.1f} minutes")
        
        print(f"\nWorst Case (Conjunction - {distances[max_distance_idx]:.2f} AU):")
        print(f"  SNR: {snrs[max_distance_idx]:+.1f} dB")
        print(f"  Data Rate: {rates[max_distance_idx]/1e3:.2f} kbps")
        print(f"  QBER: {qbers[max_distance_idx]:.2e}")
        print(f"  Delay: {self.results[max_distance_idx]['delay_minutes']:.1f} minutes")
        
        # Average performance
        avg_rate = np.mean([r for r in rates if r > 0])
        availability = sum(1 for r in rates if r > 1000) / len(rates) * 100
        
        print(f"\nAverage Performance:")
        print(f"  Mean Data Rate: {avg_rate/1e3:.1f} kbps")
        print(f"  Link Availability (>1kbps): {availability:.1f}%")
        
        # Save results
        with open('plans/simulations/quantum_link_results.json', 'w') as f:
            json.dump({
                'simulation_params': {
                    'sensor_sensitivity_fT': self.sensor.sensitivity * 1e15,
                    'array_size': list(self.sensor.array_size),
                    'bandwidth_hz': self.sensor.bandwidth,
                    'integration_time_s': self.sensor.integration_time
                },
                'results': self.results,
                'summary': {
                    'best_case_rate_mbps': rates[min_distance_idx]/1e6,
                    'worst_case_rate_kbps': rates[max_distance_idx]/1e3,
                    'average_rate_kbps': avg_rate/1e3,
                    'availability_percent': availability
                }
            }, f, indent=2)
        
    def plot_results(self):
        """Generate visualization plots"""
        days = [r['day'] for r in self.results]
        distances = [r['distance_au'] for r in self.results]
        snrs = [r['snr_db'] for r in self.results]
        rates = [r['data_rate_bps']/1e3 for r in self.results]  # kbps
        delays = [r['delay_minutes'] for r in self.results]
        
        fig, axes = plt.subplots(2, 2, figsize=(12, 10))
        fig.suptitle('Mars-Earth Quantum Communication Link Analysis', fontsize=16)
        
        # Distance plot
        ax1 = axes[0, 0]
        ax1.plot(days, distances, 'b-', linewidth=2)
        ax1.set_xlabel('Days')
        ax1.set_ylabel('Distance (AU)')
        ax1.set_title('Mars-Earth Distance Over Time')
        ax1.grid(True, alpha=0.3)
        
        # SNR plot
        ax2 = axes[0, 1]
        ax2.plot(days, snrs, 'g-', linewidth=2)
        ax2.axhline(y=0, color='r', linestyle='--', label='0 dB threshold')
        ax2.set_xlabel('Days')
        ax2.set_ylabel('SNR (dB)')
        ax2.set_title('Signal-to-Noise Ratio')
        ax2.grid(True, alpha=0.3)
        ax2.legend()
        
        # Data rate plot
        ax3 = axes[1, 0]
        ax3.semilogy(days, rates, 'purple', linewidth=2)
        ax3.axhline(y=1, color='r', linestyle='--', label='1 kbps minimum')
        ax3.set_xlabel('Days')
        ax3.set_ylabel('Data Rate (kbps)')
        ax3.set_title('Achievable Data Rate')
        ax3.grid(True, alpha=0.3)
        ax3.legend()
        
        # Delay plot
        ax4 = axes[1, 1]
        ax4.plot(days, delays, 'orange', linewidth=2)
        ax4.set_xlabel('Days')
        ax4.set_ylabel('One-way Delay (minutes)')
        ax4.set_title('Communication Delay')
        ax4.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('plans/simulations/quantum_link_performance.png', dpi=150)
        print("\nPlots saved to plans/simulations/quantum_link_performance.png")

def main():
    """Run the simulation"""
    print("="*60)
    print("QUANTUM MAGNETIC NAVIGATION LINK SIMULATOR")
    print("Mars-Earth Communication Performance Analysis")
    print("="*60)
    
    sim = MarsEarthSimulation()
    sim.run_simulation(duration_days=780)  # Full synodic period
    
    print("\nSimulation complete! Results saved to plans/simulations/")

if __name__ == "__main__":
    main()