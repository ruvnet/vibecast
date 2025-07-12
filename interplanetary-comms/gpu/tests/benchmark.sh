#!/bin/bash
# GPU Performance Benchmarking Script
# Runs comprehensive performance benchmarks with profiling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
OUTPUT_DIR="./benchmark_results"
DEVICE_ID=0
ITERATIONS=100
ENABLE_NVPROF=0
ENABLE_NSight=0

# Benchmark configurations
SIZES=(
    "1024"      # 1K
    "16384"     # 16K
    "262144"    # 256K  
    "1048576"   # 1M
    "16777216"  # 16M
    "67108864"  # 64M
    "268435456" # 256M
)

# Print usage
usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -o, --output DIR         Output directory [default: ./benchmark_results]"
    echo "  -d, --device ID          CUDA device ID [default: 0]"
    echo "  -i, --iterations NUM     Number of iterations per test [default: 100]"
    echo "  -p, --nvprof             Enable nvprof profiling"
    echo "  -n, --nsight             Enable Nsight Systems profiling"
    echo "  -h, --help               Show this help message"
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -d|--device)
            DEVICE_ID="$2"
            shift 2
            ;;
        -i|--iterations)
            ITERATIONS="$2"
            shift 2
            ;;
        -p|--nvprof)
            ENABLE_NVPROF=1
            shift
            ;;
        -n|--nsight)
            ENABLE_NSight=1
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Create output directory with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="${OUTPUT_DIR}_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

# Print header
echo -e "${BLUE}=== GPU Performance Benchmarking ===${NC}"
echo "Output Directory: $OUTPUT_DIR"
echo "CUDA Device: $DEVICE_ID"
echo "Iterations: $ITERATIONS"
echo ""

# Check GPU info
echo -e "${YELLOW}GPU Information:${NC}"
nvidia-smi --query-gpu=name,driver_version,memory.total,compute_cap \
    --format=csv,noheader --id=$DEVICE_ID

# Build benchmark suite
echo -e "\n${YELLOW}Building benchmark suite...${NC}"
if [ ! -d "build_release" ]; then
    mkdir -p build_release
    cd build_release
    cmake -DCMAKE_BUILD_TYPE=Release ..
    cd ..
fi

cd build_release
make benchmark_suite -j$(nproc)
cd ..

# Function to run benchmark with profiling
run_benchmark() {
    local size=$1
    local test_name="benchmark_size_${size}"
    
    echo -e "\n${BLUE}Running benchmark for size: $size${NC}"
    
    # Base command
    CMD="CUDA_VISIBLE_DEVICES=$DEVICE_ID ./build_release/tests/benchmark_suite"
    CMD="$CMD --size $size --iterations $ITERATIONS"
    CMD="$CMD --output $OUTPUT_DIR/${test_name}.json"
    CMD="$CMD --monitor --profile"
    
    # Run with nvprof if enabled
    if [ $ENABLE_NVPROF -eq 1 ]; then
        echo -e "${YELLOW}Running with nvprof...${NC}"
        nvprof --export-profile "$OUTPUT_DIR/${test_name}.nvprof" \
               --print-gpu-trace \
               --print-api-trace \
               $CMD 2>&1 | tee "$OUTPUT_DIR/${test_name}_nvprof.log"
    fi
    
    # Run with Nsight Systems if enabled
    if [ $ENABLE_NSight -eq 1 ]; then
        echo -e "${YELLOW}Running with Nsight Systems...${NC}"
        nsys profile --output="$OUTPUT_DIR/${test_name}" \
                    --force-overwrite=true \
                    --stats=true \
                    $CMD 2>&1 | tee "$OUTPUT_DIR/${test_name}_nsys.log"
    fi
    
    # Regular run
    echo -e "${YELLOW}Running benchmark...${NC}"
    $CMD 2>&1 | tee "$OUTPUT_DIR/${test_name}.log"
}

# Run benchmarks for all sizes
for size in "${SIZES[@]}"; do
    run_benchmark $size
done

# Generate comparison report
echo -e "\n${YELLOW}Generating performance comparison report...${NC}"

cat > "$OUTPUT_DIR/performance_report.py" << 'EOF'
#!/usr/bin/env python3
import json
import os
import matplotlib.pyplot as plt
import numpy as np

# Read all benchmark results
results = {}
for filename in os.listdir('.'):
    if filename.startswith('benchmark_size_') and filename.endswith('.json'):
        with open(filename, 'r') as f:
            data = json.load(f)
            size = int(filename.split('_')[2].split('.')[0])
            results[size] = data

# Extract metrics
sizes = sorted(results.keys())
bandwidths = [results[s]['results'][0]['bandwidth_gb_s'] for s in sizes]
throughputs = [results[s]['results'][0]['throughput_gflops'] for s in sizes]
latencies = [results[s]['results'][0]['mean_time_ms'] for s in sizes]

