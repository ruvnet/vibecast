# Vibecast Examples

This directory contains example scripts demonstrating various features of Vibecast.

## Available Examples

### 1. RL Demo (`rl-demo.js`)

Quick demonstration of the RL controller across three energy systems.

```bash
node examples/rl-demo.js
```

**What it does:**
- Initializes controllers for nuclear fission, fusion, and solar
- Runs 5 training episodes for each system
- Performs evaluation
- Shows the modular architecture in action

**Duration:** ~60 seconds

---

### 2. Basic Simulation (`basic-simulation.js`)

Complete nuclear plant simulation with all operational aspects.

```bash
node examples/basic-simulation.js
```

**What it does:**
- Simulates industrial control systems (reactor control)
- Models supply chain logistics
- Manages workforce and HR
- Handles business operations
- Generates comprehensive reports

**Duration:** 2-5 minutes

---

### 3. RL Training (`rl-training.js`)

Full training pipeline for RL controllers with benchmarking.

```bash
node examples/rl-training.js <system> <algorithm> <episodes>
```

**Systems:**
- `nuclear-fission` - PWR/BWR reactors
- `nuclear-fusion` - Tokamaks/stellarators
- `solar` - Solar farms with tracking
- `wind` - Wind turbines (stub)
- `grid-storage` - Battery storage (stub)
- `hybrid` - Multi-system coordination (stub)

**Algorithms:**
- `PPO` - Proximal Policy Optimization (recommended)
- `SAC` - Soft Actor-Critic
- `TD3` - Twin Delayed DDPG
- `A3C` - Asynchronous Advantage Actor-Critic

**Examples:**
```bash
# Train nuclear fission controller
node examples/rl-training.js nuclear-fission PPO 100

# Train solar farm controller
node examples/rl-training.js solar SAC 200

# Train fusion reactor controller
node examples/rl-training.js nuclear-fusion TD3 150
```

**What it does:**
- Trains RL controller for specified episodes
- Evaluates performance periodically
- Saves checkpoints
- Benchmarks against baselines (PID, rule-based, random)
- Generates training reports

**Duration:** Varies (10 min - 2 hours depending on episodes)

---

### 4. Optimization Discovery (`optimization-discovery.js`)

AI-powered discovery of novel optimization opportunities.

```bash
node examples/optimization-discovery.js
```

**What it does:**
- Analyzes simulation data from nuclear plant
- Uses AI to discover optimization patterns
- Generates breakthrough opportunities (12+ discoveries)
- Creates detailed reports with feasibility analysis

**What you get:**
- Executive summary of opportunities
- Technology innovation matrix
- Detailed implementation plans
- ROI and feasibility analysis

**Duration:** 3-10 minutes

---

## Quick Start by Use Case

### I want to see it working quickly
```bash
npm run demo
```

### I want to train a controller
```bash
npm run train:fission   # Nuclear fission
npm run train:fusion    # Nuclear fusion
npm run train:solar     # Solar farm
```

### I want to explore optimizations
```bash
npm run demo:optimization
```

### I want to run a full simulation
```bash
npm run demo:simulation
```

---

## Creating Custom Examples

Create a new file in `examples/`:

```javascript
// examples/my-custom-example.js

const { RL, Simulation } = require('../src');

async function main() {
  // Your custom logic here
  const controller = new RL.UniversalRLController({
    systemType: 'nuclear-fission',
    algorithm: 'PPO'
  });

  // Train for 10 episodes
  for (let i = 0; i < 10; i++) {
    const result = await controller.trainEpisode();
    console.log(`Episode ${i}: ${result.totalReward}`);
  }

  // Evaluate
  const evalResult = await controller.evaluate(5);
  console.log(`Average reward: ${evalResult.avgReward}`);
}

main().catch(console.error);
```

Run it:
```bash
node examples/my-custom-example.js
```

---

## Output Locations

- **Reports**: `reports/`
- **Checkpoints**: `checkpoints/`
- **Logs**: `logs/` (if logging is enabled)

---

## Tips

1. **Start small**: Run RL demo first to understand the basics
2. **Monitor resources**: Training can be memory-intensive
3. **Use checkpoints**: Save your progress during long training runs
4. **Benchmark**: Compare RL against baselines to see improvements
5. **Experiment**: Try different algorithms and hyperparameters

---

## Need More Examples?

See the [documentation](../docs/examples.md) for:
- Code snippets
- Advanced usage patterns
- Integration examples
- Custom adapter creation

---

## Troubleshooting

### Out of Memory
```bash
node --max-old-space-size=4096 examples/rl-training.js nuclear-fission PPO 1000
```

### Slow Training
- Reduce batch size in RL config
- Use fewer episodes for testing
- Try PPO (faster than SAC/TD3)

### No Improvement
- Increase training episodes (>500)
- Adjust learning rate
- Check reward function in adapters
