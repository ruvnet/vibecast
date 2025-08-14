#!/bin/bash

# Benchmark script for Anomaly Detector

set -e

echo "Running Anomaly Detector benchmarks..."

# Create benchmark directory if it doesn't exist
mkdir -p benchmarks/results

# Get current timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_DIR="benchmarks/results/$TIMESTAMP"
mkdir -p "$RESULTS_DIR"

echo "Results will be saved to: $RESULTS_DIR"

# Run CPU benchmarks
echo "Running CPU benchmarks..."
go test -bench=. -benchmem -cpuprofile="$RESULTS_DIR/cpu.prof" ./benchmarks/... > "$RESULTS_DIR/benchmark_results.txt" 2>&1

# Run memory benchmarks
echo "Running memory benchmarks..."
go test -bench=. -benchmem -memprofile="$RESULTS_DIR/mem.prof" ./benchmarks/... >> "$RESULTS_DIR/benchmark_results.txt" 2>&1

# Generate performance analysis
echo "Generating performance analysis..."

# CPU analysis
if command -v go &> /dev/null; then
    echo "CPU Profile Analysis:" >> "$RESULTS_DIR/analysis.txt"
    go tool pprof -text "$RESULTS_DIR/cpu.prof" >> "$RESULTS_DIR/analysis.txt" 2>&1
    echo "" >> "$RESULTS_DIR/analysis.txt"
    
    echo "Memory Profile Analysis:" >> "$RESULTS_DIR/analysis.txt"
    go tool pprof -text "$RESULTS_DIR/mem.prof" >> "$RESULTS_DIR/analysis.txt" 2>&1
fi

# Load test with sample data (if API is running)
if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo "Running load test against API..."
    
    # Simple load test
    echo "Load Test Results:" >> "$RESULTS_DIR/load_test.txt"
    echo "Testing with 100 concurrent requests..." >> "$RESULTS_DIR/load_test.txt"
    
    # Create sample text file
    SAMPLE_TEXT='{
        "text": "This is a sample text for load testing the anomaly detection API. It contains multiple sentences with various patterns and structures. The goal is to measure how well the system performs under concurrent load while maintaining accuracy in anomaly detection."
    }'
    
    # Run concurrent requests (if ab is available)
    if command -v ab &> /dev/null; then
        echo "$SAMPLE_TEXT" > "$RESULTS_DIR/sample.json"
        ab -n 100 -c 10 -T 'application/json' -p "$RESULTS_DIR/sample.json" http://localhost:8080/api/v1/analyze >> "$RESULTS_DIR/load_test.txt" 2>&1
    else
        echo "Apache Bench (ab) not available, skipping load test"
    fi
else
    echo "API not running, skipping load test"
fi

# Summary
echo ""
echo "Benchmark Summary:"
echo "=================="
echo "Results saved to: $RESULTS_DIR"
echo ""

if [ -f "$RESULTS_DIR/benchmark_results.txt" ]; then
    echo "Top 10 benchmark results:"
    grep "Benchmark" "$RESULTS_DIR/benchmark_results.txt" | head -10
fi

echo ""
echo "Files generated:"
ls -la "$RESULTS_DIR/"

echo ""
echo "To analyze profiles interactively:"
echo "  go tool pprof $RESULTS_DIR/cpu.prof"
echo "  go tool pprof $RESULTS_DIR/mem.prof"

echo ""
echo "Benchmarks complete!"