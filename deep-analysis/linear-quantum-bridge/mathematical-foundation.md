# Mathematical Foundation: Linear Attention ↔ Quantum Kernels

## 1. Standard Attention Complexity

Standard scaled dot-product attention:
```
Attention(Q, K, V) = softmax(QK^T / √d) V
```

**Complexity**: O(n²d) where n = sequence length, d = dimension

The bottleneck is the n×n attention matrix.

## 2. The Kernel Trick

Softmax can be viewed as a kernel:
```
softmax(q·k / √d) ≈ κ(q, k) = φ(q)^T φ(k)
```

If we can find φ such that:
```
exp(q·k) ≈ φ(q)^T φ(k)
```

Then attention becomes:
```
Attention ≈ φ(Q) (φ(K)^T V)
```

**New Complexity**: O(nd²) - linear in sequence length!

## 3. Random Fourier Features

The key insight from Rahimi & Recht (2007):

For shift-invariant kernels k(x-y), we can approximate:
```
k(x, y) ≈ (1/m) Σᵢ cos(ωᵢ·x + bᵢ) cos(ωᵢ·y + bᵢ)
```

where ωᵢ ~ p(ω) is the Fourier transform of k.

For the Gaussian kernel (which approximates softmax):
```
φ(x) = [cos(ω₁·x), sin(ω₁·x), ..., cos(ωₘ·x), sin(ωₘ·x)] / √m
```

## 4. Positive Random Features (Performers)

Choromanski et al. (2020) showed:
```
exp(q·k) = E[φ(q)^T φ(k)]
```

where:
```
φ(x) = exp(||x||²/2) [exp(ω₁·x), ..., exp(ωₘ·x)] / √m
```

This gives POSITIVE features, crucial for attention stability.

## 5. The Quantum Connection

In quantum computing, the quantum kernel is:
```
K(x, y) = |⟨φ(x)|φ(y)⟩|²
```

where |φ(x)⟩ is a quantum state in Hilbert space ℋ of dimension 2^n.

**Key Insight**: Random feature maps approximate access to exponentially large feature spaces - exactly what quantum computers provide natively!

```
Classical:  φ: ℝ^d → ℝ^m  (m random features)
Quantum:    φ: ℝ^d → ℋ^{2^n}  (exponential features)
```

## 6. Complexity Comparison

| Method | Time | Space | Feature Dim |
|--------|------|-------|-------------|
| Standard | O(n²d) | O(n²) | d |
| Linear (RFF) | O(nmd) | O(nm) | m |
| Quantum | O(n·poly(log d)) | O(n log d) | 2^n |

## 7. Implications

1. **Linear attention is a classical simulation of quantum kernels**
2. **The approximation quality depends on m (number of features)**
3. **Quantum advantage emerges when m needs to be exponential**
4. **For practical d (~64-512), classical is sufficient**
5. **For d > 10000, quantum kernels become advantageous**

## 8. Code Implementation

```rust
pub struct LinearQuantumBridge {
    num_features: usize,
    omega: Vec<Vec<f32>>,  // Random frequencies
    
    // Quantum-inspired additions
    use_positive_features: bool,
    normalize_features: bool,
}

impl LinearQuantumBridge {
    pub fn random_features(&self, x: &[f32]) -> Vec<f32> {
        let mut features = Vec::with_capacity(self.num_features * 2);
        
        for omega_i in &self.omega {
            let dot: f32 = x.iter().zip(omega_i).map(|(a, b)| a * b).sum();
            
            if self.use_positive_features {
                // Positive features (Performer-style)
                let norm_sq: f32 = x.iter().map(|xi| xi * xi).sum();
                features.push((dot + norm_sq / 2.0).exp());
            } else {
                // Trigonometric features (RFF-style)
                features.push(dot.cos());
                features.push(dot.sin());
            }
        }
        
        if self.normalize_features {
            let norm: f32 = features.iter().map(|f| f * f).sum::<f32>().sqrt();
            features.iter_mut().for_each(|f| *f /= norm);
        }
        
        features
    }
    
    pub fn linear_attention(&self, q: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) -> Vec<f32> {
        let q_features = self.random_features(q);
        
        // Compute K^T V first: O(md) per key
        let mut kv_sum = vec![0.0; self.num_features * values[0].len()];
        let mut k_sum = vec![0.0; self.num_features];
        
        for (k, v) in keys.iter().zip(values.iter()) {
            let k_features = self.random_features(k);
            
            // Accumulate K^T V
            for (i, kf) in k_features.iter().enumerate() {
                k_sum[i] += kf;
                for (j, vj) in v.iter().enumerate() {
                    kv_sum[i * v.len() + j] += kf * vj;
                }
            }
        }
        
        // Compute output: φ(Q) (K^T V) / φ(Q) K^T 1
        let mut output = vec![0.0; values[0].len()];
        let mut normalizer = 0.0;
        
        for (i, qf) in q_features.iter().enumerate() {
            normalizer += qf * k_sum[i];
            for j in 0..values[0].len() {
                output[j] += qf * kv_sum[i * values[0].len() + j];
            }
        }
        
        output.iter_mut().for_each(|o| *o /= normalizer);
        output
    }
}
```

## 9. Future Directions

1. **Learnable random features** - optimize ω during training
2. **Structured random matrices** - faster computation (Hadamard)
3. **Quantum kernel estimation** - use quantum computers for κ
4. **Hybrid classical-quantum** - classical for small d, quantum for large
