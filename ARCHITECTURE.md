# Architecture - Agentic Data Entry Automation

Detailed technical architecture of the system.

---

## System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                         AGENTIC DATA ENTRY SYSTEM                      │
├───────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────┐         │
│  │   Data      │─────→│    Claude    │─────→│   AgentDB    │         │
│  │   Source    │      │    Agent     │      │  (Supabase)  │         │
│  └─────────────┘      └──────────────┘      └──────────────┘         │
│                              │                      │                  │
│                              ↓                      ↓                  │
│                    ┌──────────────────┐   ┌────────────────┐         │
│                    │  Tool Execution  │   │ Reflexion      │         │
│                    │  - Validate      │   │ Memory         │         │
│                    │  - Enrich        │   └────────────────┘         │
│                    │  - Store         │                               │
│                    └──────────────────┘                               │
│                              │                                         │
│                    ┌─────────┴────────┐                               │
│                    ↓                  ↓                                │
│            ┌─────────────┐   ┌──────────────┐                        │
│            │   Success   │   │  Exception   │                         │
│            │   Records   │   │   Records    │                         │
│            └─────────────┘   └──────────────┘                         │
│                    │                  │                                │
│                    ↓                  ↓                                │
│            ┌─────────────┐   ┌──────────────┐                        │
│            │ Audit Trail │   │    Human     │                         │
│            │    +Proof   │   │   Review     │                         │
│            └─────────────┘   └──────────────┘                         │
│                                                                         │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Claude Agent Layer

**File**: `src/agents/ClaudeAgent.js`

```javascript
ClaudeAgent
├── Configuration
│   ├── name: Agent identifier
│   ├── model: Claude model version
│   ├── tools: Tool definitions
│   └── hooks: Pre/Post tool execution
├── Execution Loop
│   ├── Parse user prompt
│   ├── Call Claude API
│   ├── Detect tool uses
│   ├── Execute tools
│   └── Continue until completion
└── Session Management
    ├── sessionId: Unique session ID
    └── conversationHistory: Message history
```

**Key Features**:
- Agentic loop with tool calling
- PreToolUse hook for context loading
- PostToolUse hook for audit and metrics
- Supports multiple concurrent tools
- Session-based conversation tracking

### 2. Data Processor

**File**: `src/dataProcessor.js`

```javascript
DataProcessor (extends ClaudeAgent)
├── Tools
│   ├── validate: Rule-based validation
│   ├── enrich: Data enrichment
│   ├── store: Record storage
│   └── fetch_csv: CSV ingestion
├── PreToolUse Hook
│   ├── Load active rules
│   ├── Load reflexion memory
│   └── Create audit trail entry
└── PostToolUse Hook
    ├── Update audit trail
    ├── Generate cryptographic proof
    ├── Create exception if needed
    └── Store execution metrics
```

**Validation Flow**:
```
Input Record
    ↓
Load Rules (from AgentDB)
    ↓
For each validation rule:
    Apply operator (gt, lt, eq, regex, exists)
    ↓
    Pass? → Continue
    Fail? → Add error
    ↓
All rules checked
    ↓
Errors? → Create exception
No errors? → Mark valid
```

**Enrichment Flow**:
```
Valid Record
    ↓
Load Enrichment Rules
    ↓
For each rule:
    Apply transformation
    - Add field (NOW(), COMPUTE_CATEGORY)
    - Transform value
    ↓
Update record with enriched data
```

### 3. AgentDB Layer

**File**: `src/db/agentdb.js`

```
AgentDB Client (Supabase)
├── Connection Management
│   └── Singleton connection pool
├── Query Methods
│   ├── query(table, options)
│   ├── insert(table, data)
│   ├── update(table, where, data)
│   └── delete(table, where)
├── Specialized Methods
│   ├── getActiveRules()
│   ├── getPendingExceptions()
│   ├── createAuditTrail()
│   ├── storeMemory()
│   └── getMetricsSummary()
└── Schema
    ├── rules: Validation/enrichment rules
    ├── records: Processed data
    ├── exceptions: Failed validations
    ├── agent_memory: Reflexion storage
    ├── audit_trail: Full audit log
    ├── cryptographic_proofs: Tamper detection
    └── processing_metrics: Performance data
```

**Database Schema**:

