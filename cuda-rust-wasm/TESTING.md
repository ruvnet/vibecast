# CUDA-Rust-WASM Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for the CUDA-Rust-WASM transpiler project. Our testing approach ensures correctness, performance, and reliability while targeting 70% of native CUDA performance.

## Testing Philosophy

1. **Correctness First**: Ensure functional correctness before optimizing performance
2. **Performance Validation**: Continuously measure against the 70% performance target
3. **Property-Based Testing**: Use property tests to catch edge cases
4. **Comprehensive Coverage**: Target 80%+ code coverage with meaningful tests

## Test Categories

### 1. Unit Tests

Located in `tests/` directory, organized by module:

- **Parser Tests** (`parser_tests.rs`)
  - Syntax validation
  - AST generation correctness
  - Error handling
  - Edge cases (empty kernels, complex syntax)

- **Transpiler Tests** (`transpiler_tests.rs`)
  - CUDA to WASM translation
  - Feature support (atomics, shared memory, intrinsics)
  - Optimization levels
  - Error handling

- **Memory Tests** (`memory_tests.rs`)
  - Allocation strategies
  - Memory pool management
  - Fragmentation handling
  - Concurrent access

### 2. Integration Tests

Located in `tests/integration_tests.rs`:

- End-to-end workflows
- Multi-kernel pipelines
- Complex computation patterns
- Error propagation

### 3. Property-Based Tests

Located in `tests/property_tests.rs`:

- Mathematical properties (commutativity, associativity)
- Memory safety guarantees
- Type conversion correctness
- Bounds checking

### 4. Performance Benchmarks

Located in `benches/` directory:

- **Memory Benchmarks** (`memory_benchmarks.rs`)
  - Allocation performance
  - Transfer speeds
  - Fragmentation impact

- **Kernel Benchmarks** (`kernel_benchmarks.rs`)
  - Launch overhead
  - Compute performance
  - Optimization impact

- **Transpiler Benchmarks** (`transpiler_benchmarks.rs`)
  - Compilation speed
  - Code size impact
  - Feature overhead

- **WASM vs Native** (`wasm_vs_native_benchmarks.rs`)
  - Performance comparison
  - 70% target validation
  - Bottleneck identification

## Running Tests

### Unit Tests
```bash
# Run all tests
cargo test

# Run specific test module
cargo test parser_tests

# Run with output
cargo test -- --nocapture

# Run single test
cargo test test_parse_empty_kernel
```

### Integration Tests
```bash
# Run integration tests
cargo test --test integration_tests

# Run with release optimizations
cargo test --release
```

### Property Tests
```bash
# Run property tests (takes longer)
cargo test property_tests -- --test-threads=1

# Run with more test cases
PROPTEST_CASES=1000 cargo test property_tests
```

### Benchmarks
```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench memory_benchmarks

# Run with baseline comparison
cargo bench -- --save-baseline main

# Compare against baseline
cargo bench -- --baseline main
```

### Coverage Reports
```bash
# Install tarpaulin
cargo install cargo-tarpaulin

# Generate coverage report
cargo tarpaulin --out Html --output-dir target/coverage

# With branch coverage
cargo tarpaulin --branch --out Lcov

# View report
open target/coverage/tarpaulin-report.html
```

## Performance Testing

### Target: 70% of Native CUDA Performance

Our performance tests validate against this target using:

1. **Simulated Native Performance**: Baseline estimates for CUDA operations
2. **WASM Measurements**: Actual transpiled code performance
3. **Ratio Analysis**: Performance percentage calculation

### Key Performance Metrics

- **Kernel Launch Overhead**: < 100μs
- **Memory Transfer**: > 10 GB/s
- **Compute Throughput**: > 70% of native
- **Compilation Time**: < 1s for typical kernels

### Performance Profiling

Use the built-in profiling tools:

