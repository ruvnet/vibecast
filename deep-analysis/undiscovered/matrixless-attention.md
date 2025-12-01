# Matrixless Attention: Beyond O(n²) Storage

## The Challenge

Current attention requires O(n²) memory for the attention matrix.
Can we compute attention without ever materializing this matrix?

## 1. Streaming Attention

Process one element at a time, maintaining running statistics:

```rust
pub struct StreamingAttention {
    running_sum: Vec<f32>,      // Σ exp(score) * value
    running_norm: f32,          // Σ exp(score)
    max_score: f32,             // For numerical stability
}

impl StreamingAttention {
    pub fn new(dim: usize) -> Self {
        Self {
            running_sum: vec![0.0; dim],
            running_norm: 0.0,
            max_score: f32::NEG_INFINITY,
        }
    }
    
    /// Process one key-value pair
    pub fn process(&mut self, query: &[f32], key: &[f32], value: &[f32]) {
        let score: f32 = query.iter().zip(key).map(|(q, k)| q * k).sum();
        
        // Numerical stability: track max score
        if score > self.max_score {
            // Rescale running sums
            let scale = (self.max_score - score).exp();
            for v in &mut self.running_sum {
                *v *= scale;
            }
            self.running_norm *= scale;
            self.max_score = score;
        }
        
        // Add this key-value
        let weight = (score - self.max_score).exp();
        self.running_norm += weight;
        for (i, v) in value.iter().enumerate() {
            self.running_sum[i] += weight * v;
        }
    }
    
    /// Get final output
    pub fn finalize(&self) -> Vec<f32> {
        self.running_sum.iter()
            .map(|s| s / self.running_norm)
            .collect()
    }
}
```

**Memory**: O(d) instead of O(n²)!

## 2. Implicit Attention via ODEs

Model attention as the solution to a differential equation:

```
dy/dt = f(y, query, context)
y(T) = attention_output
```

```rust
pub struct ODEAttention {
    integration_steps: usize,
    step_size: f32,
}

impl ODEAttention {
    pub fn forward(&self, query: &[f32], context: &[Vec<f32>]) -> Vec<f32> {
        // Initial state
        let mut y = query.to_vec();
        
        // Integrate ODE
        for _ in 0..self.integration_steps {
            let dy = self.dynamics(&y, query, context);
            for (yi, dyi) in y.iter_mut().zip(dy.iter()) {
                *yi += self.step_size * dyi;
            }
        }
        
        y
    }
    
    fn dynamics(&self, y: &[f32], query: &[f32], context: &[Vec<f32>]) -> Vec<f32> {
        // Attention-like dynamics without explicit matrix
        let mut dy = vec![0.0; y.len()];
        
        for ctx in context {
            let similarity: f32 = y.iter().zip(ctx).map(|(a, b)| a * b).sum();
            let weight = similarity.tanh();
            
            for (i, c) in ctx.iter().enumerate() {
                dy[i] += weight * (c - y[i]);
            }
        }
        
        dy
    }
}
```

**Memory**: O(d) - never stores n² matrix

## 3. Reservoir Attention

Use a fixed random reservoir to compute attention:

```rust
pub struct ReservoirAttention {
    reservoir: Vec<Vec<f32>>,  // Fixed random weights
    reservoir_size: usize,
}

impl ReservoirAttention {
    pub fn forward(&self, query: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) -> Vec<f32> {
        // Project all inputs to reservoir space
        let q_res = self.project(query);
        
        // Attention in reservoir space (lower dimensional)
        let mut output_res = vec![0.0; self.reservoir_size];
        let mut norm = 0.0;
        
        for (key, value) in keys.iter().zip(values.iter()) {
            let k_res = self.project(key);
            let v_res = self.project(value);
            
            let score: f32 = q_res.iter().zip(k_res.iter()).map(|(q, k)| q * k).sum();
            let weight = score.exp();
            norm += weight;
            
            for (i, v) in v_res.iter().enumerate() {
                output_res[i] += weight * v;
            }
        }
        
        for v in &mut output_res {
            *v /= norm;
        }
        
        // Project back
        self.project_back(&output_res)
    }
    
    fn project(&self, vec: &[f32]) -> Vec<f32> {
        self.reservoir.iter()
            .map(|row| {
                row.iter().zip(vec).map(|(r, v)| r * v).sum::<f32>().tanh()
            })
            .collect()
    }
}
```

**Memory**: O(r × d) where r << n
