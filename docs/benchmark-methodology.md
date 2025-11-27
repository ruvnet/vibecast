# Benchmark Methodology for Novel RuVector Algorithms

**Date:** November 27, 2025
**Target:** Validate 4 novel algorithms with rigorous performance testing
**Status:** Ready for implementation

---

## Overview

This document outlines comprehensive benchmarking strategies to validate the performance claims for:

1. **Attention-Guided HNSW (AG-HNSW)** - Target: 30-40% search speedup
2. **Neural Cypher Optimizer (NCO)** - Target: 3-7x query optimization
3. **Hybrid Vector-Graph Retrieval (HVGR)** - Target: 10x hybrid query speedup
4. **Streaming Graph Embeddings (SGE)** - Target: 1000x faster updates

---

## General Benchmarking Principles

### 1. Hardware Configuration

**Standard Benchmark Machine:**
```
CPU: AMD Ryzen 9 5950X (16 cores, 32 threads)
RAM: 128GB DDR4-3200
Storage: Samsung 980 PRO 2TB NVMe SSD
GPU: NVIDIA RTX 3090 (24GB) - for GNN training
OS: Ubuntu 22.04 LTS
Rust: 1.75+ with --release optimizations
```

**Compiler Flags:**
```toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"
```

### 2. Dataset Standards

**Vector Datasets:**
- **Small**: 100K vectors, 384 dims (SBERT embeddings)
- **Medium**: 1M vectors, 384 dims
- **Large**: 10M vectors, 384 dims
- **XL**: 100M vectors, 768 dims (research-grade)

**Graph Datasets:**
- **Social Network**: 1M nodes, 5M edges (citation network)
- **Knowledge Graph**: 500K nodes, 2M edges, 50 node types
- **E-commerce**: 2M nodes (users/products), 10M edges
- **Academic**: 10M nodes (papers), 50M edges (citations)

### 3. Metrics Collection

**Primary Metrics:**
- Latency (p50, p95, p99, p99.9)
- Throughput (QPS - queries per second)
- Recall@k (k=1, 10, 100)
- Memory usage (RSS, heap)
- CPU utilization

**Secondary Metrics:**
- Distance computations per query
- Cache hit rate
- Training convergence time
- Model size (MB)

### 4. Statistical Rigor

- **Warmup**: 1000 queries before measurement
- **Iterations**: Minimum 10,000 queries per test
- **Repetitions**: 5 runs, report mean ± std dev
- **Significance**: t-test with p < 0.05
- **Outlier handling**: Winsorization at 1%/99%

---

## Algorithm 1: Attention-Guided HNSW Benchmarks

### Test Suite A1: Search Latency

**Objective:** Validate 30-40% latency reduction claim

**Test Configuration:**
```rust
// File: ruvector-core/benches/ag_hnsw_latency.rs

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use ruvector_core::{Hnsw, AttentionGuidedHNSW, AttentionGuidedConfig};

fn bench_search_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("AG-HNSW Search Latency");

    // Dataset sizes
    let sizes = vec![100_000, 1_000_000, 10_000_000];

    for size in sizes {
        // Setup
        let dims = 384;
        let vectors = generate_vectors(size, dims);
        let queries = generate_queries(1000, dims);

        // Standard HNSW baseline
        let mut hnsw = Hnsw::new(dims, DistanceMetric::Cosine, HnswConfig {
            m: 32,
            ef_construction: 200,
            ef_search: 200,
        });
        hnsw.batch_insert(&vectors);

        // AG-HNSW
        let config = AttentionGuidedConfig {
            ef_reduction_factor: 0.6,  // Reduce ef to 120
            ..Default::default()
        };
        let mut ag_hnsw = AttentionGuidedHNSW::from_hnsw(hnsw.clone(), config);

        // Pre-train on 10k queries
        let train_queries = generate_queries(10_000, dims);
        ag_hnsw.train_batch(&train_queries);

        // Benchmark standard HNSW
        group.bench_with_input(
            BenchmarkId::new("Standard HNSW", size),
            &queries,
            |b, queries| {
                b.iter(|| {
                    for query in queries {
                        black_box(hnsw.search(query, 10));
                    }
                })
            }
        );

        // Benchmark AG-HNSW
        group.bench_with_input(
            BenchmarkId::new("AG-HNSW", size),
            &queries,
            |b, queries| {
                b.iter(|| {
                    for query in queries {
                        black_box(ag_hnsw.search(query, 10));
                    }
                })
            }
        );
    }

    group.finish();
}

criterion_group!(benches, bench_search_latency);
criterion_main!(benches);
```

