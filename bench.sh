#!/bin/bash
set -e

echo "⚡ Running AgentDB Benchmarks"
echo "============================="

# Run Rust benchmarks
echo ""
echo "🦀 Running Rust benchmarks..."
cd agentdb-wasm

if cargo bench --version &> /dev/null; then
    cargo bench
else
    echo "⚠️  cargo bench not available. Install with: cargo install cargo-bench"
fi

cd ..

echo ""
echo "✅ Benchmarks completed!"
echo ""
echo "📊 Results saved to: agentdb-wasm/target/criterion/"
echo ""
echo "To view HTML reports:"
echo "  open agentdb-wasm/target/criterion/report/index.html"
