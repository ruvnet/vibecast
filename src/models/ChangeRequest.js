/**
 * Change Request Domain Model
 * Represents an enterprise change request with full lifecycle tracking
 */

class ChangeRequest {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.title = data.title || '';
    this.description = data.description || '';
    this.type = data.type || 'standard'; // standard, emergency, normal, expedited
    this.category = data.category || 'infrastructure'; // infrastructure, application, database, network, security
    this.priority = data.priority || 'medium'; // low, medium, high, critical
    this.status = data.status || 'draft'; // draft, submitted, reviewing, approved, scheduled, implementing, completed, rejected, cancelled, rollback
    this.requestor = data.requestor || {};
    this.implementer = data.implementer || null;
    this.approvers = data.approvers || [];
    this.reviewers = data.reviewers || [];

    // Impact assessment
    this.impactAssessment = data.impactAssessment || {
      scope: 'low', // low, medium, high, enterprise-wide
      affectedSystems: [],
      affectedUsers: 0,
      downtime: { required: false, duration: 0, unit: 'minutes' },
      dataImpact: false,
      securityImpact: false,
      complianceImpact: false
    };

    // Risk assessment
    this.riskAssessment = data.riskAssessment || {
      overallRisk: 'low', // low, medium, high, critical
      technicalRisk: 'low',
      businessRisk: 'low',
      securityRisk: 'low',
      mitigationPlan: '',
      contingencyPlan: '',
      rollbackPlan: ''
    };

    // Implementation details
    this.implementation = data.implementation || {
      steps: [],
      estimatedDuration: 0,
      scheduledStart: null,
      scheduledEnd: null,
      actualStart: null,
      actualEnd: null,
      verificationSteps: [],
      rollbackSteps: []
    };

    // Compliance and governance
    this.compliance = data.compliance || {
      changeAdvisoryBoard: false,
      regulatoryApproval: false,
      securityReview: false,
      architectureReview: false,
      complianceFrameworks: [] // ITIL, COBIT, SOX, HIPAA, etc.
    };

    // Relationships
    this.relatedChanges = data.relatedChanges || [];
    this.dependencies = data.dependencies || [];
    this.conflicts = data.conflicts || [];

    // Tracking
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.history = data.history || [];
    this.comments = data.comments || [];
    this.attachments = data.attachments || [];

    // Success metrics
    this.successCriteria = data.successCriteria || [];
    this.actualOutcome = data.actualOutcome || null;
    this.lessons = data.lessons || [];
  }

  generateId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `CHG-${timestamp}-${random}`;
  }

  validate() {
    const errors = [];

    if (!this.title || this.title.length < 10) {
      errors.push('Title must be at least 10 characters');
    }

    if (!this.description || this.description.length < 50) {
      errors.push('Description must be at least 50 characters');
    }

    if (!['standard', 'emergency', 'normal', 'expedited'].includes(this.type)) {
      errors.push('Invalid change type');
    }

    if (!this.requestor.name || !this.requestor.email) {
      errors.push('Requestor information is incomplete');
    }

    if (this.status === 'scheduled' && !this.implementation.scheduledStart) {
      errors.push('Scheduled changes must have a start date');
    }

    if (this.riskAssessment.overallRisk === 'critical' && !this.riskAssessment.rollbackPlan) {
      errors.push('Critical risk changes must have a rollback plan');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  addHistoryEntry(action, user, details = {}) {
    this.history.push({
      timestamp: new Date().toISOString(),
      action,
      user,
      details
    });
    this.updatedAt = new Date().toISOString();
  }

  addComment(user, text) {
    this.comments.push({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      user,
      text
    });
    this.updatedAt = new Date().toISOString();
  }

  updateStatus(newStatus, user, reason = '') {
    const oldStatus = this.status;
    this.status = newStatus;
    this.addHistoryEntry('status_change', user, {
      from: oldStatus,
      to: newStatus,
      reason
    });
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      type: this.type,
      category: this.category,
      priority: this.priority,
      status: this.status,
      requestor: this.requestor,
      implementer: this.implementer,
      approvers: this.approvers,
      reviewers: this.reviewers,
      impactAssessment: this.impactAssessment,
      riskAssessment: this.riskAssessment,
      implementation: this.implementation,
      compliance: this.compliance,
      relatedChanges: this.relatedChanges,
      dependencies: this.dependencies,
      conflicts: this.conflicts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      history: this.history,
      comments: this.comments,
      attachments: this.attachments,
      successCriteria: this.successCriteria,
      actualOutcome: this.actualOutcome,
      lessons: this.lessons
    };
  }
}

module.exports = ChangeRequest;
