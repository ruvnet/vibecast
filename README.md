# Toyota Motor Company Self-Learning Simulation

A comprehensive self-learning AI agent system that simulates the entire Toyota Motor Corporation - including all 370,000+ employees, supply chain partners, manufacturing operations, and organizational structure.

**Powered by ruvector AI Agent Orchestration**

## Features

### Organization Simulation
- **370,000+ Employee Agents** - Complete organizational hierarchy from executives to production workers
- **20+ Global Locations** - Japan HQ, North American plants, European facilities, and Asian operations
- **All Departments** - R&D, Manufacturing, Quality, Supply Chain, Sales, HR, Finance, IT, and more
- **30+ Vehicle Models** - Toyota, Lexus, Daihatsu, and commercial vehicle lineups

### Manufacturing (Toyota Production System)
- **19 Production Lines** - Across 15 global manufacturing plants
- **Just-In-Time (JIT)** - Real-time inventory management and delivery
- **Jidoka** - Automation with human touch, automatic quality detection
- **Kaizen** - Continuous improvement with self-learning agents
- **Andon System** - Visual management and line stoppage simulation

### Supply Chain Network
- **12 Keiretsu Partners** - Denso, Aisin, Toyota Boshoku, and more
- **40+ Tier 1 Suppliers** - Global automotive suppliers
- **500+ Total Suppliers** - Complete Tier 1, 2, and 3 network
- **JIT Delivery** - Kanban-based inventory management

### Self-Learning AI System (ruvector)
- **Agent Memory** - Short-term, long-term, episodic, semantic, and procedural memory
- **Swarm Intelligence** - Collective learning across all agents
- **Pattern Recognition** - Automatic identification of successful behaviors
- **Adaptation Rules** - Dynamic rule creation based on experience
- **Knowledge Transfer** - Learning propagation between agents

## Installation

```bash
# Clone the repository
git clone https://github.com/ruvnet/vibecast.git
cd vibecast

# Install dependencies
npm install

# Build the project
npm run build
```

## Quick Start

### Run Batch Simulation
```bash
# Run with default settings (370,000 employees, 24 hours)
npm run simulate

# Or with custom settings
npx ts-node src/cli.ts simulate --employees 100000 --duration 48 --verbose
```

### Interactive Mode
```bash
npm run dev interactive
# or
npx ts-node src/cli.ts interactive
```

Available commands in interactive mode:
- `start` - Start the simulation
- `stop` - Stop the simulation
- `pause` - Pause the simulation
- `resume` - Resume the simulation
- `status` - Show current status
- `agents` - Show agent summary
- `suppliers` - Show supplier summary
- `production` - Show production metrics
- `quit` - Exit

### Real-Time Dashboard
```bash
npm run dashboard
# or
npx ts-node src/cli.ts dashboard
```

## Usage Examples

### Programmatic Usage

```typescript
import { ToyotaSimulationEngine } from 'toyota-simulation-agent';

// Create simulation with custom configuration
const engine = new ToyotaSimulationEngine({
  employeeCount: 100000,
  supplierCount: 200,
  enableLearning: true,
  enableKaizen: true,
  enableJIT: true,
});

// Initialize all components
await engine.initialize();

// Start simulation
await engine.start();

// Get status
const status = engine.getSimulationStatus();
console.log(status);

// Stop after some time
setTimeout(async () => {
  await engine.stop();
}, 60000);
```

### Creating Custom Agents

