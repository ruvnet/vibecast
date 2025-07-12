# GPU Testing Framework

Comprehensive testing framework for the Interplanetary Communication System GPU implementation.

## Overview

This testing framework provides:
- **Unit Tests**: Test individual GPU kernels and components
- **Performance Benchmarks**: Measure throughput, bandwidth, and latency
- **Integration Tests**: Test the complete communication pipeline
- **Memory Validation**: Verify memory patterns and detect leaks
- **Automated Test Runner**: Execute all tests with detailed reporting

## Directory Structure

```
gpu/tests/
├── unit/                     # Unit tests for individual components
│   ├── test_quantum_compression.cu
│   └── test_memory_validation.cu
├── performance/              # Performance benchmarking tools
│   └── benchmark_suite.cu
├── integration/              # Full system integration tests
│   └── test_full_system.cu
├── utils/                    # Testing utilities and framework
│   ├── cuda_test_framework.cuh
│   └── cuda_error_check.h
├── benchmarks/              # Benchmark output directory
├── reports/                 # Test reports and analysis
├── run_tests.sh            # Main test runner script
├── benchmark.sh            # Performance benchmarking script
├── run_all_tests.cu        # Automated test runner
└── CMakeLists.txt          # Build configuration

```

## Building the Tests

```bash
# Create build directory
mkdir build_release
cd build_release

# Configure with CMake
cmake -DCMAKE_BUILD_TYPE=Release ..

# Build all tests
make -j$(nproc)

# Or build specific test
make test_quantum_compression
```

## Running Tests

### Quick Start

```bash
# Run all tests
./run_tests.sh

# Run specific category
./run_tests.sh --category unit
./run_tests.sh --category performance
./run_tests.sh --category integration

# Run with GPU monitoring
./run_tests.sh --monitor --verbose
```

### Using the Test Runner

```bash
# Run all tests with default settings
./build_release/tests/run_all_tests

# Run only unit tests
./build_release/tests/run_all_tests --unit

# Run with profiling enabled
./build_release/tests/run_all_tests --profile --monitor

# Specify output directory
./build_release/tests/run_all_tests --output ./my_results

# Use specific GPU
./build_release/tests/run_all_tests --device 1
```

### Running Individual Tests

```bash
# Quantum compression test
./build_release/tests/test_quantum_compression

# Memory validation test
./build_release/tests/test_memory_validation

# Full system integration test
./build_release/tests/test_full_system
```

## Performance Benchmarking

### Running Benchmarks

```bash
# Basic benchmark run
./benchmark.sh

# With profiling
./benchmark.sh --nvprof --iterations 1000

# With Nsight Systems
./benchmark.sh --nsight --device 0
```

### Benchmark Metrics

The benchmarking suite measures:
- **Memory Bandwidth**: GB/s for different data sizes
- **Compute Throughput**: GFLOPS for kernel operations
- **Latency**: Kernel execution time in milliseconds
- **Power Efficiency**: GFLOPS per watt
- **Temperature**: GPU temperature during execution
- **Occupancy**: Kernel occupancy percentage

## Test Framework Features

### 1. CUDA Error Checking

Comprehensive error checking for all CUDA operations:

```cpp
#include "utils/cuda_error_check.h"

// Automatic error checking
CUDA_CHECK(cudaMalloc(&ptr, size));
CUDNN_CHECK(cudnnCreateTensorDescriptor(&desc));
CUBLAS_CHECK(cublasSgemm(...));

// Kernel launch checking
CUDA_LAUNCH(myKernel, grid, block, 0, stream, args...);
```

### 2. Performance Profiling

Built-in profiling support:

```cpp
KernelProfiler profiler;
profiler.MarkStart("Compression", stream);
// ... kernel execution ...
profiler.MarkEnd(stream);
profiler.PrintSummary();
```

### 3. Memory Leak Detection

Automatic memory leak detection:

```cpp
MemoryLeakDetector detector;
detector.Start();
// ... test execution ...
if (!detector.CheckForLeaks()) {
    std::cerr << "Leak: " << detector.GetLeakedBytes() << " bytes\n";
}
```

### 4. Test Organization

Tests are organized using the TestSuite class:

```cpp
TestSuite suite("My Tests");
suite.AddTest(std::make_unique<MyTest>());
suite.RunAll();
suite.GenerateReport("results.json");
```

## Writing New Tests

### Creating a Unit Test

```cpp
#include "../utils/cuda_test_framework.cuh"

class MyKernelTest : public cuda_test::CudaTest {
public:
    void SetUp() override {
        // Allocate resources
    }
    
    TestResult Run() override {
        TestResult result;
        result.test_name = "My Kernel Test";
        
        // Run test
        StartTiming();
        myKernel<<<grid, block, 0, stream_>>>(...);
        float time = StopTiming();
        
        // Verify results
        if (VerifyResults()) {
            result.passed = true;
        } else {
            result.passed = false;
            result.error_message = "Verification failed";
        }
        
        return result;
    }
    
    void TearDown() override {
        // Clean up resources
    }
};
```

### Creating a Benchmark

```cpp
class MyBenchmark : public gpu_benchmark::Benchmark {
public:
    void Initialize(size_t problem_size) override {
        // Set up benchmark for given size
    }
    
    void RunKernel() override {
        // Execute kernel to benchmark
    }
    
    void Cleanup() override {
        // Clean up after benchmark
    }
    
    size_t GetBytesTransferred() const override {
        // Return total bytes read/written
    }
    
    size_t GetFLOPCount() const override {
        // Return total floating point operations
    }
};
```

## Test Reports

### JSON Output Format

```json
{
  "benchmark": "Quantum Compression",
  "results": [
    {
      "problem_size": 1048576,
      "mean_time_ms": 2.34,
      "bandwidth_gb_s": 145.6,
      "throughput_gflops": 234.5,
      "power_efficiency_gflops_per_watt": 12.3
    }
  ]
}
```

### HTML Reports

Test results are automatically converted to HTML reports with:
- Summary statistics
- Pass/fail status for each test
- Performance graphs
- Detailed error messages

## Continuous Integration

### GitHub Actions Example

```yaml
name: GPU Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: [self-hosted, gpu]
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Tests
        run: |
          mkdir build
          cd build
          cmake -DCMAKE_BUILD_TYPE=Release ..
          make -j
      
      - name: Run Tests
        run: ./run_tests.sh --output ./test_results
      
      - name: Upload Results
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: test_results/
```

## Troubleshooting

### Common Issues

1. **CUDA Out of Memory**
   - Reduce test data sizes
   - Run tests individually
   - Check for memory leaks

2. **Test Timeout**
   - Increase timeout in CMakeLists.txt
   - Check for infinite loops
   - Verify kernel convergence

3. **Compilation Errors**
   - Verify CUDA toolkit version
   - Check compute capability settings
   - Update GPU driver

### Debug Mode

Run tests in debug mode for detailed information:

```bash
# Build debug version
mkdir build_debug
cd build_debug
cmake -DCMAKE_BUILD_TYPE=Debug ..
make

# Run with cuda-memcheck
cuda-memcheck ./test_quantum_compression

# Run with cuda-gdb
cuda-gdb ./test_quantum_compression
```

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Include comprehensive error checking
3. Add performance metrics collection
4. Document expected behavior
5. Update CMakeLists.txt

## License

This testing framework is part of the Interplanetary Communication System project.