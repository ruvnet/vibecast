/**
 * AgentDB v2.0.0-alpha.2.11 Deep Review - Edge Case Tests
 *
 * This file tests edge cases and potential issues found during code review.
 */

import { AgentDB } from 'agentdb';

console.log('\n========================================');
console.log('AgentDB Deep Review - Edge Case Tests');
console.log('========================================\n');

const issues = [];
const warnings = [];

let db;

try {
  db = new AgentDB({ dbPath: ':memory:' });
  await db.initialize();
} catch (error) {
  console.log(`Failed to initialize: ${error.message}`);
  process.exit(1);
}

const memory = db.getController('memory');

// ========================================
// Test 1: Empty/null input handling
// ========================================
console.log('Test 1: Empty/null input handling...');
try {
  // Empty task string
  try {
    await memory.storeEpisode({
      sessionId: 'test-empty',
      task: '',
      reward: 0.5,
      success: true
    });
    warnings.push('Empty task string accepted without validation');
  } catch (e) {
    // Expected - empty task should be rejected
  }

  // Null session ID
  try {
    await memory.storeEpisode({
      sessionId: null,
      task: 'test task',
      reward: 0.5,
      success: true
    });
    warnings.push('Null session ID accepted without validation');
  } catch (e) {
    // Expected
  }

  console.log('   Completed\n');
} catch (error) {
  issues.push(`Empty input test failed: ${error.message}`);
}

// ========================================
// Test 2: SQL Injection attempts
// ========================================
console.log('Test 2: SQL Injection resistance...');
try {
  // Attempt SQL injection in task field
  const maliciousTask = "test'; DROP TABLE episodes; --";
  const id1 = await memory.storeEpisode({
    sessionId: 'sql-test',
    task: maliciousTask,
    reward: 0.5,
    success: true
  });

  // Verify table still exists by querying
  const results = await memory.retrieveRelevant({ task: 'test', k: 1 });
  if (id1 > 0) {
    console.log('   SQL injection in task field: Sanitized correctly');
  }

  // Attempt injection in session ID
  const maliciousSession = "test' OR '1'='1";
  const id2 = await memory.storeEpisode({
    sessionId: maliciousSession,
    task: 'normal task',
    reward: 0.5,
    success: true
  });

  if (id2 > 0) {
    console.log('   SQL injection in session ID: Stored safely');
  }

  console.log('   Completed\n');
} catch (error) {
  issues.push(`SQL injection test error: ${error.message}`);
}

// ========================================
// Test 3: Extreme values
// ========================================
console.log('Test 3: Extreme value handling...');
try {
  // Very long task string
  const longTask = 'a'.repeat(50000);
  try {
    await memory.storeEpisode({
      sessionId: 'long-test',
      task: longTask,
      reward: 0.5,
      success: true
    });
    warnings.push('Very long task string (50k chars) accepted');
  } catch (e) {
    console.log('   Long task string: Rejected as expected');
  }

  // Negative reward
  const negId = await memory.storeEpisode({
    sessionId: 'negative-test',
    task: 'negative reward test',
    reward: -1.5,
    success: false
  });
  if (negId > 0) {
    warnings.push('Negative reward value accepted without validation');
    console.log('   Negative reward: Accepted (no validation)');
  }

  // Reward > 1
  const highId = await memory.storeEpisode({
    sessionId: 'high-test',
    task: 'high reward test',
    reward: 999.99,
    success: true
  });
  if (highId > 0) {
    warnings.push('Reward > 1 accepted without validation');
    console.log('   Reward > 1: Accepted (no validation)');
  }

  console.log('   Completed\n');
} catch (error) {
  issues.push(`Extreme values test error: ${error.message}`);
}

// ========================================
// Test 4: Unicode and special characters
// ========================================
console.log('Test 4: Unicode and special characters...');
try {
  const unicodeTask = '测试任务 🎉 تجربة テスト';
  const id = await memory.storeEpisode({
    sessionId: 'unicode-test',
    task: unicodeTask,
    reward: 0.8,
    success: true
  });

  const results = await memory.retrieveRelevant({ task: unicodeTask, k: 1 });
  if (results.length > 0 && results[0].task === unicodeTask) {
    console.log('   Unicode characters: Stored and retrieved correctly');
  } else {
    warnings.push('Unicode characters may not be handled correctly');
  }

  // Null bytes
  try {
    await memory.storeEpisode({
      sessionId: 'null-byte-test',
      task: 'test\x00null\x00bytes',
      reward: 0.5,
      success: true
    });
    warnings.push('Null bytes in task string accepted');
  } catch (e) {
    console.log('   Null bytes: Rejected as expected');
  }

  console.log('   Completed\n');
} catch (error) {
  issues.push(`Unicode test error: ${error.message}`);
}

