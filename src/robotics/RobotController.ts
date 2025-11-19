/**
 * Robot Controller for hardware interface
 */

import { MotionCommand, Position3D, Orientation, Pose } from '../types/index.js';
import { EventEmitter } from 'events';

export class RobotController extends EventEmitter {
  private robotId: string;
  private currentPose: Pose;
  private isMoving: boolean;
  private safetyEnabled: boolean;

  constructor(robotId: string) {
    super();
    this.robotId = robotId;
    this.isMoving = false;
    this.safetyEnabled = true;

    this.currentPose = {
      position: { x: 0, y: 0, z: 0 },
      orientation: { roll: 0, pitch: 0, yaw: 0 }
    };
  }

  /**
   * Execute a motion command
   */
  async executeMotion(command: MotionCommand): Promise<void> {
    if (this.isMoving) {
      throw new Error('Robot is already moving');
    }

    this.isMoving = true;
    this.emit('motionStarted', { command });

    try {
      switch (command.type) {
        case 'move':
          await this.move(command.target as Position3D, command.speed);
          break;
        case 'rotate':
          await this.rotate(command.target as Orientation, command.speed);
          break;
        case 'stop':
          await this.stop();
          break;
        case 'custom':
          await this.executeCustomCommand(command.params || {});
          break;
        default:
          throw new Error(`Unknown motion command type: ${command.type}`);
      }

      this.emit('motionCompleted', { command });
    } catch (error) {
      this.emit('motionFailed', { command, error });
      throw error;
    } finally {
      this.isMoving = false;
    }
  }

  /**
   * Move to a target position
   */
  private async move(target: Position3D, speed: number = 1.0): Promise<void> {
    console.log(`Moving robot ${this.robotId} to position:`, target);

    // Safety check
    if (this.safetyEnabled && !this.isPositionSafe(target)) {
      throw new Error('Target position is not safe');
    }

    // Simulate movement with interpolation
    const steps = 10;
    const start = this.currentPose.position;

    for (let i = 1; i <= steps; i++) {
      const progress = (i / steps) * speed;
      this.currentPose.position = {
        x: start.x + (target.x - start.x) * progress,
        y: start.y + (target.y - start.y) * progress,
        z: start.z + (target.z - start.z) * progress
      };

      this.emit('positionUpdate', { position: this.currentPose.position });
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.currentPose.position = target;
    console.log(`Robot ${this.robotId} reached target position`);
  }

  /**
   * Rotate to a target orientation
   */
  private async rotate(target: Orientation, speed: number = 1.0): Promise<void> {
    console.log(`Rotating robot ${this.robotId} to orientation:`, target);

    // Simulate rotation
    const steps = 10;
    const start = this.currentPose.orientation;

    for (let i = 1; i <= steps; i++) {
      const progress = (i / steps) * speed;
      this.currentPose.orientation = {
        roll: start.roll + (target.roll - start.roll) * progress,
        pitch: start.pitch + (target.pitch - start.pitch) * progress,
        yaw: start.yaw + (target.yaw - start.yaw) * progress
      };

      this.emit('orientationUpdate', { orientation: this.currentPose.orientation });
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.currentPose.orientation = target;
    console.log(`Robot ${this.robotId} reached target orientation`);
  }

  /**
   * Stop all motion
   */
  private async stop(): Promise<void> {
    console.log(`Stopping robot ${this.robotId}`);
    this.isMoving = false;
    this.emit('stopped');
  }

  /**
   * Execute a custom command
   */
  private async executeCustomCommand(params: Record<string, any>): Promise<void> {
    console.log(`Executing custom command on robot ${this.robotId}:`, params);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Check if a position is safe
   */
  private isPositionSafe(position: Position3D): boolean {
    // Simple safety bounds check
    const maxBound = 100;
    const minBound = -100;

    return position.x >= minBound && position.x <= maxBound &&
           position.y >= minBound && position.y <= maxBound &&
           position.z >= minBound && position.z <= maxBound;
  }

  /**
   * Get current pose
   */
  getPose(): Pose {
    return { ...this.currentPose };
  }

  /**
   * Set safety mode
   */
  setSafetyMode(enabled: boolean): void {
    this.safetyEnabled = enabled;
    console.log(`Safety mode ${enabled ? 'enabled' : 'disabled'} for robot ${this.robotId}`);
  }

  /**
   * Emergency stop
   */
  emergencyStop(): void {
    console.warn(`EMERGENCY STOP activated for robot ${this.robotId}`);
    this.isMoving = false;
    this.emit('emergencyStop');
  }

  /**
   * Get robot status
   */
  getStatus(): any {
    return {
      robotId: this.robotId,
      pose: this.currentPose,
      isMoving: this.isMoving,
      safetyEnabled: this.safetyEnabled
    };
  }
}
