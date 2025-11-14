#!/bin/bash
# MCP Server Validation Test Script

echo "========================================="
echo "MCP Server Validation Tests"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

echo "========================================="
echo "1. STDIO Transport Tests"
echo "========================================="
echo ""

# Test 1.1: Server Info
echo "Test 1.1: Get server info via STDIO"
OUTPUT=$(echo '/info' | timeout 3 node dist/index.js 2>/dev/null | grep '"type":"info"')
if [[ $OUTPUT =~ "Vibecast MCP Server" ]]; then
    print_result 0 "Server info command"
else
    print_result 1 "Server info command"
fi

# Test 1.2: List Tools
echo "Test 1.2: List tools via STDIO"
OUTPUT=$(echo '/tools' | timeout 3 node dist/index.js 2>/dev/null | grep '"type":"tools"')
if [[ $OUTPUT =~ "calculator" ]] && [[ $OUTPUT =~ "text-analyzer" ]]; then
    print_result 0 "List tools command"
else
    print_result 1 "List tools command"
fi

# Test 1.3: List Resources
echo "Test 1.3: List resources via STDIO"
OUTPUT=$(echo '/resources' | timeout 3 node dist/index.js 2>/dev/null | grep '"type":"resources"')
if [[ $OUTPUT =~ "server-status" ]] && [[ $OUTPUT =~ "server-config" ]]; then
    print_result 0 "List resources command"
else
    print_result 1 "List resources command"
fi

# Test 1.4: Tool Invocation - Calculator
echo "Test 1.4: Invoke calculator tool via STDIO"
REQUEST='{"requestId":"550e8400-e29b-41d4-a716-446655440000","toolId":"calculator","arguments":{"operation":"add","a":10,"b":5},"executionMode":"sync"}'
OUTPUT=$((echo "$REQUEST"; sleep 1) | timeout 3 node dist/index.js 2>&1)
if [[ $OUTPUT =~ '"result":15' ]]; then
    print_result 0 "Calculator tool invocation"
else
    print_result 1 "Calculator tool invocation"
fi

# Test 1.5: Tool Discovery
echo "Test 1.5: Tool discovery at startup"
OUTPUT=$(timeout 3 node dist/index.js </dev/null 2>&1 | head -20)
if [[ $OUTPUT =~ "Discovered 3 tools" ]] && [[ $OUTPUT =~ "Discovered 3 resources" ]]; then
    print_result 0 "Tool and resource discovery"
else
    print_result 1 "Tool and resource discovery"
fi

echo ""
echo "========================================="
echo "2. HTTP/SSE Transport Tests"
echo "========================================="
echo ""

# Start HTTP server in background
echo "Starting HTTP server on port 3001..."
TRANSPORT=http PORT=3001 node dist/index.js >/dev/null 2>&1 &
HTTP_SERVER_PID=$!
sleep 3

# Test 2.1: Health Check
echo "Test 2.1: HTTP health check endpoint"
if command -v curl &> /dev/null; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
    if [ "$STATUS" = "200" ]; then
        print_result 0 "HTTP health check"
    else
        print_result 1 "HTTP health check (status: $STATUS)"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: curl not available"
fi

# Test 2.2: Get Server Info via HTTP
echo "Test 2.2: Get server info via HTTP"
if command -v curl &> /dev/null; then
    OUTPUT=$(curl -s http://localhost:3001/info)
    if [[ $OUTPUT =~ "Vibecast MCP Server" ]]; then
        print_result 0 "HTTP server info"
    else
        print_result 1 "HTTP server info"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: curl not available"
fi

# Test 2.3: List Tools via HTTP
echo "Test 2.3: List tools via HTTP"
if command -v curl &> /dev/null; then
    OUTPUT=$(curl -s http://localhost:3001/tools)
    if [[ $OUTPUT =~ "calculator" ]]; then
        print_result 0 "HTTP list tools"
    else
        print_result 1 "HTTP list tools"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: curl not available"
fi

# Test 2.4: List Resources via HTTP
echo "Test 2.4: List resources via HTTP"
if command -v curl &> /dev/null; then
    OUTPUT=$(curl -s http://localhost:3001/resources)
    if [[ $OUTPUT =~ "server-status" ]]; then
        print_result 0 "HTTP list resources"
    else
        print_result 1 "HTTP list resources"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: curl not available"
fi

# Test 2.5: Invoke Tool via HTTP
echo "Test 2.5: Invoke tool via HTTP POST"
if command -v curl &> /dev/null; then
    OUTPUT=$(curl -s -X POST http://localhost:3001/tools/invoke \
        -H "Content-Type: application/json" \
        -d '{"requestId":"550e8400-e29b-41d4-a716-446655440001","toolId":"calculator","arguments":{"operation":"multiply","a":6,"b":7},"executionMode":"sync"}')
    if [[ $OUTPUT =~ "result".*42 ]] && [[ $OUTPUT =~ '"status"'[[:space:]]*':'[[:space:]]*'"success"' ]]; then
        print_result 0 "HTTP tool invocation"
    else
        print_result 1 "HTTP tool invocation"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: curl not available"
fi

# Test 2.6: Fetch Resource via HTTP POST
echo "Test 2.6: Fetch resource via HTTP POST"
if command -v curl &> /dev/null; then
    OUTPUT=$(curl -s -X POST http://localhost:3001/resources/fetch \
        -H "Content-Type: application/json" \
        -d '{"requestId":"550e8400-e29b-41d4-a716-446655440002","resourceId":"server-status"}')
    if [[ $OUTPUT =~ '"status"'[[:space:]]*':'[[:space:]]*'"success"' ]] && [[ $OUTPUT =~ "online" ]]; then
        print_result 0 "HTTP resource fetch"
    else
        print_result 1 "HTTP resource fetch"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: curl not available"
fi

# Cleanup
echo ""
echo "Stopping HTTP server..."
kill $HTTP_SERVER_PID 2>/dev/null
wait $HTTP_SERVER_PID 2>/dev/null

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "========================================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
