#!/usr/bin/env node
/**
 * Example 6: Vision-Based Object Tracking
 *
 * Demonstrates:
 * - Real-time object detection and classification
 * - Visual tracking with Kalman filtering
 * - Servo control to keep object in frame
 * - Multi-object tracking and prioritization
 * - Visual servoing for alignment
 * - Attention mechanism for salient object selection
 *
 * Simulates a robot with pan-tilt camera tracking moving objects.
 */

import { ROS3McpServer } from '../packages/ros3-mcp-server/dist/server.js';

interface Point2D {
  x: number;
  y: number;
}

interface BoundingBox {
  x: number;      // Center x (normalized 0-1)
  y: number;      // Center y (normalized 0-1)
  width: number;  // Width (normalized)
  height: number; // Height (normalized)
}

interface Detection {
  id: string;
  class: string;
  confidence: number;
  bbox: BoundingBox;
  timestamp: number;
}

interface TrackedObject {
  id: string;
  class: string;
  detections: Detection[];
  kalmanState: KalmanState;
  velocity: Point2D;
  age: number;
  missedFrames: number;
  priority: number;
}

interface KalmanState {
  position: Point2D;
  velocity: Point2D;
  positionVariance: number;
  velocityVariance: number;
}

interface CameraState {
  pan: number;  // Horizontal angle (-π to π)
  tilt: number; // Vertical angle (-π/2 to π/2)
  fov: number;  // Field of view
}

class VisionTracker {
  private server: ROS3McpServer;
  private robotId: string;
  private camera: CameraState;
  private trackedObjects: Map<string, TrackedObject> = new Map();
  private nextObjectId: number = 0;
  private frameCount: number = 0;

  // Tracking parameters
  private readonly MAX_MISSED_FRAMES = 5;
  private readonly IOU_THRESHOLD = 0.3;
  private readonly KALMAN_PROCESS_NOISE = 0.01;
  private readonly KALMAN_MEASUREMENT_NOISE = 0.1;

  // Visual servoing parameters
  private readonly PAN_GAIN = 0.5;
  private readonly TILT_GAIN = 0.5;
  private readonly DEAD_ZONE = 0.05; // 5% of frame center

  constructor(robotId: string) {
    this.robotId = robotId;
    this.camera = {
      pan: 0,
      tilt: 0,
      fov: Math.PI / 3, // 60 degrees
    };

    this.server = new ROS3McpServer({
      name: `vision-tracker-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/vision-tracker-${robotId}.db`,
    });
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`👁️  Vision Tracker ${this.robotId} started!`);
    console.log(`📷 Camera: Pan=${this.camera.pan.toFixed(2)}, Tilt=${this.camera.tilt.toFixed(2)}, FOV=${(this.camera.fov * 180 / Math.PI).toFixed(1)}°`);

