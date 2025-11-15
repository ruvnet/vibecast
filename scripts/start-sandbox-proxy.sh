#!/bin/bash
# Start Sandbox Localhost Proxy
# Run this inside Claude Code Web sandbox

set -e

echo "════════════════════════════════════════════════════════════════════════════════"
echo "           🚀 Starting Sandbox Localhost Proxy"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Check if we're in a sandbox environment
if [ -z "$CLAUDE_CODE_SESSION_ID" ]; then
  echo "⚠️  Warning: Not in Claude Code Web sandbox"
  echo "   This proxy is designed to run inside the sandbox container"
  echo ""
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install express node-fetch
  echo ""
fi

# Set environment variables
export PROXY_PORT=${PROXY_PORT:-8080}
export ALLOWED_HOSTS=${ALLOWED_HOSTS:-"api.openrouter.ai,api.anthropic.com,api.perplexity.ai,generativelanguage.googleapis.com,api-inference.huggingface.co"}

echo "⚙️  Configuration:"
echo "   Port: $PROXY_PORT"
echo "   Allowed Hosts: $(echo $ALLOWED_HOSTS | tr ',' '\n' | wc -l)"
echo ""

# Start the proxy
echo "🚀 Starting proxy server..."
echo ""

node proxy/sandbox-proxy.js
