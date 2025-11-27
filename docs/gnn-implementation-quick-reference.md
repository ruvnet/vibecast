# GNN Implementation Quick Reference for RuVector

**Quick lookup guide for implementing biomedical GNN algorithms**
**Use this as a cheat sheet during development**

---

## DGTN (Diffused Graph-Transformer Network)

### Core Formula
```rust
// Structure-guided attention diffusion
A_diffused = (1 - alpha) * A_self_attention + alpha * A_graph_normalized

// Where:
// - alpha: diffusion strength (0.2-0.5 recommended)
// - A_graph_normalized: D^(-1/2) * A * D^(-1/2)
// - D: degree matrix from HNSW adjacency
```

### Key Files to Modify
1. `ruvector-gnn/src/attention.rs` - Add `DiffusedAttention` struct
2. `ruvector-core/src/index.rs` - Add `get_adjacency_matrix()` method
3. `ruvector-gnn/src/training.rs` - Add structure preservation loss

### Hyperparameters
- **alpha:** 0.3 (balance structure vs content)
- **diffusion_steps:** 3-5 iterations
- **structure_weight:** 0.1 in loss function

### Expected Performance
- Accuracy: +9-20%
- Latency: +3-5µs (with caching)
- Memory: +10-15%

---

## Equiformer (SE(3)-Equivariant)

### Core Formula
```rust
// Equivariant message passing
m_i = Σ_j Attention(h_i, h_j) ⊗ TensorProduct(f_i, f_j, r_ij)

// Where:
// - f_i, f_j: irrep features (scalar L=0, vector L=1)
// - r_ij: directional edge vector (normalized)
// - ⊗: Clebsch-Gordan tensor product
```

### Key Files to Create
1. `ruvector-gnn/src/equivariant.rs` - New file for equivariant layers
2. `ruvector-core/src/spatial.rs` - Spatial vector DB API

### Data Structure
```rust
pub struct IrrepFeatures {
    scalar: Array2<f32>,  // L=0 (N x d)
    vector: Array3<f32>,  // L=1 (N x 3 x d)
}

pub struct SpatialVector {
    embedding: Array1<f32>,   // Standard embedding
    position: [f32; 3],       // x, y, z coordinates
}
```

### Use Cases
- Molecular 3D structure search
- Protein embeddings with secondary structure
- Point cloud similarity
- Geographic/spatial data

---

## HGT (Heterogeneous Graph Transformer)

### Core Formula
```rust
// Type-dependent attention
Q_i = W_query[node_type_i] * h_i
K_j = W_key[node_type_j] * h_j
V_j = W_value[node_type_j] * h_j

Attention[src_type][edge_type][dst_type] = softmax(Q*K^T + bias[types])
```

### Key Files to Modify
1. `ruvector-gnn/src/heterogeneous.rs` - New HGT implementation
2. `ruvector-graph/src/graph.rs` - Add type extraction from labels

### Type Registry
```rust
pub struct TypeRegistry {
    node_types: HashMap<String, usize>,  // "Drug" -> 0
    edge_types: HashMap<String, usize>,  // "BINDS_TO" -> 0
}

// Extract from existing graph labels
impl Graph {
    fn build_type_registry(&self) -> TypeRegistry {
        // Collect unique labels from nodes/edges
    }
}
```

### Example Usage
```rust
// Multi-type graph search
let types = graph.build_type_registry();
let hgt = HeterogeneousGNN::new(&types, d_model, num_heads);

// Different weights for Drug->Protein vs Protein->Disease
let results = hgt.forward(nodes, edges, features)?;
```

---

## HMSA (Hierarchical Multimodal Self-Attention)

### Core Formula
```rust
// Multi-scale aggregation
h_local = Attention_local(node, 1_hop_neighbors)
h_cluster = Attention_cluster(node, 2_3_hop_neighbors)
h_global = Attention_global(node, all_nodes)

// Gated fusion
gate = σ(W_gate * [h_local, h_cluster, h_global])
h_final = gate[0]*h_local + gate[1]*h_cluster + gate[2]*h_global
```

### Key Files to Modify
1. `ruvector-gnn/src/hierarchical.rs` - New hierarchical attention
2. `ruvector-core/src/index.rs` - Add `get_k_hop_neighbors()`

