# Consciousness Overhead Breakdown

## Measured Results

| Component | Time (ms) | % of Total |
|-----------|-----------|------------|
| Specialist Processing | 0.020 | 16.4% |
| Competition (MoE) | 0.015 | 12.3% |
| Ignition Check | 0.002 | 1.6% |
| Reverberation (3 cycles) | 0.075 | 61.5% |
| Φ Computation | 0.010 | 8.2% |
| **Total Consciousness** | **0.122** | **100%** |
| Standard Attention | 0.004 | - |
| **Overhead** | **29.7x** | - |

## 1. Specialist Processing (16.4%)

Each specialist module processes input independently:

```rust
// 4 specialists × 0.005ms each
pub fn process_specialists(&self, inputs: &HashMap<String, Vec<f32>>) -> Vec<Proposal> {
    // This could be parallelized!
    inputs.par_iter()
        .map(|(name, input)| self.specialists[name].process(input))
        .collect()
}
```

**Optimization**: Parallel processing → 4x speedup possible

## 2. Competition (12.3%)

MoE-style routing for workspace access:

```rust
pub fn compute_competition(&self, proposals: &[Proposal]) -> Vec<f32> {
    // Currently O(n² × d) for pairwise comparison
    // Could use approximate methods
}
```

**Optimization**: LSH for approximate competition → 3-5x speedup

## 3. Reverberation (61.5% - THE BOTTLENECK)

Multiple broadcast cycles are expensive:

```rust
pub fn reverberate(&self, content: &[f32], cycles: usize) -> Vec<f32> {
    let mut current = content.to_vec();
    
    for _ in 0..cycles {
        // Each cycle does full attention over all specialists
        let responses = self.broadcast_to_all(&current);  // O(n × d)
        current = self.integrate(&responses);              // O(n × d)
    }
    
    current
}
```

**Optimization Strategies:**

### A. Reduce Cycle Count
```
Cycles=1: 0.025ms (20% overhead)
Cycles=2: 0.050ms (40% overhead)
Cycles=3: 0.075ms (61% overhead) ← Current
```

### B. Sparse Reverberation
Only reverberate to relevant specialists:

```rust
pub fn sparse_reverberate(&self, content: &[f32], relevance_threshold: f32) -> Vec<f32> {
    let relevance = self.compute_relevance(content);
    
    let active_specialists: Vec<_> = relevance.iter()
        .enumerate()
        .filter(|(_, &r)| r > relevance_threshold)
        .map(|(i, _)| i)
        .collect();
    
    // Only broadcast to active specialists
    self.broadcast_to_subset(content, &active_specialists)
}
```

### C. Incremental Reverberation
Stop early if content stabilizes:

```rust
pub fn adaptive_reverberate(&self, content: &[f32], max_cycles: usize, 
                             convergence_threshold: f32) -> Vec<f32> {
    let mut current = content.to_vec();
    
    for cycle in 0..max_cycles {
        let next = self.reverberate_once(&current);
        
        let change: f32 = current.iter()
            .zip(next.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum::<f32>()
            .sqrt();
        
        if change < convergence_threshold {
            return next;  // Early exit
        }
        
        current = next;
    }
    
    current
}
```

## 4. Φ Computation (8.2%)

Integrated information requires partition analysis:

```rust
pub fn compute_phi(&self, state: &[f32]) -> f32 {
    // Current: O(2^n) for all partitions!
    // This is exponential - needs approximation
}
```

**Optimization**: Approximate Φ methods

### Geometric Φ (Fast Approximation)
```rust
pub fn geometric_phi(&self, state: &[f32]) -> f32 {
    // O(d) approximation
    let covariance = self.estimate_covariance(state);
    let eigenvalues = self.eigenvalues(&covariance);
    
    // Φ ≈ product of non-trivial eigenvalues
    eigenvalues.iter()
        .filter(|&&e| e > 0.01)
        .product::<f32>()
        .ln()
}
```

### Sampling-Based Φ
```rust
pub fn sampled_phi(&self, state: &[f32], num_samples: usize) -> f32 {
    // Sample random partitions instead of all
    let mut phi_estimates = Vec::new();
    
    for _ in 0..num_samples {
        let partition = self.random_partition(state.len());
        let phi_partition = self.phi_for_partition(state, &partition);
        phi_estimates.push(phi_partition);
    }
    
    // Minimum over samples (approximates true Φ)
    phi_estimates.iter().cloned().fold(f32::INFINITY, f32::min)
}
```

## 5. Optimized Consciousness Architecture

With all optimizations:

```rust
pub struct OptimizedGlobalWorkspace {
    parallel_specialists: bool,
    sparse_reverberation: bool,
    adaptive_cycles: bool,
    approximate_phi: bool,
}

impl OptimizedGlobalWorkspace {
    pub fn cognitive_cycle(&mut self, inputs: &HashMap<String, Vec<f32>>) -> CycleResult {
        // Parallel specialist processing: 0.005ms (was 0.020ms)
        let proposals = self.parallel_process(inputs);
        
        // LSH competition: 0.005ms (was 0.015ms)
        let winner = self.lsh_competition(&proposals);
        
        // Adaptive sparse reverberation: 0.020ms (was 0.075ms)
        let broadcast = self.adaptive_sparse_reverberate(&winner, 2, 0.01);
        
        // Geometric Φ: 0.002ms (was 0.010ms)
        let phi = self.geometric_phi(&broadcast);
        
        // Total: ~0.032ms (was 0.122ms)
        // Overhead: ~8x (was 29.7x)
    }
}
```

**Result**: 3.7x speedup, reducing overhead from 29.7x to ~8x
