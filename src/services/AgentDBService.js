/**
 * AgentDB Integration Service (Optimized)
 * Handles all interactions with the AgentDB database with caching and error handling
 */

const { execSync } = require('child_process');
const path = require('path');
const { parseAgentDBOutput, isSuccessOutput, SimpleCache } = require('../utils/helpers');

class AgentDBService {
  constructor(dbPath = './change-management.db') {
    this.dbPath = dbPath;
    this.domain = 'enterprise-change-management';
    this.cache = new SimpleCache(300000); // 5 minute cache
    this.suppressWarnings = true; // Suppress non-critical warnings
  }

  /**
   * Execute AgentDB command with optimized error handling
   */
  executeCommand(cmd, options = {}) {
    try {
      // Redirect stderr to /dev/null to suppress warnings if configured
      const fullCmd = this.suppressWarnings ? `${cmd} 2>/dev/null || echo "[]"` : cmd;

      const result = execSync(fullCmd, {
        cwd: path.dirname(this.dbPath),
        encoding: 'utf-8',
        ...options
      });
      return { success: true, output: result };
    } catch (error) {
      // Check if it's just a warning vs actual error
      if (error.stdout && isSuccessOutput(error.stdout)) {
        return { success: true, output: error.stdout };
      }
      return { success: false, error: error.message, output: error.stdout || '' };
    }
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

    const result = this.executeCommand(cmd);

    if (result.success) {
      // Invalidate cache for similar changes
      this.cache.clear();
      return { success: true, result: result.output };
    }

    return { success: false, error: result.error };
  }

  /**
   * Retrieve similar past change requests
   */
  async retrieveSimilarChanges(changeRequest, k = 5) {
    const task = `${changeRequest.category}-${changeRequest.type}-change`;
    const cacheKey = `similar_${task}_${k}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { success: true, episodes: cached, cached: true };
    }

    const cmd = `npx agentdb reflexion retrieve "${task}" --k ${k} --synthesize-context`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      const episodes = parseAgentDBOutput(result.output, []);
      this.cache.set(cacheKey, episodes);
      return { success: true, episodes };
    }

    return { success: false, error: result.error, episodes: [] };
  }

  /**
   * Store a reusable skill from successful changes
   */
  async storeSkill(name, description, code, metadata = {}) {
    const codeJson = JSON.stringify(code).replace(/'/g, "\\'");
    const cmd = `npx agentdb skill create "${name}" "${description}" '${codeJson}'`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      // Invalidate skills cache
      for (const key of Array.from(this.cache.cache.keys())) {
        if (key.startsWith('skills_')) {
          this.cache.cache.delete(key);
        }
      }
      return { success: true, result: result.output };
    }

    return { success: false, error: result.error };
  }

  /**
   * Search for applicable skills
   */
  async searchSkills(query, k = 5) {
    const cacheKey = `skills_${query}_${k}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { success: true, skills: cached, cached: true };
    }

    const cmd = `npx agentdb skill search "${query}" ${k}`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      const skills = parseAgentDBOutput(result.output, []);
      this.cache.set(cacheKey, skills);
      return { success: true, skills };
    }

    return { success: false, error: result.error, skills: [] };
  }

  /**
   * Add causal relationship between change characteristics and outcomes
   */
  async addCausalEdge(cause, effect, uplift, confidence = 0.8, sampleSize = 10) {
    const cmd = `npx agentdb causal add-edge "${cause}" "${effect}" ${uplift} ${confidence} ${sampleSize}`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      // Invalidate causal cache
      for (const key of Array.from(this.cache.cache.keys())) {
        if (key.startsWith('causal_')) {
          this.cache.cache.delete(key);
        }
      }
      return { success: true, result: result.output };
    }

    return { success: false, error: result.error };
  }

  /**
   * Query causal relationships
   */
  async queryCausalEdges(cause = null, effect = null, minConfidence = 0.7) {
    const cacheKey = `causal_${cause}_${effect}_${minConfidence}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { success: true, edges: cached, cached: true };
    }

    let cmd = 'npx agentdb causal query';
    if (cause) cmd += ` "${cause}"`;
    if (effect) cmd += ` "${effect}"`;
    cmd += ` ${minConfidence}`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      const edges = parseAgentDBOutput(result.output, []);
      this.cache.set(cacheKey, edges);
      return { success: true, edges };
    }

    return { success: false, error: result.error, edges: [] };
  }

  /**
   * Run learner to discover patterns
   */
  async runLearner(minAttempts = 3, minSuccessRate = 0.6, minConfidence = 0.7) {
    const cmd = `npx agentdb learner run ${minAttempts} ${minSuccessRate} ${minConfidence}`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      // Invalidate all caches after learning
      this.cache.clear();
      return { success: true, result: result.output };
    }

    return { success: false, error: result.error };
  }

  /**
   * Consolidate skills from successful episodes
   */
  async consolidateSkills(minAttempts = 3, minReward = 0.7, timeWindowDays = 7) {
    const cmd = `npx agentdb skill consolidate ${minAttempts} ${minReward} ${timeWindowDays} true`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      // Invalidate skills cache
      for (const key of Array.from(this.cache.cache.keys())) {
        if (key.startsWith('skills_')) {
          this.cache.cache.delete(key);
        }
      }
      return { success: true, result: result.output };
    }

    return { success: false, error: result.error };
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const cmd = 'npx agentdb db stats';

    const result = this.executeCommand(cmd, { stdio: 'pipe' }); // Don't suppress stats

    if (result.success) {
      return { success: true, stats: result.output };
    }

    return { success: false, error: result.error };
  }

  /**
   * Store a pattern for future retrieval
   */
  async storePattern(type, domain, pattern, confidence) {
    const patternJson = JSON.stringify(pattern).replace(/'/g, "\\'");
    const cmd = `npx agentdb store-pattern --type "${type}" --domain "${domain}" --pattern '${patternJson}' --confidence ${confidence}`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      // Invalidate pattern cache
      for (const key of Array.from(this.cache.cache.keys())) {
        if (key.startsWith('pattern_')) {
          this.cache.cache.delete(key);
        }
      }
      return { success: true, result: result.output };
    }

    return { success: false, error: result.error };
  }

  /**
   * Query stored patterns
   */
  async queryPatterns(query, k = 5, minConfidence = 0.7) {
    const cacheKey = `pattern_${query}_${k}_${minConfidence}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { success: true, patterns: cached, cached: true };
    }

    const cmd = `npx agentdb query --query "${query}" --domain "${this.domain}" --k ${k} --min-confidence ${minConfidence} --synthesize-context --format json`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      const patterns = parseAgentDBOutput(result.output, []);
      this.cache.set(cacheKey, patterns);
      return { success: true, patterns };
    }

    return { success: false, error: result.error, patterns: [] };
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

    const result = this.executeCommand(cmd);

    if (result.success) {
      return { success: true, result: result.output };
    }

    return { success: false, error: result.error };
  }

  /**
   * Import database
   */
  async importDatabase(inputFile) {
    const cmd = `npx agentdb import ${inputFile} ${this.dbPath} --decompress`;

    const result = this.executeCommand(cmd);

    if (result.success) {
      // Clear all caches after import
      this.cache.clear();
      return { success: true, result: result.output };
    }

    return { success: false, error: result.error };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size(),
      ttl: this.cache.ttl
    };
  }

  /**
   * Clear cache manually
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = AgentDBService;
