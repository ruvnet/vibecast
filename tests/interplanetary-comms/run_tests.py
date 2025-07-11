#!/usr/bin/env python3
"""
Test runner for interplanetary communications system tests.
Runs all test suites and generates comprehensive reports.
"""

import pytest
import sys
import os
import time
import argparse
from pathlib import Path
import subprocess
import json
from typing import Dict, List, Any, Optional

# Add project paths
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "interplanetary-comms" / "simulations"))

def run_test_suite(test_dir: str, test_name: str, args: List[str] = None) -> Dict[str, Any]:
    """Run a specific test suite"""
    test_path = Path(__file__).parent / test_dir
    
    if not test_path.exists():
        return {
            "name": test_name,
            "status": "skipped",
            "reason": f"Test directory not found: {test_path}",
            "duration": 0,
            "passed": 0,
            "failed": 0,
            "errors": []
        }
    
    # Build pytest command
    cmd = [
        sys.executable, "-m", "pytest",
        str(test_path),
        "-v",
        "--tb=short",
        "--json-report",
        "--json-report-file=" + str(test_path / "test_report.json")
    ]
    
    if args:
        cmd.extend(args)
    
    # Run tests
    start_time = time.time()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)  # 30 minute timeout
        duration = time.time() - start_time
        
        # Parse JSON report if available
        report_file = test_path / "test_report.json"
        if report_file.exists():
            with open(report_file, 'r') as f:
                json_report = json.load(f)
            
            return {
                "name": test_name,
                "status": "passed" if result.returncode == 0 else "failed",
                "duration": duration,
                "passed": json_report.get("summary", {}).get("passed", 0),
                "failed": json_report.get("summary", {}).get("failed", 0),
                "errors": json_report.get("summary", {}).get("error", 0),
                "stdout": result.stdout,
                "stderr": result.stderr,
                "json_report": json_report
            }
        else:
            return {
                "name": test_name,
                "status": "passed" if result.returncode == 0 else "failed",
                "duration": duration,
                "passed": 0,
                "failed": 0,
                "errors": [],
                "stdout": result.stdout,
                "stderr": result.stderr
            }
    
    except subprocess.TimeoutExpired:
        return {
            "name": test_name,
            "status": "timeout",
            "duration": time.time() - start_time,
            "passed": 0,
            "failed": 0,
            "errors": ["Test suite timed out after 30 minutes"],
            "stdout": "",
            "stderr": ""
        }
    except Exception as e:
        return {
            "name": test_name,
            "status": "error",
            "duration": time.time() - start_time,
            "passed": 0,
            "failed": 0,
            "errors": [str(e)],
            "stdout": "",
            "stderr": ""
        }

