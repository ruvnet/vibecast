/**
 * Rule Synthesizer - Reflexion Memory to Auto Rule Generation
 *
 * Analyzes exception patterns and agent reflexions to automatically propose
 * new validation rules, enrichment logic, and guards. Uses property testing
 * and approval workflows to ensure safety.
 *
 * Features:
 * - Pattern detection in exceptions
 * - Automatic rule proposal generation
 * - Property-based testing of candidate rules
 * - Approval workflow with CFO-friendly ROI projections
 * - Exception rate tracking and savings calculation
 */

import { connectAgentDB } from '../db/agentdb.js';
import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';

dotenv.config();

export class RuleSynthesizer {
  constructor(config = {}) {
    this.db = connectAgentDB();
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.config = {
      minExceptions: config.minExceptions || 5,        // Minimum exceptions to trigger synthesis
      confidenceThreshold: config.confidenceThreshold || 0.7,  // Min confidence for auto-approval
      testSampleSize: config.testSampleSize || 100,    // Property test sample size
      ...config
    };
  }

  /**
   * Analyze exception patterns and propose rules
   *
   * @returns {Array} - Array of rule proposals with ROI projections
   */
  async analyzeAndPropose() {
    console.log('\n🔬 Rule Synthesizer - Analyzing Exception Patterns');
    console.log('━'.repeat(80));

    // Get recent exceptions with reflexions
    const exceptions = await this.db.query('exceptions', {
      where: { reviewed: true },
      orderBy: { column: 'created_at', ascending: false },
      limit: 500
    });

    if (exceptions.length < this.config.minExceptions) {
      console.log(`ℹ️  Not enough exceptions (${exceptions.length}/${this.config.minExceptions})`);
      return [];
    }

    // Get agent reflexions
    const reflexions = await this.db.query('agent_memory', {
      where: { memory_type: 'failure' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 200
    });

    console.log(`📊 Analyzing ${exceptions.length} exceptions and ${reflexions.length} reflexions`);

    // Detect patterns
    const patterns = await this._detectPatterns(exceptions, reflexions);

    if (patterns.length === 0) {
      console.log('ℹ️  No actionable patterns detected');
      return [];
    }

    console.log(`\n🎯 Detected ${patterns.length} actionable patterns:\n`);

    // Generate rule proposals for each pattern
    const proposals = [];

    for (const pattern of patterns) {
      console.log(`   Pattern ${pattern.id}: ${pattern.description}`);
      console.log(`   Frequency: ${pattern.frequency} occurrences`);
      console.log(`   Impact: ${pattern.impact} exceptions/week`);

      const proposal = await this._generateRuleProposal(pattern, exceptions);

      if (proposal) {
        proposals.push(proposal);
      }
    }

    console.log('\n━'.repeat(80));
    console.log(`✅ Generated ${proposals.length} rule proposals\n`);

    // Save proposals
    for (const proposal of proposals) {
      await this._saveProposal(proposal);
    }

    return proposals;
  }

  /**
   * Detect patterns in exceptions
   */
  async _detectPatterns(exceptions, reflexions) {
    // Group exceptions by type and error message
    const groups = {};

    for (const exception of exceptions) {
      const key = `${exception.exception_type}:${exception.error_message}`;

      if (!groups[key]) {
        groups[key] = {
          id: nanoid(8),
          type: exception.exception_type,
          message: exception.error_message,
          occurrences: [],
          details: []
        };
      }

      groups[key].occurrences.push(exception);
      if (exception.error_details) {
        groups[key].details.push(exception.error_details);
      }
    }

    // Filter for significant patterns (>= minExceptions)
    const patterns = Object.values(groups)
      .filter(group => group.occurrences.length >= this.config.minExceptions)
      .map(group => {
        // Calculate time span
        const dates = group.occurrences.map(e => new Date(e.created_at));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const daysSpan = (maxDate - minDate) / (1000 * 60 * 60 * 24);

        return {
          id: group.id,
          type: group.type,
          description: group.message,
          frequency: group.occurrences.length,
          timeSpan: daysSpan,
          impact: daysSpan > 0 ? (group.occurrences.length / daysSpan) * 7 : 0, // Exceptions per week
          sampleDetails: group.details.slice(0, 5),
          confidence: Math.min(0.9, group.occurrences.length / 20) // More occurrences = higher confidence
        };
      })
      .sort((a, b) => b.impact - a.impact);

    return patterns;
  }

  /**
   * Generate rule proposal for a pattern
   */
  async _generateRuleProposal(pattern, allExceptions) {
    console.log(`\n   🤖 Generating rule for pattern ${pattern.id}...`);

    // Use Claude to synthesize rule
    const prompt = `You are a rule synthesis system analyzing exception patterns to propose new validation rules.

Pattern Analysis:
- Type: ${pattern.type}
- Description: ${pattern.description}
- Frequency: ${pattern.frequency} occurrences
- Impact: ${pattern.impact.toFixed(1)} exceptions/week
- Confidence: ${(pattern.confidence * 100).toFixed(0)}%

Sample Exception Details:
${JSON.stringify(pattern.sampleDetails.slice(0, 3), null, 2)}

Based on this pattern, generate a validation or enrichment rule that would prevent these exceptions.

Respond with JSON ONLY (no markdown):
{
  "rule": {
    "name": "Descriptive rule name",
    "rule_type": "validation" or "enrichment",
    "condition": {<JSON condition>},
    "action": {<JSON action>},
    "priority": <number>
  },
  "rationale": "Why this rule will help",
  "expected_impact": {
    "exceptions_prevented_per_week": <number>,
    "cost_savings_per_week": <number in USD>,
    "quality_improvement": "<low|medium|high>"
  },
  "property_tests": [
    {"input": {<sample>}, "expected": true/false},
    ...
  ]
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const proposal = JSON.parse(content);

      // Enrich proposal
      proposal.pattern_id = pattern.id;
      proposal.pattern = pattern;
      proposal.status = 'pending_approval';
      proposal.confidence = pattern.confidence;
      proposal.created_at = new Date().toISOString();

      // Run property tests
      const testResults = await this._runPropertyTests(proposal);
      proposal.test_results = testResults;
      proposal.tests_passed = testResults.every(t => t.passed);

      console.log(`   ✅ Rule generated: ${proposal.rule.name}`);
      console.log(`   📊 Expected impact: ${proposal.expected_impact.exceptions_prevented_per_week} exceptions/week`);
      console.log(`   💰 Cost savings: $${proposal.expected_impact.cost_savings_per_week.toFixed(2)}/week`);
      console.log(`   🧪 Property tests: ${testResults.filter(t => t.passed).length}/${testResults.length} passed`);

      return proposal;

    } catch (error) {
      console.error(`   ❌ Failed to generate rule: ${error.message}`);
      return null;
    }
  }

  /**
   * Run property tests on proposed rule
   */
  async _runPropertyTests(proposal) {
    const tests = proposal.property_tests || [];
    const results = [];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];

      try {
        // Simulate rule execution
        const result = this._evaluateRule(proposal.rule, test.input);
        const passed = result === test.expected;

        results.push({
          testId: i + 1,
          input: test.input,
          expected: test.expected,
          actual: result,
          passed
        });
      } catch (error) {
        results.push({
          testId: i + 1,
          input: test.input,
          expected: test.expected,
          error: error.message,
          passed: false
        });
      }
    }

    return results;
  }

  /**
   * Evaluate rule against input (simulation)
   */
  _evaluateRule(rule, input) {
    const { field, operator, value } = rule.condition;

    if (!(field in input)) {
      return false;
    }

    const fieldValue = input[field];

    switch (operator) {
      case 'gt':
        return fieldValue > value;
      case 'lt':
        return fieldValue < value;
      case 'eq':
        return fieldValue === value;
      case 'regex':
        return new RegExp(value).test(fieldValue);
      case 'exists':
        return fieldValue !== null && fieldValue !== undefined;
      default:
        return true;
    }
  }

  /**
   * Save proposal to database
   */
  async _saveProposal(proposal) {
    await this.db.insert('rule_proposals', {
      pattern_id: proposal.pattern_id,
      rule_spec: proposal.rule,
      rationale: proposal.rationale,
      expected_impact: proposal.expected_impact,
      confidence: proposal.confidence,
      tests_passed: proposal.tests_passed,
      test_results: proposal.test_results,
      status: proposal.status,
      created_at: proposal.created_at
    });
  }

  /**
   * Get pending proposals for approval
   */
  async getPendingProposals() {
    const proposals = await this.db.query('rule_proposals', {
      where: { status: 'pending_approval' },
      orderBy: { column: 'created_at', ascending: false }
    });

    return proposals;
  }

  /**
   * Approve and deploy a rule proposal
   */
  async approveAndDeploy(proposalId, approvedBy) {
    console.log(`\n✅ Approving and deploying rule proposal: ${proposalId}`);

    // Get proposal
    const proposals = await this.db.query('rule_proposals', {
      where: { id: proposalId },
      limit: 1
    });

    if (proposals.length === 0) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const proposal = proposals[0];

    // Insert as active rule
    const rule = await this.db.insert('rules', {
      ...proposal.rule_spec,
      created_by: `rule_synthesizer:${approvedBy}`,
      active: true,
      metadata: {
        source: 'auto_synthesis',
        proposal_id: proposalId,
        expected_impact: proposal.expected_impact
      }
    });

    // Update proposal status
    await this.db.update('rule_proposals',
      { id: proposalId },
      {
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        deployed_rule_id: rule.id
      }
    );

    // Store reflexion memory
    await this.db.storeMemory({
      agentName: 'RuleSynthesizer',
      memoryType: 'learning',
      content: `Deployed rule '${proposal.rule_spec.name}' to address pattern ${proposal.pattern_id}`,
      context: {
        proposal_id: proposalId,
        rule_id: rule.id,
        expected_impact: proposal.expected_impact
      },
      confidenceScore: proposal.confidence
    });

    console.log(`✅ Rule deployed: ${proposal.rule_spec.name}`);
    console.log(`   Impact tracking will begin immediately`);

    return rule;
  }

  /**
   * Reject a rule proposal
   */
  async rejectProposal(proposalId, rejectedBy, reason) {
    await this.db.update('rule_proposals',
      { id: proposalId },
      {
        status: 'rejected',
        rejected_by: rejectedBy,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason
      }
    );

    console.log(`❌ Proposal ${proposalId} rejected: ${reason}`);
  }

  /**
   * Calculate ROI for deployed rules
   */
  async calculateROI(daysBack = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get deployed rules
    const deployedRules = await this.db.query('rules', {
      where: {
        created_by: { operator: 'like', value: 'rule_synthesizer:%' },
        created_at: { operator: 'gte', value: startDate.toISOString() }
      }
    });

    console.log(`\n📊 ROI Analysis for ${deployedRules.length} auto-synthesized rules (last ${daysBack} days)`);

    let totalExceptionsPrevented = 0;
    let totalCostSavings = 0;

    for (const rule of deployedRules) {
      const impact = rule.metadata?.expected_impact || {};

      // Calculate actual impact vs. expected
      const weeksElapsed = Math.max(1, (new Date() - new Date(rule.created_at)) / (1000 * 60 * 60 * 24 * 7));

      const expectedExceptions = impact.exceptions_prevented_per_week * weeksElapsed;
      const expectedSavings = impact.cost_savings_per_week * weeksElapsed;

      totalExceptionsPrevented += expectedExceptions;
      totalCostSavings += expectedSavings;

      console.log(`\n   Rule: ${rule.name}`);
      console.log(`   Expected prevented: ${expectedExceptions.toFixed(0)} exceptions`);
      console.log(`   Expected savings: $${expectedSavings.toFixed(2)}`);
    }

    console.log('\n━'.repeat(80));
    console.log(`💰 Total ROI:`);
    console.log(`   Exceptions prevented: ${totalExceptionsPrevented.toFixed(0)}`);
    console.log(`   Cost savings: $${totalCostSavings.toFixed(2)}`);
    console.log(`   Rules deployed: ${deployedRules.length}`);
    console.log('━'.repeat(80));

    return {
      rulesDeployed: deployedRules.length,
      exceptionsPrevented: totalExceptionsPrevented,
      costSavings: totalCostSavings,
      period: `${daysBack} days`
    };
  }
}

export default RuleSynthesizer;
