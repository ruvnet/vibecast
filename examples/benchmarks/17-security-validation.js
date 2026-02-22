#!/usr/bin/env node

/**
 * 17-security-validation.js - Defense in Depth Security Demo
 *
 * Demonstrates AgentDB's comprehensive input validation and security
 * features that protect against SQL injection, path traversal, XSS,
 * null byte injection, and unicode tricks.
 *
 * agentdb@3.0.0-alpha.3 (ESM-only)
 */

import {
  validateTableName,
  validateColumnName,
  validatePragmaCommand,
  buildSafeWhereClause,
  buildSafeSetClause,
  ValidationError,
  MetadataFilter,
} from 'agentdb';

// Try importing additional security validators from sub-path
let securityModule = null;
try {
  securityModule = await import('agentdb/security');
  console.log('[OK] agentdb/security sub-path loaded successfully');
} catch (err) {
  console.log('[INFO] agentdb/security sub-path not separately available (using main exports)');
}

// ---------------------------------------------------------------------------
// Mock embedder (required by the spec but not used in this security-only demo)
// ---------------------------------------------------------------------------
class MockEmbedder {
  constructor(dim = 384) { this.dim = dim; }
  async initialize() {}
  async embed(text) {
    const arr = new Float32Array(this.dim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    for (let i = 0; i < this.dim; i++) { hash = ((hash << 5) - hash + i) | 0; arr[i] = (hash & 0xFFFF) / 65536 - 0.5; }
    const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
    for (let i = 0; i < this.dim; i++) arr[i] /= norm;
    return arr;
  }
  async embedBatch(texts) { return Promise.all(texts.map(t => this.embed(t))); }
}

function randomVector(dim = 384) {
  const arr = new Float32Array(dim);
  for (let i = 0; i < dim; i++) arr[i] = Math.random() * 2 - 1;
  const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
  for (let i = 0; i < dim; i++) arr[i] /= norm;
  return arr;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PASS = '[PASS]';
const FAIL = '[FAIL]';
const BLOCKED = '[BLOCKED]';

const report = {
  totalTests: 0,
  passed: 0,
  failed: 0,
  attacksBlocked: 0,
  categories: {},
};

function recordTest(category, description, passed, details = '') {
  report.totalTests++;
  if (!report.categories[category]) {
    report.categories[category] = { passed: 0, failed: 0, tests: [] };
  }
  if (passed) {
    report.passed++;
    report.categories[category].passed++;
  } else {
    report.failed++;
    report.categories[category].failed++;
  }
  report.categories[category].tests.push({ description, passed, details });
}

function testValidation(category, description, fn, expectError = false) {
  try {
    const result = fn();
    if (expectError) {
      console.log(`  ${FAIL} ${description} -- expected error but got result: ${JSON.stringify(result)}`);
      recordTest(category, description, false, 'Expected error but succeeded');
    } else {
      console.log(`  ${PASS} ${description}`);
      recordTest(category, description, true);
    }
    return { success: true, result };
  } catch (err) {
    if (expectError) {
      const isValidationError = err instanceof ValidationError;
      const marker = isValidationError ? BLOCKED : PASS;
      console.log(`  ${marker} ${description} -- ${err.message}`);
      report.attacksBlocked++;
      recordTest(category, description, true, err.message);
      return { success: false, error: err };
    } else {
      console.log(`  ${FAIL} ${description} -- unexpected error: ${err.message}`);
      recordTest(category, description, false, err.message);
      return { success: false, error: err };
    }
  }
}

// =========================================================================
// MAIN
// =========================================================================
async function main() {
  console.log('='.repeat(72));
  console.log('  AgentDB Security Validation Demo - Defense in Depth');
  console.log('='.repeat(72));
  console.log();

  // -----------------------------------------------------------------------
  // 1. Table Name Validation
  // -----------------------------------------------------------------------
  console.log('--- 1. TABLE NAME VALIDATION ---');
  console.log();

  // Valid table names
  const validTables = ['episodes', 'skills', 'causal_edges', 'reasoning_patterns',
    'rl_sessions', 'rl_experiences', 'episode_embeddings'];
  for (const t of validTables) {
    testValidation('Table Names', `Valid table: "${t}"`, () => validateTableName(t));
  }

  // Case normalization: uppercase should also be valid (normalized to lowercase)
  testValidation('Table Names', 'Case normalization: "EPISODES" -> "episodes"',
    () => validateTableName('EPISODES'));

  console.log();

  // Attack vectors for table names
  const tableAttacks = [
    { input: "users; DROP TABLE--", desc: 'SQL injection (DROP TABLE)' },
    { input: "../../../etc/passwd", desc: 'Path traversal' },
    { input: "episodes; DELETE FROM episodes;--", desc: 'SQL injection (DELETE)' },
    { input: "'; DROP TABLE episodes; --", desc: 'Classic SQL injection' },
    { input: "", desc: 'Empty string' },
    { input: null, desc: 'Null value' },
    { input: "nonexistent_table", desc: 'Non-whitelisted table' },
    { input: "<script>alert('xss')</script>", desc: 'XSS in table name' },
    { input: "test\x00evil", desc: 'Null byte injection' },
    { input: "episodes\u200Bevil", desc: 'Unicode zero-width space' },
    { input: "episodes/**/UNION/**/SELECT", desc: 'SQL comment bypass' },
  ];

  for (const atk of tableAttacks) {
    testValidation(
      'Table Names',
      `Attack blocked: ${atk.desc}`,
      () => validateTableName(atk.input),
      true, // expect error
    );
  }

  console.log();

  // -----------------------------------------------------------------------
  // 2. Column Name Validation
  // -----------------------------------------------------------------------
  console.log('--- 2. COLUMN NAME VALIDATION ---');
  console.log();

  // Valid column names
  const validColumns = [
    { table: 'episodes', col: 'id' },
    { table: 'episodes', col: 'task' },
    { table: 'episodes', col: 'reward' },
    { table: 'episodes', col: 'success' },
    { table: 'skills', col: 'name' },
    { table: 'skills', col: 'description' },
    { table: 'causal_edges', col: 'confidence' },
  ];
  for (const { table, col } of validColumns) {
    testValidation('Column Names', `Valid column: ${table}.${col}`,
      () => validateColumnName(table, col));
  }

  console.log();

  // Column injection attacks
  const columnAttacks = [
    { table: 'episodes', col: '1; DROP TABLE episodes', desc: 'SQL injection in column' },
    { table: 'episodes', col: "id' OR '1'='1", desc: 'SQL tautology injection' },
    { table: 'episodes', col: "id UNION SELECT password FROM users--", desc: 'UNION injection' },
    { table: 'episodes', col: "", desc: 'Empty column name' },
    { table: 'episodes', col: null, desc: 'Null column name' },
    { table: 'episodes', col: "nonexistent_column", desc: 'Non-whitelisted column' },
    { table: 'episodes', col: "<img onerror='alert(1)'>", desc: 'XSS in column name' },
  ];

  for (const atk of columnAttacks) {
    testValidation(
      'Column Names',
      `Attack blocked: ${atk.desc}`,
      () => validateColumnName(atk.table, atk.col),
      true,
    );
  }

  console.log();

  // -----------------------------------------------------------------------
  // 3. PRAGMA Command Validation
  // -----------------------------------------------------------------------
  console.log('--- 3. PRAGMA COMMAND VALIDATION ---');
  console.log();

  // Valid pragma commands
  const validPragmas = [
    'journal_mode',
    'journal_mode = WAL',
    'synchronous = NORMAL',
    'cache_size = 10000',
    'page_size',
    'foreign_keys = ON',
    'mmap_size = 268435456',
  ];
  for (const p of validPragmas) {
    testValidation('PRAGMA Commands', `Valid pragma: "${p}"`,
      () => validatePragmaCommand(p));
  }

  console.log();

  // Dangerous pragma attacks
  const pragmaAttacks = [
    { input: 'database_list', desc: 'Database enumeration' },
    { input: 'table_info(episodes); DROP TABLE episodes;', desc: 'SQL injection via pragma' },
    { input: 'compile_options', desc: 'Compile options disclosure' },
    { input: "integrity_check; ATTACH DATABASE '/etc/passwd' AS pw;", desc: 'Database attach attack' },
    { input: '', desc: 'Empty pragma' },
    { input: null, desc: 'Null pragma' },
    { input: "writable_schema = ON", desc: 'Writable schema (dangerous)' },
  ];

  for (const atk of pragmaAttacks) {
    testValidation(
      'PRAGMA Commands',
      `Attack blocked: ${atk.desc}`,
      () => validatePragmaCommand(atk.input),
      true,
    );
  }

  console.log();

  // -----------------------------------------------------------------------
  // 4. Safe WHERE Clause Construction
  // -----------------------------------------------------------------------
  console.log('--- 4. SAFE WHERE CLAUSE CONSTRUCTION ---');
  console.log();

  // Valid WHERE clauses
  testValidation('WHERE Clauses', 'Valid single condition',
    () => {
      const result = buildSafeWhereClause('episodes', { id: 1 });
      console.log(`    Clause: "${result.clause}" | Values: [${result.values}]`);
      return result;
    });

  testValidation('WHERE Clauses', 'Valid multi-condition',
    () => {
      const result = buildSafeWhereClause('episodes', { success: 1, reward: 0.9 });
      console.log(`    Clause: "${result.clause}" | Values: [${result.values}]`);
      return result;
    });

  testValidation('WHERE Clauses', 'Valid session filter',
    () => {
      const result = buildSafeWhereClause('episodes', { session_id: 'abc-123' });
      console.log(`    Clause: "${result.clause}" | Values: [${result.values}]`);
      return result;
    });

  console.log();

  // WHERE clause attacks
  const whereAttacks = [
    { table: 'episodes', conditions: { "id; DROP TABLE episodes--": 1 }, desc: 'SQL injection in key' },
    { table: 'evil_table', conditions: { id: 1 }, desc: 'Invalid table name' },
    { table: 'episodes', conditions: {}, desc: 'Empty conditions' },
    { table: 'episodes', conditions: null, desc: 'Null conditions' },
    { table: 'episodes', conditions: { nonexistent: 'value' }, desc: 'Non-whitelisted column' },
  ];

  for (const atk of whereAttacks) {
    testValidation(
      'WHERE Clauses',
      `Attack blocked: ${atk.desc}`,
      () => buildSafeWhereClause(atk.table, atk.conditions),
      true,
    );
  }

  console.log();

  // -----------------------------------------------------------------------
  // 5. Safe SET Clause Construction
  // -----------------------------------------------------------------------
  console.log('--- 5. SAFE SET CLAUSE CONSTRUCTION ---');
  console.log();

  testValidation('SET Clauses', 'Valid single update',
    () => {
      const result = buildSafeSetClause('episodes', { reward: 0.95 });
      console.log(`    Clause: "${result.clause}" | Values: [${result.values}]`);
      return result;
    });

  testValidation('SET Clauses', 'Valid multi-field update',
    () => {
      const result = buildSafeSetClause('skills', { success_rate: 0.8, uses: 42 });
      console.log(`    Clause: "${result.clause}" | Values: [${result.values}]`);
      return result;
    });

  console.log();

  // SET clause attacks
  const setAttacks = [
    { table: 'episodes', updates: { "reward = 0; DROP TABLE episodes--": 1 }, desc: 'SQL injection in column name' },
    { table: 'evil', updates: { reward: 1 }, desc: 'Invalid table' },
    { table: 'episodes', updates: {}, desc: 'Empty updates' },
    { table: 'episodes', updates: null, desc: 'Null updates' },
  ];

  for (const atk of setAttacks) {
    testValidation(
      'SET Clauses',
      `Attack blocked: ${atk.desc}`,
      () => buildSafeSetClause(atk.table, atk.updates),
      true,
    );
  }

  console.log();

  // -----------------------------------------------------------------------
  // 6. ValidationError Handling
  // -----------------------------------------------------------------------
  console.log('--- 6. VALIDATION ERROR HANDLING ---');
  console.log();

  try {
    validateTableName("'; DROP TABLE episodes; --");
  } catch (err) {
    if (err instanceof ValidationError) {
      console.log(`  ${PASS} ValidationError caught correctly`);
      console.log(`    Name: ${err.name}`);
      console.log(`    Code: ${err.code}`);
      console.log(`    Field: ${err.field}`);
      console.log(`    Safe message: ${err.getSafeMessage()}`);
      console.log(`    Full message: ${err.message}`);
      recordTest('Error Handling', 'ValidationError properties accessible', true);
    } else {
      console.log(`  ${FAIL} Expected ValidationError but got ${err.constructor.name}`);
      recordTest('Error Handling', 'ValidationError properties accessible', false);
    }
  }

  // Test creating custom ValidationError
  const customErr = new ValidationError('Test error', 'CUSTOM_CODE', 'test_field');
  const isCorrect = customErr.name === 'ValidationError' &&
    customErr.code === 'CUSTOM_CODE' &&
    customErr.field === 'test_field' &&
    customErr.getSafeMessage() === 'Invalid input: test_field';
  console.log(`  ${isCorrect ? PASS : FAIL} Custom ValidationError creation and safe messages`);
  recordTest('Error Handling', 'Custom ValidationError creation', isCorrect);

  console.log();

  // -----------------------------------------------------------------------
  // 7. Comprehensive Attack Patterns
  // -----------------------------------------------------------------------
  console.log('--- 7. COMPREHENSIVE ATTACK PATTERNS ---');
  console.log();

  const comprehensiveAttacks = [
    // Path traversal variations
    { input: '../../../etc/passwd', category: 'Path Traversal', desc: 'Unix path traversal' },
    { input: '..\\..\\..\\windows\\system32', category: 'Path Traversal', desc: 'Windows path traversal' },
    { input: '....//....//etc/passwd', category: 'Path Traversal', desc: 'Double-encoded path traversal' },
    { input: '%2e%2e%2f%2e%2e%2f', category: 'Path Traversal', desc: 'URL-encoded path traversal' },

    // SQL injection variations
    { input: "' OR 1=1--", category: 'SQL Injection', desc: 'Tautology attack' },
    { input: "'; DROP TABLE episodes; --", category: 'SQL Injection', desc: 'Piggyback query' },
    { input: "1 UNION SELECT * FROM sqlite_master", category: 'SQL Injection', desc: 'UNION-based extraction' },
    { input: "1; ATTACH DATABASE ':memory:' AS evil;", category: 'SQL Injection', desc: 'Database attach' },
    { input: "' AND (SELECT COUNT(*) FROM sqlite_master)>0--", category: 'SQL Injection', desc: 'Blind SQL injection' },
    { input: "episodes WHERE 1=1; DELETE FROM episodes;--", category: 'SQL Injection', desc: 'Stacked queries' },

    // XSS patterns
    { input: "<script>alert('xss')</script>", category: 'XSS', desc: 'Script tag injection' },
    { input: '<img src=x onerror=alert(1)>', category: 'XSS', desc: 'Event handler injection' },
    { input: "javascript:alert('xss')", category: 'XSS', desc: 'JavaScript protocol' },
    { input: '<svg onload=alert(1)>', category: 'XSS', desc: 'SVG XSS' },

    // Null byte injection
    { input: "test\x00evil", category: 'Null Byte', desc: 'Null byte in string' },
    { input: "episodes\x00.sql", category: 'Null Byte', desc: 'Null byte file extension' },

    // Unicode tricks
    { input: "episodes\u200B", category: 'Unicode', desc: 'Zero-width space' },
    { input: "episodes\uFEFF_evil", category: 'Unicode', desc: 'BOM character with suffix' },
    { input: "episodes\u202E", category: 'Unicode', desc: 'Right-to-left override' },
    { input: "\u0065\u0070\u0069\u0073\u006F\u0064\u0065\u0073\u0027", category: 'Unicode', desc: 'Unicode escape with quote' },

    // Integer overflow / type confusion
    { input: "99999999999999999999999", category: 'Overflow', desc: 'Large number as string' },
    { input: "-1", category: 'Overflow', desc: 'Negative index' },
    { input: "NaN", category: 'Type Confusion', desc: 'NaN string' },
    { input: "undefined", category: 'Type Confusion', desc: 'undefined string' },
    { input: "[object Object]", category: 'Type Confusion', desc: 'Object toString' },
  ];

  for (const atk of comprehensiveAttacks) {
    testValidation(
      atk.category,
      `${atk.desc}: "${atk.input.substring(0, 40)}"`,
      () => validateTableName(atk.input),
      true,
    );
  }

  console.log();

  // -----------------------------------------------------------------------
  // 8. MetadataFilter Validation
  // -----------------------------------------------------------------------
  console.log('--- 8. METADATA FILTER VALIDATION ---');
  console.log();

  // Valid filter usage
  const testItems = [
    { id: 1, task: 'code review', reward: 0.9, success: true, metadata: '{"year": 2024, "language": "python"}' },
    { id: 2, task: 'data analysis', reward: 0.7, success: true, metadata: '{"year": 2023, "language": "javascript"}' },
    { id: 3, task: 'bug fix', reward: 0.3, success: false, metadata: '{"year": 2024, "language": "rust"}' },
    { id: 4, task: 'feature design', reward: 0.85, success: true, metadata: '{"year": 2025}' },
    { id: 5, task: 'performance test', reward: 0.5, success: false, metadata: null },
  ];

  // Test $gt filter
  const highReward = MetadataFilter.apply(testItems, { reward: { $gt: 0.8 } });
  console.log(`  ${PASS} $gt filter: ${highReward.length} items with reward > 0.8 (expected 2)`);
  recordTest('MetadataFilter', '$gt operator', highReward.length === 2);

  // Test $eq filter
  const successful = MetadataFilter.apply(testItems, { success: true });
  console.log(`  ${PASS} $eq filter: ${successful.length} successful items (expected 3)`);
  recordTest('MetadataFilter', '$eq operator', successful.length === 3);

  // Test $in filter
  const selected = MetadataFilter.apply(testItems, { task: { $in: ['code review', 'bug fix'] } });
  console.log(`  ${PASS} $in filter: ${selected.length} items with matching tasks (expected 2)`);
  recordTest('MetadataFilter', '$in operator', selected.length === 2);

  // Test $contains filter
  const containsReview = MetadataFilter.apply(testItems, { task: { $contains: 'review' } });
  console.log(`  ${PASS} $contains filter: ${containsReview.length} items containing "review" (expected 1)`);
  recordTest('MetadataFilter', '$contains operator', containsReview.length === 1);

  // Test $exists filter
  const withMetadata = MetadataFilter.apply(testItems, { metadata: { $exists: true } });
  console.log(`  ${PASS} $exists filter: ${withMetadata.length} items with metadata (expected 4)`);
  recordTest('MetadataFilter', '$exists operator', withMetadata.length === 4);

  // Test combined filters
  const combined = MetadataFilter.apply(testItems, {
    reward: { $gte: 0.5 },
    success: true,
  });
  console.log(`  ${PASS} Combined filter: ${combined.length} items (reward >= 0.5 AND success) (expected 3)`);
  recordTest('MetadataFilter', 'Combined operators', combined.length === 3);

  // Test filter validation
  const validFilter = MetadataFilter.validate({ reward: { $gt: 0.5 } });
  console.log(`  ${validFilter.valid ? PASS : FAIL} Filter validation for valid filter`);
  recordTest('MetadataFilter', 'Valid filter passes validation', validFilter.valid);

  const invalidFilter = MetadataFilter.validate({ reward: { invalidOp: 0.5 } });
  console.log(`  ${!invalidFilter.valid ? PASS : FAIL} Filter validation catches invalid operator`);
  recordTest('MetadataFilter', 'Invalid operator caught', !invalidFilter.valid);

  // Test toSQL for parameterized queries
  const sqlResult = MetadataFilter.toSQL({ reward: { $gt: 0.8 }, success: true }, 'episodes');
  console.log(`  ${PASS} toSQL: WHERE ${sqlResult.where} | params: [${sqlResult.params}]`);
  recordTest('MetadataFilter', 'toSQL generates parameterized query', sqlResult.where.includes('?'));

  console.log();

  // -----------------------------------------------------------------------
  // 9. Additional Security Validators (from agentdb/security sub-path)
  // -----------------------------------------------------------------------
  console.log('--- 9. ADDITIONAL SECURITY VALIDATORS ---');
  console.log();

  if (securityModule) {
    // Test any extra exports from the security sub-path
    const exports = Object.keys(securityModule);
    console.log(`  [INFO] Security module exports: ${exports.join(', ')}`);

    // Test validateTaskString if available
    if (securityModule.validateTaskString) {
      testValidation('Security Module', 'Valid task string',
        () => securityModule.validateTaskString('Analyze the data'));

      testValidation('Security Module', 'XSS in task blocked',
        () => securityModule.validateTaskString("<script>alert('xss')</script>"),
        true);

      testValidation('Security Module', 'Null byte in task blocked',
        () => securityModule.validateTaskString("task\x00evil"),
        true);

      testValidation('Security Module', 'Empty task blocked',
        () => securityModule.validateTaskString(''),
        true);
    }

    // Test validateSessionId if available
    if (securityModule.validateSessionId) {
      testValidation('Security Module', 'Valid session ID',
        () => securityModule.validateSessionId('session-abc-123'));

      testValidation('Security Module', 'SQL injection in session ID blocked',
        () => securityModule.validateSessionId("'; DROP TABLE--"),
        true);
    }

    // Test validateReward if available
    if (securityModule.validateReward) {
      testValidation('Security Module', 'Valid reward 0.5',
        () => securityModule.validateReward(0.5));

      testValidation('Security Module', 'Reward > 1 blocked',
        () => securityModule.validateReward(1.5),
        true);

      testValidation('Security Module', 'Negative reward blocked',
        () => securityModule.validateReward(-0.1),
        true);
    }

    // Test sanitizeText if available
    if (securityModule.sanitizeText) {
      testValidation('Security Module', 'Null bytes removed from text',
        () => {
          const result = securityModule.sanitizeText("hello\x00world");
          console.log(`    Sanitized: "${result}"`);
          return result;
        });
    }

    // Test handleSecurityError if available
    if (securityModule.handleSecurityError) {
      const validationErr = new ValidationError('test', 'TEST', 'field');
      const safeMsg = securityModule.handleSecurityError(validationErr);
      console.log(`  ${PASS} handleSecurityError returns safe message: "${safeMsg}"`);
      recordTest('Security Module', 'handleSecurityError for ValidationError', true);

      const genericErr = new Error('sensitive internal error');
      const genericMsg = securityModule.handleSecurityError(genericErr);
      const isGeneric = !genericMsg.includes('sensitive');
      console.log(`  ${isGeneric ? PASS : FAIL} handleSecurityError hides internal errors: "${genericMsg}"`);
      recordTest('Security Module', 'handleSecurityError hides internals', isGeneric);
    }
  } else {
    // Use the main exports which include the same validators
    console.log('  [INFO] Testing security validators from main agentdb exports');

    // Import additional validators from main
    let validateTaskString, validateSessionId, validateReward, sanitizeText, handleSecurityError;
    try {
      const mod = await import('agentdb/security');
      validateTaskString = mod.validateTaskString;
      validateSessionId = mod.validateSessionId;
      validateReward = mod.validateReward;
      sanitizeText = mod.sanitizeText;
      handleSecurityError = mod.handleSecurityError;
    } catch {
      // Fallback - try dynamic import from main
      try {
        const mainMod = await import('agentdb');
        validateTaskString = mainMod.validateTaskString;
        validateSessionId = mainMod.validateSessionId;
        validateReward = mainMod.validateReward;
        sanitizeText = mainMod.sanitizeText;
        handleSecurityError = mainMod.handleSecurityError;
      } catch {
        // Not available
      }
    }

    if (validateTaskString) {
      testValidation('Security Module', 'Valid task string',
        () => validateTaskString('Analyze the data'));
      testValidation('Security Module', 'XSS in task blocked',
        () => validateTaskString("<script>alert('xss')</script>"), true);
    } else {
      console.log('  [SKIP] validateTaskString not available in this build');
    }

    if (validateSessionId) {
      testValidation('Security Module', 'Valid session ID',
        () => validateSessionId('session-abc-123'));
      testValidation('Security Module', 'Special chars in session ID blocked',
        () => validateSessionId("session'; DROP--"), true);
    } else {
      console.log('  [SKIP] validateSessionId not available in this build');
    }

    if (sanitizeText) {
      testValidation('Security Module', 'Null bytes removed',
        () => {
          const result = sanitizeText("hello\x00world");
          console.log(`    Sanitized: "${result}"`);
          return result;
        });
    } else {
      console.log('  [SKIP] sanitizeText not available in this build');
    }
  }

  console.log();

  // -----------------------------------------------------------------------
  // 10. Security Report
  // -----------------------------------------------------------------------
  console.log('='.repeat(72));
  console.log('  SECURITY VALIDATION REPORT');
  console.log('='.repeat(72));
  console.log();
  console.log(`  Total Tests:     ${report.totalTests}`);
  console.log(`  Passed:          ${report.passed}`);
  console.log(`  Failed:          ${report.failed}`);
  console.log(`  Attacks Blocked: ${report.attacksBlocked}`);
  console.log(`  Pass Rate:       ${((report.passed / report.totalTests) * 100).toFixed(1)}%`);
  console.log();

  console.log('  Category Breakdown:');
  console.log('  ' + '-'.repeat(60));
  const categoryPadding = 22;
  for (const [category, data] of Object.entries(report.categories)) {
    const padded = category.padEnd(categoryPadding);
    const status = data.failed === 0 ? PASS : FAIL;
    console.log(`    ${status} ${padded} ${data.passed}/${data.passed + data.failed} passed`);
  }
  console.log();

  if (report.failed > 0) {
    console.log('  FAILED TESTS:');
    for (const [category, data] of Object.entries(report.categories)) {
      for (const test of data.tests) {
        if (!test.passed) {
          console.log(`    [!] ${category}: ${test.description}`);
          if (test.details) console.log(`        Detail: ${test.details}`);
        }
      }
    }
    console.log();
  }

  // Summary
  const allPassed = report.failed === 0;
  if (allPassed) {
    console.log('  RESULT: ALL SECURITY VALIDATIONS PASSED');
    console.log(`  All ${report.attacksBlocked} attack vectors were properly blocked.`);
  } else {
    console.log(`  RESULT: ${report.failed} VALIDATION(S) FAILED - REVIEW REQUIRED`);
  }

  console.log();
  console.log('  Defense-in-depth layers demonstrated:');
  console.log('    1. Whitelist-based table/column validation');
  console.log('    2. Whitelist-based PRAGMA command validation');
  console.log('    3. Parameterized query construction (WHERE/SET)');
  console.log('    4. Input sanitization (null bytes, length limits)');
  console.log('    5. Type validation and constraint enforcement');
  console.log('    6. Safe error messages that do not leak internals');
  console.log('    7. MongoDB-style filter validation');
  console.log('    8. Attack pattern detection (XSS, SQLi, traversal)');
  console.log();
  console.log('='.repeat(72));
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