```typescript
import { ToyotaAgent } from 'toyota-simulation-agent';

const agent = new ToyotaAgent({
  name: 'Tanaka Hiroshi',
  type: 'engineer',
  department: 'research_development',
});

// Agent learns from tasks
agent.on('learning:occurred', (event) => {
  console.log('Agent learned:', event);
});

// Execute tasks
const outcome = await agent.executeTask(task);
```

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Toyota Simulation Engine                     │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Organization │  │ Supply Chain │  │ Manufacturing │         │
│  │   Generator   │  │  Simulator   │  │  Simulator    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
├────────────────────────────────────────────────────────────────┤
│                   ruvector Agent Orchestrator                   │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  • Swarm Optimization    • Learning Models             │   │
│  │  • Collective Intelligence • Pattern Recognition       │   │
│  │  • Task Assignment       • Knowledge Transfer          │   │
│  └────────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────┤
│                      370,000+ Agents                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Executive│ │ Manager │ │Engineer │ │ Worker  │ │Inspector│  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Agent Types

| Type | Count | Description |
|------|-------|-------------|
| Executive | 50 | Board members and senior leadership |
| Manager | 35,000+ | Department and team managers |
| Engineer | 45,000+ | R&D, manufacturing, quality engineers |
| Designer | 8,000+ | Product and industrial designers |
| Production Worker | 180,000+ | Assembly line workers |
| Quality Inspector | 26,000+ | Quality assurance specialists |
| Logistics Coordinator | 15,000+ | Supply chain and logistics |
| Sales Representative | 30,000+ | Sales and marketing staff |
| Research Scientist | 8,600+ | R&D researchers |
| IT Specialist | 16,000+ | Information technology staff |

## Supply Chain Partners

### Keiretsu (Core Partners)
- Denso Corporation (Electronics, HVAC)
- Aisin Corporation (Transmissions, Drivetrain)
- Toyota Industries Corporation (Compressors)
- JTEKT Corporation (Steering, Bearings)
- Toyota Boshoku (Seats, Interior)
- Toyoda Gosei (Rubber, Plastics)
- And 6 more core partners

### Global Tier 1 Suppliers
- Bosch, Continental, ZF (Germany)
- Magna International (Canada)
- Valeo (France)
- Panasonic, Bridgestone, Sumitomo (Japan)
- LG Chem, Samsung SDI (Korea)
- CATL, BYD (China)

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `employeeCount` | 370,000 | Total number of employee agents |
| `supplierCount` | 500 | Number of supplier companies |
| `tickDuration` | 100ms | Simulation tick interval |
| `enableLearning` | true | Enable agent self-learning |
| `enableKaizen` | true | Enable continuous improvement |
| `enableJIT` | true | Enable Just-In-Time production |
| `verbosity` | 'normal' | Output verbosity level |

## Metrics & KPIs

The simulation tracks real Toyota KPIs:

- **Production Metrics**
  - Vehicles per day
  - OEE (Overall Equipment Effectiveness)
  - First Time Quality
  - Takt Time
  - Defect Rate (PPM)

- **Supply Chain Metrics**
  - On-time delivery rate
  - Supplier quality scores
  - Inventory turns
  - Kanban efficiency

- **Agent Metrics**
  - Learning rate
  - Adaptation success
  - Collaboration index
  - Kaizen contributions

## Scripts

```bash
npm run build       # Compile TypeScript
npm run dev         # Run CLI in development mode
npm run simulate    # Run batch simulation
npm run dashboard   # Launch real-time dashboard
npm run test        # Run tests
npm run lint        # Lint code
```

## Project Structure

```
toyota-simulation/
├── src/
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   ├── core/               # Core agent framework
│   │   └── Agent.ts
│   ├── toyota/             # Toyota-specific simulation
│   │   ├── OrganizationalStructure.ts
│   │   ├── SupplyChain.ts
│   │   └── ManufacturingSimulation.ts
│   ├── ruvector/           # AI agent orchestration
│   │   └── AgentOrchestrator.ts
│   ├── simulation/         # Main simulation engine
│   │   └── SimulationEngine.ts
│   ├── cli.ts              # CLI interface
│   └── index.ts            # Main exports
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT License - Copyright 2025 rUv

## Author

**rUv** - ruv@ruv.net

## Acknowledgments

- Toyota Motor Corporation for the inspiration
- The Toyota Production System methodology
- The open-source AI/ML community
