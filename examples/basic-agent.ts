/**
 * Basic agent example
 */

import { Agent, AgentConfig, Task } from '../src/index.js';

async function main() {
  console.log('🤖 Basic Agent Example\n');

  // Create agent configuration
  const config: AgentConfig = {
    id: 'basic-agent-1',
    name: 'Basic Robot Agent',
    capabilities: ['move', 'sense', 'process'],
    maxTasks: 5,
    sensors: ['lidar', 'camera']
  };

  // Create agent
  const agent = new Agent(config);

  // Set up event listeners
  agent.on('started', () => {
    console.log('✓ Agent started');
  });

  agent.on('taskAdded', (data) => {
    console.log(`✓ Task added: ${data.task.id}`);
  });

  agent.on('taskCompleted', (data) => {
    console.log(`✓ Task completed: ${data.task.id}`);
  });

  // Start the agent
  await agent.start();

  // Add some tasks
  const task1: Task = {
    id: 'move-task-1',
    type: 'move',
    priority: 1,
    params: {
      target: { x: 10, y: 20, z: 0 },
      speed: 1.0
    },
    status: 'pending'
  };

  const task2: Task = {
    id: 'sense-task-1',
    type: 'sense',
    priority: 2,
    params: {
      sensors: ['lidar', 'camera']
    },
    status: 'pending'
  };

  agent.addTask(task1);
  agent.addTask(task2);

  // Wait for tasks to complete
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Get agent state
  const state = agent.getState();
  console.log('\nFinal Agent State:');
  console.log('  Position:', state.pose.position);
  console.log('  Status:', state.status);
  console.log('  Sensors:', state.sensors.size);

  // Stop the agent
  await agent.stop();
  console.log('\n✓ Example completed');
}

main().catch(console.error);