```sql
rules
├── id (UUID)
├── name
├── rule_type (validation | enrichment | transformation)
├── condition (JSONB)
├── action (JSONB)
├── priority (INTEGER)
└── active (BOOLEAN)

records
├── id (UUID)
├── external_id
├── data (JSONB)
├── status (pending | valid | invalid | processing)
├── valid (BOOLEAN)
├── enriched (BOOLEAN)
├── process_time (INTEGER)
└── validation_errors (JSONB)

exceptions
├── id (UUID)
├── record_id (FK → records)
├── exception_type
├── error_details (JSONB)
├── severity (low | medium | high | critical)
├── reviewed (BOOLEAN)
└── resolution_action

agent_memory
├── id (UUID)
├── agent_name
├── memory_type (reflection | learning | pattern | failure)
├── content (TEXT)
├── confidence_score (DECIMAL)
└── usage_count (INTEGER)

audit_trail
├── id (UUID)
├── event_type
├── entity_type
├── entity_id
├── actor
├── action
├── before_state (JSONB)
├── after_state (JSONB)
└── timestamp

cryptographic_proofs
├── id (UUID)
├── audit_trail_id (FK)
├── proof_type (lean_proof | merkle_tree | signature)
├── proof_data (JSONB)
├── hash (SHA-256)
├── previous_hash (blockchain-style)
├── signature (HMAC)
└── verified (BOOLEAN)
```

### 4. Cryptographic Provenance

**File**: `src/utils/proofs.js`

```
Proof Generation Pipeline
├── 1. Get Previous Hash
│   └── Blockchain-style chaining
├── 2. Hash Current Event
│   └── SHA-256(auditTrailId + eventData + previousHash)
├── 3. Generate Lean Proof
│   ├── Theorem: event_valid_<toolName>
│   ├── Axioms: [valid_input, deterministic_execution, state_consistency]
│   ├── Premises: Input validation, execution bounds, type checking
│   └── Proof steps: 1→2→3→conclusion
├── 4. Create HMAC Signature
│   └── HMAC-SHA256(hash, encryptionKey)
└── 5. Store Proof
    └── Insert into cryptographic_proofs table
```

**Lean Proof Structure**:
```json
{
  "theorem": "event_valid_validate",
  "axioms": ["valid_input", "deterministic_execution", "state_consistency"],
  "premises": {
    "input_well_formed": true,
    "execution_time_reasonable": true,
    "result_type_matches": true
  },
  "proof_steps": [
    {
      "step": 1,
      "claim": "Input is well-formed",
      "justification": "By input validation axiom"
    },
    ...
  ],
  "verified": true
}
```

**Verification Chain**:
```
For each proof in chain:
    1. Verify hash chain: proof.previous_hash == previous_proof.hash
    2. Verify signature: HMAC(proof.hash, key) == proof.signature
    3. Verify Lean proof: All premises true
    4. Overall valid = all checks pass
```

### 5. Flow-Nexus Orchestration

**File**: `src/orchestration/flowNexus.js`

```
FlowNexusClient
├── Sandbox Management
│   ├── createSandbox(name, template)
│   ├── executeSandbox(id, command)
│   ├── getSandboxLogs(id)
│   └── destroySandbox(id)
└── Execution Modes
    ├── Standard: execAsync
    └── Streaming: spawn with callbacks

SwarmOrchestrator
├── Agent Registry
│   └── Map<name, {instance, status, taskQueue}>
├── Task Assignment
│   └── assignTask(agentName, task)
├── Parallel Execution
│   └── executeParallel(tasks[])
└── Status Monitoring
    └── getStatus()
```

**Swarm Pattern**:
```
Orchestrator
├── Agent 1 (idle) ─→ Task Queue [T1, T2]
├── Agent 2 (busy) ─→ Task Queue [T3]
└── Agent 3 (error) ─→ Task Queue []

Execute Parallel:
    Promise.allSettled([
        agent1.run(T1),
        agent2.run(T3),
        agent3.run(T4)
    ])
```

### 6. Exception Review Interface

**File**: `src/reviewExceptions.js`

