/**
 * Knowledge Base for Change Management Expert System (Optimized with Singleton)
 * Contains enterprise best practices, patterns, and decision rules
 */

class KnowledgeBase {
  // Singleton instance
  static instance = null;

  constructor() {
    // Return existing instance if available (singleton pattern)
    if (KnowledgeBase.instance) {
      return KnowledgeBase.instance;
    }

    this.rules = this.initializeRules();
    this.patterns = this.initializePatterns();
    this.bestPractices = this.initializeBestPractices();
    this.riskFactors = this.initializeRiskFactors();
    this.approvalMatrix = this.initializeApprovalMatrix();

    // Store instance
    KnowledgeBase.instance = this;
  }

  initializeRules() {
    return {
      // Risk assessment rules
      riskRules: [
        {
          id: 'R001',
          name: 'High Impact Database Change',
          condition: (change) => {
            return change.category === 'database' &&
                   change.impactAssessment.scope === 'high';
          },
          action: (change) => {
            change.riskAssessment.overallRisk = 'high';
            change.compliance.changeAdvisoryBoard = true;
            return 'Elevated to high risk due to database scope';
          }
        },
        {
          id: 'R002',
          name: 'Emergency Change Risk Override',
          condition: (change) => {
            return change.type === 'emergency' &&
                   change.riskAssessment.overallRisk !== 'critical';
          },
          action: (change) => {
            return 'Emergency change - expedited approval process';
          }
        },
        {
          id: 'R003',
          name: 'Production Downtime Required',
          condition: (change) => {
            return change.impactAssessment.downtime.required &&
                   change.impactAssessment.downtime.duration > 60;
          },
          action: (change) => {
            change.priority = 'high';
            change.compliance.changeAdvisoryBoard = true;
            return 'Requires CAB approval due to extended downtime';
          }
        },
        {
          id: 'R004',
          name: 'Security Impact Assessment',
          condition: (change) => {
            return change.category === 'security' ||
                   change.impactAssessment.securityImpact;
          },
          action: (change) => {
            change.compliance.securityReview = true;
            change.riskAssessment.securityRisk = 'high';
            return 'Security review required';
          }
        },
        {
          id: 'R005',
          name: 'Compliance Framework Impact',
          condition: (change) => {
            return change.impactAssessment.complianceImpact ||
                   change.compliance.complianceFrameworks.length > 0;
          },
          action: (change) => {
            change.compliance.regulatoryApproval = true;
            return 'Regulatory compliance review required';
          }
        }
      ],

      // Approval workflow rules
      approvalRules: [
        {
          id: 'A001',
          name: 'Standard Change Fast Track',
          condition: (change) => {
            return change.type === 'standard' &&
                   change.riskAssessment.overallRisk === 'low';
          },
          approvers: ['team_lead'],
          sla: 24 // hours
        },
        {
          id: 'A002',
          name: 'High Risk Approval Chain',
          condition: (change) => {
            return change.riskAssessment.overallRisk === 'high' ||
                   change.riskAssessment.overallRisk === 'critical';
          },
          approvers: ['team_lead', 'manager', 'director', 'cab'],
          sla: 72
        },
        {
          id: 'A003',
          name: 'Emergency Change Approval',
          condition: (change) => {
            return change.type === 'emergency';
          },
          approvers: ['manager', 'incident_commander'],
          sla: 4,
          postImplementationReview: true
        }
      ],

      // Implementation timing rules
      timingRules: [
        {
          id: 'T001',
          name: 'Production Change Window',
          condition: (change) => {
            return change.impactAssessment.scope !== 'low';
          },
          recommendation: 'Schedule during maintenance window (Sat 2-6 AM)',
          blackoutPeriods: ['month_end', 'quarter_end', 'year_end', 'peak_business_hours']
        },
        {
          id: 'T002',
          name: 'Change Freeze Period',
          condition: (change) => {
            const now = new Date();
            const month = now.getMonth();
            const date = now.getDate();
            // Holiday freeze
            return (month === 11 && date > 15) || (month === 0 && date < 7);
          },
          recommendation: 'Avoid non-emergency changes during holiday freeze',
          override: 'emergency'
        }
      ]
    };
  }

  initializePatterns() {
    return [
      {
        id: 'P001',
        name: 'Successful Database Migration Pattern',
        scenario: 'Database schema change with zero downtime',
        steps: [
          'Create backup of current database',
          'Deploy backward-compatible schema changes',
          'Update application to use new schema',
          'Verify data integrity',
          'Remove deprecated columns/tables after validation period'
        ],
        successRate: 0.95,
        avgDuration: 120, // minutes
        risks: ['data_loss', 'application_compatibility'],
        mitigations: ['automated_testing', 'canary_deployment', 'feature_flags']
      },
      {
        id: 'P002',
        name: 'Infrastructure Scaling Pattern',
        scenario: 'Horizontal scaling of production services',
        steps: [
          'Monitor current load and performance metrics',
          'Provision new instances',
          'Configure load balancer',
          'Gradually route traffic to new instances',
          'Monitor for errors or performance degradation',
          'Rollback if thresholds exceeded'
        ],
        successRate: 0.98,
        avgDuration: 60,
        risks: ['configuration_drift', 'network_issues'],
        mitigations: ['infrastructure_as_code', 'automated_health_checks', 'gradual_rollout']
      },
      {
        id: 'P003',
        name: 'Security Patch Deployment Pattern',
        scenario: 'Critical security patch to production systems',
        steps: [
          'Assess patch impact and compatibility',
          'Test patch in non-production environment',
          'Schedule maintenance window',
          'Create system snapshot/backup',
          'Apply patch with automated rollback capability',
          'Verify security vulnerability is resolved',
          'Monitor system stability'
        ],
        successRate: 0.92,
        avgDuration: 90,
        risks: ['system_instability', 'dependency_conflicts'],
        mitigations: ['phased_rollout', 'automated_testing', 'rollback_automation']
      },
      {
        id: 'P004',
        name: 'Application Release Pattern',
        scenario: 'New feature release to production',
        steps: [
          'Complete code review and testing',
          'Deploy to staging environment',
          'Run automated test suite',
          'Perform smoke tests',
          'Deploy using blue-green or canary strategy',
          'Monitor key metrics and error rates',
          'Gradually increase traffic',
          'Rollback if error threshold exceeded'
        ],
        successRate: 0.94,
        avgDuration: 45,
        risks: ['regression', 'performance_degradation', 'user_impact'],
        mitigations: ['feature_flags', 'automated_monitoring', 'quick_rollback']
      }
    ];
  }

