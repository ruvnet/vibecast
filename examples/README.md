# ROS3 Robot Examples

This directory contains a comprehensive set of robot implementations demonstrating ROS3 capabilities, ranging from simple to exotic and complex.

## Overview

| Example | Complexity | Concepts Demonstrated | Runtime |
|---------|------------|----------------------|---------|
| `01-hello-robot.ts` | **Simple** | Basic pub/sub, state publishing | 10s |
| `02-autonomous-navigator.ts` | **Intermediate** | Pathfinding, obstacle avoidance, LIDAR | 30s |
| `03-multi-robot-coordinator.ts` | **Advanced** | Task allocation, coordination, leader election | 30s |
| `04-swarm-intelligence.ts` | **Exotic** | Flocking, emergent behavior, stigmergy | 60s |
| `05-robotic-arm-manipulation.ts` | **Advanced** | Inverse kinematics, trajectory planning, grasping | 40s |
| `06-vision-tracking.ts` | **Intermediate** | Object detection, Kalman filtering, visual servoing | 30s |
| `07-behavior-tree.ts` | **Advanced** | Hierarchical behaviors, reactive control | 30s |
| `08-adaptive-learning.ts` | **Exotic** | Experience-based learning, strategy optimization | 25s |

## Prerequisites

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build:ts

# Ensure ROS3 core is built
cargo build --release
```

## Running Examples

### Example 1: Hello World Robot

**Simple introduction to ROS3 pub/sub messaging**

```bash
# Run with default robot ID
node examples/01-hello-robot.ts

# Run with custom robot ID
node examples/01-hello-robot.ts my-robot
```

**What it demonstrates:**
- Basic ROS3 message publishing
- Periodic state updates
- AgentDB memory integration
- Simple robot movement simulation

**Expected output:**
```
🤖 Hello Robot alpha started!
📢 Publishing: Hello from robot alpha! Count: 1
📢 Publishing: Hello from robot alpha! Count: 2
...
📊 Querying past greetings...
Found 5 past greetings:
  1. Published greeting #5 (confidence: 1)
```

---

### Example 2: Autonomous Navigator

**Intermediate pathfinding with dynamic obstacle avoidance**

```bash
# Run autonomous navigation
node examples/02-autonomous-navigator.ts

# Run with custom robot ID
node examples/02-autonomous-navigator.ts nav-beta
```

**What it demonstrates:**
- A* pathfinding algorithm
- LIDAR-based obstacle detection
- Dynamic path replanning
- Memory-based route optimization
- Multi-waypoint navigation

**Features:**
- Synthetic obstacle generation
- Real-time path planning
- Collision avoidance
- Navigation memory queries

**Expected output:**
```
🤖 Autonomous Navigator nav-alpha started!
📍 Initial position: (0.00, 0.00)
🎯 Navigation goal set: (3.00, 2.00)
💭 Found 0 similar past navigation attempts
🗺️  Planned path with 6 waypoints
✓ Waypoint reached. 5 remaining.
✅ Reached goal!
```

---

### Example 3: Multi-Robot Coordinator

**Advanced cooperative task execution**

```bash
# Run with 3 robots (default)
node examples/03-multi-robot-coordinator.ts

# Run with 5 robots
node examples/03-multi-robot-coordinator.ts 5
```

**What it demonstrates:**
- Distributed task allocation
- Leader election algorithm
- Inter-robot communication
- Cooperative area coverage
- Fault tolerance (robot failures)
- Battery management

**Architecture:**
- **Leader**: Manages task queue, assigns tasks
- **Workers**: Execute assigned tasks
- **Heartbeat system**: Monitors robot health

**Expected output:**
```
🚀 Starting multi-robot coordination system with 3 robots...
🤖 Coordinator Robot robot-0 started!
👑 robot-0: Elected as leader
📋 Leader created 10 tasks

📊 System Status:
  robot-0 👑: idle | Battery: 98% | Tasks: 3/10 completed
  robot-1   : moving | Battery: 95% | Tasks: 3/10 completed
  robot-2   : working | Battery: 92% | Tasks: 3/10 completed

🎉 Coordination mission complete!
📈 Final Results:
   Active Robots: 3
   Tasks Completed: 8/10
   Success Rate: 80.0%