### HNSW k-hop Extraction
```rust
impl HnswIndex {
    pub fn get_k_hop_neighbors(&self, node: usize, k: usize) -> Vec<usize> {
        let mut visited = HashSet::new();
        let mut frontier = vec![node];

        for _ in 0..k {
            let mut next_frontier = vec![];
            for &n in &frontier {
                for &neighbor in self.graph.get(&n).unwrap() {
                    if !visited.contains(&neighbor) {
                        visited.insert(neighbor);
                        next_frontier.push(neighbor);
                    }
                }
            }
            frontier = next_frontier;
        }
        visited.into_iter().collect()
    }
}
```

### Hyperparameters
- **num_levels:** 3 (local, cluster, global)
- **local_hops:** 1
- **cluster_hops:** 2-3
- **fusion_hidden_dim:** d_model * 2

---

## AttentiveFP (Attentive Message Passing)

### Core Formula
```rust
// Message construction with edge features
m_ij = MLP([h_i || h_j || edge_features_ij])

// Attention aggregation
alpha_ij = softmax(LeakyReLU(a^T * [h_i || h_j]))
m_i = Σ_j alpha_ij * m_ij

// GRU update (RuVector already has this!)
h_new = GRU(h_old, m_i)
```

### Key Files to Modify
1. `ruvector-gnn/src/message_passing.rs` - Enhance existing
2. `ruvector-gnn/src/gru.rs` - Already exists, just integrate!

### Edge Features from HNSW
```rust
pub struct EdgeFeatures {
    distance: f32,     // From HNSW distance calculation
    layer: usize,      // Which HNSW layer (0, 1, 2, ...)
    weight: f32,       // Traversal frequency (learnable)
}

impl HnswIndex {
    pub fn get_edge_features(&self, src: usize, dst: usize) -> EdgeFeatures {
        EdgeFeatures {
            distance: self.compute_distance(src, dst),
            layer: self.get_common_layer(src, dst),
            weight: 1.0,  // Initialize uniform, learn later
        }
    }
}
```

### Integration (Easiest Implementation!)
```rust
// Combine existing pieces
pub struct AttentiveMPNN {
    attention: MultiHeadAttention,  // Already exists
    gru: GruCell,                   // Already exists!
    edge_mlp: MLP,                  // New: encode edge features
    message_mlp: MLP,               // New: transform messages
}

// This is the LOWEST complexity enhancement!
```

---

## Common Code Patterns

### 1. Adjacency Matrix from HNSW
```rust
impl HnswIndex {
    pub fn get_adjacency_matrix(&self, node_ids: &[usize]) -> Array2<f32> {
        let n = node_ids.len();
        let mut adj = Array2::zeros((n, n));

        for (i, &id_i) in node_ids.iter().enumerate() {
            if let Some(neighbors) = self.graph.get(&id_i) {
                for (j, &id_j) in node_ids.iter().enumerate() {
                    if neighbors.contains(&id_j) {
                        adj[[i, j]] = 1.0;
                    }
                }
            }
        }
        adj
    }
}
```

### 2. Symmetric Normalization (for DGTN)
```rust
pub fn normalize_adjacency(adj: &Array2<f32>) -> Array2<f32> {
    let degree = adj.sum_axis(Axis(1));
    let d_inv_sqrt = degree.mapv(|x| if x > 0.0 { 1.0 / x.sqrt() } else { 0.0 });
    let d_matrix = Array2::from_diag(&d_inv_sqrt);

    // D^(-1/2) * A * D^(-1/2)
    d_matrix.dot(adj).dot(&d_matrix)
}
```

### 3. Multi-Head Attention (Already in RuVector)
```rust
// ruvector-gnn/src/attention.rs - EXISTING CODE
impl MultiHeadAttention {
    pub fn forward(&self, x: &Array2<f32>) -> Result<Array2<f32>> {
        let q = x.dot(&self.weights_q);
        let k = x.dot(&self.weights_k);
        let v = x.dot(&self.weights_v);

        let scores = q.dot(&k.t()) / (self.d_model as f32).sqrt();
        let attn = softmax(&scores, Axis(1));

        Ok(attn.dot(&v))
    }
}

// Just needs enhancement, not rewrite!
```

