# Change Management Expert System

An enterprise-grade **domain expert system** for IT change management powered by **AgentDB**. This intelligent system provides automated risk assessment, decision support, and learning capabilities for managing complex enterprise changes.

## 🎯 Overview

This expert system implements ITIL-based change management best practices combined with machine learning through AgentDB's reflexion, causal reasoning, and skill consolidation capabilities. It helps organizations:

- **Assess Risk**: Automated, multi-dimensional risk scoring (technical, business, security)
- **Make Decisions**: Rules-based inference engine with 100+ decision rules
- **Learn from History**: Pattern recognition and causal relationship discovery
- **Ensure Compliance**: Automated compliance checks (SOX, HIPAA, PCI-DSS, GDPR)
- **Optimize Workflows**: Dynamic approval routing based on change characteristics
- **Prevent Failures**: Recommendations based on historical successes and failures

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI / API Interface                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Change Management Service                       │
│  • Request Management   • Status Tracking                   │
│  • Workflow Coordination • Outcome Recording                │
└───────────┬───────────────────────────┬─────────────────────┘
            │                           │
┌───────────▼───────────┐   ┌───────────▼─────────────────────┐
│   Expert Engine       │   │   AgentDB Service               │
│  • Risk Rules         │   │  • Reflexion Memory             │
│  • Approval Rules     │   │  • Causal Graphs                │
│  • Timing Rules       │   │  • Skill Library                │
│  • Pattern Matching   │   │  • Learning Algorithms          │
│  • Decision Making    │   │  • Pattern Discovery            │
└───────────┬───────────┘   └─────────────────────────────────┘
            │
