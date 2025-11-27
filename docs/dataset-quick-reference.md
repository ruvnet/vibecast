# RuVector Datasets - Quick Reference

**Top 12 Datasets at a Glance**

## Quick Start: Top 3 Priority Datasets

### 1. SIFT1M - Easiest Start (500MB, 1 hour)
```bash
wget http://corpus-texmex.irisa.fr/sift.tar.gz
tar -xzf sift.tar.gz
ruvector-cli benchmark run --dataset sift1m
```
**Benchmark:** QPS at 0.99 recall vs Pinecone/Qdrant

### 2. ogbn-papers100M - Best Showcase (~100GB, 1 day)
```bash
pip install ogb
python -c "from ogb.nodeproppred import NodePropPredDataset; NodePropPredDataset('ogbn-papers100M')"
ruvector-cli graph import --format ogb --dataset ogbn-papers100M
```
**Demo:** Hybrid vector+graph queries (unique to RuVector)

### 3. Wikidata - Best for Hyperedges (~100GB, varies)
```bash
wget https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.gz
ruvector-cli graph import --format wikidata-json --enable-hyperedges
```
**Demo:** N-ary relationships (unique to RuVector)

---

## Dataset Matrix

| # | Dataset | Category | Size | Setup Time | RuVector Unique Feature |
|---|---------|----------|------|------------|------------------------|
| 1 | **SIFT1M** | Vector | 500MB | 1 hour | Latency comparison vs competitors |
| 2 | **DEEP1B** | Vector | ~100GB | 1 day | Distributed HNSW at billion-scale |
| 3 | **ogbn-papers100M** | Citation Graph | ~100GB | 1 day | Hybrid vector+Cypher queries |
| 4 | **ogbg-molhiv** | Molecular Graph | 50MB | 30 min | Pharmacophore hyperedges |
| 5 | **Wikidata** | Knowledge Graph | ~100GB | 1-2 days | N-ary hyperedges for qualifiers |
| 6 | **Reddit Hyperlinks** | Social Graph | 50MB | 30 min | Temporal Cypher + CDC |
| 7 | **Spotify MPD** | Recommendation | 5GB | 4 hours | Hybrid collaborative filtering |
| 8 | **AlphaFold DB** | Protein Graphs | 23TB (full) | Varies | Residue contact hypergraphs |
| 9 | **WikiArt** | Art+Vision | ~100GB | 6 hours | Multi-modal CLIP+provenance |
| 10 | **Steam Games** | Gaming | 10GB | 4 hours | Social+content hybrid recs |
| 11 | **Bluesky Firehose** | Real-time Stream | Live | 2 hours | Real-time graph evolution |
| 12 | **Coinbase WS** | Financial Stream | Live | 1 hour | Sub-ms financial graph queries |

---

## By Use Case

### Vector Search Performance
- **SIFT1M** - Industry standard, easy comparison
- **DEEP1B** - Billion-scale stress test
- **AlphaFold** - Real-world protein embeddings

### Graph Database Capabilities
- **ogbn-papers100M** - Massive citation graph
- **Wikidata** - Complex knowledge graph
- **Reddit** - Temporal social network

### Hyperedge Support (RuVector Exclusive)
- **Wikidata** - Qualifiers as N-ary relationships
- **ogbg-molhiv** - Functional groups (3+ atoms)
- **AlphaFold** - Catalytic sites (multi-residue)

### GNN Training/Inference
- **ogbn-papers100M** - Node classification
- **ogbg-molhiv** - Graph classification
- **Spotify MPD** - Recommendation via attention

### Real-time Streaming
- **Bluesky Firehose** - Social network events
- **Coinbase WS** - Financial market data
- **Reddit API** - Community dynamics

### Hybrid Vector+Graph
- **ogbn-papers100M** - Semantic + citation
- **Spotify MPD** - Audio features + co-occurrence
- **Steam Games** - Tag embeddings + social graph

---

## Download Commands

### Vector Datasets
```bash
# SIFT1M (500MB)
wget http://corpus-texmex.irisa.fr/sift.tar.gz

# DEEP1B (base: 128GB, learn: 13GB, query: 13MB)
wget http://corpus-texmex.irisa.fr/deep1b_base.fvecs
```

### Graph Datasets (OGB)
```bash
pip install ogb
python << 'EOF'
from ogb.nodeproppred import NodePropPredDataset
from ogb.graphproppred import GraphPropPredDataset

# Citation graph (111M nodes)
papers = NodePropPredDataset("ogbn-papers100M")

# Molecular graphs (41K molecules)
molhiv = GraphPropPredDataset("ogbg-molhiv")
EOF
```

### Knowledge Graphs
```bash
# Wikidata (sample via SPARQL)
curl -H "Accept: application/json" \
  'https://query.wikidata.org/sparql?query=SELECT * WHERE {?s ?p ?o} LIMIT 10000000' \
  > wikidata-10m.json

# Reddit Hyperlinks
wget https://snap.stanford.edu/data/soc-redditHyperlinks-title.tsv
```

### Recommendation Datasets
```bash
# Spotify Million Playlist (requires AIcrowd account)
# https://www.aicrowd.com/challenges/spotify-million-playlist-dataset-challenge/dataset_files

# Steam Games
kaggle datasets download -d fronkongames/steam-games-dataset
```

