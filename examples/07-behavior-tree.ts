#!/usr/bin/env node
/**
 * Example 7: Reactive Behavior Tree
 *
 * Demonstrates:
 * - Hierarchical behavior tree execution
 * - Reactive behaviors (priority-based switching)
 * - Condition checking and action execution
 * - Sequence, Selector, and Parallel nodes
 * - Decorators (inverters, repeaters, etc.)
 * - Memory-based behavior learning
 *
 * A security patrol robot with layered behaviors: patrol → investigate → respond to threats.
 */

import { ROS3McpServer } from '../packages/ros3-mcp-server/dist/server.js';

// Behavior tree node status
type NodeStatus = 'success' | 'failure' | 'running';

const NodeStatus = {
  SUCCESS: 'success' as NodeStatus,
  FAILURE: 'failure' as NodeStatus,
  RUNNING: 'running' as NodeStatus,
};

interface Point2D {
  x: number;
  y: number;
}

interface Threat {
  type: 'intruder' | 'fire' | 'anomaly';
  position: Point2D;
  severity: number;
  detected: number;
}

interface RobotState {
  position: Point2D;
  battery: number;
  isCharging: boolean;
  threatDetected: Threat | null;
  patrolWaypoints: Point2D[];
  currentWaypointIndex: number;
  alertsTriggered: number;
}

// Base behavior tree node
abstract class BehaviorNode {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract tick(state: RobotState): Promise<NodeStatus>;

  getName(): string {
    return this.name;
  }
}

// Composite nodes
class SequenceNode extends BehaviorNode {
  private children: BehaviorNode[];

  constructor(name: string, children: BehaviorNode[]) {
    super(name);
    this.children = children;
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    for (const child of this.children) {
      const status = await child.tick(state);

      if (status === NodeStatus.FAILURE) {
        return NodeStatus.FAILURE;
      }

      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }
    }

    return NodeStatus.SUCCESS;
  }
}

class SelectorNode extends BehaviorNode {
  private children: BehaviorNode[];

  constructor(name: string, children: BehaviorNode[]) {
    super(name);
    this.children = children;
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    for (const child of this.children) {
      const status = await child.tick(state);

      if (status === NodeStatus.SUCCESS) {
        return NodeStatus.SUCCESS;
      }

      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }
    }

    return NodeStatus.FAILURE;
  }
}

class ParallelNode extends BehaviorNode {
  private children: BehaviorNode[];
  private successThreshold: number;

  constructor(name: string, children: BehaviorNode[], successThreshold: number = -1) {
    super(name);
    this.children = children;
    this.successThreshold = successThreshold === -1 ? children.length : successThreshold;
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    const results = await Promise.all(
      this.children.map(child => child.tick(state))
    );

    const successCount = results.filter(r => r === NodeStatus.SUCCESS).length;
    const runningCount = results.filter(r => r === NodeStatus.RUNNING).length;

    if (successCount >= this.successThreshold) {
      return NodeStatus.SUCCESS;
    }

    if (runningCount > 0) {
      return NodeStatus.RUNNING;
    }

    return NodeStatus.FAILURE;
  }
}

// Decorator nodes
class InverterNode extends BehaviorNode {
  private child: BehaviorNode;

  constructor(child: BehaviorNode) {
    super(`Inverter(${child.getName()})`);
    this.child = child;
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    const status = await this.child.tick(state);

    if (status === NodeStatus.SUCCESS) {
      return NodeStatus.FAILURE;
    }

    if (status === NodeStatus.FAILURE) {
      return NodeStatus.SUCCESS;
    }

    return status;
  }
}

class RepeaterNode extends BehaviorNode {
  private child: BehaviorNode;
  private maxRepeats: number;
  private currentRepeats: number = 0;

  constructor(child: BehaviorNode, maxRepeats: number = -1) {
    super(`Repeater(${child.getName()})`);
    this.child = child;
    this.maxRepeats = maxRepeats;
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    if (this.maxRepeats !== -1 && this.currentRepeats >= this.maxRepeats) {
      this.currentRepeats = 0;
      return NodeStatus.SUCCESS;
    }

    const status = await this.child.tick(state);

    if (status === NodeStatus.SUCCESS || status === NodeStatus.FAILURE) {
      this.currentRepeats++;
      return NodeStatus.RUNNING; // Keep repeating
    }

    return status;
  }
}

// Condition nodes
class BatteryLowCondition extends BehaviorNode {
  private threshold: number;

