/**
 * Change Management Service
 * Main service coordinating expert system and AgentDB
 */

const ChangeRequest = require('../models/ChangeRequest');
const ExpertEngine = require('../rules/ExpertEngine');
const AgentDBService = require('./AgentDBService');

class ChangeManagementService {
  constructor(dbPath = './change-management.db') {
    this.expertEngine = new ExpertEngine();
    this.agentDB = new AgentDBService(dbPath);
    this.changes = new Map(); // In-memory storage for demo
  }

  /**
   * Create a new change request
   */
  async createChange(changeData) {
    const change = new ChangeRequest(changeData);

    // Validate
    const validation = change.validate();
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // Store in memory
    this.changes.set(change.id, change);

    // Get initial analysis
    const analysis = this.expertEngine.analyze(change);

    return {
      success: true,
      change: change.toJSON(),
      analysis
    };
  }

  /**
   * Analyze a change request using expert system
   */
  async analyzeChange(changeId) {
    const change = this.changes.get(changeId);
    if (!change) {
      return { success: false, error: 'Change not found' };
    }

    // Run expert system analysis
    const analysis = this.expertEngine.analyze(change);

    // Retrieve similar past changes from AgentDB
    const similar = await this.agentDB.retrieveSimilarChanges(change, 5);

    // Query relevant causal relationships
    const causalEdges = await this.agentDB.queryCausalEdges(
      change.category,
      null,
      0.7
    );

    // Search for applicable skills
    const skills = await this.agentDB.searchSkills(
      `${change.category} ${change.type} change`,
      5
    );

    return {
      success: true,
      analysis,
      similarChanges: similar.episodes || [],
      causalInsights: causalEdges.edges || [],
      applicableSkills: skills.skills || []
    };
  }

  /**
   * Get expert recommendation for a change
   */
  async getRecommendation(changeId) {
    const change = this.changes.get(changeId);
    if (!change) {
      return { success: false, error: 'Change not found' };
    }

    const decision = this.expertEngine.makeDecision(change);

    return {
      success: true,
      decision
    };
  }

  /**
   * Update change status
   */
  async updateChangeStatus(changeId, newStatus, user, reason = '') {
    const change = this.changes.get(changeId);
    if (!change) {
      return { success: false, error: 'Change not found' };
    }

    change.updateStatus(newStatus, user, reason);

    return {
      success: true,
      change: change.toJSON()
    };
  }

  /**
   * Record change outcome and learn from it
   */
  async recordOutcome(changeId, outcome) {
    const change = this.changes.get(changeId);
    if (!change) {
      return { success: false, error: 'Change not found' };
    }

    // Update change record
    change.actualOutcome = outcome;
    change.updateStatus('completed', outcome.completedBy);

    // Generate critique
    const critique = this.generateCritique(change, outcome);

    // Store episode in AgentDB for learning
    await this.agentDB.storeChangeEpisode(change, outcome, critique);

    // If successful, check if this should become a causal edge
    if (outcome.success && outcome.reward > 0.8) {
      const cause = `${change.category}_${change.type}_change`;
      const effect = 'successful_implementation';
      await this.agentDB.addCausalEdge(cause, effect, 0.1, 0.85, 1);
    }

    return {
      success: true,
      change: change.toJSON(),
      critique
    };
  }

  /**
   * Generate critique from outcome
   */
  generateCritique(change, outcome) {
    const critiques = [];

    if (!outcome.success) {
      critiques.push('Change implementation failed');
      if (outcome.issues && outcome.issues.length > 0) {
        critiques.push(`Issues encountered: ${outcome.issues.join(', ')}`);
      }
      if (outcome.rollbackRequired) {
        critiques.push('Rollback was required');
      }
    } else {
      critiques.push('Change implemented successfully');
    }

    // Duration analysis
    if (outcome.duration && change.implementation.estimatedDuration) {
      const ratio = outcome.duration / change.implementation.estimatedDuration;
      if (ratio > 1.5) {
        critiques.push('Implementation took significantly longer than estimated');
      } else if (ratio < 0.8) {
        critiques.push('Implementation completed faster than estimated');
      }
    }

    // Risk analysis
    if (change.riskAssessment.overallRisk === 'high' && outcome.success && !outcome.rollbackRequired) {
      critiques.push('High-risk change completed successfully - good risk management');
    }

    return critiques.join('. ');
  }

  /**
   * Search for changes
   */
  async searchChanges(query, filters = {}) {
    let results = Array.from(this.changes.values());

    // Apply filters
    if (filters.status) {
      results = results.filter(c => c.status === filters.status);
    }
    if (filters.type) {
      results = results.filter(c => c.type === filters.type);
    }
    if (filters.category) {
      results = results.filter(c => c.category === filters.category);
    }
    if (filters.priority) {
      results = results.filter(c => c.priority === filters.priority);
    }

    // Text search in title and description
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(c =>
        c.title.toLowerCase().includes(queryLower) ||
        c.description.toLowerCase().includes(queryLower)
      );
    }

    return {
      success: true,
      results: results.map(c => c.toJSON())
    };
  }

  /**
   * Get change by ID
   */
  getChange(changeId) {
    const change = this.changes.get(changeId);
    if (!change) {
      return { success: false, error: 'Change not found' };
    }

    return {
      success: true,
      change: change.toJSON()
    };
  }

  /**
   * Run learner to discover patterns
   */
  async discoverPatterns() {
    return await this.agentDB.runLearner(3, 0.6, 0.7);
  }

  /**
   * Consolidate successful changes into skills
   */
  async consolidateSkills() {
    return await this.agentDB.consolidateSkills(3, 0.7, 7);
  }

  /**
   * Get system statistics
   */
  async getStatistics() {
    const totalChanges = this.changes.size;
    const byStatus = {};
    const byType = {};
    const byCategory = {};
    const byRisk = {};

    for (const change of this.changes.values()) {
      // By status
      byStatus[change.status] = (byStatus[change.status] || 0) + 1;
      // By type
      byType[change.type] = (byType[change.type] || 0) + 1;
      // By category
      byCategory[change.category] = (byCategory[change.category] || 0) + 1;
      // By risk
      byRisk[change.riskAssessment.overallRisk] = (byRisk[change.riskAssessment.overallRisk] || 0) + 1;
    }

    const agentDBStats = await this.agentDB.getStats();

    return {
      success: true,
      statistics: {
        totalChanges,
        byStatus,
        byType,
        byCategory,
        byRisk,
        agentDB: agentDBStats.stats
      }
    };
  }

  /**
   * Export all data
   */
  async exportData(outputFile) {
    const data = {
      changes: Array.from(this.changes.values()).map(c => c.toJSON()),
      exportDate: new Date().toISOString()
    };

    const fs = require('fs');
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

    // Also export AgentDB
    await this.agentDB.exportDatabase(outputFile + '.agentdb.json.gz');

    return { success: true, file: outputFile };
  }

  /**
   * Import data
   */
  async importData(inputFile) {
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

    for (const changeData of data.changes) {
      const change = new ChangeRequest(changeData);
      this.changes.set(change.id, change);
    }

    // Import AgentDB if exists
    try {
      await this.agentDB.importDatabase(inputFile + '.agentdb.json.gz');
    } catch (error) {
      // AgentDB export might not exist
    }

    return {
      success: true,
      imported: data.changes.length
    };
  }
}

module.exports = ChangeManagementService;
