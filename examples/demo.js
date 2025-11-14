#!/usr/bin/env node

/**
 * Demonstration script for Change Management Expert System
 * Shows end-to-end workflow with sample change requests
 */

const ChangeManagementService = require('../src/services/ChangeManagementService');
const sampleChanges = require('./sample-changes');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

function logSection(title) {
  console.log('\n' + colors.bright + colors.magenta + '═'.repeat(80) + colors.reset);
  console.log(colors.bright + colors.magenta + '  ' + title + colors.reset);
  console.log(colors.magenta + '═'.repeat(80) + colors.reset + '\n');
}

async function pause(ms = 2000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  const service = new ChangeManagementService();

  logSection('CHANGE MANAGEMENT EXPERT SYSTEM - DEMONSTRATION');

  log('This demonstration will showcase the expert system analyzing different types of changes:', colors.cyan);
  log('  1. Low-risk database index creation (Standard Change)');
  log('  2. High-risk production migration (Major Change)');
  log('  3. Critical security patch (Emergency Change)');
  log('  4. Application feature release (Standard Change)');
  log('  5. Network infrastructure upgrade (Major Change)\n');

  await pause(3000);

  // Demo 1: Low-risk change
  logSection('DEMO 1: LOW-RISK DATABASE INDEX CREATION');

  log('Creating change request...', colors.cyan);
  const result1 = await service.createChange(sampleChanges.databaseIndexCreation);
  log(`✓ Change created: ${result1.change.id}`, colors.green);

  await pause(1000);

  log('\nAnalyzing change with expert system...', colors.cyan);
  const analysis1 = await service.analyzeChange(result1.change.id);

  log(`\n📊 Risk Assessment:`, colors.yellow);
  log(`  Overall Risk: ${analysis1.analysis.riskScore.rating.toUpperCase()} (${analysis1.analysis.riskScore.overall})`);
  log(`  Technical: ${analysis1.analysis.riskScore.technical}, Business: ${analysis1.analysis.riskScore.business}, Security: ${analysis1.analysis.riskScore.security}`);

  log(`\n✓ Approval Path:`, colors.green);
  log(`  Approvers: ${analysis1.analysis.approvalPath.approvers.join(' → ')}`);
  log(`  SLA: ${analysis1.analysis.approvalPath.sla} hours`);
  log(`  CAB Required: ${analysis1.analysis.approvalPath.cabRequired ? 'Yes' : 'No'}`);

  await pause(1000);

  log('\nGetting expert recommendation...', colors.cyan);
  const recommendation1 = await service.getRecommendation(result1.change.id);
  log(`\n📝 Recommendation: ${recommendation1.decision.recommendation.toUpperCase()}`, colors.green);
  log(`   Confidence: ${(recommendation1.decision.confidence * 100).toFixed(0)}%`);
  log(`   Reason: ${recommendation1.decision.reasons[0]}`);

  await pause(3000);

  // Demo 2: High-risk change
  logSection('DEMO 2: HIGH-RISK PRODUCTION MIGRATION');

  log('Creating change request...', colors.cyan);
  const result2 = await service.createChange(sampleChanges.productionMigration);
  log(`✓ Change created: ${result2.change.id}`, colors.green);

  await pause(1000);

  log('\nAnalyzing change with expert system...', colors.cyan);
  const analysis2 = await service.analyzeChange(result2.change.id);

  log(`\n📊 Risk Assessment:`, colors.red);
  log(`  Overall Risk: ${analysis2.analysis.riskScore.rating.toUpperCase()} (${analysis2.analysis.riskScore.overall})`);
  log(`  Technical: ${analysis2.analysis.riskScore.technical}, Business: ${analysis2.analysis.riskScore.business}, Security: ${analysis2.analysis.riskScore.security}`);

  log(`\n⚠️  Applied Rules:`, colors.yellow);
  analysis2.analysis.appliedRules.slice(0, 3).forEach(rule => {
    log(`  • ${rule.ruleName}: ${rule.result}`);
  });

  log(`\n✓ Approval Path:`, colors.yellow);
  log(`  Approvers: ${analysis2.analysis.approvalPath.approvers.join(' → ')}`);
  log(`  SLA: ${analysis2.analysis.approvalPath.sla} hours`);
  log(`  CAB Required: ${analysis2.analysis.approvalPath.cabRequired ? 'Yes' : 'No'}`);

  await pause(1000);

  log('\nGetting expert recommendation...', colors.cyan);
  const recommendation2 = await service.getRecommendation(result2.change.id);
  log(`\n📝 Recommendation: ${recommendation2.decision.recommendation.toUpperCase()}`, colors.yellow);
  log(`   Confidence: ${(recommendation2.decision.confidence * 100).toFixed(0)}%`);
  log(`   Reason: ${recommendation2.decision.reasons[0]}`);

  if (recommendation2.decision.nextSteps && recommendation2.decision.nextSteps.length > 0) {
    log(`\n   Next Steps:`, colors.cyan);
    recommendation2.decision.nextSteps.forEach(step => {
      log(`     • ${step}`);
    });
  }

  await pause(3000);

  // Demo 3: Emergency security patch
  logSection('DEMO 3: CRITICAL SECURITY PATCH (EMERGENCY)');

  log('Creating emergency change request...', colors.cyan);
  const result3 = await service.createChange(sampleChanges.securityPatch);
  log(`✓ Change created: ${result3.change.id}`, colors.green);

  await pause(1000);

  log('\nAnalyzing change with expert system...', colors.cyan);
  const analysis3 = await service.analyzeChange(result3.change.id);

  log(`\n📊 Risk Assessment:`, colors.red);
  log(`  Overall Risk: ${analysis3.analysis.riskScore.rating.toUpperCase()} (${analysis3.analysis.riskScore.overall})`, colors.red);
  log(`  Security Risk: ${analysis3.analysis.riskScore.security} - CRITICAL`, colors.red);

  log(`\n🚨 Applied Rules:`, colors.red);
  analysis3.analysis.appliedRules.forEach(rule => {
    log(`  • ${rule.ruleName}: ${rule.result}`);
  });

  log(`\n✓ Approval Path (Emergency):`, colors.yellow);
  log(`  Approvers: ${analysis3.analysis.approvalPath.approvers.join(' → ')}`);
  log(`  SLA: ${analysis3.analysis.approvalPath.sla} hours (EXPEDITED)`);
  log(`  Post-Implementation Review Required: ${analysis3.analysis.approvalPath.postImplementationReview ? 'Yes' : 'No'}`);

  await pause(1000);

  log('\nGetting expert recommendation...', colors.cyan);
  const recommendation3 = await service.getRecommendation(result3.change.id);
  log(`\n📝 Recommendation: ${recommendation3.decision.recommendation.toUpperCase()}`, colors.red);
  log(`   Confidence: ${(recommendation3.decision.confidence * 100).toFixed(0)}%`);
  log(`   Reason: ${recommendation3.decision.reasons[0]}`);

  await pause(3000);

  // Demo 4: Feature release
  logSection('DEMO 4: APPLICATION FEATURE RELEASE');

  log('Creating change request...', colors.cyan);
  const result4 = await service.createChange(sampleChanges.featureRelease);
  log(`✓ Change created: ${result4.change.id}`, colors.green);

  await pause(1000);

  log('\nAnalyzing change with expert system...', colors.cyan);
  const analysis4 = await service.analyzeChange(result4.change.id);

  log(`\n📊 Risk Assessment:`, colors.yellow);
  log(`  Overall Risk: ${analysis4.analysis.riskScore.rating.toUpperCase()} (${analysis4.analysis.riskScore.overall})`);

  if (analysis4.analysis.recommendations) {
    const patternRec = analysis4.analysis.recommendations.find(r => r.category === 'patterns');
    if (patternRec && patternRec.matchedPatterns) {
      log(`\n💡 Matched Patterns:`, colors.green);
      patternRec.matchedPatterns.forEach(pattern => {
        log(`  • ${pattern.name}`);
        log(`    Success Rate: ${(pattern.successRate * 100).toFixed(0)}%, Avg Duration: ${pattern.avgDuration} min`);
      });
    }
  }

  await pause(1000);

  log('\nGetting expert recommendation...', colors.cyan);
  const recommendation4 = await service.getRecommendation(result4.change.id);
  log(`\n📝 Recommendation: ${recommendation4.decision.recommendation.toUpperCase()}`, colors.green);
  log(`   Confidence: ${(recommendation4.decision.confidence * 100).toFixed(0)}%`);

  await pause(3000);

  // Demo 5: Network upgrade
  logSection('DEMO 5: NETWORK INFRASTRUCTURE UPGRADE');

  log('Creating change request...', colors.cyan);
  const result5 = await service.createChange(sampleChanges.networkUpgrade);
  log(`✓ Change created: ${result5.change.id}`, colors.green);

  await pause(1000);

  log('\nAnalyzing change with expert system...', colors.cyan);
  const analysis5 = await service.analyzeChange(result5.change.id);

  log(`\n📊 Risk Assessment:`, colors.red);
  log(`  Overall Risk: ${analysis5.analysis.riskScore.rating.toUpperCase()} (${analysis5.analysis.riskScore.overall})`);
  log(`  Impact Scope: ${result5.change.impactAssessment.scope}`);
  log(`  Affected Users: ${result5.change.impactAssessment.affectedUsers.toLocaleString()}`);

  log(`\n✓ Approval Path:`, colors.yellow);
  log(`  Approvers: ${analysis5.analysis.approvalPath.approvers.join(' → ')}`);
  log(`  CAB Required: ${analysis5.analysis.approvalPath.cabRequired ? 'Yes' : 'No'}`);
  log(`  Additional Reviews: ${analysis5.analysis.approvalPath.additionalReviews.join(', ')}`);

  if (analysis5.complianceRequirements && analysis5.complianceRequirements.length > 0) {
    log(`\n📋 Compliance Requirements:`, colors.cyan);
    analysis5.complianceRequirements.forEach(comp => {
      log(`  ${comp.framework}:`);
      comp.requirements.slice(0, 2).forEach(req => {
        log(`    • ${req}`);
      });
    });
  }

  await pause(3000);

  // Summary
  logSection('DEMONSTRATION SUMMARY');

  log('System Statistics:', colors.cyan);
  const stats = await service.getStatistics();

  log(`\nTotal Changes Analyzed: ${colors.bright}${stats.statistics.totalChanges}${colors.reset}`);

  log('\nBy Risk Level:', colors.yellow);
  Object.entries(stats.statistics.byRisk).forEach(([risk, count]) => {
    const riskColor = {
      'low': colors.green,
      'medium': colors.yellow,
      'high': colors.red,
      'critical': colors.red
    }[risk] || colors.reset;
    log(`  ${risk}: ${count}`, riskColor);
  });

  log('\nBy Category:', colors.cyan);
  Object.entries(stats.statistics.byCategory).forEach(([category, count]) => {
    log(`  ${category}: ${count}`);
  });

  log('\nBy Type:', colors.blue);
  Object.entries(stats.statistics.byType).forEach(([type, count]) => {
    log(`  ${type}: ${count}`);
  });

  await pause(2000);

  logSection('EXPERT SYSTEM CAPABILITIES DEMONSTRATED');

  log('✓ Risk assessment and scoring', colors.green);
  log('✓ Rules-based decision making', colors.green);
  log('✓ Approval workflow determination', colors.green);
  log('✓ Pattern matching from knowledge base', colors.green);
  log('✓ Compliance requirement identification', colors.green);
  log('✓ Best practice recommendations', colors.green);
  log('✓ Integration with AgentDB for learning', colors.green);
  log('✓ Similar change retrieval', colors.green);
  log('✓ Causal relationship tracking', colors.green);

  log('\n' + colors.bright + 'The expert system is ready to assist with enterprise change management!' + colors.reset);
  log('\nNext steps:', colors.cyan);
  log('  • Run "./cli.js help" to see all available commands');
  log('  • Create your own change requests with "./cli.js create"');
  log('  • Analyze changes with "./cli.js analyze <change-id>"');
  log('  • Get recommendations with "./cli.js recommend <change-id>"');
  log('  • Run learning algorithms with "./cli.js learn"\n');
}

// Run the demo
runDemo().catch(error => {
  console.error('Demo failed:', error);
  process.exit(1);
});
