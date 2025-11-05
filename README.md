# Vibecast - Agentic Data Entry Automation System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

**Automated data entry with human-in-loop exception handling using Claude AI, AgentDB, Flow-Nexus, and cryptographic provenance.**

Part of the Weekly Vibecast Live coding sessions with rUv. Check branches for each week's project.

---

## 🎯 Overview

This system implements the **80/20 automation principle**: automate the straightforward 80% of data entry tasks while routing the complex 20% to human review. It features:

- **Claude-Flow Agents** - AI-powered data validation and enrichment
- **AgentDB** - Structured memory and reflexion storage (Supabase/PostgreSQL)
- **Agentic-Flow** - Cost-optimized model routing (ONNX, Anthropic, OpenRouter)
- **Flow-Nexus** - Sandbox orchestration for isolated execution
- **Lean-Agentic Proofs** - Cryptographic provenance for complete auditability
- **Human-in-Loop** - Exception review interface for edge cases

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Entry Pipeline                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Input Data → [Claude Agent] → Validate → Enrich → Store    │
│                      ↓                                        │
│                   AgentDB ← Reflexion Memory                 │
│                      ↓                                        │
│             ┌────────┴────────┐                              │
│             ↓                 ↓                               │
│      [Valid Records]   [Exceptions] → Human Review           │
│             ↓                 ↓                               │
│      Audit Trail       Cryptographic Proofs                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **ClaudeAgent** (`src/agents/ClaudeAgent.js`)
   - Agentic workflow with PreToolUse/PostToolUse hooks
   - Tool execution and conversation management
   - Session tracking and context management

2. **DataProcessor** (`src/dataProcessor.js`)
   - Main processing agent with validation and enrichment tools
   - Rule-based validation and data transformation
   - Exception detection and routing

3. **AgentDB** (`src/db/agentdb.js`)
   - Connection layer to Supabase/PostgreSQL
   - Schema: records, rules, exceptions, agent_memory, audit_trail, cryptographic_proofs
   - Reflexion memory for agent learning

4. **Cryptographic Provenance** (`src/utils/proofs.js`)
   - Lean-Agentic proof generation
   - Blockchain-style hash chaining
   - HMAC signatures for tamper detection
   - Audit report generation

5. **Flow-Nexus Orchestration** (`src/orchestration/flowNexus.js`)
   - Sandbox creation and management
   - Swarm coordination for multi-agent tasks
   - Isolated execution environments

6. **Exception Review** (`src/reviewExceptions.js`)
   - Interactive CLI for human review
   - Approve, reject, modify, or reprocess exceptions
   - Full audit trail of decisions

7. **Metrics & ROI** (`src/metrics.js`)
   - Processing metrics and exception rates
   - ROI calculation (time saved, cost analysis)
   - Agent performance tracking

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Supabase account (for AgentDB)
- Anthropic API key (for Claude)

### Installation

```bash
# Clone the repository
git clone https://github.com/ruvnet/vibecast.git
cd vibecast
git checkout claude/agentic-data-entry-automation-011CUoy2taW1UFBWxR8pyr3m

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys and database credentials

# Initialize database
npm run setup
```

### Environment Configuration

Edit `.env` with your credentials:

```env
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# AgentDB (Supabase)
AGENTDB_URL=https://your-project.supabase.co
AGENTDB_KEY=eyJhbGc...
AGENTDB_SERVICE_KEY=eyJhbGc...

# Optional: OpenRouter for model routing
OPENROUTER_API_KEY=sk-or-...

# Security
ENABLE_ENCRYPTION=true
ENCRYPTION_KEY=your-32-byte-key-here
ENABLE_LEAN_PROOFS=true
```

### Run Example

```bash
# Process sample data
npm start example

# View metrics dashboard
npm run metrics

# Review exceptions
npm run review

# Reprocess failed records
npm run reprocess -- --all
```

---

## 📊 Usage Examples

### Process a Single Record

```javascript
import { processRecord } from './src/dataProcessor.js';

const result = await processRecord({
  email: 'user@example.com',
  amount: 150.00,
  description: 'Transaction data'
}, 'EXTERNAL-ID-123');
```

### Process a Batch

```javascript
import { processBatch } from './src/index.js';

const records = [
  { externalId: 'REC-001', data: { email: 'user@example.com', amount: 100 } },
  { externalId: 'REC-002', data: { email: 'test@example.com', amount: 200 } }
];

const results = await processBatch(records);
console.log(`Processed: ${results.successful}/${results.total}`);
```

### Review Exceptions

```bash
npm run review

# Interactive CLI:
# - View exception details
# - Approve/reject/modify records
# - Generate audit reports
# - Reprocess with updated rules
```

### View Metrics