```

---

### Example 4: Swarm Intelligence

**Exotic emergent behavior and collective intelligence**

```bash
# Run swarm simulation (3 scouts, 10 workers, 2 guards)
node examples/04-swarm-intelligence.ts
```

**What it demonstrates:**
- **Flocking behavior**: Separation, alignment, cohesion (Boids algorithm)
- **Stigmergy**: Indirect communication via pheromone trails
- **Emergent foraging**: Collective food gathering
- **Role differentiation**: Scouts, workers, guards
- **Self-organization**: No central control

**Swarm Roles:**
- **Scouts** (3): Explore to find food sources, high mobility
- **Workers** (10): Follow pheromone trails, collect and transport food
- **Guards** (2): Patrol home base perimeter

**Behaviors:**
- Levy flight exploration
- Pheromone trail following
- Collective decision-making
- Dynamic task switching

**Expected output:**
```
🐝 Initializing swarm...
   Scouts: 3, Workers: 10, Guards: 2

🍯 Generated 5 food sources
🚀 Swarm simulation running...

🎯 scout-1: Found food! (quality: 0.87, remaining: 15)
🍯 worker-3: Deposited food (quality: 0.87)

📊 Swarm Stats (t=30s):
   Agents: 15 (3 scouts, 10 workers, 2 guards)
   Average Energy: 67.3%
   Food Collected: 23
   Food Remaining: 52
   Agents Carrying Food: 4

🎉 Swarm simulation complete!
📈 Final Results:
   Total Food Collected: 45
   Collection Efficiency: 3.00 per agent
   Average Energy: 54.2%
```

---

## Performance Characteristics

### Computational Complexity

| Example | Time Complexity | Space Complexity | Update Rate |
|---------|----------------|------------------|-------------|
| Hello Robot | O(1) | O(1) | 0.5 Hz |
| Navigator | O(n log n) pathfinding | O(n) obstacles | 10 Hz |
| Coordinator | O(n²) message passing | O(n×m) tasks×robots | 10 Hz |
| Swarm | O(n²) neighbor checks | O(n) agents | 10 Hz |

### Resource Usage

- **Memory**: ~50-200 MB per robot (depending on AgentDB history)
- **CPU**: ~1-5% per robot (Apple M1/Intel i7)
- **Latency**: 10-50µs message passing (Zenoh)

---

## Advanced Usage

### Modifying Behaviors

Each example exposes parameters you can tune:

**Navigator:**
```typescript
// In 02-autonomous-navigator.ts
const tolerance = 0.2; // Goal reach threshold
const numWaypoints = 5; // Path granularity
const speed = 0.5; // Robot velocity
```

**Coordinator:**
```typescript
// In 03-multi-robot-coordinator.ts
const capabilities = ['survey', 'inspect', 'transport', 'guard'];
const heartbeatInterval = 1000; // ms
const taskTimeout = 5000; // ms
```

**Swarm:**
```typescript
// In 04-swarm-intelligence.ts
private behavior: SwarmBehavior = {
  separation: 1.5,
  alignment: 1.0,
  cohesion: 1.0,
  exploration: 0.3,
};
```

### Querying Robot Memories

All examples store experiences in AgentDB. Query them:

```bash
# Query navigation memories
npx agentdb query --query "navigation to target" \
  --path ./examples/data/navigator-alpha.db \
  --k 10 --format json

# Query swarm foraging success
npx agentdb query --query "food collection" \
  --path ./examples/data/swarm-worker-0.db \
  --min-confidence 0.7
```

---

## Benchmarking

Run benchmarks to measure performance:

```bash
# Build release mode for accurate benchmarks
cargo build --release

# Run Rust benchmarks
cargo bench

