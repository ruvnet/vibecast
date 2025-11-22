/**
 * Swarm-Based Concurrent Code Development Approach
 * Executes tasks concurrently using swarm intelligence and shared memory
 */

const PerformanceTracker = require('../utils/performance-tracker');
const DatabaseHelper = require('../utils/database-helper');

class SwarmAgent {
  constructor(id, type = 'worker') {
    this.id = id;
    this.type = type; // 'queen' or 'worker'
    this.currentTask = null;
    this.completedTasks = 0;
    this.knowledge = new Map();
  }

  async executeTask(task, sharedMemory) {
    this.currentTask = task;

    // Access shared knowledge from memory
    const relatedKnowledge = await sharedMemory.getRelatedKnowledge(task);

    // Simulate parallel work with shared learning
    const result = await this.performWork(task, relatedKnowledge);

    // Store learning back to shared memory
    await sharedMemory.storeKnowledge(task, result, this.id);

    this.completedTasks++;
    this.currentTask = null;

    return result;
  }

  async performWork(task, knowledge) {
    const start = Date.now();

    // Simulate intelligent work with knowledge reuse
    const speedBoost = knowledge.length > 0 ? 0.7 : 1.0; // 30% faster with knowledge
    const workTime = this.calculateWorkTime(task) * speedBoost;

    // Parallel CPU work (can be distributed)
    await this.simulateCPUWork(workTime);

    return {
      taskName: task,
      agentId: this.id,
      duration: Date.now() - start,
      knowledgeUsed: knowledge.length,
      linesOfCode: Math.floor(Math.random() * 100) + 50
    };
  }

  calculateWorkTime(taskName) {
    const lowerTask = taskName.toLowerCase();

    if (lowerTask.includes('test') || lowerTask.includes('validation')) {
      return 150; // Faster with parallel testing
    } else if (lowerTask.includes('implement') || lowerTask.includes('create')) {
      return 120;
    } else if (lowerTask.includes('add') || lowerTask.includes('write')) {
      return 100;
    } else {
      return 80;
    }
  }

  async simulateCPUWork(duration) {
    const start = Date.now();
    const data = [];

    while (Date.now() - start < duration) {
      for (let i = 0; i < 1000; i++) {
        data.push(Math.random() * Math.random());
      }
      if (data.length > 10000) {
        data.splice(0, 5000);
      }
    }
  }
}

class SharedMemory {
  constructor(dbHelper) {
    this.dbHelper = dbHelper;
    this.cache = new Map();
    this.knowledgeBase = [];
  }

  async getRelatedKnowledge(task) {
    // Check cache first
    if (this.cache.has(task)) {
      return this.cache.get(task);
    }

    // Search knowledge base for similar tasks
    const related = this.knowledgeBase.filter(k =>
      k.task.toLowerCase().includes(task.toLowerCase().split(' ')[0]) ||
      task.toLowerCase().includes(k.task.toLowerCase().split(' ')[0])
    );

    return related;
  }

  async storeKnowledge(task, result, agentId) {
    const knowledge = {
      task,
      result,
      agentId,
      timestamp: Date.now()
    };

    this.knowledgeBase.push(knowledge);
    this.cache.set(task, [knowledge]);

    // Store in database
    if (this.dbHelper) {
      try {
        await this.dbHelper.storeTaskMemory(`swarm_${task}`, result, 'swarm');
        await this.dbHelper.storeReasoning(
          `swarm_${task}`,
          `Task completed by agent ${agentId} with knowledge reuse`,
          'swarm'
        );
      } catch (error) {
        console.error('Error storing to database:', error.message);
      }
    }
  }

  getStats() {
    return {
      totalKnowledge: this.knowledgeBase.length,
      cacheSize: this.cache.size,
      knowledgeByAgent: this.groupByAgent()
    };
  }

  groupByAgent() {
    const grouped = {};
    this.knowledgeBase.forEach(k => {
      if (!grouped[k.agentId]) {
        grouped[k.agentId] = 0;
      }
      grouped[k.agentId]++;
    });
    return grouped;
  }
}

class ConcurrentExecutor {
  constructor(scenario, config = {}) {
    this.scenario = scenario;
    this.tracker = new PerformanceTracker(`Swarm Concurrent: ${scenario.name}`);
    this.dbHelper = new DatabaseHelper();
    this.sharedMemory = new SharedMemory(this.dbHelper);

    // Configuration
    this.config = {
      agentCount: config.agentCount || 4,
      queenEnabled: config.queenEnabled !== false,
      maxConcurrentTasks: config.maxConcurrentTasks || 6,
      reasoningBankEnabled: config.reasoningBankEnabled !== false
    };

    this.agents = [];
    this.results = [];
    this.sessionId = `swarm_${Date.now()}`;
  }

