# 🚀 Hypergraph Quick Start Guide

Your complete guide to exploring the **Narrative Goldmine Knowledge Graph**.

---

## 📁 What You Have

```
knowledge-graph-hypergraph.json  (791 KB)  - 1,580 entities, 723 relationships
knowledge-graph.dot              (1.8 KB)  - Graph visualization
explore-hypergraph.js                      - Interactive explorer
query-hypergraph.js                        - Query tool
ruvector-hypergraph-fixed.js               - Semantic search (native Rust)
hypergraph-vector-search.js                - Semantic search (pure JS)
```

---

## 🔍 Exploration Methods

### 1. Interactive Explorer (Recommended First Step)

**View complete statistics and patterns:**
```bash
node explore-hypergraph.js
```

**Shows:**
- ✅ Domain distribution (18 domains)
- ✅ Most connected entities (top 15)
- ✅ Maturity levels breakdown
- ✅ Physicality types (Conceptual, Virtual, Physical)
- ✅ Authority score distribution
- ✅ Sample entities from each domain
- ✅ Cross-domain connection potential

---

### 2. Query Tool (Targeted Search)

**Available queries:**
```bash
# Get help
node query-hypergraph.js help

# Show all blockchain entities
node query-hypergraph.js blockchain

# Show AI ethics concepts (34 entries)
node query-hypergraph.js ai-ethics

# Show metaverse entities (613 entries)
node query-hypergraph.js metaverse

# Show most connected entities
node query-hypergraph.js connected

# Show draft entries needing work (565 entries)
node query-hypergraph.js draft

# Show high-authority entities (≥0.9)
node query-hypergraph.js high-auth

# Search by title
node query-hypergraph.js search "governance"
node query-hypergraph.js search "smart contract"
node query-hypergraph.js search "robot"

# View specific entity details
node query-hypergraph.js entity "Blockchain"
node query-hypergraph.js entity "AI Ethics Board"
node query-hypergraph.js entity "Metaverse"

# Overall statistics
node query-hypergraph.js stats
```

---

### 3. Semantic Vector Search (Production)

**Using native Rust bindings (746 QPS):**
```bash
node ruvector-hypergraph-fixed.js
```

**Features:**
- 🚀 **746 queries/second** with 1.34ms latency
- 🎯 **Semantic similarity** - finds conceptually related entities
- 🌉 **Cross-domain** discovery
- ⚡ **HNSW + SIMD** acceleration

**Example output:**
```
Query: "AI Governance and Ethics"
Top 5 similar:
  1. AI Governance Framework            (0.0000)
  2. ETSI Domain AI + Governance        (0.0164)
  3. Networking Layer                   (0.0172)
  4. Governance Model                   (0.0178)
  5. Interoperability Framework         (0.0199)

Performance: 100 queries in 134ms (746 QPS)
```

---

### 4. Pure JavaScript Vector Search

**No dependencies, slower but portable:**
```bash
node hypergraph-vector-search.js
```

**Features:**
- 📦 **Zero dependencies** - pure JavaScript
- 💾 **JSON persistence** - save/load database
- ⚡ **500+ QPS** performance
- 🔧 **Customizable** metrics (cosine, euclidean, dot product)

---

### 5. Graph Visualization

**Generate visual graph:**
```bash
# PNG image
dot -Tpng knowledge-graph.dot -o graph.png

# SVG (interactive)
dot -Tsvg knowledge-graph.dot -o graph.svg

# PDF document
dot -Tpdf knowledge-graph.dot -o graph.pdf

# View in browser
open graph.svg
```

**Shows:**
- 5 largest domains as clusters
- Sample entities from each
- Cross-domain connections

---

## 💡 Example Use Cases

### Find Related Concepts

**Goal:** Find entities related to "Smart Contracts"

```bash
# Method 1: Text search
node query-hypergraph.js search "smart contract"

# Method 2: Semantic search (finds conceptually similar)
node ruvector-hypergraph-fixed.js
# Look at blockchain query results
```

---

### Explore a Domain

**Goal:** Understand all AI entities

```bash
# Get overview
node explore-hypergraph.js | grep -A 20 "AI ("

# Search specifically
node query-hypergraph.js search "ai"

# See AI ethics
node query-hypergraph.js ai-ethics
```

---

### Find Knowledge Gaps

**Goal:** Identify content needing work

```bash
# Show all draft entries
node query-hypergraph.js draft

# Shows: 565 draft entries grouped by domain
# rb (robotics): 134 drafts (90.5%)
# metaverse: 134 drafts (41.7%)
# blockchain: 94 drafts (41.4%)
```

---

### Validate Quality

**Goal:** Find high-quality validated content

```bash
# High authority entities
node query-hypergraph.js high-auth

# Shows 334 entities with authority ≥ 0.9
# Examples:
#   1. Cryptography (1.00)
#   2. Hash Function (1.00)
#   3. Robot (1.00)
```

---

### Build Recommendation System

**Goal:** Recommend related reading

```javascript
// Using semantic search
const {VectorDB} = require('ruvector');
const db = // ... load from ruvector-hypergraph-fixed.js output

// User is reading "Blockchain"
const results = await db.search({
  vector: blockchainVector,
  k: 5
});

// Recommends:
//   1. Token (0.0025)
//   2. Consensus Mechanism (0.0074)
//   3. Distributed Ledger (0.0090)
```

---

## 📊 Key Statistics

