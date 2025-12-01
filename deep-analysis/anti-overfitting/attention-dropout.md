# Attention Dropout Mechanisms

## 1. Standard Attention Dropout

Drop attention weights randomly:
```
A_dropped = dropout(softmax(QK^T/√d), p)
```

### Issues:
- May drop critical connections
- Uniform probability ignores importance
- Can destabilize training

### Improved Version: Importance-Weighted Dropout

```rust
pub struct ImportanceWeightedDropout {
    base_prob: f32,
    importance_scale: f32,
}

impl ImportanceWeightedDropout {
    pub fn forward(&self, attention: &[f32], training: bool) -> Vec<f32> {
        if !training {
            return attention.to_vec();
        }
        
        // Higher attention = lower drop probability
        let max_attn = attention.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        
        attention.iter()
            .map(|&a| {
                let importance = a / max_attn;
                let drop_prob = self.base_prob * (1.0 - self.importance_scale * importance);
                
                if rand::random::<f32>() < drop_prob {
                    0.0
                } else {
                    a / (1.0 - drop_prob)  // Scale to maintain expectation
                }
            })
            .collect()
    }
}
```

## 2. DropAttention (Zehui et al.)

Drop entire attention heads:
```rust
pub struct DropAttention {
    num_heads: usize,
    drop_prob: f32,
}

impl DropAttention {
    pub fn forward(&self, multi_head_output: &[Vec<f32>], training: bool) -> Vec<f32> {
        if !training {
            return self.average_heads(multi_head_output);
        }
        
        let keep_mask: Vec<bool> = (0..self.num_heads)
            .map(|_| rand::random::<f32>() >= self.drop_prob)
            .collect();
        
        let kept_count = keep_mask.iter().filter(|&&k| k).count();
        if kept_count == 0 {
            // Keep at least one head
            return multi_head_output[0].clone();
        }
        
        let mut output = vec![0.0; multi_head_output[0].len()];
        for (i, head) in multi_head_output.iter().enumerate() {
            if keep_mask[i] {
                for (j, &v) in head.iter().enumerate() {
                    output[j] += v / kept_count as f32;
                }
            }
        }
        
        output
    }
}
```

## 3. Structured Dropout

Drop attention in patterns:

### Block Dropout
```rust
pub struct BlockDropout {
    block_size: usize,
    drop_prob: f32,
}

impl BlockDropout {
    pub fn forward(&self, attention: &mut [Vec<f32>]) {
        let num_blocks = attention.len() / self.block_size;
        
        for block_i in 0..num_blocks {
            for block_j in 0..num_blocks {
                if rand::random::<f32>() < self.drop_prob {
                    // Drop entire block
                    for i in (block_i * self.block_size)..((block_i + 1) * self.block_size) {
                        for j in (block_j * self.block_size)..((block_j + 1) * self.block_size) {
                            if i < attention.len() && j < attention[i].len() {
                                attention[i][j] = 0.0;
                            }
                        }
                    }
                }
            }
        }
    }
}
```

### Band Dropout
Drop diagonal bands to prevent local overfitting:
```rust
pub struct BandDropout {
    max_band_width: usize,
    drop_prob: f32,
}

impl BandDropout {
    pub fn forward(&self, attention: &mut [Vec<f32>]) {
        let n = attention.len();
        
        // Randomly select bands to drop
        for band_offset in 0..n {
            if band_offset <= self.max_band_width && rand::random::<f32>() < self.drop_prob {
                // Drop this diagonal band
                for i in 0..n {
                    let j_pos = i + band_offset;
                    let j_neg = i.saturating_sub(band_offset);
                    
                    if j_pos < attention[i].len() {
                        attention[i][j_pos] = 0.0;
                    }
                    if j_neg < attention[i].len() && band_offset > 0 {
                        attention[i][j_neg] = 0.0;
                    }
                }
            }
        }
    }
}
```

## 4. Contextual Dropout

Drop based on context, not randomly:

```rust
pub struct ContextualDropout {
    context_encoder: MLP,
    threshold: f32,
}

impl ContextualDropout {
    pub fn forward(&self, attention: &[f32], context: &[f32]) -> Vec<f32> {
        // Encode context to get drop probabilities
        let drop_probs = self.context_encoder.forward(context);
        
        attention.iter()
            .zip(drop_probs.iter())
            .map(|(&a, &p)| {
                if rand::random::<f32>() < p {
                    0.0
                } else {
                    a / (1.0 - p)
                }
            })
            .collect()
    }
}
```

## 5. R-Drop: Regularized Dropout

Train with consistency between different dropout masks:

```rust
pub struct RDrop {
    dropout: AttentionDropout,
    consistency_weight: f32,
}

impl RDrop {
    pub fn train_step(&self, query: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) -> f32 {
        // Forward with two different dropout masks
        let output1 = self.forward_with_dropout(query, keys, values);
        let output2 = self.forward_with_dropout(query, keys, values);
        
        // Task loss on both
        let task_loss = (self.task_loss(&output1) + self.task_loss(&output2)) / 2.0;
        
        // KL divergence between outputs for consistency
        let kl_loss = kl_divergence(&output1, &output2) + kl_divergence(&output2, &output1);
        
        task_loss + self.consistency_weight * kl_loss / 2.0
    }
}
```

## 6. Empirical Guidelines

| Technique | When to Use | Drop Rate |
|-----------|-------------|-----------|
| Standard | General | 0.1-0.3 |
| Head Dropout | Multi-head | 0.1-0.2 |
| Block Dropout | Long sequences | 0.1-0.15 |
| Band Dropout | Prevent local bias | 0.05-0.1 |
| R-Drop | High variance | 0.1-0.2 |
