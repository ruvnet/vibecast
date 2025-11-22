# Brief Swarm Development Prompt (Copy-Paste Ready)

Use this prompt directly in Claude Code Web:

---

**Swarm Development Workflow for [PROJECT_NAME]**

Initialize: `npx claude-flow@alpha init --force`

**Config**: 5 agents (1 queen + 4 workers), Agent Booster + ReasoningBank enabled, 6 max concurrent tasks

**Phase 1 - Research (Goal Agents)**
Swarm analyzes:
- Requirements: [YOUR_REQUIREMENTS]
- Architecture: [DESIRED_ARCHITECTURE]
- Tech stack: [TECHNOLOGIES]
- Risks: [CONSTRAINTS]

**Phase 2 - Development (5-Agent Swarm)**
Concurrent implementation:
- [MODULE_1]: Core business logic
- [MODULE_2]: API/endpoints
- [MODULE_3]: Database/models
- [MODULE_4]: Frontend/UI
- [MODULE_5]: Integration
- [MODULE_6]: Documentation

Enable features: `npx claude-flow@alpha agent booster enable && npx claude-flow@alpha agent memory init`

**Phase 3 - Testing (QA Swarm)**
Parallel testing:
- [TEST_1]: Unit tests (90%+ coverage)
- [TEST_2]: Integration tests
- [TEST_3]: E2E validation
- [TEST_4]: Performance tuning
- [TEST_5]: Security audit
- [TEST_6]: Code review

**Expected**: 79.92% faster than sequential, 10+ tasks/sec throughput, 100% agent utilization

Replace bracketed placeholders with specifics. Optimal for 15-30 total tasks.

---

**Even Briefer (One-Liner Instruction)**:

"Use 5-agent swarm (npx claude-flow@alpha) with Agent Booster + ReasoningBank to: (1) research [REQUIREMENTS] with goal agents, (2) develop [MODULES] concurrently (6 max tasks), (3) test with QA swarm. Expect 80% faster execution vs sequential."
