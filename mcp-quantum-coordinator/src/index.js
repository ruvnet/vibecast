#!/usr/bin/env node

/**
 * Quantum Agent Coordinator - MCP Server
 *
 * Implements quantum-inspired algorithms for agent coordination:
 * - Superposition: Tasks exist in multiple states simultaneously
 * - Entanglement: Agents share quantum-correlated state
 * - Measurement: Collapse superposition to final decision
 * - Decoherence: Detect when agents drift from consensus
 * - Multiverse: Branch execution for speculative parallelism
 */

import { createServer } from 'http';
import { randomBytes, createHash } from 'crypto';

// ============================================================================
// Quantum State Management
// ============================================================================

class QuantumState {
  constructor() {
    this.superpositions = new Map(); // task_id -> [agent_states]
    this.entanglements = new Map();  // agent_pair -> correlation
    this.measurements = new Map();   // task_id -> collapsed_result
    this.decoherenceThreshold = 0.3; // Max allowed state divergence
    this.multiverses = new Map();    // universe_id -> state_snapshot
  }

  /**
   * Create superposition: Task assigned to multiple agents simultaneously
   */
  createSuperposition(taskId, task, agents) {
    const states = agents.map(agent => ({
      agentId: agent.id,
      state: 'pending',
      wavefunction: this.initializeWavefunction(agent.capabilities, task.requirements),
      probability: 1 / agents.length, // Equal superposition initially
      startTime: Date.now(),
      result: null
    }));

    this.superpositions.set(taskId, states);

    return {
      taskId,
      agents: agents.length,
      entangledPairs: this.createEntanglements(agents),
      expectedCollapseTime: this.estimateCollapseTime(task, agents)
    };
  }

  /**
   * Initialize quantum wavefunction based on agent-task compatibility
   */
  initializeWavefunction(capabilities, requirements) {
    const compatibility = this.calculateCompatibility(capabilities, requirements);
    const phase = Math.random() * 2 * Math.PI;

    return {
      amplitude: Math.sqrt(compatibility),
      phase: phase,
      real: Math.sqrt(compatibility) * Math.cos(phase),
      imaginary: Math.sqrt(compatibility) * Math.sin(phase)
    };
  }

  /**
   * Calculate compatibility between agent capabilities and task requirements
   */
  calculateCompatibility(capabilities, requirements) {
    if (!requirements || requirements.length === 0) return 1.0;

    const matches = requirements.filter(req =>
      capabilities.some(cap => cap.toLowerCase().includes(req.toLowerCase()))
    );

    return matches.length / requirements.length;
  }

