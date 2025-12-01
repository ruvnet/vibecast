# Dynamic Top-K Attention

## Core Idea

Instead of computing full n×n attention, only attend to top-k most relevant positions.

## 1. Exact Top-K

```rust
pub struct ExactTopK {
    k: usize,
}

impl ExactTopK {
    pub fn forward(&self, query: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) -> Vec<f32> {
        // Compute all scores: O(nd)
        let scores: Vec<f32> = keys.iter()
            .map(|k| dot_product(query, k))
            .collect();
        
        // Find top-k: O(n log k) with heap
        let top_k = self.find_top_k(&scores);
        
        // Sparse softmax and output: O(kd)
        let max_score = top_k.iter().map(|&(_, s)| s).fold(f32::NEG_INFINITY, f32::max);
        let exp_sum: f32 = top_k.iter().map(|&(_, s)| (s - max_score).exp()).sum();
        
        let mut output = vec![0.0; values[0].len()];
        for &(idx, score) in &top_k {
            let weight = (score - max_score).exp() / exp_sum;
            for (i, &v) in values[idx].iter().enumerate() {
                output[i] += weight * v;
            }
        }
        
        output
    }
    
    fn find_top_k(&self, scores: &[f32]) -> Vec<(usize, f32)> {
        use std::collections::BinaryHeap;
        use std::cmp::Ordering;
        
        #[derive(PartialEq)]
        struct MinScore(usize, f32);
        
        impl Eq for MinScore {}
        impl Ord for MinScore {
            fn cmp(&self, other: &Self) -> Ordering {
                other.1.partial_cmp(&self.1).unwrap_or(Ordering::Equal)
            }
        }
        impl PartialOrd for MinScore {
            fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
                Some(self.cmp(other))
            }
        }
        
        let mut heap: BinaryHeap<MinScore> = BinaryHeap::with_capacity(self.k + 1);
        
        for (i, &score) in scores.iter().enumerate() {
            heap.push(MinScore(i, score));
            if heap.len() > self.k {
                heap.pop();
            }
        }
        
        heap.into_iter().map(|MinScore(i, s)| (i, s)).collect()
    }
}
```

**Complexity**: O(nd + n log k + kd) = O(nd) (bottleneck is score computation)

## 2. Approximate Top-K with LSH

Use Locality-Sensitive Hashing to find approximate nearest neighbors:

```rust
pub struct LSHTopK {
    k: usize,
    num_hashes: usize,
    hash_tables: Vec<HashMap<u64, Vec<usize>>>,
    random_projections: Vec<Vec<f32>>,
}

impl LSHTopK {
    pub fn build_index(&mut self, keys: &[Vec<f32>]) {
        for (idx, key) in keys.iter().enumerate() {
            for (table_idx, table) in self.hash_tables.iter_mut().enumerate() {
                let hash = self.compute_hash(key, table_idx);
                table.entry(hash).or_insert_with(Vec::new).push(idx);
            }
        }
    }
    
    pub fn query(&self, query: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) -> Vec<f32> {
        // Find candidate set via LSH
        let mut candidates = std::collections::HashSet::new();
        
        for (table_idx, table) in self.hash_tables.iter().enumerate() {
            let hash = self.compute_hash(query, table_idx);
            if let Some(bucket) = table.get(&hash) {
                candidates.extend(bucket.iter().copied());
            }
        }
        
        // Exact top-k within candidates
        let candidate_scores: Vec<(usize, f32)> = candidates.iter()
            .map(|&i| (i, dot_product(query, &keys[i])))
            .collect();
        
        // ... rest is same as exact top-k
        self.compute_output(&candidate_scores, values)
    }
    
    fn compute_hash(&self, vec: &[f32], table_idx: usize) -> u64 {
        let proj = &self.random_projections[table_idx];
        let dot: f32 = vec.iter().zip(proj).map(|(a, b)| a * b).sum();
        if dot >= 0.0 { 1 } else { 0 }
    }
}
```

**Complexity**: O(d × num_hashes + |candidates| × d)

With good LSH, |candidates| ≈ O(k log n), giving sub-linear complexity!

## 3. Learned Top-K Routing

Train a small network to predict which keys are relevant:

```rust
pub struct LearnedTopK {
    router: MLP,  // Query → relevance scores
    k: usize,
    temperature: f32,
}

impl LearnedTopK {
    pub fn forward(&self, query: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) -> (Vec<f32>, Vec<f32>) {
        // Router predicts relevance
        let relevance = self.router.forward(query);  // [n]
        
        // Differentiable top-k via Gumbel-softmax
        let gumbel_noise: Vec<f32> = (0..keys.len())
            .map(|_| -(-rand::random::<f32>().ln()).ln())
            .collect();
        
        let noisy_relevance: Vec<f32> = relevance.iter()
            .zip(gumbel_noise.iter())
            .map(|(r, g)| (r + g) / self.temperature)
            .collect();
        
        let selection = softmax(&noisy_relevance);
        
        // Sparse attention on selected keys
        let top_k_indices = self.hard_top_k(&selection);
        
        // Compute output using selected keys
        let output = self.sparse_attention(query, keys, values, &top_k_indices);
        
        // Return output and router logits for training
        (output, relevance)
    }
    
    pub fn train_step(&mut self, query: &[f32], keys: &[Vec<f32>], 
                      full_attention_output: &[f32]) {
        // Use full attention as teacher
        let (sparse_output, router_logits) = self.forward(query, keys, values);
        
        // Distillation loss
        let loss = mse_loss(&sparse_output, full_attention_output);
        
        // Backprop through router
        self.router.backward(&loss);
    }
}
```

## 4. Adaptive K Selection

Choose k dynamically based on attention distribution:

```rust
pub struct AdaptiveK {
    min_k: usize,
    max_k: usize,
    coverage_threshold: f32,  // e.g., 0.95
}

impl AdaptiveK {
    pub fn select_k(&self, attention_scores: &[f32]) -> usize {
        let mut sorted = attention_scores.to_vec();
        sorted.sort_by(|a, b| b.partial_cmp(a).unwrap());
        
        let softmax_sorted = softmax(&sorted);
        
        let mut cumsum = 0.0;
        for (i, &s) in softmax_sorted.iter().enumerate() {
            cumsum += s;
            if cumsum >= self.coverage_threshold {
                return (i + 1).max(self.min_k).min(self.max_k);
            }
        }
        
        self.max_k
    }
}
```

## 5. Complexity Analysis

| Method | Query Time | Build Time | Space |
|--------|------------|------------|-------|
| Exact Top-K | O(nd + n log k) | - | O(1) |
| LSH Top-K | O(d·L + c·d) | O(nd·L) | O(nL) |
| Learned Top-K | O(d·router + kd) | O(training) | O(router) |
| Adaptive K | O(nd + n log n) | - | O(1) |

Where L = num hash tables, c = candidate set size
