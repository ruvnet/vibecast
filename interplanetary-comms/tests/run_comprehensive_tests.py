#!/usr/bin/env python3
"""
Comprehensive Test Runner for Interplanetary Communications
Executes all tests and generates detailed reports
"""

import os
import sys
import time
import json
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add project paths
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "protocols"))
sys.path.insert(0, str(project_root / "quantum_navigation"))
sys.path.insert(0, str(project_root / "tests"))

class TestResult:
    """Test result data structure"""
    
    def __init__(self, name: str, status: str, duration: float, details: str = ""):
        self.name = name
        self.status = status  # "PASS", "FAIL", "SKIP"
        self.duration = duration
        self.details = details
        self.timestamp = time.time()

class ComprehensiveTestRunner:
    """Comprehensive test runner for all protocols"""
    
    def __init__(self):
        self.test_results: List[TestResult] = []
        self.start_time = time.time()
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.skipped_tests = 0
        
    def run_pytest_tests(self, test_file: str) -> TestResult:
        """Run pytest tests for a specific file"""
        print(f"\n🧪 Running tests in {test_file}...")
        
        start_time = time.time()
        
        try:
            # Run pytest with JSON output
            result = subprocess.run([
                sys.executable, "-m", "pytest", 
                test_file, 
                "-v", 
                "--tb=short",
                "--json-report",
                "--json-report-file=test_results.json"
            ], 
            capture_output=True, 
            text=True,
            cwd=project_root
            )
            
            duration = time.time() - start_time
            
            # Parse results
            if result.returncode == 0:
                status = "PASS"
                details = f"All tests passed. Output: {result.stdout}"
            else:
                status = "FAIL"
                details = f"Tests failed. Error: {result.stderr}\nOutput: {result.stdout}"
                
            return TestResult(test_file, status, duration, details)
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult(test_file, "FAIL", duration, f"Exception: {str(e)}")
    
    def run_integration_tests(self) -> TestResult:
        """Run integration tests"""
        print("\n🔗 Running integration tests...")
        
        start_time = time.time()
        
        try:
            # Run the enhanced IPCP integration test
            result = subprocess.run([
                sys.executable, 
                "tests/integration/test_enhanced_ipcp.py"
            ], 
            capture_output=True, 
            text=True,
            cwd=project_root
            )
            
            duration = time.time() - start_time
            
            # Parse integration test results
            if "Overall Status: PASS" in result.stdout:
                status = "PASS"
                details = f"Integration tests passed. Output: {result.stdout}"
            elif "Overall Status: FAIL" in result.stdout:
                status = "FAIL"
                details = f"Integration tests failed. Output: {result.stdout}"
            else:
                status = "FAIL"
                details = f"Integration tests failed. Error: {result.stderr}\nOutput: {result.stdout}"
            
            return TestResult("integration_tests", status, duration, details)
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult("integration_tests", "FAIL", duration, f"Exception: {str(e)}")
    
    def run_protocol_validation_tests(self) -> TestResult:
        """Run protocol validation tests"""
        print("\n🛡️ Running protocol validation tests...")
        
        start_time = time.time()
        
        try:
            # Import and run protocol validation tests
            from test_protocol_validation import (
                TestIPCPProtocol, 
                TestRelayStationProtocol,
                TestQuantumRoutingAlgorithms,
                TestErrorCorrectionProtocols,
                TestAdaptiveLatencyProtocols,
                TestProtocolIntegration
            )
            
            test_classes = [
                TestIPCPProtocol,
                TestRelayStationProtocol,
                TestQuantumRoutingAlgorithms,
                TestErrorCorrectionProtocols,
                TestAdaptiveLatencyProtocols,
                TestProtocolIntegration
            ]
            
            passed = 0
            failed = 0
            test_details = []
            
            for test_class in test_classes:
                try:
                    # Create test instance
                    test_instance = test_class()
                    
                    # Run test methods
                    test_methods = [method for method in dir(test_instance) if method.startswith('test_')]
                    
                    for method_name in test_methods:
                        try:
                            method = getattr(test_instance, method_name)
                            
                            # Handle async methods
                            if asyncio.iscoroutinefunction(method):
                                asyncio.run(method())
                            else:
                                method()
                            
                            passed += 1
                            test_details.append(f"✓ {test_class.__name__}.{method_name}")
                            
                        except Exception as e:
                            failed += 1
                            test_details.append(f"✗ {test_class.__name__}.{method_name}: {str(e)}")
                            
                except Exception as e:
                    failed += 1
                    test_details.append(f"✗ {test_class.__name__}: {str(e)}")
            
            duration = time.time() - start_time
            
            if failed == 0:
                status = "PASS"
                details = f"Protocol validation: {passed} passed, {failed} failed.\n" + "\n".join(test_details)
            else:
                status = "FAIL"
                details = f"Protocol validation: {passed} passed, {failed} failed.\n" + "\n".join(test_details)
            
            return TestResult("protocol_validation", status, duration, details)
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult("protocol_validation", "FAIL", duration, f"Exception: {str(e)}")
    
    def run_quantum_navigation_tests(self) -> TestResult:
        """Run quantum navigation tests"""
        print("\n🌌 Running quantum navigation tests...")
        
        start_time = time.time()
        
        try:
            # Import and run quantum navigation tests
            from test_quantum_navigation import (
                TestQuantumNavigator,
                TestPositionEstimator,
                TestTrajectoryPlanner,
                TestQuantumNavigationIntegration
            )
            
            test_classes = [
                TestQuantumNavigator,
                TestPositionEstimator,
                TestTrajectoryPlanner,
                TestQuantumNavigationIntegration
            ]
            
            passed = 0
            failed = 0
            test_details = []
            
            for test_class in test_classes:
                try:
                    # Create test instance
                    test_instance = test_class()
                    
                    # Run test methods
                    test_methods = [method for method in dir(test_instance) if method.startswith('test_')]
                    
                    for method_name in test_methods:
                        try:
                            method = getattr(test_instance, method_name)
                            
                            # Handle async methods
                            if asyncio.iscoroutinefunction(method):
                                asyncio.run(method())
                            else:
                                method()
                            
                            passed += 1
                            test_details.append(f"✓ {test_class.__name__}.{method_name}")
                            
                        except Exception as e:
                            failed += 1
                            test_details.append(f"✗ {test_class.__name__}.{method_name}: {str(e)}")
                            
                except Exception as e:
                    failed += 1
                    test_details.append(f"✗ {test_class.__name__}: {str(e)}")
            
            duration = time.time() - start_time
            
            if failed == 0:
                status = "PASS"
                details = f"Quantum navigation: {passed} passed, {failed} failed.\n" + "\n".join(test_details)
            else:
                status = "FAIL"
                details = f"Quantum navigation: {passed} passed, {failed} failed.\n" + "\n".join(test_details)
            
            return TestResult("quantum_navigation", status, duration, details)
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult("quantum_navigation", "FAIL", duration, f"Exception: {str(e)}")
    
    def run_performance_tests(self) -> TestResult:
        """Run performance tests"""
        print("\n⚡ Running performance tests...")
        
        start_time = time.time()
        
        try:
            # Import protocol modules for performance testing
            import importlib.util
            
            protocols_dir = project_root / "protocols"
            
            # Load protocol modules
            spec = importlib.util.spec_from_file_location(
                "ipcp_module", 
                protocols_dir / "ipcp-v1.1-quantum-navigation.py"
            )
            ipcp_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(ipcp_module)
            
            # Performance test: Message creation speed
            message_creation_start = time.time()
            for i in range(100):
                protocol = ipcp_module.IPCPProtocol(f"test_node_{i}")
            message_creation_time = time.time() - message_creation_start
            
            # Performance test: Position calculation speed
            position_calculation_start = time.time()
            for i in range(100):
                position = ipcp_module.QuantumPosition(
                    x=i * 0.1, y=0.0, z=0.0,
                    accuracy=10.0,
                    timestamp=time.time(),
                    quantum_confidence=0.9,
                    entanglement_id=f"ent_{i}"
                )
            position_calculation_time = time.time() - position_calculation_start
            
            duration = time.time() - start_time
            
            # Performance criteria
            if message_creation_time < 1.0 and position_calculation_time < 1.0:
                status = "PASS"
                details = f"Performance tests passed. Message creation: {message_creation_time:.3f}s, Position calculation: {position_calculation_time:.3f}s"
            else:
                status = "FAIL"
                details = f"Performance tests failed. Message creation: {message_creation_time:.3f}s, Position calculation: {position_calculation_time:.3f}s"
            
            return TestResult("performance_tests", status, duration, details)
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult("performance_tests", "FAIL", duration, f"Exception: {str(e)}")
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all test suites"""
        print("🚀 Starting comprehensive test suite for interplanetary communications...")
        print(f"Test started at: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
        
        # Test suites to run
        test_suites = [
            ("Integration Tests", self.run_integration_tests),
            ("Protocol Validation", self.run_protocol_validation_tests),
            ("Quantum Navigation", self.run_quantum_navigation_tests),
            ("Performance Tests", self.run_performance_tests),
        ]
        
        # Run all test suites
        for suite_name, test_function in test_suites:
            print(f"\n{'='*60}")
            print(f"Running {suite_name}")
            print('='*60)
            
            try:
                result = test_function()
                self.test_results.append(result)
                
                if result.status == "PASS":
                    self.passed_tests += 1
                    print(f"✅ {suite_name}: PASSED ({result.duration:.2f}s)")
                else:
                    self.failed_tests += 1
                    print(f"❌ {suite_name}: FAILED ({result.duration:.2f}s)")
                    print(f"Details: {result.details[:200]}...")
                    
            except Exception as e:
                self.failed_tests += 1
                error_result = TestResult(suite_name, "FAIL", 0, f"Exception: {str(e)}")
                self.test_results.append(error_result)
                print(f"❌ {suite_name}: FAILED (Exception: {str(e)})")
        
        # Calculate totals
        self.total_tests = self.passed_tests + self.failed_tests
        total_duration = time.time() - self.start_time
        
        # Generate report
        return self.generate_report(total_duration)
    
    def generate_report(self, total_duration: float) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        success_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0
        
        report = {
            "test_summary": {
                "total_test_suites": self.total_tests,
                "passed_suites": self.passed_tests,
                "failed_suites": self.failed_tests,
                "success_rate": success_rate,
                "total_duration": total_duration,
                "overall_status": "PASS" if self.failed_tests == 0 else "FAIL",
                "timestamp": time.time()
            },
            "test_results": [
                {
                    "name": result.name,
                    "status": result.status,
                    "duration": result.duration,
                    "details": result.details,
                    "timestamp": result.timestamp
                }
                for result in self.test_results
            ],
            "recommendations": self.generate_recommendations()
        }
        
        return report
    
    def generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []
        
        for result in self.test_results:
            if result.status == "FAIL":
                if "integration" in result.name.lower():
                    recommendations.append("Review integration test failures - check protocol compatibility")
                elif "protocol" in result.name.lower():
                    recommendations.append("Investigate protocol validation failures - verify implementation correctness")
                elif "quantum" in result.name.lower():
                    recommendations.append("Check quantum navigation system - ensure dependencies are available")
                elif "performance" in result.name.lower():
                    recommendations.append("Optimize performance bottlenecks - consider algorithm improvements")
        
        if not recommendations:
            recommendations.append("All tests passed - system is ready for deployment")
        
        return recommendations
    
    def print_final_report(self, report: Dict[str, Any]) -> None:
        """Print final test report"""
        print("\n" + "="*80)
        print("COMPREHENSIVE TEST REPORT")
        print("="*80)
        
        summary = report["test_summary"]
        print(f"Total Test Suites: {summary['total_test_suites']}")
        print(f"Passed: {summary['passed_suites']}")
        print(f"Failed: {summary['failed_suites']}")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        print(f"Total Duration: {summary['total_duration']:.2f}s")
        print(f"Overall Status: {summary['overall_status']}")
        
        print("\nTest Suite Results:")
        for result in report["test_results"]:
            status_emoji = "✅" if result["status"] == "PASS" else "❌"
            print(f"  {status_emoji} {result['name']}: {result['status']} ({result['duration']:.2f}s)")
        
        if report["recommendations"]:
            print("\nRecommendations:")
            for rec in report["recommendations"]:
                print(f"  • {rec}")
        
        print("\n" + "="*80)
        print("Test completed at:", time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime()))
        print("="*80)

def main():
    """Main test runner function"""
    # Create test runner
    test_runner = ComprehensiveTestRunner()
    
    # Run all tests
    report = test_runner.run_all_tests()
    
    # Print final report
    test_runner.print_final_report(report)
    
    # Save report to file
    with open(project_root / "COMPREHENSIVE_TEST_REPORT.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\nDetailed report saved to: {project_root / 'COMPREHENSIVE_TEST_REPORT.json'}")
    
    # Return exit code based on test results
    return 0 if report["test_summary"]["overall_status"] == "PASS" else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)