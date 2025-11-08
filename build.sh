#!/bin/bash
set -e

echo "🔨 Building AgentDB WASM Module"
echo "================================"

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack not found. Installing..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo not found. Please install from https://rustup.rs/"
    exit 1
fi

# Clean previous builds
echo ""
echo "🧹 Cleaning previous builds..."
rm -rf agentdb-wasm/pkg
rm -rf agentdb-npm/wasm
rm -rf agentdb-npm/dist

# Build WASM module
echo ""
echo "🦀 Building Rust WASM module..."
cd agentdb-wasm

# Build in release mode
wasm-pack build --target bundler --out-dir pkg

echo ""
echo "📦 WASM module built successfully!"
echo "   Output: agentdb-wasm/pkg/"

cd ..

# Copy to npm package
echo ""
echo "📋 Copying WASM to npm package..."
mkdir -p agentdb-npm/wasm
cp -r agentdb-wasm/pkg/* agentdb-npm/wasm/

# Build npm package if Node.js is available
if command -v npm &> /dev/null; then
    echo ""
    echo "📦 Building npm package..."
    cd agentdb-npm

    if [ ! -d "node_modules" ]; then
        echo "📥 Installing dependencies..."
        npm install
    fi

    npm run build:ts

    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "📊 Package info:"
    echo "   - WASM size: $(du -h wasm/agentdb_wasm_bg.wasm | cut -f1)"
    echo "   - TypeScript build: dist/"

    cd ..
else
    echo ""
    echo "⚠️  Node.js not found. Skipping npm build."
fi

echo ""
echo "🎉 All builds completed!"
echo ""
echo "Next steps:"
echo "  1. Run tests: ./test.sh"
echo "  2. Run benchmarks: ./bench.sh"
echo "  3. Try example: cd agentdb-npm && npm run example"
