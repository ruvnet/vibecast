# Architecture Overview

This document describes the architecture of @vibecast/franchise-manager.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Applications                     │
│  (CLI, Web App, Custom Scripts, REST API Clients)       │
└───────────────────┬─────────────────────────────────────┘
                    │
         ┌──────────┴───────────┐
         │                      │
         ▼                      ▼
┌────────────────┐    ┌─────────────────┐
│  CLI Interface │    │  REST API Server│
└────────┬───────┘    └────────┬────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
         ┌──────────────────────┐
         │  FranchiseManager    │ ◄──── Main API Entry Point
         │  (Core Orchestrator) │
         └──────────┬───────────┘
                    │
         ┌──────────┴───────────┬──────────────┐
         │                      │              │
         ▼                      ▼              ▼
┌─────────────────┐   ┌──────────────┐   ┌─────────────┐
│   Agent Swarm   │   │  Database    │   │   Events    │
│   Coordinator   │   │  Operations  │   │  Emitter    │
└────────┬────────┘   └──────┬───────┘   └─────────────┘
         │                   │
    ┌────┴────┬──────┬──────┴──┐
    ▼         ▼      ▼         ▼
┌────────┐ ┌─────┐ ┌──────┐ ┌────────┐
│Financial│ Market│ Growth│ │ SQLite │
│Analyst │ │Research│Strategy│ Database│
└────────┘ └─────┘ └──────┘ └────────┘
```

## Core Components

### 1. FranchiseManager (Core)
**Location:** `/src/core/FranchiseManager.ts`

The main entry point for all operations. Provides a unified API for:
- Location management
- Metrics tracking
- Agent-based analysis
- Growth opportunity management
- Event subscriptions

**Key Methods:**
- `addLocation()`, `getAllLocations()`, `updateLocationStatus()`
- `addFinancialMetrics()`, `addOperationalMetrics()`
- `runAnalysis()`, `getComprehensiveReport()`
- `addGrowthOpportunity()`, `getGrowthOpportunities()`

### 2. Agent Swarm System
**Location:** `/src/agents/`

Multi-agent intelligence system for analysis:

**AgentSwarm Coordinator:**
- Manages agent lifecycle
- Coordinates multi-agent analysis
- Aggregates results from multiple agents

**Agent Types:**
- **FinancialAnalystAgent**: Revenue, expenses, profitability
- **MarketResearcherAgent**: Market trends, competition
- **GrowthStrategistAgent**: Expansion opportunities, ROI
- **BaseAgent**: Abstract base for custom agents

### 3. Database Layer
**Location:** `/src/database/FranchiseDatabase.ts`

SQLite-based persistence with:
- Location storage and retrieval
- Financial metrics history
- Operational metrics tracking
- Growth opportunities database
- Analysis history

**Tables:**
- `locations`
- `financial_metrics`
- `operational_metrics`
- `growth_opportunities`
- `analysis_history`

### 4. Event System
**Location:** `/src/events/FranchiseEventEmitter.ts`

Real-time event notifications for:
- Agent lifecycle events
- Analysis progress
- Location updates
- Metric changes
- Opportunity discovery

### 5. REST API Server
**Location:** `/src/api/FranchiseApiServer.ts`

Express-based REST API with:
- CRUD operations for locations
- Metrics management endpoints
- Analysis execution endpoints
- Growth opportunity endpoints
- Agent capabilities discovery

### 6. CLI Tool
**Location:** `/src/cli/index.ts`

Command-line interface using Commander.js:
- `franchise init` - Initialize project
- `franchise add-location` - Add locations
- `franchise list-locations` - List all locations
- `franchise analyze` - Run analysis
- `franchise report` - Generate reports
- `franchise opportunities` - View opportunities

## Data Flow

### Analysis Flow

```
User Request
    │
    ▼
FranchiseManager.runAnalysis()
    │
    ├──► Emit 'analysis:started' event
    │
    ├──► Gather data from Database
    │
    ├──► Route to AgentSwarm
    │        │
    │        ├──► Financial Analyst
    │        ├──► Market Researcher
    │        └──► Growth Strategist
    │             │
    │             ├──► Each agent emits 'agent:started'
    │             ├──► Performs analysis
    │             └──► Emits 'agent:completed'
    │
    ├──► Aggregate results
    │
    ├──► Save to database
    │
    ├──► Emit 'analysis:completed' event
    │
    └──► Return results to user
```

### Location Management Flow

```
User adds location
    │
    ▼
FranchiseManager.addLocation()
    │
    ├──► Validate data
    │
    ├──► Generate unique ID
    │
    ├──► Store in Database
    │
    ├──► Emit 'location:added' event
    │
    └──► Return location object
```

## Design Patterns

### 1. Facade Pattern
FranchiseManager acts as a facade, providing a simple interface to complex subsystems.

### 2. Strategy Pattern
Different agent types implement the same interface but with different analysis strategies.

### 3. Observer Pattern
Event emitter allows components to subscribe to system events.

### 4. Repository Pattern
Database layer abstracts data access from business logic.

### 5. Factory Pattern
AgentSwarm creates and manages agent instances.

## Technology Stack

- **TypeScript**: Type-safe language
- **Node.js**: Runtime environment
- **better-sqlite3**: Embedded database
- **Express**: REST API server
- **Commander**: CLI framework
- **Events**: Node.js event emitter

## Extension Points

### Adding Custom Agents

1. Extend `BaseAgent` class
2. Implement `analyze()` method
3. Register with `AgentSwarm`
4. Add to `AgentType` enum

### Adding Database Tables

1. Add table schema in `FranchiseDatabase.initialize()`
2. Add CRUD methods
3. Export through FranchiseManager

### Adding API Endpoints

1. Add route in `FranchiseApiServer.setupRoutes()`
2. Call FranchiseManager methods
3. Handle responses and errors

### Adding CLI Commands

1. Add command in CLI index.ts
2. Parse arguments
3. Call FranchiseManager methods
4. Format output

## Performance Considerations

- **Async Operations**: All I/O operations are asynchronous
- **Connection Pooling**: SQLite uses single connection (embedded)
- **Event-Driven**: Non-blocking event system
- **Memory Management**: Resources cleaned up in `close()`
- **Indexing**: Database tables indexed for performance

## Security Considerations

- **Input Validation**: All user inputs validated
- **SQL Injection**: Parameterized queries used
- **API Authentication**: Optional API key support
- **CORS**: Configurable CORS policy
- **Error Handling**: Sensitive info not exposed in errors

## Testing Strategy

- **Unit Tests**: Test individual components
- **Integration Tests**: Test component interactions
- **End-to-End Tests**: Test complete workflows
- **Mock Data**: Use test fixtures for consistency

## Deployment Options

1. **NPM Package**: Install and use programmatically
2. **CLI Tool**: Global installation
3. **API Server**: Deploy as standalone service
4. **Docker**: Containerized deployment (future)

## Future Enhancements

- Additional agent types
- Multi-database support
- Distributed agent processing
- Real-time collaboration
- Web dashboard
- Machine learning integration

---

For implementation details, see the source code and API documentation.
