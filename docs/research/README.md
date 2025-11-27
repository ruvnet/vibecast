# RuVector Pattern Discovery Research

**Exploring Emergent Phenomena in Hybrid Vector-Graph Systems**

---

## 📚 Research Documents

This directory contains a comprehensive research initiative exploring unconventional applications and emergent patterns in RuVector's hybrid vector-graph architecture.

### Core Documents

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[Pattern Discovery Report](./ruvector-pattern-discovery.md)** | Complete research proposal with 5 experiments | Start here for full context |
| **[Experimental Query Library](./ruvector-experimental-queries.md)** | Executable Cypher queries and templates | Implementing experiments |
| **[Quick Reference Summary](./emergent-patterns-summary.md)** | One-page visual guide | Presentations, quick lookup |
| **README** (this file) | Navigation and overview | First-time visitors |

---

## 🎯 Research Overview

### What We're Investigating

**Central Question:** What emergent phenomena arise when combining continuous vector similarity (HNSW search) with discrete graph topology (Cypher queries)?

### The Five Emergent Patterns

1. **Vector-Graph Resonance** - Graph topology changes predict vector embedding drift with measurable time lag
2. **Topological Clustering Collapse** - Graph communities and vector clusters can be orthogonal (NMI < 0.2)
3. **Attention-Guided Wormholes** - GNN attention reveals semantic shortcuts bypassing explicit graph paths
4. **Hyperedge Compression** - N-ary relationships reduce effective dimensionality (up to 55%)
5. **Temporal Gradient Flow** - Citation paths align with embedding space gradients (tortuosity ~ 1.05)

---

## 🚀 Quick Start Guide

### For Researchers

```bash
# 1. Choose an experiment (recommended: start with #1 Resonance)
# 2. Read the full experiment design in ruvector-pattern-discovery.md
# 3. Gather dataset (see section "Dataset Required")
# 4. Adapt queries from ruvector-experimental-queries.md
# 5. Run and measure outcomes
```

### For Developers

```bash
# 1. Install RuVector
npm install ruvector
# or build from source: https://github.com/ruvnet/ruvector

# 2. Load sample data
node scripts/load-dataset.js --experiment resonance --source github-archive

# 3. Run baseline queries
cypher-shell < queries/baseline-metrics.cypher

# 4. Execute experiment
node scripts/run-experiment.js --id 1 --output results/
```

### For Decision Makers

```bash
# 1. Read the Quick Reference Summary (emergent-patterns-summary.md)
# 2. Review "Research Impact Potential" section
# 3. Check reproducibility resources and datasets
# 4. Decide on resource allocation for experiments
```

---

## 📋 Experiment Selection Matrix

| Your Goal | Recommended Experiment | Expected Time | Difficulty |
|-----------|------------------------|---------------|------------|
| Predict code refactoring needs | #1 Resonance | 2-3 weeks | Medium |
| Find cross-genre musical collaborations | #2 Orthogonality | 1-2 weeks | Easy |
| Recommend non-obvious research papers | #3 Wormholes | 3-4 weeks | Hard |
| Compress flavor/ingredient embeddings | #4 Compression | 2 weeks | Medium |
| Forecast scientific trends | #5 Gradient Flow | 4-5 weeks | Hard |

**Beginner-Friendly:** Start with Experiment #2 (Orthogonality) - requires smallest dataset and simplest metrics.

**High Impact:** Experiment #3 (Wormholes) - most novel, publishable results.

**Practical Value:** Experiment #1 (Resonance) - immediate applications in DevOps and code analysis.

---

## 🔬 Experimental Workflow

### Phase 1: Setup (Week 1)
- [ ] Install RuVector and dependencies
- [ ] Choose experiment and gather dataset
- [ ] Generate/obtain embeddings
- [ ] Build graph structure (nodes + edges)
- [ ] Run baseline queries to validate data

### Phase 2: Baseline (Week 2)
- [ ] Measure graph metrics (centrality, communities, paths)
- [ ] Measure vector metrics (KNN, clusters, dimensionality)
- [ ] Compute initial correlation (expected: ρ ~ 0.3-0.5)
- [ ] Visualize current state

### Phase 3: Hypothesis Testing (Weeks 3-4)
- [ ] Execute experiment-specific queries
- [ ] Collect measurements over time/samples
- [ ] Compute emergent metrics (NMI, tortuosity, lag correlation)
- [ ] Compare to expected outcomes
- [ ] Identify surprising patterns

