/**
 * Swarm Coordination example
 * Demonstrates multi-agent swarm execution patterns
 */

import {
  PubNubService,
  SwarmCoordinator,
  AgentTask,
  SwarmConfig
} from '../src';

async function main() {
  console.log('=== Swarm Coordination Example ===\n');

  // Initialize PubNub
  const pubnub = new PubNubService({
    publishKey: 'demo',
    subscribeKey: 'demo',
    userId: 'swarm-coordinator',
    logVerbosity: false,
  });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Create swarm configurations
  const parallelSwarmConfig: SwarmConfig = {
    swarmId: 'parallel-swarm',
    agents: [],
    strategy: 'parallel',
  };

  const sequentialSwarmConfig: SwarmConfig = {
    swarmId: 'sequential-swarm',
    agents: [],
    strategy: 'sequential',
  };

  const hierarchicalSwarmConfig: SwarmConfig = {
    swarmId: 'hierarchical-swarm',
    agents: [],
    strategy: 'hierarchical',
  };

  // Example 1: Parallel Swarm
  console.log('🐝 Creating Parallel Swarm...\n');
  const parallelSwarm = new SwarmCoordinator(pubnub, parallelSwarmConfig);

  // Create agents in swarm
  for (let i = 1; i <= 3; i++) {
    const agent = parallelSwarm.createAgent(`worker-${i}`);

    // Register task handlers
    agent.registerTaskHandler('compute', async (task: AgentTask) => {
      console.log(`   ⚙️  ${agent.getAgentId()} computing: ${task.payload.value}`);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
      return {
        result: task.payload.value * 2,
        computedBy: agent.getAgentId()
      };
    });
  }

  // Create parallel tasks
  const parallelTasks: AgentTask[] = [
    { taskId: 't1', agentId: '', type: 'compute', payload: { value: 10 } },
    { taskId: 't2', agentId: '', type: 'compute', payload: { value: 20 } },
    { taskId: 't3', agentId: '', type: 'compute', payload: { value: 30 } },
    { taskId: 't4', agentId: '', type: 'compute', payload: { value: 40 } },
    { taskId: 't5', agentId: '', type: 'compute', payload: { value: 50 } },
    { taskId: 't6', agentId: '', type: 'compute', payload: { value: 60 } },
  ];

  console.log('📋 Executing 6 tasks in parallel across 3 agents...\n');
  const startTime = Date.now();
  const parallelResults = await parallelSwarm.executeTasks(parallelTasks);
  const parallelDuration = Date.now() - startTime;

  console.log('\n✅ Parallel Swarm Results:');
  parallelResults.forEach((result, i) => {
    console.log(`   Task ${i + 1}: ${result.status} - ${JSON.stringify(result.result)}`);
  });
  console.log(`   Duration: ${parallelDuration}ms\n`);

  // Example 2: Sequential Swarm
  console.log('\n🔄 Creating Sequential Swarm...\n');
  const sequentialSwarm = new SwarmCoordinator(pubnub, sequentialSwarmConfig);

  // Create agents
  for (let i = 1; i <= 2; i++) {
    const agent = sequentialSwarm.createAgent(`sequential-worker-${i}`);

    agent.registerTaskHandler('process', async (task: AgentTask) => {
      console.log(`   🔧 ${agent.getAgentId()} processing step ${task.payload.step}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        step: task.payload.step,
        data: `Processed by ${agent.getAgentId()}`
      };
    });
  }

  const sequentialTasks: AgentTask[] = [
    { taskId: 's1', agentId: '', type: 'process', payload: { step: 1 } },
    { taskId: 's2', agentId: '', type: 'process', payload: { step: 2 } },
    { taskId: 's3', agentId: '', type: 'process', payload: { step: 3 } },
    { taskId: 's4', agentId: '', type: 'process', payload: { step: 4 } },
  ];

  console.log('📋 Executing 4 tasks sequentially...\n');
  const seqStartTime = Date.now();
  const sequentialResults = await sequentialSwarm.executeTasks(sequentialTasks);
  const sequentialDuration = Date.now() - seqStartTime;

  console.log('\n✅ Sequential Swarm Results:');
  sequentialResults.forEach((result, i) => {
    console.log(`   Task ${i + 1}: ${result.status} - ${JSON.stringify(result.result)}`);
  });
  console.log(`   Duration: ${sequentialDuration}ms\n`);

  // Example 3: Hierarchical Swarm with Dependencies
  console.log('\n🏗️  Creating Hierarchical Swarm...\n');
  const hierarchicalSwarm = new SwarmCoordinator(pubnub, hierarchicalSwarmConfig);

  // Create agents
  for (let i = 1; i <= 3; i++) {
    const agent = hierarchicalSwarm.createAgent(`hierarchical-worker-${i}`);

    agent.registerTaskHandler('build', async (task: AgentTask) => {
      console.log(`   🏗️  ${agent.getAgentId()} building: ${task.payload.component}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        component: task.payload.component,
        built: true
      };
    });
  }

  // Tasks with dependencies
  const hierarchicalTasks: AgentTask[] = [
    // Level 0: No dependencies
    { taskId: 'h1', agentId: '', type: 'build', payload: { component: 'foundation' } },
    { taskId: 'h2', agentId: '', type: 'build', payload: { component: 'framework' } },

    // Level 1: Depends on h1, h2
    { taskId: 'h3', agentId: '', type: 'build', payload: { component: 'walls' }, dependencies: ['h1'] },
    { taskId: 'h4', agentId: '', type: 'build', payload: { component: 'structure' }, dependencies: ['h2'] },

    // Level 2: Depends on h3, h4
    { taskId: 'h5', agentId: '', type: 'build', payload: { component: 'roof' }, dependencies: ['h3', 'h4'] },

    // Level 3: Depends on h5
    { taskId: 'h6', agentId: '', type: 'build', payload: { component: 'finishing' }, dependencies: ['h5'] },
  ];

  console.log('📋 Executing hierarchical tasks with dependencies...\n');
  const hierStartTime = Date.now();
  const hierarchicalResults = await hierarchicalSwarm.executeTasks(hierarchicalTasks);
  const hierarchicalDuration = Date.now() - hierStartTime;

  console.log('\n✅ Hierarchical Swarm Results:');
  hierarchicalResults.forEach((result, i) => {
    console.log(`   Task ${i + 1}: ${result.status} - ${JSON.stringify(result.result)}`);
  });
  console.log(`   Duration: ${hierarchicalDuration}ms\n`);

  // Summary
  console.log('\n📊 Performance Summary:');
  console.log(`   Parallel:      ${parallelDuration}ms for 6 tasks`);
  console.log(`   Sequential:    ${sequentialDuration}ms for 4 tasks`);
  console.log(`   Hierarchical:  ${hierarchicalDuration}ms for 6 tasks`);

  // Cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('\n🔌 Disconnecting...');
  pubnub.disconnect();
  console.log('✅ Done!\n');
}

// Run example
main().catch(console.error);