def generate_html_report(results: List[Dict[str, Any]], output_file: str):
    """Generate HTML test report"""
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Interplanetary Communications Test Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
            .summary { background: #ecf0f1; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .test-suite { border: 1px solid #bdc3c7; margin: 10px 0; border-radius: 5px; }
            .test-suite-header { background: #34495e; color: white; padding: 10px; }
            .test-suite-content { padding: 15px; }
            .passed { color: #27ae60; }
            .failed { color: #e74c3c; }
            .error { color: #f39c12; }
            .timeout { color: #9b59b6; }
            .skipped { color: #95a5a6; }
            .metrics { display: flex; justify-content: space-around; margin: 20px 0; }
            .metric { text-align: center; padding: 10px; background: #ecf0f1; border-radius: 5px; }
            .metric-value { font-size: 24px; font-weight: bold; }
            .metric-label { font-size: 14px; color: #7f8c8d; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚀 Interplanetary Communications System Test Report</h1>
            <p>Generated on: {timestamp}</p>
        </div>
        
        <div class="summary">
            <h2>Test Summary</h2>
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">{total_tests}</div>
                    <div class="metric-label">Total Tests</div>
                </div>
                <div class="metric passed">
                    <div class="metric-value">{total_passed}</div>
                    <div class="metric-label">Passed</div>
                </div>
                <div class="metric failed">
                    <div class="metric-value">{total_failed}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric error">
                    <div class="metric-value">{total_errors}</div>
                    <div class="metric-label">Errors</div>
                </div>
                <div class="metric">
                    <div class="metric-value">{total_duration:.1f}s</div>
                    <div class="metric-label">Total Duration</div>
                </div>
            </div>
        </div>
        
        <div class="test-suites">
            <h2>Test Suite Results</h2>
            {test_suite_results}
        </div>
    </body>
    </html>
    """
    
    # Calculate totals
    total_tests = len(results)
    total_passed = sum(r['passed'] for r in results)
    total_failed = sum(r['failed'] for r in results)
    total_errors = sum(len(r['errors']) for r in results)
    total_duration = sum(r['duration'] for r in results)
    
    # Generate test suite HTML
    test_suite_html = ""
    for result in results:
        status_class = result['status']
        test_suite_html += f"""
        <div class="test-suite">
            <div class="test-suite-header">
                <h3>{result['name']} - <span class="{status_class}">{result['status'].upper()}</span></h3>
            </div>
            <div class="test-suite-content">
                <p><strong>Duration:</strong> {result['duration']:.1f} seconds</p>
                <p><strong>Passed:</strong> {result['passed']}</p>
                <p><strong>Failed:</strong> {result['failed']}</p>
                <p><strong>Errors:</strong> {len(result['errors'])}</p>
                
                {f"<h4>Errors:</h4><ul>{''.join(f'<li>{error}</li>' for error in result['errors'])}</ul>" if result['errors'] else ""}
                
                {f"<h4>Output:</h4><pre>{result['stdout']}</pre>" if result.get('stdout') else ""}
                {f"<h4>Errors:</h4><pre>{result['stderr']}</pre>" if result.get('stderr') else ""}
            </div>
        </div>
        """
    
    # Fill template
    html_content = html_template.format(
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
        total_tests=total_tests,
        total_passed=total_passed,
        total_failed=total_failed,
        total_errors=total_errors,
        total_duration=total_duration,
        test_suite_results=test_suite_html
    )
    
    # Write HTML file
    with open(output_file, 'w') as f:
        f.write(html_content)

def main():
    """Main test runner"""
    parser = argparse.ArgumentParser(description="Run interplanetary communications tests")
    parser.add_argument("--suite", choices=["unit", "integration", "performance", "security", "simulation", "e2e", "all"], 
                       default="all", help="Test suite to run")
    parser.add_argument("--output", default="test_report.html", help="Output HTML report file")
    parser.add_argument("--json", default="test_report.json", help="Output JSON report file")
    parser.add_argument("--timeout", type=int, default=1800, help="Test timeout in seconds")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--parallel", "-j", type=int, default=1, help="Number of parallel test processes")
    
    args = parser.parse_args()
    
    # Define test suites
    test_suites = {
        "unit": ("unit", "Unit Tests - Quantum Navigation"),
        "integration": ("integration", "Integration Tests - Protocol Implementation"),
        "performance": ("performance", "Performance Tests - Benchmarks"),
        "security": ("security", "Security Tests - Quantum Key Distribution"),
        "simulation": ("simulation", "Simulation Tests - Accuracy Validation"),
        "e2e": ("e2e", "End-to-End Tests - Full Communication Workflows")
    }
    
    # Select test suites to run
    if args.suite == "all":
        suites_to_run = test_suites
    else:
        suites_to_run = {args.suite: test_suites[args.suite]}
    
    print("🚀 Starting Interplanetary Communications System Tests")
    print("=" * 60)
    
    # Run test suites
    results = []
    for suite_key, (test_dir, test_name) in suites_to_run.items():
        print(f"\n📋 Running {test_name}...")
        
        # Additional pytest args
        pytest_args = []
        if args.verbose:
            pytest_args.append("-vv")
        if args.parallel > 1:
            pytest_args.extend(["-n", str(args.parallel)])
        
        result = run_test_suite(test_dir, test_name, pytest_args)
        results.append(result)
        
        # Print immediate results
        status_emoji = {
            "passed": "✅",
            "failed": "❌",
            "error": "⚠️",
            "timeout": "⏰",
            "skipped": "⏭️"
        }
        
        print(f"{status_emoji.get(result['status'], '❓')} {test_name}: {result['status'].upper()}")
        print(f"   Duration: {result['duration']:.1f}s")
        print(f"   Passed: {result['passed']}, Failed: {result['failed']}, Errors: {len(result['errors'])}")
        
        if result['errors']:
            print(f"   Errors: {', '.join(result['errors'][:3])}")
    
    # Generate reports
    print("\n📊 Generating Test Reports...")
    
    # HTML Report
    generate_html_report(results, args.output)
    print(f"   HTML Report: {args.output}")
    
    # JSON Report
    with open(args.json, 'w') as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_duration": sum(r['duration'] for r in results),
            "total_tests": len(results),
            "results": results
        }, f, indent=2)
    print(f"   JSON Report: {args.json}")
    
    # Summary
    print("\n📈 Test Summary:")
    print("=" * 60)
    
    total_passed = sum(r['passed'] for r in results)
    total_failed = sum(r['failed'] for r in results)
    total_errors = sum(len(r['errors']) for r in results)
    total_duration = sum(r['duration'] for r in results)
    
    print(f"Total Test Suites: {len(results)}")
    print(f"Total Passed: {total_passed}")
    print(f"Total Failed: {total_failed}")
    print(f"Total Errors: {total_errors}")
    print(f"Total Duration: {total_duration:.1f} seconds")
    
    # Overall status
    overall_status = "PASSED" if all(r['status'] == "passed" for r in results) else "FAILED"
    status_emoji = "✅" if overall_status == "PASSED" else "❌"
    
    print(f"\n{status_emoji} Overall Status: {overall_status}")
    
    # Exit with appropriate code
    sys.exit(0 if overall_status == "PASSED" else 1)

if __name__ == "__main__":
    main()