/**
 * AgentDB Reflexion Memory Integration
 *
 * Enables robot learning from past experiences with 100µs retrieval
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
}

export interface Memory {
  task: string;
  confidence: number;
  success: boolean;
  outcome: string;
  strategy?: string;
  timestamp: number;
}

export class AgentDBMemory {
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize AgentDB database
      const { stdout, stderr } = await execAsync(
        `npx agentdb init "${this.dbPath}" --dimension 768 --preset medium`
      );

      console.error('AgentDB initialized:', this.dbPath);
      this.initialized = true;
    } catch (error: any) {
      // Database might already exist
      if (!error.message.includes('already exists')) {
        console.error('AgentDB initialization warning:', error.message);
      }
      this.initialized = true;
    }
  }

  async storeEpisode(episode: Episode): Promise<void> {
    const cmd = [
      'npx agentdb reflexion store',
      `"${episode.sessionId}"`,
      `"${episode.taskName}"`,
      episode.confidence.toString(),
      episode.success.toString(),
      episode.outcome ? `"${episode.outcome}"` : '""',
    ].join(' ');

    try {
      await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);
      console.error(`Stored episode: ${episode.taskName} (success: ${episode.success})`);
    } catch (error: any) {
      console.error('Error storing episode:', error.message);
      throw error;
    }
  }

  async retrieveMemories(
    query: string,
    k: number = 5,
    options: {
      minReward?: number;
      onlySuccesses?: boolean;
      onlyFailures?: boolean;
      synthesizeContext?: boolean;
    } = {}
  ): Promise<Memory[]> {
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

    try {
      const { stdout } = await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);

      // Parse JSON output
      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        return Array.isArray(data) ? data : [data];
      }

      return [];
    } catch (error: any) {
      console.error('Error retrieving memories:', error.message);
      return [];
    }
  }

  async queryWithContext(
    query: string,
    options: {
      k?: number;
      minConfidence?: number;
      domain?: string;
    } = {}
  ): Promise<{ memories: Memory[]; context?: string }> {
    const { k = 5, minConfidence = 0.0, domain } = options;

    let cmd = `npx agentdb query --query "${query}" --k ${k} --min-confidence ${minConfidence}`;

    if (domain) {
      cmd += ` --domain "${domain}"`;
    }

    cmd += ' --synthesize-context --format json';

    try {
      const { stdout } = await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

      if (jsonLine) {
        const data = JSON.parse(jsonLine);
        return {
          memories: Array.isArray(data) ? data : [data],
          context: data.context || data.summary,
        };
      }

      return { memories: [] };
    } catch (error: any) {
      console.error('Error querying with context:', error.message);
      return { memories: [] };
    }
  }

  async consolidateSkills(options: {
    minAttempts?: number;
    minReward?: number;
    timeWindowDays?: number;
  } = {}): Promise<void> {
    const {
      minAttempts = 3,
      minReward = 0.7,
      timeWindowDays = 7,
    } = options;

    const cmd = `npx agentdb skill consolidate ${minAttempts} ${minReward} ${timeWindowDays} true`;

    try {
      await execAsync(`AGENTDB_PATH="${this.dbPath}" ${cmd}`);
      console.error('Skills consolidated from successful episodes');
    } catch (error: any) {
      console.error('Error consolidating skills:', error.message);
    }
  }

  async getStats(): Promise<any> {
    try {
      const { stdout } = await execAsync(`AGENTDB_PATH="${this.dbPath}" npx agentdb db stats`);
      return { stats: stdout.trim() };
    } catch (error: any) {
      console.error('Error getting stats:', error.message);
      return { stats: 'unavailable' };
    }
  }

  async close(): Promise<void> {
    this.initialized = false;
  }
}
