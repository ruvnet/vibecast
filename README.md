# @vibecast/franchise-manager

[![npm version](https://img.shields.io/npm/v/@vibecast/franchise-manager.svg)](https://www.npmjs.com/package/@vibecast/franchise-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

> Multi-agent franchise management platform for business analysis, planning, and growth optimization

## Overview

`@vibecast/franchise-manager` is a comprehensive TypeScript framework for managing franchise operations using AI-powered multi-agent analysis. It provides intelligent insights for financial performance, market research, operational efficiency, and growth planning.

## Features

- **Multi-Agent Intelligence**: Coordinate specialized AI agents for financial analysis, market research, and growth strategy
- **Comprehensive Database**: Built-in SQLite database for locations, metrics, and analysis history
- **RESTful API**: Optional Express server with full CRUD operations
- **CLI Tool**: Command-line interface for quick franchise management tasks
- **Real-time Events**: Event emitters for monitoring operations and agent activities
- **TypeScript First**: Full type safety with comprehensive type definitions
- **Production Ready**: Optimized build, tree-shaking support, and thorough testing

## Installation

```bash
npm install @vibecast/franchise-manager
```

## Quick Start

```typescript
import { FranchiseManager } from '@vibecast/franchise-manager';

// Initialize the manager
const manager = new FranchiseManager({
  name: 'My Franchise',
  industry: 'Retail',
  databasePath: './franchise.db'
});

// Add a location
const location = await manager.addLocation({
  name: 'Downtown Store',
  address: '123 Main St',
  city: 'San Francisco',
  state: 'CA',
  zipCode: '94102',
  country: 'USA',
  opened: new Date(),
  status: 'active'
});

// Add financial metrics
await manager.addFinancialMetrics(location.id, {
  revenue: 150000,
  expenses: 95000,
  profit: 55000,
  profitMargin: 36.7,
  period: '2024-Q1'
});

// Run comprehensive analysis with all agents
const analysis = await manager.runAnalysis({
  type: 'comprehensive'
});

console.log('Insights:', analysis.aggregatedInsights);
console.log('Recommendations:', analysis.recommendations);

await manager.close();
```

## Architecture

### Core Components

1. **FranchiseManager**: Main API entry point for all operations
2. **AgentSwarm**: Coordinates multiple specialized AI agents
3. **FranchiseDatabase**: SQLite-based persistence layer
4. **FranchiseEventEmitter**: Real-time event notifications
5. **FranchiseApiServer**: Optional RESTful API server

### Agent Types

- **Financial Analyst**: Revenue, expenses, profitability analysis
- **Market Researcher**: Market trends, competition, demographics
- **Operations Specialist**: Operational efficiency and optimization
- **Growth Strategist**: Expansion opportunities and ROI analysis
- **Data Analyst**: Data processing and pattern recognition

## API Reference

### FranchiseManager

#### Constructor

```typescript
new FranchiseManager(config: FranchiseConfig)
```

**Config Options:**
- `name` (required): Franchise name
- `industry` (required): Industry type
- `databasePath` (optional): Database file path (default: './franchise.db')
- `enableApi` (optional): Enable REST API (default: false)
- `apiPort` (optional): API server port (default: 3000)
- `logLevel` (optional): Logging level ('debug' | 'info' | 'warn' | 'error')

#### Location Management

```typescript
// Add a location
await manager.addLocation(location: Omit<FranchiseLocation, 'id'>): Promise<FranchiseLocation>

// Get a location
await manager.getLocation(id: string): Promise<FranchiseLocation | undefined>

// Get all locations
await manager.getAllLocations(): Promise<FranchiseLocation[]>

// Update location status
await manager.updateLocationStatus(id: string, status: 'active' | 'pending' | 'closed'): Promise<void>
```

#### Metrics Management

```typescript
// Add financial metrics
await manager.addFinancialMetrics(locationId: string, metrics: FinancialMetrics): Promise<void>

// Get financial metrics
await manager.getFinancialMetrics(locationId: string, limit?: number): Promise<FinancialMetrics[]>

// Add operational metrics
await manager.addOperationalMetrics(locationId: string, metrics: OperationalMetrics): Promise<void>

// Get operational metrics
await manager.getOperationalMetrics(locationId: string, limit?: number): Promise<OperationalMetrics[]>
```

#### Analysis

```typescript
// Run specific analysis
await manager.runAnalysis(request: AnalysisRequest): Promise<any>

// Get comprehensive report
await manager.getComprehensiveReport(): Promise<FranchiseReport>

// Get analysis history
await manager.getAnalysisHistory(limit?: number): Promise<any[]>
```

#### Growth Opportunities

```typescript
// Add growth opportunity
await manager.addGrowthOpportunity(opportunity: Omit<GrowthOpportunity, 'id'>): Promise<GrowthOpportunity>

// Get growth opportunities
await manager.getGrowthOpportunities(limit?: number): Promise<GrowthOpportunity[]>
```

#### Agent Operations

```typescript
// Get agent capabilities
manager.getAgentCapabilities(): AgentCapabilities[]

// Run specific agent task
await manager.runAgentTask(agentType: AgentType, data: any): Promise<AgentResponse>
```

### Event Emitter

Subscribe to real-time events:

```typescript
manager.events.on('agent:started', (event) => {
  console.log('Agent started:', event.data.agentType);
});

manager.events.on('agent:completed', (event) => {
  console.log('Agent completed:', event.data);
});

manager.events.on('analysis:completed', (event) => {
  console.log('Analysis complete:', event.data);
});

manager.events.on('location:added', (event) => {
  console.log('Location added:', event.data);
});

manager.events.on('opportunity:discovered', (event) => {
  console.log('New opportunity:', event.data);
});
```

### REST API

Start the API server:

```typescript
import { FranchiseManager } from '@vibecast/franchise-manager';
import { FranchiseApiServer } from '@vibecast/franchise-manager/api';

const manager = new FranchiseManager({
  name: 'My Franchise',
  industry: 'Retail',
  enableApi: true,
  apiPort: 3000
});

const apiServer = new FranchiseApiServer(manager, {
  port: 3000,
  enableCors: true
});

await apiServer.start();
```

#### API Endpoints

**Locations:**
- `GET /api/locations` - Get all locations
- `GET /api/locations/:id` - Get specific location
- `POST /api/locations` - Create location
- `PUT /api/locations/:id/status` - Update location status

**Metrics:**
- `GET /api/locations/:id/financial` - Get financial metrics
- `POST /api/locations/:id/financial` - Add financial metrics
- `GET /api/locations/:id/operational` - Get operational metrics
- `POST /api/locations/:id/operational` - Add operational metrics

**Analysis:**
- `POST /api/analysis` - Run analysis
- `GET /api/analysis/history` - Get analysis history
- `GET /api/report` - Generate comprehensive report

**Opportunities:**
- `GET /api/opportunities` - Get growth opportunities
- `POST /api/opportunities` - Add growth opportunity

**Agents:**
- `GET /api/agents` - Get agent capabilities

## CLI Usage

The package includes a command-line interface:

```bash
# Initialize a new project
franchise init --name "My Franchise" --industry "Retail"

# Add a location
franchise add-location \
  --name "Downtown Store" \
  --address "123 Main St" \
  --city "San Francisco" \
  --state "CA" \
  --zip "94102"

# List all locations
franchise list-locations

# Run analysis
franchise analyze --type comprehensive

# Generate report
franchise report

# View growth opportunities
franchise opportunities
```

## Examples

See the `examples/` directory for complete examples:

- **basic-franchise.js**: Basic setup and operations
- **multi-agent-analysis.js**: Coordinating multiple agents
- **growth-planning.js**: Strategic growth planning scenario

Run examples:

```bash
npm run example:basic
npm run example:analysis
npm run example:growth
```

## TypeScript Types

All types are exported and available:

```typescript
import {
  FranchiseConfig,
  FranchiseLocation,
  FinancialMetrics,
  OperationalMetrics,
  AgentType,
  AgentResponse,
  GrowthOpportunity,
  FranchiseReport
} from '@vibecast/franchise-manager';
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Performance & Optimization

- **Tree-shaking**: Unused code is automatically removed in production builds
- **Code Splitting**: Separate entry points for core, API, and CLI
- **Type-only Imports**: Optimized TypeScript compilation
- **SQLite**: Efficient local database with minimal overhead
- **Async Operations**: Non-blocking I/O for all database and agent operations

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/vibecast/franchise-manager/issues)
- **Documentation**: [Full Documentation](https://github.com/vibecast/franchise-manager#readme)
- **Examples**: [Example Applications](./examples)

## Roadmap

- [ ] Additional agent types (Legal, HR, Compliance)
- [ ] Machine learning integration for predictive analytics
- [ ] Multi-database support (PostgreSQL, MongoDB)
- [ ] Web dashboard UI
- [ ] Real-time collaboration features
- [ ] Advanced visualization and reporting
- [ ] Integration with popular business tools

## Credits

Developed by rUv for Vibecast Live Coding Sessions

---

Made with care for the franchise management community