  async initialize() {
    console.log('🔌 Connecting to databases...');
    try {
      await this.dbHelper.connect();
      console.log('✅ Database connections established');
    } catch (error) {
      console.error('⚠️  Database connection failed, continuing without DB:', error.message);
    }

    // Create Queen agent if enabled
    if (this.config.queenEnabled) {
      this.agents.push(new SwarmAgent('queen', 'queen'));
    }

    // Create Worker agents
    for (let i = 0; i < this.config.agentCount; i++) {
      this.agents.push(new SwarmAgent(`worker_${i}`, 'worker'));
    }

    console.log(`🐝 Initialized ${this.agents.length} agents (${this.config.queenEnabled ? '1 queen, ' : ''}${this.config.agentCount} workers)`);
  }

  async execute() {
    console.log(`\n🚀 Starting Swarm Concurrent Execution: ${this.scenario.name}`);
    console.log(`Tasks: ${this.scenario.tasks.length}`);
    console.log(`Agents: ${this.agents.length}`);
    console.log(`Max Concurrent: ${this.config.maxConcurrentTasks}`);
    console.log('Approach: Concurrent execution with shared learning and memory\n');

    await this.initialize();

    this.tracker.start();

    // Execute tasks concurrently using agent pool
    await this.executeTasksConcurrently();

    this.tracker.end();

    // Store session data
    await this.storeSessionData();

    // Get database stats
    await this.printDatabaseStats();

    await this.dbHelper.close();

    return this.tracker.generateReport();
  }

  async executeTasksConcurrently() {
    const taskQueue = [...this.scenario.tasks];
    const activeTasks = new Map();

    while (taskQueue.length > 0 || activeTasks.size > 0) {
      // Start new tasks up to max concurrency
      while (taskQueue.length > 0 && activeTasks.size < this.config.maxConcurrentTasks) {
        const task = taskQueue.shift();
        const agent = this.getAvailableAgent();

        if (agent) {
          const taskId = `${this.scenario.id}_${task.replace(/\s+/g, '_')}`;
          const taskPromise = this.executeTask(task, taskId, agent);
          activeTasks.set(taskId, taskPromise);
        } else {
          taskQueue.unshift(task); // Put it back
          break;
        }
      }

      // Wait for at least one task to complete
      if (activeTasks.size > 0) {
        await Promise.race(activeTasks.values());

        // Clean up completed tasks
        for (const [taskId, promise] of activeTasks.entries()) {
          try {
            const result = await Promise.race([promise, Promise.resolve(null)]);
            if (result !== null) {
              activeTasks.delete(taskId);
            }
          } catch (error) {
            activeTasks.delete(taskId);
          }
        }
      }
    }
  }

  async executeTask(taskName, taskId, agent) {
    console.log(`⚡ [${agent.id}] Starting: ${taskName}`);
    this.tracker.recordTaskStart(taskId);

    try {
      const result = await agent.executeTask(taskName, this.sharedMemory);

      this.tracker.recordTaskEnd(taskId, true);
      this.results.push({
        taskId,
        taskName,
        agentId: agent.id,
        success: true,
        result
      });

      console.log(`✅ [${agent.id}] Completed: ${taskName} (${result.duration}ms)`);
      return result;
    } catch (error) {
      this.tracker.recordTaskEnd(taskId, false, error);
      this.results.push({
        taskId,
        taskName,
        agentId: agent.id,
        success: false,
        error: error.message
      });

      console.log(`❌ [${agent.id}] Failed: ${taskName} - ${error.message}`);
      throw error;
    }
  }

  getAvailableAgent() {
    return this.agents.find(agent => agent.currentTask === null);
  }

  async storeSessionData() {
    const memoryStats = this.sharedMemory.getStats();

    try {
      await this.dbHelper.storeHiveKnowledge(
        this.sessionId,
        {
          scenario: this.scenario.name,
          totalTasks: this.scenario.tasks.length,
          completedTasks: this.results.filter(r => r.success).length,
          memoryStats
        },
        this.agents.length
      );
    } catch (error) {
      console.error('Error storing session data:', error.message);
    }
  }

  async printDatabaseStats() {
    console.log('\n📊 Database Statistics:');

    try {
      const swarmStats = await this.dbHelper.getSwarmStats();
      console.log('Swarm Memory DB:');
      console.log(`  - Total Memories: ${swarmStats.totalMemories}`);
      console.log(`  - Reasoning Entries: ${swarmStats.totalReasoning}`);

      const hiveStats = await this.dbHelper.getHiveStats();
      console.log('Hive Mind DB:');
      console.log(`  - Sessions: ${hiveStats.totalSessions}`);
      console.log(`  - Collective Memories: ${hiveStats.totalMemories}`);
      console.log(`  - Consensus Decisions: ${hiveStats.totalDecisions}`);
    } catch (error) {
      console.error('Error fetching stats:', error.message);
    }

    const memStats = this.sharedMemory.getStats();
    console.log('Shared Memory:');
    console.log(`  - Knowledge Base Size: ${memStats.totalKnowledge}`);
    console.log(`  - Cache Size: ${memStats.cacheSize}`);
  }

  getResults() {
    return {
      approach: 'swarm-concurrent',
      scenario: this.scenario.name,
      agents: this.agents.length,
      results: this.results,
      performance: this.tracker.getResults(),
      memoryStats: this.sharedMemory.getStats()
    };
  }
}

module.exports = ConcurrentExecutor;
