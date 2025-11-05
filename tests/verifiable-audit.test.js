/**
 * Verifiable Audit Log Tests
 *
 * Validates:
 * - Merkle tree construction
 * - Inclusion proof generation and verification
 * - Consistency proof verification
 * - Signed Tree Head integrity
 * - Full audit trail cryptographic verification
 */

import { VerifiableAuditLog } from '../src/audit/VerifiableAuditLog.js';
import { connectAgentDB } from '../src/db/agentdb.js';
import crypto from 'crypto';

export async function runVerifiableAuditTests() {
  console.log('\n🧪 Testing Verifiable Audit Log - Merkle Tree Cryptography\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const db = connectAgentDB();
  const auditLog = new VerifiableAuditLog({ db });

  // Test 1: Basic Merkle Tree Construction
  try {
    console.log('Test 1: Merkle Tree Construction');

    const entries = [
      { action: 'CREATE', recordId: 'rec1', data: { field: 'value1' } },
      { action: 'UPDATE', recordId: 'rec1', data: { field: 'value2' } },
      { action: 'VALIDATE', recordId: 'rec1', result: 'success' },
      { action: 'ENRICH', recordId: 'rec1', data: { enriched: true } }
    ];

    const leafHashes = [];
    for (const entry of entries) {
      const result = await auditLog.append(entry);
      leafHashes.push(result.leafHash);
    }

    const treeState = auditLog.currentTree;

    if (treeState.leaves.length === 4 && treeState.root && treeState.root.hash) {
      console.log('✓ PASS: Merkle tree constructed correctly');
      console.log(`  Root hash: ${treeState.root.hash.substring(0, 16)}...`);
      console.log(`  Leaves: ${treeState.leaves.length}`);
      results.passed++;
      results.tests.push({ name: 'Merkle Tree Construction', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Merkle tree construction failed');
      results.failed++;
      results.tests.push({ name: 'Merkle Tree Construction', status: 'FAIL', error: 'Invalid tree structure' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Merkle Tree Construction', status: 'FAIL', error: error.message });
  }

  // Test 2: Inclusion Proof Generation and Verification
  try {
    console.log('\nTest 2: Inclusion Proof Verification');

    const entry = { action: 'TEST', recordId: 'rec_test', data: { test: true } };
    const { leafHash, treeRoot, inclusionProof } = await auditLog.append(entry);

    const leafIndex = auditLog.currentTree.leaves.length - 1;

    // Verify the proof
    const verified = auditLog.verifyInclusion(leafHash, leafIndex, inclusionProof, treeRoot);

    if (verified) {
      console.log('✓ PASS: Inclusion proof verified successfully');
      console.log(`  Proof length: ${inclusionProof.length} siblings`);
      console.log(`  Leaf hash: ${leafHash.substring(0, 16)}...`);
      results.passed++;
      results.tests.push({ name: 'Inclusion Proof', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Inclusion proof verification failed');
      results.failed++;
      results.tests.push({ name: 'Inclusion Proof', status: 'FAIL', error: 'Verification failed' });
    }

    // Test tampered proof
    const tamperedProof = [...inclusionProof];
    if (tamperedProof.length > 0) {
      tamperedProof[0] = { ...tamperedProof[0], hash: 'tampered_hash' };
      const shouldFail = auditLog.verifyInclusion(leafHash, leafIndex, tamperedProof, treeRoot);

      if (!shouldFail) {
        console.log('✓ PASS: Tampered proof correctly rejected');
        results.passed++;
        results.tests.push({ name: 'Tamper Detection', status: 'PASS' });
      } else {
        console.log('✗ FAIL: Tampered proof was accepted');
        results.failed++;
        results.tests.push({ name: 'Tamper Detection', status: 'FAIL', error: 'Tamper not detected' });
      }
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Inclusion Proof', status: 'FAIL', error: error.message });
  }

  // Test 3: Signed Tree Head (STH)
  try {
    console.log('\nTest 3: Signed Tree Head Integrity');

    const sth = await auditLog.getSignedTreeHead();

    if (sth.treeRoot && sth.treeSize > 0 && sth.timestamp && sth.signature) {
      console.log('✓ PASS: Signed Tree Head generated');
      console.log(`  Tree size: ${sth.treeSize}`);
      console.log(`  Root: ${sth.treeRoot.substring(0, 16)}...`);
      console.log(`  Signature: ${sth.signature.substring(0, 16)}...`);
      results.passed++;
      results.tests.push({ name: 'Signed Tree Head', status: 'PASS' });

      // Verify signature
      const message = `${sth.treeRoot}|${sth.treeSize}|${sth.timestamp}`;
      const expectedSig = crypto
        .createHmac('sha256', auditLog.config.signingKey)
        .update(message)
        .digest('hex');

      if (sth.signature === expectedSig) {
        console.log('✓ PASS: STH signature verified');
        results.passed++;
        results.tests.push({ name: 'STH Signature', status: 'PASS' });
      } else {
        console.log('✗ FAIL: STH signature mismatch');
        results.failed++;
        results.tests.push({ name: 'STH Signature', status: 'FAIL', error: 'Signature mismatch' });
      }
    } else {
      console.log('✗ FAIL: Incomplete Signed Tree Head');
      results.failed++;
      results.tests.push({ name: 'Signed Tree Head', status: 'FAIL', error: 'Incomplete STH' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Signed Tree Head', status: 'FAIL', error: error.message });
  }

  // Test 4: Consistency Proof
  try {
    console.log('\nTest 4: Consistency Proof Between Tree Versions');

    const oldSTH = await auditLog.getSignedTreeHead();

    // Add more entries
    await auditLog.append({ action: 'NEW_ENTRY_1', data: {} });
    await auditLog.append({ action: 'NEW_ENTRY_2', data: {} });

    const newSTH = await auditLog.getSignedTreeHead();

    const consistencyProof = auditLog.generateConsistencyProof(oldSTH.treeSize, newSTH.treeSize);
    const consistent = auditLog.verifyConsistency(oldSTH.treeRoot, newSTH.treeRoot, consistencyProof);

    if (consistent) {
      console.log('✓ PASS: Consistency proof verified');
      console.log(`  Old size: ${oldSTH.treeSize}, New size: ${newSTH.treeSize}`);
      results.passed++;
      results.tests.push({ name: 'Consistency Proof', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Consistency proof verification failed');
      results.failed++;
      results.tests.push({ name: 'Consistency Proof', status: 'FAIL', error: 'Verification failed' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Consistency Proof', status: 'FAIL', error: error.message });
  }

  // Test 5: Full Audit Trail Verification
  try {
    console.log('\nTest 5: Full Audit Trail Verification');

    // Create a new log with known entries
    const testLog = new VerifiableAuditLog({ db });

    const testEntries = [
      { action: 'AUDIT_TEST_1', data: { value: 1 } },
      { action: 'AUDIT_TEST_2', data: { value: 2 } },
      { action: 'AUDIT_TEST_3', data: { value: 3 } }
    ];

    for (const entry of testEntries) {
      await testLog.append(entry);
    }

    const verification = await testLog.verifyAuditTrail();

    if (verification.verified && verification.entriesVerified === 3) {
      console.log('✓ PASS: Full audit trail verified');
      console.log(`  Entries verified: ${verification.entriesVerified}`);
      console.log(`  Integrity status: ${verification.integrityStatus}`);
      results.passed++;
      results.tests.push({ name: 'Full Audit Verification', status: 'PASS' });
    } else {
      console.log('✗ FAIL: Audit trail verification failed');
      console.log(`  Status: ${verification.integrityStatus}`);
      results.failed++;
      results.tests.push({ name: 'Full Audit Verification', status: 'FAIL', error: verification.integrityStatus });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Full Audit Verification', status: 'FAIL', error: error.message });
  }

  // Test 6: Performance - 1000 Entries
  try {
    console.log('\nTest 6: Performance Test (1000 entries)');

    const perfLog = new VerifiableAuditLog({ db });
    const startTime = Date.now();

    for (let i = 0; i < 1000; i++) {
      await perfLog.append({ action: `PERF_TEST_${i}`, data: { index: i } });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const opsPerSecond = (1000 / duration) * 1000;

    console.log(`✓ PASS: Performance test completed`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Operations/second: ${opsPerSecond.toFixed(0)}`);
    results.passed++;
    results.tests.push({ name: 'Performance Test', status: 'PASS' });
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Performance Test', status: 'FAIL', error: error.message });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Verifiable Audit Log Test Results: ${results.passed} passed, ${results.failed} failed`);
  console.log('='.repeat(60) + '\n');

  return results;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runVerifiableAuditTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}
