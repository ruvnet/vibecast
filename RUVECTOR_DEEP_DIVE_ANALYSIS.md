# RuVector v0.1.26 Deep Dive Analysis

## Bounding, Pruning, Anti-Overfitting & Hidden Discoveries

**Analysis Date:** December 1, 2025
**Source Analysis:** Rust source code, NAPI bindings, crate documentation

---

## Table of Contents

1. [HNSW Bounding & Pruning Mechanisms](#1-hnsw-bounding--pruning-mechanisms)
2. [Anti-Overfitting & Regularization Systems](#2-anti-overfitting--regularization-systems)
3. [Hidden Training Infrastructure](#3-hidden-training-infrastructure)
4. [Undiscovered Attention Mechanisms](#4-undiscovered-attention-mechanisms)
5. [Compression Algorithm Deep Dive](#5-compression-algorithm-deep-dive)
6. [Streaming & Batch Processing Architecture](#6-streaming--batch-processing-architecture)
7. [Emergent Mathematical Properties](#7-emergent-mathematical-properties)
8. [Architecture Diagrams](#8-architecture-diagrams)

---

## 1. HNSW Bounding & Pruning Mechanisms

### 1.1 HNSW Configuration Parameters

The core HNSW implementation exposes critical bounding parameters:

```rust
pub interface HnswConfig {
    m: number;              // Number of connections per layer (default: 16)
    efConstruction: number; // Dynamic candidate list during construction (default: 200)
    efSearch: number;       // Dynamic candidate list during search (default: 50)
    maxElements: number;    // Maximum capacity bound
}
```

```
                    HNSW Layer Structure with Bounding
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Layer 2 (Sparse)     M_max = M/2 connections                          │
│  ┌─────┐                        ┌─────┐                                │
│  │  A  │────────────────────────│  B  │                                │
│  └──┬──┘                        └──┬──┘                                │
│     │                              │                                    │
│     │  PRUNING: Select M best     │                                    │
│     │  from ef_construction       │                                    │
│     ▼  candidates                 ▼                                    │
│  Layer 1 (Medium)    M_max = M connections                             │
│  ┌─────┐───┌─────┐───┌─────┐───┌─────┐───┌─────┐                      │
│  │  A  │   │  C  │   │  D  │   │  B  │   │  E  │                      │
│  └──┬──┘   └──┬──┘   └──┬──┘   └──┬──┘   └──┬──┘                      │
│     │        │        │        │        │                              │
│     │        │        │        │        │                              │
│     ▼        ▼        ▼        ▼        ▼                              │
│  Layer 0 (Dense)     M_max = 2*M connections                           │
│  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐                    │
│  │ ● │ ● │ ● │ ● │ ● │ ● │ ● │ ● │ ● │ ● │ ● │ ● │  All vectors      │
│  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘                    │
│                                                                         │
│  Bounding Constraints:                                                  │
│  • Layer probability: 1/ln(M) per vector                               │
│  • Max neighbors: 2*M at layer 0, M at higher layers                   │
│  • ef_construction bounds candidate exploration                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Pruning Algorithm: Heuristic Neighbor Selection

The HNSW implementation uses **SELECT-NEIGHBORS-HEURISTIC** for connection pruning:

```
Algorithm: Select-Neighbors-Heuristic (Pruning)
═══════════════════════════════════════════════

Input:
  - candidates: Set of potential neighbors (size: ef_construction)
  - M: Maximum connections allowed
  - extend_candidates: bool (extend by neighbors of candidates)
  - keep_pruned: bool (add some pruned to return set)

Process:
  1. If extend_candidates:
     - For each c in candidates:
       - Add neighbors(c) to candidates (diversity boost)

  2. Sort candidates by distance to query point

  3. PRUNING LOOP:
     result = []
     for c in sorted_candidates:
       if len(result) >= M:
         break

       # HEURISTIC: Only add if c is closer to query
       # than to any existing result (prevents clustering)
       good = true
       for r in result:
         if distance(c, r) < distance(c, query):
           good = false  # c is closer to r than query
           break

       if good:
         result.append(c)

  4. If keep_pruned and len(result) < M:
     - Add remaining candidates until M reached

Output: Pruned neighbor set (max size: M)
```

### 1.3 Distance Metric Bounding

```typescript
export declare enum DistanceMetric {
    Euclidean = "Euclidean",    // L2 norm, bounded [0, ∞)
    Cosine = "Cosine",          // 1 - cosine_sim, bounded [0, 2]
    DotProduct = "DotProduct",  // Negated for minimization
    Manhattan = "Manhattan"     // L1 norm, bounded [0, ∞)
}
```

**Bounds Applied During Search:**
- Early termination when `ef` best candidates found
- Distance threshold filtering (configurable)
- Layer-skip optimization for distant queries

---

## 2. Anti-Overfitting & Regularization Systems

### 2.1 Spectral Regularization

Discovered in `/src/training.rs`:

```rust
/// Spectral regularization for smooth representations
pub struct SpectralRegularization {
    weight: f32,
}

impl SpectralRegularization {
    /// Compute spectral regularization for a batch of embeddings
    /// Constrains eigenvalue distribution to prevent feature collapse
    pub fn compute_batch(&self, embeddings: &[&[f32]]) -> f64;
}
```

```
            Spectral Regularization Mechanism
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Embedding Matrix E (n × d)                                │
│  ┌─────────────────────────┐                               │
│  │  e₁  e₂  e₃  ...  eₙ   │                               │
│  └─────────────────────────┘                               │
│              │                                              │
│              ▼                                              │
│  Compute Covariance: C = E^T E / n                         │
│              │                                              │
│              ▼                                              │
│  Eigenvalue Decomposition: C = V Λ V^T                     │
│              │                                              │
│              ▼                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Regularization Loss = weight × variance(eigenvalues)│   │
│  │                                                       │   │
│  │  Goal: Encourage uniform eigenvalue distribution     │   │
│  │        Prevents collapse to low-rank representations │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Dropout in GNN Layers

```rust
impl RuvectorLayer {
    pub fn new(input_dim: usize, hidden_dim: usize, heads: usize, dropout: f32) {
        // dropout must be between 0.0 and 1.0
        // Applied during forward pass to attention weights
    }
}
```

### 2.3 Elastic Weight Consolidation (EWC)

**DISCOVERED: Anti-catastrophic-forgetting mechanism**

From `ruvector-gnn` crate documentation:

```
            Elastic Weight Consolidation (EWC)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Purpose: Prevent catastrophic forgetting in continual     │
│           learning scenarios                                │
│                                                             │
│  Mechanism:                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  L_total = L_new_task + λ Σᵢ Fᵢ(θᵢ - θ*ᵢ)²          │   │
│  │                                                       │   │
│  │  Where:                                               │   │
│  │    Fᵢ = Fisher information for parameter i           │   │
│  │    θ*ᵢ = optimal parameter from previous task        │   │
│  │    λ = consolidation strength                        │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Effect: Parameters important for old tasks resist change  │
│                                                             │
│  Fisher Information Computation:                            │
│    Fᵢ = E[(∂L/∂θᵢ)²]  (diagonal approximation)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Replay Buffer with Reservoir Sampling

```
            Experience Replay Architecture
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Incoming Data Stream                                       │
│  ────────────────────▶                                      │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Reservoir Sampling Algorithm               │   │
│  │                                                       │   │
│  │  for i, sample in enumerate(stream):                 │   │
│  │    if len(buffer) < capacity:                        │   │
│  │      buffer.append(sample)                           │   │
│  │    else:                                              │   │
│  │      j = random(0, i)                                 │   │
│  │      if j < capacity:                                 │   │
│  │        buffer[j] = sample                             │   │
│  │                                                       │   │
│  │  Property: Uniform coverage guarantee                │   │
│  └─────────────────────────────────────────────────────┘   │
│           │                                                 │
│           ▼                                                 │
│  ┌───────────────────────────┐                             │
│  │     Replay Buffer         │                             │
│  │  ┌───┬───┬───┬───┬───┐   │                             │
│  │  │ s₁│ s₂│ s₃│...│ sₙ│   │  Uniformly sampled history │
│  │  └───┴───┴───┴───┴───┘   │                             │
│  └───────────────────────────┘                             │
│           │                                                 │
│           ▼                                                 │
│  Mixed Training: α × new_batch + (1-α) × replay_batch      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Hidden Training Infrastructure

### 3.1 Complete Optimizer Suite

Discovered in `training.rs`:

| Optimizer | Features | Use Case |
|-----------|----------|----------|
| **SGD** | Momentum, Weight Decay, Nesterov | Simple training |
| **Adam** | Bias Correction, β₁=0.9, β₂=0.999 | General purpose |
| **AdamW** | Decoupled Weight Decay | Transformer training |

```rust
// SGD with all options
SGDOptimizer::with_weight_decay(param_count, lr, momentum, weight_decay)

// Adam with custom betas
AdamOptimizer::with_betas(param_count, lr, beta1, beta2)

// AdamW (recommended for transformers)
AdamWOptimizer::with_betas(param_count, lr, weight_decay, beta1, beta2)
```

### 3.2 Learning Rate Scheduling

```
            Learning Rate Schedule (Warmup + Cosine Decay)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  LR │                                                       │
│     │         ╱╲                                            │
│  max│────────╱  ╲                                           │
│     │      ╱     ╲                                          │
│     │    ╱        ╲                                         │
│     │  ╱           ╲                                        │
│     │╱ Warmup       ╲ Cosine Decay                         │
│  min│                 ╲_______________                      │
│     │                                                       │
│     └───────────────────────────────────────────────▶ Steps │
│       │        │                                   │        │
│       0    warmup_steps                     total_steps     │
│                                                             │
│  Formula:                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ if step < warmup:                                    │   │
│  │   lr = initial_lr × (step + 1) / warmup_steps       │   │
│  │ else:                                                │   │
│  │   progress = (step - warmup) / (total - warmup)     │   │
│  │   decay = 0.5 × (1 + cos(π × progress))             │   │
│  │   lr = min_lr + (initial_lr - min_lr) × decay       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Temperature Annealing

Four decay types discovered:

```rust
pub enum DecayType {
    Linear,      // T(t) = T₀ - (T₀ - T_f) × t/steps
    Exponential, // T(t) = T₀ × (T_f/T₀)^(t/steps)
    Cosine,      // T(t) = T_f + (T₀-T_f) × 0.5(1+cos(πt/steps))
    Step,        // T(t) = T₀ × γ^(floor(t/step_size))
}
```

### 3.4 Curriculum Learning System

```
            Curriculum Learning Pipeline
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Stage 1: "easy"           Stage 2: "medium"               │
│  ┌─────────────────┐       ┌─────────────────┐             │
│  │ difficulty: 0.2 │ ────▶ │ difficulty: 0.5 │             │
│  │ temperature: 1.0│       │ temperature: 0.5│             │
│  │ negatives: 4    │       │ negatives: 8    │             │
│  │ duration: 1000  │       │ duration: 2000  │             │
│  └─────────────────┘       └─────────────────┘             │
│                                   │                         │
│                                   ▼                         │
│                            Stage 3: "hard"                  │
│                            ┌─────────────────┐             │
│                            │ difficulty: 1.0 │             │
│                            │ temperature: 0.1│             │
│                            │ negatives: 16   │             │
│                            │ duration: 3000  │             │
│                            └─────────────────┘             │
│                                                             │
│  Properties controlled per stage:                           │
│  • difficulty: Sample selection criteria                    │
│  • temperature: Softmax sharpness                          │
│  • negative_count: Contrastive samples per positive        │
│  • duration: Training steps at this stage                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Undiscovered Attention Mechanisms

### 4.1 Hidden Attention Types (Not in CLI)

From source analysis, these attention mechanisms exist but aren't exposed in CLI benchmark:

```rust
// Core (exposed)
DotProductAttention
MultiHeadAttention
FlashAttention
LinearAttention
HyperbolicAttention
MoEAttention

// Graph (partially exposed)
GraphRoPEAttention      // Rotary Position Embeddings for graphs
EdgeFeaturedAttention   // GATv2-style edge features
DualSpaceAttention      // Euclidean + Hyperbolic combined
LocalGlobalAttention    // Longformer-style sparse pattern

// Hidden (not in CLI)
MixedCurvatureAttention // Variable curvature per region
```

### 4.2 Edge-Featured Attention (GATv2-style)

```rust
pub struct EdgeFeaturedConfig {
    node_dim: usize,
    edge_dim: usize,
    num_heads: usize,
    concat_heads: bool,      // Concatenate or average heads
    add_self_loops: bool,    // Include self-attention
    negative_slope: f32,     // LeakyReLU slope (default: 0.2)
    dropout: f32,
}
```

```
            Edge-Featured Attention Computation
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Node Features: h_i, h_j                                   │
│  Edge Feature: e_ij                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  a_ij = LeakyReLU(W · concat(h_i, h_j, e_ij))       │   │
│  │                                                       │   │
│  │  α_ij = softmax_j(a_ij)                              │   │
│  │                                                       │   │
│  │  h'_i = σ(Σⱼ α_ij · W_v · h_j)                       │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Key difference from standard attention:                    │
│  - Edge features e_ij influence attention weights          │
│  - Enables relationship-aware message passing              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Graph RoPE (Rotary Position Embeddings)

```rust
pub struct RoPEConfig {
    dim: usize,
    max_position: usize,    // Max graph distance
    base: f32,              // Base for frequency (default: 10000)
    scaling_factor: f32,    // For extended contexts
}

impl GraphRoPEAttention {
    // Convert graph hop distance to position bucket
    pub fn distance_to_position(distance: usize, max_distance: usize) -> usize;

    // Apply rotary embedding based on graph position
    pub fn apply_rotary(&self, vector: &[f32], position: usize) -> Vec<f32>;
}
```

### 4.4 Dual-Space Attention

```
            Dual-Space (Euclidean + Hyperbolic) Attention
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Query q, Keys K = {k₁, k₂, ..., kₙ}                       │
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │  Euclidean Space    │    │  Hyperbolic Space   │        │
│  │                     │    │  (Poincaré Ball)    │        │
│  │  d_E(q, k) = ||q-k||│    │  d_H(q, k) = arccosh│        │
│  │                     │    │                     │        │
│  │  s_E = softmax(-d_E)│    │  s_H = softmax(-d_H)│        │
│  └──────────┬──────────┘    └──────────┬──────────┘        │
│             │                          │                    │
│             ▼                          ▼                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  Combined Scores = w_E × s_E + w_H × s_H            │   │
│  │                                                       │   │
│  │  Where: w_E = euclidean_weight (configurable)       │   │
│  │         w_H = hyperbolic_weight (configurable)      │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│             │                                               │
│             ▼                                               │
│  Output = Σᵢ combined_score_i × v_i                        │
│                                                             │
│  Use Case: Hierarchical data with both local & global      │
│            structure (taxonomies, ontologies)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Compression Algorithm Deep Dive

### 5.1 Product Quantization (PQ8 & PQ4)

```
            Product Quantization Architecture
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Original Vector (384 dimensions)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ v₁ v₂ v₃ ... v₃₈₄ │                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│              │                                              │
│              ▼ Split into subvectors                        │
│  ┌────────┬────────┬────────┬─────┬────────┐              │
│  │ Sub₁   │ Sub₂   │ Sub₃   │ ... │ Sub₈   │  8 subvectors │
│  │ (48d)  │ (48d)  │ (48d)  │     │ (48d)  │              │
│  └────┬───┴────┬───┴────┬───┴─────┴────┬───┘              │
│       │        │        │              │                    │
│       ▼        ▼        ▼              ▼                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Codebook Lookup (16 centroids each)          │   │
│  │                                                       │   │
│  │  PQ8: 8-bit codes (256 centroids) → ~8x compression  │   │
│  │  PQ4: 4-bit codes (16 centroids)  → ~16x compression │   │
│  └─────────────────────────────────────────────────────┘   │
│       │        │        │              │                    │
│       ▼        ▼        ▼              ▼                    │
│  ┌────────┬────────┬────────┬─────┬────────┐              │
│  │ code₁  │ code₂  │ code₃  │ ... │ code₈  │  8 bytes     │
│  │ (1B)   │ (1B)   │ (1B)   │     │ (1B)   │  total       │
│  └────────┴────────┴────────┴─────┴────────┘              │
│                                                             │
│  PQ4 Additional: Outlier threshold for extreme values      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ if |value| > outlier_threshold (default: 3.0):       │   │
│  │   store as exception with full precision             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Adaptive Compression Selection

```rust
pub fn get_compression_level(access_freq: f64) -> String {
    if access_freq > 0.8 {
        "none"      // Hot data: full f32 precision
    } else if access_freq > 0.4 {
        "half"      // Warm data: f16 (~2x compression)
    } else if access_freq > 0.1 {
        "pq8"       // Cool data: 8-bit PQ (~8x compression)
    } else if access_freq > 0.01 {
        "pq4"       // Cold data: 4-bit PQ (~16x compression)
    } else {
        "binary"    // Archive: binary quantization (~32x compression)
    }
}
```

```
            Compression Level Decision Tree
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Access Frequency (0.0 - 1.0)                               │
│                                                             │
│     1.0 ─┬─────────────────────────────────────────────┐   │
│          │                          NONE (f32)          │   │
│     0.8 ─┤   Hot Data: Real-time queries               │   │
│          │   - Full precision                           │   │
│          │   - 4 bytes per dimension                    │   │
│          ├─────────────────────────────────────────────┤   │
│          │                          HALF (f16)          │   │
│     0.4 ─┤   Warm Data: Regular access                 │   │
│          │   - ~2x compression                          │   │
│          │   - 2 bytes per dimension                    │   │
│          ├─────────────────────────────────────────────┤   │
│          │                          PQ8 (8-bit)         │   │
│     0.1 ─┤   Cool Data: Occasional access              │   │
│          │   - ~8x compression                          │   │
│          │   - 1 byte per 8 subvectors                  │   │
│          ├─────────────────────────────────────────────┤   │
│          │                          PQ4 (4-bit)         │   │
│    0.01 ─┤   Cold Data: Rare access                    │   │
│          │   - ~16x compression                         │   │
│          │   - 0.5 bytes per 8 subvectors               │   │
│          ├─────────────────────────────────────────────┤   │
│          │                          BINARY              │   │
│     0.0 ─┤   Archive: Very rare access                 │   │
│          │   - ~32x compression                         │   │
│          │   - 1 bit per dimension                      │   │
│          └─────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Streaming & Batch Processing Architecture

### 6.1 StreamProcessor (Hidden Feature)

```rust
pub struct StreamProcessor {
    dim: usize,
    buffer: Vec<Vec<f32>>,
    max_buffer_size: usize,
}

impl StreamProcessor {
    pub fn push(&mut self, vector: Float32Array) -> bool;
    pub fn process(&self, query: Float32Array) -> Result<Float32Array>;
    pub fn clear(&mut self);
    pub fn size(&self) -> u32;
    pub fn is_full(&self) -> bool;
}
```

```
            Streaming Attention Pipeline
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Incoming Vector Stream                                     │
│  ══════════════════▶                                        │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              StreamProcessor                         │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │             Bounded Buffer                     │   │   │
│  │  │  ┌───┬───┬───┬───┬───┬───┬───┬───┐          │   │   │
│  │  │  │ v₁│ v₂│ v₃│ v₄│ v₅│ v₆│ v₇│ v₈│ max=1024 │   │   │
│  │  │  └───┴───┴───┴───┴───┴───┴───┴───┘          │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │                     │                                 │   │
│  │                     ▼                                 │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │   push() returns false when full              │   │   │
│  │  │   → Triggers process() with query             │   │   │
│  │  │   → Attention over buffered vectors           │   │   │
│  │  │   → clear() and continue                      │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Use Case: Processing large document collections           │
│            without loading all into memory                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Async Batch Processing

```rust
// Parallel attention computation
pub async fn parallel_attention_compute(
    config: ParallelConfig,
    queries: Vec<Float32Array>,
    keys: Vec<Vec<Float32Array>>,
    values: Vec<Vec<Float32Array>>,
) -> Result<BatchResult>;

// Returns:
pub struct BatchResult {
    outputs: Vec<Float32Array>,
    elapsed_ms: f64,
    throughput: f64,  // queries per second
}
```

---

## 7. Emergent Mathematical Properties

### 7.1 Hyperbolic Geometry Emergent Behaviors

```
            Poincaré Ball Emergent Structure
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Property: Hierarchical Distance Amplification              │
│                                                             │
│           ╭────────────────────────────────╮                │
│          ╱  boundary: infinite distance   ╲                │
│         │    from origin                    │               │
│         │        ↑                          │               │
│         │   ● leaves (specialized)          │               │
│         │   ●●                              │               │
│         │    ● branches                     │               │
│         │     ●●                            │               │
│         │      ● root concepts              │               │
│         │       ●                           │               │
│         │     origin                        │               │
│          ╲                                 ╱                │
│           ╰────────────────────────────────╯                │
│                                                             │
│  Emergent Behavior:                                         │
│  • Points naturally stratify by specificity                 │
│  • General concepts cluster near origin                     │
│  • Specific concepts pushed to boundary                     │
│  • Tree-like structures form automatically                  │
│                                                             │
│  Mathematical basis:                                        │
│  • Distance grows exponentially near boundary               │
│  • d_H(x,y) = arccosh(1 + 2||x-y||²/((1-||x||²)(1-||y||²)))│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Soft Attention Temperature Effects

```
            Temperature-Controlled Attention Distribution
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Query: q, Keys: K = {k₁, k₂, k₃, k₄, k₅}                  │
│  Similarities: [0.9, 0.7, 0.3, 0.05, 0.02]                 │
│                                                             │
│  T = 1.0 (Normal)        T = 0.1 (Sharp)                   │
│  ┌─────────────────┐     ┌─────────────────┐               │
│  │████ 35%         │     │████████████ 99% │ ← k₁         │
│  │███  28%         │     │  <1%            │ ← k₂         │
│  │██   20%         │     │  <1%            │ ← k₃         │
│  │█    10%         │     │  <1%            │ ← k₄         │
│  │     7%          │     │  <1%            │ ← k₅         │
│  └─────────────────┘     └─────────────────┘               │
│                                                             │
│  T = 10.0 (Flat)                                           │
│  ┌─────────────────┐                                       │
│  │██   22%         │ ← k₁                                  │
│  │██   21%         │ ← k₂                                  │
│  │██   20%         │ ← k₃                                  │
│  │█    19%         │ ← k₄                                  │
│  │█    18%         │ ← k₅                                  │
│  └─────────────────┘                                       │
│                                                             │
│  Emergent Property:                                         │
│  • Low T → winner-take-all (argmax-like)                   │
│  • High T → uniform averaging                               │
│  • Medium T → soft selection with diversity                 │
│                                                             │
│  Training Insight:                                          │
│  Start with high T (exploration) → Anneal to low T (focus) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Differentiable Search Gradients

```
            Gradient Flow Through Soft Search
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Traditional Search: Hard selection (no gradients)          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  indices = argmax(similarities)                      │   │
│  │  ∂indices/∂query = 0  (undefined gradient)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Differentiable Search: Soft selection (gradients flow)     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  weights = softmax(similarities / temperature)       │   │
│  │                                                       │   │
│  │  output = Σᵢ weights[i] × candidates[i]             │   │
│  │                                                       │   │
│  │  ∂output/∂query = Σᵢ ∂weights[i]/∂query × candidates[i]│ │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Emergent Capability:                                       │
│  • End-to-end training through retrieval                   │
│  • Query encoder learns from retrieval quality             │
│  • Index vectors can be fine-tuned                         │
│  • Enables retrieval-augmented training                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Architecture Diagrams

### 8.1 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RuVector Complete Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         User Layer                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │   CLI/npx   │  │  Node.js    │  │    Rust     │  │   Python    │ │   │
│  │  │  ruvector   │  │   import    │  │  use crate  │  │   (WASM)    │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼─────────┘   │
│            │                │                │                │              │
│            ▼                ▼                ▼                ▼              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Binding Layer (NAPI-RS)                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Platform Detection → Native Binary Loading → FFI Marshalling   │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Core Layer (Rust)                             │   │
│  │                                                                        │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │  ruvector-core  │  │  ruvector-gnn   │  │ruvector-attention│      │   │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │       │   │
│  │  │  │   HNSW    │  │  │  │   GNN     │  │  │  │   Flash   │  │       │   │
│  │  │  │  Index    │  │  │  │  Layers   │  │  │  │ Attention │  │       │   │
│  │  │  ├───────────┤  │  │  ├───────────┤  │  │  ├───────────┤  │       │   │
│  │  │  │   SIMD    │  │  │  │  Tensor   │  │  │  │Hyperbolic │  │       │   │
│  │  │  │ Distance  │  │  │  │ Compress  │  │  │  │  Geometry │  │       │   │
│  │  │  ├───────────┤  │  │  ├───────────┤  │  │  ├───────────┤  │       │   │
│  │  │  │Quantize   │  │  │  │  Search   │  │  │  │  Training │  │       │   │
│  │  │  │(PQ4/PQ8)  │  │  │  │  (Diff)   │  │  │  │  Infra    │  │       │   │
│  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │       │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │               Anti-Overfitting Subsystem                         │ │   │
│  │  │  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │ │   │
│  │  │  │   Spectral   │     EWC      │   Replay     │   Dropout    │  │ │   │
│  │  │  │    Reg.      │  (Continual) │   Buffer     │   (GNN)      │  │ │   │
│  │  │  └──────────────┴──────────────┴──────────────┴──────────────┘  │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                  Training Infrastructure                         │ │   │
│  │  │  ┌────────────┬────────────┬────────────┬─────────────────────┐ │ │   │
│  │  │  │ Optimizers │  LR Sched  │ Curriculum │  Negative Mining    │ │ │   │
│  │  │  │SGD/Adam/W  │Warmup+Cos  │ Easy→Hard  │Hard/Semi/Distance   │ │ │   │
│  │  │  └────────────┴────────────┴────────────┴─────────────────────┘ │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Distributed Layer (Planned)                        │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │  ruvector-raft  │  │ruvector-cluster │  │ ruvector-repl   │       │   │
│  │  │   Consensus     │  │   Sharding      │  │   Replication   │       │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Negative Mining Strategy Comparison

```
                    Negative Mining Strategies
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Anchor: ★  Positive: ● (green)  Negatives: ○ (selected) ◦ (not selected)  │
│                                                                              │
│  RANDOM                    HARD NEGATIVE              SEMI-HARD             │
│  ────────                  ─────────────              ──────────            │
│  ◦     ○                  ○  ◦                       ◦                      │
│     ◦                        ◦                          ○  ◦                │
│  ◦       ○                      ○                          ○                │
│     ★ ●                       ★ ●                        ★ ●                │
│        ◦                   ◦                         ◦                      │
│     ○                         ◦                         ◦                   │
│  ◦                        ◦                          ◦                      │
│                                                                              │
│  Select: Uniform          Select: Closest to         Select: Between       │
│          random           anchor (hardest)           pos_dist and margin   │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  DISTANCE WEIGHTED                                                           │
│  ─────────────────                                                           │
│                                                                              │
│  Probability ∝ exp(-distance/temperature)                                   │
│                                                                              │
│  High T: More uniform (exploration)                                         │
│  Low T:  Prefer closer negatives (exploitation)                             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  P(select kᵢ) = softmax(-d(anchor, kᵢ) / temperature)              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Summary of Discoveries

### 9.1 Previously Undocumented Features

| Feature | Location | Purpose |
|---------|----------|---------|
| Elastic Weight Consolidation | ruvector-gnn | Prevents catastrophic forgetting |
| Spectral Regularization | ruvector-attention/training | Prevents feature collapse |
| Replay Buffer | ruvector-gnn | Reservoir sampling for continual learning |
| StreamProcessor | ruvector-attention/async_ops | Streaming attention over large datasets |
| MixedCurvatureAttention | ruvector-attention/hyperbolic | Variable curvature per region |
| Distance-Weighted Mining | ruvector-attention/training | Temperature-controlled negative sampling |
| PQ4 Outlier Handling | ruvector-gnn/compress | Exception handling for extreme values |
| Graph RoPE | ruvector-attention/graph | Rotary embeddings for graph distance |

### 9.2 Bounding Mechanisms Identified

1. **HNSW M parameter** - Bounds maximum connections per node
2. **ef_construction** - Bounds candidate exploration during indexing
3. **ef_search** - Bounds candidate exploration during query
4. **Poincaré ball radius** - Bounds hyperbolic embeddings to unit ball
5. **Temperature bounds** - Controls attention distribution sharpness
6. **Outlier threshold** - Bounds PQ4 compression exceptions
7. **Dropout rate** - Bounded [0.0, 1.0] for regularization

### 9.3 Pruning Mechanisms Identified

1. **HNSW neighbor selection heuristic** - Prunes redundant connections
2. **Top-k soft attention** - Prunes low-weight contributions
3. **Temperature annealing** - Progressively prunes attention distribution
4. **Access-frequency compression** - Prunes precision for cold data
5. **Curriculum learning** - Prunes easy examples over time

### 9.4 Anti-Overfitting Arsenal

1. **Dropout** (GNN layers)
2. **Spectral Regularization** (embedding space)
3. **Elastic Weight Consolidation** (continual learning)
4. **Replay Buffer** (experience replay)
5. **Weight Decay** (L2 regularization via AdamW)
6. **Temperature Annealing** (attention sharpening)
7. **Curriculum Learning** (difficulty progression)

---

*Deep dive analysis conducted via source code inspection of @ruvector/core, @ruvector/gnn, @ruvector/attention packages and corresponding Rust crate documentation.*
