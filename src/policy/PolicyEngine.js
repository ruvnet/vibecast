/**
 * Policy Engine - OPA-style Policy as Code
 *
 * Declarative policy framework for routing, data egress, and compliance.
 * Policies are versioned, audited, and enforced at every decision point.
 *
 * Inspired by Open Policy Agent (OPA) but simplified for this use case.
 */

import { connectAgentDB } from '../db/agentdb.js';
import yaml from 'js-yaml';

export class PolicyEngine {
  constructor(config = {}) {
    this.db = connectAgentDB();
    this.policies = new Map();
    this.config = config;
  }

  /**
   * Load policies from database
   */
  async loadPolicies() {
    const policies = await this.db.query('policies', {
      where: { active: true },
      orderBy: { column: 'priority', ascending: false }
    });

    for (const policy of policies) {
      this.policies.set(policy.name, {
        ...policy,
        rules: typeof policy.rules === 'string' ? JSON.parse(policy.rules) : policy.rules
      });
    }

    console.log(`📋 Loaded ${this.policies.size} active policies`);
  }

  /**
   * Define a new policy
   */
  async definePolicy(policyDef) {
    const policy = await this.db.insert('policies', {
      name: policyDef.name,
      description: policyDef.description,
      policy_type: policyDef.policyType,
      rules: policyDef.rules,
      priority: policyDef.priority || 100,
      active: true,
      version: policyDef.version || '1.0.0',
      created_at: new Date().toISOString()
    });

    this.policies.set(policy.name, policy);
    return policy;
  }

  /**
   * Evaluate routing policy
   */
  async evaluateRouting(context) {
    const decision = {
      allowed: true,
      deniedBy: null,
      requiredLane: null,
      reasoning: []
    };

    // Get routing policies
    const routingPolicies = Array.from(this.policies.values())
      .filter(p => p.policy_type === 'routing')
      .sort((a, b) => b.priority - a.priority);

    for (const policy of routingPolicies) {
      const result = await this._evaluateRules(policy.rules, context);

      if (result.matched) {
        if (result.action === 'deny') {
          decision.allowed = false;
          decision.deniedBy = policy.name;
          decision.reasoning.push(`Denied by policy: ${policy.name}`);
          break;
        } else if (result.action === 'require_lane') {
          decision.requiredLane = result.lane;
          decision.reasoning.push(`${policy.name}: Requires ${result.lane} lane`);
        } else if (result.action === 'prefer_lane') {
          if (!decision.requiredLane) {
            decision.reasoning.push(`${policy.name}: Prefers ${result.lane} lane`);
          }
        }
      }
    }

    // Log policy decision
    await this._logDecision('routing', decision, context);

    return decision;
  }

  /**
   * Evaluate data egress policy
   */
  async evaluateEgress(context) {
    const decision = {
      allowed: true,
      deniedBy: null,
      requiresRedaction: false,
      redactionFields: [],
      reasoning: []
    };

    // Get egress policies
    const egressPolicies = Array.from(this.policies.values())
      .filter(p => p.policy_type === 'egress')
      .sort((a, b) => b.priority - a.priority);

    for (const policy of egressPolicies) {
      const result = await this._evaluateRules(policy.rules, context);

      if (result.matched) {
        if (result.action === 'deny') {
          decision.allowed = false;
          decision.deniedBy = policy.name;
          decision.reasoning.push(`Denied by policy: ${policy.name}`);
          break;
        } else if (result.action === 'redact') {
          decision.requiresRedaction = true;
          decision.redactionFields.push(...(result.fields || []));
          decision.reasoning.push(`${policy.name}: Redact ${result.fields.join(', ')}`);
        }
      }
    }

    // Log policy decision
    await this._logDecision('egress', decision, context);

    return decision;
  }

  /**
   * Evaluate rules against context
   */
  async _evaluateRules(rules, context) {
    const result = {
      matched: false,
      action: null,
      lane: null,
      fields: []
    };

    for (const rule of rules) {
      const conditionMet = this._evaluateCondition(rule.condition, context);

      if (conditionMet) {
        result.matched = true;
        result.action = rule.action;

        if (rule.lane) result.lane = rule.lane;
        if (rule.fields) result.fields = rule.fields;

        break; // First matching rule wins
      }
    }

    return result;
  }

  /**
   * Evaluate a condition
   */
  _evaluateCondition(condition, context) {
    if (condition.type === 'has_pii') {
      return context.hasPII === true;
    }

    if (condition.type === 'data_classification') {
      return context.dataClassification === condition.value;
    }

    if (condition.type === 'destination') {
      return context.destination === condition.value;
    }

    if (condition.type === 'field_exists') {
      return condition.field in (context.data || {});
    }

    if (condition.type === 'always') {
      return true;
    }

    return false;
  }

  /**
   * Log policy decision
   */
  async _logDecision(policyType, decision, context) {
    await this.db.insert('policy_decisions', {
      policy_type: policyType,
      allowed: decision.allowed,
      denied_by: decision.deniedBy,
      reasoning: decision.reasoning,
      context_id: context.id,
      created_at: new Date().toISOString()
    });
  }

  /**
   * Get policy violations
   */
  async getViolations(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const violations = await this.db.query('policy_decisions', {
      where: {
        allowed: false,
        created_at: { operator: 'gte', value: startDate.toISOString() }
      },
      orderBy: { column: 'created_at', ascending: false }
    });

    return violations;
  }
}

/**
 * Pre-built enterprise policies
 */
export const ENTERPRISE_POLICIES = {
  pii_privacy: {
    name: 'pii_privacy_first',
    description: 'PII data must use privacy-preserving lanes',
    policyType: 'routing',
    priority: 1000,
    rules: [
      {
        condition: { type: 'has_pii' },
        action: 'require_lane',
        lane: 'onnx_local'
      }
    ]
  },

  sensitive_data_redaction: {
    name: 'sensitive_data_redaction',
    description: 'Redact PII before external egress',
    policyType: 'egress',
    priority: 1000,
    rules: [
      {
        condition: { type: 'has_pii' },
        action: 'redact',
        fields: ['email', 'ssn', 'credit_card', 'phone']
      }
    ]
  },

  data_residency_eu: {
    name: 'data_residency_eu',
    description: 'EU data must stay in EU region',
    policyType: 'egress',
    priority: 900,
    rules: [
      {
        condition: { type: 'data_classification', value: 'EU_PERSONAL_DATA' },
        action: 'deny',
        reason: 'Data residency requirement'
      }
    ]
  },

  cost_optimization: {
    name: 'cost_optimization_prefer_local',
    description: 'Prefer local ONNX for simple tasks',
    policyType: 'routing',
    priority: 100,
    rules: [
      {
        condition: { type: 'always' },
        action: 'prefer_lane',
        lane: 'onnx_local'
      }
    ]
  }
};

export default PolicyEngine;
