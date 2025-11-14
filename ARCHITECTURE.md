# Architecture Documentation

## System Overview

The Change Management Expert System is built as a modular, layered architecture that separates concerns and enables extensibility.

## Core Components

### 1. Domain Models (`src/models/`)

#### ChangeRequest.js
- Represents an enterprise change request with full lifecycle tracking
- Includes validation logic
- Tracks history, comments, attachments
- Manages status transitions
- Properties:
  - Basic info (title, description, type, category, priority, status)
  - Stakeholders (requestor, implementer, approvers, reviewers)
  - Impact assessment (scope, affected systems, downtime, compliance)
  - Risk assessment (overall, technical, business, security risks)
  - Implementation details (steps, schedule, verification, rollback)
  - Compliance requirements
  - Success criteria and actual outcomes

#### KnowledgeBase.js
- Contains the expert system's domain knowledge
- Implements rule sets for different decision categories
- Stores proven implementation patterns
- Maintains best practices by category
- Defines risk factors and weights
- Provides approval matrices
- Key methods:
  - `findApplicableRules()`: Filter rules by condition
  - `findMatchingPattern()`: Pattern matching by keywords
  - `getApprovalRequirements()`: Determine approval path
  - `getRiskFactors()`: Get weighted risk factors
  - `getBestPractices()`: Retrieve relevant practices

### 2. Rules Engine (`src/rules/`)

#### ExpertEngine.js
- Implements forward-chaining inference
- Applies rules to change requests
- Generates recommendations
- Calculates quantitative risk scores
- Makes approval/rejection decisions
- Key capabilities:
  - Risk rule application
  - Approval workflow determination
  - Timing rule enforcement
  - Pattern matching
  - Multi-dimensional risk scoring
  - Compliance requirement identification
  - Decision making with confidence scores

**Inference Process:**
```
Input: Change Request
  ↓
1. Apply Risk Rules → Update risk assessment
  ↓
2. Apply Approval Rules → Determine approval path
  ↓
3. Apply Timing Rules → Schedule recommendations
  ↓
4. Find Patterns → Match historical patterns
  ↓
5. Generate Recommendations → Specific advice
  ↓
6. Calculate Risk Score → Quantitative assessment
  ↓
7. Determine Compliance → Framework requirements
  ↓
Output: Analysis with recommendations
```

### 3. Services Layer (`src/services/`)

#### ChangeManagementService.js
- Main orchestration service
- Coordinates expert engine and AgentDB
- Manages change request lifecycle
- Handles outcome recording and learning
- Key methods:
  - `createChange()`: Create and validate new changes
  - `analyzeChange()`: Run expert system analysis
  - `getRecommendation()`: Get approval/rejection decision
  - `updateChangeStatus()`: Lifecycle management
  - `recordOutcome()`: Store results for learning
  - `searchChanges()`: Query and filter changes
  - `discoverPatterns()`: Trigger ML learning
  - `consolidateSkills()`: Extract reusable skills

#### AgentDBService.js
- Integration layer for AgentDB
- Wraps AgentDB CLI commands
- Provides type-safe interface
- Handles error recovery
- Key capabilities:
  - Episode storage (reflexion memory)
  - Similar change retrieval
  - Skill management (create, search, consolidate)
  - Causal edge tracking
  - Pattern discovery (learner)
  - Database export/import
  - Reward calculation

### 4. CLI Interface (`src/cli/`)

#### commands.js
- Command implementations
- User interaction handling
- Output formatting
- Error handling
- Available commands:
  - `create`: New change requests
  - `analyze`: Expert system analysis
  - `recommend`: Decision support
  - `list`: Query changes
  - `stats`: System statistics
  - `learn`: Trigger ML algorithms
  - `help`: Documentation

#### cli.js
- Entry point for CLI
- Argument parsing
- Command routing
- Error handling

## Data Flow

### Creating and Analyzing a Change

