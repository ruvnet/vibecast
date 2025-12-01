# Attention Thermodynamics

## Treating Attention as a Physical System

Apply concepts from statistical mechanics to understand attention.

## 1. Free Energy of Attention

The attention distribution minimizes a free energy:
```
F = E - T·S

where:
E = Σᵢⱼ aᵢⱼ · d(qᵢ, kⱼ)  (energy = distances weighted by attention)
S = -Σᵢⱼ aᵢⱼ log(aᵢⱼ)    (entropy of attention distribution)
T = temperature parameter
```

```rust
pub struct FreeEnergyAttention {
    temperature: f32,
}

impl FreeEnergyAttention {
    pub fn compute_free_energy(&self, attention: &[Vec<f32>], 
                                distances: &[Vec<f32>]) -> f32 {
        let energy = self.compute_energy(attention, distances);
        let entropy = self.compute_entropy(attention);
        
        energy - self.temperature * entropy
    }
    
    pub fn gradient_descent(&self, attention: &mut [Vec<f32>], 
                            distances: &[Vec<f32>]) {
        // Find attention that minimizes free energy
        let learning_rate = 0.01;
        
        for _ in 0..100 {
            let grad = self.compute_gradient(attention, distances);
            
            for i in 0..attention.len() {
                for j in 0..attention[i].len() {
                    attention[i][j] -= learning_rate * grad[i][j];
                }
                
                // Project to probability simplex
                self.project_to_simplex(&mut attention[i]);
            }
        }
    }
    
    fn compute_gradient(&self, attention: &[Vec<f32>], 
                        distances: &[Vec<f32>]) -> Vec<Vec<f32>> {
        attention.iter()
            .zip(distances.iter())
            .map(|(a_row, d_row)| {
                a_row.iter()
                    .zip(d_row.iter())
                    .map(|(&a, &d)| {
                        // ∂F/∂a = d + T·(log(a) + 1)
                        d + self.temperature * (a.max(1e-10).ln() + 1.0)
                    })
                    .collect()
            })
            .collect()
    }
}
```

## 2. Attention Entropy Production

```rust
pub struct EntropyProduction {
    /// How much entropy is produced during attention?
    pub fn compute(&self, input_dist: &[f32], output_dist: &[f32]) -> f32 {
        let h_input = self.entropy(input_dist);
        let h_output = self.entropy(output_dist);
        
        // Entropy change (can be negative = information compression)
        h_output - h_input
    }
    
    /// Maximum efficiency attention
    pub fn reversible_attention(&self, query: &[f32], keys: &[Vec<f32>]) -> Vec<f32> {
        // Minimize entropy production = maximize efficiency
        // This is equivalent to matching query-key distributions
        
        let scores: Vec<f32> = keys.iter()
            .map(|k| dot_product(query, k))
            .collect();
        
        // Use Sinkhorn for optimal transport (minimal entropy production)
        self.sinkhorn_attention(&scores)
    }
}
```

## 3. Attention Heat Capacity

How does attention change with temperature?

```rust
pub struct HeatCapacity {
    pub fn compute(&self, scores: &[f32]) -> f32 {
        // C = dE/dT = T × d²F/dT²
        
        let t1 = 1.0;
        let t2 = 1.1;
        
        let e1 = self.expected_energy(scores, t1);
        let e2 = self.expected_energy(scores, t2);
        
        (e2 - e1) / (t2 - t1)
    }
    
    fn expected_energy(&self, scores: &[f32], temperature: f32) -> f32 {
        let weights = softmax_with_temp(scores, temperature);
        
        // E = Σ wᵢ × (-scoreᵢ)
        weights.iter()
            .zip(scores.iter())
            .map(|(w, s)| -w * s)
            .sum()
    }
}
```

## 4. Second Law of Attention

Attention transforms must increase total entropy:
```
ΔS_universe = ΔS_system + ΔS_environment ≥ 0
```

This constrains what attention transformations are physically realizable.
