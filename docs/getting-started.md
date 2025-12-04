# Getting Started with Vibecast

Welcome to Vibecast! This guide will help you get up and running quickly.

## Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org))
- **npm** 8+ (comes with Node.js)
- **Optional**: E2B API key for federated agents ([Get one](https://e2b.dev))

## Installation

### Quick Install

**Unix/Linux/Mac:**
```bash
./install.sh
```

**Windows:**
```powershell
.\install.ps1
```

### Manual Installation

```bash
# Clone repository
git clone https://github.com/ruvnet/vibecast.git
cd vibecast

# Install dependencies
npm install

# Create directories
mkdir -p reports checkpoints logs

# Set E2B API key (optional)
export E2B_API_KEY=your_key_here
```

## Quick Start Examples

### 1. Run RL Demo

The fastest way to see Vibecast in action:

```bash
npm run demo
```

This runs the RL controller across nuclear fission, fusion, and solar systems.

### 2. Run Nuclear Simulation

```bash
npm run demo:simulation
```

Runs a complete nuclear plant simulation including ICS, supply chain, HR, and business operations.

### 3. Train an RL Controller

Train a reinforcement learning controller for a specific system:

```bash
# Nuclear fission with PPO
npm run train:fission

# Nuclear fusion with SAC
npm run train:fusion

# Solar farm with PPO
npm run train:solar
```

Or use the training script directly:

```bash
node examples/rl-training.js <system> <algorithm> <episodes>
```

**Systems**: `nuclear-fission`, `nuclear-fusion`, `solar`, `wind`, `grid-storage`, `hybrid`
**Algorithms**: `PPO`, `SAC`, `TD3`, `A3C`

### 4. Discover Optimizations

Use AI to discover novel optimization opportunities:

```bash
npm run demo:optimization
```

## Project Structure

```
vibecast/
├── src/                    # Source code
│   ├── rl/                 # RL controllers & adapters
│   ├── simulation/         # Nuclear simulation
│   ├── agents/             # Federated agents
│   ├── analysis/           # Optimization & analysis
│   └── utils/              # Utilities
├── examples/               # Example scripts
├── docs/                   # Documentation
├── scripts/                # Utility scripts
└── reports/                # Generated reports
```

## Using the Library

### Import Modules

```javascript
// Import everything
const Vibecast = require('./src');

// Or import specific modules
const { RL, Simulation, Analysis } = require('./src');
```

### Create an RL Controller

```javascript
const { UniversalRLController } = require('./src/rl');

// Initialize controller
const controller = new UniversalRLController({
  systemType: 'nuclear-fission',
  systemId: 'REACTOR-01',
  algorithm: 'PPO'
});

// Train
for (let episode = 0; episode < 100; episode++) {
  const result = await controller.trainEpisode();
  console.log(`Episode ${episode}: Reward = ${result.totalReward}`);
}

// Evaluate
const evalResults = await controller.evaluate(10);
console.log(`Average reward: ${evalResults.avgReward}`);

// Save checkpoint
await controller.saveCheckpoint('trained-model');
```

### Run a Simulation

```javascript
const { Orchestrator } = require('./src/simulation');

// Create orchestrator
const sim = new Orchestrator({
  plantId: 'NPP-01',
  mode: 'training',
  config: {
    simulationTime: 3600,  // 1 hour
    timeStep: 1.0,
    outputInterval: 60
  }
});

// Run simulation
const results = await sim.runSimulation();

// Generate reports
await sim.generateReports(results);
```

### Use System Adapters

```javascript
const { NuclearFissionAdapter, SolarAdapter } = require('./src/rl/adapters');

// Nuclear fission
const fissionAdapter = new NuclearFissionAdapter({
  systemId: 'PWR-01'
});

const state = fissionAdapter.getState();
const { reward, done } = await fissionAdapter.step([0.1, -0.05, 0.0, 0.0]);

// Solar farm
const solarAdapter = new SolarAdapter({
  systemId: 'SOLAR-01',
  farmCapacity: 100  // MW
});

const solarState = solarAdapter.getState();
const result = await solarAdapter.step([1.0, 0.5, 0.0, 2.0, 0]);
```

## Configuration

### E2B API Key

For federated agent simulation:

```bash
# Unix/Linux/Mac
export E2B_API_KEY=your_key_here

# Windows PowerShell
$env:E2B_API_KEY="your_key_here"

# Or in code
process.env.E2B_API_KEY = 'your_key_here';
```

### RL Configuration

Customize RL parameters in the controller:

```javascript
const controller = new UniversalRLController({
  systemType: 'nuclear-fission',
  algorithm: 'PPO',
  rlConfig: {
    gamma: 0.99,              // Discount factor
    learningRate: 3e-4,       // Learning rate
    clipEpsilon: 0.2,         // PPO clip epsilon
    batchSize: 256,           // Batch size
    bufferSize: 1000000,      // Replay buffer size
    updateFrequency: 4        // Update frequency
  },
  safetyConstraints: {
    maxActionMagnitude: 0.3,  // Max action magnitude
    actionRateLimit: 0.1,     // Max change per step
    emergencyShutdownThreshold: 0.95
  }
});
```

## Next Steps

- [Architecture Overview](architecture.md) - Understand the system design
- [RL Controller Guide](rl-controller.md) - Deep dive into RL features
- [API Reference](api-reference.md) - Complete API documentation
- [Examples](examples.md) - More code examples

## Troubleshooting

### Native Binding Issues

If you see errors about native bindings:

```bash
# Rebuild native modules
npm rebuild

# Or use fallback implementations (slower but works)
# The system automatically falls back when needed
```

### E2B Errors

If federated agents fail:

1. Check E2B API key is set correctly
2. Ensure you have E2B credits
3. Run without federated agents (simulation still works)

### Out of Memory

For large training runs:

```bash
# Increase Node.js memory
node --max-old-space-size=4096 examples/rl-training.js nuclear-fission PPO 1000
```

## Support

- **Documentation**: [docs/](.)
- **Issues**: [GitHub Issues](https://github.com/ruvnet/vibecast/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ruvnet/vibecast/discussions)
