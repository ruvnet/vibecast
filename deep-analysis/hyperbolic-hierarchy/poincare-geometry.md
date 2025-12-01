# Poincaré Ball Geometry for Attention

## 1. Why Hyperbolic?

### Euclidean vs Hyperbolic Capacity

In d-dimensional Euclidean space:
- Volume of ball radius r: V ~ r^d

In d-dimensional hyperbolic space (curvature -1):
- Volume of ball radius r: V ~ e^{(d-1)r}

**Exponential growth** = perfect for trees!

### Distortion Analysis

Embedding a tree with n nodes:
- Euclidean: distortion Ω(log n) unavoidable
- Hyperbolic: distortion O(1) achievable!

## 2. Poincaré Ball Model

Points live in unit ball: B^d = {x ∈ ℝ^d : ||x|| < 1}

### Distance Formula
```
d_P(x, y) = arcosh(1 + 2 × ||x-y||² / ((1-||x||²)(1-||y||²)))
```

### Key Property: Boundary = Infinity
As ||x|| → 1, distances to boundary → ∞

```rust
pub fn poincare_distance(x: &[f32], y: &[f32], curvature: f32) -> f32 {
    let c = curvature.abs();
    
    let x_norm_sq: f32 = x.iter().map(|xi| xi * xi).sum();
    let y_norm_sq: f32 = y.iter().map(|yi| yi * yi).sum();
    let xy_diff_sq: f32 = x.iter().zip(y).map(|(xi, yi)| (xi - yi).powi(2)).sum();
    
    let numerator = 2.0 * xy_diff_sq;
    let denominator = (1.0 - c * x_norm_sq) * (1.0 - c * y_norm_sq);
    
    (1.0 / c.sqrt()) * (1.0 + numerator / denominator).acosh()
}
```

## 3. Möbius Operations

### Möbius Addition (Hyperbolic Translation)
```
x ⊕ y = ((1 + 2c⟨x,y⟩ + c||y||²)x + (1 - c||x||²)y) / 
        (1 + 2c⟨x,y⟩ + c²||x||²||y||²)
```

```rust
pub fn mobius_addition(x: &[f32], y: &[f32], curvature: f32) -> Vec<f32> {
    let c = curvature.abs();
    
    let x_norm_sq: f32 = x.iter().map(|xi| xi * xi).sum();
    let y_norm_sq: f32 = y.iter().map(|yi| yi * yi).sum();
    let xy_dot: f32 = x.iter().zip(y).map(|(xi, yi)| xi * yi).sum();
    
    let numerator_x = 1.0 + 2.0 * c * xy_dot + c * y_norm_sq;
    let numerator_y = 1.0 - c * x_norm_sq;
    let denominator = 1.0 + 2.0 * c * xy_dot + c * c * x_norm_sq * y_norm_sq;
    
    x.iter().zip(y.iter())
        .map(|(xi, yi)| (numerator_x * xi + numerator_y * yi) / denominator)
        .collect()
}
```

### Exponential Map (Tangent → Ball)
```
exp_x(v) = x ⊕ (tanh(√c ||v|| / (2(1 - c||x||²))) × v / (√c ||v||))
```

### Logarithmic Map (Ball → Tangent)
```
log_x(y) = (2 / (√c(1 - c||x||²))) × arctanh(√c ||-x ⊕ y||) × (-x ⊕ y) / ||-x ⊕ y||
```

## 4. Hyperbolic Attention

### Standard Attention in Hyperbolic Space

```rust
pub struct HyperbolicAttention {
    dim: usize,
    curvature: f32,
}

impl HyperbolicAttention {
    pub fn forward(&self, query: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) -> Vec<f32> {
        // Project to Poincaré ball
        let q = self.project_to_ball(query);
        let ks: Vec<_> = keys.iter().map(|k| self.project_to_ball(k)).collect();
        
        // Compute hyperbolic distances as scores
        let scores: Vec<f32> = ks.iter()
            .map(|k| -poincare_distance(&q, k, self.curvature))
            .collect();
        
        // Softmax in hyperbolic space
        let weights = softmax(&scores);
        
        // Weighted Möbius mean (Einstein midpoint)
        self.weighted_mobius_mean(&ks, &weights)
    }
    
    fn weighted_mobius_mean(&self, points: &[Vec<f32>], weights: &[f32]) -> Vec<f32> {
        // Einstein midpoint formula for weighted average
        let mut result = vec![0.0; self.dim];
        let mut gamma_sum = 0.0;
        
        for (point, &weight) in points.iter().zip(weights.iter()) {
            let norm_sq: f32 = point.iter().map(|p| p * p).sum();
            let gamma = 1.0 / (1.0 - self.curvature * norm_sq).sqrt();
            
            gamma_sum += weight * gamma;
            for (i, &p) in point.iter().enumerate() {
                result[i] += weight * gamma * p;
            }
        }
        
        for r in &mut result {
            *r /= gamma_sum;
        }
        
        // Project back to ball
        self.project_to_ball(&result)
    }
}
```

## 5. Hierarchy-Aware Attention

Nodes closer to center = higher in hierarchy:

```rust
pub struct HierarchyAwareAttention {
    base: HyperbolicAttention,
    hierarchy_weight: f32,
}

impl HierarchyAwareAttention {
    pub fn forward(&self, query: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) -> Vec<f32> {
        let q = self.base.project_to_ball(query);
        let ks: Vec<_> = keys.iter().map(|k| self.base.project_to_ball(k)).collect();
        
        // Distance scores
        let dist_scores: Vec<f32> = ks.iter()
            .map(|k| -poincare_distance(&q, k, self.base.curvature))
            .collect();
        
        // Hierarchy scores (closer to center = higher)
        let hier_scores: Vec<f32> = ks.iter()
            .map(|k| {
                let norm: f32 = k.iter().map(|ki| ki * ki).sum::<f32>().sqrt();
                1.0 - norm  // Higher score for central (parent) nodes
            })
            .collect();
        
        // Combine scores
        let combined: Vec<f32> = dist_scores.iter()
            .zip(hier_scores.iter())
            .map(|(&d, &h)| d + self.hierarchy_weight * h)
            .collect();
        
        let weights = softmax(&combined);
        self.base.weighted_mobius_mean(&ks, &weights)
    }
}
```

## 6. Benefits for @ruvector/attention

1. **Tree-like data** - Taxonomies, org charts, file systems
2. **Causal chains** - Events with parent causes
3. **Agent hierarchies** - Manager-worker relationships
4. **Memory systems** - Episodic memory with temporal hierarchy
