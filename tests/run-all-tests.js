#!/usr/bin/env node

/**
 * Test Runner - Vibecast Agentic Platform
 *
 * Runs all test suites and generates a comprehensive report.
 */

import { runRouter2Tests } from './router2.test.js';
import { runVerifiableAuditTests } from './verifiable-audit.test.js';
import { runPIIRedactorTests } from './pii-redactor.test.js';
import { runIntegrationTests } from './integration.test.js';

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 VIBECAST AGENTIC PLATFORM - COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(80));
  console.log('Testing: Router 2.0, Verifiable Audit Log, PII Redactor, Integration\n');

  const allResults = {
    totalPassed: 0,
    totalFailed: 0,
    suites: []
  };

  try {
    // Run Router 2.0 Tests
    console.log('\n📍 Suite 1 of 4: Router 2.0 (Thompson Sampling Contextual Bandit)\n');
    const routerResults = await runRouter2Tests();
    allResults.totalPassed += routerResults.passed;
    allResults.totalFailed += routerResults.failed;
    allResults.suites.push({ name: 'Router 2.0', ...routerResults });

    // Run Verifiable Audit Log Tests
    console.log('\n📍 Suite 2 of 4: Verifiable Audit Log (Merkle Tree Cryptography)\n');
    const auditResults = await runVerifiableAuditTests();
    allResults.totalPassed += auditResults.passed;
    allResults.totalFailed += auditResults.failed;
    allResults.suites.push({ name: 'Verifiable Audit Log', ...auditResults });

    // Run PII Redactor Tests
    console.log('\n📍 Suite 3 of 4: PII Redactor (Privacy-First Defaults)\n');
    const piiResults = await runPIIRedactorTests();
    allResults.totalPassed += piiResults.passed;
    allResults.totalFailed += piiResults.failed;
    allResults.suites.push({ name: 'PII Redactor', ...piiResults });

    // Run Integration Tests
    console.log('\n📍 Suite 4 of 4: Integration Tests (End-to-End Workflows)\n');
    const integrationResults = await runIntegrationTests();
    allResults.totalPassed += integrationResults.passed;
    allResults.totalFailed += integrationResults.failed;
    allResults.suites.push({ name: 'Integration Tests', ...integrationResults });

  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Generate Summary Report
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY REPORT');
  console.log('='.repeat(80) + '\n');

  for (const suite of allResults.suites) {
    const status = suite.failed === 0 ? '✅' : '⚠️';
    console.log(`${status} ${suite.name}`);
    console.log(`   Passed: ${suite.passed}, Failed: ${suite.failed}`);

    if (suite.tests && suite.tests.length > 0) {
      for (const test of suite.tests) {
        const icon = test.status === 'PASS' ? '  ✓' : '  ✗';
        console.log(`${icon} ${test.name}`);
        if (test.error) {
          console.log(`      Error: ${test.error}`);
        }
      }
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log(`TOTAL: ${allResults.totalPassed} passed, ${allResults.totalFailed} failed`);

  if (allResults.totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Platform is validated and ready for deployment.');
  } else {
    console.log(`\n⚠️  ${allResults.totalFailed} test(s) failed. Please review and fix before deployment.`);
  }
  console.log('='.repeat(80) + '\n');

  // Generate JSON report
  const report = {
    timestamp: new Date().toISOString(),
    totalPassed: allResults.totalPassed,
    totalFailed: allResults.totalFailed,
    success: allResults.totalFailed === 0,
    suites: allResults.suites.map(s => ({
      name: s.name,
      passed: s.passed,
      failed: s.failed,
      tests: s.tests
    }))
  };

  // Save report
  const fs = await import('fs');
  fs.writeFileSync('test-results.json', JSON.stringify(report, null, 2));
  console.log('📄 Detailed test report saved to: test-results.json\n');

  // Exit with appropriate code
  process.exit(allResults.totalFailed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
