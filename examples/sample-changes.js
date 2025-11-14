/**
 * Sample Change Requests for Testing and Demonstration
 */

module.exports = {
  // Low-risk standard change
  databaseIndexCreation: {
    title: 'Add database index to improve query performance on orders table',
    description: 'Create a composite index on orders table (customer_id, order_date) to optimize the customer order history queries that are currently taking 3-5 seconds. This change has been tested in staging with a 90% performance improvement. The index creation will be done online without downtime.',
    type: 'standard',
    category: 'database',
    priority: 'medium',
    requestor: {
      name: 'Sarah Chen',
      email: 'sarah.chen@example.com',
      department: 'Database Administration'
    },
    impactAssessment: {
      scope: 'low',
      affectedSystems: ['orders-db', 'customer-portal'],
      affectedUsers: 5000,
      downtime: { required: false, duration: 0, unit: 'minutes' },
      dataImpact: false,
      securityImpact: false,
      complianceImpact: false
    },
    riskAssessment: {
      overallRisk: 'low',
      technicalRisk: 'low',
      businessRisk: 'low',
      securityRisk: 'low',
      mitigationPlan: 'Index will be created online. Rollback is dropping the index if needed.',
      rollbackPlan: 'DROP INDEX orders_customer_date_idx; -- Execution time < 1 second'
    },
    implementation: {
      steps: [
        'Verify staging environment matches production schema',
        'Run EXPLAIN ANALYZE on target queries to establish baseline',
        'Execute CREATE INDEX CONCURRENTLY orders_customer_date_idx',
        'Monitor index creation progress',
        'Verify index is being used by query planner',
        'Run performance tests',
        'Document results'
      ],
      estimatedDuration: 30,
      verificationSteps: [
        'Check pg_stat_user_indexes for index usage',
        'Run sample queries and verify <500ms response time',
        'Monitor database CPU and I/O for 1 hour'
      ],
      rollbackSteps: [
        'Drop the newly created index',
        'Verify query performance returns to baseline'
      ]
    }
  },

  // High-risk infrastructure change
  productionMigration: {
    title: 'Migrate production database cluster to new hardware and upgrade PostgreSQL version',
    description: 'Migrate the main production database cluster from current hardware (3 years old, end of life) to new high-performance servers. This includes upgrading PostgreSQL from 12.10 to 15.3, implementing improved replication topology, and moving to NVMe storage. This is a critical infrastructure change affecting all production services. Estimated downtime: 2-3 hours during Saturday maintenance window.',
    type: 'standard',
    category: 'infrastructure',
    priority: 'high',
    requestor: {
      name: 'Michael Rodriguez',
      email: 'michael.rodriguez@example.com',
      department: 'Infrastructure Engineering'
    },
    impactAssessment: {
      scope: 'enterprise-wide',
      affectedSystems: ['database-cluster', 'web-services', 'api-gateway', 'mobile-backend', 'analytics-pipeline', 'reporting-system'],
      affectedUsers: 50000,
      downtime: { required: true, duration: 180, unit: 'minutes' },
      dataImpact: true,
      securityImpact: false,
      complianceImpact: true
    },
    riskAssessment: {
      overallRisk: 'high',
      technicalRisk: 'high',
      businessRisk: 'high',
      securityRisk: 'medium',
      mitigationPlan: 'Full database backup before migration. Phased cutover with validation at each step. Parallel old system kept online for 24h. Comprehensive testing in staging with production data clone. Network connectivity pre-validated. Rollback procedure tested and documented.',
      rollbackPlan: '1) Stop all services, 2) Restore DNS to old cluster, 3) Restart services, 4) Verify connectivity and data consistency, 5) Total rollback time: 30 minutes'
    },
    implementation: {
      steps: [
        'T-7 days: Final backup verification and rollback testing',
        'T-24h: Freeze schema changes, create final backup',
        'T-4h: Enable maintenance mode, stop write traffic',
        'T-3h: Final consistency check and backup',
        'T-2.5h: Begin data migration to new cluster',
        'T-1.5h: Start PostgreSQL 15 on new cluster',
        'T-1h: Run pg_upgrade verification',
        'T-45m: Configure replication topology',
        'T-30m: Run smoke tests on new cluster',
        'T-15m: Update DNS and load balancer configuration',
        'T-10m: Start services pointing to new cluster',
        'T-5m: Monitor application health and database performance',
        'T+0: Disable maintenance mode',
        'T+1h: Extended monitoring period',
        'T+24h: Decommission old cluster if stable'
      ],
      estimatedDuration: 180,
      verificationSteps: [
        'Verify all application services are healthy',
        'Check database replication lag < 100ms',
        'Run automated test suite (5000+ tests)',
        'Verify key business transactions (orders, payments, user login)',
        'Check error rates and latency metrics',
        'Validate backup restoration procedure'
      ],
      rollbackSteps: [
        'Activate rollback procedure within 30-minute decision window',
        'Enable maintenance mode',
        'Stop all services',
        'Revert DNS to old cluster',
        'Verify old cluster is current',
        'Restart services',
        'Run verification suite',
        'Disable maintenance mode',
        'Conduct post-rollback analysis'
      ]
    },
    compliance: {
      changeAdvisoryBoard: true,
      regulatoryApproval: false,
      securityReview: true,
      architectureReview: true,
      complianceFrameworks: ['SOX']
    },
    successCriteria: [
      'Zero data loss',
      'All services operational within 3 hours',
      'No increase in error rates',
      'Query performance improved or maintained',
      'Successful backup and restoration verified'
    ]
  },

  // Emergency security patch
  securityPatch: {
    title: 'Emergency: Apply critical security patch CVE-2024-12345 to authentication service',
    description: 'Critical vulnerability discovered in OAuth2 authentication library allowing potential authentication bypass. CVSS score: 9.8. Vendor patch available. This vulnerability could allow attackers to bypass authentication and gain unauthorized access to user accounts. No active exploitation detected yet but vulnerability is publicly disclosed. Immediate patching required.',
    type: 'emergency',
    category: 'security',
    priority: 'critical',
    requestor: {
      name: 'Alex Thompson',
      email: 'alex.thompson@example.com',
      department: 'Security Operations'
    },
    impactAssessment: {
      scope: 'high',
      affectedSystems: ['auth-service', 'api-gateway', 'mobile-backend'],
      affectedUsers: 50000,
      downtime: { required: true, duration: 15, unit: 'minutes' },
      dataImpact: false,
      securityImpact: true,
      complianceImpact: true
    },
    riskAssessment: {
      overallRisk: 'critical',
      technicalRisk: 'medium',
      businessRisk: 'critical',
      securityRisk: 'critical',
      mitigationPlan: 'Deploy WAF rules to block known exploit patterns. Enable additional authentication logging. Implement rate limiting on authentication endpoints. Have incident response team on standby.',
      rollbackPlan: 'Revert to previous version if patch causes authentication failures. Estimated rollback time: 5 minutes.'
    },
    implementation: {
      steps: [
        'Deploy WAF rules immediately as temporary mitigation',
        'Test patch in isolated environment (15 minutes)',
        'Prepare rollback package',
        'Schedule emergency maintenance window (immediate)',
        'Deploy patch to authentication service',
        'Restart services with health checks',
        'Verify authentication flows',
        'Monitor for errors and anomalies',
        'Conduct security verification',
        'Remove temporary WAF rules if patch successful'
      ],
      estimatedDuration: 45,
      verificationSteps: [
        'Verify authentication service health',
        'Test user login flows (web, mobile, API)',
        'Check OAuth2 token generation and validation',
        'Verify SSO integration',
        'Run security scanner to confirm vulnerability is patched',
        'Review authentication logs for anomalies'
      ],
      rollbackSteps: [
        'Revert to previous version',
        'Restart services',
        'Verify authentication functionality',
        'Keep WAF rules active',
        'Escalate to vendor for support'
      ]
    },
    compliance: {
      changeAdvisoryBoard: false, // Emergency bypass
      regulatoryApproval: false,
      securityReview: true,
      architectureReview: false,
      complianceFrameworks: ['PCI-DSS', 'SOX']
    }
  },

  // Application feature release
  featureRelease: {
    title: 'Release new customer dashboard with real-time analytics',
    description: 'Deploy new customer dashboard feature that provides real-time analytics and insights. This includes frontend updates, new API endpoints, database schema changes, and integration with analytics pipeline. Feature has been in development for 3 months with comprehensive testing. Using blue-green deployment strategy with gradual rollout.',
    type: 'standard',
    category: 'application',
    priority: 'medium',
    requestor: {
      name: 'Emily Watson',
      email: 'emily.watson@example.com',
      department: 'Product Engineering'
    },
    impactAssessment: {
      scope: 'medium',
      affectedSystems: ['web-frontend', 'api-service', 'analytics-pipeline', 'postgres-db'],
      affectedUsers: 10000,
      downtime: { required: false, duration: 0, unit: 'minutes' },
      dataImpact: false,
      securityImpact: false,
      complianceImpact: false
    },
    riskAssessment: {
      overallRisk: 'medium',
      technicalRisk: 'medium',
      businessRisk: 'low',
      securityRisk: 'low',
      mitigationPlan: 'Blue-green deployment with feature flags. Gradual rollout starting at 5%, then 25%, 50%, 100%. Automated rollback if error rate exceeds threshold. Comprehensive monitoring and alerting.',
      rollbackPlan: 'Toggle feature flag to disable new dashboard. Revert to previous version if needed. Database schema is backward compatible.'
    },
    implementation: {
      steps: [
        'Deploy database schema changes (backward compatible)',
        'Deploy new API version to staging environment',
        'Run automated test suite',
        'Deploy to production with feature flag disabled',
        'Enable feature flag for internal users (5%)',
        'Monitor for 2 hours',
        'Increase to 25% of users',
        'Monitor for 4 hours',
        'Increase to 50% of users',
        'Monitor for 8 hours',
        'Enable for 100% of users',
        'Remove feature flag code after 7 days'
      ],
      estimatedDuration: 60,
      verificationSteps: [
        'Verify dashboard loads correctly',
        'Check real-time data updates',
        'Validate API response times < 200ms',
        'Verify analytics pipeline integration',
        'Check error rates',
        'Review user feedback and support tickets'
      ],
      rollbackSteps: [
        'Disable feature flag',
        'Verify old dashboard is functional',
        'If needed, revert API deployment',
        'Analyze issues and create fix plan'
      ]
    },
    successCriteria: [
      'Feature successfully deployed to all users',
      'Error rate < 0.1%',
      'API response time < 200ms p95',
      'No increase in support tickets',
      'Positive user feedback > 80%'
    ]
  },

  // Network infrastructure change
  networkUpgrade: {
    title: 'Upgrade datacenter network switches and implement new VLAN segmentation',
    description: 'Replace aging network switches in primary datacenter and implement new VLAN segmentation for improved security and performance. This includes upgrading from 10Gb to 40Gb links, implementing microsegmentation for PCI compliance, and updating firewall rules. Work will be performed during maintenance window with partial service failover to secondary datacenter.',
    type: 'standard',
    category: 'network',
    priority: 'high',
    requestor: {
      name: 'David Park',
      email: 'david.park@example.com',
      department: 'Network Operations'
    },
    impactAssessment: {
      scope: 'high',
      affectedSystems: ['all-datacenter-services', 'network-infrastructure', 'storage-systems', 'compute-clusters'],
      affectedUsers: 50000,
      downtime: { required: true, duration: 120, unit: 'minutes' },
      dataImpact: false,
      securityImpact: true,
      complianceImpact: true
    },
    riskAssessment: {
      overallRisk: 'high',
      technicalRisk: 'high',
      businessRisk: 'medium',
      securityRisk: 'medium',
      mitigationPlan: 'Failover traffic to secondary datacenter during maintenance. Staged switch replacement one at a time. Pre-configured VLANs and firewall rules. Network validation at each step. Rollback to old configuration if issues detected.',
      rollbackPlan: 'Restore old switch configuration from backup. Reconnect old switches if new hardware has issues. Maximum rollback time: 45 minutes.'
    },
    implementation: {
      steps: [
        'T-7 days: Configure and test new switches in lab',
        'T-48h: Begin traffic shift to secondary datacenter',
        'T-24h: Verify secondary datacenter handling full load',
        'T-4h: Final backup of network configurations',
        'T-2h: Replace core switch #1',
        'T-1.5h: Verify connectivity and routing',
        'T-1h: Replace core switch #2',
        'T-30m: Verify redundancy and failover',
        'T-15m: Implement new VLAN configuration',
        'T-10m: Update firewall rules',
        'T-5m: Run network validation tests',
        'T+0: Begin traffic shift back to primary datacenter',
        'T+30m: Verify all services operational',
        'T+2h: Extended monitoring period'
      ],
      estimatedDuration: 120,
      verificationSteps: [
        'Verify all network paths are operational',
        'Check routing tables and BGP peering',
        'Validate VLAN segmentation',
        'Test inter-VLAN routing and firewall rules',
        'Verify storage network performance',
        'Check application connectivity',
        'Run network performance tests'
      ],
      rollbackSteps: [
        'Stop traffic migration',
        'Restore old switch configuration',
        'If needed, physically reconnect old switches',
        'Verify network connectivity',
        'Run validation tests',
        'Keep traffic on secondary datacenter until stable'
      ]
    },
    compliance: {
      changeAdvisoryBoard: true,
      regulatoryApproval: false,
      securityReview: true,
      architectureReview: true,
      complianceFrameworks: ['PCI-DSS', 'SOX']
    }
  }
};