**Expected Output:**
```
AG-HNSW Search Latency/Standard HNSW/1000000
                        time:   [61.2 µs 61.5 µs 61.8 µs]

AG-HNSW Search Latency/AG-HNSW/1000000
                        time:   [37.1 µs 37.4 µs 37.7 µs]
                        change: [-39.2% -39.0% -38.8%] (p < 0.001)
```

### Test Suite A2: Recall Quality

**Objective:** Ensure recall@10 ≥ 95% with reduced ef

**Test:**
```rust
fn bench_recall_quality() {
    let dims = 384;
    let n_vectors = 100_000;
    let n_queries = 1000;

    let vectors = generate_vectors(n_vectors, dims);
    let queries = generate_queries(n_queries, dims);

    // Ground truth (exhaustive search)
    let ground_truth = compute_ground_truth(&vectors, &queries, 10);

    // Standard HNSW (ef=200)
    let hnsw = build_hnsw(&vectors, ef=200);
    let hnsw_results = search_batch(&hnsw, &queries, 10);
    let hnsw_recall = compute_recall(&hnsw_results, &ground_truth);

    // AG-HNSW (ef=120)
    let ag_hnsw = build_ag_hnsw(&vectors, ef=120);
    let ag_results = search_batch(&ag_hnsw, &queries, 10);
    let ag_recall = compute_recall(&ag_results, &ground_truth);

    println!("Standard HNSW Recall@10: {:.2}%", hnsw_recall * 100.0);
    println!("AG-HNSW Recall@10: {:.2}%", ag_recall * 100.0);

    assert!(ag_recall >= 0.95, "AG-HNSW recall below 95%");
    assert!(ag_recall >= hnsw_recall - 0.02, "AG-HNSW recall degraded");
}
```

### Test Suite A3: Distance Computation Reduction

**Objective:** Verify 40% reduction in distance computations

**Test:**
```rust
fn bench_distance_computations() {
    // Instrument distance function to count calls
    let mut hnsw_count = 0;
    let mut ag_hnsw_count = 0;

    // Inject counting wrapper
    let hnsw = Hnsw::with_distance_counter(&mut hnsw_count);
    let ag_hnsw = AttentionGuidedHNSW::with_distance_counter(&mut ag_hnsw_count);

    // Run 1000 searches
    for query in queries {
        hnsw.search(&query, 10);
        ag_hnsw.search(&query, 10);
    }

    let reduction = 1.0 - (ag_hnsw_count as f64 / hnsw_count as f64);
    println!("Distance computation reduction: {:.1}%", reduction * 100.0);

    assert!(reduction >= 0.35, "Failed to achieve 35% reduction");
}
```

---

## Algorithm 2: Neural Cypher Optimizer Benchmarks

### Test Suite B1: Query Optimization Speedup

**Objective:** Validate 3-7x speedup on complex queries

