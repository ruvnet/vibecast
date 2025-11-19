# Agentic Robotics

AI agent framework for robotics applications with autonomous control, sensor integration, and multi-agent coordination.

## Features

- **Multi-Agent System**: Coordinate multiple AI agents with different capabilities
- **Autonomous Operation**: Self-directed task execution and decision-making
- **Sensor Integration**: Support for LIDAR, Camera, IMU, GPS, Temperature, Proximity, and Encoder sensors
- **Robot Control**: Motion planning and execution with safety features
- **Task Management**: Priority-based task scheduling and assignment
- **Inter-Agent Communication**: Message passing between agents
- **Real-time Monitoring**: Event-driven status updates and monitoring
- **TypeScript**: Full type safety and modern JavaScript features

## Installation

### Global Installation
```bash
npm install -g agentic-robotics
```

### Using npx (no installation required)
```bash
npx agentic-robotics --help
```

### Project Dependency
```bash
npm install agentic-robotics
```

## Quick Start

### CLI Commands

```bash
# Show help
npx agentic-robotics --help

# Initialize a new project
npx agentic-robotics init --name my-robot-project

# Run a demonstration
npx agentic-robotics demo

# Show framework information
npx agentic-robotics info

# Show system status
npx agentic-robotics status

# Agent management
npx agentic-robotics agent create --id agent1 --name "Navigator"
npx agentic-robotics agent list

# Task management
npx agentic-robotics task add --type move --priority 1
npx agentic-robotics task list

# Sensor management
npx agentic-robotics sensor add --id lidar1 --type lidar --rate 10
npx agentic-robotics sensor list

# Robot control
npx agentic-robotics robot move -x 10 -y 20 -z 5
npx agentic-robotics robot status
```

## Usage Examples

### Basic Agent

```typescript
import { Agent, AgentConfig, Task } from 'agentic-robotics';

const config: AgentConfig = {
  id: 'agent-1',
  name: 'Navigation Agent',
  capabilities: ['move', 'sense'],
  maxTasks: 5,
  sensors: ['lidar', 'gps']
};

const agent = new Agent(config);
await agent.start();

const task: Task = {
  id: 'task-1',
  type: 'move',
  priority: 1,
  params: { target: { x: 10, y: 20, z: 0 } },
  status: 'pending'
};

agent.addTask(task);
```

### Multi-Agent Coordination

```typescript
import { AgentController, AgentConfig } from 'agentic-robotics';

const controller = new AgentController();

// Register multiple agents
controller.registerAgent({
  id: 'nav-1',
  name: 'Navigator',
  capabilities: ['move', 'navigate'],
  maxTasks: 3
});

controller.registerAgent({
  id: 'sensor-1',
  name: 'Sensor Agent',
  capabilities: ['sense'],
  maxTasks: 5,
  sensors: ['lidar', 'camera']
});

await controller.startAll();

// Tasks are automatically assigned to capable agents
controller.assignTask(task);
```

### Robot Control

```typescript
import { RobotController, MotionCommand } from 'agentic-robotics';

const robot = new RobotController('robot-1');

const moveCmd: MotionCommand = {
  type: 'move',
  target: { x: 10, y: 20, z: 5 },
  speed: 1.0
};

await robot.executeMotion(moveCmd);
```

### Sensor Integration

```typescript
import { SensorManager } from 'agentic-robotics';

const sensorManager = new SensorManager();

// Register sensors
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

// Start collecting data
sensorManager.startAll();

// Listen for updates
sensorManager.on('sensorUpdate', (data) => {
  console.log(`Sensor ${data.sensorId}:`, data.data.value);
});
```

## Supported Sensors

- **LIDAR**: 360° distance measurements
- **Camera**: Visual input capture
- **IMU**: Inertial Measurement Unit (accelerometer + gyroscope)
- **GPS**: Global positioning
- **Temperature**: Temperature monitoring
- **Proximity**: Short-range obstacle detection
- **Encoder**: Position and velocity tracking

## Core Concepts

### Agents
Autonomous entities that can execute tasks based on their capabilities. Each agent:
- Has a unique ID and set of capabilities
- Can handle multiple tasks concurrently
- Communicates with other agents
- Maintains its own state

### Tasks
Units of work that need to be executed. Tasks have:
- Type (matching agent capabilities)
- Priority level
- Parameters
- Status (pending, executing, completed, failed)

### Agent Controller
Manages multiple agents and handles:
- Agent registration and lifecycle
- Task assignment and distribution
- Inter-agent communication
- System status monitoring

### Robot Controller
Handles physical robot control:
- Motion commands (move, rotate, stop)
- Position and orientation tracking
- Safety checks
- Real-time updates

### Sensor Manager
Manages sensor data collection:
- Sensor registration
- Data collection at specified rates
- Real-time data streaming
- Multiple sensor types

## API Reference

### AgentConfig
```typescript
interface AgentConfig {
  id: string;
  name: string;
  capabilities: string[];
  maxTasks: number;
  sensors?: string[];
}
```

### Task
```typescript
interface Task {
  id: string;
  type: string;
  priority: number;
  params: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  assignedAgent?: string;
}
```

### MotionCommand
```typescript
interface MotionCommand {
  type: 'move' | 'rotate' | 'stop' | 'custom';
  target?: Position3D | Orientation;
  speed?: number;
  params?: Record<string, any>;
}
```

## Examples

Run the included examples:

```bash
# Build the project
npm run build

# Run examples
node dist/examples/basic-agent.js
node dist/examples/multi-agent.js
node dist/examples/robot-control.js
node dist/examples/sensor-integration.js
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run CLI locally
npm start
```

## Architecture

```
agentic-robotics/
├── src/
│   ├── core/
│   │   ├── Agent.ts              # Core agent implementation
│   │   └── AgentController.ts    # Multi-agent management
│   ├── robotics/
│   │   ├── RobotController.ts    # Robot motion control
│   │   └── SensorManager.ts      # Sensor integration
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   ├── cli.ts                     # CLI interface
│   └── index.ts                   # Main exports
├── examples/                      # Usage examples
└── dist/                          # Compiled output
```

## Contributing

Contributions are welcome! This project is part of the Weekly Vibecast Live coding sessions with rUv.

## License

MIT License - see LICENSE file for details

## Author

rUv

## Links

- Repository: https://github.com/ruvnet/vibecast
- Weekly Vibecast sessions: Check branches for each week's content 