# Benchmark example performance
npm run benchmark:examples
```

---

## Troubleshooting

### Common Issues

**1. Module not found errors**
```bash
# Rebuild TypeScript
npm run build:ts
```

**2. Database locked errors**
```bash
# Clear example databases
rm -rf examples/data/*.db
```

**3. Performance issues**
```bash
# Use release build
cargo build --release

# Reduce robot count
node examples/03-multi-robot-coordinator.ts 2
```

---

## Next Steps

After exploring these examples, consider:

1. **Combining Examples**: Use swarm coordination for navigator robots
2. **Custom Behaviors**: Implement your own robot controllers
3. **Real Hardware**: Deploy to Raspberry Pi or Jetson Nano
4. **Visualization**: Add web-based visualization (WebSocket + Canvas)
5. **Machine Learning**: Train RL agents using AgentDB memories

---

## Architecture Notes

All examples follow this pattern:

```
┌─────────────────────────────────────────┐
│          TypeScript Robot Node          │
│  ┌─────────────┐      ┌──────────────┐ │
│  │  Behavior   │◄────►│  ROS3 MCP    │ │
│  │  Controller │      │  Server      │ │
│  └─────────────┘      └──────────────┘ │
│         ▲                     │         │
│         │                     ▼         │
│         │              ┌──────────────┐ │
│         │              │  AgentDB     │ │
│         │              │  Memory      │ │
│         │              └──────────────┘ │
└─────────┼───────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│         ROS3 Rust Core (via FFI)        │
│  ┌──────────┐  ┌──────────┐            │
│  │  Zenoh   │  │  Tokio   │            │
│  │  Pub/Sub │  │  Runtime │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

---

## Contributing

To add your own example:

1. Create `examples/0X-your-example.ts`
2. Follow the existing pattern (ROS3McpServer integration)
3. Add documentation to this README
4. Test with `npm run test:examples`
5. Submit a pull request

---

## License

MIT License - See main repository LICENSE file

---

## Resources

- **ROS3 Documentation**: ../README.md
- **AgentDB CLI**: `npx agentdb --help`
- **Zenoh Protocol**: https://zenoh.io
- **Swarm Intelligence**: Reynolds, C. W. (1987). Flocks, herds and schools

**Questions?** Open an issue on GitHub!

---

### Example 5: Robotic Arm Manipulation

**Advanced 6-DOF robotic arm control**

```bash
# Run with default arm ID
node examples/05-robotic-arm-manipulation.ts

# Run with custom arm ID
node examples/05-robotic-arm-manipulation.ts my-arm
```

**What it demonstrates:**
- Forward and inverse kinematics for 6-DOF arm
- Trajectory planning with smooth motion
- Grasp planning and execution
- Pick-and-place operations
- Collision checking
- Joint space and Cartesian space control

**Features:**
- Simplified DH parameters for arm kinematics
- Smooth cubic interpolation for trajectories
- Approach-grasp-retreat sequence
- Multiple object manipulation (3 objects)
- Unreachability detection

**Expected output:**
```
🦾 Robotic Arm manipulator-1 started!
📍 End-effector position: (0.883, 0.000, 0.463)
📦 Generated 3 objects for manipulation

🎯 Pick and Place: cube-red → (0.30, 0.30, 0.05)
   📋 Planning grasp...
   ➡️  Moving to approach position...
   ⬇️  Descending to grasp...
   🤏 Closing gripper...
   ⬆️  Lifting object...
   ➡️  Moving to target...
   ⬇️  Placing object...
   ✋ Opening gripper...
   ✅ Pick and place complete in 8.12s
```

---

### Example 6: Vision-Based Object Tracking

**Intermediate computer vision and tracking**

```bash
# Run with default tracker ID
node examples/06-vision-tracking.ts

# Run with custom tracker ID
node examples/06-vision-tracking.ts my-tracker
```

**What it demonstrates:**
- Real-time object detection simulation
- Multi-object tracking with Kalman filters
- Data association using IoU (Intersection over Union)
- Visual servoing for camera control
- Track lifecycle management
- Priority-based target selection

**Tracking pipeline:**
1. Detect objects in frame
2. Associate detections with existing tracks
3. Update Kalman filters (position + velocity)
4. Select highest priority target
5. Pan/tilt camera to center target
6. Handle track creation and deletion

**Expected output:**
```
👁️  Vision Tracker vision-1 started!
📷 Camera: Pan=0.00, Tilt=0.00, FOV=60.0°

   ✨ New track: person at (0.52, 0.48)
   ✨ New track: car at (0.31, 0.62)
   ✨ New track: ball at (0.69, 0.41)

📊 Frame 10 - Tracking 3 objects:
   🎯 person: pos=(0.51, 0.49) vel=(-0.01, 0.02) age=10 priority=0.89
      car: pos=(0.32, 0.63) vel=(0.02, -0.01) age=8 priority=0.54
      ball: pos=(0.70, 0.40) vel=(0.03, -0.03) age=6 priority=0.31
   📷 Camera: pan=1.2° tilt=-0.8°
```

---

### Example 7: Reactive Behavior Tree

**Advanced hierarchical behavior control**

```bash
# Run with default security robot ID
node examples/07-behavior-tree.ts

# Run with custom ID
node examples/07-behavior-tree.ts security-2
```

**What it demonstrates:**
- Behavior tree architecture (Selector, Sequence, Parallel nodes)
- Decorators (Inverter, Repeater)
- Condition checking (battery, threats)
- Action execution (patrol, investigate, charge)
- Priority-based behavior switching
- Reactive response to threats

**Behavior hierarchy:**
```
Root (Selector - priority based)
├─ Battery Management (Sequence)
│  ├─ Battery Low? (Condition)
│  └─ Charge or Go to Charger (Selector)
├─ Threat Response (Sequence)
│  ├─ Threat Detected? (Condition)
│  ├─ Investigate & Alert (Parallel)
│  └─ Clear Threat (Action)
└─ Normal Patrol (Sequence)
   ├─ Not Charging (Inverter)
   └─ Patrol (Action)
```

**Expected output:**
```
🤖 Security Robot security-1 started!
📍 Position: (0, 0)
🔋 Battery: 80%
🚶 Patrol waypoints: 4

   ✓ Reached waypoint 1

⚠️  Threat detected: intruder at (3.42, -2.15), severity: 0.78

   🔍 Investigating intruder at (3.42, -2.15)
   🚨 ALERT: High-severity intruder detected!
   ℹ️  Threat investigated: intruder (severity: 0.78)

   🔋 Battery low (28.3%), returning to charger...
   ✅ Fully charged!
```

---

### Example 8: Adaptive Learning Robot

**Exotic meta-learning and strategy optimization**

```bash
# Run with default learner ID and 12 tasks
node examples/08-adaptive-learning.ts

# Run with custom ID and task count
node examples/08-adaptive-learning.ts my-learner 20
```

**What it demonstrates:**
- Experience-based strategy selection
- Success rate tracking and updating
- Multi-criteria decision making
- Epsilon-greedy exploration
- Performance improvement over time
- AgentDB skill consolidation
- Meta-learning (learning optimal strategies)

**Learning process:**
1. Initialize baseline strategies for each task type
2. Load past experiences from AgentDB
3. For each task:
   - Select best strategy using success rate, efficiency, and exploration
   - Execute task and measure performance
   - Update strategy statistics with exponential moving average
   - Store experience in memory
4. Consolidate learned skills

**Expected output:**
```
🧠 Adaptive Learning Robot learner-1 started!
📚 Loading past experiences from memory...

   📖 Loaded 0 navigate experiences
   🔗 Consolidated 0 skills

🎯 Starting adaptive learning session with 12 tasks...

📋 Task 1: navigate
   Target: (3.24, -1.85)
   Difficulty: 52%
   Selected Strategy: safe_path
   Expected Success: 80.0%

   ⏳ Progress: 30%
   ⏳ Progress: 60%
   ⏳ Progress: 90%

   ✅ SUCCESS in 12.34s
   Confidence: 80.0%

...

============================================================
📊 Learning Session Summary

Total Tasks: 12
Overall Success Rate: 75.0%
Average Confidence: 78.3%

Performance by Task Type:

  NAVIGATE:
    Success Rate: 83.3% (5/6)
      safe_path: 90.2% (used 4x, avg 14.2s)
      dynamic_replan: 75.0% (used 2x, avg 11.8s)

  MANIPULATE:
    Success Rate: 66.7% (2/3)
      precise_grasp: 85.1% (used 2x, avg 11.5s)
      fast_grasp: 50.0% (used 1x, avg 8.3s)

📈 Learning Curve:
  First Half: 66.7%
  Second Half: 83.3%
  Improvement: +16.6%

============================================================
```

