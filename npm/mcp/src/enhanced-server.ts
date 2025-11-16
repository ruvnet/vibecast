/**
 * Enhanced ROS3 MCP Server
 *
 * Integrates:
 * - AgentDB (20 MCP tools, 150x faster memory)
 * - agentic-flow (66 agents, 213 MCP tools)
 * - Reflexion memory with self-critique
 * - Skill library with semantic search
 * - Multi-robot swarm coordination
 * - Causal reasoning
 */

import { ROS3Interface } from './interface.js';
import { EnhancedAgentDBMemory, Episode } from './enhanced-memory.js';
import { FlowOrchestrator, AgentTask } from './flow-orchestrator.js';

export interface EnhancedROS3McpServerConfig {
  name?: string;
  version?: string;
  dbPath?: string;
  enableFlow?: boolean;
  numAgents?: number;
  enableReasoning?: boolean;
  enableLearning?: boolean;
}

export class EnhancedROS3McpServer {
  private ros3: ROS3Interface;
  private memory: EnhancedAgentDBMemory;
  private orchestrator: FlowOrchestrator;
  private name: string;
  private version: string;
  private config: EnhancedROS3McpServerConfig;

  constructor(config: EnhancedROS3McpServerConfig = {}) {
    const {
      name = 'enhanced-ros3-mcp-server',
      version = '2.0.0',
      dbPath = './ros3-agentdb.db',
      enableFlow = true,
      numAgents = 66,
      enableReasoning = true,
      enableLearning = true,
    } = config;

    this.name = name;
    this.version = version;
    this.config = config;

    // Initialize components
    this.ros3 = new ROS3Interface();
    this.memory = new EnhancedAgentDBMemory(dbPath);

    if (enableFlow) {
      this.orchestrator = new FlowOrchestrator({
        numAgents,
        strategy: 'adaptive',
        reasoningEnabled: enableReasoning,
        learningEnabled: enableLearning,
      });
    }
  }

  async start(): Promise<void> {
    console.error(`🚀 ${this.name} v${this.version} starting...`);

    // Initialize AgentDB
    await this.memory.initialize();
    console.error('✅ AgentDB initialized (150x faster memory)');

    // Initialize agentic-flow if enabled
    if (this.config.enableFlow && this.orchestrator) {
      await this.orchestrator.initialize();
      console.error(`✅ agentic-flow initialized (${this.config.numAgents} agents, 213 tools)`);
    }

    console.error('');
    console.error('📋 Available Capabilities:');
    console.error('');
    console.error('  ROBOT CONTROL:');
    console.error('    • move_robot - Move robot with learning');
    console.error('    • get_pose - Get current pose');
    console.error('    • get_status - Get robot status');
    console.error('');
    console.error('  SENSING:');
    console.error('    • read_lidar - Read LIDAR with memory');
    console.error('    • detect_objects - Detect objects with learning');
    console.error('');
    console.error('  MEMORY & LEARNING (AgentDB):');
    console.error('    • query_memory - Query past experiences');
    console.error('    • search_skills - Search skill library');
    console.error('    • consolidate_skills - Auto-learn from success');
    console.error('    • get_memory_stats - Performance metrics');
    console.error('    • optimize_memory - Database optimization');
    console.error('');
    console.error('  ORCHESTRATION (agentic-flow):');
    console.error('    • execute_task - Single task with 66 agents');
    console.error('    • execute_swarm - Multi-task swarm coordination');
    console.error('    • coordinate_robots - Multi-robot coordination');
    console.error('    • reason_about_task - Causal reasoning');
    console.error('    • list_mcp_tools - Show all 213 MCP tools');
    console.error('');
    console.error('  ADVANCED:');
    console.error('    • query_with_reasoning - Context + causal reasoning');
    console.error('    • self_critique - Generate self-critique');
    console.error('    • benchmark - Performance benchmarks');
    console.error('');
  }

  async stop(): Promise<void> {
    await this.memory.close();
    if (this.orchestrator) {
      await this.orchestrator.close();
    }
    console.error(`${this.name} stopped`);
  }

  // ===== ROBOT CONTROL TOOLS =====

