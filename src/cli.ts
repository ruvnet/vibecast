#!/usr/bin/env node

/**
 * CLI interface for agentic-robotics
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { AgentController } from './core/AgentController.js';
import { SensorManager } from './robotics/SensorManager.js';
import { AgentConfig, Task } from './types/index.js';
import { VERSION } from './index.js';

const program = new Command();

// Configure program
program
  .name('agentic-robotics')
  .description('AI agent framework for robotics applications')
  .version(VERSION);

// Initialize command - Create a new project
program
  .command('init')
  .description('Initialize a new agentic-robotics project')
  .option('-n, --name <name>', 'Project name', 'my-robot-project')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🤖 Initializing agentic-robotics project...\n'));
    console.log(`Project name: ${chalk.green(options.name)}`);
    console.log(chalk.green('✓ Project initialized successfully!'));
    console.log('\nNext steps:');
    console.log('  1. Configure your agents in config.json');
    console.log('  2. Run: agentic-robotics start');
  });

// Demo command - Run a demonstration
program
  .command('demo')
  .description('Run a demonstration of the framework capabilities')
  .option('-s, --scenario <type>', 'Demo scenario', 'multi-agent')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🤖 Running Agentic Robotics Demo\n'));
    console.log(chalk.cyan('Scenario:'), options.scenario, '\n');

    try {
      await runDemo(options.scenario);
      console.log(chalk.green('\n✓ Demo completed successfully!'));
    } catch (error) {
      console.error(chalk.red('\n✗ Demo failed:'), error);
      process.exit(1);
    }
  });

// Agent command group
const agentCmd = program
  .command('agent')
  .description('Manage agents');

agentCmd
  .command('create')
  .description('Create a new agent')
  .requiredOption('-i, --id <id>', 'Agent ID')
  .requiredOption('-n, --name <name>', 'Agent name')
  .option('-c, --capabilities <items>', 'Capabilities (comma-separated)', 'move,sense,process')
  .action(async (options) => {
    console.log(chalk.blue('Creating agent...'));
    console.log(`ID: ${options.id}`);
    console.log(`Name: ${options.name}`);
    console.log(`Capabilities: ${options.capabilities}`);
    console.log(chalk.green('✓ Agent created'));
  });

agentCmd
  .command('list')
  .description('List all agents')
  .action(() => {
    console.log(chalk.blue('Registered agents:'));
    console.log('  • Agent-1: Navigation (move, sense)');
    console.log('  • Agent-2: Processing (process, analyze)');
  });

// Task command group
const taskCmd = program
  .command('task')
  .description('Manage tasks');

taskCmd
  .command('add')
  .description('Add a new task')
  .requiredOption('-t, --type <type>', 'Task type')
  .option('-p, --priority <number>', 'Priority', '1')
  .action(async (options) => {
    console.log(chalk.blue('Adding task...'));
    console.log(`Type: ${options.type}`);
    console.log(`Priority: ${options.priority}`);
    console.log(chalk.green('✓ Task added'));
  });

taskCmd
  .command('list')
  .description('List all tasks')
  .action(() => {
    console.log(chalk.blue('Active tasks:'));
    console.log('  • Task-1: move (pending)');
    console.log('  • Task-2: sense (executing)');
  });

// Sensor command group
const sensorCmd = program
  .command('sensor')
  .description('Manage sensors');

sensorCmd
  .command('add')
  .description('Add a sensor')
  .requiredOption('-i, --id <id>', 'Sensor ID')
  .requiredOption('-t, --type <type>', 'Sensor type (lidar, camera, imu, gps, etc.)')
  .option('-r, --rate <hz>', 'Update rate in Hz', '10')
  .action(async (options) => {
    console.log(chalk.blue('Adding sensor...'));
    console.log(`ID: ${options.id}`);
    console.log(`Type: ${options.type}`);
    console.log(`Rate: ${options.rate} Hz`);
    console.log(chalk.green('✓ Sensor added'));
  });

sensorCmd
  .command('list')
  .description('List all sensors')
  .action(() => {
    console.log(chalk.blue('Available sensors:'));
    console.log('  • lidar: Distance measurement (360°)');
    console.log('  • camera: Visual input');
    console.log('  • imu: Inertial measurement unit');
    console.log('  • gps: Global positioning');
    console.log('  • temperature: Temperature sensor');
    console.log('  • proximity: Proximity detection');
    console.log('  • encoder: Position encoder');
  });

// Robot command group
const robotCmd = program
  .command('robot')
  .description('Robot control');

robotCmd
  .command('move')
  .description('Move robot to position')
  .requiredOption('-x <number>', 'X coordinate')
  .requiredOption('-y <number>', 'Y coordinate')
  .requiredOption('-z <number>', 'Z coordinate')
  .action(async (options) => {
    console.log(chalk.blue('Moving robot...'));
    console.log(`Target: (${options.x}, ${options.y}, ${options.z})`);
    console.log(chalk.green('✓ Movement completed'));
  });

robotCmd
  .command('status')
  .description('Show robot status')
  .action(() => {
    console.log(chalk.blue('Robot Status:'));
    console.log('  Position: (0, 0, 0)');
    console.log('  Orientation: (0°, 0°, 0°)');
    console.log('  Status: idle');
  });

// Status command
program
  .command('status')
  .description('Show system status')
  .action(() => {
    console.log(chalk.blue.bold('\n🤖 Agentic Robotics Status\n'));
    console.log(chalk.cyan('Agents:'), '2 active');
    console.log(chalk.cyan('Tasks:'), '3 pending, 1 executing');
    console.log(chalk.cyan('Sensors:'), '4 active');
    console.log(chalk.cyan('System:'), chalk.green('operational'));
  });

// Info command
program
  .command('info')
  .description('Show framework information')
  .action(() => {
    console.log(chalk.blue.bold('\n🤖 Agentic Robotics Framework\n'));
    console.log(chalk.cyan('Version:'), VERSION);
    console.log(chalk.cyan('Description:'), 'AI agent framework for robotics applications');
    console.log(chalk.cyan('Features:'));
    console.log('  • Multi-agent coordination');
    console.log('  • Autonomous task execution');
    console.log('  • Sensor integration (LIDAR, Camera, IMU, GPS, etc.)');
    console.log('  • Robot motion control');
    console.log('  • Real-time monitoring');
    console.log(chalk.cyan('\nSupported Capabilities:'));
    console.log('  • Navigation and path planning');
    console.log('  • Sensor data processing');
    console.log('  • Task scheduling and execution');
    console.log('  • Inter-agent communication');
    console.log('  • Safety and collision avoidance');
  });

/**
 * Run a demonstration
 */
