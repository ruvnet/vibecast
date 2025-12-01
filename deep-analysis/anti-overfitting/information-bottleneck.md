# Information Bottleneck for Attention

## The Theory

The Information Bottleneck (IB) principle says optimal representations
compress input while preserving task-relevant information.

## 1. IB Objective

```
min I(X; Z) - β × I(Z; Y)

where:
X = input (keys)
Z = representation (attention output)
Y = target
β = tradeoff parameter
```

Minimize information about input, maximize about target.

## 2. Variational Information Bottleneck (VIB)

```rust
pub struct VIBAttention {
    encoder_mean: MLP,
    encoder_logvar: MLP,
    beta: f32,
}

impl VIBAttention {
    pub fn forward(&self, query: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) 
        -> (Vec<f32>, f32) {
        
        // Standard attention scores
        let scores: Vec<f32> = keys.iter()
            .map(|k| dot_product(query, k))
            .collect();
        
        // Encode to variational distribution
        let mean = self.encoder_mean.forward(&scores);
        let logvar = self.encoder_logvar.forward(&scores);
        
        // Reparameterization trick
        let noise: Vec<f32> = (0..mean.len())
            .map(|_| rand::thread_rng().sample(StandardNormal))
            .collect();
        
        let z: Vec<f32> = mean.iter()
            .zip(logvar.iter())
            .zip(noise.iter())
            .map(|((m, lv), n)| m + (0.5 * lv).exp() * n)
            .collect();
        
        // Attention with bottlenecked scores
        let weights = softmax(&z);
        let output = self.weighted_sum(&weights, values);
        
        // KL divergence (information cost)
        let kl: f32 = mean.iter()
            .zip(logvar.iter())
            .map(|(m, lv)| -0.5 * (1.0 + lv - m.powi(2) - lv.exp()))
            .sum();
        
        (output, self.beta * kl)
    }
}
```

## 3. Attention Bottleneck Layer

Force information through a bottleneck:

```rust
pub struct AttentionBottleneck {
    bottleneck_dim: usize,  // << input_dim
    encoder: Linear,
    decoder: Linear,
}

impl AttentionBottleneck {
    pub fn forward(&self, attention: &[Vec<f32>]) -> (Vec<Vec<f32>>, f32) {
        // Compress attention to low-dim
        let compressed: Vec<Vec<f32>> = attention.iter()
            .map(|row| self.encoder.forward(row))
            .collect();
        
        // Expand back
        let reconstructed: Vec<Vec<f32>> = compressed.iter()
            .map(|row| self.decoder.forward(row))
            .collect();
        
        // Reconstruction loss = information loss
        let recon_loss: f32 = attention.iter()
            .zip(reconstructed.iter())
            .map(|(orig, recon)| {
                orig.iter().zip(recon.iter())
                    .map(|(o, r)| (o - r).powi(2))
                    .sum::<f32>()
            })
            .sum();
        
        (reconstructed, recon_loss)
    }
}
```

## 4. Minimal Sufficient Statistics

Keep only what's needed for the task:

```rust
pub struct MinimalSufficientAttention {
    task_predictor: MLP,
    sufficiency_threshold: f32,
}

impl MinimalSufficientAttention {
    pub fn find_minimal_attention(&self, attention: &[f32], target: &[f32]) -> Vec<f32> {
        let mut minimal = attention.to_vec();
        let base_accuracy = self.evaluate_accuracy(&minimal, target);
        
        // Greedily zero out attention weights
        let mut indices: Vec<usize> = (0..attention.len()).collect();
        indices.sort_by(|&a, &b| attention[a].partial_cmp(&attention[b]).unwrap());
        
        for i in indices {
            let old_val = minimal[i];
            minimal[i] = 0.0;
            
            let new_accuracy = self.evaluate_accuracy(&minimal, target);
            
            if base_accuracy - new_accuracy > self.sufficiency_threshold {
                // This weight was necessary - restore it
                minimal[i] = old_val;
            }
            // Otherwise, keep it zeroed (wasn't needed)
        }
        
        minimal
    }
}
```

## 5. Benefits

1. **Generalization** - Less memorization of irrelevant details
2. **Robustness** - Ignores spurious correlations
3. **Interpretability** - Only attends to relevant information
4. **Compression** - Lower communication costs