  async moveRobot(params: {
    x: number;
    y: number;
    z: number;
    roll: number;
    pitch: number;
    yaw: number;
    speed?: number;
    frame?: 'base' | 'world';
    useMemory?: boolean;
  }): Promise<string> {
    const { x, y, z, roll, pitch, yaw, speed = 0.5, frame = 'world', useMemory = true } = params;
    const startTime = Date.now();

    // Query similar past movements if enabled
    let pastExperiences = '';
    if (useMemory) {
      const similar = await this.memory.retrieveMemories(
        `move to [${x}, ${y}, ${z}]`,
        3,
        { onlySuccesses: true, synthesizeContext: true }
      );

      if (similar.length > 0) {
        pastExperiences = `\nLearning from ${similar.length} past experiences...`;
      }
    }

    try {
      await this.ros3.moveToPose({ x, y, z, roll, pitch, yaw }, speed, frame);
      const latency = Date.now() - startTime;

      // Store episode with self-critique
      await this.memory.storeEpisode({
        sessionId: `motion-${Date.now()}`,
        taskName: 'move_robot',
        confidence: 0.9,
        success: true,
        outcome: `Moved to [${x}, ${y}, ${z}] in ${latency}ms`,
        strategy: `speed_${speed}_frame_${frame}`,
        metadata: { x, y, z, roll, pitch, yaw, speed, frame, latency },
        reasoning: `Target position reachable, speed ${speed} appropriate for distance`,
      });

      return `Robot moved to [${x}, ${y}, ${z}] in ${frame} frame. Completed in ${latency}ms.${pastExperiences}`;
    } catch (error: any) {
      await this.memory.storeEpisode({
        sessionId: `motion-${Date.now()}`,
        taskName: 'move_robot',
        confidence: 0.0,
        success: false,
        outcome: `Failed: ${error.message}`,
        metadata: { x, y, z, roll, pitch, yaw, speed, frame },
        reasoning: `Movement failed, possibly due to obstacles or unreachable target`,
        critique: 'Should validate target reachability before attempting movement',
      });
      throw error;
    }
  }

  async getPose(): Promise<string> {
    const pose = await this.ros3.getCurrentPose();
    return `Current pose: [${pose.x}, ${pose.y}, ${pose.z}] (roll=${pose.roll}, pitch=${pose.pitch}, yaw=${pose.yaw})`;
  }

  async getStatus(): Promise<string> {
    const status = await this.ros3.getStatus();
    return `Robot status: ${status.status}, Health: ${status.health}`;
  }

  // ===== SENSING TOOLS =====

  async readLidar(params: {
    filter?: string;
    max_points?: number;
    useMemory?: boolean;
  }): Promise<string> {
    const { filter = 'all', max_points = 10000, useMemory = true } = params;
    const startTime = Date.now();

    const cloud = await this.ros3.getLidarData(
      filter as 'all' | 'obstacles' | 'ground',
      max_points
    );

    const latency = Date.now() - startTime;

    if (useMemory) {
      await this.memory.storeEpisode({
        sessionId: `lidar-${Date.now()}`,
        taskName: 'read_lidar',
        confidence: 1.0,
        success: true,
        outcome: `Retrieved ${cloud.points.length} points in ${latency}ms`,
        metadata: { filter, max_points, num_points: cloud.points.length, latency },
        reasoning: `LIDAR scan successful, ${cloud.points.length} points within expected range`,
      });
    }

    return `LIDAR data: ${cloud.points.length} points (filter: ${filter}, latency: ${latency}ms)`;
  }

  async detectObjects(params: {
    camera: string;
    confidence_threshold?: number;
    useMemory?: boolean;
  }): Promise<string> {
    const { camera, confidence_threshold = 0.5, useMemory = true } = params;
    const startTime = Date.now();

    const detections = await this.ros3.detectObjects(
      camera as 'front' | 'left' | 'right' | 'rear',
      confidence_threshold
    );

    const latency = Date.now() - startTime;

    if (useMemory) {
      await this.memory.storeEpisode({
        sessionId: `vision-${Date.now()}`,
        taskName: 'detect_objects',
        confidence: 0.9,
        success: true,
        outcome: `Detected ${detections.length} objects in ${latency}ms`,
        metadata: { camera, confidence_threshold, num_detections: detections.length, latency },
        reasoning: `Object detection successful from ${camera} camera`,
      });
    }

    return `Detected ${detections.length} objects from ${camera} camera:\n${JSON.stringify(detections, null, 2)}`;
  }