```rust
// Enable profiling
let mut profiler = KernelProfiler::new();
profiler.enable();

// Run kernels with profiling
let timer = profiler.start_kernel("my_kernel");
// ... launch kernel ...
profiler.end_kernel(timer, &config, bytes_processed, operations);

// Print results
profiler.print_summary();
```

## Continuous Integration

### Test Matrix

- **Operating Systems**: Linux, macOS, Windows
- **Rust Versions**: Stable, Beta, Nightly
- **WASM Runtimes**: Wasmtime, Wasmer
- **CUDA Versions**: 11.0+

### CI Pipeline

1. **Lint & Format**
   ```bash
   cargo fmt -- --check
   cargo clippy -- -D warnings
   ```

2. **Build**
   ```bash
   cargo build --all-features
   cargo build --release
   ```

3. **Test**
   ```bash
   cargo test --all-features
   cargo test --release
   ```

4. **Benchmark**
   ```bash
   cargo bench --no-fail-fast
   ```

5. **Coverage**
   ```bash
   cargo tarpaulin --out Xml
   ```

## Test Data

### Generators

Located in `tests/common/mod.rs`:

- Random float/int arrays
- Matrix generation
- Kernel templates
- Benchmark configurations

### Test Kernels

Pre-defined CUDA kernels for testing:

- Vector operations
- Matrix multiplication
- Reductions
- Atomic operations
- Memory patterns

## Debugging Tests

### Verbose Output
```bash
RUST_LOG=debug cargo test
```

### Single-threaded Execution
```bash
cargo test -- --test-threads=1
```

### GDB Debugging
```bash
cargo test --no-run
gdb target/debug/deps/cuda_rust_wasm-*
```

### Memory Leak Detection
```bash
RUSTFLAGS="-Z sanitizer=leak" cargo test --target x86_64-unknown-linux-gnu
```

## Best Practices

1. **Test Naming**: Use descriptive names that explain what is being tested
2. **Assertions**: Include meaningful error messages in assertions
3. **Test Data**: Use property-based testing for comprehensive coverage
4. **Performance**: Keep unit tests fast (< 100ms each)
5. **Isolation**: Tests should not depend on external state
6. **Documentation**: Document complex test scenarios

## Adding New Tests

1. **Identify Test Category**: Unit, integration, property, or benchmark
2. **Create Test File**: Follow existing naming conventions
3. **Write Test Cases**: Cover happy path, edge cases, and error conditions
4. **Add Benchmarks**: For performance-critical code
5. **Update Documentation**: Document new test scenarios

## Test Coverage Goals

- **Overall Coverage**: > 80%
- **Critical Paths**: > 90%
- **Error Handling**: 100%
- **Public APIs**: 100%

## Performance Regression Detection

1. **Baseline Benchmarks**: Save before major changes
2. **Automated Comparison**: CI compares against baseline
3. **Threshold Alerts**: Flag >5% performance regression
4. **Historical Tracking**: Maintain performance history

## Troubleshooting

### Common Issues

1. **Flaky Tests**: Use larger timeouts or deterministic test data
2. **Platform Differences**: Use cfg attributes for platform-specific tests
3. **Resource Limits**: Some tests need increased stack/heap size
4. **Benchmark Variance**: Run with `--bench-threads=1` for consistency

### Debug Commands

```bash
# Run with backtrace
RUST_BACKTRACE=1 cargo test

# Run with full backtrace
RUST_BACKTRACE=full cargo test

# Memory debugging
RUSTFLAGS="-C debug-assertions" cargo test

# Optimization debugging
RUSTFLAGS="-C opt-level=0" cargo test
```

## Future Improvements

1. **Fuzzing**: Add fuzzing for parser and transpiler
2. **Mutation Testing**: Ensure test quality
3. **Performance Tracking**: Dashboard for historical performance
4. **GPU Testing**: Actual CUDA comparison when available
5. **WASM Integration**: More runtime testing scenarios