  /**
   * Create quantum entanglement between agent pairs
   */
  createEntanglements(agents) {
    const pairs = [];

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const pairKey = `${agents[i].id}-${agents[j].id}`;
        const correlation = Math.random(); // Entanglement strength

        this.entanglements.set(pairKey, {
          agents: [agents[i].id, agents[j].id],
          correlation,
          created: Date.now()
        });

        pairs.push(pairKey);
      }
    }

    return pairs;
  }

  /**
   * Update agent state in superposition
   */
  updateAgentState(taskId, agentId, newState, result = null) {
    const superposition = this.superpositions.get(taskId);
    if (!superposition) return null;

    const agentState = superposition.find(s => s.agentId === agentId);
    if (!agentState) return null;

    agentState.state = newState;
    agentState.result = result;
    agentState.updateTime = Date.now();

    // Update probabilities based on progress
    this.recalculateProbabilities(taskId);

    // Check for decoherence
    const decoherence = this.detectDecoherence(taskId);

    return {
      taskId,
      agentId,
      newState,
      probability: agentState.probability,
      decoherence
    };
  }

  /**
   * Recalculate probabilities based on agent performance
   */
  recalculateProbabilities(taskId) {
    const superposition = this.superpositions.get(taskId);
    if (!superposition) return;

    const weights = superposition.map(state => {
      if (state.state === 'completed') return 10.0;
      if (state.state === 'in_progress') return 5.0;
      if (state.state === 'error') return 0.1;
      return 1.0;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);

    superposition.forEach((state, idx) => {
      state.probability = weights[idx] / totalWeight;
    });
  }

  /**
   * Detect decoherence: When agents drift too far from consensus
   */
  detectDecoherence(taskId) {
    const superposition = this.superpositions.get(taskId);
    if (!superposition || superposition.length < 2) return { detected: false };

    // Calculate state variance
    const completedStates = superposition.filter(s => s.state === 'completed');
    if (completedStates.length < 2) return { detected: false };

    // Compare results for divergence
    const results = completedStates.map(s => JSON.stringify(s.result));
    const uniqueResults = new Set(results);
    const divergence = (uniqueResults.size - 1) / completedStates.length;

    return {
      detected: divergence > this.decoherenceThreshold,
      divergence,
      threshold: this.decoherenceThreshold,
      uniqueResults: uniqueResults.size,
      totalResults: completedStates.length
    };
  }

  /**
   * Measure (collapse) superposition to final result
   */
  measureSuperposition(taskId, strategy = 'best') {
    const superposition = this.superpositions.get(taskId);
    if (!superposition) return null;

    const completedStates = superposition.filter(s => s.state === 'completed');
    if (completedStates.length === 0) return null;

    let selectedState;

    switch (strategy) {
      case 'best':
        // Highest probability (best performer)
        selectedState = completedStates.reduce((best, current) =>
          current.probability > best.probability ? current : best
        );
        break;

      case 'fastest':
        // Shortest completion time
        selectedState = completedStates.reduce((fastest, current) =>
          (current.updateTime - current.startTime) < (fastest.updateTime - fastest.startTime)
            ? current : fastest
        );
        break;

      case 'consensus':
        // Most common result
        const resultCounts = new Map();
        completedStates.forEach(state => {
          const key = JSON.stringify(state.result);
          resultCounts.set(key, (resultCounts.get(key) || 0) + 1);
        });
        const mostCommon = [...resultCounts.entries()]
          .reduce((a, b) => b[1] > a[1] ? b : a)[0];
        selectedState = completedStates.find(s =>
          JSON.stringify(s.result) === mostCommon
        );
        break;

      default:
        selectedState = completedStates[0];
    }

    const measurement = {
      taskId,
      collapsedState: selectedState,
      strategy,
      alternatives: completedStates.length - 1,
      collapseTime: Date.now(),
      totalTime: selectedState.updateTime - selectedState.startTime,
      quantumAdvantage: this.calculateQuantumAdvantage(superposition, selectedState)
    };

    this.measurements.set(taskId, measurement);
    return measurement;
  }

  /**
   * Calculate quantum advantage: how much faster than sequential execution
   */
  calculateQuantumAdvantage(superposition, selectedState) {
    const parallelTime = selectedState.updateTime - selectedState.startTime;
    const avgTime = superposition
      .filter(s => s.state === 'completed')
      .reduce((sum, s) => sum + (s.updateTime - s.startTime), 0) /
      superposition.filter(s => s.state === 'completed').length;

    const sequentialTime = avgTime * superposition.length;
    const speedup = sequentialTime / parallelTime;

    return {
      parallelTime,
      sequentialTime,
      speedup: speedup.toFixed(2) + 'x',
      advantage: ((speedup - 1) * 100).toFixed(1) + '%'
    };
  }

  /**
   * Estimate time until collapse based on task complexity and agent count
   */
  estimateCollapseTime(task, agents) {
    const baseTime = task.estimatedTime || 60000; // 1 minute default
    const parallelFactor = 1 / Math.sqrt(agents.length); // Quantum speedup
    return Math.floor(baseTime * parallelFactor);
  }

  /**
   * Create multiverse branch for speculative execution
   */
  branchUniverse(universeId, currentState) {
    const branchId = `${universeId}-${randomBytes(4).toString('hex')}`;
    const stateSnapshot = JSON.parse(JSON.stringify(currentState));

    this.multiverses.set(branchId, {
      parentUniverse: universeId,
      state: stateSnapshot,
      created: Date.now(),
      divergencePoint: this.hashState(stateSnapshot)
    });

    return branchId;
  }

  /**
   * Hash state for multiverse tracking
   */
  hashState(state) {
    return createHash('sha256')
      .update(JSON.stringify(state))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get all active superpositions
   */
  getActiveSuperpositions() {
    return Array.from(this.superpositions.entries()).map(([taskId, states]) => ({
      taskId,
      agents: states.length,
      completed: states.filter(s => s.state === 'completed').length,
      inProgress: states.filter(s => s.state === 'in_progress').length,
      pending: states.filter(s => s.state === 'pending').length,
      decoherence: this.detectDecoherence(taskId)
    }));
  }
}

// ============================================================================
// MCP Server Implementation
// ============================================================================

class MCPQuantumCoordinator {
  constructor() {
    this.quantum = new QuantumState();
    this.agents = new Map();
    this.tasks = new Map();
    this.port = process.env.MCP_PORT || 3100;
  }

  /**
   * Register an agent with the coordinator
   */
  registerAgent(agentConfig) {
    const agentId = agentConfig.id || randomBytes(8).toString('hex');

    this.agents.set(agentId, {
      id: agentId,
      name: agentConfig.name,
      capabilities: agentConfig.capabilities || [],
      model: agentConfig.model,
      status: 'idle',
      registered: Date.now(),
      tasksCompleted: 0
    });

    return { agentId, status: 'registered' };
  }

  /**
   * MCP Tool: quantum_allocate_task
   */
  async quantumAllocateTask(params) {
    const { task, agentCount = 3, requirements = [] } = params;
    const taskId = randomBytes(8).toString('hex');

    // Select best agents for this task
    const selectedAgents = this.selectAgents(agentCount, requirements);

    if (selectedAgents.length === 0) {
      return { error: 'No suitable agents available' };
    }

    // Create quantum superposition
    const superposition = this.quantum.createSuperposition(
      taskId,
      { ...task, requirements },
      selectedAgents
    );

    // Store task
    this.tasks.set(taskId, {
      ...task,
      requirements,
      created: Date.now(),
      status: 'superposition'
    });

    // Update agent statuses
    selectedAgents.forEach(agent => {
      agent.status = 'superposition';
    });

    return {
      taskId,
      superposition,
      message: `Task allocated to ${selectedAgents.length} agents in quantum superposition`
    };
  }

  /**
   * MCP Tool: entangle_agents
   */
  async entangleAgents(params) {
    const { agentIds } = params;

    const agents = agentIds
      .map(id => this.agents.get(id))
      .filter(a => a);

    if (agents.length < 2) {
      return { error: 'Need at least 2 agents to create entanglement' };
    }

    const pairs = this.quantum.createEntanglements(agents);

    return {
      entangled: agents.length,
      pairs: pairs.length,
      correlation: 'quantum',
      message: `Created ${pairs.length} entangled pairs from ${agents.length} agents`
    };
  }

  /**
   * MCP Tool: measure_consensus
   */
  async measureConsensus(params) {
    const { taskId, strategy = 'best' } = params;

    const measurement = this.quantum.measureSuperposition(taskId, strategy);

    if (!measurement) {
      return { error: 'Task not found or no results available' };
    }

    // Update task status
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'collapsed';
      task.result = measurement.collapsedState.result;
    }

    return {
      taskId,
      result: measurement.collapsedState.result,
      selectedAgent: measurement.collapsedState.agentId,
      strategy,
      quantumAdvantage: measurement.quantumAdvantage,
      message: 'Superposition collapsed to final result'
    };
  }

  /**
   * MCP Tool: detect_decoherence
   */
  async detectDecoherence(params) {
    const { taskId } = params;

    const decoherence = this.quantum.detectDecoherence(taskId);

    return {
      taskId,
      ...decoherence,
      recommendation: decoherence.detected
        ? 'Consider re-synchronizing agents or adjusting task specification'
        : 'Agents are in coherent state'
    };
  }

  /**
   * MCP Tool: branch_universe
   */
  async branchUniverse(params) {
    const { universeId = 'main', reason } = params;

    const currentState = {
      superpositions: Array.from(this.quantum.superpositions.entries()),
      tasks: Array.from(this.tasks.entries()),
      timestamp: Date.now()
    };

    const branchId = this.quantum.branchUniverse(universeId, currentState);

    return {
      branchId,
      parentUniverse: universeId,
      reason,
      divergencePoint: this.quantum.hashState(currentState),
      message: 'New universe branch created for speculative execution'
    };
  }

  /**
   * MCP Tool: get_quantum_status
   */
  async getQuantumStatus() {
    return {
      activeSuperpositions: this.quantum.getActiveSuperpositions(),
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values())
        .filter(a => a.status !== 'idle').length,
      totalTasks: this.tasks.size,
      completedTasks: Array.from(this.tasks.values())
        .filter(t => t.status === 'collapsed').length,
      entanglements: this.quantum.entanglements.size,
      multiverses: this.quantum.multiverses.size
    };
  }

  /**
   * Select best agents for task based on capabilities
   */
  selectAgents(count, requirements) {
    const availableAgents = Array.from(this.agents.values())
      .filter(a => a.status === 'idle');

    if (requirements.length === 0) {
      // Random selection if no requirements
      return availableAgents.slice(0, count);
    }

    // Score agents by capability match
    const scored = availableAgents.map(agent => ({
      agent,
      score: this.quantum.calculateCompatibility(agent.capabilities, requirements)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.agent);
  }

  /**
   * Handle MCP requests
   */
  async handleMCPRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'quantum_allocate_task':
        return await this.quantumAllocateTask(params);

      case 'entangle_agents':
        return await this.entangleAgents(params);

      case 'measure_consensus':
        return await this.measureConsensus(params);

      case 'detect_decoherence':
        return await this.detectDecoherence(params);

      case 'branch_universe':
        return await this.branchUniverse(params);

      case 'get_quantum_status':
        return await this.getQuantumStatus();

      case 'register_agent':
        return this.registerAgent(params);

      case 'list_tools':
        return this.listTools();

      default:
        return { error: `Unknown method: ${method}` };
    }
  }

  /**
   * List available MCP tools
   */
  listTools() {
    return {
      tools: [
        {
          name: 'quantum_allocate_task',
          description: 'Allocate task to multiple agents in quantum superposition',
          parameters: {
            task: 'Task object with description and requirements',
            agentCount: 'Number of agents to use (default: 3)',
            requirements: 'Array of required capabilities'
          }
        },
        {
          name: 'entangle_agents',
          description: 'Create quantum entanglement between agents for correlated execution',
          parameters: {
            agentIds: 'Array of agent IDs to entangle'
          }
        },
        {
          name: 'measure_consensus',
          description: 'Collapse superposition to final result using specified strategy',
          parameters: {
            taskId: 'Task ID to measure',
            strategy: 'Measurement strategy: best, fastest, or consensus'
          }
        },
        {
          name: 'detect_decoherence',
          description: 'Detect if agents have drifted from quantum coherence',
          parameters: {
            taskId: 'Task ID to check'
          }
        },
        {
          name: 'branch_universe',
          description: 'Create multiverse branch for speculative execution',
          parameters: {
            universeId: 'Parent universe ID (default: main)',
            reason: 'Reason for branching'
          }
        },
        {
          name: 'get_quantum_status',
          description: 'Get current quantum coordination status',
          parameters: {}
        },
        {
          name: 'register_agent',
          description: 'Register new agent with coordinator',
          parameters: {
            name: 'Agent name',
            capabilities: 'Array of capabilities',
            model: 'AI model used'
          }
        }
      ]
    };
  }

  /**
   * Start MCP server
   */
  start() {
    const server = createServer(async (req, res) => {
      if (req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const request = JSON.parse(body);
            const result = await this.handleMCPRequest(request);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      } else if (req.method === 'GET') {
        const status = await this.getQuantumStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      } else {
        res.writeHead(405);
        res.end();
      }
    });

    server.listen(this.port, () => {
      console.log(`🌌 Quantum Agent Coordinator (MCP Server) running on port ${this.port}`);
      console.log(`📡 POST requests to http://localhost:${this.port} for MCP tools`);
      console.log(`📊 GET  requests to http://localhost:${this.port} for status`);
      console.log(`\n🔧 Available tools: quantum_allocate_task, entangle_agents, measure_consensus, detect_decoherence, branch_universe`);
    });

    return server;
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const coordinator = new MCPQuantumCoordinator();
  coordinator.start();
}

export { MCPQuantumCoordinator, QuantumState };