┌───────────▼───────────────────────────────────────────────┐
│                   Knowledge Base                           │
│  • 5 Risk Assessment Rules                                 │
│  • 3 Approval Workflow Rules                               │
│  • 2 Implementation Timing Rules                           │
│  • 4 Proven Implementation Patterns                        │
│  • 5 Best Practice Categories                              │
│  • Compliance Framework Templates                          │
└────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 14+
- npx (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vibecast

# The system is ready to use - no dependencies to install!
# AgentDB will be downloaded automatically via npx
```

### Run the Demo

Experience the full capabilities with 5 different change scenarios:

```bash
node examples/demo.js
```

This demonstrates:
- Low-risk database index creation
- High-risk production migration
- Critical security patch (emergency)
- Application feature release
- Network infrastructure upgrade

## 📖 Usage

### Command-Line Interface

```bash
# Show help
node cli.js help

# Create a new change request
node cli.js create \
  --title "Upgrade PostgreSQL" \
  --description "Upgrade from v12 to v15" \
  --type standard \
  --category database \
  --risk high

# Analyze a change request
node cli.js analyze CHG-1234567890-1234

# Get expert recommendation
node cli.js recommend CHG-1234567890-1234

# List all changes
node cli.js list

# Filter changes
node cli.js list --status approved --category database

# Show statistics
node cli.js stats

# Run learning algorithms
node cli.js learn
```

### Programmatic API

```javascript
const ChangeManagementService = require('./src/services/ChangeManagementService');

const service = new ChangeManagementService();

// Create a change request
const result = await service.createChange({
  title: 'Deploy security patch',
  description: 'Critical vulnerability fix...',
  type: 'emergency',
  category: 'security',
  priority: 'critical',
  requestor: {
    name: 'Security Team',
    email: 'security@example.com'
  },
  // ... more fields
});

// Analyze with expert system
const analysis = await service.analyzeChange(result.change.id);

// Get recommendation
const decision = await service.getRecommendation(result.change.id);

// Record outcome for learning
await service.recordOutcome(result.change.id, {
  success: true,
  duration: 45,
  issues: [],
  rollbackRequired: false,
  completedBy: 'ops-team'
});
```

## 🧠 Expert System Features

### 1. **Risk Assessment Engine**

Multi-dimensional risk scoring:

- **Technical Risk**: Complexity, dependencies, testing coverage, automation level, rollback plan
- **Business Risk**: User impact, downtime requirements, revenue exposure, reputation
- **Security Risk**: Data exposure, authentication changes, encryption impact, access controls

Each dimension weighted and combined into an overall risk score (0.0-1.0) and rating (low/medium/high/critical).

### 2. **Rules-Based Inference**

**Risk Rules:**
- R001: High Impact Database Change
- R002: Emergency Change Risk Override
- R003: Production Downtime Required
- R004: Security Impact Assessment
- R005: Compliance Framework Impact

**Approval Rules:**
- A001: Standard Change Fast Track (24h SLA)
- A002: High Risk Approval Chain (72h SLA)
- A003: Emergency Change Approval (4h SLA)

**Timing Rules:**
- T001: Production Change Window
- T002: Change Freeze Period

### 3. **Pattern Matching**

Pre-loaded proven patterns:
- **P001**: Database Migration Pattern (95% success rate)
- **P002**: Infrastructure Scaling Pattern (98% success rate)
- **P003**: Security Patch Deployment Pattern (92% success rate)
- **P004**: Application Release Pattern (94% success rate)

Each pattern includes:
- Detailed implementation steps
- Success metrics
- Risk factors and mitigations
- Average duration

### 4. **AgentDB Integration**

**Reflexion Memory**: Stores every change as an episode with:
- Input characteristics (type, category, risk, impact)
- Output outcomes (success, duration, issues)
- Critique and lessons learned
- Reward score for reinforcement learning

**Causal Reasoning**: Discovers relationships like:
- "comprehensive_testing" → "successful_deployment" (uplift: 0.35)
- "phased_rollout" → "reduced_incidents" (uplift: 0.28)
- "automated_rollback" → "fast_recovery" (uplift: 0.42)

**Skill Library**: Consolidates successful patterns into reusable skills:
- Automatically extracted from high-reward episodes
- Searchable by scenario similarity
- Includes implementation code and best practices

**Learning Algorithms**:
- Pattern discovery from historical changes
- Causal edge inference (min 3 attempts, 0.6 success rate)
- Skill consolidation (7-day windows)
- Automatic pruning of low-quality patterns

### 5. **Compliance Management**

Automated compliance requirement identification for:
- **SOX**: Audit trails, segregation of duties, management approval
- **HIPAA**: PHI impact assessment, security officer approval, privacy review
- **PCI-DSS**: Change control procedures, security testing, cardholder data protection
- **GDPR**: Data protection impact assessment, privacy by design, cross-border compliance

### 6. **Decision Support**

The expert system makes recommendations:
- **Approve**: Standard changes meeting all criteria
- **Fast Track**: Low-risk changes eligible for expedited approval
- **Conditional Approve**: High-risk changes requiring additional controls
- **Escalate**: Critical changes requiring executive approval
- **Reject**: Changes with validation failures or high risk
- **More Info Needed**: Missing required information

Each decision includes:
- Confidence score (0.0-1.0)
- Reasoning (why this decision)
- Blockers (what's preventing approval)
- Next steps (required actions)

## 📊 Sample Output

```
═══════════════════════════════════════════════════════════════════════
ANALYZING CHANGE REQUEST: CHG-1731601234-5678
═══════════════════════════════════════════════════════════════════════

📊 Risk Assessment:
  Overall Risk: HIGH (0.72)
  Technical Risk: 0.68
  Business Risk: 0.81
  Security Risk: 0.45

📋 Applied Rules:
  • High Impact Database Change (R001)
    Elevated to high risk due to database scope
  • Production Downtime Required (R003)
    Requires CAB approval due to extended downtime

✓ Approval Path:
  Approvers: team_lead → manager → director → cab
  SLA: 72 hours
  CAB Required: Yes
  Additional Reviews: security, architecture

💡 Recommendations:

  Matched Patterns:
    • Successful Database Migration Pattern (95% success rate)
      Avg Duration: 120 minutes
      Steps: 5 steps defined

  Specific Recommendations:
    • Consider implementing this change in phases
    • Schedule a dry-run in a staging environment
    • Ensure 24/7 support coverage during implementation

⚠️  Warnings:
  • Calculated risk (high) matches assessed risk

🔍 Similar Past Changes:
  1. database-standard-change (Success: Yes, Reward: 0.89)
  2. infrastructure-standard-change (Success: Yes, Reward: 0.76)
  3. database-emergency-change (Success: No, Reward: 0.32)

📝 Recommendation: CONDITIONAL_APPROVE
Confidence: 80%
Reasons:
  • High risk - approve with conditions

Next Steps:
  • Require phased implementation
  • Mandatory dry-run in staging
```

## 🗂️ Project Structure

```
vibecast/
├── cli.js                          # Main CLI entry point
├── package.json                    # Project configuration
├── change-management.db            # AgentDB database (SQLite)
├── src/
│   ├── models/
│   │   ├── ChangeRequest.js       # Domain model for changes
│   │   └── KnowledgeBase.js       # Expert knowledge and rules
│   ├── rules/
│   │   └── ExpertEngine.js        # Inference engine
│   ├── services/
│   │   ├── ChangeManagementService.js  # Main service
│   │   └── AgentDBService.js      # AgentDB integration
│   └── cli/
│       └── commands.js             # CLI command implementations
├── examples/
│   ├── demo.js                     # Interactive demonstration
│   └── sample-changes.js          # Sample change scenarios
└── data/                           # Data storage (if needed)
```

## 🔬 AgentDB Features Used

### Reflexion Memory
```bash
# Store change episode
npx agentdb reflexion store "session-id" "task" 0.95 true "critique"

# Retrieve similar changes
npx agentdb reflexion retrieve "database-migration" --k 10 --synthesize-context
```

### Causal Reasoning
```bash
# Add causal relationship
npx agentdb causal add-edge "comprehensive_testing" "success" 0.35 0.9 50

# Query causal edges
npx agentdb causal query "testing" "success" 0.7
```

### Skill Management
```bash
# Create reusable skill
npx agentdb skill create "db-migration" "Zero-downtime migration" "{code}"

# Search skills
npx agentdb skill search "database migration" 5

# Consolidate from episodes
npx agentdb skill consolidate 3 0.7 7 true
```

### Learning Algorithms
```bash
# Discover patterns
npx agentdb learner run 3 0.6 0.7

# Pattern query
npx agentdb query --query "successful deployment" --synthesize-context
```

### Database Operations
```bash
# Export for backup
npx agentdb export ./change-management.db ./backup.json --compress

# Import from backup
npx agentdb import ./backup.json.gz --decompress

# Statistics
npx agentdb db stats
```

## 🎓 Use Cases

1. **IT Operations**: Automate change request evaluation and routing
2. **DevOps**: Integrate with CI/CD pipelines for deployment approval
3. **Compliance Teams**: Ensure regulatory requirements are met
4. **Risk Management**: Quantify and track change-related risks
5. **Knowledge Management**: Build organizational memory of successful changes
6. **Training**: Educate teams on change management best practices
7. **Auditing**: Maintain comprehensive audit trails

## 🔮 Future Enhancements

- [ ] Web UI dashboard
- [ ] REST API server
- [ ] Integration with ticketing systems (Jira, ServiceNow)
- [ ] Real-time collaboration features
- [ ] Advanced ML models for outcome prediction
- [ ] Natural language processing for change descriptions
- [ ] Automated change scheduling optimization
- [ ] Multi-tenant support for enterprise deployment
- [ ] Custom rule builder UI
- [ ] Slack/Teams integration for notifications

## 📚 References

- [AgentDB Documentation](https://github.com/anthropics/agentdb)
- [ITIL Change Management](https://www.axelos.com/certifications/itil-service-management)
- [Expert Systems in Software Engineering](https://en.wikipedia.org/wiki/Expert_system)
- [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366)

## 📄 License

MIT License - See LICENSE file for details

## 👥 Contributing

Contributions welcome! This is a demonstration project from the Vibecast live coding sessions.

## 🙏 Acknowledgments

- Built with [AgentDB](https://github.com/anthropics/agentdb) by Anthropic
- Inspired by ITIL and COBIT frameworks
- Created during Vibecast live coding sessions

---

**Built with ❤️ using AgentDB - Frontier Memory Features for AI Agents**
