# CUDA-Rust-WASM API Documentation

## Table of Contents

1. [Core API](#core-api)
2. [Transpiler API](#transpiler-api)
3. [Runtime API](#runtime-api)
4. [Memory Management](#memory-management)
5. [Kernel Execution](#kernel-execution)
6. [WebGPU Integration](#webgpu-integration)
7. [Error Handling](#error-handling)
8. [Performance Profiling](#performance-profiling)

## Core API

### `transpileCuda(code: string, options?: TranspileOptions): Promise<TranspileResult>`

Transpiles CUDA source code to WebAssembly or WebGPU shader code.

#### Parameters

- `code` (string): The CUDA source code to transpile
- `options` (TranspileOptions): Optional configuration object

#### TranspileOptions

```typescript
interface TranspileOptions {
  target?: 'wasm' | 'webgpu';      // Target platform (default: 'wasm')
  optimize?: boolean;               // Enable optimizations (default: false)
  profile?: boolean;                // Generate profiling data (default: false)
  preserveComments?: boolean;       // Keep comments in output (default: false)
  sourceMaps?: boolean;            // Generate source maps (default: false)
  maxThreadsPerBlock?: number;     // Maximum threads per block (default: 1024)
  sharedMemorySize?: number;       // Shared memory size in bytes (default: 49152)
}
```

#### TranspileResult

```typescript
interface TranspileResult {
  code: string;                    // Transpiled code
  wasmBinary?: Uint8Array;        // Compiled WASM binary
  profile?: ProfileData;          // Profiling information
  sourceMap?: string;             // Source map data
  warnings?: Warning[];           // Transpilation warnings
  metadata?: {
    kernelCount: number;
    sharedMemoryUsage: number;
    registerUsage: number;
    threadConfiguration: ThreadConfig;
  };
}
```

#### Example

```javascript
const result = await transpileCuda(`
  __global__ void vectorAdd(float* a, float* b, float* c, int n) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    if (tid < n) {
      c[tid] = a[tid] + b[tid];
    }
  }
`, {
  target: 'wasm',
  optimize: true,
  profile: true
});

console.log('Transpiled code:', result.code);
console.log('Binary size:', result.wasmBinary.length);
console.log('Parse time:', result.profile.parseTime);
```

### `analyzeKernel(code: string): Promise<KernelAnalysis>`

Analyzes a CUDA kernel for performance characteristics and optimization opportunities.

#### Parameters

- `code` (string): The CUDA kernel source code

#### KernelAnalysis

```typescript
interface KernelAnalysis {
  memoryPattern: 'coalesced' | 'strided' | 'random';
  threadUtilization: number;        // Percentage (0-100)
  sharedMemoryUsage: number;        // Bytes
  registerUsage: number;            // Per thread
  occupancy: number;                // Theoretical occupancy (0-1)
  suggestions: OptimizationSuggestion[];
  bottlenecks: Bottleneck[];
  metrics: {
    arithmeticIntensity: number;
    memoryBandwidth: number;
    computeThroughput: number;
  };
}

interface OptimizationSuggestion {
  type: 'memory' | 'compute' | 'synchronization';
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
  implementation: string;
}
```

#### Example

```javascript
const analysis = await analyzeKernel(`
  __global__ void matrixMultiply(float* A, float* B, float* C, int N) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    
    if (row < N && col < N) {
      float sum = 0.0f;
      for (int k = 0; k < N; k++) {
        sum += A[row * N + k] * B[k * N + col];
      }
      C[row * N + col] = sum;
    }
  }
`);

console.log('Memory pattern:', analysis.memoryPattern);
console.log('Thread utilization:', analysis.threadUtilization + '%');
analysis.suggestions.forEach(s => {
  console.log(`${s.severity}: ${s.description}`);
});
```

## Transpiler API

### `CudaRust` Class

The main transpiler class for converting CUDA to Rust/WebAssembly.

```typescript
class CudaRust {
  constructor(config?: TranspilerConfig);
  
  // Parse CUDA source code
  parse(source: string): Promise<CudaAST>;
  
  // Transpile to target language
  transpile(source: string, target?: Target): Promise<string>;
  
  // Optimize transpiled code
  optimize(code: string, level?: OptimizationLevel): Promise<string>;
  
  // Validate CUDA code
  validate(source: string): Promise<ValidationResult>;
}
```

### `Parser` Class

Low-level CUDA/PTX parser.

```typescript
class Parser {
  // Parse CUDA C++ code
  parseCuda(source: string): CudaAST;
  
  // Parse PTX assembly
  parsePtx(source: string): PtxAST;
  
  // Extract kernels from source
  extractKernels(source: string): KernelDefinition[];
  
  // Get syntax errors
  getErrors(): SyntaxError[];
}
```

## Runtime API

### `Runtime` Class

Manages kernel execution and device resources.

```typescript
class Runtime {
  constructor(backend?: Backend);
  
  // Device management
  getDevice(id?: number): Promise<Device>;
  getDeviceCount(): Promise<number>;
  setDevice(id: number): Promise<void>;
  
  // Kernel compilation
  compileKernel(code: string, name: string): Promise<Kernel>;
  
  // Memory allocation
  allocate(size: number, type?: MemoryType): Promise<DeviceMemory>;
  
  // Stream management
  createStream(): Promise<Stream>;
  synchronize(): Promise<void>;
  
  // Profiling
  startProfiling(): void;
  stopProfiling(): ProfileReport;
}
```

### `Kernel` Class

Represents a compiled GPU kernel.

```typescript
class Kernel {
  // Launch configuration
  setBlockDim(x: number, y?: number, z?: number): void;
  setGridDim(x: number, y?: number, z?: number): void;
  setSharedMemory(bytes: number): void;
  
  // Parameter binding
  setArg(index: number, value: any): void;
  setBuffer(index: number, buffer: DeviceMemory): void;
  setTexture(index: number, texture: Texture): void;
  
  // Execution
  launch(stream?: Stream): Promise<void>;
  launchAsync(stream?: Stream): void;
  
  // Profiling
  getExecutionTime(): Promise<number>;
  getOccupancy(): number;
}
```

## Memory Management

### `DeviceMemory` Class

Manages GPU memory allocations.

```typescript
class DeviceMemory {
  constructor(size: number, type?: MemoryType);
  
  // Data transfer
  copyFrom(data: ArrayBuffer): Promise<void>;
  copyTo(buffer: ArrayBuffer): Promise<void>;
  copyFromAsync(data: ArrayBuffer, stream: Stream): void;
  copyToAsync(buffer: ArrayBuffer, stream: Stream): void;
  
  // Memory operations
  memset(value: number): Promise<void>;
  memcpy(src: DeviceMemory, size?: number): Promise<void>;
  
  // Properties
  size: number;
  type: MemoryType;
  device: Device;
}
```

### `UnifiedMemory` Class

Provides unified memory accessible from both host and device.

```typescript
class UnifiedMemory extends DeviceMemory {
  // Direct access
  getHostPointer(): ArrayBuffer;
  prefetch(device: Device): Promise<void>;
  advise(advice: MemoryAdvice): void;
}
```

### Memory Types

```typescript
enum MemoryType {
  Device = 'device',        // Device-only memory
  Host = 'host',           // Host-only memory
  Unified = 'unified',     // Unified memory
  Pinned = 'pinned',       // Pinned host memory
  Shared = 'shared'        // Shared memory
}

enum MemoryAdvice {
  ReadMostly = 'read_mostly',
  PreferredLocation = 'preferred_location',
  AccessedBy = 'accessed_by'
}
```

## Kernel Execution

### Launch Configuration

```typescript
interface LaunchConfig {
  gridDim: Dim3;
  blockDim: Dim3;
  sharedMemory?: number;
  stream?: Stream;
}

interface Dim3 {
  x: number;
  y?: number;
  z?: number;
}
```

### Execution Example

```javascript
// Compile kernel
const kernel = await runtime.compileKernel(cudaCode, 'vectorAdd');

// Allocate memory
const n = 1024 * 1024;
const size = n * 4; // float32
const d_a = await runtime.allocate(size);
const d_b = await runtime.allocate(size);
const d_c = await runtime.allocate(size);

// Copy input data
await d_a.copyFrom(hostArrayA);
await d_b.copyFrom(hostArrayB);

// Configure kernel
kernel.setBlockDim(256);
kernel.setGridDim(Math.ceil(n / 256));

// Set kernel arguments
kernel.setBuffer(0, d_a);
kernel.setBuffer(1, d_b);
kernel.setBuffer(2, d_c);
kernel.setArg(3, n);

// Launch kernel
await kernel.launch();

// Copy results back
await d_c.copyTo(hostArrayC);
```

## WebGPU Integration

### `WebGPUKernel` Class

Specialized kernel for WebGPU execution.

```typescript
class WebGPUKernel {
  constructor(device: GPUDevice, code: string);
  
  // Buffer management
  createBuffer(size: number, usage?: GPUBufferUsage): GPUBuffer;
  setBuffer(index: number, buffer: GPUBuffer): void;
  
  // Execution
  dispatch(x: number, y?: number, z?: number): Promise<void>;
  
  // Data transfer
  readBuffer(index: number): Promise<ArrayBuffer>;
  writeBuffer(index: number, data: ArrayBuffer): Promise<void>;
  
  // Pipeline state
  setPushConstants(data: ArrayBuffer): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
}
```

### WebGPU Example

```javascript
// Initialize WebGPU
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

// Create kernel
const kernel = await createWebGPUKernel(`
  @group(0) @binding(0) var<storage, read> a: array<f32>;
  @group(0) @binding(1) var<storage, read> b: array<f32>;
  @group(0) @binding(2) var<storage, read_write> c: array<f32>;
  
  @compute @workgroup_size(256)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if (i < arrayLength(&a)) {
      c[i] = a[i] + b[i];
    }
  }
`);

// Create buffers
const size = 1024 * 4;
const bufferA = kernel.createBuffer(size, GPUBufferUsage.STORAGE);
const bufferB = kernel.createBuffer(size, GPUBufferUsage.STORAGE);
const bufferC = kernel.createBuffer(size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);

// Write data
await kernel.writeBuffer(0, dataA);
await kernel.writeBuffer(1, dataB);

// Execute
await kernel.dispatch(1024 / 256);

// Read results
const results = await kernel.readBuffer(2);
```

## Error Handling

### Error Types

```typescript
class CudaRustError extends Error {
  code: ErrorCode;
  location?: SourceLocation;
  suggestions?: string[];
}

enum ErrorCode {
  // Parser errors
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  UNSUPPORTED_FEATURE = 'UNSUPPORTED_FEATURE',
  
  // Runtime errors
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  INVALID_KERNEL = 'INVALID_KERNEL',
  LAUNCH_FAILED = 'LAUNCH_FAILED',
  
  // Transpiler errors
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  UNDEFINED_SYMBOL = 'UNDEFINED_SYMBOL'
}
```

### Error Handling Example

```javascript
try {
  const result = await transpileCuda(cudaCode);
} catch (error) {
  if (error instanceof CudaRustError) {
    console.error(`Error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    
    if (error.location) {
      console.error(`Location: ${error.location.line}:${error.location.column}`);
    }
    
    if (error.suggestions) {
      console.error('Suggestions:');
      error.suggestions.forEach(s => console.error(`  - ${s}`));
    }
  }
}
```

## Performance Profiling

### `Profiler` Class

```typescript
class Profiler {
  // Start/stop profiling
  start(): void;
  stop(): ProfileReport;
  
  // Mark events
  markEvent(name: string): void;
  beginRange(name: string): void;
  endRange(name: string): void;
  
  // Get metrics
  getKernelMetrics(kernel: Kernel): KernelMetrics;
  getMemoryMetrics(): MemoryMetrics;
  getOverallMetrics(): OverallMetrics;
}
```

### Profile Report

```typescript
interface ProfileReport {
  totalTime: number;
  kernelTime: number;
  memoryTime: number;
  events: ProfileEvent[];
  kernels: KernelProfile[];
  memory: MemoryProfile;
}

interface KernelProfile {
  name: string;
  calls: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  occupancy: number;
  throughput: number;
}
```

### Profiling Example

```javascript
// Start profiling
runtime.startProfiling();

// Execute kernels
for (let i = 0; i < 100; i++) {
  profiler.beginRange('iteration');
  
  await kernel1.launch();
  profiler.markEvent('kernel1_complete');
  
  await kernel2.launch();
  profiler.markEvent('kernel2_complete');
  
  profiler.endRange('iteration');
}

// Get report
const report = runtime.stopProfiling();

console.log('Total execution time:', report.totalTime, 'ms');
console.log('Kernel execution time:', report.kernelTime, 'ms');
console.log('Memory transfer time:', report.memoryTime, 'ms');

report.kernels.forEach(k => {
  console.log(`${k.name}: ${k.avgTime.toFixed(3)}ms avg (${k.calls} calls)`);
});
```

## Advanced Features

### Custom Memory Allocators

```typescript
interface MemoryAllocator {
  allocate(size: number): Promise<DeviceMemory>;
  deallocate(memory: DeviceMemory): Promise<void>;
  getUsage(): MemoryUsage;
}

class PoolAllocator implements MemoryAllocator {
  constructor(poolSize: number, blockSize: number);
  // ... implementation
}
```

### Kernel Fusion

```typescript
interface FusionOptions {
  strategy: 'horizontal' | 'vertical' | 'auto';
  maxKernels: number;
  preserveOrder: boolean;
}

async function fuseKernels(
  kernels: Kernel[], 
  options?: FusionOptions
): Promise<Kernel>;
```

### Multi-GPU Support

```typescript
interface MultiGPUConfig {
  devices: number[];
  strategy: 'data_parallel' | 'model_parallel' | 'pipeline';
  syncMode: 'blocking' | 'non_blocking';
}

class MultiGPURuntime extends Runtime {
  constructor(config: MultiGPUConfig);
  
  distributeWork(kernel: Kernel, data: DeviceMemory[]): Promise<void>;
  gather(results: DeviceMemory[]): Promise<DeviceMemory>;
}
```