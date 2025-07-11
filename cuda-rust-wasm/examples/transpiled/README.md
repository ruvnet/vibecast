# Transpiled CUDA Kernels

This directory contains examples of CUDA kernels that have been transpiled to Rust using the cuda2rust transpiler.

## Examples

### 1. Vector Addition (`vector_add.rs`)
- Simple element-wise vector addition
- Demonstrates basic thread indexing translation
- Shows how CUDA's `threadIdx`, `blockIdx`, and `blockDim` map to Rust

### 2. Matrix Multiplication (`matrix_multiply.rs`)
- Basic matrix multiplication kernel
- Optimized tiled version using shared memory
- Demonstrates 2D thread indexing and shared memory usage

### 3. Reduction (`reduction.rs`)
- Sum reduction kernel with tree-based approach
- Optimized version using warp shuffle operations
- Shows shared memory synchronization and warp primitives

### 4. Stencil Computation (`stencil.rs`)
- 5-point and 9-point stencil computations
- Optimized version with shared memory for halo regions
- Demonstrates 2D data access patterns

## Transpilation Process

Each example includes the original CUDA kernel in the documentation comments. The transpilation process:

1. **Thread Indexing**: CUDA built-ins are mapped to Rust equivalents:
   - `threadIdx.x` → `thread::index().x`
   - `blockIdx.x` → `block::index().x`
   - `blockDim.x` → `block::dim().x`
   - `gridDim.x` → `grid::dim().x`

2. **Memory Management**: 
   - Pointer parameters become slice references
   - `__shared__` memory becomes `#[shared]` static arrays
   - Device memory allocation uses `DeviceBuffer`

3. **Synchronization**:
   - `__syncthreads()` → `cuda_rust_wasm::runtime::sync_threads()`
   - Warp primitives map to runtime functions

4. **Kernel Attributes**:
   - `__global__` → `#[kernel]`
   - `__device__` → `#[device_function]`

## Running the Examples

To run the transpiler on your own CUDA code:

```bash
# Transpile a single CUDA file
cargo run --bin cuda2rust -i your_kernel.cu -o output.rs

# With optimization and pattern detection
cargo run --bin cuda2rust -i your_kernel.cu -o output.rs --optimize --detect-patterns

# Read from stdin
echo "__global__ void kernel() {}" | cargo run --bin cuda2rust --stdin
```

## Testing

Each example includes tests that verify the transpiled kernels produce correct results:

```bash
# Run all transpiler tests
cargo test --lib transpiler

# Run tests for a specific example
cargo test --example vector_add
```

## Performance Notes

The transpiled kernels aim to maintain the performance characteristics of the original CUDA code:
- Memory access patterns are preserved
- Shared memory usage is maintained
- Thread cooperation patterns are kept intact
- Warp-level primitives are used where available

## Future Improvements

- Automatic detection and optimization of common patterns
- Support for more complex CUDA features (textures, surfaces)
- WebGPU shader generation for browser deployment
- Performance profiling and optimization hints