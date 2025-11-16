/**
 * Enhanced AgentDB Memory Integration
 *
 * Uses ALL AgentDB features:
 * - Reflexion memory with self-critique
 * - Skill library with semantic search
 * - Causal reasoning
 * - Automated learning
 * - Performance optimization
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface Episode {
  sessionId: string;
  taskName: string;
  confidence: number;
  success: boolean;
  outcome: string;
  strategy?: string;
  metadata?: Record<string, any>;
  reasoning?: string;  // NEW: Causal reasoning
  critique?: string;   // NEW: Self-critique
}

export interface Memory {
  task: string;
  confidence: number;
  success: boolean;
  outcome: string;
  strategy?: string;
  timestamp: number;
  reasoning?: string;
  critique?: string;
  similarity?: number;
}

export interface Skill {
  name: string;
  description: string;
  successRate: number;
  avgReward: number;
  numAttempts: number;
  lastUsed: number;
  bestStrategy?: string;
}

export interface MemoryStats {
  totalEpisodes: number;
  totalSkills: number;
  avgRetrievalTime: number;
  cacheHitRate: number;
  dbSize: number;
}

export class EnhancedAgentDBMemory {
  private dbPath: string;
  private initialized: boolean = false;
  private performanceMetrics: {
    retrievalTimes: number[];
    storeTimes: number[];
    cacheHits: number;
    cacheMisses: number;
  } = {
    retrievalTimes: [],
    storeTimes: [],
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const startTime = Date.now();

    try {
      // Initialize with optimized settings
      const { stdout, stderr } = await execAsync(
        `npx agentdb init "${this.dbPath}" --dimension 768 --preset high-performance --enable-cache`
      );

      console.error('✅ AgentDB initialized:', this.dbPath);
      console.error(`⚡ Initialization time: ${Date.now() - startTime}ms`);
      this.initialized = true;
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.error('⚠️ AgentDB initialization warning:', error.message);
      }
      this.initialized = true;
    }
  }

  /**
   * Store episode with full context and self-critique
   */
  async storeEpisode(episode: Episode): Promise<void> {
    const startTime = Date.now();

    // Generate self-critique if success
    let critique = episode.critique;
    if (episode.success && !critique) {
      critique = await this.generateCritique(episode);
    }

    const cmd = [
      'npx agentdb reflexion store',
      `"${episode.sessionId}"`,
      `"${episode.taskName}"`,
      episode.confidence.toString(),
      episode.success.toString(),
      episode.outcome ? `"${episode.outcome}"` : '""',
      episode.strategy ? `--strategy "${episode.strategy}"` : '',
      episode.reasoning ? `--reasoning "${episode.reasoning}"` : '',
      critique ? `--critique "${critique}"` : '',
    ].join(' ');

    try {
      await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);

      const storeTime = Date.now() - startTime;
      this.performanceMetrics.storeTimes.push(storeTime);

      console.error(`💾 Stored episode: ${episode.taskName} (${storeTime}ms)`);
    } catch (error: any) {
      console.error('❌ Error storing episode:', error.message);
      throw error;
    }
  }

  /**
   * Retrieve memories with semantic search and causal reasoning
   */
  async retrieveMemories(
    query: string,
    k: number = 5,
    options: {
      minReward?: number;
      onlySuccesses?: boolean;
      onlyFailures?: boolean;
      synthesizeContext?: boolean;
      enableReasoning?: boolean;  // NEW
      timeWindow?: number;        // NEW: in days
    } = {}
  ): Promise<Memory[]> {
    const startTime = Date.now();

    let cmd = `npx agentdb reflexion retrieve "${query}" --k ${k}`;

    if (options.minReward !== undefined) {
      cmd += ` --min-reward ${options.minReward}`;
    }
    if (options.onlySuccesses) {
      cmd += ' --only-successes';
    }
    if (options.onlyFailures) {
      cmd += ' --only-failures';
    }
    if (options.synthesizeContext) {
      cmd += ' --synthesize-context';
    }
    if (options.enableReasoning) {
      cmd += ' --enable-causal-reasoning';
    }
    if (options.timeWindow) {
      cmd += ` --time-window ${options.timeWindow}`;
    }

    try {
      const { stdout } = await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);

      const retrievalTime = Date.now() - startTime;
      this.performanceMetrics.retrievalTimes.push(retrievalTime);

      // Check if sub-millisecond (cache hit)
      if (retrievalTime < 1) {
        this.performanceMetrics.cacheHits++;
      } else {
        this.performanceMetrics.cacheMisses++;
      }

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        const memories = Array.isArray(data) ? data : [data];

        console.error(`⚡ Retrieved ${memories.length} memories in ${retrievalTime}ms`);
        return memories;
      }

      return [];
    } catch (error: any) {
      console.error('❌ Error retrieving memories:', error.message);
      return [];
    }
  }

  /**
   * Query with full context synthesis and reasoning
   */
  async queryWithContext(
    query: string,
    options: {
      k?: number;
      minConfidence?: number;
      domain?: string;
      synthesizeReasoning?: boolean;  // NEW
    } = {}
  ): Promise<{ memories: Memory[]; context?: string; reasoning?: string }> {
    const startTime = Date.now();
    const { k = 5, minConfidence = 0.0, domain, synthesizeReasoning = true } = options;

    let cmd = `npx agentdb query --query "${query}" --k ${k} --min-confidence ${minConfidence}`;

    if (domain) {
      cmd += ` --domain "${domain}"`;
    }

    cmd += ' --synthesize-context';

    if (synthesizeReasoning) {
      cmd += ' --enable-causal-reasoning';
    }

    cmd += ' --format json';

    try {
      const { stdout } = await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);

      const retrievalTime = Date.now() - startTime;
      this.performanceMetrics.retrievalTimes.push(retrievalTime);

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        console.error(`🧠 Query with reasoning: ${retrievalTime}ms`);

        return {
          memories: Array.isArray(data) ? data : [data],
          context: data.context || data.summary,
          reasoning: data.reasoning || data.causal_chain,
        };
      }

      return { memories: [] };
    } catch (error: any) {
      console.error('❌ Error querying with context:', error.message);
      return { memories: [] };
    }
  }

  /**
   * Consolidate skills with advanced filtering
   */
  async consolidateSkills(options: {
    minAttempts?: number;
    minReward?: number;
    timeWindowDays?: number;
    enablePruning?: boolean;  // NEW: Remove low-quality skills
  } = {}): Promise<number> {
    const startTime = Date.now();
    const {
      minAttempts = 3,
      minReward = 0.7,
      timeWindowDays = 7,
      enablePruning = true,
    } = options;

    const cmd = `npx agentdb skill consolidate ${minAttempts} ${minReward} ${timeWindowDays} ${enablePruning}`;

    try {
      const { stdout } = await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);

      const consolidationTime = Date.now() - startTime;

      // Parse number of skills consolidated
      const match = stdout.match(/(\d+)\s+skills?\s+consolidated/i);
      const skillsConsolidated = match ? parseInt(match[1]) : 0;

      console.error(`🎯 Consolidated ${skillsConsolidated} skills in ${consolidationTime}ms`);
      return skillsConsolidated;
    } catch (error: any) {
      console.error('❌ Error consolidating skills:', error.message);
      return 0;
    }
  }

  /**
   * Get skill library with semantic search
   */
  async searchSkills(
    query: string,
    options: {
      k?: number;
      minSuccessRate?: number;
      sortBy?: 'success_rate' | 'avg_reward' | 'num_attempts' | 'last_used';
    } = {}
  ): Promise<Skill[]> {
    const startTime = Date.now();
    const { k = 10, minSuccessRate = 0.5, sortBy = 'success_rate' } = options;

    const cmd = `npx agentdb skill search "${query}" --k ${k} --min-success-rate ${minSuccessRate} --sort-by ${sortBy} --format json`;

    try {
      const { stdout } = await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);

      const searchTime = Date.now() - startTime;

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        const skills = Array.isArray(data) ? data : [data];

        console.error(`🔍 Found ${skills.length} skills in ${searchTime}ms`);
        return skills;
      }

      return [];
    } catch (error: any) {
      console.error('❌ Error searching skills:', error.message);
      return [];
    }
  }

  /**
   * Generate self-critique for an episode
   */
  private async generateCritique(episode: Episode): Promise<string> {
    if (!episode.success) {
      return `Failed to complete ${episode.taskName}: ${episode.outcome}. Need to analyze failure modes.`;
    }

    const critiques = [
      `Successfully completed ${episode.taskName} with ${(episode.confidence * 100).toFixed(1)}% confidence. `,
      episode.strategy ? `Strategy "${episode.strategy}" was effective. ` : '',
      episode.metadata?.latency
        ? `Latency: ${episode.metadata.latency}ms. ${episode.metadata.latency < 100 ? 'Excellent response time.' : 'Consider optimization.'} `
        : '',
      'Could explore alternative approaches for comparison.',
    ].join('');

    return critiques;
  }

  /**
   * Get comprehensive statistics with performance metrics
   */
  async getStats(): Promise<MemoryStats> {
    try {
      const { stdout } = await execAsync(`AGENTDB_PATH="${this.dbPath}" npx agentdb db stats --format json`);

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('{'));

      const dbStats = jsonLine ? JSON.parse(jsonLine) : {};

      // Calculate performance metrics
      const avgRetrievalTime = this.performanceMetrics.retrievalTimes.length > 0
        ? this.performanceMetrics.retrievalTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.retrievalTimes.length
        : 0;

      const totalCacheRequests = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
      const cacheHitRate = totalCacheRequests > 0
        ? this.performanceMetrics.cacheHits / totalCacheRequests
        : 0;

      return {
        totalEpisodes: dbStats.total_episodes || 0,
        totalSkills: dbStats.total_skills || 0,
        avgRetrievalTime: parseFloat(avgRetrievalTime.toFixed(3)),
        cacheHitRate: parseFloat((cacheHitRate * 100).toFixed(2)),
        dbSize: dbStats.db_size_bytes || 0,
      };
    } catch (error: any) {
      console.error('❌ Error getting stats:', error.message);
      return {
        totalEpisodes: 0,
        totalSkills: 0,
        avgRetrievalTime: 0,
        cacheHitRate: 0,
        dbSize: 0,
      };
    }
  }

  /**
   * Optimize database performance
   */
  async optimize(): Promise<void> {
    const startTime = Date.now();

    try {
      // Vacuum database
      await execAsync(`AGENTDB_PATH="${this.dbPath}" npx agentdb db vacuum`);

      // Rebuild indexes
      await execAsync(`AGENTDB_PATH="${this.dbPath}" npx agentdb db reindex`);

      // Optimize vector index
      await execAsync(`AGENTDB_PATH="${this.dbPath}" npx agentdb db optimize-vectors`);

      const optimizeTime = Date.now() - startTime;
      console.error(`⚙️ Database optimized in ${optimizeTime}ms`);
    } catch (error: any) {
      console.error('⚠️ Optimization warning:', error.message);
    }
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.performanceMetrics = {
      retrievalTimes: [],
      storeTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  async close(): Promise<void> {
    this.initialized = false;
  }
}
