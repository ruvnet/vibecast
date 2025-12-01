# Spectral Regularization for Attention

## Core Idea

Regularize the spectral properties of attention matrices to prevent:
1. Rank collapse (all queries attend to same keys)
2. Extreme eigenvalue concentration
3. Loss of representational diversity

## 1. Spectral Norm Regularization

Constrain the largest singular value:
```
L_spectral = λ × σ_max(A)
```

```rust
pub struct SpectralNormRegularization {
    lambda: f32,
    power_iterations: usize,
}

impl SpectralNormRegularization {
    /// Compute largest singular value via power iteration
    pub fn spectral_norm(&self, attention: &[Vec<f32>]) -> f32 {
        let n = attention.len();
        let m = attention[0].len();
        
        // Initialize random vectors
        let mut u = vec![1.0 / (n as f32).sqrt(); n];
        let mut v = vec![1.0 / (m as f32).sqrt(); m];
        
        for _ in 0..self.power_iterations {
            // v = A^T u / ||A^T u||
            let mut new_v = vec![0.0; m];
            for j in 0..m {
                for i in 0..n {
                    new_v[j] += attention[i][j] * u[i];
                }
            }
            let norm: f32 = new_v.iter().map(|x| x * x).sum::<f32>().sqrt();
            v = new_v.iter().map(|x| x / norm).collect();
            
            // u = A v / ||A v||
            let mut new_u = vec![0.0; n];
            for i in 0..n {
                for j in 0..m {
                    new_u[i] += attention[i][j] * v[j];
                }
            }
            let norm: f32 = new_u.iter().map(|x| x * x).sum::<f32>().sqrt();
            u = new_u.iter().map(|x| x / norm).collect();
        }
        
        // σ_max = u^T A v
        let mut sigma = 0.0;
        for i in 0..n {
            for j in 0..m {
                sigma += u[i] * attention[i][j] * v[j];
            }
        }
        
        sigma.abs()
    }
    
    pub fn loss(&self, attention: &[Vec<f32>]) -> f32 {
        self.lambda * self.spectral_norm(attention)
    }
}
```

## 2. Nuclear Norm Regularization

Encourage low-rank attention (sum of singular values):
```
L_nuclear = λ × ||A||_* = λ × Σᵢ σᵢ
```

This encourages the attention to use fewer "modes".

```rust
pub struct NuclearNormRegularization {
    lambda: f32,
}

impl NuclearNormRegularization {
    pub fn loss(&self, attention: &[Vec<f32>]) -> f32 {
        // Full SVD for nuclear norm
        let singular_values = svd(attention);
        self.lambda * singular_values.iter().sum::<f32>()
    }
    
    /// Proximal operator for nuclear norm (singular value thresholding)
    pub fn prox(&self, attention: &mut [Vec<f32>], step_size: f32) {
        let (u, s, vt) = full_svd(attention);
        
        // Soft threshold singular values
        let threshold = self.lambda * step_size;
        let s_shrunk: Vec<f32> = s.iter()
            .map(|&si| (si - threshold).max(0.0))
            .collect();
        
        // Reconstruct
        *attention = reconstruct_from_svd(&u, &s_shrunk, &vt);
    }
}
```

## 3. Entropy Regularization

Prevent peaky attention distributions:
```
L_entropy = -λ × H(A) = λ × Σᵢⱼ Aᵢⱼ log(Aᵢⱼ)
```

```rust
pub struct EntropyRegularization {
    lambda: f32,
    target_entropy: Option<f32>,  // If set, push toward this entropy
}

impl EntropyRegularization {
    pub fn loss(&self, attention: &[Vec<f32>]) -> f32 {
        let mut total_entropy = 0.0;
        
        for row in attention {
            let row_entropy = -row.iter()
                .filter(|&&a| a > 1e-10)
                .map(|&a| a * a.ln())
                .sum::<f32>();
            total_entropy += row_entropy;
        }
        
        let avg_entropy = total_entropy / attention.len() as f32;
        
        if let Some(target) = self.target_entropy {
            // Regularize toward target entropy
            self.lambda * (avg_entropy - target).powi(2)
        } else {
            // Maximize entropy (negative because we minimize loss)
            -self.lambda * avg_entropy
        }
    }
}
```

## 4. Rank Regularization

Prevent rank collapse by encouraging diverse singular values:

```rust
pub struct RankRegularization {
    lambda: f32,
    target_effective_rank: f32,
}

impl RankRegularization {
    /// Effective rank: exp(H(σ/Σσ))
    pub fn effective_rank(&self, singular_values: &[f32]) -> f32 {
        let sum: f32 = singular_values.iter().sum();
        if sum < 1e-10 {
            return 0.0;
        }
        
        let normalized: Vec<f32> = singular_values.iter().map(|s| s / sum).collect();
        let entropy: f32 = -normalized.iter()
            .filter(|&&p| p > 1e-10)
            .map(|&p| p * p.ln())
            .sum();
        
        entropy.exp()
    }
    
    pub fn loss(&self, attention: &[Vec<f32>]) -> f32 {
        let singular_values = svd(attention);
        let eff_rank = self.effective_rank(&singular_values);
        
        self.lambda * (eff_rank - self.target_effective_rank).powi(2)
    }
}
```

## 5. Condition Number Regularization

Prevent ill-conditioned attention (σ_max / σ_min too large):

```rust
pub struct ConditionRegularization {
    lambda: f32,
    max_condition: f32,
}

impl ConditionRegularization {
    pub fn loss(&self, attention: &[Vec<f32>]) -> f32 {
        let singular_values = svd(attention);
        
        let sigma_max = singular_values.first().copied().unwrap_or(1.0);
        let sigma_min = singular_values.last().copied().unwrap_or(1e-10).max(1e-10);
        
        let condition = sigma_max / sigma_min;
        
        if condition > self.max_condition {
            self.lambda * (condition - self.max_condition).powi(2)
        } else {
            0.0
        }
    }
}
```

## 6. @ruvector/attention Integration

```javascript
const { SpectralRegularization, FlashAttention } = require('@ruvector/attention');

// Already implemented in the library!
const regularizer = new SpectralRegularization({ lambda: 0.01 });

// Use with any attention mechanism
const attention = new FlashAttention(256, 16);
const output = attention.compute(query, keys, values);

// Add spectral regularization to loss
const spectralLoss = regularizer.compute(attentionWeights);
totalLoss += spectralLoss;
```

## 7. Empirical Findings

| Regularization | Effect | Typical λ |
|----------------|--------|-----------|
| Spectral Norm | Stable training | 0.01-0.1 |
| Nuclear Norm | Low-rank bias | 0.001-0.01 |
| Entropy | Diverse attention | 0.1-1.0 |
| Rank | Prevent collapse | 0.01-0.1 |
| Condition | Numerical stability | 0.01-0.05 |
