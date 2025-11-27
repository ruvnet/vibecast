# ruvector Technical Specification

> **Version:** 1.0.0
> **Status:** Draft
> **Based on:** [MAKER: Solving a Million-Step LLM Task with Zero Errors](https://arxiv.org/abs/2511.09030)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [CLI Interface](#3-cli-interface)
4. [Core Components](#4-core-components)
5. [Pruning System](#5-pruning-system)
6. [Voting Mechanism](#6-voting-mechanism)
7. [Paper Processing Pipeline](#7-paper-processing-pipeline)
8. [Configuration](#8-configuration)
9. [Output Formats](#9-output-formats)
10. [Error Handling](#10-error-handling)
11. [API Reference](#11-api-reference)
12. [Dependencies](#12-dependencies)

---

## 1. Overview

### 1.1 Purpose

ruvector is a CLI tool that processes research papers using multi-agent AI with consensus-based error correction. It extracts, analyzes, and implements concepts from academic papers with high reliability.

### 1.2 Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Decomposition** | Break tasks into minimal subtasks handled by specialized microagents |
| **Redundancy** | Run multiple agents per task for fault tolerance |
| **Consensus** | Use voting to eliminate errors before they propagate |
| **Pruning** | Filter malformed, outlier, and low-quality outputs |

### 1.3 Key Features

- Fetch and parse arXiv papers (PDF/HTML)
- Multi-agent extraction with voting consensus
- Three-layer pruning system (format, consensus, quality)
- Code generation from paper algorithms
- Configurable voting strategies (first-to-ahead-by-K)
- Cost-optimized model selection

---

## 2. Architecture

### 2.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ruvector                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   CLI   │───▶│   Router    │───▶│  Pipeline   │───▶│   Output    │  │
│  │ Parser  │    │             │    │  Executor   │    │  Formatter  │  │
│  └─────────┘    └─────────────┘    └──────┬──────┘    └─────────────┘  │
│                                           │                             │
│                       ┌───────────────────┼───────────────────┐         │
│                       ▼                   ▼                   ▼         │
│                 ┌──────────┐        ┌──────────┐        ┌──────────┐   │
│                 │  Agent   │        │  Agent   │        │  Agent   │   │
│                 │  Pool    │        │  Pool    │        │  Pool    │   │
│                 │    1     │        │    2     │        │    N     │   │
│                 └────┬─────┘        └────┬─────┘        └────┬─────┘   │
│                      │                   │                   │         │
│                      └───────────────────┼───────────────────┘         │
│                                          ▼                             │
│                                   ┌─────────────┐                      │
│                                   │   Pruning   │                      │
│                                   │   Engine    │                      │
│                                   └──────┬──────┘                      │
│                                          ▼                             │
│                                   ┌─────────────┐                      │
│                                   │   Voting    │                      │
│                                   │   System    │                      │
│                                   └─────────────┘                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Directory Structure

```
ruvector/
├── bin/
│   └── ruvector.js              # CLI entry point
├── src/
│   ├── cli/
│   │   ├── index.ts             # CLI setup (commander)
│   │   ├── commands/
│   │   │   ├── analyze.ts       # analyze command
│   │   │   ├── extract.ts       # extract command
│   │   │   ├── implement.ts     # implement command
│   │   │   ├── summarize.ts     # summarize command
│   │   │   └── compare.ts       # compare command
│   │   └── options.ts           # shared CLI options
│   ├── core/
│   │   ├── pipeline.ts          # execution pipeline
│   │   ├── router.ts            # command routing
│   │   └── config.ts            # configuration loader
│   ├── agents/
│   │   ├── pool.ts              # agent pool manager
│   │   ├── microagent.ts        # base microagent class
│   │   ├── types/
│   │   │   ├── parser.ts        # PDF/content parser agent
│   │   │   ├── extractor.ts     # concept extraction agent
│   │   │   ├── analyzer.ts      # deep analysis agent
│   │   │   ├── implementer.ts   # code generation agent
│   │   │   └── validator.ts     # output validation agent
│   │   └── prompts/
│   │       └── *.txt            # agent system prompts
│   ├── pruning/
│   │   ├── index.ts             # pruning engine
│   │   ├── format.ts            # Layer 1: format pruning
│   │   ├── consensus.ts         # Layer 2: consensus pruning
│   │   └── quality.ts           # Layer 3: quality pruning
│   ├── voting/
│   │   ├── index.ts             # voting system
│   │   ├── strategies/
│   │   │   ├── majority.ts      # simple majority
│   │   │   ├── first-to-k.ts    # first-to-ahead-by-K
│   │   │   └── weighted.ts      # confidence-weighted
│   │   └── similarity.ts        # response similarity calc
│   ├── processors/
│   │   ├── arxiv.ts             # arXiv fetcher
│   │   ├── pdf.ts               # PDF parser
│   │   └── html.ts              # HTML parser
│   ├── output/
│   │   ├── formatter.ts         # output formatting
│   │   ├── formats/
│   │   │   ├── json.ts
│   │   │   ├── markdown.ts
│   │   │   └── yaml.ts
│   │   └── templates/
│   │       └── *.hbs            # output templates
│   ├── utils/
│   │   ├── logger.ts            # logging utility
│   │   ├── cache.ts             # response caching
│   │   └── cost.ts              # cost tracking
│   └── index.ts                 # main export
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── package.json
├── tsconfig.json
└── .ruvectorrc.yaml             # default config
```

### 2.3 Data Flow

```
1. INPUT
   User provides: URL, PDF path, or arXiv ID

2. FETCH
   Download and convert to processable format

3. CHUNK
   Split content into processable segments

4. SPAWN
   Create N agents per task (default: 3)

5. EXECUTE
   Each agent processes independently

6. PRUNE (Layer 1)
   Remove malformed/timeout responses

7. PRUNE (Layer 2)
   Remove outlier responses via clustering

8. VOTE
   Reach consensus using selected strategy

9. PRUNE (Layer 3)
   Filter low-quality content from result

10. FORMAT
    Output in requested format
```

---

## 3. CLI Interface

### 3.1 Installation

```bash
# Run directly (no install)
npx ruvector <command> [options]

# Global install
npm install -g ruvector
ruvector <command> [options]

# Local install
npm install ruvector
npx ruvector <command> [options]
```

### 3.2 Commands

#### `analyze`

Full paper analysis with all extractable components.

```bash
ruvector analyze <source> [options]

Arguments:
  source                    arXiv URL, PDF URL, local path, or arXiv ID

Options:
  -o, --output <dir>        Output directory (default: "./ruvector-out")
  -f, --format <type>       Output format: json|md|yaml (default: "md")
  -d, --depth <level>       Analysis depth: quick|standard|deep (default: "standard")
  -v, --voters <n>          Number of voting agents (default: 3)
  --show-pruning            Display pruning decisions
  --no-cache                Disable response caching

Examples:
  ruvector analyze https://arxiv.org/pdf/2511.09030
  ruvector analyze 2511.09030 --depth deep
  ruvector analyze ./paper.pdf -f json -o ./results
```

#### `extract`

Extract specific components from a paper.

```bash
ruvector extract <source> [options]

Options:
  --only <types>            Comma-separated: algorithms,methods,results,equations,figures,tables,references
  --section <n>             Extract from specific section number
  -f, --format <type>       Output format (default: "json")

Examples:
  ruvector extract 2511.09030 --only algorithms,methods
  ruvector extract paper.pdf --section 3 --only equations
```

#### `implement`

Generate code implementation from paper.

```bash
ruvector implement <source> [options]

Options:
  -l, --lang <language>     Target language: typescript|python|go|rust (default: "typescript")
  --component <name>        Specific component to implement
  --section <n>             Implement from specific section
  --tests                   Generate test cases
  --comments                Add explanatory comments

Examples:
  ruvector implement 2511.09030 --lang python
  ruvector implement 2511.09030 --component voting-consensus --tests
```

#### `summarize`

Quick summary of paper contents.

```bash
ruvector summarize <source> [options]

Options:
  -f, --format <type>       Output: bullets|paragraph|tldr (default: "bullets")
  --length <size>           Length: short|medium|long (default: "medium")

Examples:
  ruvector summarize 2511.09030 --format tldr
  ruvector summarize paper.pdf --length long
```

#### `compare`

Compare two or more papers.

```bash
ruvector compare <source1> <source2> [...sources] [options]

Options:
  --aspects <list>          Compare: methods,results,novelty,limitations
  -f, --format <type>       Output format (default: "md")

Examples:
  ruvector compare 2511.09030 2405.12345 --aspects methods,results
```

### 3.3 Global Options

```bash
Options available for all commands:

  -c, --config <path>       Path to config file (default: ".ruvectorrc.yaml")
  --model <name>            LLM model to use (default: "gpt-4.1-mini")
  --api-key <key>           API key (or set RUVECTOR_API_KEY env var)
  --verbose                 Verbose output
  --quiet                   Suppress non-essential output
  --dry-run                 Show what would be done without executing
  --cost-limit <usd>        Maximum cost in USD (default: no limit)
  -h, --help                Display help
  -V, --version             Display version
```

---

## 4. Core Components

### 4.1 Microagent

Base unit of work execution.

```typescript
interface MicroagentConfig {
  id: string;
  type: AgentType;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

interface MicroagentResponse {
  id: string;
  agentId: string;
  content: unknown;
  tokens: number;
  latency: number;
  cost: number;
  metadata: {
    model: string;
    timestamp: number;
    confidence?: number;
  };
}

type AgentType =
  | 'parser'      // Content parsing
  | 'extractor'   // Concept extraction
  | 'analyzer'    // Deep analysis
  | 'implementer' // Code generation
  | 'validator';  // Output validation
```

### 4.2 Agent Pool

Manages agent lifecycle and execution.

```typescript
interface AgentPoolConfig {
  size: number;              // Agents per task (default: 3)
  maxConcurrent: number;     // Max parallel executions
  timeout: number;           // Per-agent timeout (ms)
  retries: number;           // Retry count on failure
  modelSelection: 'fixed' | 'diverse' | 'adaptive';
}

class AgentPool {
  constructor(config: AgentPoolConfig);

  // Spawn agents for a task
  spawn(task: Task, count?: number): Promise<Microagent[]>;

  // Execute task across all agents
  execute(task: Task): Promise<MicroagentResponse[]>;

  // Get pool statistics
  stats(): PoolStats;
}
```

### 4.3 Pipeline

Orchestrates the full processing flow.

```typescript
interface PipelineConfig {
  stages: PipelineStage[];
  pruning: PruningConfig;
  voting: VotingConfig;
  output: OutputConfig;
}

interface PipelineStage {
  name: string;
  agentType: AgentType;
  input: string;           // Reference to previous stage output
  poolSize: number;
  required: boolean;
}

class Pipeline {
  constructor(config: PipelineConfig);

  // Execute full pipeline
  run(input: PipelineInput): Promise<PipelineOutput>;

  // Execute single stage
  runStage(stage: PipelineStage, input: unknown): Promise<StageOutput>;

  // Get execution trace
  trace(): ExecutionTrace;
}
```

---

## 5. Pruning System

### 5.1 Overview

Three-layer filtering system that removes invalid, outlier, and low-quality responses.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Pruning Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Responses    Layer 1         Layer 2          Layer 3         │
│   ┌───┐       ┌───────┐       ┌───────┐       ┌───────┐        │
│   │ 5 │  ───▶ │Format │  ───▶ │Consens│  ───▶ │Quality│  ───▶  │
│   └───┘       │Prune  │       │Prune  │       │Prune  │        │
│               └───┬───┘       └───┬───┘       └───┬───┘        │
│                   │               │               │             │
│               ┌───▼───┐       ┌───▼───┐       ┌───▼───┐        │
│               │   3   │       │   2   │       │   1   │        │
│               │remain │       │remain │       │output │        │
│               └───────┘       └───────┘       └───────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Layer 1: Format Pruning

Filters responses based on structural validity.

```typescript
interface FormatPruningConfig {
  maxTokens: number;              // Max response length (default: 2x expected)
  minTokens: number;              // Min response length (default: 0.1x expected)
  timeout: number;                // Max response time (ms)
  requiredFields?: string[];      // Fields that must exist in response
  schema?: JSONSchema;            // JSON schema for validation
}

interface FormatPruningResult {
  passed: MicroagentResponse[];
  pruned: Array<{
    response: MicroagentResponse;
    reason: 'too_long' | 'too_short' | 'timeout' | 'malformed' | 'missing_fields';
  }>;
}

function formatPrune(
  responses: MicroagentResponse[],
  config: FormatPruningConfig
): FormatPruningResult;
```

**Pruning Criteria:**

| Criterion | Condition | Rationale |
|-----------|-----------|-----------|
| Too Long | `tokens > expected * 2` | Runaway generation, likely off-topic |
| Too Short | `tokens < expected * 0.1` | Failed generation, empty response |
| Timeout | `latency > maxTime` | Hung request, unreliable |
| Malformed | `!valid(schema)` | Cannot be processed downstream |
| Missing Fields | `!hasAll(required)` | Incomplete response |

### 5.3 Layer 2: Consensus Pruning

Filters responses that deviate from majority consensus.

```typescript
interface ConsensusPruningConfig {
  similarityThreshold: number;    // Min similarity to cluster (default: 0.75)
  minClusterSize: number;         // Min responses to form consensus (default: 2)
  similarityMetric: 'cosine' | 'jaccard' | 'levenshtein' | 'semantic';
  embeddingModel?: string;        // Model for semantic similarity
}

interface ConsensusPruningResult {
  passed: MicroagentResponse[];
  pruned: Array<{
    response: MicroagentResponse;
    reason: 'outlier';
    similarity: number;           // Max similarity to any cluster
  }>;
  clusters: ResponseCluster[];
}

interface ResponseCluster {
  centroid: MicroagentResponse;
  members: MicroagentResponse[];
  cohesion: number;               // Average intra-cluster similarity
}

function consensusPrune(
  responses: MicroagentResponse[],
  config: ConsensusPruningConfig
): ConsensusPruningResult;
```

**Algorithm:**

```
1. Compute pairwise similarity matrix
2. Build similarity graph (edges where sim > threshold)
3. Find connected components (clusters)
4. Select largest cluster as consensus
5. Prune responses not in consensus cluster
6. If no cluster meets minSize, keep all (fall back to voting)
```

### 5.4 Layer 3: Quality Pruning

Filters low-value content from the merged result.

```typescript
interface QualityPruningConfig {
  minConfidence: number;          // Min extraction confidence (default: 0.8)
  removeRedundancy: boolean;      // Dedupe similar statements (default: true)
  redundancyThreshold: number;    // Similarity for redundancy (default: 0.9)
  requireEvidence: boolean;       // Must cite paper section (default: false)
  dropPatterns: string[];         // Regex patterns to filter out
}

interface QualityPruningResult {
  content: unknown;               // Pruned content
  removed: Array<{
    item: unknown;
    reason: 'low_confidence' | 'redundant' | 'no_evidence' | 'pattern_match';
  }>;
  stats: {
    inputItems: number;
    outputItems: number;
    reductionPercent: number;
  };
}

function qualityPrune(
  content: unknown,
  config: QualityPruningConfig
): QualityPruningResult;
```

**Default Drop Patterns:**

```typescript
const DEFAULT_DROP_PATTERNS = [
  /^I cannot/i,
  /^I'm not (able|sure)/i,
  /^(This|It) (appears|seems) (to|that)/i,
  /^(As an AI|As a language model)/i,
  /^I don't have (access|information)/i,
  /^(Unfortunately|I apologize)/i,
];
```

### 5.5 Pruning Strategies

Pre-configured pruning profiles.

```typescript
type PruningStrategy = 'aggressive' | 'balanced' | 'conservative' | 'none';

const PRUNING_STRATEGIES: Record<PruningStrategy, PruningConfig> = {
  aggressive: {
    format: { maxTokens: 1.5, minTokens: 0.2 },
    consensus: { similarityThreshold: 0.8, minClusterSize: 2 },
    quality: { minConfidence: 0.85, removeRedundancy: true },
  },
  balanced: {
    format: { maxTokens: 2.0, minTokens: 0.1 },
    consensus: { similarityThreshold: 0.7, minClusterSize: 2 },
    quality: { minConfidence: 0.7, removeRedundancy: true },
  },
  conservative: {
    format: { maxTokens: 3.0, minTokens: 0.05 },
    consensus: { similarityThreshold: 0.5, minClusterSize: 1 },
    quality: { minConfidence: 0.5, removeRedundancy: false },
  },
  none: {
    format: { enabled: false },
    consensus: { enabled: false },
    quality: { enabled: false },
  },
};
```

---

## 6. Voting Mechanism

### 6.1 Overview

Consensus mechanism to select the best response from multiple agents.

### 6.2 Voting Strategies

#### Majority Voting

Simple majority wins.

```typescript
interface MajorityVotingConfig {
  tieBreaker: 'first' | 'random' | 'highest_confidence';
}

function majorityVote(
  responses: MicroagentResponse[],
  config: MajorityVotingConfig
): MicroagentResponse;
```

#### First-to-Ahead-by-K (MAKER Style)

Response wins when it leads by K votes.

```typescript
interface FirstToKConfig {
  k: number;                      // Lead required to win (default: 3)
  maxRounds: number;              // Max voting rounds (default: 10)
  spawnOnTie: boolean;            // Spawn more agents on tie (default: true)
}

function firstToAheadByK(
  responses: MicroagentResponse[],
  config: FirstToKConfig,
  spawnAgent: () => Promise<MicroagentResponse>
): Promise<MicroagentResponse>;
```

**Algorithm:**

```
1. Initialize vote counts for each unique response
2. For each response, increment its cluster's count
3. Check if any cluster leads by K votes
4. If yes: return cluster centroid as winner
5. If no and rounds < max: spawn new agent, goto 2
6. If max rounds: return largest cluster centroid
```

#### Weighted Voting

Votes weighted by confidence scores.

```typescript
interface WeightedVotingConfig {
  weights: {
    confidence: number;           // Weight for confidence score
    latency: number;              // Weight for response speed (inverse)
    tokenEfficiency: number;      // Weight for conciseness
  };
  normalize: boolean;
}

function weightedVote(
  responses: MicroagentResponse[],
  config: WeightedVotingConfig
): MicroagentResponse;
```

### 6.3 Similarity Calculation

```typescript
interface SimilarityConfig {
  metric: 'cosine' | 'jaccard' | 'levenshtein' | 'semantic';
  embeddingModel?: string;
  cache: boolean;
}

// For structured responses
function structuredSimilarity(a: object, b: object): number;

// For text responses
function textSimilarity(a: string, b: string, metric: string): number;

// For semantic comparison
async function semanticSimilarity(
  a: string,
  b: string,
  model: string
): Promise<number>;
```

---

## 7. Paper Processing Pipeline

### 7.1 Source Resolution

```typescript
type PaperSource =
  | { type: 'arxiv_url'; url: string }
  | { type: 'arxiv_id'; id: string }
  | { type: 'pdf_url'; url: string }
  | { type: 'local_pdf'; path: string }
  | { type: 'html_url'; url: string };

function resolveSource(input: string): PaperSource;

// Examples:
// "https://arxiv.org/pdf/2511.09030" → { type: 'arxiv_url', url: '...' }
// "2511.09030" → { type: 'arxiv_id', id: '2511.09030' }
// "./paper.pdf" → { type: 'local_pdf', path: './paper.pdf' }
```

### 7.2 Content Fetching

```typescript
interface FetchResult {
  content: string;                // Raw content
  format: 'pdf' | 'html' | 'text';
  metadata: PaperMetadata;
  source: PaperSource;
}

interface PaperMetadata {
  title?: string;
  authors?: string[];
  abstract?: string;
  date?: string;
  arxivId?: string;
  doi?: string;
  categories?: string[];
}

async function fetchPaper(source: PaperSource): Promise<FetchResult>;
```

### 7.3 Content Parsing

```typescript
interface ParsedPaper {
  metadata: PaperMetadata;
  sections: PaperSection[];
  figures: Figure[];
  tables: Table[];
  equations: Equation[];
  references: Reference[];
  rawText: string;
}

interface PaperSection {
  number: string;                 // "3.2"
  title: string;
  content: string;
  level: number;                  // 1 = top level
  subsections: PaperSection[];
}

async function parsePaper(content: FetchResult): Promise<ParsedPaper>;
```

### 7.4 Analysis Pipeline

```typescript
interface AnalysisPipeline {
  stages: [
    { name: 'parse', agent: 'parser', output: 'parsed' },
    { name: 'extract_methods', agent: 'extractor', input: 'parsed.sections', output: 'methods' },
    { name: 'extract_results', agent: 'extractor', input: 'parsed.sections', output: 'results' },
    { name: 'extract_algorithms', agent: 'extractor', input: 'parsed.sections', output: 'algorithms' },
    { name: 'analyze_novelty', agent: 'analyzer', input: 'methods', output: 'novelty' },
    { name: 'analyze_limitations', agent: 'analyzer', input: 'parsed', output: 'limitations' },
    { name: 'synthesize', agent: 'analyzer', input: '*', output: 'synthesis' },
  ];
}
```

### 7.5 Output Structure

```typescript
interface AnalysisOutput {
  metadata: PaperMetadata;
  summary: {
    tldr: string;
    bullets: string[];
    paragraph: string;
  };
  problem: {
    statement: string;
    motivation: string;
    priorLimitations: string[];
  };
  solution: {
    approach: string;
    components: SolutionComponent[];
    novelty: string[];
  };
  methods: {
    description: string;
    algorithms: Algorithm[];
    equations: Equation[];
  };
  results: {
    summary: string;
    metrics: Metric[];
    comparisons: Comparison[];
    findings: string[];
  };
  limitations: string[];
  futureWork: string[];
  implementation: {
    feasibility: 'low' | 'medium' | 'high';
    components: ImplementableComponent[];
    dependencies: string[];
  };
  references: {
    key: Reference[];
    related: Reference[];
  };
}
```

---

## 8. Configuration

### 8.1 Configuration File

`.ruvectorrc.yaml` (also supports `.json`, `.js`)

```yaml
# Model Configuration
model:
  default: "gpt-4.1-mini"           # Default model
  fallback: "gpt-3.5-turbo"         # Fallback on failure
  diverse: true                      # Use different models per agent

# Agent Pool Configuration
agents:
  poolSize: 3                        # Agents per task
  maxConcurrent: 10                  # Max parallel agents
  timeout: 30000                     # Agent timeout (ms)
  retries: 2                         # Retries on failure

# Pruning Configuration
pruning:
  strategy: "balanced"               # aggressive|balanced|conservative|none
  format:
    maxTokensMultiplier: 2.0
    minTokensMultiplier: 0.1
    timeout: 30000
    requiredFields: []
  consensus:
    similarityThreshold: 0.75
    minClusterSize: 2
    metric: "semantic"
  quality:
    minConfidence: 0.7
    removeRedundancy: true
    redundancyThreshold: 0.9
    requireEvidence: false
    dropPatterns:
      - "^I cannot"
      - "^I'm not sure"
      - "^As an AI"

# Voting Configuration
voting:
  strategy: "first-to-k"             # majority|first-to-k|weighted
  k: 3                               # For first-to-k
  maxRounds: 10
  spawnOnTie: true

# Output Configuration
output:
  format: "markdown"                 # json|markdown|yaml
  directory: "./ruvector-out"
  includeTrace: false                # Include execution trace
  includeCosts: true                 # Include cost breakdown

# Cache Configuration
cache:
  enabled: true
  ttl: 3600                          # Cache TTL (seconds)
  directory: ".ruvector-cache"

# Cost Limits
costs:
  maxPerRun: null                    # Max cost per run (USD)
  maxPerDay: null                    # Max daily cost (USD)
  trackUsage: true                   # Track and display usage
```

### 8.2 Environment Variables

```bash
RUVECTOR_API_KEY          # OpenAI/Anthropic API key
RUVECTOR_MODEL            # Override default model
RUVECTOR_CONFIG           # Path to config file
RUVECTOR_CACHE_DIR        # Cache directory
RUVECTOR_OUTPUT_DIR       # Default output directory
RUVECTOR_LOG_LEVEL        # Logging level (debug|info|warn|error)
RUVECTOR_MAX_COST         # Maximum cost per run
```

### 8.3 Command-Line Override

All config options can be overridden via CLI:

```bash
ruvector analyze paper.pdf \
  --model gpt-4 \
  --voters 5 \
  --prune aggressive \
  --voting first-to-k \
  --k 3
```

---

## 9. Output Formats

### 9.1 Markdown (Default)

```markdown
# Analysis: Paper Title

## Metadata
- **Authors:** Author 1, Author 2
- **Date:** 2024-11-15
- **arXiv:** 2511.09030

## Summary
[TL;DR summary]

## Problem
[Problem statement]

## Solution
[Solution overview]

### Components
1. **Component 1** - Description
2. **Component 2** - Description

## Methods
[Methodology description]

### Algorithms
```pseudocode
Algorithm 1: Name
...
```

## Results
[Results summary]

| Metric | Value | Baseline |
|--------|-------|----------|
| ...    | ...   | ...      |

## Limitations
- Limitation 1
- Limitation 2

## Implementation Notes
- Feasibility: High
- Key components: ...
```

### 9.2 JSON

```json
{
  "metadata": {
    "title": "Paper Title",
    "authors": ["Author 1", "Author 2"],
    "arxivId": "2511.09030",
    "date": "2024-11-15"
  },
  "summary": {
    "tldr": "...",
    "bullets": ["...", "..."],
    "paragraph": "..."
  },
  "problem": {
    "statement": "...",
    "motivation": "...",
    "priorLimitations": ["..."]
  },
  "solution": {
    "approach": "...",
    "components": [
      {
        "name": "...",
        "description": "...",
        "implementable": true
      }
    ],
    "novelty": ["..."]
  },
  "methods": {
    "description": "...",
    "algorithms": [...],
    "equations": [...]
  },
  "results": {
    "summary": "...",
    "metrics": [...],
    "findings": [...]
  },
  "limitations": ["..."],
  "implementation": {
    "feasibility": "high",
    "components": [...]
  },
  "_meta": {
    "version": "1.0.0",
    "timestamp": "2024-11-15T10:30:00Z",
    "costs": {
      "total": 0.0234,
      "breakdown": {...}
    },
    "agents": {
      "spawned": 15,
      "pruned": 4
    }
  }
}
```

### 9.3 YAML

```yaml
metadata:
  title: Paper Title
  authors:
    - Author 1
    - Author 2
  arxivId: "2511.09030"

summary:
  tldr: "..."
  bullets:
    - "..."
    - "..."

# ... (same structure as JSON)
```

---

## 10. Error Handling

### 10.1 Error Types

```typescript
enum RuvectorErrorCode {
  // Input Errors
  INVALID_SOURCE = 'E001',
  FETCH_FAILED = 'E002',
  PARSE_FAILED = 'E003',

  // Agent Errors
  AGENT_TIMEOUT = 'E101',
  AGENT_FAILED = 'E102',
  ALL_AGENTS_FAILED = 'E103',

  // Pruning Errors
  ALL_RESPONSES_PRUNED = 'E201',
  NO_CONSENSUS = 'E202',

  // Voting Errors
  VOTING_FAILED = 'E301',
  MAX_ROUNDS_EXCEEDED = 'E302',

  // Cost Errors
  COST_LIMIT_EXCEEDED = 'E401',

  // Config Errors
  INVALID_CONFIG = 'E501',
  MISSING_API_KEY = 'E502',
}

class RuvectorError extends Error {
  code: RuvectorErrorCode;
  details?: unknown;
  recoverable: boolean;
}
```

### 10.2 Recovery Strategies

```typescript
interface RecoveryConfig {
  [RuvectorErrorCode.AGENT_TIMEOUT]: {
    action: 'retry';
    maxRetries: 2;
    backoff: 'exponential';
  };
  [RuvectorErrorCode.ALL_RESPONSES_PRUNED]: {
    action: 'loosen_pruning';
    fallbackStrategy: 'conservative';
  };
  [RuvectorErrorCode.NO_CONSENSUS]: {
    action: 'spawn_more';
    additionalAgents: 2;
  };
}
```

### 10.3 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Source fetch failed |
| 4 | All agents failed |
| 5 | Cost limit exceeded |
| 6 | Configuration error |

---

## 11. API Reference

### 11.1 Programmatic Usage

```typescript
import { Ruvector, AnalyzeOptions, ExtractOptions } from 'ruvector';

// Initialize
const rv = new Ruvector({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4.1-mini',
});

// Analyze a paper
const analysis = await rv.analyze('https://arxiv.org/pdf/2511.09030', {
  depth: 'deep',
  voters: 5,
});

// Extract specific components
const algorithms = await rv.extract('2511.09030', {
  only: ['algorithms', 'methods'],
});

// Generate implementation
const code = await rv.implement('2511.09030', {
  lang: 'typescript',
  component: 'voting-consensus',
});

// Custom pipeline
const result = await rv.pipeline()
  .fetch('2511.09030')
  .parse()
  .extract(['methods'])
  .analyze({ depth: 'deep' })
  .implement({ lang: 'python' })
  .run();
```

### 11.2 Event Hooks

```typescript
rv.on('agent:spawn', (agent) => {
  console.log(`Spawned agent: ${agent.id}`);
});

rv.on('agent:complete', (agent, response) => {
  console.log(`Agent ${agent.id} completed in ${response.latency}ms`);
});

rv.on('prune:format', (pruned) => {
  console.log(`Format pruned ${pruned.length} responses`);
});

rv.on('prune:consensus', (pruned, clusters) => {
  console.log(`Consensus pruned ${pruned.length}, ${clusters.length} clusters`);
});

rv.on('vote:round', (round, votes) => {
  console.log(`Voting round ${round}: ${JSON.stringify(votes)}`);
});

rv.on('vote:winner', (winner) => {
  console.log(`Winner: ${winner.id}`);
});

rv.on('cost:update', (cost) => {
  console.log(`Total cost: $${cost.total.toFixed(4)}`);
});
```

---

## 12. Dependencies

### 12.1 Runtime Dependencies

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "openai": "^4.0.0",
    "pdf-parse": "^1.1.1",
    "axios": "^1.6.0",
    "cheerio": "^1.0.0",
    "yaml": "^2.3.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "cosmiconfig": "^9.0.0",
    "zod": "^3.22.0",
    "p-limit": "^5.0.0",
    "string-similarity": "^4.0.4"
  }
}
```

### 12.2 Development Dependencies

```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "tsup": "^8.0.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0"
  }
}
```

### 12.3 Peer Dependencies

```json
{
  "peerDependencies": {
    "node": ">=18.0.0"
  }
}
```

---

## Appendix A: Agent Prompts

### Parser Agent

```
You are a document parser specializing in academic papers.

Given raw text from a research paper, extract and structure:
1. Metadata (title, authors, abstract, date)
2. Sections with hierarchy
3. Figures and their captions
4. Tables and their contents
5. Equations (in LaTeX)
6. References

Output as JSON matching the ParsedPaper schema.
Be precise. Do not infer or add information not present.
```

### Extractor Agent

```
You are a research paper analyst specializing in {domain}.

Given a paper section, extract:
1. Key concepts and definitions
2. Methods and algorithms (step-by-step)
3. Claims and supporting evidence
4. Quantitative results

For each extraction, provide:
- The exact quote or reference
- Your confidence (0-1)
- Section number

Output as JSON. Only extract what is explicitly stated.
```

### Analyzer Agent

```
You are a senior research scientist reviewing papers.

Analyze the provided content for:
1. Novelty: What is new vs. prior work?
2. Significance: Why does this matter?
3. Validity: Are claims well-supported?
4. Limitations: What are the weaknesses?
5. Applicability: Can this be implemented?

Be critical and objective. Support assessments with evidence.
```

### Implementer Agent

```
You are an expert software engineer implementing research papers.

Given an algorithm or method description:
1. Implement in {language}
2. Add type annotations
3. Include error handling
4. Write unit tests if requested

Follow best practices for {language}.
Add comments only for non-obvious logic.
Output compilable/runnable code.
```

---

## Appendix B: Similarity Metrics

### Cosine Similarity

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}
```

### Jaccard Similarity

```typescript
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}
```

### Semantic Similarity

```typescript
async function semanticSimilarity(
  a: string,
  b: string,
  model = 'text-embedding-3-small'
): Promise<number> {
  const [embA, embB] = await Promise.all([
    embed(a, model),
    embed(b, model),
  ]);
  return cosineSimilarity(embA, embB);
}
```

---

## Appendix C: Cost Estimation

### Token Estimates by Task

| Task | Input Tokens | Output Tokens | Agents | Est. Cost |
|------|-------------|---------------|--------|-----------|
| summarize | 8,000 | 500 | 3 | $0.008 |
| analyze (quick) | 8,000 | 2,000 | 3 | $0.015 |
| analyze (deep) | 8,000 | 5,000 | 5 | $0.045 |
| extract | 8,000 | 1,500 | 3 | $0.012 |
| implement | 2,000 | 3,000 | 3 | $0.018 |

*Estimates based on gpt-4.1-mini pricing ($0.15/1M input, $0.60/1M output)*

### Cost Optimization

1. Use smaller models (gpt-4.1-mini outperforms in reliability/cost)
2. Cache embeddings for similarity calculations
3. Early pruning reduces downstream agent calls
4. Batch similar requests

---

*End of Specification*
