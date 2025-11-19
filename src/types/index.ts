/**
 * Core types for agentic-robotics framework
 */

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Orientation {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface Pose {
  position: Position3D;
  orientation: Orientation;
}

export interface SensorData {
  timestamp: number;
  type: string;
  value: any;
}

export interface RobotState {
  id: string;
  pose: Pose;
  velocity: Position3D;
  sensors: Map<string, SensorData>;
  status: 'idle' | 'moving' | 'executing' | 'error';
  battery?: number;
}

export interface Task {
  id: string;
  type: string;
  priority: number;
  params: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  assignedAgent?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  capabilities: string[];
  maxTasks: number;
  sensors?: string[];
}

export interface MotionCommand {
  type: 'move' | 'rotate' | 'stop' | 'custom';
  target?: Position3D | Orientation;
  speed?: number;
  params?: Record<string, any>;
}

export interface AgentMessage {
  from: string;
  to: string;
  type: 'request' | 'response' | 'notification';
  content: any;
  timestamp: number;
}