```
User Input (CLI)
      ↓
commands.create()
      ↓
ChangeManagementService.createChange()
      ↓
ChangeRequest (validation)
      ↓
ExpertEngine.analyze()
      ↓
KnowledgeBase (rules, patterns)
      ↓
Analysis Result
      ↓
Display to User
```

### Recording Outcomes for Learning

```
Outcome Data
      ↓
ChangeManagementService.recordOutcome()
      ↓
ExpertEngine.generateCritique()
      ↓
AgentDBService.storeChangeEpisode()
      ↓
npx agentdb reflexion store
      ↓
SQLite Database (change-management.db)
```

### Retrieving Similar Changes

```
Change Request
      ↓
AgentDBService.retrieveSimilarChanges()
      ↓
npx agentdb reflexion retrieve
      ↓
Vector Similarity Search
      ↓
Ranked Episodes
      ↓
Context for Analysis
```

## Knowledge Representation

### Rules Structure

```javascript
{
  id: 'R001',
  name: 'Rule Name',
  condition: (change) => boolean,  // When to apply
  action: (change) => string       // What to do
}
```

### Pattern Structure

```javascript
{
  id: 'P001',
  name: 'Pattern Name',
  scenario: 'Description',
  steps: ['step1', 'step2', ...],
  successRate: 0.95,
  avgDuration: 120,
  risks: ['risk1', 'risk2'],
  mitigations: ['mitigation1', ...]
}
```

### Risk Factors

```javascript
{
  factor: 'complexity',
  weight: 0.3,          // Contribution to total score
  description: 'Technical complexity of the change'
}
```

## AgentDB Integration

### Reflexion Memory Schema

Stored episodes include:
- **Session ID**: Unique change identifier
- **Task**: Change type classification
- **Reward**: Success score (0.0-1.0)
- **Success**: Boolean outcome
- **Critique**: Lessons learned
- **Input**: Change characteristics (JSON)
- **Output**: Outcome details (JSON)
- **Latency**: Duration in milliseconds
- **Tokens**: Data size metric

### Causal Graph

Edges represent discovered relationships:
- **Cause**: Action or characteristic
- **Effect**: Outcome or result
- **Uplift**: Improvement magnitude
- **Confidence**: Statistical confidence
- **Sample Size**: Number of observations

Example edges:
```
"comprehensive_testing" → "success" (uplift: 0.35, confidence: 0.9)
"phased_rollout" → "reduced_incidents" (uplift: 0.28, confidence: 0.85)
"automated_rollback" → "fast_recovery" (uplift: 0.42, confidence: 0.95)
```

### Skill Library

Skills extracted from successful changes:
- **Name**: Descriptive identifier
- **Description**: What it does
- **Code**: Implementation or procedure
- **Metadata**: Usage statistics, success rate

## Risk Scoring Algorithm

### Technical Risk (0.0-1.0)
```
score = Σ(factor_value × factor_weight)

Factors:
- complexity: 0.3 weight
- dependencies: 0.2 weight
- testing: 0.25 weight
- automation: 0.15 weight
- rollback: 0.1 weight
```

### Business Risk (0.0-1.0)
```
score = Σ(factor_value × factor_weight)

Factors:
- user_impact: 0.35 weight
- downtime: 0.3 weight
- revenue_impact: 0.2 weight
- reputation: 0.15 weight
```

### Security Risk (0.0-1.0)
```
score = Σ(factor_value × factor_weight)

Factors:
- data_exposure: 0.35 weight
- authentication: 0.25 weight
- encryption: 0.2 weight
- access_control: 0.2 weight
```

### Overall Risk
```
overall = (technical + business + security) / 3

Rating:
- 0.00-0.25: low
- 0.25-0.50: medium
- 0.50-0.75: high
- 0.75-1.00: critical
```

## Decision Making Logic