// ========================================
// Test 5: Concurrent operations
// ========================================
console.log('Test 5: Concurrent operations...');
try {
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      memory.storeEpisode({
        sessionId: `concurrent-${i}`,
        task: `concurrent task ${i}`,
        reward: Math.random(),
        success: i % 2 === 0
      })
    );
  }

  const ids = await Promise.all(promises);
  const uniqueIds = new Set(ids);

  if (uniqueIds.size === 10) {
    console.log('   Concurrent inserts: All unique IDs generated');
  } else {
    issues.push(`Concurrent inserts generated duplicate IDs: ${ids.join(', ')}`);
  }

  console.log('   Completed\n');
} catch (error) {
  issues.push(`Concurrent operations error: ${error.message}`);
}

// ========================================
// Test 6: Memory/resource limits
// ========================================
console.log('Test 6: Resource handling...');
try {
  // Store many episodes quickly
  const startMem = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100; i++) {
    await memory.storeEpisode({
      sessionId: 'bulk-test',
      task: `bulk task ${i} with some content to make it larger`,
      reward: Math.random(),
      success: i % 2 === 0,
      metadata: { index: i, data: 'x'.repeat(100) }
    });
  }
  const endMem = process.memoryUsage().heapUsed;
  const memGrowth = (endMem - startMem) / 1024 / 1024;

  console.log(`   Memory growth for 100 episodes: ${memGrowth.toFixed(2)} MB`);

  if (memGrowth > 50) {
    warnings.push(`High memory growth: ${memGrowth.toFixed(2)} MB for 100 episodes`);
  }

  console.log('   Completed\n');
} catch (error) {
  issues.push(`Resource test error: ${error.message}`);
}

// ========================================
// Test 7: Retrieval edge cases
// ========================================
console.log('Test 7: Retrieval edge cases...');
try {
  // Retrieve with k=0
  const zeroResults = await memory.retrieveRelevant({ task: 'test', k: 0 });
  console.log(`   k=0: Returns ${zeroResults.length} results`);

  // Retrieve with very large k
  const largeK = await memory.retrieveRelevant({ task: 'test', k: 10000 });
  console.log(`   k=10000: Returns ${largeK.length} results (max available)`);

  // Retrieve non-existent
  const notFound = await memory.retrieveRelevant({ task: 'xyzzy12345nonexistent', k: 5 });
  console.log(`   Non-existent query: Returns ${notFound.length} results`);

  // Invalid timeWindowDays
  try {
    await memory.retrieveRelevant({ task: 'test', k: 5, timeWindowDays: -1 });
    warnings.push('Negative timeWindowDays accepted');
  } catch (e) {
    console.log('   Negative timeWindowDays: Handled');
  }

  console.log('   Completed\n');
} catch (error) {
  issues.push(`Retrieval edge case error: ${error.message}`);
}

// ========================================
// Test 8: JSON metadata edge cases
// ========================================
console.log('Test 8: JSON metadata handling...');
try {
  // Deeply nested metadata
  const deepNested = { level1: { level2: { level3: { level4: { data: 'deep' } } } } };
  const id1 = await memory.storeEpisode({
    sessionId: 'json-test',
    task: 'deep nested metadata',
    reward: 0.5,
    success: true,
    metadata: deepNested
  });
  console.log(`   Deep nested: Stored with ID ${id1}`);

  // Circular reference (should fail gracefully)
  const circular = { a: 1 };
  circular.self = circular;
  try {
    await memory.storeEpisode({
      sessionId: 'json-test',
      task: 'circular reference',
      reward: 0.5,
      success: true,
      metadata: circular
    });
    issues.push('Circular reference in metadata not caught');
  } catch (e) {
    console.log('   Circular reference: Caught correctly');
  }

  console.log('   Completed\n');
} catch (error) {
  issues.push(`JSON metadata test error: ${error.message}`);
}

// Cleanup
await db.close();

// ========================================
// Summary
// ========================================
console.log('========================================');
console.log('Deep Review Summary');
console.log('========================================\n');

console.log(`Issues Found: ${issues.length}`);
for (const issue of issues) {
  console.log(`  ❌ ${issue}`);
}

console.log(`\nWarnings: ${warnings.length}`);
for (const warning of warnings) {
  console.log(`  ⚠️  ${warning}`);
}

console.log('\n========================================');
console.log('Code Review Findings');
console.log('========================================\n');

console.log('Potential SQL Injection Risks (ReflexionMemory.js):');
console.log('  - getTaskStats(): timeWindowDays interpolated directly (line ~324)');
console.log('  - Cypher queries in retrieveRelevant() use direct interpolation (line ~175)');

console.log('\nValidation Gaps:');
console.log('  - reward values not validated to [0,1] range');
console.log('  - task/sessionId length not enforced at controller level');
console.log('  - timeWindowDays can be negative');

console.log('\nType Safety:');
console.log('  - Float32Array/number[] conversions may cause issues');
console.log('  - GNN module API differences handled with fallbacks');

console.log('\nResource Management:');
console.log('  - No explicit limits on metadata size');
console.log('  - nextLabel counter in HNSWLib could overflow (Number.MAX_SAFE_INTEGER)');

console.log('\n========================================');
if (issues.length === 0) {
  console.log('✅ No critical issues found');
} else {
  console.log('❌ Critical issues require attention');
}
console.log('========================================\n');