**Test Configuration:**
```rust
// File: ruvector-graph/benches/neural_optimizer.rs

fn bench_query_optimization(c: &mut Criterion) {
    let mut group = c.benchmark_group("Neural Cypher Optimizer");

    // Load graph database
    let graph = load_graph("benchmarks/data/citation_network.db");

    // Query workload
    let queries = vec![
        // Simple (1-hop)
        "MATCH (p:Paper) WHERE p.year > 2020 RETURN p.title",

        // Medium (3-hop)
        "MATCH (a:Author)-[:WROTE]->(p:Paper)-[:CITES]->(q:Paper)
         WHERE a.name = 'Geoffrey Hinton'
         RETURN q.title, COUNT(*) ORDER BY COUNT(*) DESC LIMIT 10",

        // Complex (multi-join with aggregation)
        "MATCH (a:Author)-[:WROTE]->(p1:Paper),
               (b:Author)-[:WROTE]->(p2:Paper),
               (p1)-[:CITES]->(common:Paper)<-[:CITES]-(p2)
         WHERE a.institution = 'MIT' AND b.institution = 'Stanford'
         RETURN a.name, b.name, COUNT(common) as collaborations
         ORDER BY collaborations DESC
         LIMIT 20",

        // Variable-length path
        "MATCH (start:Paper {title: 'Attention is All You Need'})
               -[:CITES*1..5]->(end:Paper)
         WHERE end.topic = 'NLP'
         RETURN end.title, LENGTH(path) as hops
         ORDER BY hops LIMIT 10",
    ];

    // Rule-based optimizer
    let rule_optimizer = QueryOptimizer::default();

    // Neural optimizer (pre-trained)
    let neural_optimizer = QueryOptimizer::default()
        .with_neural_optimizer(NeuralOptimizerConfig::default());

    for (i, query) in queries.iter().enumerate() {
        let query_type = match i {
            0 => "Simple",
            1 => "Medium",
            2 => "Complex",
            3 => "Variable-Length",
            _ => "Unknown",
        };

        // Benchmark rule-based
        group.bench_with_input(
            BenchmarkId::new(format!("Rule-Based {}", query_type), i),
            &query,
            |b, q| {
                b.iter(|| {
                    let plan = rule_optimizer.optimize(q);
                    black_box(graph.execute(&plan));
                })
            }
        );

        // Benchmark neural
        group.bench_with_input(
            BenchmarkId::new(format!("Neural {}", query_type), i),
            &query,
            |b, q| {
                b.iter(|| {
                    let plan = neural_optimizer.optimize(q);
                    black_box(graph.execute(&plan));
                })
            }
        );
    }

    group.finish();
}
```

**Expected Output:**
```
Neural Cypher Optimizer/Rule-Based Medium/1
                        time:   [45.2 ms 45.5 ms 45.8 ms]

Neural Cypher Optimizer/Neural Medium/1
                        time:   [11.8 ms 12.1 ms 12.4 ms]
                        change: [-73.4% -73.2% -73.0%] (p < 0.001)
                        speedup: 3.76x

Neural Cypher Optimizer/Rule-Based Complex/2
                        time:   [120.3 ms 121.2 ms 122.1 ms]

Neural Cypher Optimizer/Neural Complex/2
                        time:   [17.9 ms 18.2 ms 18.5 ms]
                        change: [-85.0% -84.8% -84.6%] (p < 0.001)
                        speedup: 6.66x
```

### Test Suite B2: Plan Quality

**Objective:** Verify neural plans are optimal or near-optimal

**Test:**
```rust
fn bench_plan_quality() {
    // Small queries where exhaustive search is feasible
    let small_graph = load_graph("benchmarks/data/small_1k.db");
    let queries = load_queries("benchmarks/queries/optimizable.cypher");

    for query in queries {
        // Exhaustive search (try all plan permutations)
        let optimal_plan = exhaustive_plan_search(&small_graph, &query);
        let optimal_cost = execute_and_measure(&small_graph, &optimal_plan);

        // Neural optimizer
        let neural_plan = neural_optimizer.optimize(&query);
        let neural_cost = execute_and_measure(&small_graph, &neural_plan);

        // Rule-based optimizer
        let rule_plan = rule_optimizer.optimize(&query);
        let rule_cost = execute_and_measure(&small_graph, &rule_plan);

        let neural_optimality = optimal_cost / neural_cost;
        let rule_optimality = optimal_cost / rule_cost;

        println!("Query: {}", query);
        println!("  Neural optimality: {:.2}%", neural_optimality * 100.0);
        println!("  Rule optimality: {:.2}%", rule_optimality * 100.0);

        assert!(neural_optimality >= 0.90, "Neural plan >10% suboptimal");
        assert!(neural_cost <= rule_cost, "Neural worse than rules");
    }
}
```

---

## Algorithm 3: Hybrid Vector-Graph Retrieval Benchmarks

### Test Suite C1: Hybrid Query Latency

**Objective:** Validate 10x speedup on hybrid queries