### Phase 4: Analysis (Week 5)
- [ ] Statistical significance testing
- [ ] Case study deep dives (5-10 examples)
- [ ] Visualizations (scatter plots, network diagrams, time series)
- [ ] Document findings

### Phase 5: Publication (Week 6+)
- [ ] Write paper/blog post
- [ ] Share code and data
- [ ] Present at conference/meetup
- [ ] Contribute back to RuVector docs

---

## 📊 Datasets & Resources

### Pre-Built Datasets (Ready to Use)

| Dataset | Domain | Size | Embeddings Included | Download |
|---------|--------|------|---------------------|----------|
| **PyTorch Commit Graph** | Code | 50k commits | CodeBERT | [Link TBD] |
| **ArXiv Citation Network** | Papers | 2M papers | SPECTER | [Link TBD] |
| **Spotify Collaboration Graph** | Music | 100k artists | Audio features | [Link TBD] |

### Build Your Own

See `scripts/dataset-builder/` for tools to:
- Extract GitHub repository history
- Crawl academic citation databases
- Scrape recipe websites
- Query protein structure databases

### Embedding Models

| Domain | Model | Dimensions | Quality | Speed |
|--------|-------|------------|---------|-------|
| Code | CodeBERT | 768 | High | Fast |
| Papers | SPECTER | 768 | High | Fast |
| Music | VGGish | 128 | Medium | Fast |
| Text | BGE-large | 1024 | Very High | Medium |
| Proteins | ESM-2 | 1280 | High | Slow |

---

## 🧮 Key Metrics Reference

### Graph Metrics
- **Degree Centrality:** `size((node)-[]-())`
- **Betweenness:** `gds.betweenness.stream()`
- **Communities:** `gds.louvain.stream()` → NMI with clusters
- **Shortest Path:** `shortestPath(start, end)` → tortuosity

### Vector Metrics
- **KNN Density:** `vectorSearch(emb, k=10)` → avg distance
- **Clusters:** K-means → NMI with communities
- **Intrinsic Dimension:** `skdim.id.MLE().fit(embeddings)`
- **Drift Velocity:** `distance(emb_t0, emb_t1) / (t1 - t0)`

### Emergent Metrics
- **Resonance Lag:** `correlation(centrality_t0, drift_t1)` with lag sweep
- **NMI (Orthogonality):** `sklearn.metrics.normalized_mutual_info_score()`
- **Tortuosity:** `pathLength / directDistance` (close to 1 = straight)
- **Compression Ratio:** `intrinsicDim(hyperedge) / intrinsicDim(isolated)`

---

## 💡 Novel Applications Discovered

### 1. Musical Genome Graphs
- **Innovation:** Find genre-bridging artists via harmonic path discovery
- **Query:** Shortest harmonic paths between distant genres
- **Impact:** Predict viral collaborations, recommend cross-genre playlists

### 2. Code Evolution Trees
- **Innovation:** Identify technical debt archaeological layers
- **Query:** Functions with similar AST but diverged complexity
- **Impact:** Automated refactoring suggestions, code smell detection

### 3. Dream Journaling Networks
- **Innovation:** Precognitive pattern mining via temporal-emotional graphs
- **Query:** Recurring symbols that precede significant events
- **Impact:** Sleep research, personal insight tools, mental health tracking

### 4. Recipe Flavor Graphs
- **Innovation:** Allergen-free substitution via flavor alchemy discovery
- **Query:** Chemically similar + graph-supported ingredient swaps
- **Impact:** Dietary restriction recipes, novel food pairing generators

### 5. Protein Folding Pathways
- **Innovation:** Drug target pathway inference via allosteric networks
- **Query:** Distant residues with correlated dynamics (hyperedges)
- **Impact:** Drug discovery, protein engineering, disease treatment

---

## 🔧 Technical Implementation

### RuVector Configuration for Experiments

```javascript
// Optimal settings for pattern discovery
const db = new ruvector.VectorDB({
  // Vector search
  dimensions: 768,  // Match your embedding model
  distanceMetric: 'Cosine',
  hnswConfig: {
    m: 32,              // Higher for complex graphs
    efConstruction: 200,
    efSearch: 100
  },

  // GNN settings (for wormhole detection)
  gnnConfig: {
    layers: 3,
    heads: 4,
    hiddenDim: 256,
    dropout: 0.1
  },

  // Graph settings
  graphConfig: {
    enableHyperedges: true,  // For compression experiments
    enableTemporal: true,    // For resonance/gradient flow
    indexProperties: ['timestamp', 'centrality', 'cluster']
  },

  // Performance
  parallelism: 8,
  cacheSize: '2GB'
});
```

