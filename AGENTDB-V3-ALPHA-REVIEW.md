# AgentDB v3 (3.0.0-alpha.3) - Deep Review

> **Package:** `agentdb@alpha` (3.0.0-alpha.3)
> **Published:** 2026-02-21
> **Author:** ruv (ruvnet)
> **License:** MIT
> **Repository:** https://github.com/ruvnet/agentic-flow
> **Size:** 4.5 MB (551 files, 136 TypeScript declaration files)
> **Module System:** ESM-only (`"type": "module"`)
> **Node.js:** >= 18.0.0

---

## 1. Executive Summary

AgentDB v3 is a self-learning vector database designed for autonomous AI agents. It differentiates from traditional vector databases (Pinecone, Chroma, Weaviate, pgvector) through:

1. **Self-learning search pipeline** - feedback-driven contrastive training that improves recall by up to 36% over time
2. **Cognitive Container (.rvf)** - single-file storage format with vectors, indexes, learning state, and cryptographic witness chains
3. **6 cognitive memory patterns** - human-inspired learning (reflexion, skill library, causal graphs, etc.)
4. **9 reinforcement learning algorithms** - from Q-Learning to PPO and MCTS
5. **41 MCP tools** - plug-and-play integration with Claude Code, Cursor, and MCP-compatible assistants
6. **Multi-backend auto-selection** - RuVector (Rust+SIMD) > RVF > HNSWLib > sql.js (WASM)

### Key v3-over-v2 Change: Dependency Architecture Overhaul

The single most impactful change in v3 is the **dependency inversion**. In v2, 22 packages (including native Rust bindings like `ruvector`, `@ruvector/gnn`, `@ruvector/graph-node`, `chalk`, `commander`, `inquirer`, etc.) were **hard** dependencies. In v3, only **5 core dependencies** remain hard:

| v3 Hard Dependencies | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` ^1.20.1 | MCP server protocol |
| `@opentelemetry/api` ^1.9.0 | Observability tracing |
| `ajv` ^8.18.0 | JSON Schema validation |
| `jsonwebtoken` ^9.0.2 | JWT authentication |
| `sql.js` ^1.13.0 | WASM SQLite fallback |

All 22 native/optional packages (ruvector, @ruvector/*, hnswlib-node, better-sqlite3, argon2, etc.) are now **optionalDependencies**. This means:
- **Zero native compilation required** for base install
- **No install failures** from missing build tools
- **Graceful degradation** - each capability is lazy-loaded independently
- **Browser-compatible** out of the box via sql.js WASM

---

## 2. Architecture Overview

```
Application Layer
    |
    v