  initializeBestPractices() {
    return {
      planning: [
        'Always document the business justification for the change',
        'Identify all stakeholders and affected systems upfront',
        'Create detailed implementation and rollback plans',
        'Establish clear success criteria and validation steps',
        'Schedule changes during appropriate maintenance windows'
      ],
      riskManagement: [
        'Assess technical, business, and security risks separately',
        'Develop mitigation strategies for identified risks',
        'Always have a tested rollback plan',
        'Consider the blast radius of potential failures',
        'Use phased rollouts for high-risk changes'
      ],
      communication: [
        'Notify all affected stakeholders in advance',
        'Provide clear status updates throughout implementation',
        'Document all decisions and their rationale',
        'Conduct post-implementation reviews',
        'Share lessons learned with the broader team'
      ],
      testing: [
        'Test changes in non-production environments first',
        'Include automated regression testing',
        'Validate rollback procedures before implementation',
        'Perform security testing for infrastructure changes',
        'Monitor key metrics during and after deployment'
      ],
      compliance: [
        'Follow regulatory requirements (SOX, HIPAA, PCI-DSS, etc.)',
        'Maintain audit trails of all changes',
        'Get required approvals before implementation',
        'Document compliance validation steps',
        'Retain change records per retention policies'
      ]
    };
  }

  initializeRiskFactors() {
    return {
      technical: [
        { factor: 'complexity', weight: 0.3, description: 'Technical complexity of the change' },
        { factor: 'dependencies', weight: 0.2, description: 'Number of system dependencies' },
        { factor: 'testing', weight: 0.25, description: 'Extent of testing performed' },
        { factor: 'automation', weight: 0.15, description: 'Level of deployment automation' },
        { factor: 'rollback', weight: 0.1, description: 'Rollback plan completeness' }
      ],
      business: [
        { factor: 'user_impact', weight: 0.35, description: 'Number of users affected' },
        { factor: 'downtime', weight: 0.3, description: 'Required downtime duration' },
        { factor: 'revenue_impact', weight: 0.2, description: 'Potential revenue at risk' },
        { factor: 'reputation', weight: 0.15, description: 'Brand/reputation risk' }
      ],
      security: [
        { factor: 'data_exposure', weight: 0.35, description: 'Risk of data exposure' },
        { factor: 'authentication', weight: 0.25, description: 'Changes to auth mechanisms' },
        { factor: 'encryption', weight: 0.2, description: 'Impact on encryption' },
        { factor: 'access_control', weight: 0.2, description: 'Changes to access controls' }
      ]
    };
  }

  initializeApprovalMatrix() {
    return {
      low: {
        risk: 'low',
        impact: 'low',
        approvers: ['team_lead'],
        notifications: ['team'],
        sla: 24,
        cab: false
      },
      medium: {
        risk: 'medium',
        impact: 'medium',
        approvers: ['team_lead', 'manager'],
        notifications: ['team', 'stakeholders'],
        sla: 48,
        cab: false
      },
      high: {
        risk: 'high',
        impact: 'high',
        approvers: ['team_lead', 'manager', 'director'],
        notifications: ['team', 'stakeholders', 'executives'],
        sla: 72,
        cab: true
      },
      critical: {
        risk: 'critical',
        impact: 'enterprise-wide',
        approvers: ['team_lead', 'manager', 'director', 'cto', 'cab'],
        notifications: ['all_staff'],
        sla: 96,
        cab: true,
        additionalReviews: ['security', 'compliance', 'architecture']
      }
    };
  }

  // Query methods
  findApplicableRules(change, ruleType = 'riskRules') {
    return this.rules[ruleType].filter(rule => rule.condition(change));
  }

  findMatchingPattern(changeDescription) {
    return this.patterns.filter(pattern => {
      const keywords = pattern.scenario.toLowerCase().split(' ');
      const desc = changeDescription.toLowerCase();
      return keywords.some(keyword => desc.includes(keyword));
    });
  }

  getApprovalRequirements(change) {
    const riskLevel = change.riskAssessment.overallRisk;
    return this.approvalMatrix[riskLevel] || this.approvalMatrix.medium;
  }

  getRiskFactors(category) {
    return this.riskFactors[category] || [];
  }

  getBestPractices(category) {
    return this.bestPractices[category] || [];
  }
}

module.exports = KnowledgeBase;