```
Review Loop
├── 1. Fetch Pending Exceptions (limit 1)
├── 2. Display Exception
│   ├── Record data
│   ├── Validation errors
│   └── Severity
├── 3. Prompt Resolution
│   ├── Approve → Mark valid
│   ├── Reject → Mark invalid
│   ├── Modify → Update data + mark valid
│   ├── Reprocess → Send through pipeline again
│   ├── Audit → Generate full report
│   └── Skip → Leave for later
├── 4. Process Resolution
│   ├── Update database
│   ├── Create audit trail
│   └── Store resolution
└── 5. Continue or Exit
```

### 7. Metrics & ROI

**File**: `src/metrics.js`

```
Metrics Dashboard
├── Processing Metrics
│   ├── Total records
│   ├── Valid/invalid counts
│   ├── Validation rate
│   └── Average latency
├── Exception Metrics
│   ├── Exception rate
│   ├── Automation rate (100% - exception rate)
│   ├── Review rate
│   └── Breakdown by type
├── ROI Calculation
│   ├── Time saved = automated_records × manual_time
│   ├── Labor cost saved = time_saved × hourly_wage
│   ├── API costs = total_records × cost_per_request
│   ├── Net savings = labor_saved - api_costs
│   └── ROI = (net_savings / api_costs) × 100
└── Agent Performance
    ├── Tool invocation counts
    ├── Average execution time per tool
    └── Min/max latency
```

---

## Data Flow

### Happy Path: Valid Record

```
1. Input → processRecord()
2. Store record (status: pending)
3. Claude Agent receives prompt
4. Agent calls 'validate' tool
   - PreToolUse: Load rules, memory, create audit
   - Execute: Apply validation rules
   - PostToolUse: Update audit, create proof, log metrics
5. Validation passes
6. Agent calls 'enrich' tool
   - PreToolUse: Load enrichment rules
   - Execute: Apply transformations
   - PostToolUse: Update audit, create proof
7. Update record (status: valid, enriched: true)
8. Return success
```

### Exception Path: Invalid Record

```
1. Input → processRecord()
2. Store record (status: pending)
3. Claude Agent receives prompt
4. Agent calls 'validate' tool
5. Validation fails
6. PostToolUse hook:
   - Create exception entry
   - Store reflexion memory (failure pattern)
   - Update audit trail
   - Generate cryptographic proof
7. Update record (status: invalid, valid: false)
8. Exception appears in review queue
9. Human review:
   - Approve → Update to valid
   - Reject → Confirm invalid
   - Modify → Fix data + update
   - Reprocess → Run through pipeline again
10. Resolution recorded in audit trail
```

---

## Security Model

### Layers of Security

1. **Authentication & Authorization**
   - Supabase Row-Level Security (RLS)
   - Service key for backend operations
   - Anon key for client operations

2. **Data Protection**
   - Encryption at rest (Supabase native)
   - Encryption in transit (HTTPS)
   - Optional field-level encryption

3. **Audit Trail**
   - Every change recorded
   - Before/after state capture
   - Actor identification
   - Timestamp precision

4. **Cryptographic Proofs**
   - Hash chaining (tamper detection)
   - HMAC signatures (authenticity)
   - Lean proofs (logical correctness)

5. **Privacy**
   - Local ONNX models for sensitive data
   - No prompt/response logging
   - Metadata-only audit logs

---

## Cost Optimization

### Agentic-Flow Routing

```yaml
Request arrives
    ↓
Check lane policy (strict/economy/premium)
    ↓
Try models in order:
    1. ONNX local (free, privacy)
    2. OpenRouter (cheaper external)
    3. Anthropic Claude (premium)
    ↓
Until: Success OR price_cap exceeded OR latency_target exceeded
```

**Example Routing**:

| Lane | Use Case | Order | Price Cap |
|------|----------|-------|-----------|
| Strict | PII data | ONNX → Anthropic → OpenRouter | $0.05 |
| Economy | Batch jobs | ONNX → OpenRouter → Anthropic | $0.02 |
| Premium | Complex validation | Anthropic → OpenRouter → ONNX | $0.15 |

### Cost Breakdown

```
Cost per record = API_cost + (human_review_cost × exception_rate)

Example:
- 1000 records/day
- $0.01 per API call
- 15% exception rate
- $25/hour human review
- 5 minutes per exception review

API cost = 1000 × $0.01 = $10/day
Review cost = (1000 × 0.15) × (5/60) × $25 = $312.50/day
Total = $322.50/day

Without automation (all manual):
Manual cost = 1000 × (5/60) × $25 = $2,083.33/day

Savings = $2,083.33 - $322.50 = $1,760.83/day (84% reduction)
ROI = ($1,760.83 / $322.50) × 100 = 546%
```

