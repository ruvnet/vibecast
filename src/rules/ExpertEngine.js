/**
 * Expert System Rules Engine
 * Implements forward chaining inference for change management decisions
 */

const KnowledgeBase = require('../models/KnowledgeBase');

class ExpertEngine {
  constructor() {
    this.knowledgeBase = new KnowledgeBase();
    this.inferenceLog = [];
  }

  /**
   * Analyze a change request and apply all relevant rules
   */
  analyze(changeRequest) {
    this.inferenceLog = [];
    const results = {
      change: changeRequest,
      appliedRules: [],
      recommendations: [],
      risks: [],
      approvalPath: null,
      estimatedSLA: 0,
      warnings: [],
      requiredActions: []
    };

    // Apply risk assessment rules
    this.applyRiskRules(changeRequest, results);

    // Apply approval workflow rules
    this.applyApprovalRules(changeRequest, results);

    // Apply timing rules
    this.applyTimingRules(changeRequest, results);

    // Find matching patterns
    this.findPatterns(changeRequest, results);

    // Generate recommendations
    this.generateRecommendations(changeRequest, results);

    // Calculate overall risk score
    this.calculateRiskScore(changeRequest, results);

    // Determine required compliance checks
    this.determineComplianceRequirements(changeRequest, results);

    results.inferenceLog = this.inferenceLog;

    return results;
  }

