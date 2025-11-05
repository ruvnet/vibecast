/**
 * Flow-Nexus Sandbox Orchestration
 * Manages agent execution in isolated sandbox environments
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

/**
 * Flow-Nexus client for sandbox management
 */
export class FlowNexusClient {
  constructor(endpoint = null, apiKey = null) {
    this.endpoint = endpoint || process.env.FLOW_NEXUS_ENDPOINT || 'http://localhost:3000';
    this.apiKey = apiKey || process.env.FLOW_NEXUS_API_KEY;
    this.sandboxes = new Map();
  }

  /**
   * Create a new sandbox
   * @param {string} name - Sandbox name
   * @param {string} template - Template to use (node, python, rust, etc.)
   * @returns {Promise<object>}
   */
  async createSandbox(name, template = 'node') {
    console.log(`🏗️  Creating sandbox: ${name} (template: ${template})`);

    try {
      // In a real implementation, this would call Flow-Nexus API
      // For now, we'll simulate sandbox creation
      const sandbox = {
        id: `sandbox_${Date.now()}`,
        name,
        template,
        status: 'running',
        created_at: new Date().toISOString(),
        endpoint: `${this.endpoint}/sandbox/${name}`
      };

      this.sandboxes.set(name, sandbox);

      console.log(`✅ Sandbox created: ${sandbox.id}`);
      return sandbox;
    } catch (error) {
      console.error('❌ Failed to create sandbox:', error.message);
      throw error;
    }
  }

  /**
   * Execute a command in a sandbox
   * @param {string} sandboxId - Sandbox ID or name
   * @param {string} command - Command to execute
   * @returns {Promise<object>}
   */
  async executeSandbox(sandboxId, command) {
    console.log(`⚙️  Executing in sandbox ${sandboxId}: ${command}`);

    try {
      // In a real implementation, this would execute in the isolated sandbox
      // For now, we'll execute locally (DEMO ONLY - not secure for production)
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      const result = {
        sandboxId,
        command,
        stdout,
        stderr,
        exitCode: 0,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Execution complete`);
      return result;
    } catch (error) {
      console.error('❌ Execution failed:', error.message);
      return {
        sandboxId,
        command,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute a command in a sandbox with streaming output
   * @param {string} sandboxId - Sandbox ID or name
   * @param {string} command - Command to execute
   * @param {function} onData - Callback for output data
   * @returns {Promise<object>}
   */
  async executeSandboxStream(sandboxId, command, onData = null) {
    console.log(`⚙️  Executing (streaming) in sandbox ${sandboxId}: ${command}`);

    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const proc = spawn(cmd, args);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (onData) onData({ type: 'stdout', data: text });
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (onData) onData({ type: 'stderr', data: text });
      });

      proc.on('close', (code) => {
        const result = {
          sandboxId,
          command,
          stdout,
          stderr,
          exitCode: code,
          timestamp: new Date().toISOString()
        };

        if (code === 0) {
          console.log(`✅ Execution complete`);
          resolve(result);
        } else {
          console.error(`❌ Execution failed with code ${code}`);
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      proc.on('error', (error) => {
        console.error('❌ Execution error:', error.message);
        reject(error);
      });
    });
  }

  /**
   * Get sandbox logs
   * @param {string} sandboxId - Sandbox ID or name
   * @param {number} lines - Number of lines to retrieve
   * @returns {Promise<object>}
   */
  async getSandboxLogs(sandboxId, lines = 100) {
    console.log(`📋 Fetching logs for sandbox ${sandboxId} (${lines} lines)`);

    try {
      // In a real implementation, this would fetch logs from Flow-Nexus
      const sandbox = this.sandboxes.get(sandboxId);

      if (!sandbox) {
        throw new Error(`Sandbox ${sandboxId} not found`);
      }

      return {
        sandboxId,
        logs: 'Logs would appear here...',
        lines,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to fetch logs:', error.message);
      throw error;
    }
  }

  /**
   * Destroy a sandbox
   * @param {string} sandboxId - Sandbox ID or name
   * @returns {Promise<boolean>}
   */
  async destroySandbox(sandboxId) {
    console.log(`🗑️  Destroying sandbox ${sandboxId}`);

    try {
      this.sandboxes.delete(sandboxId);
      console.log(`✅ Sandbox destroyed`);
      return true;
    } catch (error) {
      console.error('❌ Failed to destroy sandbox:', error.message);
      throw error;
    }
  }

  /**
   * List all sandboxes
   * @returns {Array}
   */
  listSandboxes() {
    return Array.from(this.sandboxes.values());
  }
}

/**
 * Swarm orchestration for multi-agent coordination
 */
export class SwarmOrchestrator {
  constructor(flowNexusClient) {
    this.client = flowNexusClient;
    this.agents = new Map();
  }

  /**
   * Register an agent in the swarm
   * @param {string} name - Agent name
   * @param {object} agent - Agent instance
   * @returns {void}
   */
  registerAgent(name, agent) {
    console.log(`🐝 Registering agent in swarm: ${name}`);
    this.agents.set(name, {
      instance: agent,
      status: 'idle',
      taskQueue: []
    });
  }

  /**
   * Assign a task to an agent
   * @param {string} agentName - Agent name
   * @param {object} task - Task to execute
   * @returns {Promise<object>}
   */
  async assignTask(agentName, task) {
    const agent = this.agents.get(agentName);

    if (!agent) {
      throw new Error(`Agent ${agentName} not found in swarm`);
    }

    console.log(`📋 Assigning task to ${agentName}: ${task.description}`);

    agent.status = 'busy';
    agent.taskQueue.push(task);

    try {
      const result = await agent.instance.run(task.prompt, task.context);

      agent.status = 'idle';
      agent.taskQueue.shift();

      return {
        agent: agentName,
        task: task.description,
        result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      agent.status = 'error';
      console.error(`❌ Task failed for ${agentName}:`, error.message);
      throw error;
    }
  }

  /**
   * Execute tasks in parallel across multiple agents
   * @param {Array} tasks - Array of tasks with agent assignments
   * @returns {Promise<Array>}
   */
  async executeParallel(tasks) {
    console.log(`🚀 Executing ${tasks.length} tasks in parallel...`);

    const promises = tasks.map(task =>
      this.assignTask(task.agent, task)
    );

    const results = await Promise.allSettled(promises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Parallel execution complete: ${successful} succeeded, ${failed} failed`);

    return results;
  }

  /**
   * Get swarm status
   * @returns {object}
   */
  getStatus() {
    const agents = Array.from(this.agents.entries()).map(([name, agent]) => ({
      name,
      status: agent.status,
      queueSize: agent.taskQueue.length
    }));

    return {
      totalAgents: this.agents.size,
      agents,
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instances
let flowNexusInstance = null;
let swarmOrchestratorInstance = null;

/**
 * Get Flow-Nexus client instance
 * @returns {FlowNexusClient}
 */
export function getFlowNexusClient() {
  if (!flowNexusInstance) {
    flowNexusInstance = new FlowNexusClient();
  }
  return flowNexusInstance;
}

/**
 * Get Swarm Orchestrator instance
 * @returns {SwarmOrchestrator}
 */
export function getSwarmOrchestrator() {
  if (!swarmOrchestratorInstance) {
    swarmOrchestratorInstance = new SwarmOrchestrator(getFlowNexusClient());
  }
  return swarmOrchestratorInstance;
}

export default {
  FlowNexusClient,
  SwarmOrchestrator,
  getFlowNexusClient,
  getSwarmOrchestrator
};