---

## Scalability

### Horizontal Scaling

```
Load Balancer
    ↓
┌───────┬───────┬───────┐
│ Node1 │ Node2 │ Node3 │  (Claude Agent instances)
└───┬───┴───┬───┴───┬───┘
    └───────┴───────┘
          ↓
    AgentDB (Supabase)
    - Connection pooling
    - Read replicas
    - Caching layer
```

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Throughput | 100 records/min | Per agent instance |
| Latency | < 500ms avg | End-to-end processing |
| Exception rate | < 20% | Depends on data quality |
| Automation rate | > 80% | 80/20 principle |
| Uptime | 99.5% | Excludes maintenance |

### Bottlenecks & Mitigations

1. **Claude API rate limits**
   - Mitigation: Queue with exponential backoff
   - Mitigation: Multiple API keys (round-robin)

2. **Database connections**
   - Mitigation: Connection pooling
   - Mitigation: Read replicas for queries

3. **Cryptographic proof generation**
   - Mitigation: Async/background processing
   - Mitigation: Batch proof verification

4. **Human review queue**
   - Mitigation: Priority-based queue
   - Mitigation: Multiple reviewers

---

## Extension Points

### Adding New Tools

```javascript
// In dataProcessor.js
tools: {
  my_new_tool: {
    description: 'What this tool does',
    parameters: {
      type: 'object',
      properties: { /* ... */ },
      required: ['field1']
    },
    execute: async (input, context) => {
      // Access context.rules, context.memory
      // Perform operation
      return result;
    }
  }
}
```

### Adding New Agents

```javascript
import { ClaudeAgent } from './agents/ClaudeAgent.js';
import { getSwarmOrchestrator } from './orchestration/flowNexus.js';

const specializedAgent = new ClaudeAgent({
  name: 'SpecializedAgent',
  tools: { /* ... */ }
});

const swarm = getSwarmOrchestrator();
swarm.registerAgent('specialized', specializedAgent);
```

### Custom Validation Rules

```sql
-- Complex business logic
INSERT INTO rules (name, rule_type, condition, action) VALUES (
  'Cross-field validation',
  'validation',
  '{
    "type": "custom",
    "logic": "amount > 1000 AND approval_required = false"
  }',
  '{
    "type": "reject",
    "message": "High amounts require approval"
  }'
);
```

---

## Monitoring & Observability

### Key Metrics to Track

1. **Processing Metrics**
   - Records/minute
   - Success rate
   - Average latency
   - P95/P99 latency

2. **Quality Metrics**
   - Exception rate
   - Review resolution distribution
   - Rule effectiveness

3. **Cost Metrics**
   - API costs
   - Human review costs
   - Infrastructure costs
   - ROI

4. **System Health**
   - Database connection pool usage
   - Claude API error rate
   - Proof verification failures
   - Queue depth

### Alerting

```yaml
alerts:
  - name: High Exception Rate
    condition: exception_rate > 30%
    action: Notify ops team

  - name: Low Automation Rate
    condition: automation_rate < 70%
    action: Review rule effectiveness

  - name: Slow Processing
    condition: avg_latency > 1000ms
    action: Check Claude API / Database

  - name: Proof Verification Failure
    condition: proof_verification_failures > 0
    action: CRITICAL - possible tampering
```

---

## Future Enhancements

1. **Machine Learning Integration**
   - Train ML models on resolved exceptions
   - Predict which records will fail
   - Auto-suggest rule updates

2. **Advanced Reflexion**
   - Agent learns from review decisions
   - Automatically adjusts validation thresholds
   - Pattern recognition for edge cases

3. **Multi-Tenancy**
   - Separate rule sets per tenant
   - Isolated data storage
   - Per-tenant metrics

4. **Real-time Dashboard**
   - Live processing metrics
   - Exception queue visualization
   - Cost tracking

5. **Workflow Orchestration**
   - Multi-step approval flows
   - Conditional routing
   - Integration with external systems

---

**Architecture Version**: 1.0.0
**Last Updated**: 2025-11-05
**Maintained by**: rUv / Vibecast Community
