#!/bin/bash

# CUDA-Rust-WASM Build Script
# Builds the project for WebAssembly target

set -e

echo "🚀 Building CUDA-Rust-WASM for WebAssembly..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required tools
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        echo "Please install $1 and try again"
        exit 1
    fi
}

echo -e "${BLUE}📋 Checking dependencies...${NC}"
check_tool cargo
check_tool wasm-pack
check_tool wasm-opt

# Clean previous builds
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
rm -rf pkg dist target/wasm32-unknown-unknown

# Build for wasm32-unknown-unknown target
echo -e "${BLUE}🔨 Building Rust project for WASM...${NC}"
cargo build --target wasm32-unknown-unknown --release

# Use wasm-pack to generate bindings
echo -e "${BLUE}📦 Generating WASM bindings...${NC}"
wasm-pack build --target web --out-dir pkg --release

# Optimize WASM binary
echo -e "${BLUE}⚡ Optimizing WASM binary...${NC}"
wasm-opt -O3 -o pkg/cuda_rust_wasm_bg_optimized.wasm pkg/cuda_rust_wasm_bg.wasm
mv pkg/cuda_rust_wasm_bg_optimized.wasm pkg/cuda_rust_wasm_bg.wasm

# Create dist directory
mkdir -p dist

# Generate TypeScript definitions
echo -e "${BLUE}📝 Generating TypeScript definitions...${NC}"
cat > dist/index.d.ts << 'EOF'
export interface TranspileOptions {
  target?: 'wasm' | 'webgpu';
  optimize?: boolean;
  profile?: boolean;
}

export interface TranspileResult {
  code: string;
  wasmBinary?: Uint8Array;
  profile?: ProfileData;
}

export interface ProfileData {
  parseTime: number;
  transpileTime: number;
  optimizeTime: number;
  totalTime: number;
}

export interface KernelAnalysis {
  memoryPattern: string;
  threadUtilization: number;
  sharedMemoryUsage: number;
  registerUsage: number;
  suggestions: string[];
}

export interface BenchmarkResult {
  avgTime: number;
  minTime: number;
  maxTime: number;
  throughput: number;
}

export function transpileCuda(code: string, options?: TranspileOptions): Promise<TranspileResult>;
export function analyzeKernel(code: string): Promise<KernelAnalysis>;
export function benchmark(code: string, options?: { iterations?: number }): Promise<BenchmarkResult>;

// WebGPU specific exports
export interface WebGPUKernel {
  dispatch(x: number, y?: number, z?: number): Promise<void>;
  setBuffer(index: number, buffer: GPUBuffer): void;
  readBuffer(index: number): Promise<ArrayBuffer>;
}

export function createWebGPUKernel(code: string): Promise<WebGPUKernel>;
EOF

# Create main entry point
echo -e "${BLUE}📄 Creating main entry point...${NC}"
cat > dist/index.js << 'EOF'
const native = require('../build/Release/cuda_rust_wasm.node');
const wasm = require('../pkg/cuda_rust_wasm.js');

// Promisify native functions
function promisify(fn) {
  return (...args) => new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

const transpileCuda = promisify(native.transpileCuda);
const analyzeKernel = promisify(native.analyzeKernel);

// Benchmark function
async function benchmark(code, options = {}) {
  const iterations = options.iterations || 100;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await transpileCuda(code, { target: 'wasm' });
    const end = performance.now();
    times.push(end - start);
  }
  
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  
  return {
    avgTime: sum / iterations,
    minTime: times[0],
    maxTime: times[times.length - 1],
    throughput: 1000 / (sum / iterations)
  };
}

// WebGPU kernel creation
async function createWebGPUKernel(code) {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser');
  }
  
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  
  const transpiled = await transpileCuda(code, { target: 'webgpu' });
  const shaderModule = device.createShaderModule({ code: transpiled.code });
  
  // Return kernel interface
  return {
    device,
    shaderModule,
    dispatch: async function(x, y = 1, z = 1) {
      // Implementation depends on the specific kernel
      // This is a simplified example
    },
    setBuffer: function(index, buffer) {
      // Buffer binding implementation
    },
    readBuffer: async function(index) {
      // Buffer reading implementation
    }
  };
}

module.exports = {
  transpileCuda,
  analyzeKernel,
  benchmark,
  createWebGPUKernel
};
EOF

# Copy WASM files to dist
echo -e "${BLUE}📋 Copying WASM files...${NC}"
cp pkg/cuda_rust_wasm_bg.wasm dist/
cp pkg/cuda_rust_wasm.js dist/cuda_rust_wasm_wasm.js

# Create package.json for dist
cat > dist/package.json << EOF
{
  "name": "cuda-rust-wasm",
  "version": "0.1.0",
  "main": "index.js",
  "types": "index.d.ts"
}
EOF

# Build size report
echo -e "${GREEN}✅ Build complete!${NC}"
echo -e "${BLUE}📊 Build size report:${NC}"
ls -lh dist/cuda_rust_wasm_bg.wasm | awk '{print "  WASM binary: " $5}'
ls -lh dist/index.js | awk '{print "  JavaScript wrapper: " $5}'

echo -e "${GREEN}🎉 WASM build successful!${NC}"