### Art & Unconventional
```bash
# WikiArt (via HuggingFace)
pip install datasets
python -c "from datasets import load_dataset; load_dataset('huggan/wikiart')"

# AlphaFold (human proteome sample, requires gcloud)
gsutil -m cp "gs://public-datasets-deepmind-alphafold/v4/UP000005640_9606_HUMAN_v4/*.cif.gz" ./alphafold-human/
```

### Real-time Streams (WebSocket)
```bash
# Bluesky Firehose (requires auth)
npm install @atproto/api ws
node bluesky-stream.js  # See full guide

# Coinbase Market Data (free)
npm install ws
node coinbase-stream.js  # See full guide
```

---

## Storage Requirements

| Dataset | Compressed | Uncompressed | After RuVector Import |
|---------|-----------|--------------|---------------------|
| SIFT1M | 161MB | 500MB | ~750MB (with HNSW index) |
| DEEP1B | 128GB | ~400GB | ~600GB (with index) |
| ogbn-papers100M | 30GB | ~100GB | ~150GB (with vectors) |
| ogbg-molhiv | 20MB | 50MB | ~80MB (with features) |
| Wikidata | 100GB | ~300GB | ~400GB (with indexes) |
| Reddit | 15MB | 50MB | ~100MB (with indexes) |
| Spotify MPD | 5GB | 10GB | ~15GB (with vectors) |
| AlphaFold (full) | ~10TB | ~23TB | ~30TB (with contacts) |
| WikiArt | 50GB | ~100GB | ~120GB (with CLIP) |
| Steam Games | 5GB | 10GB | ~15GB (with graphs) |

**Recommended Setup:**
- **Minimal** (testing): SIFT1M + ogbg-molhiv = 1GB
- **Standard** (demos): Add ogbn-papers100M + Reddit = ~150GB
- **Full** (research): All except AlphaFold = ~1TB
- **Complete** (production): All datasets = ~30TB

---

## Benchmark Metrics

### Vector Search (SIFT1M, DEEP1B)
- **Throughput:** Queries per second (QPS)
- **Latency:** p50, p95, p99 percentiles
- **Recall:** Accuracy @ k nearest neighbors
- **Memory:** Index size vs raw data size

**Target:** Top-5 on ANN-Benchmarks.com

### Graph Query (ogbn-papers100M, Wikidata)
- **Query Latency:** Simple (1-hop), Medium (2-hop), Complex (3-hop+)
- **Optimization:** Speedup from query planner
- **Scalability:** Performance vs graph size

**Target:** < 100ms for 2-hop queries on 100M nodes

### Hybrid (ogbn-papers100M, Spotify, Steam)
- **Recommendation Quality:** Precision@K, NDCG@K
- **Combined Latency:** Vector search + graph traversal
- **Novelty Improvement:** vs vector-only baseline

**Target:** 15-30% precision improvement over vector-only

### GNN (ogbn-papers100M, ogbg-molhiv)
- **Classification Accuracy:** Node/graph classification
- **Training Speed:** Epochs to convergence
- **Inference Latency:** Prediction time

**Target:** Within 5% of SOTA accuracy

### Distributed (DEEP1B, ogbn-papers100M)
- **Horizontal Scaling:** Throughput vs node count
- **Consensus Overhead:** Raft commit latency
- **Replication Lag:** Sync vs async modes

**Target:** 6-7x speedup with 8 nodes

### Real-time (Bluesky, Coinbase)
- **Ingestion Rate:** Events/sec per node
- **E2E Latency:** Event arrival → queryable
- **Recovery Time:** CDC checkpoint resume

**Target:** 50K events/sec, < 500ms E2E latency

---

## Competitive Benchmarks

### vs Pinecone
**Datasets:** SIFT1M, DEEP1B
**Metrics:** Latency (RuVector: 61µs vs Pinecone: ~2ms)

### vs Qdrant
**Datasets:** SIFT1M, ogbn-papers100M
**Metrics:** Graph query support (RuVector: full Cypher, Qdrant: filters only)

### vs Neo4j
**Datasets:** ogbn-papers100M, Wikidata
**Metrics:** Vector search speed (RuVector: 61µs, Neo4j: slower), Hyperedges (RuVector: native)

### vs Milvus
**Datasets:** DEEP1B
**Metrics:** Latency, distributed performance

---

## One-Line Setup (Docker)

```bash
# Pull RuVector benchmark environment (when available)
docker run -it -v $(pwd)/data:/data ruvector/benchmarks:latest

# Inside container, run all benchmarks
ruvector-bench run-all --output /data/results.json

# Or specific dataset
ruvector-bench run sift1m --compare pinecone,qdrant
```

---

## Key Takeaways

1. **Start with SIFT1M**: 500MB, 1 hour, immediate comparison with competitors
2. **Showcase ogbn-papers100M**: Hybrid queries NO other vector DB can do
3. **Demonstrate Wikidata hyperedges**: Unique N-ary relationship support
4. **Stream Bluesky/Coinbase**: Real-time graph evolution with CDC
5. **Full suite = ~1TB** (excluding AlphaFold): Comprehensive benchmark coverage

**For Details:** See `ruvector-dataset-benchmark-guide.md` (full 50-page report)