### 4. GRU Cell (Already in RuVector)
```rust
// ruvector-gnn/src/gru.rs - EXISTING CODE
impl GruCell {
    pub fn forward(&self, h: &Array1<f32>, x: &Array1<f32>) -> Result<Array1<f32>> {
        let z = sigmoid(&(self.w_z.dot(&concat![Axis(0), h, x])));  // Update gate
        let r = sigmoid(&(self.w_r.dot(&concat![Axis(0), h, x])));  // Reset gate
        let h_tilde = tanh(&(self.w_h.dot(&concat![Axis(0), &(r * h), x])));

        Ok((1.0 - &z) * h + &z * &h_tilde)
    }
}

// Perfect for message passing - already implemented!
```

### 5. Type Extraction from Graph Labels
```rust
impl Graph {
    pub fn extract_node_types(&self) -> HashMap<NodeId, usize> {
        let mut type_map = HashMap::new();
        let mut label_to_id = HashMap::new();
        let mut next_id = 0;

        for (node_id, node) in &self.nodes {
            // Use first label as primary type
            let label = node.labels.first().unwrap_or(&"Unknown".to_string());

            let type_id = *label_to_id.entry(label.clone()).or_insert_with(|| {
                let id = next_id;
                next_id += 1;
                id
            });

            type_map.insert(*node_id, type_id);
        }

        type_map
    }
}
```

---

## Training Fixes (CRITICAL)

### Fix 1: Optimizer Step (Currently unimplemented!)
```rust
// ruvector-gnn/src/training.rs - LINE 36
// BEFORE:
impl Optimizer for Sgd {
    fn step(&mut self, params: &mut Array2<f32>, grads: &Array2<f32>) -> Result<()> {
        unimplemented!("TODO: Implement optimizer step")  // ❌ BROKEN
    }
}

// AFTER:
impl Optimizer for Sgd {
    fn step(&mut self, params: &mut Array2<f32>, grads: &Array2<f32>) -> Result<()> {
        *params = &*params - self.learning_rate * grads;  // ✅ FIXED
        Ok(())
    }
}
```

### Fix 2: Loss Computation (Currently unimplemented!)
```rust
// ruvector-gnn/src/training.rs - LINE 57
// BEFORE:
impl InfoNceLoss {
    pub fn compute(&self, embeddings: &Array2<f32>) -> Result<f32> {
        unimplemented!("TODO: Implement loss computation")  // ❌ BROKEN
    }
}

// AFTER:
impl InfoNceLoss {
    pub fn compute(&self, embeddings: &Array2<f32>, labels: &Array1<usize>) -> Result<f32> {
        let n = embeddings.nrows();
        let mut loss = 0.0;

        for i in 0..n {
            let anchor = embeddings.row(i);
            let mut pos_sim = 0.0;
            let mut neg_sims = vec![];

            for j in 0..n {
                if i == j { continue; }
                let sim = cosine_similarity(&anchor, &embeddings.row(j));

                if labels[i] == labels[j] {
                    pos_sim = sim;  // Positive pair
                } else {
                    neg_sims.push(sim);  // Negative pairs
                }
            }

            // InfoNCE: -log(exp(pos) / (exp(pos) + Σ exp(neg)))
            let pos_exp = (pos_sim / self.temperature).exp();
            let neg_sum: f32 = neg_sims.iter()
                .map(|&s| (s / self.temperature).exp())
                .sum();

            loss -= (pos_exp / (pos_exp + neg_sum)).ln();
        }

        Ok(loss / n as f32)  // ✅ FIXED
    }
}
```

---

## Performance Benchmarks to Track

### Accuracy Metrics
```rust
// Test on these datasets
let datasets = vec![
    "PubMed citation graph",      // 19M nodes, 44M edges
    "PrimeKG biomedical KG",      // 129K nodes, 4M edges
    "QM9 molecular properties",   // 134K molecules
    "BindingDB drug-target",      // 52K compounds
];

// Target improvements
let targets = HashMap::from([
    ("search_accuracy", 0.15..0.25),  // +15-25%
    ("ranking_ndcg", 0.10..0.20),     // +10-20%
    ("latency_overhead", 0.0..0.10),  // <10%
]);
```

