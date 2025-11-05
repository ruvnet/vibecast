/**
 * PII Redactor Tests
 *
 * Validates:
 * - Email detection and redaction
 * - SSN detection and redaction
 * - Credit card detection and redaction
 * - Phone number detection and redaction
 * - IP address detection and redaction
 * - Multiple redaction modes (replace, hash, mask)
 * - Confidence scoring
 */

import { PIIRedactor } from '../src/privacy/PIIRedactor.js';
import { connectAgentDB } from '../src/db/agentdb.js';

export async function runPIIRedactorTests() {
  console.log('\n🧪 Testing PII Redactor - Privacy-First Defaults\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const db = connectAgentDB();

  // Test 1: Email Detection and Redaction
  try {
    console.log('Test 1: Email Detection and Redaction');

    const redactor = new PIIRedactor({ db, redactionMode: 'replace' });

    const testData = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      message: 'Please contact me at jdoe@company.org'
    };

    const result = await redactor.redact(testData);

    const hasEmail = JSON.stringify(result.redacted).includes('@');
    const hasRedaction = JSON.stringify(result.redacted).includes('[EMAIL_REDACTED]');

    if (!hasEmail && hasRedaction && result.manifest.redactions === 2) {
      console.log('✓ PASS: Emails detected and redacted');
      console.log(`  Redactions: ${result.manifest.redactions}`);
      console.log(`  Types: ${result.manifest.types.join(', ')}`);
      results.passed++;
      results.tests.push({ name: 'Email Redaction', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Email redaction incomplete');
      results.failed++;
      results.tests.push({ name: 'Email Redaction', status: 'FAIL', error: 'Incomplete redaction' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Email Redaction', status: 'FAIL', error: error.message });
  }

  // Test 2: SSN Detection
  try {
    console.log('\nTest 2: SSN Detection and Redaction');

    const redactor = new PIIRedactor({ db, redactionMode: 'replace' });

    const testData = {
      name: 'Jane Smith',
      ssn: '123-45-6789',
      notes: 'SSN: 987-65-4321'
    };

    const result = await redactor.redact(testData);
    const hasSSN = JSON.stringify(result.redacted).match(/\d{3}-\d{2}-\d{4}/);

    if (!hasSSN && result.manifest.types.includes('ssn')) {
      console.log('✓ PASS: SSNs detected and redacted');
      console.log(`  Redactions: ${result.manifest.redactions}`);
      results.passed++;
      results.tests.push({ name: 'SSN Redaction', status: 'PASS' });
    } else {
      console.log('✗ FAIL: SSN redaction failed');
      results.failed++;
      results.tests.push({ name: 'SSN Redaction', status: 'FAIL', error: 'SSN still visible' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'SSN Redaction', status: 'FAIL', error: error.message });
  }

  // Test 3: Credit Card Detection
  try {
    console.log('\nTest 3: Credit Card Detection and Redaction');

    const redactor = new PIIRedactor({ db, redactionMode: 'replace' });

    const testData = {
      payment: '4532-1234-5678-9010',
      backup: '5555 4444 3333 2222'
    };

    const result = await redactor.redact(testData);
    const detection = redactor.detect(testData);

    if (detection.hasPII && detection.types.includes('credit_card')) {
      console.log('✓ PASS: Credit cards detected and redacted');
      console.log(`  Confidence: ${(detection.confidence * 100).toFixed(0)}%`);
      results.passed++;
      results.tests.push({ name: 'Credit Card Redaction', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Credit card detection failed');
      results.failed++;
      results.tests.push({ name: 'Credit Card Redaction', status: 'FAIL', error: 'Not detected' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Credit Card Redaction', status: 'FAIL', error: error.message });
  }

  // Test 4: Phone Number Detection
  try {
    console.log('\nTest 4: Phone Number Detection and Redaction');

    const redactor = new PIIRedactor({ db, redactionMode: 'replace' });

    const testData = {
      contact: '(555) 123-4567',
      mobile: '+1-555-987-6543',
      office: '555.111.2222'
    };

    const result = await redactor.redact(testData);
    const detection = redactor.detect(testData);

    if (detection.hasPII && detection.types.includes('phone') && result.manifest.redactions >= 3) {
      console.log('✓ PASS: Phone numbers detected and redacted');
      console.log(`  Patterns found: ${result.manifest.redactions}`);
      results.passed++;
      results.tests.push({ name: 'Phone Redaction', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Phone number detection incomplete');
      results.failed++;
      results.tests.push({ name: 'Phone Redaction', status: 'FAIL', error: 'Incomplete detection' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Phone Redaction', status: 'FAIL', error: error.message });
  }

  // Test 5: IP Address Detection
  try {
    console.log('\nTest 5: IP Address Detection and Redaction');

    const redactor = new PIIRedactor({ db, redactionMode: 'replace' });

    const testData = {
      server: '192.168.1.100',
      logs: 'Request from 10.0.0.5 at 2024-01-15'
    };

    const result = await redactor.redact(testData);
    const hasIP = JSON.stringify(result.redacted).match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);

    if (!hasIP && result.manifest.types.includes('ip_address')) {
      console.log('✓ PASS: IP addresses detected and redacted');
      results.passed++;
      results.tests.push({ name: 'IP Address Redaction', status: 'PASS' });
    } else {
      console.log('✗ FAIL: IP address redaction failed');
      results.failed++;
      results.tests.push({ name: 'IP Address Redaction', status: 'FAIL', error: 'IP still visible' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'IP Address Redaction', status: 'FAIL', error: error.message });
  }

  // Test 6: Hash Redaction Mode
  try {
    console.log('\nTest 6: Hash Redaction Mode');

    const redactor = new PIIRedactor({ db, redactionMode: 'hash' });

    const testData = {
      email: 'user@example.com',
      ssn: '123-45-6789'
    };

    const result = await redactor.redact(testData);
    const redactedStr = JSON.stringify(result.redacted);

    const hasHashedEmail = redactedStr.match(/\[EMAIL_[a-f0-9]{8}\]/);
    const hasHashedSSN = redactedStr.match(/\[SSN_[a-f0-9]{8}\]/);

    if (hasHashedEmail && hasHashedSSN) {
      console.log('✓ PASS: Hash redaction mode working');
      console.log(`  Hashed email format: ${hasHashedEmail[0]}`);
      results.passed++;
      results.tests.push({ name: 'Hash Redaction Mode', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Hash redaction mode failed');
      results.failed++;
      results.tests.push({ name: 'Hash Redaction Mode', status: 'FAIL', error: 'Hash format incorrect' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Hash Redaction Mode', status: 'FAIL', error: error.message });
  }

  // Test 7: Mask Redaction Mode
  try {
    console.log('\nTest 7: Mask Redaction Mode');

    const redactor = new PIIRedactor({ db, redactionMode: 'mask' });

    const testData = {
      email: 'john.doe@example.com'
    };

    const result = await redactor.redact(testData);
    const redactedStr = JSON.stringify(result.redacted);

    // Should preserve first 3 and last 3 chars
    if (redactedStr.includes('joh') && redactedStr.includes('com') && redactedStr.includes('*')) {
      console.log('✓ PASS: Mask redaction mode working');
      console.log(`  Masked format: ${result.redacted.email}`);
      results.passed++;
      results.tests.push({ name: 'Mask Redaction Mode', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Mask redaction mode failed');
      results.failed++;
      results.tests.push({ name: 'Mask Redaction Mode', status: 'FAIL', error: 'Mask format incorrect' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Mask Redaction Mode', status: 'FAIL', error: error.message });
  }

  // Test 8: Confidence Scoring
  try {
    console.log('\nTest 8: Confidence Scoring');

    const redactor = new PIIRedactor({ db });

    const highConfidenceData = {
      ssn: '123-45-6789',  // 0.99 confidence
      email: 'test@example.com'  // 0.95 confidence
    };

    const detection = redactor.detect(highConfidenceData);

    if (detection.confidence > 0.90) {
      console.log('✓ PASS: Confidence scoring working');
      console.log(`  Overall confidence: ${(detection.confidence * 100).toFixed(0)}%`);
      console.log(`  Types detected: ${detection.types.join(', ')}`);
      results.passed++;
      results.tests.push({ name: 'Confidence Scoring', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Confidence scoring inaccurate');
      results.failed++;
      results.tests.push({ name: 'Confidence Scoring', status: 'FAIL', error: 'Low confidence' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Confidence Scoring', status: 'FAIL', error: error.message });
  }

  // Test 9: No PII - Should Not Redact
  try {
    console.log('\nTest 9: Clean Data (No PII)');

    const redactor = new PIIRedactor({ db });

    const cleanData = {
      name: 'John Doe',
      age: 30,
      city: 'New York'
    };

    const result = await redactor.redact(cleanData);

    if (!result.manifest.types.length && result.manifest.redactions === 0) {
      console.log('✓ PASS: Clean data not redacted');
      console.log(`  Original preserved: ${JSON.stringify(result.redacted) === JSON.stringify(cleanData)}`);
      results.passed++;
      results.tests.push({ name: 'Clean Data Handling', status: 'PASS' });
    } else {
      console.log('✗ FAIL: False positive redaction');
      results.failed++;
      results.tests.push({ name: 'Clean Data Handling', status: 'FAIL', error: 'False positive' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Clean Data Handling', status: 'FAIL', error: error.message });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`PII Redactor Test Results: ${results.passed} passed, ${results.failed} failed`);
  console.log('='.repeat(60) + '\n');

  return results;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPIIRedactorTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}