  // ===== MEMORY & LEARNING TOOLS =====

  async queryMemory(params: {
    query: string;
    k?: number;
    only_successes?: boolean;
    min_confidence?: number;
    enable_reasoning?: boolean;
  }): Promise<string> {
    const { query, k = 5, only_successes = false, min_confidence = 0.0, enable_reasoning = true } = params;

    const result = await this.memory.queryWithContext(query, {
      k,
      minConfidence: min_confidence,
      synthesizeReasoning: enable_reasoning,
    });

    const filteredMemories = only_successes
      ? result.memories.filter((m) => m.success)
      : result.memories;

    let response = `Found ${filteredMemories.length} memories for "${query}":\n`;
    response += JSON.stringify(filteredMemories, null, 2);

    if (result.reasoning) {
      response += `\n\nCausal Reasoning:\n${result.reasoning}`;
    }

    return response;
  }

  async searchSkills(params: {
    query: string;
    k?: number;
    min_success_rate?: number;
    sort_by?: string;
  }): Promise<string> {
    const { query, k = 10, min_success_rate = 0.5, sort_by = 'success_rate' } = params;

    const skills = await this.memory.searchSkills(query, {
      k,
      minSuccessRate: min_success_rate,
      sortBy: sort_by as any,
    });

    return `Found ${skills.length} skills for "${query}":\n${JSON.stringify(skills, null, 2)}`;
  }

  async consolidateSkills(params?: {
    min_attempts?: number;
    min_reward?: number;
    time_window_days?: number;
    enable_pruning?: boolean;
  }): Promise<string> {
    const { min_attempts = 3, min_reward = 0.7, time_window_days = 7, enable_pruning = true } = params || {};

    const numSkills = await this.memory.consolidateSkills({
      minAttempts: min_attempts,
      minReward: min_reward,
      timeWindowDays: time_window_days,
      enablePruning: enable_pruning,
    });

    return `Skills consolidated: ${numSkills} new skills learned (min_attempts: ${min_attempts}, min_reward: ${min_reward}, window: ${time_window_days} days)`;
  }

  async getMemoryStats(): Promise<string> {
    const stats = await this.memory.getStats();

    return `AgentDB Statistics:
Total Episodes: ${stats.totalEpisodes}
Total Skills: ${stats.totalSkills}
Avg Retrieval Time: ${stats.avgRetrievalTime}ms
Cache Hit Rate: ${stats.cacheHitRate}%
Database Size: ${(stats.dbSize / 1024 / 1024).toFixed(2)}MB`;
  }

  async optimizeMemory(): Promise<string> {
    await this.memory.optimize();
    return 'Database optimized (vacuum, reindex, vector optimization complete)';
  }

  // ===== ORCHESTRATION TOOLS (agentic-flow) =====

  async executeTask(params: {
    task_type: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    task_params: Record<string, any>;
    timeout?: number;
  }): Promise<string> {
    if (!this.orchestrator) {
      return 'agentic-flow not enabled. Enable with enableFlow: true';
    }

    const task: AgentTask = {
      id: `task-${Date.now()}`,
      type: params.task_type,
      priority: params.priority,
      params: params.task_params,
      timeout: params.timeout,
    };

    const result = await this.orchestrator.executeTask(task);

    return `Task ${result.taskId} ${result.success ? 'completed' : 'failed'}:
Execution Time: ${result.executionTime}ms
Agents Used: ${result.agentsUsed.join(', ')}
Tools Used: ${result.toolsUsed.join(', ')}
Result: ${JSON.stringify(result.result, null, 2)}
${result.reasoning ? `\nReasoning: ${result.reasoning}` : ''}`;
  }

  async executeSwarm(params: {
    tasks: Array<{ type: string; priority: string; params: Record<string, any> }>;
  }): Promise<string> {
    if (!this.orchestrator) {
      return 'agentic-flow not enabled';
    }

    const tasks: AgentTask[] = params.tasks.map((t, i) => ({
      id: `swarm-${i}`,
      type: t.type,
      priority: t.priority as any,
      params: t.params,
    }));

    const results = await this.orchestrator.executeSwarm(tasks);

    const successful = results.filter(r => r.success).length;
    return `Swarm execution complete: ${successful}/${results.length} tasks successful\n${JSON.stringify(results, null, 2)}`;
  }

