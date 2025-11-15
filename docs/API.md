# API Documentation

Complete API reference for @vibecast/franchise-manager

## Table of Contents

1. [FranchiseManager Class](#franchisemanager-class)
2. [AgentSwarm Class](#agentswarm-class)
3. [FranchiseDatabase Class](#franchisedatabase-class)
4. [FranchiseApiServer Class](#franchiseapiserver-class)
5. [Type Definitions](#type-definitions)
6. [Event System](#event-system)

## FranchiseManager Class

Main entry point for franchise management operations.

### Constructor

```typescript
constructor(config: FranchiseConfig)
```

Creates a new FranchiseManager instance.

**Parameters:**
- `config.name` (string, required): Name of the franchise
- `config.industry` (string, required): Industry type
- `config.databasePath` (string, optional): Path to SQLite database file. Default: './franchise.db'
- `config.enableApi` (boolean, optional): Enable REST API server. Default: false
- `config.apiPort` (number, optional): Port for API server. Default: 3000
- `config.logLevel` ('debug' | 'info' | 'warn' | 'error', optional): Logging level. Default: 'info'

**Example:**
```typescript
const manager = new FranchiseManager({
  name: 'Coffee Chain',
  industry: 'Food & Beverage',
  databasePath: './data/franchise.db',
  logLevel: 'debug'
});
```

### Location Management Methods

#### addLocation()

```typescript
async addLocation(location: Omit<FranchiseLocation, 'id'>): Promise<FranchiseLocation>
```

Adds a new franchise location to the system.

**Parameters:**
- `location.name` (string, required): Location name
- `location.address` (string, required): Street address
- `location.city` (string, required): City
- `location.state` (string, required): State/Province
- `location.zipCode` (string, required): ZIP/Postal code
- `location.country` (string, required): Country
- `location.coordinates` (object, optional): Latitude and longitude
- `location.opened` (Date, required): Opening date
- `location.status` ('active' | 'pending' | 'closed', required): Current status

**Returns:** Promise resolving to the created location with generated ID

**Events Emitted:** `location:added`

**Example:**
```typescript
const location = await manager.addLocation({
  name: 'Downtown Branch',
  address: '123 Main St',
  city: 'New York',
  state: 'NY',
  zipCode: '10001',
  country: 'USA',
  coordinates: { latitude: 40.7128, longitude: -74.0060 },
  opened: new Date('2023-01-15'),
  status: 'active'
});

console.log('Location ID:', location.id);
```

#### getLocation()

```typescript
async getLocation(id: string): Promise<FranchiseLocation | undefined>
```

Retrieves a specific location by ID.

**Parameters:**
- `id` (string, required): Location ID

**Returns:** Promise resolving to location object or undefined if not found

**Example:**
```typescript
const location = await manager.getLocation('loc-abc123');
if (location) {
  console.log('Location found:', location.name);
}
```

#### getAllLocations()

```typescript
async getAllLocations(): Promise<FranchiseLocation[]>
```

Retrieves all franchise locations.

**Returns:** Promise resolving to array of all locations

**Example:**
```typescript
const locations = await manager.getAllLocations();
console.log(`Total locations: ${locations.length}`);
```

#### updateLocationStatus()

```typescript
async updateLocationStatus(id: string, status: 'active' | 'pending' | 'closed'): Promise<void>
```

Updates the status of a location.

**Parameters:**
- `id` (string, required): Location ID
- `status` ('active' | 'pending' | 'closed', required): New status

**Example:**
```typescript
await manager.updateLocationStatus('loc-abc123', 'closed');
```

### Metrics Management Methods

#### addFinancialMetrics()

```typescript
async addFinancialMetrics(locationId: string, metrics: FinancialMetrics): Promise<void>
```

Adds financial metrics for a location.

**Parameters:**
- `locationId` (string, required): Location ID
- `metrics.revenue` (number, required): Total revenue
- `metrics.expenses` (number, required): Total expenses
- `metrics.profit` (number, required): Net profit
- `metrics.profitMargin` (number, required): Profit margin percentage
- `metrics.period` (string, required): Time period (e.g., '2024-Q1')

**Events Emitted:** `metrics:updated`

**Example:**
```typescript
await manager.addFinancialMetrics('loc-abc123', {
  revenue: 250000,
  expenses: 175000,
  profit: 75000,
  profitMargin: 30,
  period: '2024-Q1'
});
```

#### getFinancialMetrics()

```typescript
async getFinancialMetrics(locationId: string, limit?: number): Promise<FinancialMetrics[]>
```

Retrieves financial metrics for a location.

**Parameters:**
- `locationId` (string, required): Location ID
- `limit` (number, optional): Maximum number of records. Default: 10

**Returns:** Promise resolving to array of financial metrics

#### addOperationalMetrics()

```typescript
async addOperationalMetrics(locationId: string, metrics: OperationalMetrics): Promise<void>
```

Adds operational metrics for a location.

**Parameters:**
- `locationId` (string, required): Location ID
- `metrics.employeeCount` (number, required): Number of employees
- `metrics.customerCount` (number, required): Number of customers
- `metrics.averageTransactionValue` (number, required): Average transaction amount
- `metrics.customerSatisfactionScore` (number, required): Satisfaction score (0-5)
- `metrics.operationalEfficiency` (number, required): Efficiency percentage

**Events Emitted:** `metrics:updated`

#### getOperationalMetrics()

```typescript
async getOperationalMetrics(locationId: string, limit?: number): Promise<OperationalMetrics[]>
```

Retrieves operational metrics for a location.

### Analysis Methods

#### runAnalysis()

```typescript
async runAnalysis(request: AnalysisRequest): Promise<any>
```

Runs analysis using AI agents.

**Parameters:**
- `request.type` ('financial' | 'market' | 'operational' | 'growth' | 'comprehensive', required): Analysis type
- `request.locationIds` (string[], optional): Specific locations to analyze
- `request.timeframe` (string, optional): Time period for analysis
- `request.parameters` (object, optional): Additional parameters

**Events Emitted:** `analysis:started`, `analysis:completed`, `agent:started`, `agent:completed`

**Returns:** Promise resolving to analysis results

**Example:**
```typescript
// Run comprehensive analysis
const result = await manager.runAnalysis({
  type: 'comprehensive'
});

console.log('Insights:', result.aggregatedInsights);
console.log('Recommendations:', result.recommendations);

// Run specific financial analysis
const financialResult = await manager.runAnalysis({
  type: 'financial',
  locationIds: ['loc-abc123', 'loc-xyz789'],
  timeframe: '2024-Q1'
});
```

#### getComprehensiveReport()

```typescript
async getComprehensiveReport(): Promise<FranchiseReport>
```

Generates a comprehensive franchise report.

**Returns:** Promise resolving to complete franchise report

**Example:**
```typescript
const report = await manager.getComprehensiveReport();
console.log('Report Title:', report.title);
console.log('Locations:', report.locations.length);
console.log('Recommendations:', report.recommendations);
```

#### getAnalysisHistory()

```typescript
async getAnalysisHistory(limit?: number): Promise<any[]>
```

Retrieves history of past analyses.

**Parameters:**
- `limit` (number, optional): Maximum number of records. Default: 10

**Returns:** Promise resolving to array of historical analyses

### Growth Methods

#### addGrowthOpportunity()

```typescript
async addGrowthOpportunity(opportunity: Omit<GrowthOpportunity, 'id'>): Promise<GrowthOpportunity>
```

Adds a growth opportunity to the system.

**Events Emitted:** `opportunity:discovered`

#### getGrowthOpportunities()

```typescript
async getGrowthOpportunities(limit?: number): Promise<GrowthOpportunity[]>
```

Retrieves growth opportunities.

### Agent Methods

#### getAgentCapabilities()

```typescript
getAgentCapabilities(): AgentCapabilities[]
```

Returns capabilities of all available agents.

**Example:**
```typescript
const capabilities = manager.getAgentCapabilities();
capabilities.forEach(cap => {
  console.log(`${cap.name}: ${cap.description}`);
  console.log('Skills:', cap.skills.join(', '));
});
```

#### runAgentTask()

```typescript
async runAgentTask(agentType: AgentType, data: any): Promise<AgentResponse>
```

Runs a specific agent with custom data.

### Lifecycle Methods

#### close()

```typescript
async close(): Promise<void>
```

Closes database connections and cleans up resources.

**Example:**
```typescript
await manager.close();
```

#### getConfig()

```typescript
getConfig(): FranchiseConfig
```

Returns current configuration.

## Type Definitions

### FranchiseLocation

```typescript
interface FranchiseLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  opened: Date;
  status: 'active' | 'pending' | 'closed';
}
```

### FinancialMetrics

```typescript
interface FinancialMetrics {
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  period: string;
}
```

### OperationalMetrics

```typescript
interface OperationalMetrics {
  employeeCount: number;
  customerCount: number;
  averageTransactionValue: number;
  customerSatisfactionScore: number;
  operationalEfficiency: number;
}
```

### AgentType

```typescript
enum AgentType {
  FINANCIAL_ANALYST = 'financial_analyst',
  MARKET_RESEARCHER = 'market_researcher',
  OPERATIONS_SPECIALIST = 'operations_specialist',
  GROWTH_STRATEGIST = 'growth_strategist',
  DATA_ANALYST = 'data_analyst'
}
```

### GrowthOpportunity

```typescript
interface GrowthOpportunity {
  id: string;
  type: 'location' | 'service' | 'market' | 'optimization';
  description: string;
  potentialRevenue: number;
  investmentRequired: number;
  roi: number;
  timeframe: string;
  priority: 'high' | 'medium' | 'low';
}
```

## Event System

The FranchiseManager exposes an event emitter for real-time updates:

```typescript
manager.events.on(eventName, handler);
```

### Available Events

- `agent:started` - Agent begins processing
- `agent:completed` - Agent finishes processing
- `analysis:started` - Analysis begins
- `analysis:completed` - Analysis finishes
- `location:added` - New location added
- `opportunity:discovered` - New growth opportunity found
- `metrics:updated` - Metrics updated for location
- `error` - Error occurred

### Event Data Structure

All events follow this structure:

```typescript
interface EventData {
  type: string;
  timestamp: Date;
  data: any;
}
```

### Example Event Handling

```typescript
// Listen for agent completion
manager.events.on('agent:completed', (event) => {
  console.log(`Agent ${event.data.agentType} completed`);
  if (event.data.success) {
    console.log('Results:', event.data.data);
  }
});

// Listen for new opportunities
manager.events.on('opportunity:discovered', (event) => {
  const opp = event.data;
  console.log(`New opportunity: ${opp.description}`);
  console.log(`ROI: ${opp.roi}%`);
});

// Error handling
manager.events.on('error', (event) => {
  console.error('Error occurred:', event.data.error);
  if (event.data.context) {
    console.error('Context:', event.data.context);
  }
});
```

---

For more examples, see the [examples directory](../examples/).
