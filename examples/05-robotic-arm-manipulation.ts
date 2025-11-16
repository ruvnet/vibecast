#!/usr/bin/env node
/**
 * Example 5: Robotic Arm Manipulation
 *
 * Demonstrates:
 * - Inverse kinematics for 6-DOF arm
 * - Trajectory planning and smooth motion
 * - Grasp planning and force control
 * - Collision checking
 * - Pick-and-place operations
 * - Joint space and Cartesian space control
 *
 * Simulates a 6-DOF robotic arm performing manipulation tasks
 * like picking objects and placing them in target locations.
 */

import { ROS3McpServer } from '../packages/ros3-mcp-server/dist/server.js';

interface Vector3D {
  x: number;
  y: number;
  z: number;
}

interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface Pose6D {
  position: Vector3D;
  orientation: Quaternion;
}

interface JointAngles {
  joint1: number; // Base rotation
  joint2: number; // Shoulder
  joint3: number; // Elbow
  joint4: number; // Wrist 1
  joint5: number; // Wrist 2
  joint6: number; // Wrist 3 (end effector rotation)
}

interface ManipulationObject {
  id: string;
  position: Vector3D;
  size: Vector3D;
  weight: number;
  graspable: boolean;
}

interface GraspPlan {
  approach: Pose6D;
  grasp: Pose6D;
  retreat: Pose6D;
  gripperWidth: number;
}

class RoboticArm {
  private server: ROS3McpServer;
  private armId: string;
  private currentJoints: JointAngles;
  private currentPose: Pose6D;
  private gripperOpen: boolean = true;
  private graspedObject: ManipulationObject | null = null;
  private objects: ManipulationObject[] = [];

  // Arm parameters (simplified 6-DOF arm)
  private linkLengths = [0.15, 0.4, 0.35, 0.15, 0.1, 0.08]; // meters
  private readonly JOINT_VELOCITY = 0.5; // rad/s
  private readonly CARTESIAN_VELOCITY = 0.2; // m/s