  applyRiskRules(change, results) {
    this.log('Applying risk assessment rules...');

    const riskRules = this.knowledgeBase.findApplicableRules(change, 'riskRules');

    riskRules.forEach(rule => {
      const result = rule.action(change);
      results.appliedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result
      });
      this.log(`Applied rule ${rule.id}: ${rule.name} - ${result}`);
    });
  }

  applyApprovalRules(change, results) {
    this.log('Determining approval workflow...');

    const approvalRules = this.knowledgeBase.findApplicableRules(change, 'approvalRules');

    if (approvalRules.length > 0) {
      // Use the most restrictive approval rule
      const mostRestrictive = approvalRules.reduce((prev, curr) => {
        return curr.approvers.length > prev.approvers.length ? curr : prev;
      });

      results.approvalPath = {
        ruleId: mostRestrictive.id,
        approvers: mostRestrictive.approvers,
        sla: mostRestrictive.sla,
        postImplementationReview: mostRestrictive.postImplementationReview || false
      };

      results.estimatedSLA = mostRestrictive.sla;

      this.log(`Selected approval path: ${mostRestrictive.name} (${mostRestrictive.approvers.length} approvers)`);
    } else {
      // Default approval path
      results.approvalPath = {
        ruleId: 'default',
        approvers: ['team_lead'],
        sla: 24,
        postImplementationReview: false
      };
      this.log('Using default approval path');
    }

    // Get approval matrix details
    const approvalReqs = this.knowledgeBase.getApprovalRequirements(change);
    results.approvalPath.notifications = approvalReqs.notifications;
    results.approvalPath.cabRequired = approvalReqs.cab;
    results.approvalPath.additionalReviews = approvalReqs.additionalReviews || [];
  }

  applyTimingRules(change, results) {
    this.log('Analyzing implementation timing...');

    const timingRules = this.knowledgeBase.findApplicableRules(change, 'timingRules');

    timingRules.forEach(rule => {
      const result = rule.action ? rule.action(change) : rule.recommendation;
      results.recommendations.push({
        category: 'timing',
        recommendation: result,
        blackoutPeriods: rule.blackoutPeriods || []
      });
      this.log(`Timing recommendation: ${result}`);
    });
  }

  findPatterns(change, results) {
    this.log('Searching for matching patterns...');

    const searchText = `${change.title} ${change.description} ${change.category}`;
    const patterns = this.knowledgeBase.findMatchingPattern(searchText);

    if (patterns.length > 0) {
      results.recommendations.push({
        category: 'patterns',
        matchedPatterns: patterns.map(p => ({
          id: p.id,
          name: p.name,
          scenario: p.scenario,
          successRate: p.successRate,
          avgDuration: p.avgDuration,
          steps: p.steps,
          risks: p.risks,
          mitigations: p.mitigations
        }))
      });
      this.log(`Found ${patterns.length} matching pattern(s)`);
    } else {
      this.log('No matching patterns found - manual planning required');
      results.warnings.push('No established patterns found for this type of change');
    }
  }

  generateRecommendations(change, results) {
    this.log('Generating expert recommendations...');

    // Best practices recommendations
    const relevantPractices = {
      planning: this.knowledgeBase.getBestPractices('planning'),
      riskManagement: this.knowledgeBase.getBestPractices('riskManagement'),
      communication: this.knowledgeBase.getBestPractices('communication'),
      testing: this.knowledgeBase.getBestPractices('testing')
    };

    if (change.compliance.complianceFrameworks.length > 0) {
      relevantPractices.compliance = this.knowledgeBase.getBestPractices('compliance');
    }

    results.recommendations.push({
      category: 'bestPractices',
      practices: relevantPractices
    });

    // Specific recommendations based on change characteristics
    const specificRecs = [];

    if (!change.implementation.steps || change.implementation.steps.length === 0) {
      specificRecs.push('Define detailed implementation steps before proceeding');
      results.requiredActions.push('add_implementation_steps');
    }

    if (!change.riskAssessment.rollbackPlan) {
      specificRecs.push('Create a comprehensive rollback plan');
      results.requiredActions.push('add_rollback_plan');
    }

    if (change.impactAssessment.affectedSystems.length === 0) {
      specificRecs.push('Identify all affected systems and dependencies');
      results.requiredActions.push('identify_affected_systems');
    }

    if (change.riskAssessment.overallRisk === 'high' || change.riskAssessment.overallRisk === 'critical') {
      specificRecs.push('Consider implementing this change in phases');
      specificRecs.push('Schedule a dry-run in a staging environment');
      specificRecs.push('Ensure 24/7 support coverage during implementation');
    }

    if (change.impactAssessment.downtime.required) {
      specificRecs.push('Coordinate maintenance window with all stakeholders');
      specificRecs.push('Prepare customer communication about downtime');
    }

    if (specificRecs.length > 0) {
      results.recommendations.push({
        category: 'specific',
        recommendations: specificRecs
      });
    }

    this.log(`Generated ${specificRecs.length} specific recommendations`);
  }

  calculateRiskScore(change, results) {
    this.log('Calculating quantitative risk score...');

    let technicalScore = 0;
    let businessScore = 0;
    let securityScore = 0;

    // Technical risk factors
    const technicalFactors = this.knowledgeBase.getRiskFactors('technical');
    technicalFactors.forEach(factor => {
      let value = 0;
      switch (factor.factor) {
        case 'complexity':
          value = change.implementation.steps.length > 10 ? 0.8 : 0.3;
          break;
        case 'dependencies':
          value = change.dependencies.length > 5 ? 0.9 : change.dependencies.length * 0.1;
          break;
        case 'testing':
          value = change.implementation.verificationSteps.length > 0 ? 0.2 : 0.8;
          break;
        case 'automation':
          value = 0.5; // Default - would need more info
          break;
        case 'rollback':
          value = change.riskAssessment.rollbackPlan ? 0.2 : 0.9;
          break;
      }
      technicalScore += value * factor.weight;
    });

    // Business risk factors
    const businessFactors = this.knowledgeBase.getRiskFactors('business');
    businessFactors.forEach(factor => {
      let value = 0;
      switch (factor.factor) {
        case 'user_impact':
          value = Math.min(change.impactAssessment.affectedUsers / 10000, 1);
          break;
        case 'downtime':
          value = change.impactAssessment.downtime.required ?
                  Math.min(change.impactAssessment.downtime.duration / 240, 1) : 0;
          break;
        case 'revenue_impact':
          value = change.priority === 'critical' ? 0.9 : 0.3;
          break;
        case 'reputation':
          value = change.impactAssessment.scope === 'enterprise-wide' ? 0.8 : 0.2;
          break;
      }
      businessScore += value * factor.weight;
    });

    // Security risk factors
    const securityFactors = this.knowledgeBase.getRiskFactors('security');
    securityFactors.forEach(factor => {
      let value = 0;
      switch (factor.factor) {
        case 'data_exposure':
          value = change.impactAssessment.dataImpact ? 0.8 : 0.1;
          break;
        case 'authentication':
          value = change.category === 'security' ? 0.7 : 0.2;
          break;
        case 'encryption':
          value = change.impactAssessment.securityImpact ? 0.6 : 0.1;
          break;
        case 'access_control':
          value = change.category === 'security' ? 0.7 : 0.2;
          break;
      }
      securityScore += value * factor.weight;
    });

    const overallScore = (technicalScore + businessScore + securityScore) / 3;

    results.riskScore = {
      overall: parseFloat(overallScore.toFixed(2)),
      technical: parseFloat(technicalScore.toFixed(2)),
      business: parseFloat(businessScore.toFixed(2)),
      security: parseFloat(securityScore.toFixed(2)),
      rating: this.scoreToRating(overallScore)
    };

    this.log(`Risk scores - Overall: ${results.riskScore.overall}, Tech: ${results.riskScore.technical}, Business: ${results.riskScore.business}, Security: ${results.riskScore.security}`);

    // Update change request risk assessment if calculated risk is higher
    if (this.ratingToLevel(results.riskScore.rating) > this.ratingToLevel(change.riskAssessment.overallRisk)) {
      results.warnings.push(`Calculated risk (${results.riskScore.rating}) is higher than assessed risk (${change.riskAssessment.overallRisk})`);
    }
  }

  scoreToRating(score) {
    if (score >= 0.75) return 'critical';
    if (score >= 0.5) return 'high';
    if (score >= 0.25) return 'medium';
    return 'low';
  }

  ratingToLevel(rating) {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[rating] || 1;
  }

  determineComplianceRequirements(change, results) {
    this.log('Determining compliance requirements...');

    const complianceChecks = [];

    if (change.compliance.complianceFrameworks.includes('SOX')) {
      complianceChecks.push({
        framework: 'SOX',
        requirements: [
          'Maintain audit trail of all changes',
          'Segregation of duties (requester != implementer)',
          'Management approval required',
          'Post-implementation verification'
        ]
      });
    }

    if (change.compliance.complianceFrameworks.includes('HIPAA')) {
      complianceChecks.push({
        framework: 'HIPAA',
        requirements: [
          'Risk assessment for PHI impact',
          'Security officer approval',
          'Privacy impact assessment',
          'Audit logging enabled'
        ]
      });
    }

    if (change.compliance.complianceFrameworks.includes('PCI-DSS')) {
      complianceChecks.push({
        framework: 'PCI-DSS',
        requirements: [
          'Change control procedures followed',
          'Security testing completed',
          'Cardholder data protection verified',
          'Network segmentation maintained'
        ]
      });
    }

    if (change.compliance.complianceFrameworks.includes('GDPR')) {
      complianceChecks.push({
        framework: 'GDPR',
        requirements: [
          'Data protection impact assessment',
          'Privacy by design principles',
          'Data subject rights maintained',
          'Cross-border transfer compliance'
        ]
      });
    }

    if (complianceChecks.length > 0) {
      results.complianceRequirements = complianceChecks;
      this.log(`Identified ${complianceChecks.length} compliance framework(s) with specific requirements`);
    }
  }

  /**
   * Make a decision on whether to approve, reject, or request more info
   */
  makeDecision(changeRequest) {
    const analysis = this.analyze(changeRequest);
    const validation = changeRequest.validate();

    const decision = {
      recommendation: 'pending',
      confidence: 0,
      reasons: [],
      blockers: [],
      warnings: analysis.warnings,
      nextSteps: []
    };

    // Check validation first
    if (!validation.valid) {
      decision.recommendation = 'reject';
      decision.confidence = 1.0;
      decision.blockers = validation.errors;
      decision.reasons.push('Change request failed validation');
      return decision;
    }

    // Check for required actions
    if (analysis.requiredActions.length > 0) {
      decision.recommendation = 'more_info_needed';
      decision.confidence = 0.9;
      decision.reasons.push('Additional information required before approval');
      decision.nextSteps = analysis.requiredActions;
      return decision;
    }

    // Assess based on risk score
    const riskScore = analysis.riskScore.overall;

    if (riskScore >= 0.8) {
      decision.recommendation = 'escalate';
      decision.confidence = 0.95;
      decision.reasons.push('Critical risk level requires executive approval');
      decision.nextSteps.push('Schedule emergency CAB meeting');
    } else if (riskScore >= 0.6) {
      decision.recommendation = 'conditional_approve';
      decision.confidence = 0.8;
      decision.reasons.push('High risk - approve with conditions');
      decision.nextSteps.push('Require phased implementation');
      decision.nextSteps.push('Mandatory dry-run in staging');
    } else if (riskScore >= 0.3) {
      decision.recommendation = 'approve';
      decision.confidence = 0.85;
      decision.reasons.push('Medium risk - standard approval process');
    } else {
      decision.recommendation = 'fast_track';
      decision.confidence = 0.95;
      decision.reasons.push('Low risk - eligible for fast-track approval');
    }

    decision.analysis = analysis;

    return decision;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    this.inferenceLog.push(entry);
  }
}

module.exports = ExpertEngine;
