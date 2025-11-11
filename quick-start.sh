#!/bin/bash
# Quick Start Script for Running Real SWE-Bench Comparison
# This script helps you run the benchmark in your local environment

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║   SWE-Bench Agent Framework Benchmark - Quick Start                  ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if API key is set
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "⚠️  OPENROUTER_API_KEY is not set!"
    echo ""
    echo "Please set your API key first:"
    echo "  export OPENROUTER_API_KEY=sk-or-v1-your-key-here"
    echo ""
    echo "Get your key from: https://openrouter.ai/keys"
    echo ""
    exit 1
fi

echo "✅ API key detected: ${OPENROUTER_API_KEY:0:15}..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🎯 Available Models:"
echo "  1. gemini-flash    - Google Gemini 2.0 Flash (FREE, fast)"
echo "  2. gpt4o-mini      - OpenAI GPT-4o Mini (~$0.02)"
echo "  3. deepseek        - DeepSeek Chat (~$0.01)"
echo "  4. kimi            - Kimi K2 (~$0.02)"
echo "  5. claude          - Claude Sonnet 4.5 (~$0.10)"
echo ""

# Get model choice
if [ -z "$1" ]; then
    echo "Usage: ./quick-start.sh <model>"
    echo "Example: ./quick-start.sh gemini-flash"
    echo ""
    echo "💡 Recommended: gemini-flash (free and fast)"
    exit 1
fi

MODEL=$1

echo "🚀 Running SWE-Bench comparison with ${MODEL}..."
echo "⏱️  Expected runtime: 20-30 minutes"
echo ""
echo "This will run 10 tasks with three approaches:"
echo "  🔵 Baseline       - Direct model calls"
echo "  🟢 Agentic Flow   - Iteration + reflection"
echo "  🟣 AgentDB        - Memory + self-learning"
echo ""
echo "Press Ctrl+C to cancel, or wait to start..."
sleep 3
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Run the comparison
node swe-bench-comparison.js $MODEL

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "✅ Benchmark completed!"
echo ""
echo "📊 Results saved to: swe-bench-results-${MODEL}-*.json"
echo "💾 Agent memory saved to: agentdb.json"
echo ""
echo "Next steps:"
echo "  • Review the JSON results file for detailed metrics"
echo "  • Run with a different model to compare"
echo "  • Run again to see AgentDB learning compound over time"
echo ""
