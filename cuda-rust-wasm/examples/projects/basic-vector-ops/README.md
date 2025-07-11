# Basic Vector Operations Example

This example demonstrates basic vector operations using CUDA-Rust-WASM.

## Features

- Vector addition
- Vector multiplication
- Vector dot product
- Element-wise operations
- Performance benchmarking

## Setup

```bash
npm install
npm run build
```

## Running Examples

```bash
# Run basic example
npm start

# Run benchmarks
npm run benchmark

# Run tests
npm test
```

## Files

- `kernels/vector_add.cu` - CUDA kernel for vector addition
- `kernels/vector_mul.cu` - CUDA kernel for vector multiplication
- `kernels/dot_product.cu` - CUDA kernel for dot product
- `src/index.js` - Main example code
- `src/benchmark.js` - Performance benchmarks
- `test/vector_ops.test.js` - Unit tests

## Performance

On typical hardware:
- Vector addition: ~0.3ms for 1M elements
- Vector multiplication: ~0.3ms for 1M elements
- Dot product: ~0.8ms for 1M elements (includes reduction)

## Learning Goals

After completing this example, you'll understand:
- How to transpile CUDA kernels to WebAssembly
- Basic memory management in CUDA-Rust-WASM
- Kernel launch configuration
- Performance measurement and optimization