# Contrastive Regularization for Attention

## The Idea

Contrastive learning forces similar items close and dissimilar items apart.
We can use this to regularize attention patterns.

## 1. Attention Contrastive Loss

```rust
pub struct ContrastiveAttentionRegularizer {
    temperature: f32,
    positive_margin: f32,
    negative_margin: f32,
}

impl ContrastiveAttentionRegularizer {
    pub fn loss(&self, attention: &[Vec<f32>], labels: &[usize]) -> f32 {
        let mut loss = 0.0;
        let n = attention.len();
        
        for i in 0..n {
            for j in (i+1)..n {
                let similarity = self.attention_similarity(&attention[i], &attention[j]);
                
                if labels[i] == labels[j] {
                    // Same class: should have similar attention
                    loss += (self.positive_margin - similarity).max(0.0).powi(2);
                } else {
                    // Different class: should have different attention
                    loss += (similarity - self.negative_margin).max(0.0).powi(2);
                }
            }
        }
        
        loss / (n * (n - 1) / 2) as f32
    }
    
    fn attention_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        let dot: f32 = a.iter().zip(b).map(|(ai, bi)| ai * bi).sum();
        let norm_a: f32 = a.iter().map(|ai| ai * ai).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|bi| bi * bi).sum::<f32>().sqrt();
        
        dot / (norm_a * norm_b + 1e-8)
    }
}
```

## 2. InfoNCE for Attention

```rust
pub struct InfoNCEAttention {
    temperature: f32,
}

impl InfoNCEAttention {
    pub fn loss(&self, query_attention: &[f32], 
                positive_key: &[f32], 
                negative_keys: &[Vec<f32>]) -> f32 {
        
        let pos_sim = self.similarity(query_attention, positive_key) / self.temperature;
        
        let neg_sims: Vec<f32> = negative_keys.iter()
            .map(|neg| self.similarity(query_attention, neg) / self.temperature)
            .collect();
        
        // InfoNCE: -log(exp(pos) / (exp(pos) + Σ exp(neg)))
        let max_sim = pos_sim.max(neg_sims.iter().cloned().fold(f32::NEG_INFINITY, f32::max));
        
        let log_sum_exp = max_sim + (
            (pos_sim - max_sim).exp() + 
            neg_sims.iter().map(|&s| (s - max_sim).exp()).sum::<f32>()
        ).ln();
        
        log_sum_exp - pos_sim
    }
}
```

## 3. Hard Negative Mining

Focus on difficult examples:

```rust
pub struct HardNegativeMining {
    num_hard_negatives: usize,
    margin: f32,
}

impl HardNegativeMining {
    pub fn select_hard_negatives(&self, 
                                   query_attention: &[f32],
                                   all_negatives: &[Vec<f32>]) -> Vec<usize> {
        // Find negatives that are close but should be far
        let mut scored: Vec<(usize, f32)> = all_negatives.iter()
            .enumerate()
            .map(|(i, neg)| (i, self.similarity(query_attention, neg)))
            .collect();
        
        // Sort by similarity (descending) - highest similarity = hardest
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        // Select top-k hard negatives within margin
        scored.iter()
            .filter(|(_, sim)| *sim > self.margin)
            .take(self.num_hard_negatives)
            .map(|(i, _)| *i)
            .collect()
    }
}
```

## 4. Benefits

1. **Discriminative attention** - Different inputs get different attention
2. **Robust patterns** - Resists noise and adversarial inputs
3. **Better clustering** - Attention patterns cluster by meaning