AgentDB Core (core/AgentDB.ts)
    |--- Controllers (18 controllers)
    |       |--- ReflexionMemory     - Episode storage with self-critique
    |       |--- SkillLibrary        - Reusable skill management
    |       |--- CausalMemoryGraph   - p(y|do(x)) causal reasoning
    |       |--- ReasoningBank       - Pattern learning
    |       |--- LearningSystem      - 9 RL algorithms
    |       |--- NightlyLearner      - Automated discovery
    |       |--- ExplainableRecall   - Merkle-proof provenance
    |       |--- CausalRecall        - Causal-aware retrieval
    |       |--- MemoryController    - Unified memory management
    |       |--- AttentionService    - GNN 8-head attention
    |       |--- Self/Cross/MultiHead Attention Controllers
    |       |--- MMRDiversityRanker  - Maximal Marginal Relevance
    |       |--- ContextSynthesizer  - Memory synthesis
    |       |--- MetadataFilter      - MongoDB-style operators
    |       |--- QUICServer/Client   - Real-time sync transport
    |       |--- SyncCoordinator     - Bidirectional replication
    |       |--- EmbeddingService    - Local embedding models
    |       |--- EnhancedEmbeddingService
    |       |--- HNSWIndex / WASMVectorSearch
    |
    |--- Backends (4-tier auto-selection)
    |       |--- RuVector (Rust + SIMD) - 61us latency
    |       |--- RVF Cognitive Container - single-file + COW branching
    |       |     |--- SelfLearningRvfBackend (full pipeline)
    |       |     |--- RvfBackend (base storage)
    |       |     |--- SqlJsRvfBackend (unified mode)
    |       |     |--- NativeAccelerator (15 capability groups)
    |       |     |--- ContrastiveTrainer (InfoNCE + hard negatives)
    |       |     |--- SemanticQueryRouter (intent classification)
    |       |     |--- SonaLearningBackend (trajectory learning)
    |       |     |--- FederatedSessionManager (cross-session LoRA)
    |       |     |--- AgentDBSolver (Thompson Sampling)
    |       |     |--- SolverBandit (general-purpose bandit)
    |       |     |--- AdaptiveIndexTuner (5-tier compression)
    |       |     |--- FilterBuilder (11 operators)
    |       |     |--- SimdFallbacks (pure-JS fallbacks)
    |       |     |--- WasmStoreBridge (browser HNSW)
    |       |--- HNSWLib (C++) - compatibility
    |       |--- sql.js (WASM) - zero-dep fallback
    |
    |--- Services
    |       |--- LLMRouter (5 providers: RuvLLM, OpenRouter, Gemini, Claude, ONNX)
    |       |--- AuthService (JWT + Argon2id)
    |       |--- AuditLogger (SOC2/GDPR/HIPAA)
    |       |--- FederatedLearningCoordinator
    |
    |--- MCP Server (41 tools across 7 categories)
    |--- CLI (60+ commands across 8 categories)
    |--- Browser Bundle (WASM-backed)
    |--- Observability (OpenTelemetry + Prometheus)
