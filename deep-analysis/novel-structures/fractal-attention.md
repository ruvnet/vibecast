# Fractal Attention: Self-Similar Hierarchies

## The Insight

Natural hierarchies are often fractal - the same patterns repeat at different scales.
What if attention itself was fractal?

## 1. Self-Similar Attention Structure

At each scale, the attention pattern resembles the whole:
```
A(scale=0) = base attention matrix
A(scale=k) = downsample(A(scale=k-1)) with same structure
```

```rust
pub struct FractalAttention {
    base_dim: usize,
    num_scales: usize,
    scale_factor: f32,  // Typically 0.5 (halving)
    self_similarity_weight: f32,
}

impl FractalAttention {
    pub fn forward(&self, query: &[f32], keys: &[Vec<f32>], values: &[Vec<f32>]) -> Vec<f32> {
        let mut outputs_at_scales = Vec::new();
        
        // Compute attention at each scale
        for scale in 0..self.num_scales {
            let scale_factor = self.scale_factor.powi(scale as i32);
            let scaled_dim = (self.base_dim as f32 * scale_factor) as usize;
            
            // Downsample to this scale
            let q_scaled = self.downsample(query, scaled_dim);
            let k_scaled: Vec<Vec<f32>> = keys.iter()
                .map(|k| self.downsample(k, scaled_dim))
                .collect();
            let v_scaled: Vec<Vec<f32>> = values.iter()
                .map(|v| self.downsample(v, scaled_dim))
                .collect();
            
            // Attention at this scale
            let output_scaled = self.attention_at_scale(&q_scaled, &k_scaled, &v_scaled);
            
            // Upsample back
            let output_upsampled = self.upsample(&output_scaled, self.base_dim);
            outputs_at_scales.push(output_upsampled);
        }
        
        // Combine scales with self-similarity weighting
        self.combine_scales(&outputs_at_scales)
    }
    
    fn combine_scales(&self, outputs: &[Vec<f32>]) -> Vec<f32> {
        let mut combined = vec![0.0; self.base_dim];
        let mut total_weight = 0.0;
        
        for (scale, output) in outputs.iter().enumerate() {
            // Weight decreases with scale (finer scales get less weight)
            let weight = self.self_similarity_weight.powi(scale as i32);
            total_weight += weight;
            
            for (i, &v) in output.iter().enumerate() {
                combined[i] += weight * v;
            }
        }
        
        combined.iter_mut().for_each(|v| *v /= total_weight);
        combined
    }
}
```

## 2. Mandelbrot Attention

Attention scores follow the Mandelbrot iteration:
```
z_{n+1} = z_n² + c
Attention = escape_time(query · key)
```

```rust
pub struct MandelbrotAttention {
    max_iterations: usize,
    escape_radius: f32,
}

impl MandelbrotAttention {
    pub fn attention_score(&self, query: &[f32], key: &[f32]) -> f32 {
        // Map dot product to complex plane
        let dot: f32 = query.iter().zip(key).map(|(q, k)| q * k).sum();
        let c = Complex::new(dot.cos(), dot.sin());
        
        let mut z = Complex::new(0.0, 0.0);
        let mut iterations = 0;
        
        while iterations < self.max_iterations && z.norm() < self.escape_radius {
            z = z * z + c;
            iterations += 1;
        }
        
        // Smooth escape time
        if iterations == self.max_iterations {
            1.0  // Inside set = maximum attention
        } else {
            let smooth = iterations as f32 - (z.norm().ln() / 2.0_f32.ln()).ln();
            smooth / self.max_iterations as f32
        }
    }
}
```

## 3. Applications

1. **Multi-resolution NLP** - Attend to words, phrases, sentences, paragraphs
2. **Image attention** - Attend at pixel, patch, region, image levels
3. **Time series** - Attend at tick, minute, hour, day scales
4. **Hierarchical reasoning** - Concepts at multiple abstraction levels