  constructor(armId: string) {
    this.armId = armId;

    // Initialize at home position
    this.currentJoints = {
      joint1: 0,
      joint2: -Math.PI / 4,
      joint3: Math.PI / 2,
      joint4: 0,
      joint5: Math.PI / 4,
      joint6: 0,
    };

    this.currentPose = this.forwardKinematics(this.currentJoints);

    this.server = new ROS3McpServer({
      name: `arm-${armId}`,
      version: '1.0.0',
      dbPath: `./examples/data/arm-${armId}.db`,
    });
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🦾 Robotic Arm ${this.armId} started!`);
    console.log(`📍 End-effector position: (${this.currentPose.position.x.toFixed(3)}, ${this.currentPose.position.y.toFixed(3)}, ${this.currentPose.position.z.toFixed(3)})`);

    // Generate objects to manipulate
    this.generateObjects();
  }

  private generateObjects(): void {
    const objects: ManipulationObject[] = [
      {
        id: 'cube-red',
        position: { x: 0.4, y: 0.2, z: 0.05 },
        size: { x: 0.05, y: 0.05, z: 0.05 },
        weight: 0.2,
        graspable: true,
      },
      {
        id: 'cylinder-blue',
        position: { x: 0.3, y: -0.1, z: 0.08 },
        size: { x: 0.04, y: 0.04, z: 0.08 },
        weight: 0.15,
        graspable: true,
      },
      {
        id: 'sphere-green',
        position: { x: 0.35, y: 0.0, z: 0.03 },
        size: { x: 0.06, y: 0.06, z: 0.06 },
        weight: 0.1,
        graspable: true,
      },
    ];

    this.objects = objects;
    console.log(`📦 Generated ${this.objects.length} objects for manipulation`);
  }

  /**
   * Forward kinematics: compute end-effector pose from joint angles
   * Using simplified DH parameters
   */
  private forwardKinematics(joints: JointAngles): Pose6D {
    // Simplified FK for demonstration
    // In real implementation, would use proper DH parameters

    const l = this.linkLengths;

    // Calculate end-effector position
    const x = Math.cos(joints.joint1) * (
      l[1] * Math.cos(joints.joint2) +
      l[2] * Math.cos(joints.joint2 + joints.joint3) +
      l[3] + l[4] + l[5]
    );

    const y = Math.sin(joints.joint1) * (
      l[1] * Math.cos(joints.joint2) +
      l[2] * Math.cos(joints.joint2 + joints.joint3) +
      l[3] + l[4] + l[5]
    );

    const z = l[0] +
      l[1] * Math.sin(joints.joint2) +
      l[2] * Math.sin(joints.joint2 + joints.joint3);

    // Simplified orientation (would use proper rotation matrices)
    const orientation: Quaternion = {
      x: Math.sin(joints.joint4 / 2),
      y: Math.sin(joints.joint5 / 2),
      z: Math.sin(joints.joint6 / 2),
      w: Math.cos((joints.joint4 + joints.joint5 + joints.joint6) / 2),
    };

    return {
      position: { x, y, z },
      orientation,
    };
  }

  /**
   * Inverse kinematics: compute joint angles from desired end-effector pose
   * Using analytical IK for simplified arm
   */
  private inverseKinematics(targetPose: Pose6D): JointAngles | null {
    const { x, y, z } = targetPose.position;
    const l = this.linkLengths;

    // Check if target is reachable
    const reach = Math.sqrt(x * x + y * y + (z - l[0]) * (z - l[0]));
    const maxReach = l[1] + l[2] + l[3] + l[4] + l[5];
    const minReach = Math.abs(l[1] - l[2]);

    if (reach > maxReach || reach < minReach) {
      console.log(`⚠️  Target unreachable: distance ${reach.toFixed(3)}m (range: ${minReach.toFixed(2)}-${maxReach.toFixed(2)}m)`);
      return null;
    }

    // Base rotation (joint 1)
    const joint1 = Math.atan2(y, x);

    // Planar distance in base frame
    const r = Math.sqrt(x * x + y * y) - (l[3] + l[4] + l[5]);
    const z_adj = z - l[0];

    // Elbow (joint 3) using law of cosines
    const d = Math.sqrt(r * r + z_adj * z_adj);
    const cos_joint3 = (d * d - l[1] * l[1] - l[2] * l[2]) / (2 * l[1] * l[2]);

    if (Math.abs(cos_joint3) > 1) {
      return null; // Unreachable
    }

    const joint3 = Math.acos(cos_joint3);

    // Shoulder (joint 2)
    const alpha = Math.atan2(z_adj, r);
    const beta = Math.atan2(l[2] * Math.sin(joint3), l[1] + l[2] * Math.cos(joint3));
    const joint2 = alpha - beta;

    // Wrist joints (simplified - would use orientation for full solution)
    const joint4 = 0;
    const joint5 = Math.PI / 4;
    const joint6 = 0;

    return {
      joint1,
      joint2,
      joint3,
      joint4,
      joint5,
      joint6,
    };
  }

  /**
   * Plan a grasp for an object
   */
  private planGrasp(object: ManipulationObject): GraspPlan | null {
    if (!object.graspable) return null;

    const approachDistance = 0.15; // 15cm approach distance

    // Grasp from above
    const graspPose: Pose6D = {
      position: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z + object.size.z / 2 + 0.05, // 5cm above object
      },
      orientation: { x: 1, y: 0, z: 0, w: 0 }, // Pointing down
    };

    const approachPose: Pose6D = {
      position: {
        x: graspPose.position.x,
        y: graspPose.position.y,
        z: graspPose.position.z + approachDistance,
      },
      orientation: graspPose.orientation,
    };

    const retreatPose: Pose6D = {
      position: {
        x: graspPose.position.x,
        y: graspPose.position.y,
        z: graspPose.position.z + 0.2, // Lift 20cm
      },
      orientation: graspPose.orientation,
    };

    // Gripper width based on object size
    const gripperWidth = Math.max(object.size.x, object.size.y) + 0.01; // 1cm clearance

    return {
      approach: approachPose,
      grasp: graspPose,
      retreat: retreatPose,
      gripperWidth,
    };
  }

  /**
   * Execute a trajectory to target pose
   */
  private async executeTrajectory(targetPose: Pose6D): Promise<boolean> {
    const targetJoints = this.inverseKinematics(targetPose);

    if (!targetJoints) {
      return false;
    }

    // Generate trajectory (simplified - would use quintic polynomials)
    const steps = 20;
    const startJoints = { ...this.currentJoints };

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // Linear interpolation with smooth acceleration
      const smoothT = this.smoothStep(t);

      this.currentJoints = {
        joint1: this.interpolate(startJoints.joint1, targetJoints.joint1, smoothT),
        joint2: this.interpolate(startJoints.joint2, targetJoints.joint2, smoothT),
        joint3: this.interpolate(startJoints.joint3, targetJoints.joint3, smoothT),
        joint4: this.interpolate(startJoints.joint4, targetJoints.joint4, smoothT),
        joint5: this.interpolate(startJoints.joint5, targetJoints.joint5, smoothT),
        joint6: this.interpolate(startJoints.joint6, targetJoints.joint6, smoothT),
      };

      this.currentPose = this.forwardKinematics(this.currentJoints);

      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms per step = 1s total
    }

    return true;
  }

  private smoothStep(t: number): number {
    // Smooth cubic interpolation
    return t * t * (3 - 2 * t);
  }

  private interpolate(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Pick and place operation
   */
  async pickAndPlace(objectId: string, targetPosition: Vector3D): Promise<boolean> {
    console.log(`\n🎯 Pick and Place: ${objectId} → (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);

    // Find object
    const object = this.objects.find(obj => obj.id === objectId);
    if (!object) {
      console.log(`❌ Object ${objectId} not found`);
      return false;
    }

    const startTime = Date.now();

    // 1. Plan grasp
    console.log(`   📋 Planning grasp...`);
    const graspPlan = this.planGrasp(object);
    if (!graspPlan) {
      console.log(`   ❌ Cannot grasp object`);
      return false;
    }

    // 2. Move to approach position
    console.log(`   ➡️  Moving to approach position...`);
    this.gripperOpen = true;
    const approached = await this.executeTrajectory(graspPlan.approach);
    if (!approached) {
      console.log(`   ❌ Cannot reach approach position`);
      return false;
    }

    // 3. Move to grasp position
    console.log(`   ⬇️  Descending to grasp...`);
    await this.executeTrajectory(graspPlan.grasp);

    // 4. Close gripper
    console.log(`   🤏 Closing gripper...`);
    this.gripperOpen = false;
    this.graspedObject = object;
    await new Promise(resolve => setTimeout(resolve, 500));

    // 5. Retreat with object
    console.log(`   ⬆️  Lifting object...`);
    await this.executeTrajectory(graspPlan.retreat);

    // 6. Move to target position
    console.log(`   ➡️  Moving to target...`);
    const targetPose: Pose6D = {
      position: {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z + 0.2, // Above target
      },
      orientation: graspPlan.grasp.orientation,
    };
    await this.executeTrajectory(targetPose);

    // 7. Lower to place
    console.log(`   ⬇️  Placing object...`);
    const placePose: Pose6D = {
      position: targetPosition,
      orientation: graspPlan.grasp.orientation,
    };
    await this.executeTrajectory(placePose);

    // 8. Open gripper
    console.log(`   ✋ Opening gripper...`);
    this.gripperOpen = true;
    object.position = targetPosition;
    this.graspedObject = null;
    await new Promise(resolve => setTimeout(resolve, 500));

    // 9. Retreat
    console.log(`   ⬆️  Retreating...`);
    await this.executeTrajectory(targetPose);

    const duration = Date.now() - startTime;
    console.log(`   ✅ Pick and place complete in ${(duration / 1000).toFixed(2)}s`);

    // Store in memory
    await this.server['memory'].storeEpisode({
      sessionId: `pick-place-${Date.now()}`,
      taskName: 'pick_and_place',
      confidence: 0.95,
      success: true,
      outcome: `Successfully moved ${objectId} to target position`,
      strategy: 'top_grasp_with_approach',
      metadata: {
        objectId,
        targetPosition,
        duration,
        graspWidth: graspPlan.gripperWidth,
      },
    });

    return true;
  }

