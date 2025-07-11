#!/bin/bash
# Test runner script for cuda-rust-wasm

set -e

echo "🧪 CUDA-Rust-WASM Test Suite"
echo "============================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests with timing
run_test() {
    local test_name=$1
    local test_cmd=$2
    
    echo -e "\n${YELLOW}Running: ${test_name}${NC}"
    start_time=$(date +%s)
    
    if eval "$test_cmd"; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo -e "${GREEN}✓ ${test_name} passed (${duration}s)${NC}"
        return 0
    else
        echo -e "${RED}✗ ${test_name} failed${NC}"
        return 1
    fi
}

# Check for arguments
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [test-type]"
    echo ""
    echo "Test types:"
    echo "  unit      - Run unit tests"
    echo "  integration - Run integration tests"
    echo "  property  - Run property-based tests"
    echo "  bench     - Run benchmarks"
    echo "  coverage  - Generate coverage report"
    echo "  all       - Run all tests (default)"
    echo ""
    exit 0
fi

TEST_TYPE=${1:-all}

# Track failures
FAILED=0

# Unit tests
if [ "$TEST_TYPE" == "unit" ] || [ "$TEST_TYPE" == "all" ]; then
    run_test "Parser Tests" "cargo test parser_tests" || FAILED=$((FAILED + 1))
    run_test "Transpiler Tests" "cargo test transpiler_tests" || FAILED=$((FAILED + 1))
    run_test "Memory Tests" "cargo test memory_tests" || FAILED=$((FAILED + 1))
fi

# Integration tests
if [ "$TEST_TYPE" == "integration" ] || [ "$TEST_TYPE" == "all" ]; then
    run_test "Integration Tests" "cargo test integration_tests -- --test-threads=1" || FAILED=$((FAILED + 1))
fi

# Property-based tests
if [ "$TEST_TYPE" == "property" ] || [ "$TEST_TYPE" == "all" ]; then
    echo -e "\n${YELLOW}Note: Property tests may take longer to run${NC}"
    run_test "Property Tests" "PROPTEST_CASES=100 cargo test property_tests -- --test-threads=1" || FAILED=$((FAILED + 1))
fi

# Benchmarks
if [ "$TEST_TYPE" == "bench" ]; then
    echo -e "\n${YELLOW}Running benchmarks...${NC}"
    cargo bench --no-fail-fast
fi

# Coverage
if [ "$TEST_TYPE" == "coverage" ]; then
    echo -e "\n${YELLOW}Generating coverage report...${NC}"
    
    # Check if tarpaulin is installed
    if ! command -v cargo-tarpaulin &> /dev/null; then
        echo "Installing cargo-tarpaulin..."
        cargo install cargo-tarpaulin
    fi
    
    # Run coverage
    cargo tarpaulin --out Html --output-dir target/coverage
    echo -e "${GREEN}Coverage report generated at: target/coverage/tarpaulin-report.html${NC}"
fi

# Summary
echo -e "\n============================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED test suite(s) failed${NC}"
    exit 1
fi