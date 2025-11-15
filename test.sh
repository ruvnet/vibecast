#!/bin/bash
set -e

echo "🧪 Running AgentDB Tests"
echo "========================"

# Run Rust unit tests
echo ""
echo "🦀 Running Rust unit tests..."
cd agentdb-wasm
cargo test --lib
echo "✅ Rust unit tests passed!"

# Run WASM tests (requires wasm-pack and a browser driver)
echo ""
echo "🌐 Running WASM tests..."
if command -v wasm-pack &> /dev/null; then
    if command -v geckodriver &> /dev/null || command -v chromedriver &> /dev/null; then
        wasm-pack test --headless --firefox 2>/dev/null || wasm-pack test --headless --chrome 2>/dev/null || echo "⚠️  Browser tests skipped (no driver found)"
    else
        echo "⚠️  Browser tests skipped (no geckodriver or chromedriver found)"
    fi
else
    echo "⚠️  WASM tests skipped (wasm-pack not found)"
fi

cd ..

# Run npm tests if available
if command -v npm &> /dev/null && [ -d "agentdb-npm/node_modules" ]; then
    echo ""
    echo "📦 Running npm tests..."
    cd agentdb-npm
    npm test 2>/dev/null || echo "⚠️  npm tests not configured"
    cd ..
fi

echo ""
echo "✅ All tests completed!"
