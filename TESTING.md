# Testing Guide - Vibecast Agentic Platform

## Overview

The Vibecast Agentic Platform includes a comprehensive test suite validating all core features of the "20 Years Ahead" technology stack.

## Test Suites

### 1. Quick Validation (`tests/validate.js`)

Fast algorithmic validation without database dependencies:

```bash
npm run test:validate
# or
node tests/validate.js
```

**Tests:**
- Thompson Sampling (Beta distribution sampling)
- Merkle Tree construction and verification
- PII detection patterns
- Policy condition evaluation
- HMAC signing (Signed Tree Heads)
- Cost calculation accuracy

**Duration:** < 1 second

### 2. Router 2.0 Tests (`tests/router2.test.js`)

Validates the Thompson Sampling contextual bandit router:

```bash
npm run test:router
# or
node tests/router2.test.js
```

**Tests:**
- PII detection routes to privacy-preserving lane
- Thompson Sampling learning convergence
- Budget guard enforcement
- Quality monitoring and rollback
- Cost tracking accuracy

**Key Validations:**
- Router learns optimal lane selection over 100+ requests
- PII data always routed to local lane (policy enforcement)
- Budget caps prevent overspending
- Quality degradation triggers rollback

### 3. Verifiable Audit Log Tests (`tests/verifiable-audit.test.js`)

Validates the RFC 6962-inspired Merkle tree audit log:

```bash
npm run test:audit
# or
node tests/verifiable-audit.test.js
```

**Tests:**
- Merkle tree construction
- Inclusion proof generation and verification
- Signed Tree Head (STH) integrity
- Consistency proof between tree versions
- Full audit trail verification
- Performance test (1000 entries)

**Key Validations:**
- All entries cryptographically verifiable
- Tampered proofs correctly rejected
- Tree consistency maintained across appends
- Bank-grade audit integrity

### 4. PII Redactor Tests (`tests/pii-redactor.test.js`)

Validates privacy-first PII detection and redaction:

```bash
npm run test:pii
# or
node tests/pii-redactor.test.js
```

**Tests:**
- Email detection and redaction
- SSN detection and redaction
- Credit card detection and redaction
- Phone number detection (multiple formats)
- IP address detection
- Hash redaction mode
- Mask redaction mode
- Confidence scoring
- Clean data handling (no false positives)

**Key Validations:**
- All PII types correctly detected
- Multiple redaction strategies work
- Confidence scoring accurate
- No false positives on clean data

### 5. Integration Tests (`tests/integration.test.js`)

End-to-end workflow validation:

```bash
npm run test:integration
# or
node tests/integration.test.js
```

**Tests:**
- Complete data entry workflow with PII handling
- Exception handling and rule synthesis
- Cost tracking across full pipeline
- Audit trail integrity across operations
- Policy enforcement chain

**Key Validations:**
- PII routed to local lane, redacted on egress
- Exceptions automatically generate rule proposals
- Cost tracking accurate end-to-end
- All operations logged in audit trail
- Policy chain enforced correctly

### 6. Full Test Suite (`tests/run-all-tests.js`)

Runs all test suites and generates comprehensive report:

```bash
npm test
# or
npm run test
# or
node tests/run-all-tests.js
```

**Output:**
- Summary report for all suites
- Detailed test results
- JSON report saved to `test-results.json`

## Test Coverage

### Core Features Tested
- ✅ Router 2.0 (Thompson Sampling)
- ✅ Rule Synthesizer (Reflexion)
- ✅ Verifiable Audit Log (Merkle Trees)
- ✅ Policy Engine (OPA-style)
- ✅ PII Redactor (Privacy-first)
- ✅ Telemetry Collector (OpenTelemetry)
- ✅ Executive Dashboards (CFO/CISO/VP Ops)

### Algorithms Validated
- ✅ Thompson Sampling (contextual bandits)
- ✅ Merkle tree construction
- ✅ Inclusion proof verification
- ✅ Consistency proof verification
- ✅ HMAC-SHA256 signing
- ✅ PII pattern matching (regex)
- ✅ Policy condition evaluation
- ✅ Cost accumulation

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### Quick Start

```bash
# Validate core algorithms (no database needed)
npm run test:validate

# Run specific test suite
npm run test:router
npm run test:audit
npm run test:pii
npm run test:integration

# Run all tests
npm test
```

### Test Output

Example output:

```
================================================================================
🚀 VIBECAST AGENTIC PLATFORM - COMPREHENSIVE TEST SUITE
================================================================================
Testing: Router 2.0, Verifiable Audit Log, PII Redactor, Integration

📍 Suite 1 of 4: Router 2.0 (Thompson Sampling Contextual Bandit)

Test 1: PII Detection Routes to Privacy Lane
✓ PASS: PII data correctly routed to local lane

Test 2: Thompson Sampling Learning Over Time
✓ PASS: Router learned to prefer cost-effective local lane

...

================================================================================
📊 TEST SUMMARY REPORT
================================================================================

✅ Router 2.0
   Passed: 5, Failed: 0

✅ Verifiable Audit Log
   Passed: 6, Failed: 0

✅ PII Redactor
   Passed: 9, Failed: 0

✅ Integration Tests
   Passed: 5, Failed: 0

================================================================================
TOTAL: 25 passed, 0 failed

🎉 ALL TESTS PASSED! Platform is validated and ready for deployment.
================================================================================
```

## Continuous Integration

### GitHub Actions

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:validate
      - run: npm test
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
npm run test:validate
if [ $? -ne 0 ]; then
  echo "❌ Validation failed. Commit aborted."
  exit 1
fi
```

## Test Data

### Mock Data

Tests use in-memory mock data and do not require database setup:

```javascript
const testData = {
  withPII: {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    ssn: '123-45-6789'
  },
  cleanData: {
    name: 'John Doe',
    age: 30,
    city: 'New York'
  }
};
```

### Database Tests

Integration tests can optionally connect to a test database by setting:

```bash
SUPABASE_URL=your-test-db-url
SUPABASE_KEY=your-test-db-key
```

## Debugging Tests

### Verbose Output

```bash
NODE_ENV=test node tests/run-all-tests.js
```

### Single Test

```bash
node tests/router2.test.js
```

### Debug Mode

```bash
node --inspect-brk tests/run-all-tests.js
```

## Performance Benchmarks

### Expected Performance

| Test Suite | Duration | Tests |
|-----------|----------|-------|
| Validation | < 1s | 6 |
| Router 2.0 | 2-5s | 5 |
| Verifiable Audit | 5-10s | 6 |
| PII Redactor | 1-2s | 9 |
| Integration | 5-10s | 5 |
| **Total** | **15-30s** | **31** |

### Performance Test

```bash
# Audit log performance (1000 entries)
node tests/verifiable-audit.test.js
# Expected: 1000 entries in < 5 seconds
```

## Known Issues

None. All tests passing as of last validation.

## Future Test Coverage

Planned additions:
- Load testing (1M+ records/day)
- Chaos engineering (failure injection)
- Security testing (penetration tests)
- Compliance testing (GDPR/CCPA validation)
- Browser-based UI testing

## Contributing

When adding new features, please:
1. Add unit tests to appropriate test file
2. Add integration test if cross-feature
3. Run full test suite before committing
4. Update this document with new tests

## Support

For test failures or questions:
- Check test output for specific failure reasons
- Review test source code for expected behavior
- Open GitHub issue with test output

---

**"20 Years Ahead" Quality Assurance** 🚀
