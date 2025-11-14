/**
 * CLI Commands for Change Management Expert System
 */

const ChangeManagementService = require('../services/ChangeManagementService');
const ChangeRequest = require('../models/ChangeRequest');

const service = new ChangeManagementService();

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

function logSection(title) {
  console.log('\n' + colors.bright + colors.cyan + '═'.repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + title + colors.reset);
  console.log(colors.cyan + '═'.repeat(80) + colors.reset + '\n');
}

const commands = {
  /**
   * Create a new change request
   */
  async create(args) {
    logSection('CREATE NEW CHANGE REQUEST');

    const changeData = {
      title: args.title || 'Sample Change Request',
      description: args.description || 'This is a sample change request for demonstration purposes',
      type: args.type || 'standard',
      category: args.category || 'infrastructure',
      priority: args.priority || 'medium',
      requestor: {
        name: args.requestor || 'John Doe',
        email: args.email || 'john.doe@example.com',
        department: 'IT Operations'
      },
      impactAssessment: {
        scope: args.scope || 'medium',
        affectedSystems: args.affectedSystems ? args.affectedSystems.split(',') : ['production-web', 'database'],
        affectedUsers: parseInt(args.affectedUsers) || 1000,
        downtime: {
          required: args.downtime === 'true',
          duration: parseInt(args.downtimeDuration) || 0,
          unit: 'minutes'
        },
        dataImpact: args.dataImpact === 'true',
        securityImpact: args.securityImpact === 'true',
        complianceImpact: args.complianceImpact === 'true'
      },
      riskAssessment: {
        overallRisk: args.risk || 'medium',
        technicalRisk: args.risk || 'medium',
        businessRisk: args.risk || 'medium',
        securityRisk: args.securityRisk || 'low',
        mitigationPlan: args.mitigationPlan || 'Standard mitigation procedures',
        rollbackPlan: args.rollbackPlan || 'Automated rollback available'
      }
    };

    const result = await service.createChange(changeData);

    if (result.success) {
      log('✓ Change request created successfully', colors.green);
      log(`\nChange ID: ${colors.bright}${result.change.id}${colors.reset}`);
      log(`Status: ${result.change.status}`);
      log(`Risk Level: ${result.change.riskAssessment.overallRisk}`);

      // Show initial analysis
      if (result.analysis) {
        console.log('\n' + colors.yellow + 'Initial Analysis:' + colors.reset);
        log(`Applied ${result.analysis.appliedRules.length} rules`);
        log(`Generated ${result.analysis.recommendations.length} recommendations`);
        log(`Risk Score: ${result.analysis.riskScore.overall} (${result.analysis.riskScore.rating})`);
      }

      return result.change.id;
    } else {
      log('✗ Failed to create change request', colors.red);
      result.errors.forEach(err => log(`  - ${err}`, colors.red));
      return null;
    }
  },

  /**
   * Analyze a change request
   */
  async analyze(args) {
    const changeId = args.id || args._[1];
    if (!changeId) {
      log('✗ Please provide a change ID', colors.red);
      return;
    }

    logSection(`ANALYZING CHANGE REQUEST: ${changeId}`);

    const result = await service.analyzeChange(changeId);

    if (!result.success) {
      log(`✗ ${result.error}`, colors.red);
      return;
    }

    const { analysis, similarChanges, causalInsights, applicableSkills } = result;

    // Risk Assessment
    console.log(colors.bright + '\n📊 Risk Assessment:' + colors.reset);
    log(`  Overall Risk: ${colors.yellow}${analysis.riskScore.rating.toUpperCase()}${colors.reset} (${analysis.riskScore.overall})`);
    log(`  Technical Risk: ${analysis.riskScore.technical}`);
    log(`  Business Risk: ${analysis.riskScore.business}`);
    log(`  Security Risk: ${analysis.riskScore.security}`);

    // Applied Rules
    if (analysis.appliedRules.length > 0) {
      console.log(colors.bright + '\n📋 Applied Rules:' + colors.reset);
      analysis.appliedRules.forEach(rule => {
        log(`  • ${rule.ruleName} (${rule.ruleId})`, colors.cyan);
        log(`    ${rule.result}`);
      });
    }

    // Approval Path
    if (analysis.approvalPath) {
      console.log(colors.bright + '\n✓ Approval Path:' + colors.reset);
      log(`  Approvers: ${analysis.approvalPath.approvers.join(' → ')}`);
      log(`  SLA: ${analysis.approvalPath.sla} hours`);
      log(`  CAB Required: ${analysis.approvalPath.cabRequired ? 'Yes' : 'No'}`);
      if (analysis.approvalPath.additionalReviews && analysis.approvalPath.additionalReviews.length > 0) {
        log(`  Additional Reviews: ${analysis.approvalPath.additionalReviews.join(', ')}`);
      }
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      console.log(colors.bright + '\n💡 Recommendations:' + colors.reset);
      analysis.recommendations.forEach(rec => {
        if (rec.category === 'patterns' && rec.matchedPatterns) {
          log(`\n  Matched Patterns:`, colors.green);
          rec.matchedPatterns.forEach(pattern => {
            log(`    • ${pattern.name} (${pattern.successRate * 100}% success rate)`);
            log(`      Avg Duration: ${pattern.avgDuration} minutes`);
            log(`      Steps: ${pattern.steps.length} steps defined`);
          });
        } else if (rec.category === 'specific' && rec.recommendations) {
          log(`\n  Specific Recommendations:`, colors.yellow);
          rec.recommendations.forEach(r => log(`    • ${r}`));
        }
      });
    }

    // Warnings
    if (analysis.warnings.length > 0) {
      console.log(colors.bright + '\n⚠️  Warnings:' + colors.reset);
      analysis.warnings.forEach(warn => log(`  • ${warn}`, colors.yellow));
    }

    // Required Actions
    if (analysis.requiredActions.length > 0) {
      console.log(colors.bright + '\n🔴 Required Actions:' + colors.reset);
      analysis.requiredActions.forEach(action => log(`  • ${action}`, colors.red));
    }

    // Similar Changes from AgentDB
    if (similarChanges.length > 0) {
      console.log(colors.bright + '\n🔍 Similar Past Changes:' + colors.reset);
      similarChanges.slice(0, 3).forEach((episode, i) => {
        log(`  ${i + 1}. ${episode.task} (Success: ${episode.success ? 'Yes' : 'No'}, Reward: ${episode.reward})`);
      });
    }

    // Causal Insights
    if (causalInsights.length > 0) {
      console.log(colors.bright + '\n🔗 Causal Insights:' + colors.reset);
      causalInsights.slice(0, 3).forEach(edge => {
        log(`  • ${edge.cause} → ${edge.effect} (Uplift: ${edge.uplift}, Confidence: ${edge.confidence})`);
      });
    }

    // Applicable Skills
    if (applicableSkills.length > 0) {
      console.log(colors.bright + '\n🎯 Applicable Skills:' + colors.reset);
      applicableSkills.slice(0, 3).forEach(skill => {
        log(`  • ${skill.name}: ${skill.description}`);
      });
    }

    console.log('\n');
  },

  /**
   * Get recommendation for a change
   */
  async recommend(args) {
    const changeId = args.id || args._[1];
    if (!changeId) {
      log('✗ Please provide a change ID', colors.red);
      return;
    }

    logSection(`EXPERT RECOMMENDATION: ${changeId}`);

    const result = await service.getRecommendation(changeId);

    if (!result.success) {
      log(`✗ ${result.error}`, colors.red);
      return;
    }

    const { decision } = result;

    // Recommendation
    const recColor = {
      'approve': colors.green,
      'fast_track': colors.green,
      'conditional_approve': colors.yellow,
      'escalate': colors.red,
      'reject': colors.red,
      'more_info_needed': colors.yellow
    }[decision.recommendation] || colors.reset;

    log(`\n📝 Recommendation: ${decision.recommendation.toUpperCase()}`, recColor);
    log(`Confidence: ${(decision.confidence * 100).toFixed(0)}%`);

    // Reasons
    if (decision.reasons.length > 0) {
      console.log(colors.bright + '\nReasons:' + colors.reset);
      decision.reasons.forEach(reason => log(`  • ${reason}`));
    }

    // Blockers
    if (decision.blockers.length > 0) {
      console.log(colors.bright + colors.red + '\nBlockers:' + colors.reset);
      decision.blockers.forEach(blocker => log(`  • ${blocker}`, colors.red));
    }

    // Next Steps
    if (decision.nextSteps.length > 0) {
      console.log(colors.bright + '\nNext Steps:' + colors.reset);
      decision.nextSteps.forEach(step => log(`  • ${step}`, colors.cyan));
    }

    console.log('\n');
  },

  /**
   * List all changes
   */
  async list(args) {
    logSection('CHANGE REQUESTS');

    const result = await service.searchChanges('', {
      status: args.status,
      type: args.type,
      category: args.category
    });

    if (result.results.length === 0) {
      log('No change requests found', colors.yellow);
      return;
    }

    result.results.forEach(change => {
      const riskColor = {
        'low': colors.green,
        'medium': colors.yellow,
        'high': colors.red,
        'critical': colors.red
      }[change.riskAssessment.overallRisk] || colors.reset;

      log(`\n${colors.bright}${change.id}${colors.reset}`);
      log(`  Title: ${change.title}`);
      log(`  Status: ${change.status}`);
      log(`  Type: ${change.type} | Category: ${change.category}`);
      log(`  Risk: ${change.riskAssessment.overallRisk}`, riskColor);
      log(`  Created: ${new Date(change.createdAt).toLocaleString()}`);
    });

    console.log('\n');
  },

  /**
   * Show statistics
   */
  async stats(args) {
    logSection('SYSTEM STATISTICS');

    const result = await service.getStatistics();

    if (!result.success) {
      log('✗ Failed to get statistics', colors.red);
      return;
    }

    const { statistics } = result;

    log(`Total Changes: ${colors.bright}${statistics.totalChanges}${colors.reset}`);

    if (statistics.byStatus) {
      console.log(colors.bright + '\nBy Status:' + colors.reset);
      Object.entries(statistics.byStatus).forEach(([status, count]) => {
        log(`  ${status}: ${count}`);
      });
    }

    if (statistics.byType) {
      console.log(colors.bright + '\nBy Type:' + colors.reset);
      Object.entries(statistics.byType).forEach(([type, count]) => {
        log(`  ${type}: ${count}`);
      });
    }

    if (statistics.byCategory) {
      console.log(colors.bright + '\nBy Category:' + colors.reset);
      Object.entries(statistics.byCategory).forEach(([category, count]) => {
        log(`  ${category}: ${count}`);
      });
    }

    if (statistics.byRisk) {
      console.log(colors.bright + '\nBy Risk Level:' + colors.reset);
      Object.entries(statistics.byRisk).forEach(([risk, count]) => {
        const color = {
          'low': colors.green,
          'medium': colors.yellow,
          'high': colors.red,
          'critical': colors.red
        }[risk] || colors.reset;
        log(`  ${risk}: ${count}`, color);
      });
    }

    console.log('\n' + colors.bright + 'AgentDB Statistics:' + colors.reset);
    log(statistics.agentDB);

    console.log('\n');
  },

  /**
   * Learn from past changes
   */
  async learn(args) {
    logSection('RUNNING LEARNING ALGORITHMS');

    log('Discovering patterns from past changes...', colors.cyan);
    const learnerResult = await service.discoverPatterns();

    if (learnerResult.success) {
      log('✓ Pattern discovery complete', colors.green);
      log(learnerResult.result);
    }

    log('\nConsolidating skills from successful changes...', colors.cyan);
    const skillResult = await service.consolidateSkills();

    if (skillResult.success) {
      log('✓ Skill consolidation complete', colors.green);
      log(skillResult.result);
    }

    console.log('\n');
  },

  /**
   * Show help
   */
  help() {
    logSection('CHANGE MANAGEMENT EXPERT SYSTEM - HELP');

    console.log(colors.bright + 'Available Commands:\n' + colors.reset);

    log('  create [options]', colors.cyan);
    log('    Create a new change request');
    log('    Options: --title, --description, --type, --category, --priority, --risk\n');

    log('  analyze <change-id>', colors.cyan);
    log('    Analyze a change request using expert system\n');

    log('  recommend <change-id>', colors.cyan);
    log('    Get expert recommendation for a change\n');

    log('  list [options]', colors.cyan);
    log('    List all change requests');
    log('    Options: --status, --type, --category\n');

    log('  stats', colors.cyan);
    log('    Show system statistics\n');

    log('  learn', colors.cyan);
    log('    Run learning algorithms to discover patterns and consolidate skills\n');

    log('  help', colors.cyan);
    log('    Show this help message\n');

    console.log(colors.bright + 'Examples:\n' + colors.reset);
    log('  node cli.js create --title "Database Migration" --type standard --category database --risk high');
    log('  node cli.js analyze CHG-1234567890-1234');
    log('  node cli.js recommend CHG-1234567890-1234');
    log('  node cli.js list --status approved');
    log('  node cli.js stats');
    log('  node cli.js learn\n');
  }
};

module.exports = commands;