```javascript
function makeDecision(change) {
  // 1. Validation check
  if (!valid) return 'reject'

  // 2. Required information check
  if (missingInfo) return 'more_info_needed'

  // 3. Risk-based decision
  if (riskScore >= 0.8) return 'escalate'
  if (riskScore >= 0.6) return 'conditional_approve'
  if (riskScore >= 0.3) return 'approve'
  return 'fast_track'
}
```

## Extensibility Points

### Adding New Rules
1. Add rule to KnowledgeBase.initializeRules()
2. Assign unique ID (R00X, A00X, T00X)
3. Define condition function
4. Define action function
5. Test with sample changes

### Adding New Patterns
1. Add pattern to KnowledgeBase.initializePatterns()
2. Define scenario keywords
3. Document steps and success rate
4. Identify risks and mitigations
5. Update pattern matching logic if needed

### Adding New Risk Factors
1. Add factor to KnowledgeBase.initializeRiskFactors()
2. Assign weight (ensure category weights sum to 1.0)
3. Update ExpertEngine.calculateRiskScore()
4. Implement factor value calculation

### Adding New Compliance Frameworks
1. Add framework to KnowledgeBase.determineComplianceRequirements()
2. Define requirements array
3. Update ChangeRequest.compliance.complianceFrameworks enum
4. Test with sample changes

## Performance Considerations

### Memory Usage
- In-memory storage for demo (Map)
- For production: implement persistent storage
- AgentDB handles vector storage efficiently

### AgentDB Operations
- Vector searches: O(n log k) with HNSW
- Episode retrieval: Optimized with indexes
- Skill consolidation: Batched operations
- Pattern discovery: Scheduled offline processing

### Optimization Opportunities
1. Cache knowledge base initialization
2. Batch AgentDB operations
3. Implement connection pooling
4. Add query result caching
5. Parallel rule evaluation

## Security Considerations

### Input Validation
- All change requests validated before processing
- SQL injection prevented (parameterized queries in AgentDB)
- Command injection prevented (child_process with sanitization)

### Access Control
- (Demo version has no auth - add for production)
- Approval matrix enforces segregation of duties
- Audit trail maintained in history

### Data Protection
- Sensitive data should be encrypted at rest
- AgentDB supports encryption
- Compliance frameworks guide data handling

## Testing Strategy

### Unit Tests
- Model validation logic
- Rule condition functions
- Risk calculation algorithms
- Reward calculation

### Integration Tests
- Service layer coordination
- AgentDB command execution
- Error handling and recovery
- End-to-end workflows

### Expert System Tests
- Rule application correctness
- Pattern matching accuracy
- Risk scoring consistency
- Decision quality metrics

### Example Test Cases
```javascript
describe('Risk Assessment', () => {
  test('High-risk database change requires CAB', () => {
    const change = createHighRiskDatabaseChange();
    const analysis = expertEngine.analyze(change);
    expect(analysis.approvalPath.cabRequired).toBe(true);
  });
});
```

## Deployment

### Development
```bash
npm start          # Run CLI
npm run demo      # Run demonstration
```

### Production Considerations
1. Replace in-memory storage with database (PostgreSQL, MongoDB)
2. Add authentication and authorization
3. Implement REST API or GraphQL
4. Add monitoring and logging
5. Configure AgentDB with production embeddings
6. Set up automated backups
7. Implement rate limiting
8. Add load balancing for scale

## Future Architecture Improvements

### Microservices
- Split into separate services:
  - Change Management Service
  - Expert System Service
  - AgentDB Service
  - Notification Service
  - Reporting Service

### Event-Driven
- Use message queue (RabbitMQ, Kafka)
- Async processing for ML operations
- Real-time notifications

### Web UI
- React/Vue frontend
- Real-time updates via WebSocket
- Dashboard with analytics
- Interactive rule builder

### Integration Architecture
- REST API for external systems
- Webhooks for notifications
- SSO integration
- ITSM tool connectors (Jira, ServiceNow)