### Sample Workflow

```javascript
// 1. Load graph data
await db.loadGraph({
  nodes: './data/nodes.jsonl',
  edges: './data/edges.jsonl',
  embeddings: './data/embeddings.npy'
});

// 2. Run baseline analysis
const baseline = await db.query(`
  MATCH (n:Node)
  RETURN avg(size((n)-[]-()))) AS avgDegree,
         stddev(vectorDensity(n.embedding)) AS embeddingSpread
`);

// 3. Execute experiment
const results = await runExperiment({
  type: 'resonance',
  timeWindow: '52 weeks',
  lagSteps: [1, 2, 3, 4],
  outputPath: './results/'
});

// 4. Visualize
await visualize(results, {
  type: 'scatter',
  x: 'centralityDelta',
  y: 'driftVelocity',
  color: 'nodeType'
});
```

---

## 📖 Reading Order

### For Complete Understanding (3-4 hours)
1. This README (10 min)
2. Pattern Discovery Report - Introduction & Part 1 (30 min)
3. Quick Reference Summary - All sections (20 min)
4. Pattern Discovery Report - Parts 2-3 (60 min)
5. Experimental Query Library - Skim patterns (30 min)
6. Pattern Discovery Report - Parts 4-5 (40 min)

### For Quick Start (30 min)
1. This README (10 min)
2. Quick Reference Summary (15 min)
3. Experimental Query Library - Choose 1 experiment (5 min)

### For Implementation (1 hour)
1. Choose experiment from Quick Reference Summary (5 min)
2. Read full experiment design in Pattern Discovery Report (20 min)
3. Adapt queries from Query Library (20 min)
4. Review dataset requirements and metrics (15 min)

---

## 🤝 Contributing

We welcome contributions in several forms:

### Experimental Results
- Run one of the 5 experiments on new datasets
- Share findings, visualizations, and code
- Submit as pull request to `/experiments/<domain>/`

### New Hypotheses
- Propose new emergent phenomena
- Design experimental protocol
- Add to Pattern Discovery Report

### Query Optimizations
- Improve query performance
- Add new utility functions
- Extend Query Library

### Datasets
- Curate and share domain-specific datasets
- Document embeddings and graph structure
- Add to `/datasets/<domain>/`

### Documentation
- Fix typos, improve clarity
- Add tutorials and walkthroughs
- Translate to other languages

---

## 📧 Contact & Support

- **Issues:** https://github.com/ruvnet/vibecast/issues
- **Discussions:** https://github.com/ruvnet/vibecast/discussions
- **RuVector Docs:** https://github.com/ruvnet/ruvector
- **Citation Questions:** See Quick Reference Summary

---

## 🏆 Acknowledgments

This research builds on:
- **RuVector:** Hybrid vector-graph database by rUv
- **Claude-Flow:** Multi-agent orchestration framework
- **Vibecast:** Live coding research series

Special thanks to the open-source communities:
- HNSW authors (Malkov & Yashunin)
- Neo4j graph database team
- Hugging Face embedding models
- Scientific dataset curators

---

## 📄 License

- **Documentation & Queries:** MIT License
- **Code Examples:** Apache 2.0 License
- **Research Findings:** CC BY 4.0 (attribution required)

---

## 🔮 Future Directions

### Short Term (Q1 2026)
- [ ] Run all 5 experiments on baseline datasets
- [ ] Publish results and statistical analysis
- [ ] Release pre-built datasets and embeddings
- [ ] Create interactive visualization dashboard

### Medium Term (Q2-Q3 2026)
- [ ] Extend to dynamic/streaming graphs
- [ ] Multi-modal embeddings (text + image + audio)
- [ ] Causal inference experiments (graph→vector vs vector→graph)
- [ ] Theoretical foundations paper

### Long Term (2027+)
- [ ] RuVector enhancement proposals (temporal diffing, attention export)
- [ ] Cross-database comparisons (Milvus, Qdrant, Pinecone)
- [ ] Industry partnerships for real-world applications
- [ ] Conference tutorial series on hybrid systems

---

**Research Initiated:** November 27, 2025
**Last Updated:** November 27, 2025
**Status:** Active - Seeking Collaborators
**Version:** 1.0

---

*Happy pattern hunting! 🔍*