### Latency Breakdown
```rust
// Measure each component
let timings = HashMap::from([
    ("hnsw_search", 61_000),          // 61µs (baseline)
    ("adjacency_extract", 5_000),     // 5µs (DGTN)
    ("diffusion_step", 3_000),        // 3µs x 3 steps = 9µs
    ("gnn_forward", 10_000),          // 10µs (AttentiveFP)
    ("total_with_gnn", 85_000),       // 85µs (+24µs = +39%)
]);

// Optimization target: <75µs (+14µs = +23%)
```

---

## Testing Checklist

### Unit Tests (per algorithm)
- ✅ Adjacency matrix extraction (DGTN)
- ✅ Symmetric normalization (DGTN)
- ✅ Diffusion convergence (DGTN)
- ✅ Type-specific attention (HGT)
- ✅ k-hop neighborhood (HMSA)
- ✅ Edge feature encoding (AttentiveFP)
- ✅ Tensor product correctness (Equiformer)

### Integration Tests
- ✅ HNSW + DGTN end-to-end search
- ✅ Graph DB + HGT multi-type query
- ✅ Training loop with fixed optimizer
- ✅ Distributed GNN training (after Raft fix)

### Benchmark Tests
- ✅ Search accuracy on PubMed graph
- ✅ Latency regression (must stay <100µs)
- ✅ Memory usage (<2x baseline)
- ✅ Throughput (QPS degradation <20%)

---

## Quick Start: Implement DGTN (Highest Priority)

### Step 1: Add adjacency extraction (30 min)
```rust
// ruvector-core/src/index.rs
impl HnswIndex {
    pub fn get_adjacency_matrix(&self, ids: &[VectorId]) -> Array2<f32> {
        // Copy code from "Common Patterns" section above
    }
}
```

### Step 2: Create diffused attention (1-2 hours)
```rust
// ruvector-gnn/src/diffused.rs (new file)
pub struct DiffusedAttention {
    attention: MultiHeadAttention,  // Reuse existing
    alpha: f32,
    diffusion_steps: usize,
}

impl DiffusedAttention {
    pub fn forward_with_structure(
        &self,
        x: &Array2<f32>,
        adj: &Array2<f32>,
    ) -> Result<Array2<f32>> {
        // 1. Standard attention
        let a_self = self.attention.forward(x)?;

        // 2. Normalize adjacency
        let a_norm = normalize_adjacency(adj);

        // 3. Diffuse
        let mut a_diffused = a_self.clone();
        for _ in 0..self.diffusion_steps {
            a_diffused = (1.0 - self.alpha) * &a_diffused + self.alpha * &a_norm;
        }

        Ok(a_diffused)
    }
}
```

### Step 3: Add to search (1 hour)
```rust
// ruvector-gnn/src/differentiable.rs
impl DifferentiableSearch {
    pub fn search_with_dgtn(
        &self,
        query: &Array1<f32>,
        k: usize,
        hnsw: &HnswIndex,
    ) -> Result<Vec<SearchResult>> {
        // Get candidates from HNSW
        let candidates = hnsw.search(query, k * 2)?;
        let ids: Vec<_> = candidates.iter().map(|r| r.id).collect();

        // Extract adjacency
        let adj = hnsw.get_adjacency_matrix(&ids);

        // Extract features
        let features = self.gather_features(&ids)?;

        // Apply DGTN
        let enhanced = self.dgtn.forward_with_structure(&features, &adj)?;

        // Re-rank
        self.rerank_with_features(query, &ids, &enhanced, k)
    }
}
```

### Step 4: Test (30 min)
```rust
#[test]
fn test_dgtn_search() {
    let db = create_test_db_with_graph();
    let query = random_vector(384);

    let baseline = db.search(&query, 10)?;
    let dgtn = db.search_with_dgtn(&query, 10)?;

    // DGTN should improve relevance
    assert!(dgtn_accuracy > baseline_accuracy);
}
```

**Total Time: 3-4 hours for basic DGTN!**

---

## Common Pitfalls & Solutions