```bash
npm run metrics

# Displays:
# - Processing metrics (throughput, latency)
# - Exception rates and automation rate
# - ROI calculation (time saved, costs)
# - Agent performance statistics
```

---

## 🔧 Configuration

### Validation Rules

Edit rules in AgentDB or via SQL:

```sql
INSERT INTO rules (name, rule_type, condition, action, priority) VALUES
  ('Email Validation',
   'validation',
   '{"field": "email", "operator": "regex", "value": "^[^@]+@[^@]+\\.[^@]+$"}',
   '{"type": "reject", "message": "Invalid email"}',
   100);
```

### Enrichment Rules

```sql
INSERT INTO rules (name, rule_type, condition, action, priority) VALUES
  ('Add Timestamp',
   'enrichment',
   '{"always": true}',
   '{"type": "add_field", "field": "processed_at", "value": "NOW()"}',
   50);
```

### Agentic-Flow Policy

Edit `config/agentic-flow.policy.yaml` to configure model routing:

```yaml
lanes:
  strict:
    order: [onnx_local, anthropic, openrouter]
    price_cap: 0.05
    privacy_mode: true

  economy:
    order: [onnx_local, openrouter, anthropic]
    price_cap: 0.02
```

---

## 📁 Project Structure

```
vibecast/
├── config/
│   ├── agentic-flow.policy.yaml    # Model routing configuration
│   └── database.schema.sql         # AgentDB schema
├── src/
│   ├── agents/
│   │   └── ClaudeAgent.js          # Base Claude agent class
│   ├── db/
│   │   └── agentdb.js              # Database connection layer
│   ├── orchestration/
│   │   └── flowNexus.js            # Flow-Nexus client & swarm
│   ├── setup/
│   │   └── initDatabase.js         # Database initialization
│   ├── utils/
│   │   └── proofs.js               # Cryptographic provenance
│   ├── dataProcessor.js            # Main data processor agent
│   ├── reviewExceptions.js         # Exception review interface
│   ├── reprocess.js                # Reprocessing utility
│   ├── metrics.js                  # Metrics and ROI tracking
│   └── index.js                    # Main entry point
├── .env.example                    # Environment template
├── package.json
└── README.md
```

---

## 🔐 Security & Compliance

### Cryptographic Provenance

Every operation creates:
1. **Audit Trail Entry** - What, when, who, before/after state
2. **Cryptographic Proof** - Lean-style theorem proving event validity
3. **Hash Chain** - Blockchain-style chaining for tamper detection
4. **HMAC Signature** - Cryptographic signature for verification

### Verify Audit Trail

```javascript
import { generateAuditReport } from './src/utils/proofs.js';

const report = await generateAuditReport('record-id', 'record');
console.log(`Proof chain valid: ${report.proofChainValid}`);
```

### Privacy

- **Local ONNX models** for sensitive data (privacy_mode: true)
- **Encryption** for data at rest (ENABLE_ENCRYPTION=true)
- **Audit logs** never contain raw prompts/responses

---

## 📈 Metrics & ROI

### Key Metrics

- **Automation Rate**: % of records processed without human intervention
- **Exception Rate**: % of records requiring human review
- **Cycle Time**: Average processing time per record
- **Validation Rate**: % of valid records
- **Review Rate**: % of exceptions reviewed

### ROI Calculation

Based on:
- Manual processing time saved
- Labor cost savings
- API costs
- Net savings and ROI percentage

View with: `npm run metrics`

---

## 🛠️ Development

### Run Tests

```bash
npm test
```

### Add a New Tool

Edit `src/dataProcessor.js`:

```javascript
tools: {
  my_new_tool: {
    description: 'Tool description',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      },
      required: ['input']
    },
    execute: async (input, context) => {
      // Tool implementation
      return { result: 'success' };
    }
  }
}
```

### Create a New Agent

```javascript
import { ClaudeAgent } from './src/agents/ClaudeAgent.js';

const myAgent = new ClaudeAgent({
  name: 'MyAgent',
  preToolUse: async (context) => {
    // Pre-tool hook
  },
  postToolUse: async (context, toolName, input, result) => {
    // Post-tool hook
  },
  tools: {
    // Define tools
  }
});

await myAgent.run('Process this data...');
```

---

## 🤝 Contributing

Contributions are welcome! This is part of the Weekly Vibecast coding sessions.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🔗 Resources

- **AgentDB**: PostgreSQL/Supabase-based structured memory
- **Claude AI**: Anthropic's Claude models
- **Agentic-Flow**: Cost-optimized model routing
- **Flow-Nexus**: Sandbox orchestration framework
- **Lean-Agentic**: Theorem-proving for AI provenance

---

## 💬 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Join the Vibecast community
- Watch the live coding sessions

---

**Built with ❤️ by rUv for the Vibecast community**

*Automation that keeps humans in the loop where it matters.*
