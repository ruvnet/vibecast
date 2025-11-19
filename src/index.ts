/**
 * Main entry point for agentic-robotics framework
 */

export { Agent } from './core/Agent.js';
export { AgentController } from './core/AgentController.js';
export { RobotController } from './robotics/RobotController.js';
export { SensorManager, SensorConfig } from './robotics/SensorManager.js';

export {
  Position3D,
  Orientation,
  Pose,
  SensorData,
  RobotState,
  Task,
  AgentConfig,
  MotionCommand,
  AgentMessage
} from './types/index.js';

// Version
export const VERSION = '1.0.0';

// Default exports for convenience
export { AgentController as default } from './core/AgentController.js';