### Pitfall 1: Numerical Instability in Attention
```rust
// ❌ BAD: Can overflow with large similarities
let scores = q.dot(&k.t()) / sqrt(d);
let attn = scores.mapv(|x| x.exp());

// ✅ GOOD: Subtract max for stability
let scores = q.dot(&k.t()) / sqrt(d);
let max_score = scores.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
let attn = scores.mapv(|x| (x - max_score).exp());
```

### Pitfall 2: Adjacency Matrix Sparsity
```rust
// ❌ BAD: Dense N x N matrix for large graphs
let adj = Array2::zeros((100000, 100000));  // 40 GB!

// ✅ GOOD: Use sparse representation or batch processing
let adj_sparse = CsrMatrix::new((n, n), edges);
// Or: Process in batches of 1000-5000 nodes
```

### Pitfall 3: Type Mismatch in HGT
```rust
// ❌ BAD: Assume all nodes have same type
let w = self.weights_q[0];  // Always use type 0

// ✅ GOOD: Look up actual node type
let node_type = self.type_registry.get_type(node_id);
let w = self.weights_q[node_type];
```

### Pitfall 4: Forgetting Gradient Clipping
```rust
// ❌ BAD: Can explode with deep GNNs
optimizer.step(params, grads);

// ✅ GOOD: Clip gradients
let grads_clipped = clip_gradients(grads, max_norm=1.0);
optimizer.step(params, &grads_clipped);
```

---

## Debugging Tips

### Check Adjacency Matrix
```rust
fn debug_adjacency(adj: &Array2<f32>) {
    let density = adj.iter().filter(|&&x| x > 0.0).count() as f32 / adj.len() as f32;
    println!("Adjacency density: {:.2}%", density * 100.0);
    println!("Avg degree: {:.2}", adj.sum_axis(Axis(1)).mean().unwrap());
    // Should see: density 0.1-5%, avg degree 5-50 for realistic graphs
}
```

### Visualize Attention Weights
```rust
fn debug_attention(attn: &Array2<f32>) {
    // Check if attention is too uniform (poor learning)
    let entropy = -attn.mapv(|p| if p > 0.0 { p * p.ln() } else { 0.0 }).sum();
    println!("Attention entropy: {:.2}", entropy);
    // Low entropy (<0.1) = focused, High entropy (>2.0) = uniform
}
```

### Monitor Training Metrics
```rust
fn debug_training_step(loss: f32, grads: &Array2<f32>, params: &Array2<f32>) {
    println!("Loss: {:.4}", loss);
    println!("Grad norm: {:.4}", grads.mapv(|x| x.powi(2)).sum().sqrt());
    println!("Param norm: {:.4}", params.mapv(|x| x.powi(2)).sum().sqrt());
    println!("Grad/Param ratio: {:.4}", grad_norm / param_norm);
    // Should see: ratio 0.001-0.1 for stable training
}
```

---

## Summary: Implementation Priority

### ⚡ URGENT (Fix Broken Code)
1. **training.rs optimizer.step** - 30 min
2. **training.rs loss.compute** - 1 hour
3. **Raft RPC responses** - 2 hours

### 🚀 HIGH VALUE (Quick Wins)
1. **AttentiveFP integration** - 4 hours
2. **DGTN diffused attention** - 4-6 hours
3. **Edge features in HNSW** - 2 hours

### 🎯 STRATEGIC (Competitive Advantage)
1. **HGT heterogeneous** - 10-12 days
2. **HMSA hierarchical** - 6-8 days

### 🔬 ADVANCED (New Markets)
1. **Equiformer 3D** - 15-20 days
2. **Meta-learning** - 10-15 days

---

**Total Estimated Time to Production-Ready GNN:**
- Critical fixes: **1 day**
- Core enhancements (DGTN + AttentiveFP): **2-3 days**
- Full biomedical GNN suite: **6-8 weeks**

**ROI:**
- Development: 8 weeks
- Market differentiation: Only vector DB with biomedical GNN
- TAM: $100B+ (pharma, healthcare, scientific computing)

---

For detailed explanations, see:
- 📄 Main Report: `/home/user/vibecast/docs/biomedical-gnn-research-report.md`
- 📊 Executive Summary: `/home/user/vibecast/docs/gnn-research-executive-summary.md`