**Test Configuration:**
```rust
// File: ruvector-core/benches/hybrid_retrieval.rs

fn bench_hybrid_retrieval(c: &mut Criterion) {
    let mut group = c.benchmark_group("Hybrid Vector-Graph Retrieval");

    // Setup hybrid database
    let dims = 384;
    let n_nodes = 1_000_000;
    let n_edges = 5_000_000;

    let mut db = VectorDB::new(dims);
    load_graph(&mut db, "benchmarks/data/citation_network.graphml");
    load_embeddings(&mut db, "benchmarks/data/paper_embeddings.npy");

    // Hybrid queries
    let hybrid_queries = vec![
        HybridQuery::VectorWithGraphConstraints {
            vector: get_embedding("attention_paper"),
            cypher: "MATCH (p:Paper)<-[:AUTHORED]-(a:Author)
                    WHERE a.h_index > 50
                    RETURN p",
        },
        HybridQuery::GraphWithVectorSimilarity {
            pattern: "MATCH (p:Paper)-[:CITES]->(q:Paper {topic: 'transformers'})
                     RETURN p",
            vector: get_embedding("bert_paper"),
        },
        HybridQuery::MultiModalWalk {
            start_nodes: vec![get_node_id("hinton"), get_node_id("bengio")],
            target_vector: get_embedding("deep_learning"),
            walk_params: RandomWalkParams::default(),
        },
    ];

    for (i, query) in hybrid_queries.iter().enumerate() {
        // Baseline: Separate HNSW + Cypher
        group.bench_with_input(
            BenchmarkId::new("Separate", i),
            &query,
            |b, q| {
                b.iter(|| {
                    // Step 1: Vector search
                    let vec_results = db.hnsw_search(&q.vector(), 1000);

                    // Step 2: Graph filtering
                    let filtered = vec_results.into_iter()
                        .filter(|(id, _)| db.graph.matches(&q.pattern(), *id))
                        .take(10)
                        .collect::<Vec<_>>();

                    black_box(filtered);
                })
            }
        );

        // Hybrid retrieval
        group.bench_with_input(
            BenchmarkId::new("HVGR", i),
            &query,
            |b, q| {
                b.iter(|| {
                    let results = db.hybrid_search(q, 10);
                    black_box(results);
                })
            }
        );
    }

    group.finish();
}
```

**Expected Output:**
```
Hybrid Vector-Graph Retrieval/Separate/0
                        time:   [2.31 ms 2.33 ms 2.35 ms]

Hybrid Vector-Graph Retrieval/HVGR/0
                        time:   [182 µs 185 µs 188 µs]
                        change: [-92.1% -92.0% -91.9%] (p < 0.001)
                        speedup: 12.6x
```

### Test Suite C2: Recall Consistency

**Objective:** Ensure HVGR recall matches separate operations

**Test:**
```rust
fn bench_hybrid_recall() {
    let queries = load_hybrid_queries(100);

    for query in queries {
        // Ground truth (separate ops, exhaustive)
        let vec_results = db.hnsw_search(&query.vector, 10000);
        let ground_truth = vec_results.into_iter()
            .filter(|(id, _)| db.graph.matches(&query.pattern, *id))
            .take(10)
            .collect::<Vec<_>>();

        // HVGR
        let hvgr_results = db.hybrid_search(&query, 10);

        // Compute overlap
        let recall = compute_recall(&hvgr_results, &ground_truth);

        println!("Query: {:?}", query);
        println!("  Recall: {:.2}%", recall * 100.0);

        assert!(recall >= 0.95, "HVGR recall < 95%");
    }
}
```

---

## Algorithm 4: Streaming Graph Embeddings Benchmarks

### Test Suite D1: Update Latency

**Objective:** Validate <5ms latency for incremental updates

**Test Configuration:**
```rust
// File: ruvector-gnn/benches/streaming_embeddings.rs

fn bench_update_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("Streaming Embeddings");

    let n_nodes = 100_000;
    let dims = 128;

    // Setup graph
    let mut graph = GraphDatabase::new();
    graph.add_random_graph(n_nodes, n_nodes * 5, dims);

    // Full re-embedding baseline
    group.bench_function("Full Re-embedding", |b| {
        b.iter(|| {
            graph.compute_gnn_embeddings();
        })
    });

    // Streaming embeddings
    graph.enable_streaming_embeddings(StreamingEmbedderConfig::default());

    // Single edge add
    group.bench_function("Streaming: Single Edge", |b| {
        b.iter(|| {
            let u = rand::random::<usize>() % n_nodes;
            let v = rand::random::<usize>() % n_nodes;
            graph.add_edge_streaming(u, v, 1.0);
        })
    });

    // Batch 100 edges
    group.bench_function("Streaming: Batch 100", |b| {
        b.iter(|| {
            for _ in 0..100 {
                let u = rand::random::<usize>() % n_nodes;
                let v = rand::random::<usize>() % n_nodes;
                graph.add_edge_streaming(u, v, 1.0);
            }
        })
    });

    group.finish();
}
```