  constructor(threshold: number = 20) {
    super(`BatteryLow(<${threshold}%)`);
    this.threshold = threshold;
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    return state.battery < this.threshold ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

class ThreatDetectedCondition extends BehaviorNode {
  constructor() {
    super('ThreatDetected?');
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    return state.threatDetected !== null ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

class IsChargingCondition extends BehaviorNode {
  constructor() {
    super('IsCharging?');
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    return state.isCharging ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

// Action nodes
class GoToChargerAction extends BehaviorNode {
  constructor() {
    super('GoToCharger');
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    console.log(`   🔋 Battery low (${state.battery.toFixed(1)}%), returning to charger...`);

    // Simulate moving to charger
    const chargerPos = { x: 0, y: 0 };
    const dist = Math.sqrt(
      Math.pow(state.position.x - chargerPos.x, 2) +
      Math.pow(state.position.y - chargerPos.y, 2)
    );

    if (dist < 0.5) {
      state.isCharging = true;
      return NodeStatus.SUCCESS;
    }

    // Move towards charger
    const dx = chargerPos.x - state.position.x;
    const dy = chargerPos.y - state.position.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    state.position.x += (dx / len) * 0.1;
    state.position.y += (dy / len) * 0.1;

    return NodeStatus.RUNNING;
  }
}

class ChargeAction extends BehaviorNode {
  constructor() {
    super('Charge');
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    if (state.battery >= 100) {
      console.log(`   ✅ Fully charged!`);
      state.isCharging = false;
      return NodeStatus.SUCCESS;
    }

    state.battery = Math.min(100, state.battery + 5);
    await new Promise(resolve => setTimeout(resolve, 100));

    return NodeStatus.RUNNING;
  }
}

class PatrolAction extends BehaviorNode {
  constructor() {
    super('Patrol');
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    const target = state.patrolWaypoints[state.currentWaypointIndex];
    const dist = Math.sqrt(
      Math.pow(state.position.x - target.x, 2) +
      Math.pow(state.position.y - target.y, 2)
    );

    if (dist < 0.3) {
      // Reached waypoint
      state.currentWaypointIndex = (state.currentWaypointIndex + 1) % state.patrolWaypoints.length;
      console.log(`   ✓ Reached waypoint ${state.currentWaypointIndex}`);
      return NodeStatus.SUCCESS;
    }

    // Move towards waypoint
    const dx = target.x - state.position.x;
    const dy = target.y - state.position.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    state.position.x += (dx / len) * 0.1;
    state.position.y += (dy / len) * 0.1;
    state.battery -= 0.2; // Drain battery

    return NodeStatus.RUNNING;
  }
}

class InvestigateThreatAction extends BehaviorNode {
  constructor() {
    super('InvestigateThreat');
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    if (!state.threatDetected) {
      return NodeStatus.FAILURE;
    }

    const threat = state.threatDetected;
    console.log(`   🔍 Investigating ${threat.type} at (${threat.position.x.toFixed(2)}, ${threat.position.y.toFixed(2)})`);

    const dist = Math.sqrt(
      Math.pow(state.position.x - threat.position.x, 2) +
      Math.pow(state.position.y - threat.position.y, 2)
    );

    if (dist < 1.0) {
      console.log(`   ℹ️  Threat investigated: ${threat.type} (severity: ${threat.severity})`);
      return NodeStatus.SUCCESS;
    }

    // Move towards threat
    const dx = threat.position.x - state.position.x;
    const dy = threat.position.y - state.position.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    state.position.x += (dx / len) * 0.15; // Faster than patrol
    state.position.y += (dy / len) * 0.15;
    state.battery -= 0.3;

    return NodeStatus.RUNNING;
  }
}

class TriggerAlertAction extends BehaviorNode {
  private minSeverity: number;

  constructor(minSeverity: number = 0.7) {
    super('TriggerAlert');
    this.minSeverity = minSeverity;
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    if (!state.threatDetected) {
      return NodeStatus.FAILURE;
    }

    if (state.threatDetected.severity >= this.minSeverity) {
      console.log(`   🚨 ALERT: High-severity ${state.threatDetected.type} detected!`);
      state.alertsTriggered++;
      return NodeStatus.SUCCESS;
    }

    return NodeStatus.FAILURE;
  }
}

class ClearThreatAction extends BehaviorNode {
  constructor() {
    super('ClearThreat');
  }

  async tick(state: RobotState): Promise<NodeStatus> {
    state.threatDetected = null;
    return NodeStatus.SUCCESS;
  }
}

// Main security robot with behavior tree
class SecurityRobot {
  private server: ROS3McpServer;
  private robotId: string;
  private state: RobotState;
  private behaviorTree: BehaviorNode;
  private running: boolean = false;

  constructor(robotId: string) {
    this.robotId = robotId;

    this.state = {
      position: { x: 0, y: 0 },
      battery: 80,
      isCharging: false,
      threatDetected: null,
      patrolWaypoints: [
        { x: 5, y: 5 },
        { x: 5, y: -5 },
        { x: -5, y: -5 },
        { x: -5, y: 5 },
      ],
      currentWaypointIndex: 0,
      alertsTriggered: 0,
    };

    this.server = new ROS3McpServer({
      name: `security-${robotId}`,
      version: '1.0.0',
      dbPath: `./examples/data/security-${robotId}.db`,
    });

    this.behaviorTree = this.buildBehaviorTree();
  }

  private buildBehaviorTree(): BehaviorNode {
    // Root: Selector (priority-based)
    // 1. Low battery → charge
    // 2. Threat detected → investigate and respond
    // 3. Normal → patrol

    return new SelectorNode('Root', [
      // Priority 1: Battery management
      new SequenceNode('BatteryManagement', [
        new BatteryLowCondition(30),
        new SelectorNode('ChargeOrGoToCharger', [
          new SequenceNode('ChargingSequence', [
            new IsChargingCondition(),
            new ChargeAction(),
          ]),
          new GoToChargerAction(),
        ]),
      ]),

      // Priority 2: Threat response
      new SequenceNode('ThreatResponse', [
        new ThreatDetectedCondition(),
        new ParallelNode('InvestigateAndAlert', [
          new InvestigateThreatAction(),
          new TriggerAlertAction(0.7),
        ], 1), // Success if either completes
        new ClearThreatAction(),
      ]),

      // Priority 3: Normal patrol
      new SequenceNode('NormalPatrol', [
        new InverterNode(new IsChargingCondition()),
        new PatrolAction(),
      ]),
    ]);
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log(`🤖 Security Robot ${this.robotId} started!`);
    console.log(`📍 Position: (${this.state.position.x}, ${this.state.position.y})`);
    console.log(`🔋 Battery: ${this.state.battery}%`);
    console.log(`🚶 Patrol waypoints: ${this.state.patrolWaypoints.length}\n`);

    this.running = true;
    this.run();
    this.simulateThreats();
  }

  private async run(): Promise<void> {
    let tickCount = 0;

    while (this.running) {
      tickCount++;

      // Execute behavior tree
      const status = await this.behaviorTree.tick(this.state);

      // Print status periodically
      if (tickCount % 10 === 0) {
        this.printStatus();
      }

      await new Promise(resolve => setTimeout(resolve, 200)); // 5 Hz
    }
  }

  private simulateThreats(): void {
    // Randomly generate threats
    setInterval(() => {
      if (Math.random() < 0.15 && !this.state.threatDetected) {
        const types: Threat['type'][] = ['intruder', 'fire', 'anomaly'];
        const threat: Threat = {
          type: types[Math.floor(Math.random() * types.length)],
          position: {
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10,
          },
          severity: Math.random(),
          detected: Date.now(),
        };

        this.state.threatDetected = threat;
        console.log(`\n⚠️  Threat detected: ${threat.type} at (${threat.position.x.toFixed(2)}, ${threat.position.y.toFixed(2)}), severity: ${threat.severity.toFixed(2)}\n`);
      }
    }, 3000);
  }

  private printStatus(): void {
    console.log(`\n📊 Status:`);
    console.log(`   Position: (${this.state.position.x.toFixed(2)}, ${this.state.position.y.toFixed(2)})`);
    console.log(`   Battery: ${this.state.battery.toFixed(1)}% ${this.state.isCharging ? '(charging)' : ''}`);
    console.log(`   Patrol: Waypoint ${this.state.currentWaypointIndex + 1}/${this.state.patrolWaypoints.length}`);
    console.log(`   Alerts: ${this.state.alertsTriggered}`);
    console.log(`   Threat: ${this.state.threatDetected ? this.state.threatDetected.type : 'None'}`);
  }

  async stop(): Promise<void> {
    this.running = false;

    console.log(`\n📈 Mission Summary:`);
    console.log(`   Alerts Triggered: ${this.state.alertsTriggered}`);
    console.log(`   Final Battery: ${this.state.battery.toFixed(1)}%`);
    console.log(`   Final Position: (${this.state.position.x.toFixed(2)}, ${this.state.position.y.toFixed(2)})`);

    // Store in memory
    await this.server['memory'].storeEpisode({
      sessionId: `security-patrol-${Date.now()}`,
      taskName: 'security_patrol',
      confidence: 0.9,
      success: true,
      outcome: `Completed patrol with ${this.state.alertsTriggered} alerts`,
      strategy: 'behavior_tree_reactive',
      metadata: {
        alertsTriggered: this.state.alertsTriggered,
        finalBattery: this.state.battery,
      },
    });
  }
}

// Main execution
async function main() {
  const robotId = process.argv[2] || 'security-1';
  const robot = new SecurityRobot(robotId);

  await robot.start();

  console.log('🎯 Security patrol active with behavior tree...\n');
  console.log('Behaviors: Battery Management > Threat Response > Patrol\n');

  // Run for 30 seconds
  setTimeout(async () => {
    await robot.stop();
    console.log('\n✨ Security patrol complete!\n');
    process.exit(0);
  }, 30000);
}

main().catch(console.error);
