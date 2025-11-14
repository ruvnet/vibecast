#!/bin/bash
# Test requests for MCP server

echo "Starting MCP Server tests..."
echo ""

# Start the server in the background
npm start &
SERVER_PID=$!

# Wait for server to start
sleep 2

echo "=== Test 1: Get server info ==="
echo "/info" | npm start

echo ""
echo "=== Test 2: List all tools ==="
echo "/tools" | npm start

echo ""
echo "=== Test 3: Calculator - Addition ==="
echo '{"requestId":"550e8400-e29b-41d4-a716-446655440000","toolId":"calculator","arguments":{"operation":"add","a":10,"b":5},"executionMode":"sync"}' | npm start

echo ""
echo "=== Test 4: Text Analyzer ==="
echo '{"requestId":"550e8400-e29b-41d4-a716-446655440001","toolId":"text-analyzer","arguments":{"text":"Hello world! This is a test."},"executionMode":"sync"}' | npm start

echo ""
echo "=== Test 5: UUID Generator ==="
echo '{"requestId":"550e8400-e29b-41d4-a716-446655440002","toolId":"uuid-generator","arguments":{"count":3},"executionMode":"sync"}' | npm start

echo ""
echo "Tests completed!"

# Cleanup
kill $SERVER_PID 2>/dev/null
