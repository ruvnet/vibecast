/**
 * Multi-agent coordination example
 */

import { AgentController, AgentConfig, Task } from '../src/index.js';

async function main() {
  console.log('🤖 Multi-Agent Coordination Example\n');

  const controller = new AgentController();

  // Create multiple agents with different capabilities
  const agents: AgentConfig[] = [
    {
      id: 'navigator-1',
      name: 'Navigation Agent 1',
      capabilities: ['move', 'navigate'],
      maxTasks: 3
    },
    {
      id: 'sensor-1',
      name: 'Sensor Agent 1',
      capabilities: ['sense', 'monitor'],
      maxTasks: 5,
      sensors: ['lidar', 'camera', 'imu']
    },
    {
      id: 'processor-1',
      name: 'Processing Agent 1',
      capabilities: ['process', 'analyze'],
      maxTasks: 10
    }
  ];

  // Register all agents
  console.log('Registering agents...');
  for (const config of agents) {
    controller.registerAgent(config);
  }

  // Set up event listeners
  controller.on('agentTaskCompleted', (data) => {
    console.log(`✓ Agent ${data.agentId} completed task ${data.task.id}`);
  });

  controller.on('agentTaskFailed', (data) => {
    console.error(`✗ Agent ${data.agentId} failed task ${data.task.id}`);
  });

  // Start all agents
  console.log('\nStarting agents...');
  await controller.startAll();

  // Create various tasks
  const tasks: Task[] = [
    {
      id: 'nav-1',
      type: 'move',
      priority: 1,
      params: { target: { x: 10, y: 10, z: 0 } },
      status: 'pending'
    },
    {
      id: 'sense-1',
      type: 'sense',
      priority: 2,
      params: { sensors: ['lidar', 'camera'] },
      status: 'pending'
    },
    {
      id: 'process-1',
      type: 'process',
      priority: 1,
      params: { data: 'sensor-readings' },
      status: 'pending'
    },
    {
      id: 'nav-2',
      type: 'navigate',
      priority: 1,
      params: { waypoints: [{ x: 5, y: 5, z: 0 }, { x: 15, y: 15, z: 0 }] },
      status: 'pending'
    },
    {
      id: 'analyze-1',
      type: 'analyze',
      priority: 3,
      params: { dataset: 'environment-map' },
      status: 'pending'
    }
  ];

  // Assign tasks (controller will distribute them based on capabilities)
  console.log('\nAssigning tasks...');
  for (const task of tasks) {
    const assigned = controller.assignTask(task);
    if (!assigned) {
      console.warn(`Task ${task.id} queued (no available agent)`);
    }
  }

  // Run simulation
  console.log('\nRunning multi-agent simulation...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Show status
  const status = controller.getStatus();
  console.log('\n=== Final Status ===');
  console.log(`Total Agents: ${status.totalAgents}`);
  console.log(`Queued Tasks: ${status.queuedTasks}`);
  console.log('\nAgent Details:');
  for (const agentStatus of status.agents) {
    console.log(`  ${agentStatus.name}:`);
    console.log(`    Status: ${agentStatus.state.status}`);
    console.log(`    Active Tasks: ${agentStatus.tasks}`);
    console.log(`    Position: (${agentStatus.state.pose.position.x}, ${agentStatus.state.pose.position.y}, ${agentStatus.state.pose.position.z})`);
  }

  // Stop all agents
  console.log('\nStopping agents...');
  await controller.stopAll();
  console.log('✓ Example completed');
}

main().catch(console.error);