    // Start tracking loop
    this.startTrackingLoop();
  }

  private startTrackingLoop(): void {
    setInterval(async () => {
      this.frameCount++;
      await this.processFrame();
    }, 100); // 10 Hz
  }

  private async processFrame(): Promise<void> {
    // 1. Get detections from camera (simulated)
    const detections = await this.simulateDetections();

    // 2. Associate detections with tracked objects
    this.dataAssociation(detections);

    // 3. Update Kalman filters
    this.updateTracking();

    // 4. Select primary target
    const target = this.selectTarget();

    // 5. Visual servoing to center target
    if (target) {
      await this.visualServo(target);
    }

    // 6. Print status periodically
    if (this.frameCount % 10 === 0) {
      this.printStatus();
    }
  }

  /**
   * Simulate object detections (in real system, would use actual camera/ML)
   */
  private async simulateDetections(): Promise<Detection[]> {
    const detections: Detection[] = [];
    const time = this.frameCount * 0.1;

    // Simulate moving objects in the scene
    const objects = [
      {
        class: 'person',
        baseX: 0.5,
        baseY: 0.5,
        period: 3.0,
        amplitude: 0.3,
      },
      {
        class: 'car',
        baseX: 0.3,
        baseY: 0.6,
        period: 5.0,
        amplitude: 0.2,
      },
      {
        class: 'ball',
        baseX: 0.7,
        baseY: 0.4,
        period: 2.0,
        amplitude: 0.4,
      },
    ];

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];

      // Add some motion and occasional disappearance
      if (Math.random() < 0.9) { // 90% detection rate
        const x = obj.baseX + Math.sin(time / obj.period * 2 * Math.PI) * obj.amplitude;
        const y = obj.baseY + Math.cos(time / obj.period * 2 * Math.PI) * obj.amplitude * 0.3;

        // Account for camera pan/tilt (objects move relative to camera)
        const adjustedX = x - this.camera.pan / Math.PI * 0.5 + 0.5;
        const adjustedY = y - this.camera.tilt / (Math.PI / 2) * 0.5 + 0.5;

        // Only add if in camera FOV
        if (adjustedX >= 0 && adjustedX <= 1 && adjustedY >= 0 && adjustedY <= 1) {
          detections.push({
            id: `det-${this.frameCount}-${i}`,
            class: obj.class,
            confidence: 0.8 + Math.random() * 0.15,
            bbox: {
              x: adjustedX + (Math.random() - 0.5) * 0.02, // Add noise
              y: adjustedY + (Math.random() - 0.5) * 0.02,
              width: 0.1 + Math.random() * 0.05,
              height: 0.15 + Math.random() * 0.05,
            },
            timestamp: Date.now(),
          });
        }
      }
    }

    return detections;
  }

  /**
   * Associate detections with existing tracks using IoU
   */
  private dataAssociation(detections: Detection[]): void {
    const matched = new Set<string>();

    // Try to match each detection with existing tracks
    for (const detection of detections) {
      let bestMatch: TrackedObject | null = null;
      let bestIoU = this.IOU_THRESHOLD;

      for (const [trackId, track] of this.trackedObjects) {
        if (track.class !== detection.class) continue;

        // Predict where track should be
        const predicted = this.predictPosition(track);
        const iou = this.calculateIoU(predicted, detection.bbox);

        if (iou > bestIoU) {
          bestIoU = iou;
          bestMatch = track;
        }
      }

      if (bestMatch) {
        // Update existing track
        this.updateTrack(bestMatch, detection);
        matched.add(bestMatch.id);
      } else {
        // Create new track
        this.createTrack(detection);
      }
    }

    // Increment missed frames for unmatched tracks
    for (const [trackId, track] of this.trackedObjects) {
      if (!matched.has(trackId)) {
        track.missedFrames++;

        // Remove if too many missed frames
        if (track.missedFrames > this.MAX_MISSED_FRAMES) {
          console.log(`   🗑️  Lost track: ${track.class} (${trackId})`);
          this.trackedObjects.delete(trackId);
        }
      }
    }
  }

  private createTrack(detection: Detection): void {
    const trackId = `track-${this.nextObjectId++}`;

    const track: TrackedObject = {
      id: trackId,
      class: detection.class,
      detections: [detection],
      kalmanState: {
        position: { x: detection.bbox.x, y: detection.bbox.y },
        velocity: { x: 0, y: 0 },
        positionVariance: 1.0,
        velocityVariance: 1.0,
      },
      velocity: { x: 0, y: 0 },
      age: 1,
      missedFrames: 0,
      priority: this.calculatePriority(detection),
    };

    this.trackedObjects.set(trackId, track);
    console.log(`   ✨ New track: ${detection.class} at (${detection.bbox.x.toFixed(2)}, ${detection.bbox.y.toFixed(2)})`);
  }

  private updateTrack(track: TrackedObject, detection: Detection): void {
    track.detections.push(detection);
    if (track.detections.length > 10) {
      track.detections.shift(); // Keep last 10
    }

    // Kalman filter update
    this.kalmanUpdate(track.kalmanState, detection.bbox);

    track.age++;
    track.missedFrames = 0;
    track.priority = this.calculatePriority(detection);
  }

  /**
   * Kalman filter prediction step
   */
  private predictPosition(track: TrackedObject): BoundingBox {
    const state = track.kalmanState;
    const dt = 0.1; // 100ms

    const predicted = {
      x: state.position.x + state.velocity.x * dt,
      y: state.position.y + state.velocity.y * dt,
      width: track.detections[track.detections.length - 1]?.bbox.width || 0.1,
      height: track.detections[track.detections.length - 1]?.bbox.height || 0.15,
    };

    // Increase variance due to prediction
    state.positionVariance += this.KALMAN_PROCESS_NOISE;
    state.velocityVariance += this.KALMAN_PROCESS_NOISE;

    return predicted;
  }

  /**
   * Kalman filter update step
   */
  private kalmanUpdate(state: KalmanState, measurement: BoundingBox): void {
    // Kalman gain
    const K_pos = state.positionVariance / (state.positionVariance + this.KALMAN_MEASUREMENT_NOISE);
    const K_vel = state.velocityVariance / (state.velocityVariance + this.KALMAN_MEASUREMENT_NOISE * 10);

    // Innovation (measurement - prediction)
    const innovation_x = measurement.x - state.position.x;
    const innovation_y = measurement.y - state.position.y;

    // Update position
    state.position.x += K_pos * innovation_x;
    state.position.y += K_pos * innovation_y;

    // Update velocity
    state.velocity.x += K_vel * innovation_x / 0.1;
    state.velocity.y += K_vel * innovation_y / 0.1;

    // Update variance
    state.positionVariance *= (1 - K_pos);
    state.velocityVariance *= (1 - K_vel);
  }

  private calculateIoU(bbox1: BoundingBox, bbox2: BoundingBox): number {
    const x1 = Math.max(bbox1.x - bbox1.width / 2, bbox2.x - bbox2.width / 2);
    const y1 = Math.max(bbox1.y - bbox1.height / 2, bbox2.y - bbox2.height / 2);
    const x2 = Math.min(bbox1.x + bbox1.width / 2, bbox2.x + bbox2.width / 2);
    const y2 = Math.min(bbox1.y + bbox1.height / 2, bbox2.y + bbox2.height / 2);

    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const area1 = bbox1.width * bbox1.height;
    const area2 = bbox2.width * bbox2.height;
    const union = area1 + area2 - intersection;

    return union > 0 ? intersection / union : 0;
  }

  private calculatePriority(detection: Detection): number {
    // Priority based on class, size, and confidence
    const classPriority = {
      person: 3.0,
      car: 2.0,
      ball: 1.5,
    };

    const base = classPriority[detection.class as keyof typeof classPriority] || 1.0;
    const sizeFactor = detection.bbox.width * detection.bbox.height;
    const confidenceFactor = detection.confidence;

    return base * sizeFactor * confidenceFactor;
  }

  private updateTracking(): void {
    // Predict all tracks forward
    for (const track of this.trackedObjects.values()) {
      this.predictPosition(track);
    }
  }

  /**
   * Select highest priority target to track
   */
  private selectTarget(): TrackedObject | null {
    let bestTrack: TrackedObject | null = null;
    let bestScore = -1;

    for (const track of this.trackedObjects.values()) {
      // Prefer established tracks (age > 3)
      const ageBonus = Math.min(track.age / 10, 1.0);
      const score = track.priority * (1 + ageBonus);

      if (score > bestScore) {
        bestScore = score;
        bestTrack = track;
      }
    }

    return bestTrack;
  }

  /**
   * Visual servoing: adjust camera to center target
   */
  private async visualServo(target: TrackedObject): Promise<void> {
    const pos = target.kalmanState.position;

    // Error from frame center (0.5, 0.5)
    const error_x = pos.x - 0.5;
    const error_y = pos.y - 0.5;

    // Dead zone to prevent jitter
    if (Math.abs(error_x) < this.DEAD_ZONE && Math.abs(error_y) < this.DEAD_ZONE) {
      return;
    }

    // Proportional control
    const pan_cmd = -error_x * this.PAN_GAIN;
    const tilt_cmd = -error_y * this.TILT_GAIN;

    // Update camera angles
    this.camera.pan = Math.max(-Math.PI, Math.min(Math.PI, this.camera.pan + pan_cmd * 0.1));
    this.camera.tilt = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.tilt + tilt_cmd * 0.1));

    // Send command to robot (mock)
    try {
      await this.server.moveRobot({
        x: 0,
        y: 0,
        z: 1.5, // Camera height
        roll: 0,
        pitch: this.camera.tilt,
        yaw: this.camera.pan,
        speed: 0.3,
      });
    } catch (error) {
      // Mock robot
    }
  }

  private printStatus(): void {
    console.log(`\n📊 Frame ${this.frameCount} - Tracking ${this.trackedObjects.size} objects:`);

    for (const track of this.trackedObjects.values()) {
      const pos = track.kalmanState.position;
      const vel = track.kalmanState.velocity;
      const centered = Math.abs(pos.x - 0.5) < this.DEAD_ZONE && Math.abs(pos.y - 0.5) < this.DEAD_ZONE;

      console.log(`   ${centered ? '🎯' : '  '} ${track.class}: pos=(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}) vel=(${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}) age=${track.age} priority=${track.priority.toFixed(2)}`);
    }

    console.log(`   📷 Camera: pan=${(this.camera.pan * 180 / Math.PI).toFixed(1)}° tilt=${(this.camera.tilt * 180 / Math.PI).toFixed(1)}°`);
  }

  async storeTrackingSession(): Promise<void> {
    const stats = {
      totalFrames: this.frameCount,
      tracksCreated: this.nextObjectId,
      avgTrackedObjects: this.trackedObjects.size,
    };

    await this.server['memory'].storeEpisode({
      sessionId: `tracking-${Date.now()}`,
      taskName: 'visual_tracking',
      confidence: 0.9,
      success: true,
      outcome: `Tracked ${this.nextObjectId} objects over ${this.frameCount} frames`,
      strategy: 'kalman_filter_with_visual_servoing',
      metadata: stats,
    });
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'vision-1';
  const tracker = new VisionTracker(robotId);

  await tracker.start();

  console.log('\n🎯 Vision tracking active...\n');
  console.log('Tracking objects: person, car, ball');
  console.log('Using Kalman filter + visual servoing\n');

  // Run for 30 seconds
  setTimeout(async () => {
    await tracker.storeTrackingSession();
    console.log('\n✨ Vision tracking session complete!\n');
    process.exit(0);
  }, 30000);
}

main().catch(console.error);
