#!/bin/bash
# GPU Test Runner Script
# Comprehensive testing script for the interplanetary communication GPU implementation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BUILD_TYPE="Release"
OUTPUT_DIR="./test_results"
DEVICE_ID=0
VERBOSE=0
PROFILE=0
MONITOR=0
TEST_CATEGORY="all"

# Print usage
usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -b, --build-type TYPE    Build type (Debug/Release) [default: Release]"
    echo "  -o, --output DIR         Output directory for results [default: ./test_results]"
    echo "  -d, --device ID          CUDA device ID [default: 0]"
    echo "  -c, --category CATEGORY  Test category (unit/performance/integration/stress/all) [default: all]"
    echo "  -p, --profile            Enable CUDA profiling"
    echo "  -m, --monitor            Enable GPU monitoring"
    echo "  -v, --verbose            Verbose output"
    echo "  -h, --help               Show this help message"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--build-type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -d|--device)
            DEVICE_ID="$2"
            shift 2
            ;;
        -c|--category)
            TEST_CATEGORY="$2"
            shift 2
            ;;
        -p|--profile)
            PROFILE=1
            shift
            ;;
        -m|--monitor)
            MONITOR=1
            shift
            ;;
        -v|--verbose)
            VERBOSE=1
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

# Print header
echo -e "${BLUE}=== Interplanetary Communication GPU Test Runner ===${NC}"
echo "Build Type: $BUILD_TYPE"
echo "Output Directory: $OUTPUT_DIR"
echo "CUDA Device: $DEVICE_ID"
echo "Test Category: $TEST_CATEGORY"
echo ""

# Check for CUDA
if ! command -v nvcc &> /dev/null; then
    echo -e "${RED}Error: CUDA not found. Please ensure CUDA is installed and in PATH.${NC}"
    exit 1
fi

# Print CUDA info
echo -e "${YELLOW}CUDA Information:${NC}"
nvcc --version | head -n 4
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if build directory exists
BUILD_DIR="build_${BUILD_TYPE,,}"
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${YELLOW}Build directory not found. Creating and configuring...${NC}"
    mkdir -p "$BUILD_DIR"
    cd "$BUILD_DIR"
    cmake -DCMAKE_BUILD_TYPE="$BUILD_TYPE" ..
    cd ..
fi

# Build tests
echo -e "${YELLOW}Building tests...${NC}"
cd "$BUILD_DIR"
make -j$(nproc)
cd ..

# Function to run a specific test
run_test() {
    local test_name=$1
    local test_binary=$2
    local test_args=$3
    
    echo -e "${BLUE}Running $test_name...${NC}"
    
    # Set environment variables for GPU monitoring
    if [ $MONITOR -eq 1 ]; then
        export CUDA_LAUNCH_BLOCKING=1
    fi
    
    # Set up profiling if requested
    if [ $PROFILE -eq 1 ]; then
        export CUDA_PROFILE=1
        export CUDA_PROFILE_LOG_VERSION=2.0
        export CUDA_PROFILE_CSV=1
        export CUDA_PROFILE_CONFIG=cuda_profile_config.txt
        
        # Create profiling config
        cat > cuda_profile_config.txt << EOF
# CUDA Profiling Configuration
profilelogformat CSV
gpustarttimestamp
gpuendtimestamp
gridsize
threadblocksize
dynsmemperblock
stasmemperblock
regperthread
memtransfersize
memtransferdir
memtransferhostmemtype
streamid
cacheconfigrequested
cacheconfigexecuted
countermodeaggregate
EOF
    fi
    
    # Run the test
    CUDA_VISIBLE_DEVICES=$DEVICE_ID "./$BUILD_DIR/tests/$test_binary" $test_args \
        --output "$OUTPUT_DIR" \
        $([ $VERBOSE -eq 1 ] && echo "--verbose") \
        $([ $PROFILE -eq 1 ] && echo "--profile") \
        $([ $MONITOR -eq 1 ] && echo "--monitor") \
        2>&1 | tee "$OUTPUT_DIR/${test_name}.log"
    
    # Check exit code
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo -e "${GREEN}✓ $test_name passed${NC}"
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        return 1
    fi
}

# Run tests based on category
FAILED_TESTS=0

if [ "$TEST_CATEGORY" == "all" ] || [ "$TEST_CATEGORY" == "unit" ]; then
    echo -e "\n${YELLOW}=== Unit Tests ===${NC}"
    run_test "Quantum Compression" "test_quantum_compression" "" || ((FAILED_TESTS++))
    run_test "Memory Validation" "test_memory_validation" "" || ((FAILED_TESTS++))
fi

if [ "$TEST_CATEGORY" == "all" ] || [ "$TEST_CATEGORY" == "performance" ]; then
    echo -e "\n${YELLOW}=== Performance Tests ===${NC}"
    run_test "Benchmark Suite" "benchmark_suite" "" || ((FAILED_TESTS++))
fi

if [ "$TEST_CATEGORY" == "all" ] || [ "$TEST_CATEGORY" == "integration" ]; then
    echo -e "\n${YELLOW}=== Integration Tests ===${NC}"
    run_test "Full System" "test_full_system" "" || ((FAILED_TESTS++))
fi

if [ "$TEST_CATEGORY" == "all" ] || [ "$TEST_CATEGORY" == "stress" ]; then
    echo -e "\n${YELLOW}=== Stress Tests ===${NC}"
    # Add stress tests here
fi

# Generate consolidated report
echo -e "\n${YELLOW}Generating test report...${NC}"
"./$BUILD_DIR/tests/run_all_tests" \
    --device $DEVICE_ID \
    --output "$OUTPUT_DIR" \
    $([ "$TEST_CATEGORY" != "all" ] && echo "--$TEST_CATEGORY")

# Check for memory leaks if in Debug mode
if [ "$BUILD_TYPE" == "Debug" ]; then
    echo -e "\n${YELLOW}Checking for memory leaks...${NC}"
    if command -v cuda-memcheck &> /dev/null; then
        cuda-memcheck --leak-check full "./$BUILD_DIR/tests/run_all_tests" --unit
    else
        echo -e "${YELLOW}cuda-memcheck not found. Skipping memory leak check.${NC}"
    fi
fi

# Summary
echo -e "\n${BLUE}=== Test Summary ===${NC}"
TOTAL_TESTS=$((FAILED_TESTS + $(ls "$OUTPUT_DIR"/*.log 2>/dev/null | wc -l)))
PASSED_TESTS=$((TOTAL_TESTS - FAILED_TESTS))

echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Check logs in $OUTPUT_DIR for details.${NC}"
    exit 1
fi