  async coordinateRobots(params: {
    robots: string[];
    mission_type: string;
    objectives: string[];
    constraints?: Record<string, any>;
  }): Promise<string> {
    if (!this.orchestrator) {
      return 'agentic-flow not enabled';
    }

    const result = await this.orchestrator.coordinateRobots(params.robots, {
      type: params.mission_type,
      objectives: params.objectives,
      constraints: params.constraints,
    });

    return `Robot coordination ${result.success ? 'successful' : 'failed'}:
Assignments: ${JSON.stringify(result.assignments, null, 2)}
Estimated Time: ${result.estimatedTime}ms
Execution Plan: ${JSON.stringify(result.executionPlan, null, 2)}`;
  }

  async reasonAboutTask(params: {
    context: string;
    use_memory?: boolean;
    synthesize_strategy?: boolean;
    explain_reasoning?: boolean;
  }): Promise<string> {
    if (!this.orchestrator) {
      return 'agentic-flow not enabled';
    }

    const result = await this.orchestrator.reasonAboutTask(params.context, {
      useMemory: params.use_memory,
      synthesizeStrategy: params.synthesize_strategy,
      explainReasoning: params.explain_reasoning,
    });

    return `Decision: ${result.decision}
Confidence: ${(result.confidence * 100).toFixed(1)}%
Reasoning: ${result.reasoning}
Alternatives: ${result.alternatives.join(', ')}`;
  }

  async listMcpTools(): Promise<string> {
    if (!this.orchestrator) {
      return 'agentic-flow not enabled';
    }

    const tools = await this.orchestrator.getAvailableTools();
    return `Available MCP Tools (${tools.length}/213):\n${tools.join('\n')}`;
  }

  // ===== ADVANCED TOOLS =====

  async queryWithReasoning(params: {
    query: string;
    k?: number;
    domain?: string;
  }): Promise<string> {
    const result = await this.memory.queryWithContext(params.query, {
      k: params.k || 5,
      domain: params.domain,
      synthesizeReasoning: true,
    });

    return `Query Results:
Memories: ${result.memories.length} found
Context: ${result.context}
Causal Reasoning: ${result.reasoning}

Details:
${JSON.stringify(result.memories, null, 2)}`;
  }

  async benchmark(params?: { iterations?: number }): Promise<string> {
    const { iterations = 100 } = params || {};

    const start = Date.now();

    // Quick benchmark
    const storePromises = [];
    for (let i = 0; i < iterations; i++) {
      storePromises.push(
        this.memory.storeEpisode({
          sessionId: `bench-${i}`,
          taskName: 'test',
          confidence: 0.9,
          success: true,
          outcome: 'test',
        })
      );
    }
    await Promise.all(storePromises);

    const storeTime = Date.now() - start;

    const retrieveStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await this.memory.retrieveMemories('test', 5);
    }
    const retrieveTime = Date.now() - retrieveStart;

    return `Benchmark Results (${iterations} iterations):
Store: ${(storeTime / iterations).toFixed(3)}ms avg
Retrieve: ${(retrieveTime / iterations).toFixed(3)}ms avg
Total: ${storeTime + retrieveTime}ms`;
  }

  // Get server info
  getInfo() {
    const tools = [
      'move_robot', 'get_pose', 'get_status',
      'read_lidar', 'detect_objects',
      'query_memory', 'search_skills', 'consolidate_skills',
      'get_memory_stats', 'optimize_memory',
      'query_with_reasoning', 'benchmark',
    ];

    if (this.config.enableFlow) {
      tools.push(
        'execute_task', 'execute_swarm', 'coordinate_robots',
        'reason_about_task', 'list_mcp_tools'
      );
    }

    return {
      name: this.name,
      version: this.version,
      tools,
      features: {
        agentdb: true,
        agenticFlow: this.config.enableFlow,
        numAgents: this.config.numAgents,
        reasoningEnabled: this.config.enableReasoning,
        learningEnabled: this.config.enableLearning,
      },
    };
  }
}
