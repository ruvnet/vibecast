# Nuclear Power Plant Simulation - Technical Documentation

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Simulation Modules](#simulation-modules)
3. [Federated Agent System](#federated-agent-system)
4. [Data Models](#data-models)
5. [Configuration](#configuration)
6. [API Reference](#api-reference)
7. [Deployment](#deployment)

## System Architecture

### Overview

The Nuclear Power Plant Management Simulation is a high-fidelity system that models all aspects of nuclear power plant operations using a distributed agent-based architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                   SimulationOrchestrator                        │
│  Coordinates all modules and manages simulation lifecycle       │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────┐      ┌────▼─────┐
│Modules │      │  Agents  │
└────────┘      └──────────┘
```

### Core Components

1. **Simulation Orchestrator** (`src/orchestrator/simulation-orchestrator.js`)
   - Main coordinator for all simulation activities
   - Manages timestep progression
   - Coordinates agent analysis
   - Generates comprehensive reports

2. **Simulation Modules**
   - Reactor Control System
   - Supply Chain Management
   - Human Resources Management
   - Business Operations

3. **Federated Agents**
   - E2B sandbox-based isolation
   - Specialized role assignment
   - Concurrent analysis execution

4. **Reporting System**
   - Multi-format report generation
   - Domain-specific analytics
   - Time-series data export

## Simulation Modules

### 1. Reactor Control System

**Location:** `src/simulation/ics/reactor-control.js`

**Purpose:** Models nuclear reactor core operations including temperature, pressure, power output, and safety systems.

**Key Parameters:**
- Core Temperature: 280-350°C operating range
- Pressure: 140-175 bar
- Power Output: 0-1200 MW
- Control Rod Position: 0-100% (insertion percentage)
- Neutron Flux: Normalized reactor activity

**Safety Systems:**
- Automatic SCRAM on threshold violations
- Emergency cooling activation
- Safety margin calculations
- Real-time telemetry storage

**Methods:**

```javascript
simulate(timestep)              // Run one simulation step
setControlRods(position)        // Adjust control rod position
setCoolantFlow(flow)           // Adjust coolant flow rate
activateScram()                // Emergency shutdown
shutdown()                     // Controlled shutdown
getState()                     // Get current reactor state
```

**State Vector (for ruvector storage):**
```javascript
[
  coreTemperature / 1000,
  pressure / 200,
  powerOutput / 1500,
  neutronFlux,
  coolantFlow / 100,
  safetyMargin / 100
]
```

### 2. Supply Chain Management

**Location:** `src/simulation/supply-chain/logistics.js`

**Purpose:** Manages nuclear fuel inventory, spare parts, waste disposal, and vendor relationships.

**Inventory Categories:**
- Nuclear Fuel (tons, enrichment level)
- Spare Parts (pumps, valves, sensors, control rods)
- Chemicals (boric acid, hydrazine, resins)
- Waste Storage (low, intermediate, high-level)

**Vendor Management:**
- Reliability tracking
- Lead time management
- Contract value monitoring
- Performance metrics

**Automatic Reordering:**
- Fuel: < 30 tons triggers order
- Spare parts: Role-based thresholds
- Waste pickup: 80% capacity for low-level, 60% for high-level

**Methods:**

```javascript
simulate(timestep)              // Run supply chain operations
orderFuel(quantity)            // Order nuclear fuel
orderPart(partType, quantity)  // Order spare parts
scheduleWastePickup(wasteType) // Schedule waste disposal
getStatus()                    // Get current status
```

### 3. Human Resources Management

**Location:** `src/simulation/hr/workforce.js`

**Purpose:** Manages 65-person workforce including shift schedules, training, certifications, and compliance.

**Personnel Categories:**
- Senior Reactor Operators (4)
- Reactor Operators (8)
- Engineers (Mechanical: 6, Electrical: 6)
- Radiation Protection (4)
- Security (12)
- Maintenance Technicians (15)
- Other specialists (10)

**Shift System:**
- 4 shifts (A, B, C, D)
- 12-hour rotation
- Automatic rotation management

**Compliance Tracking:**
- Training programs with frequency requirements
- Certification expiration monitoring
- Safety record maintenance

**Methods:**

```javascript
simulate(timestep)              // Run HR operations
getPersonnelByRole(role)       // Get staff by role
getCurrentShiftPersonnel()     // Get active shift staff
checkCertifications()          // Verify cert status
checkTrainingCompliance()      // Verify training status
```

### 4. Business Operations

**Location:** `src/simulation/business/operations.js`

**Purpose:** Models financial operations, power contracts, regulatory compliance, and performance metrics.

**Financial Tracking:**
- Revenue from power generation
- Operating cost breakdown
- Capital expenditures
- Cash reserves
- Profit/loss

**Power Purchase Agreements:**
- Multiple customer contracts
- Price per kWh
- Capacity commitments
- Penalty clauses for underdelivery

**Regulatory Compliance:**
- NRC licensing
- Environmental permits
- Safety records
- Inspection schedules

**Performance Metrics:**
- Capacity Factor (target: 92%)
- Availability Factor (target: 95%)
- Forced Outage Rate (max: 2%)
- Planned Outage Rate

**Methods:**

```javascript
simulate(timestep, reactorState) // Run business operations
calculateRevenue()               // Calculate power sales
calculateOperatingCosts()        // Calculate costs
checkContractCompliance()        // Verify contract terms
generateFinancialReport()        // Generate report
```

## Federated Agent System

### Architecture

Each agent runs in an isolated E2B sandbox with:
- Independent Node.js environment
- Access to ruvector and RuvLLM
- Specialized analysis capabilities
- Concurrent execution

### Agent Roles

1. **Reactor Safety Agent**
   - Monitors core parameters
   - Detects safety margin violations
   - Recommends control actions
   - Tracks SCRAM events

2. **Supply Chain Agent**
   - Monitors inventory levels
   - Predicts stockouts
   - Optimizes reorder timing
   - Evaluates vendor performance

3. **Workforce Agent**
   - Monitors staffing levels
   - Tracks compliance
   - Identifies training needs
   - Evaluates shift coverage

4. **Financial Agent**
   - Analyzes profitability
   - Monitors contract compliance
   - Evaluates performance metrics
   - Recommends cost optimizations

5. **General Oversight Agent**
   - Holistic system analysis
   - Cross-domain pattern detection
   - Strategic recommendations
   - Overall health assessment

### Agent Workflow

```
1. Initialize E2B sandbox
2. Install dependencies (ruvector, ruvllm)
3. Receive simulation data
4. Run LLM analysis
5. Execute role-specific checks
6. Run sandbox-based computations
7. Return findings and recommendations
8. Cleanup and close sandbox
```

### Analysis Output Format

```javascript
{
  agentId: "AGENT-1",
  role: "reactor-safety",
  timestamp: 1234567890,
  findings: [
    {
      type: "llm-analysis",
      content: "AI-generated analysis text",
      confidence: 0.85
    },
    {
      type: "safety-alert",
      severity: "HIGH",
      message: "Low safety margin detected",
      recommendation: "Reduce power output"
    },
    {
      type: "sandbox-analysis",
      data: { reactorHealth: 0.92 }
    }
  ]
}
```

## Data Models

### Reactor State

```javascript
{
  reactorId: "REACTOR-01",
  coreTemperature: 320,      // °C
  pressure: 160,              // bar
  powerOutput: 1050,          // MW
  controlRodPosition: 45,     // %
  coolantFlow: 100,           // %
  neutronFlux: 0.95,          // normalized
  fuelBurnup: 12500,          // MWd/kg
  timestamp: 1234567890,
  status: "OPERATIONAL",      // OPERATIONAL | WARNING | SCRAM | SHUTDOWN
  safetyMargin: 85,           // %
  safetySystems: {
    scram: false,
    emergencyCooling: false,
    containmentIntegrity: true,
    radiationMonitoring: true
  }
}
```

### Supply Chain State

```javascript
{
  plantId: "NPP-01",
  inventory: {
    nuclearFuel: {
      quantity: 75,           // tons
      enrichment: 4.5,        // %
      lastDelivery: timestamp,
      nextDelivery: timestamp,
      cost: 1500000,          // USD/ton
      supplier: "Global Nuclear Fuel"
    },
    spareparts: { ... },
    chemicals: { ... },
    wasteStorage: {
      lowLevel: 50,           // m³
      intermediate: 20,
      highLevel: 5,
      capacity: { ... }
    }
  },
  activeOrders: [...],
  pendingShipments: [...],
  vendorPerformance: [...]
}
```

### HR State

```javascript
{
  plantId: "NPP-01",
  metrics: {
    safetyIncidents: 0,
    trainingCompliance: 98.5,    // %
    certificationCompliance: 100, // %
    overtimeHours: 250,
    staffingLevel: 96.2           // %
  },
  currentShift: "A",
  totalPersonnel: 65,
  activePersonnel: 63
}
```

### Business State

```javascript
{
  plantId: "NPP-01",
  financials: {
    revenue: 15000000,        // USD
    costs: 10000000,
    profit: 5000000,
    cashReserves: 525000000
  },
  performance: {
    capacityFactor: 0.91,
    availabilityFactor: 0.94,
    forcedOutageRate: 0.015,
    downtimeDays: 2.5
  },
  compliance: {
    nrcLicense: { status: "VALID", ... },
    environmentalPermits: { ... },
    safetyRecords: { ... }
  }
}
```

## Configuration

### config.js Structure

See `config.js` for full configuration options. Key sections:

- **plant**: Plant identification and specifications
- **simulation**: Timestep, duration, real-time factor
- **agents**: Count, roles, analysis intervals
- **reactor**: Operating parameters and limits
- **supplyChain**: Inventory levels and reorder points
- **hr**: Personnel structure and compliance
- **business**: Financial parameters and targets
- **reporting**: Output formats and directories

### Environment Variables

```bash
E2B_API_KEY=your_e2b_api_key_here
```

## API Reference

### SimulationOrchestrator

```javascript
const orchestrator = new SimulationOrchestrator({
  plantId: 'NPP-01',
  timestep: 1000,        // ms
  duration: 120000,      // ms
  agentCount: 5
});

await orchestrator.initializeAgents();
await orchestrator.runSimulation();
orchestrator.stop();
await orchestrator.cleanup();
```

### FederatedAgent

```javascript
const agent = new FederatedAgent({
  agentId: 'AGENT-1',
  role: 'reactor-safety',
  apiKey: process.env.E2B_API_KEY
});

await agent.initialize();
const analysis = await agent.analyze(simulationData);
const results = agent.getResults();
await agent.cleanup();
```

### ReportGenerator

```javascript
const reporter = new ReportGenerator({ plantId: 'NPP-01' });

await reporter.generateSimulationReport({
  simulationData,
  agentAnalyses,
  agentResults,
  summary
});
```

## Deployment

### Requirements

- Node.js 16+
- npm or yarn
- E2B API key
- Minimum 2GB RAM
- 1GB disk space for reports

### Installation

```bash
git clone https://github.com/ruvnet/vibecast
cd vibecast
git checkout claude/nuclear-plant-simulation-01TchfBArqrxyda1F4YPq3yG
npm install
export E2B_API_KEY=your_key_here
npm start
```

### Production Deployment

For production simulations:

1. Adjust `config.js` for longer durations
2. Increase agent count for more thorough analysis
3. Configure appropriate logging
4. Set up automated report archival
5. Monitor resource usage

### Performance Optimization

- **Concurrent Execution**: All simulation modules and agents run concurrently
- **SIMD Acceleration**: RuvLLM uses SIMD optimizations
- **Vector Storage**: Efficient telemetry storage with ruvector
- **Sandbox Isolation**: E2B sandboxes prevent interference

### Monitoring

Monitor these metrics during simulation:
- Plant health score
- Agent analysis completion rate
- Memory usage
- Sandbox creation/cleanup
- Report generation time

### Troubleshooting

**E2B Connection Issues:**
- Verify API key is set
- Check network connectivity
- Ensure sufficient E2B quota

**Performance Issues:**
- Reduce timestep for faster simulation
- Decrease agent count
- Increase duration for smoother results

**Memory Issues:**
- Limit simulation duration
- Reduce data retention
- Clear old reports

## Support

For issues or questions:
- GitHub Issues: https://github.com/ruvnet/vibecast/issues
- Documentation: See this file and README.md
- Code: All source files are extensively commented
