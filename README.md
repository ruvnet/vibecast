# Vibecast 🚀

> Universal Energy System Controller with Reinforcement Learning

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/contributing.md)

**Vibecast** is a next-generation autonomous control system for energy infrastructure, combining reinforcement learning with physics-based simulations. It provides a universal controller architecture that works across multiple energy systems: nuclear fission, nuclear fusion, solar, wind, and hybrid systems.

---

## ✨ Features

### 🧠 **Universal RL Controller**
- **Multi-System Support**: Single controller architecture for fission, fusion, solar, wind, storage, and hybrid systems
- **Advanced Algorithms**: PPO, SAC, TD3, and A3C reinforcement learning algorithms
- **Safety-First Design**: Built-in safety constraints, rate limiting, and emergency shutdown protocols
- **Transfer Learning**: Pre-train on one system and transfer to another

### ⚛️ **Nuclear Plant Simulation**
- **High-Fidelity Physics**: Point kinetics, thermal hydraulics, xenon dynamics
- **Complete Operations**: Industrial control systems, supply chain, HR, business operations
- **Federated Agents**: Multi-agent simulation with E2B sandbox isolation

### 🔬 **Advanced Capabilities**
- **Optimization Discovery**: AI-powered discovery of novel optimization opportunities
- **Real-time Analytics**: Comprehensive reporting and visualization
- **Benchmarking**: Compare RL against PID, rule-based, and random baselines

---

## 🚀 Quick Start

### Installation

**Unix/Linux/Mac:**
```bash
./install.sh
```

**Windows:**
```powershell
.\install.ps1
```

**Manual:**
```bash
npm install
```

### Run Your First Simulation

```javascript
const { Simulation } = require('./src');

// Create nuclear plant simulation
const orchestrator = new Simulation.Orchestrator({
  plantId: 'NPP-01',
  mode: 'training'
});

// Run simulation
await orchestrator.runSimulation(3600); // 1 hour
```

### Train an RL Controller

```bash
# Nuclear fission with PPO
node examples/rl-training.js nuclear-fission PPO 100

# Solar farm with SAC
node examples/rl-training.js solar SAC 200

# Fusion reactor with TD3
node examples/rl-training.js nuclear-fusion TD3 150
```

### Run Quick Demo

```bash
node examples/rl-demo.js
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Installation and first steps |
| [Architecture](docs/architecture.md) | System design and components |
| [RL Controller](docs/rl-controller.md) | Reinforcement learning guide |
| [Nuclear Simulation](docs/nuclear-simulation.md) | Nuclear plant simulation details |
| [API Reference](docs/api-reference.md) | Complete API documentation |
| [Examples](docs/examples.md) | Code examples and tutorials |
| [Contributing](docs/contributing.md) | How to contribute |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Universal RL Controller                  │
│  (PPO, SAC, TD3 algorithms + Safety Constraints)       │
└───────────────┬─────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬──────────┐
    │           │           │           │          │
┌───▼───┐  ┌───▼────┐  ┌──▼───┐  ┌───▼───┐  ┌──▼───┐
│Nuclear│  │Nuclear │  │Solar │  │ Wind  │  │Hybrid│
│Fission│  │Fusion  │  │ Farm │  │ Farm  │  │System│
└───────┘  └────────┘  └──────┘  └───────┘  └──────┘
   │           │           │          │          │
   └───────────┴───────────┴──────────┴──────────┘
                         │
            ┌────────────▼────────────┐
            │   Physics Simulations   │
            │   Safety Monitoring     │
            │   Performance Analytics │
            └─────────────────────────┘
```

---

## 🎯 Use Cases

### Energy Sector
- **Nuclear Power Plants**: Autonomous reactor control with safety guarantees
- **Renewable Energy**: Optimize solar tracking, wind turbine control
- **Grid Management**: Balance generation and demand dynamically
- **Hybrid Systems**: Coordinate multiple energy sources

### Research & Development
- **Algorithm Development**: Test new RL algorithms on realistic simulations
- **Transfer Learning**: Study knowledge transfer across energy domains
- **Safety Research**: Explore constraint satisfaction in critical systems

### Education
- **Control Systems**: Learn advanced control techniques
- **Nuclear Engineering**: Understand reactor physics and operations
- **AI/ML**: Apply RL to real-world problems

---

## 📊 Example Results

### Nuclear Fission Control
```
Training Episodes: 1000
Algorithm: PPO
Final Reward: 847.3
Safety Violations: 0
Improvement vs PID: +34%
```

### Solar Farm Optimization
```
Training Episodes: 500
Algorithm: SAC
Energy Capture: +18%
Grid Integration: 95%
ROI Increase: +22%
```

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **AI/ML**: ruvector (vector DB + ML ops), @ruvector/ruvllm
- **Agents**: agentic-flow, @ruvector/agentic-synth
- **Sandboxing**: E2B (optional, for federated agents)

---

## 🗂️ Project Structure

```
vibecast/
├── src/
│   ├── rl/              # Reinforcement learning
│   ├── simulation/      # Nuclear plant simulation
│   ├── agents/          # Federated agents
│   ├── analysis/        # Optimization & analysis
│   └── utils/           # Utilities
├── examples/            # Example scripts
├── docs/                # Documentation
├── scripts/             # Utility scripts
└── reports/             # Generated reports
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/contributing.md) for details.

### Development Setup
```bash
git clone https://github.com/ruvnet/vibecast.git
cd vibecast
npm install
npm test
```

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🌟 Acknowledgments

- **rUv** ([ruv.io](https://ruv.io)) - Core ruvector technology
- **E2B** - Sandbox infrastructure
- **OpenAI** - RL algorithm research

---

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/ruvnet/vibecast/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ruvnet/vibecast/discussions)

---

## 🔮 Roadmap

- [ ] Web dashboard for monitoring
- [ ] Cloud deployment guides
- [ ] Additional energy systems (geothermal, tidal)
- [ ] Multi-agent reinforcement learning
- [ ] Federated learning across plants
- [ ] Real-world hardware integration

---

<p align="center">
  <b>Built with ❤️ by the Vibecast Team</b>
</p>

<p align="center">
  <a href="https://ruv.io">ruv.io</a> •
  <a href="docs/getting-started.md">Get Started</a> •
  <a href="docs/examples.md">Examples</a> •
  <a href="docs/api-reference.md">API Docs</a>
</p>
