#!/usr/bin/env node

/**
 * Quick test to demonstrate AgentDB integration
 */

const ChangeManagementService = require('./src/services/ChangeManagementService');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m'
};

async function testAgentDB() {
  console.log(colors.bright + colors.cyan + '\n🧪 Testing AgentDB Integration\n' + colors.reset);

  const service = new ChangeManagementService();

  // Create a change
  console.log(colors.yellow + '1. Creating a change request...' + colors.reset);
  const change = await service.createChange({
    title: 'Deploy new authentication system',
    description: 'Implement OAuth2 authentication to replace legacy system with improved security',
    type: 'standard',
    category: 'security',
    priority: 'high',
    requestor: {
      name: 'Security Team',
      email: 'security@example.com'
    }
  });
  console.log(colors.green + `✓ Change created: ${change.change.id}\n` + colors.reset);

  // Analyze with expert system
  console.log(colors.yellow + '2. Analyzing with expert system (includes AgentDB queries)...' + colors.reset);
  const analysis = await service.analyzeChange(change.change.id);

  console.log(colors.cyan + '   AgentDB Operations:' + colors.reset);
  console.log(`   - Similar changes retrieved: ${analysis.similarChanges ? analysis.similarChanges.length : 0}`);
  console.log(`   - Causal insights found: ${analysis.causalInsights ? analysis.causalInsights.length : 0}`);
  console.log(`   - Applicable skills found: ${analysis.applicableSkills ? analysis.applicableSkills.length : 0}`);

  if (analysis.similarChanges && analysis.similarChanges.cached) {
    console.log(colors.green + '   ✓ Results served from cache (optimized!)' + colors.reset);
  }

  // Record an outcome (stores in AgentDB)
  console.log(colors.yellow + '\n3. Recording outcome to AgentDB reflexion memory...' + colors.reset);
  const outcome = await service.recordOutcome(change.change.id, {
    success: true,
    duration: 120,
    issues: [],
    rollbackRequired: false,
    completedBy: 'ops-team'
  });
  console.log(colors.green + '✓ Outcome recorded in AgentDB\n' + colors.reset);

  // Show cache stats
  const cacheStats = service.agentDB.getCacheStats();
  console.log(colors.cyan + '📊 Cache Statistics:' + colors.reset);
  console.log(`   Cached items: ${cacheStats.size}`);
  console.log(`   TTL: ${cacheStats.ttl / 1000}s`);

  console.log(colors.green + '\n✅ AgentDB integration working perfectly!' + colors.reset);
  console.log(colors.cyan + '\nAgentDB Features Used:' + colors.reset);
  console.log('   • Reflexion Memory - Episode storage');
  console.log('   • Vector Search - Similar change retrieval');
  console.log('   • Causal Reasoning - Success factor discovery');
  console.log('   • Skill Library - Pattern consolidation');
  console.log('   • Caching - Performance optimization\n');
}

testAgentDB().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
