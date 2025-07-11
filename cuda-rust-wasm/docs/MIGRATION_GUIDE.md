# CUDA to CUDA-Rust-WASM Migration Guide

## Table of Contents

1. [Overview](#overview)
2. [Quick Migration](#quick-migration)
3. [Syntax Differences](#syntax-differences)
4. [Memory Management](#memory-management)
5. [Kernel Launch](#kernel-launch)
6. [Synchronization](#synchronization)
7. [Advanced Features](#advanced-features)
8. [Performance Considerations](#performance-considerations)
9. [Common Pitfalls](#common-pitfalls)
10. [Migration Examples](#migration-examples)

## Overview

CUDA-Rust-WASM provides a seamless migration path from CUDA to WebAssembly/WebGPU. Most CUDA code can be transpiled automatically, but understanding the differences helps optimize performance.

### Key Benefits of Migration

- **Cross-platform**: Run on any device with WebAssembly support
- **Memory safety**: Rust's ownership system prevents common errors
- **Browser deployment**: Execute GPU code directly in web browsers
- **No driver dependencies**: Works without CUDA toolkit installation

## Quick Migration

### 1. Install CUDA-Rust-WASM

```bash
npm install -g cuda-rust-wasm
```

### 2. Transpile Your CUDA Code

```bash
# Single file
npx cuda-rust-wasm transpile my_kernel.cu -o my_kernel.wasm

# Multiple files
npx cuda-rust-wasm transpile src/*.cu -o dist/
```

### 3. Update Your Host Code

**Before (CUDA):**
```cpp
// Allocate memory
float *d_a, *d_b, *d_c;
cudaMalloc(&d_a, size);
cudaMalloc(&d_b, size);
cudaMalloc(&d_c, size);

// Copy data
cudaMemcpy(d_a, h_a, size, cudaMemcpyHostToDevice);
cudaMemcpy(d_b, h_b, size, cudaMemcpyHostToDevice);

// Launch kernel
vectorAdd<<<gridSize, blockSize>>>(d_a, d_b, d_c, n);

// Copy results
cudaMemcpy(h_c, d_c, size, cudaMemcpyDeviceToHost);
```

**After (CUDA-Rust-WASM):**
```javascript
// Initialize runtime
const runtime = new CudaRustRuntime();

// Allocate memory
const d_a = await runtime.allocate(size);
const d_b = await runtime.allocate(size);
const d_c = await runtime.allocate(size);

// Copy data
await d_a.copyFrom(h_a);
await d_b.copyFrom(h_b);

// Launch kernel
const kernel = await runtime.compileKernel(wasmCode, 'vectorAdd');
kernel.setGridDim(gridSize);
kernel.setBlockDim(blockSize);
kernel.setBuffer(0, d_a);
kernel.setBuffer(1, d_b);
kernel.setBuffer(2, d_c);
kernel.setArg(3, n);
await kernel.launch();

// Copy results
await d_c.copyTo(h_c);
```

## Syntax Differences

### Supported CUDA Features

✅ **Fully Supported:**
- Kernel functions (`__global__`)
- Device functions (`__device__`)
- Thread indexing (`threadIdx`, `blockIdx`, `blockDim`, `gridDim`)
- Basic types (`int`, `float`, `double`, arrays)
- Math functions (`sin`, `cos`, `exp`, `log`, etc.)
- Shared memory (`__shared__`)
- Synchronization (`__syncthreads()`)
- Atomic operations (`atomicAdd`, `atomicCAS`, etc.)

⚠️ **Partially Supported:**
- Dynamic shared memory (requires size specification)
- Texture memory (converted to buffer access)
- Warp-level primitives (emulated)
- CUDA streams (async by default)

❌ **Not Yet Supported:**
- Dynamic parallelism
- Cooperative groups
- Graph APIs
- Unified memory (use explicit transfers)

### Type Mappings

| CUDA Type | CUDA-Rust-WASM Type | Notes |
|-----------|-------------------|--------|
| `int` | `i32` | 32-bit signed integer |
| `unsigned int` | `u32` | 32-bit unsigned integer |
| `float` | `f32` | 32-bit float |
| `double` | `f64` | 64-bit float (check WebGPU support) |
| `char` | `i8` | 8-bit signed integer |
| `short` | `i16` | 16-bit signed integer |
| `long long` | `i64` | 64-bit integer |
| `float2` | `vec2<f32>` | 2D vector |
| `float3` | `vec3<f32>` | 3D vector |
| `float4` | `vec4<f32>` | 4D vector |

### Built-in Variables

| CUDA Variable | CUDA-Rust-WASM Equivalent |
|--------------|-------------------------|
| `threadIdx.x/y/z` | `local_invocation_id.x/y/z` |
| `blockIdx.x/y/z` | `workgroup_id.x/y/z` |
| `blockDim.x/y/z` | `workgroup_size.x/y/z` |
| `gridDim.x/y/z` | `num_workgroups.x/y/z` |

## Memory Management

### Global Memory

**CUDA:**
```cuda
__global__ void kernel(float* data) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    data[idx] = data[idx] * 2.0f;
}
```

**CUDA-Rust-WASM:**
```rust
#[kernel]
fn kernel(data: &mut [f32]) {
    let idx = workgroup_id.x * workgroup_size.x + local_invocation_id.x;
    data[idx] = data[idx] * 2.0;
}
```

### Shared Memory

**CUDA:**
```cuda
__global__ void kernel(float* input, float* output) {
    __shared__ float tile[256];
    int tid = threadIdx.x;
    int gid = blockIdx.x * blockDim.x + threadIdx.x;
    
    tile[tid] = input[gid];
    __syncthreads();
    
    // Process tile
    output[gid] = tile[tid] * 2.0f;
}
```

**CUDA-Rust-WASM:**
```rust
#[kernel]
fn kernel(input: &[f32], output: &mut [f32]) {
    #[shared]
    let mut tile: [f32; 256];
    
    let tid = local_invocation_id.x;
    let gid = workgroup_id.x * workgroup_size.x + local_invocation_id.x;
    
    tile[tid] = input[gid];
    barrier();
    
    // Process tile
    output[gid] = tile[tid] * 2.0;
}
```

### Dynamic Shared Memory

**CUDA:**
```cuda
extern __shared__ float shared_data[];

__global__ void kernel(float* data, int shared_size) {
    // Use shared_data with dynamic size
}
```

**CUDA-Rust-WASM:**
```javascript
// Specify shared memory size when launching
kernel.setSharedMemory(sharedSize);
```

## Kernel Launch

### Basic Launch

**CUDA:**
```cpp
dim3 block(256);
dim3 grid((n + 255) / 256);
myKernel<<<grid, block>>>(args...);
```

**CUDA-Rust-WASM:**
```javascript
kernel.setBlockDim(256);
kernel.setGridDim(Math.ceil(n / 256));
await kernel.launch();
```

### 2D/3D Launch

**CUDA:**
```cpp
dim3 block(16, 16);
dim3 grid(width/16, height/16);
matrixKernel<<<grid, block>>>(args...);
```

**CUDA-Rust-WASM:**
```javascript
kernel.setBlockDim(16, 16);
kernel.setGridDim(width/16, height/16);
await kernel.launch();
```

## Synchronization

### Device Synchronization

**CUDA:**
```cpp
cudaDeviceSynchronize();
```

**CUDA-Rust-WASM:**
```javascript
await runtime.synchronize();
```

### Stream Synchronization

**CUDA:**
```cpp
cudaStream_t stream;
cudaStreamCreate(&stream);
kernel<<<grid, block, 0, stream>>>(args);
cudaStreamSynchronize(stream);
```

**CUDA-Rust-WASM:**
```javascript
const stream = await runtime.createStream();
kernel.launchAsync(stream);
await stream.synchronize();
```

### Thread Synchronization

**CUDA:**
```cuda
__syncthreads();
__threadfence();
__threadfence_block();
```

**CUDA-Rust-WASM:**
```rust
barrier();           // __syncthreads()
memory_barrier();    // __threadfence()
workgroup_barrier(); // __threadfence_block()
```

## Advanced Features

### Atomic Operations

**CUDA:**
```cuda
atomicAdd(&counter[idx], 1);
int old = atomicCAS(&flag[idx], 0, 1);
```

**CUDA-Rust-WASM:**
```rust
atomic_add(&counter[idx], 1);
let old = atomic_compare_exchange(&flag[idx], 0, 1);
```

### Warp Operations

**CUDA:**
```cuda
int sum = __shfl_down_sync(0xffffffff, value, 1);
if (__any_sync(0xffffffff, condition)) { ... }
```

**CUDA-Rust-WASM (Emulated):**
```rust
let sum = subgroup_shuffle_down(value, 1);
if subgroup_any(condition) { ... }
```

### Math Functions

All standard CUDA math functions are supported:

```rust
let result = sin(angle);
let power = pow(base, exponent);
let root = sqrt(value);
let minimum = min(a, b);
```

## Performance Considerations

### Memory Coalescing

- Same principles apply as CUDA
- Ensure consecutive threads access consecutive memory
- Use structure-of-arrays (SoA) instead of array-of-structures (AoS)

### Occupancy

- WebGPU has different limits than CUDA
- Maximum workgroup size: typically 256-1024
- Shared memory: usually 16-32KB
- Check device limits at runtime

### Optimization Tips

1. **Minimize host-device transfers**
   ```javascript
   // Bad: Multiple small transfers
   for (let i = 0; i < n; i++) {
     await buffer.copyFrom(data[i]);
   }
   
   // Good: Single large transfer
   await buffer.copyFrom(data);
   ```

2. **Use async operations**
   ```javascript
   // Launch multiple kernels
   const promises = kernels.map(k => k.launch());
   await Promise.all(promises);
   ```

3. **Reuse compiled kernels**
   ```javascript
   // Compile once
   const kernel = await runtime.compileKernel(code, 'myKernel');
   
   // Launch many times
   for (let i = 0; i < iterations; i++) {
     await kernel.launch();
   }
   ```

## Common Pitfalls

### 1. Index Calculation

**Issue:** Different thread indexing
```cuda
// CUDA
int idx = blockIdx.x * blockDim.x + threadIdx.x;
```

```rust
// CUDA-Rust-WASM
let idx = workgroup_id.x * workgroup_size.x + local_invocation_id.x;
```

### 2. Memory Alignment

**Issue:** WebGPU requires stricter alignment
```javascript
// Ensure 16-byte alignment for uniform buffers
const alignedSize = Math.ceil(size / 16) * 16;
```

### 3. Float64 Support

**Issue:** Not all WebGPU implementations support double precision
```javascript
// Check support
if (!device.features.has('float64')) {
  console.warn('Double precision not supported');
}
```

### 4. Shared Memory Size

**Issue:** Limited shared memory on some devices
```javascript
// Query limits
const limits = device.limits;
const maxSharedMemory = limits.maxComputeWorkgroupStorageSize;
```

## Migration Examples

### Example 1: Vector Addition

**Original CUDA:**
```cuda
__global__ void vectorAdd(float* a, float* b, float* c, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) {
        c[i] = a[i] + b[i];
    }
}
```

**Migrated to CUDA-Rust-WASM:**
```rust
#[kernel]
fn vector_add(a: &[f32], b: &[f32], c: &mut [f32], n: u32) {
    let i = workgroup_id.x * workgroup_size.x + local_invocation_id.x;
    if i < n {
        c[i] = a[i] + b[i];
    }
}
```

### Example 2: Matrix Multiplication

**Original CUDA:**
```cuda
__global__ void matrixMul(float* A, float* B, float* C, int N) {
    __shared__ float As[TILE_SIZE][TILE_SIZE];
    __shared__ float Bs[TILE_SIZE][TILE_SIZE];
    
    int bx = blockIdx.x, by = blockIdx.y;
    int tx = threadIdx.x, ty = threadIdx.y;
    int row = by * TILE_SIZE + ty;
    int col = bx * TILE_SIZE + tx;
    
    float sum = 0.0f;
    
    for (int m = 0; m < N/TILE_SIZE; ++m) {
        As[ty][tx] = A[row * N + m * TILE_SIZE + tx];
        Bs[ty][tx] = B[(m * TILE_SIZE + ty) * N + col];
        __syncthreads();
        
        for (int k = 0; k < TILE_SIZE; ++k) {
            sum += As[ty][k] * Bs[k][tx];
        }
        __syncthreads();
    }
    
    C[row * N + col] = sum;
}
```

**Migrated to CUDA-Rust-WASM:**
```rust
const TILE_SIZE: u32 = 16;

#[kernel]
fn matrix_mul(a: &[f32], b: &[f32], c: &mut [f32], n: u32) {
    #[shared]
    let mut a_tile: [[f32; TILE_SIZE]; TILE_SIZE];
    #[shared]
    let mut b_tile: [[f32; TILE_SIZE]; TILE_SIZE];
    
    let bx = workgroup_id.x;
    let by = workgroup_id.y;
    let tx = local_invocation_id.x;
    let ty = local_invocation_id.y;
    let row = by * TILE_SIZE + ty;
    let col = bx * TILE_SIZE + tx;
    
    let mut sum = 0.0;
    
    for m in 0..(n / TILE_SIZE) {
        a_tile[ty][tx] = a[row * n + m * TILE_SIZE + tx];
        b_tile[ty][tx] = b[(m * TILE_SIZE + ty) * n + col];
        barrier();
        
        for k in 0..TILE_SIZE {
            sum += a_tile[ty][k] * b_tile[k][tx];
        }
        barrier();
    }
    
    c[row * n + col] = sum;
}
```

### Example 3: Reduction

**Original CUDA:**
```cuda
__global__ void reduce(float* g_data, float* g_out, int n) {
    extern __shared__ float sdata[];
    
    unsigned int tid = threadIdx.x;
    unsigned int i = blockIdx.x * blockDim.x + threadIdx.x;
    
    sdata[tid] = (i < n) ? g_data[i] : 0;
    __syncthreads();
    
    for (unsigned int s = blockDim.x/2; s > 0; s >>= 1) {
        if (tid < s) {
            sdata[tid] += sdata[tid + s];
        }
        __syncthreads();
    }
    
    if (tid == 0) g_out[blockIdx.x] = sdata[0];
}
```

**Migrated to CUDA-Rust-WASM:**
```rust
#[kernel]
fn reduce(g_data: &[f32], g_out: &mut [f32], n: u32) {
    #[shared]
    let mut sdata: [f32; 256]; // Specify size
    
    let tid = local_invocation_id.x;
    let i = workgroup_id.x * workgroup_size.x + local_invocation_id.x;
    
    sdata[tid] = if i < n { g_data[i] } else { 0.0 };
    barrier();
    
    let mut s = workgroup_size.x / 2;
    while s > 0 {
        if tid < s {
            sdata[tid] += sdata[tid + s];
        }
        barrier();
        s >>= 1;
    }
    
    if tid == 0 {
        g_out[workgroup_id.x] = sdata[0];
    }
}
```

## Best Practices

1. **Start with simple kernels** and gradually migrate complex ones
2. **Profile both versions** to ensure performance is maintained
3. **Use the analyzer** to identify optimization opportunities
4. **Test on multiple platforms** (different browsers, devices)
5. **Keep original CUDA code** for reference and fallback

## Resources

- [Full API Documentation](./API.md)
- [Performance Tuning Guide](./PERFORMANCE.md)
- [WebGPU Compatibility](./WEBGPU.md)
- [Example Projects](../examples/projects/)
- [Community Forum](https://forum.vibecast.io)