### Content Overview
```
Total Entities:    1,580
Total Relationships: 723
Domains:             18

Top Domains:
  AI (417)           26.4%  - Governance, ethics, fairness
  Metaverse (613)    40.0%  - Virtual worlds, immersion
  Blockchain (323)   20.4%  - DeFi, consensus, crypto
  Robotics (176)     11.1%  - Autonomous systems
```

### Quality Metrics
```
Maturity:
  Mature:        605 (38.3%)
  Draft:         565 (35.8%)  ← Needs attention
  Established:   209 (13.2%)

Authority:
  High (≥0.9):   334 (21.1%)
  Medium:        1,245 (78.8%)
  Low:           1 (0.1%)

Connectivity:
  Connected:     723 entities with relationships
  Avg edges/node: 0.46
  Max connections: 5 (Account Model)
```

---

## 🔗 Most Interesting Entities

### Hub Entities (Most Connected)
```
1. Account Model (5 links) - Blockchain/Metaverse bridge
2. Digital Society Book Draft (5 links) - AI documentation
3. Algorithmic Accountability (4 links) - AI ethics core
4. RGB Protocol (4 links) - Blockchain innovation
5. Blockchain (3 links) - Foundational concept
```

### High Authority Entities
```
1. Cryptography (1.00) - Blockchain foundation
2. Hash Function (1.00) - Core technology
3. Robot (1.00) - Robotics fundamental
4. UNESCO AI Ethics (0.98) - Governance framework
5. Public-Key Cryptography (0.99) - Security primitive
```

### Cross-Domain Bridges
```
• AI ↔ Blockchain: Smart contracts, decentralized AI
• AI ↔ Metaverse: Virtual agents, immersive analytics
• Blockchain ↔ Metaverse: NFTs, virtual economies
• Robotics ↔ AI: Autonomous systems, learning
```

---

## 🎯 Next Steps

### Immediate Actions
1. **Run interactive explorer**
   ```bash
   node explore-hypergraph.js > exploration-results.txt
   ```

2. **Try semantic search**
   ```bash
   node ruvector-hypergraph-fixed.js
   ```

3. **Generate visualization**
   ```bash
   dot -Tsvg knowledge-graph.dot -o graph.svg
   open graph.svg
   ```

### Data Integration
1. **Import to Neo4j**
   ```cypher
   CALL apoc.load.json('file:///knowledge-graph-hypergraph.json')
   YIELD value
   // ... create nodes and relationships
   ```

2. **Use in Python**
   ```python
   import json
   with open('knowledge-graph-hypergraph.json') as f:
       graph = json.load(f)

   # NetworkX analysis
   import networkx as nx
   G = nx.DiGraph()
   for edge in graph['edges']:
       G.add_edge(edge['source'], edge['target'])
   ```

3. **Query with Node.js**
   ```javascript
   const graph = require('./knowledge-graph-hypergraph.json');

   // Find AI entities
   const ai = graph.nodes.filter(n => n.domain === 'ai');

   // Get relationships
   const rels = graph.edges.filter(e => e.type === 'subclassOf');
   ```

---

## 📚 Documentation

**Analysis Reports:**
- `HYPERGRAPH_ANALYSIS.md` - Comprehensive analysis (400+ lines)
- `CONTENT_EXPLORATION.md` - Complete content guide
- `RUVECTOR_ISSUES_v0.1.11.md` - Technical debugging

**Tools:**
- `create-hypergraph.js` - Regenerate from source data
- `explore-hypergraph.js` - Interactive statistics
- `query-hypergraph.js` - Targeted queries
- `ruvector-hypergraph-fixed.js` - Production vector search
- `hypergraph-vector-search.js` - Portable vector search

---

## 🔧 Advanced Usage

### Custom Queries (JavaScript)

**Find all draft blockchain entries:**
```javascript
const graph = require('./knowledge-graph-hypergraph.json');

const draftBlockchain = graph.nodes.filter(n =>
  (n.domain === 'blockchain' || n.domain === 'bc') &&
  n.maturity === 'draft'
);

console.log(`Found ${draftBlockchain.length} draft blockchain entries`);
draftBlockchain.forEach(e => console.log(`  - ${e.title}`));
```

**Find cross-domain entities:**
```javascript
const crossDomain = graph.edges.filter(edge => {
  const source = graph.nodes.find(n => n.id === edge.source);
  const target = graph.nodes.find(n => n.id === edge.target);
  return source && target && source.domain !== target.domain;
});

console.log(`${crossDomain.length} cross-domain relationships`);
```

### Vector Search Integration

**Add to existing app:**
```javascript
const {VectorDB} = require('ruvector');

// Load pre-generated vectors
const vectors = require('./knowledge-graph-vectors.json');

const db = new VectorDB({dimensions: 128});
await db.insertBatch(vectors);

// Search for similar entities
const results = await db.search({
  vector: userQuery,
  k: 10
});
```

---

## 🎊 You're Ready!

You now have everything to:
- ✅ **Explore** 1,580 entities across 18 domains
- ✅ **Search** semantically with 746 QPS performance
- ✅ **Visualize** domain clusters and relationships
- ✅ **Query** specific entities and patterns
- ✅ **Integrate** into your own applications

**Start exploring:**
```bash
node explore-hypergraph.js
```

**Questions?** Check the analysis documents or run:
```bash
node query-hypergraph.js help
```

---

**Generated:** November 25, 2025
**Source:** DreamLab-AI/knowledgeGraph (gh-pages)
**Domain:** https://narrativegoldmine.com
**Total Content:** 848 KB across 12 files
