# Static Pruning Strategies

## 1. Magnitude Pruning

Remove attention connections below threshold:
```
A_pruned[i,j] = A[i,j] if |A[i,j]| > τ else 0
```

### Analysis

**Pros:**
- Simple to implement
- Predictable sparsity level
- Works well for highly peaked distributions

**Cons:**
- Threshold selection is critical
- May remove important low-magnitude connections
- Static - doesn't adapt to input

### Implementation

```rust
pub struct MagnitudePruning {
    threshold: f32,
    min_connections: usize,  // Ensure at least this many survive
}

impl MagnitudePruning {
    pub fn prune(&self, attention: &mut [f32]) {
        let mut indices: Vec<usize> = (0..attention.len())
            .filter(|&i| attention[i].abs() >= self.threshold)
            .collect();
        
        // Ensure minimum connections
        if indices.len() < self.min_connections {
            let mut sorted: Vec<(usize, f32)> = attention.iter()
                .enumerate()
                .map(|(i, &a)| (i, a.abs()))
                .collect();
            sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
            indices = sorted[..self.min_connections].iter().map(|(i, _)| *i).collect();
        }
        
        for i in 0..attention.len() {
            if !indices.contains(&i) {
                attention[i] = 0.0;
            }
        }
    }
}
```

## 2. Percentage Pruning

Keep top p% of connections:
```
A_pruned = keep_top_percentage(A, p)
```

### Adaptive Percentage

```rust
pub struct AdaptivePruning {
    base_percentage: f32,
    entropy_sensitivity: f32,
}

impl AdaptivePruning {
    pub fn compute_sparsity(&self, attention: &[f32]) -> f32 {
        // Higher entropy = more uniform = keep more
        let entropy = self.compute_entropy(attention);
        let max_entropy = (attention.len() as f32).ln();
        
        let normalized_entropy = entropy / max_entropy;
        
        // Adjust percentage based on entropy
        self.base_percentage + self.entropy_sensitivity * normalized_entropy
    }
    
    fn compute_entropy(&self, p: &[f32]) -> f32 {
        -p.iter()
            .filter(|&&x| x > 1e-10)
            .map(|&x| x * x.ln())
            .sum::<f32>()
    }
}
```

## 3. Layer-wise Pruning

Different layers need different sparsity:

| Layer Type | Typical Sparsity | Reason |
|------------|------------------|--------|
| Early layers | 60-70% | Broad feature extraction |
| Middle layers | 80-90% | Specialized patterns |
| Late layers | 70-80% | Task-specific focus |

```rust
pub struct LayerWisePruning {
    layer_sparsities: Vec<f32>,
}

impl LayerWisePruning {
    pub fn from_profile(num_layers: usize, profile: SparsityProfile) -> Self {
        let sparsities = match profile {
            SparsityProfile::Uniform(s) => vec![s; num_layers],
            SparsityProfile::LinearIncrease(start, end) => {
                (0..num_layers)
                    .map(|i| start + (end - start) * (i as f32 / (num_layers - 1) as f32))
                    .collect()
            }
            SparsityProfile::VShaped(min, max) => {
                let mid = num_layers / 2;
                (0..num_layers)
                    .map(|i| {
                        let dist = (i as i32 - mid as i32).abs() as f32 / mid as f32;
                        min + (max - min) * (1.0 - dist)
                    })
                    .collect()
            }
        };
        Self { layer_sparsities: sparsities }
    }
}
```

## 4. Importance Scoring

Not all connections are equal. Score by:

1. **Gradient magnitude** - how much loss changes
2. **Activation correlation** - how often co-activated
3. **Information flow** - mutual information between positions

```rust
pub struct ImportanceScorer {
    gradient_history: Vec<Vec<f32>>,
    activation_counts: Vec<Vec<u32>>,
    window_size: usize,
}

impl ImportanceScorer {
    pub fn compute_importance(&self, position: usize, connection: usize) -> f32 {
        let gradient_score = self.gradient_history.iter()
            .map(|g| g[position * self.seq_len + connection].abs())
            .sum::<f32>() / self.gradient_history.len() as f32;
        
        let activation_score = self.activation_counts[position][connection] as f32 
            / self.window_size as f32;
        
        // Combined score
        0.6 * gradient_score + 0.4 * activation_score
    }
    
    pub fn prune_by_importance(&self, attention: &mut [f32], keep_ratio: f32) {
        let mut scored: Vec<(usize, f32)> = attention.iter()
            .enumerate()
            .map(|(i, &a)| {
                let pos = i / self.seq_len;
                let conn = i % self.seq_len;
                (i, a * self.compute_importance(pos, conn))
            })
            .collect();
        
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        let keep = (attention.len() as f32 * keep_ratio) as usize;
        let keep_indices: std::collections::HashSet<_> = 
            scored[..keep].iter().map(|(i, _)| *i).collect();
        
        for i in 0..attention.len() {
            if !keep_indices.contains(&i) {
                attention[i] = 0.0;
            }
        }
    }
}
```

## 5. Theoretical Bounds

### Approximation Error

For magnitude pruning with threshold τ:
```
||A - A_pruned||_F ≤ τ √(nnz_removed)
```

### Sparsity-Accuracy Tradeoff

Empirically observed:
```
Accuracy_drop ≈ α × exp(-β × kept_ratio)
```

where α, β are task-dependent constants.

### Optimal Sparsity

Given compute budget C:
```
optimal_sparsity = 1 - sqrt(C / full_compute)
```
