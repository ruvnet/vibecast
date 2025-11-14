/**
 * AgentDB Integration Service
 * Handles all interactions with the AgentDB database
 */

const { execSync } = require('child_process');
const path = require('path');

class AgentDBService {
  constructor(dbPath = './change-management.db') {
    this.dbPath = dbPath;
    this.domain = 'enterprise-change-management';
  }

  /**
   * Store a change request episode in AgentDB for learning
   */
  async storeChangeEpisode(changeRequest, outcome, critique = '') {
    const sessionId = `change-${changeRequest.id}`;
    const task = `${changeRequest.category}-${changeRequest.type}-change`;

    // Calculate reward based on outcome
    const reward = this.calculateReward(changeRequest, outcome);
    const success = outcome.success || false;

    // Prepare episode data
    const input = JSON.stringify({
      type: changeRequest.type,
      category: changeRequest.category,
      priority: changeRequest.priority,
      riskLevel: changeRequest.riskAssessment.overallRisk,
      impactScope: changeRequest.impactAssessment.scope,
      affectedSystems: changeRequest.impactAssessment.affectedSystems.length,
      downtime: changeRequest.impactAssessment.downtime.required
    });

    const output = JSON.stringify({
      success: outcome.success,
      duration: outcome.duration,
      issues: outcome.issues || [],
      rollbackRequired: outcome.rollbackRequired || false
    });

    const latency = outcome.duration || 0;
    const tokens = JSON.stringify(changeRequest).length;

    // Store in reflexion memory
    const cmd = `npx agentdb reflexion store "${sessionId}" "${task}" ${reward} ${success} "${critique}" '${input}' '${output}' ${latency} ${tokens}`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, result };
    } catch (error) {
      console.error('Failed to store episode:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve similar past change requests
   */
  async retrieveSimilarChanges(changeRequest, k = 5) {
    const task = `${changeRequest.category}-${changeRequest.type}-change`;

    const cmd = `npx agentdb reflexion retrieve "${task}" --k ${k} --synthesize-context`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });

      return { success: true, episodes: JSON.parse(result) };
    } catch (error) {
      console.error('Failed to retrieve episodes:', error.message);
      return { success: false, error: error.message, episodes: [] };
    }
  }

  /**
   * Store a reusable skill from successful changes
   */
  async storeSkill(name, description, code, metadata = {}) {
    const codeJson = JSON.stringify(code).replace(/'/g, "\\'");
    const cmd = `npx agentdb skill create "${name}" "${description}" '${codeJson}'`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, result };
    } catch (error) {
      console.error('Failed to store skill:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search for applicable skills
   */
  async searchSkills(query, k = 5) {
    const cmd = `npx agentdb skill search "${query}" ${k}`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, skills: JSON.parse(result) };
    } catch (error) {
      console.error('Failed to search skills:', error.message);
      return { success: false, error: error.message, skills: [] };
    }
  }

  /**
   * Add causal relationship between change characteristics and outcomes
   */
  async addCausalEdge(cause, effect, uplift, confidence = 0.8, sampleSize = 10) {
    const cmd = `npx agentdb causal add-edge "${cause}" "${effect}" ${uplift} ${confidence} ${sampleSize}`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, result };
    } catch (error) {
      console.error('Failed to add causal edge:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Query causal relationships
   */
  async queryCausalEdges(cause = null, effect = null, minConfidence = 0.7) {
    let cmd = 'npx agentdb causal query';
    if (cause) cmd += ` "${cause}"`;
    if (effect) cmd += ` "${effect}"`;
    cmd += ` ${minConfidence}`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, edges: JSON.parse(result) };
    } catch (error) {
      console.error('Failed to query causal edges:', error.message);
      return { success: false, error: error.message, edges: [] };
    }
  }

  /**
   * Run learner to discover patterns
   */
  async runLearner(minAttempts = 3, minSuccessRate = 0.6, minConfidence = 0.7) {
    const cmd = `npx agentdb learner run ${minAttempts} ${minSuccessRate} ${minConfidence}`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, result };
    } catch (error) {
      console.error('Failed to run learner:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Consolidate skills from successful episodes
   */
  async consolidateSkills(minAttempts = 3, minReward = 0.7, timeWindowDays = 7) {
    const cmd = `npx agentdb skill consolidate ${minAttempts} ${minReward} ${timeWindowDays} true`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, result };
    } catch (error) {
      console.error('Failed to consolidate skills:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const cmd = 'npx agentdb db stats';

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, stats: result };
    } catch (error) {
      console.error('Failed to get stats:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Store a pattern for future retrieval
   */
  async storePattern(type, domain, pattern, confidence) {
    const patternJson = JSON.stringify(pattern).replace(/'/g, "\\'");
    const cmd = `npx agentdb store-pattern --type "${type}" --domain "${domain}" --pattern '${patternJson}' --confidence ${confidence}`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, result };
    } catch (error) {
      console.error('Failed to store pattern:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Query stored patterns
   */
  async queryPatterns(query, k = 5, minConfidence = 0.7) {
    const cmd = `npx agentdb query --query "${query}" --domain "${this.domain}" --k ${k} --min-confidence ${minConfidence} --synthesize-context --format json`;

    try {
      const result = execSync(cmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8'
      });
      return { success: true, patterns: JSON.parse(result) };
    } catch (error) {
      console.error('Failed to query patterns:', error.message);
      return { success: false, error: error.message, patterns: [] };
    }
  }

  /**
   * Calculate reward based on change outcome
   */
  calculateReward(changeRequest, outcome) {
    let reward = 0.5; // Base reward

    // Success bonus
    if (outcome.success) {
      reward += 0.3;
    }

    // No rollback bonus
    if (!outcome.rollbackRequired) {
      reward += 0.1;
    }

    // On-time completion bonus
    if (outcome.duration && changeRequest.implementation.estimatedDuration) {
      const ratio = outcome.duration / changeRequest.implementation.estimatedDuration;
      if (ratio <= 1.0) {
        reward += 0.1;
      }
    }

    // No issues bonus
    if (!outcome.issues || outcome.issues.length === 0) {
      reward += 0.1;
    }

    // Risk level adjustment (higher risk successful changes get more reward)
    const riskBonus = {
      low: 0.0,
      medium: 0.05,
      high: 0.1,
      critical: 0.15
    };
    reward += riskBonus[changeRequest.riskAssessment.overallRisk] || 0;

    return Math.min(reward, 1.0);
  }

  /**
   * Export database
   */
  async exportDatabase(outputFile) {
    const cmd = `npx agentdb export ${this.dbPath} ${outputFile} --compress`;

    try {
      const result = execSync(cmd, {
        encoding: 'utf-8'
      });
      return { success: true, result };
    } catch (error) {
      console.error('Failed to export database:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import database
   */
  async importDatabase(inputFile) {
    const cmd = `npx agentdb import ${inputFile} ${this.dbPath} --decompress`;

    try {
      const result = execSync(cmd, {
        encoding: 'utf-8'
      });
      return { success: true, result };
    } catch (error) {
      console.error('Failed to import database:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = AgentDBService;
