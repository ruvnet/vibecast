#!/bin/bash

echo "=== VibeCast Security Scan Report ==="
echo ""

# Check for hardcoded secrets
echo "1. Checking for hardcoded secrets..."
grep -r -i -E "(password|secret|token|key)" --include="*.go" . 2>/dev/null | grep -v -E "(// |config\.|env\.|getEnv)" | head -5

# Check for SQL injection vulnerabilities
echo ""
echo "2. Checking for potential SQL injection..."
grep -r "fmt.Sprintf.*SELECT\|UPDATE\|DELETE\|INSERT" --include="*.go" . 2>/dev/null | head -5

# Check for insecure random
echo ""
echo "3. Checking for insecure randomness..."
grep -r "math/rand" --include="*.go" . 2>/dev/null | grep -v "crypto/rand" | head -5

# Check dependencies for known vulnerabilities
echo ""
echo "4. Checking dependencies for vulnerabilities..."
go list -m all 2>/dev/null | grep -E "jwt-go|v[0-9]+\.[0-9]+\.[0-9]+" | head -10

# Check for exposed sensitive endpoints
echo ""
echo "5. Checking for exposed sensitive endpoints..."
grep -r -E "/(admin|debug|metrics)" --include="*.go" . 2>/dev/null | grep -v "middleware" | head -5

echo ""
echo "=== End of Security Scan ==="