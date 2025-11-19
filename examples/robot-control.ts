/**
 * Robot control example
 */

import { RobotController, MotionCommand } from '../src/index.js';

async function main() {
  console.log('🤖 Robot Control Example\n');

  // Create robot controller
  const robot = new RobotController('robot-1');

  // Set up event listeners
  robot.on('motionStarted', (data) => {
    console.log(`→ Motion started: ${data.command.type}`);
  });

  robot.on('motionCompleted', (data) => {
    console.log(`✓ Motion completed: ${data.command.type}`);
  });

  robot.on('positionUpdate', (data) => {
    const pos = data.position;
    console.log(`  Position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
  });

  // Show initial status
  console.log('Initial Status:', robot.getStatus());
  console.log();

  // Execute movement commands
  console.log('Command 1: Move to (10, 20, 5)');
  const moveCmd1: MotionCommand = {
    type: 'move',
    target: { x: 10, y: 20, z: 5 },
    speed: 1.0
  };
  await robot.executeMotion(moveCmd1);

  console.log('\nCommand 2: Move to (-5, 15, 10)');
  const moveCmd2: MotionCommand = {
    type: 'move',
    target: { x: -5, y: 15, z: 10 },
    speed: 0.8
  };
  await robot.executeMotion(moveCmd2);

  console.log('\nCommand 3: Rotate');
  const rotateCmd: MotionCommand = {
    type: 'rotate',
    target: { roll: 0, pitch: 0, yaw: 90 },
    speed: 1.0
  };
  await robot.executeMotion(rotateCmd);

  // Show final status
  console.log('\nFinal Status:', robot.getStatus());

  const finalPose = robot.getPose();
  console.log('\nFinal Pose:');
  console.log('  Position:', finalPose.position);
  console.log('  Orientation:', finalPose.orientation);

  console.log('\n✓ Example completed');
}

main().catch(console.error);
