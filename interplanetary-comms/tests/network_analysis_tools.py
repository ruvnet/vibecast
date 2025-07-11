#!/usr/bin/env python3
"""
Network Analysis Tools for Interplanetary Communications
Provides visualization and analysis tools for network performance data
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.animation import FuncAnimation
import json
import time
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass
import logging

@dataclass
class NetworkMetrics:
    """Network performance metrics"""
    timestamp: float
    latency: float
    throughput: float
    packet_loss: float
    error_rate: float
    reliability: float
    jitter: float

class NetworkAnalyzer:
    """Network performance analyzer and visualizer"""
    
    def __init__(self):
        self.logger = logging.getLogger("network_analyzer")
        self.metrics_history: List[NetworkMetrics] = []
        
    def analyze_test_results(self, test_report: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze network test results and extract insights"""
        analysis = {
            "performance_trends": {},
            "bottleneck_analysis": {},
            "reliability_assessment": {},
            "optimization_opportunities": []
        }
        
        # Extract metrics from test results
        for result in test_report.get("detailed_results", []):
            test_name = result["test_name"]
            metrics = result.get("metrics", {})
            
            if test_name == "latency_performance":
                analysis["performance_trends"]["latency"] = self.analyze_latency_trends(metrics)
            elif test_name == "throughput_analysis":
                analysis["performance_trends"]["throughput"] = self.analyze_throughput_trends(metrics)
            elif test_name == "error_correction_validation":
                analysis["reliability_assessment"]["error_correction"] = self.analyze_error_correction(metrics)
            elif test_name == "fault_tolerance":
                analysis["reliability_assessment"]["fault_tolerance"] = self.analyze_fault_tolerance(metrics)
        
        # Identify bottlenecks
        analysis["bottleneck_analysis"] = self.identify_bottlenecks(test_report)
        
        # Generate optimization recommendations
        analysis["optimization_opportunities"] = self.generate_optimization_recommendations(test_report)
        
        return analysis
    
    def analyze_latency_trends(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze latency performance trends"""
        latency_results = metrics.get("latency_results", {})
        
        scenarios = []
        mean_latencies = []
        jitter_values = []
        
        for scenario, data in latency_results.items():
            scenarios.append(scenario)
            mean_latencies.append(data.get("mean_rtt", 0) / 60)  # Convert to minutes
            jitter_values.append(data.get("mean_jitter", 0))
        
        return {
            "scenarios": scenarios,
            "mean_latencies_minutes": mean_latencies,
            "jitter_values": jitter_values,
            "best_case_latency": min(mean_latencies) if mean_latencies else 0,
            "worst_case_latency": max(mean_latencies) if mean_latencies else 0,
            "latency_variation": np.std(mean_latencies) if mean_latencies else 0
        }
    
    def analyze_throughput_trends(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze throughput performance trends"""
        throughput_results = metrics.get("throughput_results", {})
        
        scenarios = []
        max_throughputs = []
        efficiencies = []
        
        for scenario, data in throughput_results.items():
            scenarios.append(scenario)
            # Find maximum throughput for this scenario
            max_throughput = 0
            total_efficiency = 0
            count = 0
            
            for payload_key, payload_data in data.items():
                if isinstance(payload_data, dict):
                    throughput = payload_data.get("throughput_mbps", 0)
                    efficiency = payload_data.get("efficiency", 0)
                    
                    max_throughput = max(max_throughput, throughput)
                    total_efficiency += efficiency
                    count += 1
            
            max_throughputs.append(max_throughput)
            efficiencies.append(total_efficiency / count if count > 0 else 0)
        
        return {
            "scenarios": scenarios,
            "max_throughputs_mbps": max_throughputs,
            "average_efficiencies": efficiencies,
            "peak_throughput": max(max_throughputs) if max_throughputs else 0,
            "throughput_degradation": (max(max_throughputs) - min(max_throughputs)) / max(max_throughputs) if max_throughputs else 0
        }
    
    def analyze_error_correction(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze error correction performance"""
        error_correction_results = metrics.get("error_correction_results", {})
        success_rate = metrics.get("success_rate", 0)
        
        code_performance = {}
        for code_type, results in error_correction_results.items():
            successful_corrections = sum(1 for r in results.values() if r.get("success", False))
            total_tests = len(results)
            
            code_performance[code_type] = {
                "success_rate": successful_corrections / total_tests if total_tests > 0 else 0,
                "total_tests": total_tests,
                "successful_corrections": successful_corrections
            }
        
        return {
            "overall_success_rate": success_rate,
            "code_performance": code_performance,
            "best_performing_code": max(code_performance.keys(), 
                                       key=lambda k: code_performance[k]["success_rate"]) if code_performance else None
        }
    
    def analyze_fault_tolerance(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze fault tolerance capabilities"""
        fault_tolerance_results = metrics.get("fault_tolerance_results", {})
        
        failure_scenarios = []
        connectivity_values = []
        delivery_probabilities = []
        
        for scenario, data in fault_tolerance_results.items():
            failure_scenarios.append(scenario)
            connectivity_values.append(data.get("connectivity", 0))
            delivery_probabilities.append(data.get("delivery_probability", 0))
        
        return {
            "failure_scenarios": failure_scenarios,
            "connectivity_values": connectivity_values,
            "delivery_probabilities": delivery_probabilities,
            "graceful_degradation": self.calculate_graceful_degradation(connectivity_values),
            "critical_failure_point": self.find_critical_failure_point(failure_scenarios, connectivity_values)
        }
    
    def calculate_graceful_degradation(self, connectivity_values: List[float]) -> float:
        """Calculate graceful degradation score"""
        if len(connectivity_values) < 2:
            return 1.0
        
        # Calculate how gradually the network degrades
        degradation_rate = []
        for i in range(1, len(connectivity_values)):
            rate = (connectivity_values[i-1] - connectivity_values[i]) / connectivity_values[i-1] if connectivity_values[i-1] > 0 else 0
            degradation_rate.append(rate)
        
        # Lower variance in degradation rate indicates more graceful degradation
        variance = np.var(degradation_rate) if degradation_rate else 0
        return max(0, 1.0 - variance)
    
    def find_critical_failure_point(self, scenarios: List[str], connectivity_values: List[float]) -> str:
        """Find the critical failure point where network becomes unusable"""
        for i, (scenario, connectivity) in enumerate(zip(scenarios, connectivity_values)):
            if connectivity < 0.5:  # Below 50% connectivity
                return scenario
        return "no_critical_failure"
    
    def identify_bottlenecks(self, test_report: Dict[str, Any]) -> Dict[str, Any]:
        """Identify network bottlenecks"""
        bottlenecks = {
            "latency_bottlenecks": [],
            "throughput_bottlenecks": [],
            "reliability_bottlenecks": [],
            "capacity_bottlenecks": []
        }
        
        for result in test_report.get("detailed_results", []):
            if result["status"] in ["FAIL", "WARNING"]:
                test_name = result["test_name"]
                details = result["details"]
                
                if "latency" in test_name:
                    bottlenecks["latency_bottlenecks"].append({
                        "test": test_name,
                        "issue": details,
                        "severity": result["status"]
                    })
                elif "throughput" in test_name:
                    bottlenecks["throughput_bottlenecks"].append({
                        "test": test_name,
                        "issue": details,
                        "severity": result["status"]
                    })
                elif "fault_tolerance" in test_name or "error_correction" in test_name:
                    bottlenecks["reliability_bottlenecks"].append({
                        "test": test_name,
                        "issue": details,
                        "severity": result["status"]
                    })
                elif "handoff" in test_name or "topology" in test_name:
                    bottlenecks["capacity_bottlenecks"].append({
                        "test": test_name,
                        "issue": details,
                        "severity": result["status"]
                    })
        
        return bottlenecks
    
    def generate_optimization_recommendations(self, test_report: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate optimization recommendations"""
        recommendations = []
        
        # Analyze each test result for optimization opportunities
        for result in test_report.get("detailed_results", []):
            test_name = result["test_name"]
            status = result["status"]
            metrics = result.get("metrics", {})
            
            if status == "FAIL":
                if "latency" in test_name:
                    recommendations.append({
                        "category": "latency_optimization",
                        "priority": "high",
                        "recommendation": "Deploy additional relay stations to reduce round-trip times",
                        "expected_improvement": "30-50% latency reduction",
                        "implementation_cost": "high"
                    })
                
                elif "throughput" in test_name:
                    recommendations.append({
                        "category": "bandwidth_optimization",
                        "priority": "high",
                        "recommendation": "Upgrade communication links and implement advanced modulation schemes",
                        "expected_improvement": "2-5x throughput increase",
                        "implementation_cost": "medium"
                    })
                
                elif "error_correction" in test_name:
                    recommendations.append({
                        "category": "reliability_optimization",
                        "priority": "critical",
                        "recommendation": "Implement adaptive error correction with machine learning",
                        "expected_improvement": "90%+ error correction success rate",
                        "implementation_cost": "medium"
                    })
            
            elif status == "WARNING":
                if "solar_storm" in test_name:
                    recommendations.append({
                        "category": "resilience_optimization",
                        "priority": "medium",
                        "recommendation": "Implement predictive solar storm mitigation protocols",
                        "expected_improvement": "50%+ resilience during solar storms",
                        "implementation_cost": "low"
                    })
        
        # Add general optimization recommendations
        recommendations.extend([
            {
                "category": "protocol_optimization",
                "priority": "medium",
                "recommendation": "Implement quantum-enhanced routing protocols",
                "expected_improvement": "20-30% overall performance boost",
                "implementation_cost": "high"
            },
            {
                "category": "monitoring_optimization",
                "priority": "low",
                "recommendation": "Deploy real-time network monitoring and analytics",
                "expected_improvement": "Proactive issue detection and resolution",
                "implementation_cost": "low"
            }
        ])
        
        return recommendations
    
    def create_performance_dashboard(self, analysis: Dict[str, Any], save_path: str = None) -> None:
        """Create comprehensive performance dashboard"""
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
        
        # Latency trends
        self.plot_latency_trends(ax1, analysis.get("performance_trends", {}).get("latency", {}))
        
        # Throughput analysis
        self.plot_throughput_analysis(ax2, analysis.get("performance_trends", {}).get("throughput", {}))
        
        # Error correction performance
        self.plot_error_correction_performance(ax3, analysis.get("reliability_assessment", {}).get("error_correction", {}))
        
        # Fault tolerance assessment
        self.plot_fault_tolerance_assessment(ax4, analysis.get("reliability_assessment", {}).get("fault_tolerance", {}))
        
        plt.tight_layout()
        plt.suptitle("Interplanetary Network Performance Dashboard", fontsize=16, y=0.98)
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        else:
            plt.show()
    
    def plot_latency_trends(self, ax, latency_data: Dict[str, Any]) -> None:
        """Plot latency trends"""
        scenarios = latency_data.get("scenarios", [])
        latencies = latency_data.get("mean_latencies_minutes", [])
        
        if not scenarios or not latencies:
            ax.text(0.5, 0.5, "No latency data available", ha='center', va='center', transform=ax.transAxes)
            ax.set_title("Latency Performance")
            return
        
        # Create bar chart
        bars = ax.bar(range(len(scenarios)), latencies, color=['green', 'orange', 'red'][:len(scenarios)])
        ax.set_xlabel("Scenarios")
        ax.set_ylabel("Latency (minutes)")
        ax.set_title("Latency Performance Across Scenarios")
        ax.set_xticks(range(len(scenarios)))
        ax.set_xticklabels([s.replace('_', ' ').title() for s in scenarios], rotation=45)
        
        # Add value labels on bars
        for bar, latency in zip(bars, latencies):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{latency:.1f}min', ha='center', va='bottom')
        
        # Add performance thresholds
        ax.axhline(y=5, color='orange', linestyle='--', alpha=0.7, label='Warning (5 min)')
        ax.axhline(y=25, color='red', linestyle='--', alpha=0.7, label='Critical (25 min)')
        ax.legend()
    
    def plot_throughput_analysis(self, ax, throughput_data: Dict[str, Any]) -> None:
        """Plot throughput analysis"""
        scenarios = throughput_data.get("scenarios", [])
        throughputs = throughput_data.get("max_throughputs_mbps", [])
        
        if not scenarios or not throughputs:
            ax.text(0.5, 0.5, "No throughput data available", ha='center', va='center', transform=ax.transAxes)
            ax.set_title("Throughput Analysis")
            return
        
        # Create bar chart
        bars = ax.bar(range(len(scenarios)), throughputs, color=['green', 'orange', 'red'][:len(scenarios)])
        ax.set_xlabel("Scenarios")
        ax.set_ylabel("Throughput (Mbps)")
        ax.set_title("Maximum Throughput by Scenario")
        ax.set_xticks(range(len(scenarios)))
        ax.set_xticklabels([s.replace('_', ' ').title() for s in scenarios], rotation=45)
        
        # Add value labels on bars
        for bar, throughput in zip(bars, throughputs):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{throughput:.0f}', ha='center', va='bottom')
        
        # Add performance thresholds
        ax.axhline(y=50, color='orange', linestyle='--', alpha=0.7, label='Minimum (50 Mbps)')
        ax.axhline(y=100, color='green', linestyle='--', alpha=0.7, label='Target (100 Mbps)')
        ax.legend()
    
    def plot_error_correction_performance(self, ax, error_correction_data: Dict[str, Any]) -> None:
        """Plot error correction performance"""
        code_performance = error_correction_data.get("code_performance", {})
        
        if not code_performance:
            ax.text(0.5, 0.5, "No error correction data available", ha='center', va='center', transform=ax.transAxes)
            ax.set_title("Error Correction Performance")
            return
        
        codes = list(code_performance.keys())
        success_rates = [code_performance[code]["success_rate"] for code in codes]
        
        # Create bar chart
        bars = ax.bar(range(len(codes)), success_rates, color=['green' if sr > 0.8 else 'orange' if sr > 0.6 else 'red' for sr in success_rates])
        ax.set_xlabel("Error Correction Codes")
        ax.set_ylabel("Success Rate")
        ax.set_title("Error Correction Performance")
        ax.set_xticks(range(len(codes)))
        ax.set_xticklabels([c.replace('_', ' ').title() for c in codes], rotation=45)
        ax.set_ylim(0, 1)
        
        # Add value labels on bars
        for bar, success_rate in zip(bars, success_rates):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{success_rate:.1%}', ha='center', va='bottom')
        
        # Add performance thresholds
        ax.axhline(y=0.8, color='green', linestyle='--', alpha=0.7, label='Excellent (80%)')
        ax.axhline(y=0.6, color='orange', linestyle='--', alpha=0.7, label='Acceptable (60%)')
        ax.legend()
    
    def plot_fault_tolerance_assessment(self, ax, fault_tolerance_data: Dict[str, Any]) -> None:
        """Plot fault tolerance assessment"""
        scenarios = fault_tolerance_data.get("failure_scenarios", [])
        connectivity = fault_tolerance_data.get("connectivity_values", [])
        
        if not scenarios or not connectivity:
            ax.text(0.5, 0.5, "No fault tolerance data available", ha='center', va='center', transform=ax.transAxes)
            ax.set_title("Fault Tolerance Assessment")
            return
        
        # Create line plot
        ax.plot(range(len(scenarios)), connectivity, marker='o', linewidth=2, markersize=8)
        ax.set_xlabel("Failure Scenarios")
        ax.set_ylabel("Network Connectivity")
        ax.set_title("Network Connectivity Under Failures")
        ax.set_xticks(range(len(scenarios)))
        ax.set_xticklabels([s.replace('_', ' ').title() for s in scenarios], rotation=45)
        ax.set_ylim(0, 1)
        
        # Add performance thresholds
        ax.axhline(y=0.8, color='green', linestyle='--', alpha=0.7, label='Excellent (80%)')
        ax.axhline(y=0.5, color='orange', linestyle='--', alpha=0.7, label='Acceptable (50%)')
        ax.axhline(y=0.2, color='red', linestyle='--', alpha=0.7, label='Critical (20%)')
        ax.legend()
        
        # Fill areas
        ax.fill_between(range(len(scenarios)), connectivity, 0.8, where=[c >= 0.8 for c in connectivity], alpha=0.2, color='green')
        ax.fill_between(range(len(scenarios)), connectivity, 0.5, where=[0.5 <= c < 0.8 for c in connectivity], alpha=0.2, color='orange')
        ax.fill_between(range(len(scenarios)), connectivity, 0, where=[c < 0.5 for c in connectivity], alpha=0.2, color='red')
    
    def create_network_topology_visualization(self, topology_data: Dict[str, Any], save_path: str = None) -> None:
        """Create network topology visualization"""
        fig, ax = plt.subplots(figsize=(12, 8))
        
        # Example network topology (Earth-Mars communication network)
        nodes = {
            'Earth': (0, 0),
            'L4_Relay': (2, 1),
            'L5_Relay': (2, -1),
            'Mars_Relay': (4, 0),
            'Mars': (6, 0)
        }
        
        connections = [
            ('Earth', 'L4_Relay'),
            ('Earth', 'L5_Relay'),
            ('L4_Relay', 'L5_Relay'),
            ('L4_Relay', 'Mars_Relay'),
            ('L5_Relay', 'Mars_Relay'),
            ('Mars_Relay', 'Mars')
        ]
        
        # Draw connections
        for start, end in connections:
            start_pos = nodes[start]
            end_pos = nodes[end]
            ax.plot([start_pos[0], end_pos[0]], [start_pos[1], end_pos[1]], 
                   'b-', linewidth=2, alpha=0.7)
        
        # Draw nodes
        for node, pos in nodes.items():
            color = 'lightblue' if 'Relay' in node else 'lightcoral'
            ax.scatter(pos[0], pos[1], s=1000, c=color, edgecolors='black', linewidth=2)
            ax.text(pos[0], pos[1], node, ha='center', va='center', fontweight='bold')
        
        ax.set_xlim(-1, 7)
        ax.set_ylim(-2, 2)
        ax.set_aspect('equal')
        ax.set_title('Interplanetary Communication Network Topology', fontsize=16)
        ax.grid(True, alpha=0.3)
        
        # Add legend
        relay_patch = mpatches.Patch(color='lightblue', label='Relay Station')
        planet_patch = mpatches.Patch(color='lightcoral', label='Planet/Control Center')
        ax.legend(handles=[relay_patch, planet_patch], loc='upper right')
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        else:
            plt.show()
    
    def generate_executive_summary(self, analysis: Dict[str, Any]) -> str:
        """Generate executive summary of network performance"""
        summary = []
        
        # Network health overview
        bottlenecks = analysis.get("bottleneck_analysis", {})
        total_bottlenecks = sum(len(b) for b in bottlenecks.values())
        
        if total_bottlenecks == 0:
            summary.append("✅ Network performance is excellent with no critical bottlenecks identified.")
        elif total_bottlenecks <= 3:
            summary.append("⚠️ Network performance is good with minor optimization opportunities.")
        else:
            summary.append("❌ Network performance has significant bottlenecks requiring attention.")
        
        # Key performance metrics
        performance_trends = analysis.get("performance_trends", {})
        
        latency_data = performance_trends.get("latency", {})
        if latency_data:
            best_latency = latency_data.get("best_case_latency", 0)
            worst_latency = latency_data.get("worst_case_latency", 0)
            summary.append(f"📡 Latency range: {best_latency:.1f} - {worst_latency:.1f} minutes")
        
        throughput_data = performance_trends.get("throughput", {})
        if throughput_data:
            peak_throughput = throughput_data.get("peak_throughput", 0)
            summary.append(f"🚀 Peak throughput: {peak_throughput:.0f} Mbps")
        
        # Reliability assessment
        reliability_data = analysis.get("reliability_assessment", {})
        error_correction_data = reliability_data.get("error_correction", {})
        if error_correction_data:
            success_rate = error_correction_data.get("overall_success_rate", 0)
            summary.append(f"🛡️ Error correction success rate: {success_rate:.1%}")
        
        # Optimization recommendations
        recommendations = analysis.get("optimization_opportunities", [])
        high_priority_recs = [r for r in recommendations if r.get("priority") == "high"]
        if high_priority_recs:
            summary.append(f"🔧 {len(high_priority_recs)} high-priority optimization opportunities identified")
        
        return "\n".join(summary)

def main():
    """Main function to demonstrate network analysis tools"""
    # Create analyzer
    analyzer = NetworkAnalyzer()
    
    # Load test results (if available)
    report_path = Path(__file__).parent.parent / "reports" / "network-analysis" / "network_performance_report.json"
    
    if report_path.exists():
        with open(report_path, 'r') as f:
            test_report = json.load(f)
        
        # Analyze results
        analysis = analyzer.analyze_test_results(test_report)
        
        # Generate executive summary
        summary = analyzer.generate_executive_summary(analysis)
        print("Executive Summary:")
        print(summary)
        
        # Create visualizations
        dashboard_path = report_path.parent / "performance_dashboard.png"
        analyzer.create_performance_dashboard(analysis, str(dashboard_path))
        print(f"\nPerformance dashboard saved to: {dashboard_path}")
        
        topology_path = report_path.parent / "network_topology.png"
        analyzer.create_network_topology_visualization({}, str(topology_path))
        print(f"Network topology visualization saved to: {topology_path}")
        
        # Save detailed analysis
        analysis_path = report_path.parent / "detailed_analysis.json"
        with open(analysis_path, 'w') as f:
            json.dump(analysis, f, indent=2)
        print(f"Detailed analysis saved to: {analysis_path}")
        
    else:
        print("No test results found. Please run network performance tests first.")

if __name__ == "__main__":
    main()