**Expected Output:**
```
Streaming Embeddings/Full Re-embedding
                        time:   [2.31 s 2.33 s 2.35 s]

Streaming Embeddings/Streaming: Single Edge
                        time:   [2.08 ms 2.11 ms 2.14 ms]
                        speedup: 1104x

Streaming Embeddings/Streaming: Batch 100
                        time:   [43.2 ms 44.1 ms 45.0 ms]
                        speedup: 52.8x
```

### Test Suite D2: Embedding Quality

**Objective:** Verify cosine similarity ≥ 0.95 vs. full re-embedding

**Test:**
```rust
fn bench_embedding_quality() {
    let graph = load_graph("benchmarks/data/dynamic_graph.db");

    // Baseline: Full re-embedding after each batch
    let mut full_graph = graph.clone();
    let edge_stream = generate_edge_stream(1000);

    for batch in edge_stream.chunks(100) {
        for (u, v, w) in batch {
            full_graph.add_edge(*u, *v, *w);
        }
        full_graph.compute_gnn_embeddings();
    }
    let full_embeddings = full_graph.get_all_embeddings();

    // Streaming: Incremental updates
    let mut streaming_graph = graph.clone();
    streaming_graph.enable_streaming_embeddings(StreamingEmbedderConfig::default());

    for (u, v, w) in &edge_stream {
        streaming_graph.add_edge_streaming(*u, *v, *w);
    }
    let streaming_embeddings = streaming_graph.get_all_embeddings();

    // Compute similarity
    let mut similarities = Vec::new();
    for (node, full_emb) in &full_embeddings {
        let stream_emb = &streaming_embeddings[node];
        let similarity = cosine_similarity(full_emb, stream_emb);
        similarities.push(similarity);
    }

    let mean_similarity = similarities.iter().sum::<f32>() / similarities.len() as f32;
    let min_similarity = similarities.iter().cloned().fold(f32::MAX, f32::min);

    println!("Mean cosine similarity: {:.4}", mean_similarity);
    println!("Min cosine similarity: {:.4}", min_similarity);

    assert!(mean_similarity >= 0.95, "Mean similarity < 0.95");
    assert!(min_similarity >= 0.90, "Min similarity < 0.90");
}
```

---

## Cross-Algorithm Integration Benchmark

### Test Suite E1: End-to-End Hybrid Query

**Objective:** Measure combined speedup of all 4 algorithms

**Test:**
```rust
fn bench_full_stack_integration() {
    // Setup: Database with all algorithms enabled
    let mut db = VectorDB::new(384);

    // Load data
    load_graph(&mut db, "benchmarks/data/large_citation_network.graphml");
    load_embeddings(&mut db, "benchmarks/data/embeddings.npy");

    // Enable all algorithms
    db.enable_attention_guided_hnsw(AttentionGuidedConfig::default());
    db.enable_neural_cypher_optimizer(NeuralOptimizerConfig::default());
    db.enable_hybrid_retrieval();
    db.enable_streaming_embeddings(StreamingEmbedderConfig::default());

    // Complex hybrid query
    let query = HybridQuery::GraphWithVectorSimilarity {
        pattern: r#"
            MATCH (author:Author {name: 'Geoffrey Hinton'})
                  -[:COLLABORATED]->(coauthor:Author)
                  -[:AUTHORED]->(paper:Paper)
            WHERE paper.citations > 100
              AND paper.year > 2015
            RETURN paper
            ORDER BY paper.citations DESC
        "#,
        vector: get_embedding("deep_learning_survey"),
    };

    // Baseline (no algorithms)
    let baseline_time = measure_query(&db_baseline, &query);

    // With all algorithms
    let optimized_time = measure_query(&db, &query);

    let speedup = baseline_time / optimized_time;
    println!("Full-stack speedup: {:.2}x", speedup);
    println!("  Baseline: {:.2}ms", baseline_time);
    println!("  Optimized: {:.2}ms", optimized_time);

    // Target: ~70x speedup (5x NCO × 1.4x AG-HNSW × 10x HVGR)
    assert!(speedup >= 50.0, "Full-stack speedup < 50x");
}
```