# Create plots
fig, axes = plt.subplots(2, 2, figsize=(12, 10))

# Bandwidth plot
axes[0, 0].semilogx(sizes, bandwidths, 'b-o')
axes[0, 0].set_xlabel('Data Size (elements)')
axes[0, 0].set_ylabel('Bandwidth (GB/s)')
axes[0, 0].set_title('Memory Bandwidth vs Data Size')
axes[0, 0].grid(True)

# Throughput plot
axes[0, 1].semilogx(sizes, throughputs, 'r-o')
axes[0, 1].set_xlabel('Data Size (elements)')
axes[0, 1].set_ylabel('Throughput (GFLOPS)')
axes[0, 1].set_title('Compute Throughput vs Data Size')
axes[0, 1].grid(True)

# Latency plot
axes[1, 0].loglog(sizes, latencies, 'g-o')
axes[1, 0].set_xlabel('Data Size (elements)')
axes[1, 0].set_ylabel('Latency (ms)')
axes[1, 0].set_title('Kernel Latency vs Data Size')
axes[1, 0].grid(True)

# Efficiency plot
efficiencies = [t/l for t, l in zip(throughputs, latencies)]
axes[1, 1].semilogx(sizes, efficiencies, 'm-o')
axes[1, 1].set_xlabel('Data Size (elements)')
axes[1, 1].set_ylabel('Efficiency (GFLOPS/ms)')
axes[1, 1].set_title('Compute Efficiency vs Data Size')
axes[1, 1].grid(True)

plt.tight_layout()
plt.savefig('performance_comparison.png', dpi=300)
plt.savefig('performance_comparison.pdf')

# Generate summary table
print("\n=== Performance Summary ===")
print(f"{'Size':>10} | {'Bandwidth':>12} | {'Throughput':>12} | {'Latency':>10}")
print("-" * 60)
for i, size in enumerate(sizes):
    print(f"{size:>10} | {bandwidths[i]:>10.2f} GB/s | "
          f"{throughputs[i]:>10.2f} GFLOPS | {latencies[i]:>8.2f} ms")
EOF

chmod +x "$OUTPUT_DIR/performance_report.py"
cd "$OUTPUT_DIR"
python3 performance_report.py
cd ..

# Generate roofline model
echo -e "\n${YELLOW}Generating roofline model...${NC}"
cat > "$OUTPUT_DIR/roofline.py" << 'EOF'
#!/usr/bin/env python3
import matplotlib.pyplot as plt
import numpy as np

# GPU specifications (update based on your GPU)
peak_bandwidth = 900  # GB/s (e.g., V100)
peak_performance = 15700  # GFLOPS (e.g., V100 FP32)

# Calculate roofline
arithmetic_intensity = np.logspace(-2, 3, 1000)
memory_bound = peak_bandwidth * arithmetic_intensity
compute_bound = np.ones_like(arithmetic_intensity) * peak_performance
roofline = np.minimum(memory_bound, compute_bound)

# Plot
plt.figure(figsize=(10, 8))
plt.loglog(arithmetic_intensity, roofline, 'k-', linewidth=2, label='Roofline')
plt.loglog(arithmetic_intensity, memory_bound, 'b--', alpha=0.5, label='Memory Bound')
plt.loglog(arithmetic_intensity, compute_bound, 'r--', alpha=0.5, label='Compute Bound')

# Add measured points from benchmarks
# TODO: Calculate actual arithmetic intensity from benchmarks

plt.xlabel('Arithmetic Intensity (FLOPS/Byte)')
plt.ylabel('Performance (GFLOPS)')
plt.title('GPU Roofline Model')
plt.legend()
plt.grid(True, which="both", ls="-", alpha=0.2)
plt.savefig('roofline_model.png', dpi=300)
plt.savefig('roofline_model.pdf')
EOF

chmod +x "$OUTPUT_DIR/roofline.py"
cd "$OUTPUT_DIR"
python3 roofline.py
cd ..

# Summary
echo -e "\n${GREEN}Benchmarking complete!${NC}"
echo "Results saved to: $OUTPUT_DIR"
echo ""
echo "Generated files:"
echo "  - Performance JSON results"
echo "  - Performance comparison plots"
echo "  - Roofline model analysis"
[ $ENABLE_NVPROF -eq 1 ] && echo "  - nvprof profiling data"
[ $ENABLE_NSight -eq 1 ] && echo "  - Nsight Systems traces"

# Open results if display is available
if [ -n "$DISPLAY" ]; then
    xdg-open "$OUTPUT_DIR/performance_comparison.png" 2>/dev/null || true
fi