```

---

## 3. Public API Surface

### 3.1 Main Exports (62 total from `agentdb`)

**Classes (28):**
- `AgentDB` - Main entry point (unified .rvf mode)
- `CausalMemoryGraph`, `CausalRecall`, `ExplainableRecall`
- `ReflexionMemory`, `SkillLibrary`, `ReasoningBank`
- `NightlyLearner`, `LearningSystem`
- `EmbeddingService`, `EnhancedEmbeddingService`
- `WASMVectorSearch`, `HNSWIndex`
- `AttentionService`, `MemoryController`
- `SelfAttentionController`, `CrossAttentionController`, `MultiHeadAttentionController`
- `BatchOperations`, `QueryOptimizer`, `QueryCache`
- `MMRDiversityRanker`, `ContextSynthesizer`, `MetadataFilter`
- `QUICServer`, `QUICClient`, `SyncCoordinator`
- `MultiDatabaseCoordinator`, `LLMRouter`

**Functions (17):**
- `createDatabase` - SQLite database factory
- `quantize8bit`, `quantize4bit`, `dequantize8bit`, `dequantize4bit`
- `calculateQuantizationError`, `getQuantizationStats`
- `createScalar8BitStore`, `createScalar4BitStore`, `createProductQuantizedStore`
- `createKeywordIndex`, `createHybridSearch`
- `runBenchmarks`, `runSelectedBenchmarks`, `formatReportAsMarkdown`, `formatComparisonAsMarkdown`
- `validateTableName`, `validateColumnName`, `validatePragmaCommand`
- `buildSafeWhereClause`, `buildSafeSetClause`
- `isHnswlibAvailable`, `isRuvLLMInstalled`

**Types (40+):** Episode, Skill, EmbeddingConfig, VectorSearchConfig, HNSWConfig, MMROptions, MetadataFilters, QUICServerConfig, SyncCoordinatorConfig, AttentionConfig, MemoryControllerConfig, LLMConfig, etc.

### 3.2 Sub-path Exports (25 entry points)

| Export Path | Purpose |
|---|---|
| `agentdb` | Main entry (62 exports) |
| `agentdb/backends` | Backend factory + all backend types |
| `agentdb/backends/self-learning` | SelfLearningRvfBackend |
| `agentdb/backends/native-accelerator` | NativeAccelerator (15 caps) |
| `agentdb/security` | Input validation utilities |
| `agentdb/wrappers` | GNN, AgentDBFast, Attention, Embedding |
| `agentdb/wrappers/gnn` | GNN wrapper |
| `agentdb/wrappers/agentdb-fast` | High-perf programmatic API |
| `agentdb/wrappers/attention` | Attention fallbacks |
| `agentdb/wrappers/embedding` | Embedding service |
| `agentdb/controllers/*` | 18 individual controller imports |
| `agentdb/cli` | CLI entry point |
| `agentdb/cli/commands/migrate` | Migration command |
| `agentdb/wasm` | WASM loader |
| `agentdb/db-fallback` | Database fallback |

---

## 4. Core Capabilities Deep Dive

### 4.1 Self-Learning Pipeline (The Differentiator)

The `SelfLearningRvfBackend` is the flagship feature. It wraps the base `RvfBackend` with 6 integrated components:

1. **SemanticQueryRouter** - Classifies query intent via HNSW-indexed embeddings. Selects adaptive ef-search arms (50/100/200/400) based on Thompson Sampling policy. Max 1,000 intents with lazy `@ruvector/router` loading.

2. **SonaLearningBackend** - Context enrichment from trajectory history. Applies base LoRA adapter to query embeddings in sub-millisecond time.

3. **ContrastiveTrainer** - InfoNCE loss with hard negative mining (NV-Retriever-inspired):
   - 3-stage curriculum: negatives per sample (4 -> 8 -> 16), hardness threshold (0.5 -> 0.3 -> 0.1)
   - AdamW optimizer (beta1=0.9, beta2=0.999, decoupled weight decay)
   - Temperature bounded 0.01-1.0 (default 0.07)

4. **FederatedSessionManager** - Cross-session LoRA merging with quality-filtered aggregation (min quality 0.7, max 100 agents, ~5MB per agent).

5. **AgentDBSolver** - Three-loop adaptive solver:
   - Fast loop: constraint propagation (~0.1ms)
   - Medium loop: PolicyKernel with Thompson Sampling (~1ms)
   - Slow loop: KnowledgeCompiler for long-term patterns (~10ms)
   - 18 context buckets (3 range x 3 distractor x 2 noise)
   - A/B/C ablation acceptance testing

6. **TemporalCompressor + IndexHealthMonitor** - 5-tier auto-tiering (hot/warm/cool/cold/archive) and latency tracking.

**Learning Tick Cycle:**
1. Flush SONA trajectory context
2. Train contrastive batch (32 samples from feedback)
3. Train solver (50 puzzles for Thompson Sampling)
4. Decay access frequencies (0.99x per tick, prune below 0.001 every 50 ticks)
5. Update temporal compressor tiers
6. Assess health via latency monitor
7. Consolidate federated state
8. Run acceptance check (every 100 ticks)

### 4.2 Cognitive Container (.rvf Format)

Single-file storage with:
- **Append-only log** with checksums for crash safety
- **COW Branching** via `derive()` - instant copy-on-write for experiments
- **Lineage tracking** - `fileId()`, `parentId()`, `lineageDepth()`
- **Progressive HNSW indexing** - 3-layer quality tiers
- **SHAKE-256 witness chains** - 73 bytes per entry, tamper-evident audit
- **11 filter operators** - eq, ne, lt, le, gt, ge, in, range, and, or, not
- **Segment introspection** - id, type, payload length per segment
- **Kernel/eBPF embedding** - embed unikernel images and eBPF bytecode
- **Auto-compaction** with dead space reclamation
- **Readonly mode** for concurrent readers
- **Hardware profiles** (Generic/Core/Hot/Full)
- **Compression profiles** (none/scalar/product)

### 4.3 NativeAccelerator (15 Capability Groups)

Lazy-loads 11 `@ruvector` packages with pure-JS fallbacks for every operation:

| Group | Operations | Fallback |
|---|---|---|
| Vector Math | cosine, dot, L2, hamming, add, mul, scale, normalize | 4-wide unrolled loops |
| Activations | softmax, relu, gelu, sigmoid, layerNorm | Pure JS |
| Loss Functions | InfoNCE (contrastive) | JS implementation |
| Optimizers | AdamW step | JS implementation |
| Quantization | scalar 8/4-bit, product quantization | JS implementation |
| WASM Store | create, ingest, query, export, close | sql.js fallback |
| Verification | witness chain, segment header | Structural check |
| Graph Tx | begin, commit, rollback | N/A |
| Graph Batch | high-throughput node/edge ingestion | N/A |
| Graph Cypher | pattern matching, path queries | N/A |
| Core Batch | native vector batch ingestion | Sequential JS |
| EWC Memory | penalty, Fisher update | JS implementation |
| Router | save/load state persistence | JSON fallback |
| SONA | context, flush, base LoRA | JS implementation |
| Compression | tensor compress/decompress | N/A |

### 4.4 Cognitive Memory Patterns (6)

1. **ReasoningBank** - Store/retrieve reasoning patterns by semantic similarity and task type
2. **ReflexionMemory** - Episode storage with self-generated critiques (Shinn et al., 2023)
3. **SkillLibrary** - Reusable skills with success rate tracking and composability
4. **CausalMemoryGraph** - `p(y|do(x))` doubly robust estimation, optional Poincare embeddings
5. **ExplainableRecall** - Merkle-proof provenance certificates for every retrieval
6. **NightlyLearner** - Background discovery of causal patterns, skill consolidation, data pruning

### 4.5 Reinforcement Learning (9 Algorithms)

| Algorithm | Type | Implementation |
|---|---|---|
| Q-Learning | Value-based | Tabular Q-table |
| SARSA | Value-based | On-policy updates |
| DQN | Value-based | Neural function approximation |
| Policy Gradient | Policy-based | REINFORCE |
| Actor-Critic | Hybrid | Advantage estimation |
| PPO | Policy-based | Clipped objectives |
| Decision Transformer | Sequence-based | Offline RL from trajectories |
| MCTS | Planning | Look-ahead tree search |
| Model-Based RL | Model-based | World model + planning |

All managed via `LearningSystem` with session creation, prediction, reward recording, training, and cross-task transfer learning.

### 4.6 Graph Intelligence

- **Cypher queries** - Full Neo4j-compatible syntax (MATCH, WHERE, RETURN, ORDER BY, LIMIT)
- **Graph traversal** - Direction control, depth limits, label filtering
- **Hybrid vector+graph search** - Semantic similarity within graph structure
- **ACID batch inserts** - Transactional with rollback support
- **GNN 8-head attention** - GAT, GCN, GraphSAGE variants (+12.4% recall, 3.8ms forward)
- **Causal reasoning** - Doubly robust estimation with optional hyperbolic (Poincare) embeddings

### 4.7 Hybrid Search

BM25 keyword + vector similarity with 3 fusion strategies:
- **RRF** (default) - `1/(k + rank)`, no score calibration needed
- **Linear** - `alpha * keyword + beta * vector`
- **Max** - `max(keyword, vector)`

### 4.8 MCP Integration (41 Tools)

| Category | Tools | Count |
|---|---|---|
| Core DB | init, insert, batch insert, search, delete, stats | 6 |
| Patterns | store, search, batch store, statistics | 4 |
| Memory | reflexion, skill, causal operations | 9 |
| Learning | RL sessions, predictions, feedback, training, transfer | 10 |
| Recall | explainable recall, cache management | 2 |
| Solver | train, acceptance, policy, witness chain | 4 |
| Admin | diagnostics, migration, pruning, recording | 6 |

### 4.9 LLM Router (5 Providers)

Auto-selects optimal provider based on cost, quality, speed, and privacy constraints:

| Provider | Type | Cost |
|---|---|---|
| RuvLLM | Local, SIMD-optimized | Free |
| ONNX | Local, transformers.js | Free |
| OpenRouter | Cloud, 200+ models | $0.0001+ |
| Gemini | Cloud | Free tier |
| Anthropic | Cloud | $0.003+ |

### 4.10 Multi-Database Coordination & Sync

- **MultiDatabaseCoordinator** - Distributed sync with 3 conflict strategies (last-write-wins, merge, manual)
- **QUICServer/Client** - Multiplexed streams, 0-RTT resumption, rate limiting
- **SyncCoordinator** - 5-phase bidirectional sync (detecting -> pushing -> pulling -> resolving -> applying)
- 4 conflict strategies: local-wins, remote-wins, latest-wins, merge

### 4.11 Browser/WASM Support

- **WasmStoreBridge** - Full HNSW vector DB in browser via `@ruvector/rvf-wasm`
- **AttentionBrowser** - Flash Attention (O(N) memory), Hyperbolic Attention, Memory Consolidation
- **Product Quantization** - PQ8/PQ16/PQ32 for in-browser compression
- **6 configuration presets** - SMALL_DATASET through QUALITY_OPTIMIZED
- **sql.js** WASM fallback for zero-dependency environments

### 4.12 Security

- **Input validation** - NaN/Infinity injection prevention, path traversal prevention
- **Metadata sanitization** - Strips password, token, key, apiKey, auth fields
- **Cypher injection prevention** - Parameter validation and sanitization
- **XSS pattern detection** - Task string validation
- **Bounded limits** - Max 10M vectors, 4096 dimensions, 10K batch, 64KB metadata
- **Witness chains** - SHAKE-256 tamper-evident audit trails
- **Auth** - JWT tokens, Argon2id hashing, API key rotation
- **Compliance** - SOC2/GDPR/HIPAA-ready audit logging

### 4.13 Observability

- **OpenTelemetry** - Automatic span creation for search, insert, sync
- **Prometheus metrics** - search_duration_ms, insert_duration_ms, cache_hit_ratio, learning_loss, vector_count
- **Performance tracking** - Per-operation timing (insert, search, flush, compaction)

---

## 5. CLI Reference (60+ Commands)

| Category | Commands |
|---|---|
| **Core** | `init`, `status`, `doctor [--fix] [--verbose]` |
| **RVF** | `rvf status`, `rvf compact`, `rvf derive`, `rvf segments`, `rvf detect` |
| **Learning** | `learn --session <id> --train`, `learn --status` |
| **Routing** | `route --query`, `route --list` |
| **Attention** | `attention --benchmark`, `hyperbolic --test` |
| **Simulation** | `simulate hnsw/attention/self-organizing`, `--wizard`, `--custom`, `--report` |
| **Migration** | `migrate --source --target`, `--to v3`, `--to rvf`, `--dry-run` |
| **MCP** | `mcp start [--port]` |

---

## 6. Benchmark Claims

| Metric | Claimed Value | Context |
|---|---|---|
| Search latency | 61us p50 | RuVector (Rust+SIMD) backend |
| Recall@10 | 96.8% | RuVector backend |
| Learning improvement | +36% recall | Over 500 feedback cycles (54% -> 90%) |
| GNN attention | +12.4% recall | 3.8ms forward pass, 91% transfer |
| Pattern search | 32.6M ops/sec | In-memory |
| Pattern storage | 388K ops/sec | ~2.5us per op |
| Batch insert | 5,556-7,692 ops/sec | 3-4x faster than sequential |
| Self-healing | 97.9% degradation prevention | <100ms repair |
| Simulation reproducibility | 98.2% | 31 scenarios |

---

## 7. Critical Assessment

### Strengths

1. **Dependency architecture** - v3's move to optional dependencies eliminates the #1 install friction. Base install requires zero native compilation.

2. **API design** - Clean TypeScript interfaces with `VectorBackend` / `VectorBackendAsync` abstraction. Sub-path exports allow tree-shaking.

3. **Unified .rvf mode** - Single-file storage is genuinely useful for portable AI agent state. COW branching enables safe experimentation.

4. **Graceful degradation** - 4-tier backend auto-selection with pure-JS fallbacks means it works everywhere, even without native bindings.

5. **MCP integration** - 41 tools that plug directly into Claude Code and MCP-compatible assistants is a real differentiator for the agent ecosystem.

6. **Self-learning pipeline** - The contrastive training + LoRA adaptation + EWC consolidation architecture is academically grounded (InfoNCE, EWC++, NV-Retriever).

7. **Comprehensive type definitions** - 136 `.d.ts` files with full JSDoc. Good DX for TypeScript users.

8. **Security posture** - Input validation, bounded limits, witness chains, and sanitization are baked in, not afterthoughts.

### Concerns

1. **Performance claims require qualification** - 61us latency and 150x/800x comparisons assume the optional RuVector Rust+SIMD bindings are installed. Without them, the sql.js fallback is ~5ms (which is still reasonable but 80x slower than claimed headline number).

2. **Optional dependency sprawl** - 22 optional dependencies across 11 `@ruvector` packages means the "full" experience requires significant native toolchain setup. The package works without them, but many headline features (Cypher queries, SIMD acceleration, Graph DB, etc.) require specific optional installs.

3. **v3 is extremely new** - Published 2026-02-21 (yesterday). Only 4 releases in the 3.0.0-alpha series so far. The `latest` dist-tag still points to 2.0.0-alpha.3.3 (Jan 2, 2026), suggesting v3 is early-stage.

4. **ESM-only** - The package uses `"type": "module"` with top-level await, which means `require()` is impossible. CJS consumers must use dynamic `import()`.

5. **Ecosystem maturity** - The `@ruvector` package family (11+ packages) appears to be maintained by the same author. Bus factor and long-term maintenance are considerations.

6. **Scope breadth** - The package attempts to be a vector DB, graph DB, RL framework, auth system, MCP server, LLM router, audit logger, and QUIC transport layer simultaneously. This breadth may create maintenance pressure.

7. **Kernel/eBPF embedding** - The ability to embed unikernel images and eBPF bytecode into .rvf files is an unusual feature that could raise security review flags in enterprise environments.

### Recommendations

1. **For prototyping and development**: Install `agentdb@alpha` directly. The sql.js WASM fallback provides a complete experience without native dependencies.

2. **For production with performance needs**: Install specific `@ruvector` optional packages based on your requirements (e.g., `@ruvector/rvf-node` for N-API performance, `ruvector` for SIMD vectors).

3. **For MCP integration**: The 41-tool MCP server is production-ready and can be started with `npx agentdb mcp start`.

4. **For browser deployment**: The WASM bundle with sql.js, AttentionBrowser, and ProductQuantization provides a capable offline vector DB.

---

## 8. Version Timeline

| Version | Date | Milestone |
|---|---|---|
| 1.0.0 | 2025-10-18 | Initial release |
| 1.6.1 | 2025-10-25 | Last stable v1 |
| 2.0.0-alpha.1 | 2025-11-30 | v2 alpha start |
| 2.0.0-alpha.3.3 | 2026-01-02 | Current `latest` tag |
| 2.0.0-alpha.3.7 | 2026-02-13 | Last v2 alpha |
| 3.0.0-alpha.0 | 2026-02-21 | v3 alpha start |
| **3.0.0-alpha.3** | **2026-02-21** | **Current `alpha` tag** |

---

## 9. Quick Start (Verified)

```bash
# Install (zero native deps required)
npm install agentdb@alpha

# Verify
npx agentdb doctor
npx agentdb rvf detect
```

```typescript
import { AgentDB } from 'agentdb';

const db = new AgentDB({ dbPath: './knowledge.rvf' });
await db.initialize();

const reflexion = db.getController('reflexion');
const skills = db.getController('skills');
const causal = db.getController('causal');

// Store an episode
await reflexion.storeEpisode({
  sessionId: 'session-1',
  task: 'Fix auth bug',
  reward: 0.95,
  success: true,
  critique: 'OAuth2 PKCE was the right approach',
});

await db.save();
await db.close();
```

---

*Review conducted on 2026-02-22. Package version: agentdb@3.0.0-alpha.3.*