---

## Continuous Benchmarking

### CI/CD Integration

```yaml
# .github/workflows/benchmark.yml
name: Performance Benchmarks

on:
  pull_request:
    paths:
      - 'ruvector-core/**'
      - 'ruvector-gnn/**'
      - 'ruvector-graph/**'

jobs:
  benchmark:
    runs-on: ubuntu-latest-16-cores

    steps:
      - uses: actions/checkout@v3

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          profile: minimal

      - name: Download benchmark datasets
        run: |
          wget https://datasets.ruvector.io/benchmark-small.tar.gz
          tar xzf benchmark-small.tar.gz

      - name: Run benchmarks
        run: |
          cargo bench --bench ag_hnsw_latency -- --save-baseline pr-${{ github.event.number }}
          cargo bench --bench neural_optimizer -- --save-baseline pr-${{ github.event.number }}
          cargo bench --bench hybrid_retrieval -- --save-baseline pr-${{ github.event.number }}
          cargo bench --bench streaming_embeddings -- --save-baseline pr-${{ github.event.number }}

      - name: Compare with main
        run: |
          cargo bench --bench ag_hnsw_latency -- --baseline main
          cargo bench --bench neural_optimizer -- --baseline main

      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const results = require('./target/criterion/results.json');
            // Post benchmark comparison to PR
```

---

## Validation Checklist

Before claiming algorithm success, verify:

- [ ] **AG-HNSW:**
  - [ ] Search latency reduced by ≥30%
  - [ ] Recall@10 ≥ 95%
  - [ ] Distance computations reduced by ≥35%
  - [ ] Memory overhead < 2%

- [ ] **Neural Cypher Optimizer:**
  - [ ] Complex queries ≥3x faster
  - [ ] Variable-length path queries ≥4x faster
  - [ ] Plan optimality ≥90% vs. exhaustive search
  - [ ] Training converges within 10k queries

- [ ] **Hybrid Vector-Graph Retrieval:**
  - [ ] Hybrid queries ≥8x faster
  - [ ] Recall matches separate operations (≥95%)
  - [ ] Fusion weights adapt to query distribution
  - [ ] Memory overhead < 5%

- [ ] **Streaming Graph Embeddings:**
  - [ ] Single edge update < 5ms
  - [ ] Batch 100 edges < 50ms
  - [ ] Embedding quality (cosine similarity) ≥ 0.95
  - [ ] Full re-embedding triggered < 1% of time

- [ ] **Integration:**
  - [ ] Full-stack speedup ≥50x on complex hybrid queries
  - [ ] All algorithms compatible
  - [ ] No performance regressions on baseline operations

---

## Reporting Template

```markdown
# RuVector Novel Algorithms - Benchmark Report

**Date:** YYYY-MM-DD
**Commit:** abc123def
**Hardware:** [specs]

## Results Summary

| Algorithm | Target | Achieved | Status |
|-----------|--------|----------|--------|
| AG-HNSW | 30-40% faster | 37.2% faster | ✅ PASS |
| NCO | 3-7x faster | 5.8x faster | ✅ PASS |
| HVGR | 10x faster | 11.3x faster | ✅ PASS |
| SGE | 1000x faster | 1104x faster | ✅ PASS |
| **Full Stack** | **50x faster** | **68x faster** | ✅ PASS |

## Detailed Results

[Include criterion output, graphs, statistical tests]

## Quality Metrics

- AG-HNSW Recall@10: 96.2%
- NCO Plan Optimality: 94.1%
- HVGR Hybrid Recall: 97.3%
- SGE Embedding Similarity: 0.968

## Conclusion

All 4 algorithms meet or exceed performance targets while maintaining quality thresholds.
```

---

**Benchmark Status:** Ready for implementation
**Next Steps:** Integrate benchmarks into ruvector repository CI/CD