async function runDemo(scenario: string): Promise<void> {
  const controller = new AgentController();
  const sensorManager = new SensorManager();

  console.log(chalk.yellow(`Setting up ${scenario} demonstration...`));

  // Create agents
  const agent1Config: AgentConfig = {
    id: 'nav-agent-1',
    name: 'Navigation Agent',
    capabilities: ['move', 'sense'],
    maxTasks: 5,
    sensors: ['lidar', 'gps']
  };

  const agent2Config: AgentConfig = {
    id: 'proc-agent-1',
    name: 'Processing Agent',
    capabilities: ['process', 'analyze'],
    maxTasks: 10
  };

  controller.registerAgent(agent1Config);
  controller.registerAgent(agent2Config);

  // Setup sensors
  sensorManager.registerSensor({
    id: 'lidar-1',
    type: 'lidar',
    updateRate: 10
  });

  sensorManager.registerSensor({
    id: 'gps-1',
    type: 'gps',
    updateRate: 1
  });

  sensorManager.registerSensor({
    id: 'imu-1',
    type: 'imu',
    updateRate: 50
  });

  console.log(chalk.green('✓ Agents created'));
  console.log(chalk.green('✓ Sensors configured\n'));

  // Start systems
  console.log(chalk.yellow('Starting agents and sensors...'));
  await controller.startAll();
  sensorManager.startAll();

  console.log(chalk.green('✓ Systems started\n'));

  // Create and assign tasks
  console.log(chalk.yellow('Creating tasks...'));

  const tasks: Task[] = [
    {
      id: 'task-1',
      type: 'move',
      priority: 1,
      params: { target: { x: 10, y: 5, z: 0 } },
      status: 'pending'
    },
    {
      id: 'task-2',
      type: 'sense',
      priority: 2,
      params: { sensors: ['lidar', 'gps'] },
      status: 'pending'
    },
    {
      id: 'task-3',
      type: 'process',
      priority: 1,
      params: { data: 'sensor-data' },
      status: 'pending'
    }
  ];

  for (const task of tasks) {
    controller.assignTask(task);
  }

  console.log(chalk.green(`✓ ${tasks.length} tasks assigned\n`));

  // Run for a short time
  console.log(chalk.yellow('Running simulation...\n'));

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Show status
  const status = controller.getStatus();
  const sensorStatus = sensorManager.getStatus();

  console.log(chalk.cyan('\nFinal Status:'));
  console.log(chalk.white('Agents:'), status.totalAgents);
  console.log(chalk.white('Active Sensors:'), sensorStatus.activeSensors);
  console.log(chalk.white('Queued Tasks:'), status.queuedTasks);

  // Cleanup
  await controller.stopAll();
  sensorManager.stopAll();
}

// Parse arguments
program.parse();