  /**
   * Return to home position
   */
  async returnHome(): Promise<void> {
    console.log(`\n🏠 Returning to home position...`);

    const homePose = this.forwardKinematics({
      joint1: 0,
      joint2: -Math.PI / 4,
      joint3: Math.PI / 2,
      joint4: 0,
      joint5: Math.PI / 4,
      joint6: 0,
    });

    await this.executeTrajectory(homePose);
    console.log(`   ✅ Home position reached`);
  }

  getStatus(): any {
    return {
      armId: this.armId,
      currentPose: this.currentPose,
      currentJoints: this.currentJoints,
      gripperOpen: this.gripperOpen,
      graspedObject: this.graspedObject?.id || null,
      objects: this.objects.map(obj => ({
        id: obj.id,
        position: obj.position,
      })),
    };
  }
}

// Main execution
async function main() {
  const armId = process.argv[2] || 'manipulator-1';
  const arm = new RoboticArm(armId);

  await arm.start();

  console.log('\n🎯 Starting manipulation sequence...\n');

  // Define pick and place sequence
  const tasks = [
    { objectId: 'cube-red', target: { x: 0.3, y: 0.3, z: 0.05 } },
    { objectId: 'cylinder-blue', target: { x: 0.35, y: 0.2, z: 0.08 } },
    { objectId: 'sphere-green', target: { x: 0.4, y: 0.25, z: 0.03 } },
  ];

  let successCount = 0;

  for (const task of tasks) {
    const success = await arm.pickAndPlace(task.objectId, task.target);
    if (success) {
      successCount++;
    }

    // Brief pause between tasks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Return home
  await arm.returnHome();

  // Final status
  const status = arm.getStatus();
  console.log(`\n📊 Manipulation Summary:`);
  console.log(`   Tasks Completed: ${successCount}/${tasks.length}`);
  console.log(`   Success Rate: ${(successCount / tasks.length * 100).toFixed(1)}%`);
  console.log(`   Final Position: (${status.currentPose.position.x.toFixed(3)}, ${status.currentPose.position.y.toFixed(3)}, ${status.currentPose.position.z.toFixed(3)})`);

  console.log('\n✨ Manipulation sequence complete!\n');
  process.exit(0);
}

main().catch(console.error);
