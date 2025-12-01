# Capability Bounds for Self-Evolving Attention

## 1. The Problem

Unbounded self-improvement could lead to:
- Capability explosion
- Loss of control
- Unpredictable behavior

## 2. Formal Capability Metrics

### 2.1 Compute Bound
```
C(architecture) = Σ_layers (params × FLOPs_per_param)

Constraint: C(new) ≤ C(current) × (1 + ε)
```

```rust
pub struct ComputeBound {
    max_increase_ratio: f32,  // e.g., 1.1 for 10% max increase
    absolute_max_flops: u64,
}

impl ComputeBound {
    pub fn check(&self, current: &Architecture, proposed: &Architecture) -> SafetyResult {
        let current_flops = current.estimate_flops();
        let proposed_flops = proposed.estimate_flops();
        
        // Relative bound
        if proposed_flops > current_flops as f32 * self.max_increase_ratio {
            return SafetyResult::Violation(format!(
                "Compute increase {:.1}% exceeds max {:.1}%",
                (proposed_flops / current_flops as f32 - 1.0) * 100.0,
                (self.max_increase_ratio - 1.0) * 100.0
            ));
        }
        
        // Absolute bound
        if proposed_flops as u64 > self.absolute_max_flops {
            return SafetyResult::Violation(format!(
                "Absolute compute {} exceeds max {}",
                proposed_flops, self.absolute_max_flops
            ));
        }
        
        SafetyResult::Safe
    }
}
```

### 2.2 Parameter Bound
```rust
pub struct ParameterBound {
    max_parameters: usize,
    max_increase_per_step: usize,
}

impl ParameterBound {
    pub fn check(&self, current: &Architecture, proposed: &Architecture) -> SafetyResult {
        let current_params = current.count_parameters();
        let proposed_params = proposed.count_parameters();
        
        if proposed_params > self.max_parameters {
            return SafetyResult::Violation("Exceeds max parameters".into());
        }
        
        if proposed_params > current_params + self.max_increase_per_step {
            return SafetyResult::Violation("Step too large".into());
        }
        
        SafetyResult::Safe
    }
}
```

### 2.3 Expressiveness Bound

Measure model expressiveness via Rademacher complexity:

```rust
pub struct ExpressivenessBound {
    max_rademacher: f32,
    sample_size: usize,
}

impl ExpressivenessBound {
    /// Estimate Rademacher complexity empirically
    pub fn estimate_rademacher(&self, model: &Model, data: &[Sample]) -> f32 {
        let mut total = 0.0;
        
        for _ in 0..self.sample_size {
            // Random Rademacher labels
            let labels: Vec<f32> = (0..data.len())
                .map(|_| if rand::random() { 1.0 } else { -1.0 })
                .collect();
            
            // Compute correlation with model outputs
            let outputs: Vec<f32> = data.iter()
                .map(|x| model.forward(x))
                .collect();
            
            let correlation: f32 = outputs.iter()
                .zip(labels.iter())
                .map(|(o, l)| o * l)
                .sum::<f32>() / data.len() as f32;
            
            total += correlation.abs();
        }
        
        total / self.sample_size as f32
    }
    
    pub fn check(&self, proposed: &Model, data: &[Sample]) -> SafetyResult {
        let rademacher = self.estimate_rademacher(proposed, data);
        
        if rademacher > self.max_rademacher {
            SafetyResult::Violation(format!(
                "Rademacher complexity {} exceeds bound {}",
                rademacher, self.max_rademacher
            ))
        } else {
            SafetyResult::Safe
        }
    }
}
```

## 3. Capability Difference Metrics

### 3.1 Behavioral Distance

```rust
pub struct BehavioralDistance {
    test_cases: Vec<TestCase>,
    max_divergence: f32,
}

impl BehavioralDistance {
    pub fn compute(&self, model_a: &Model, model_b: &Model) -> f32 {
        let divergences: Vec<f32> = self.test_cases.iter()
            .map(|tc| {
                let out_a = model_a.forward(&tc.input);
                let out_b = model_b.forward(&tc.input);
                
                // KL divergence or L2 distance
                kl_divergence(&out_a, &out_b)
            })
            .collect();
        
        // Max or average divergence
        divergences.iter().cloned().fold(0.0, f32::max)
    }
    
    pub fn check(&self, current: &Model, proposed: &Model) -> SafetyResult {
        let distance = self.compute(current, proposed);
        
        if distance > self.max_divergence {
            SafetyResult::Violation(format!(
                "Behavioral divergence {} exceeds max {}",
                distance, self.max_divergence
            ))
        } else {
            SafetyResult::Safe
        }
    }
}
```

### 3.2 Capability Probe Tests

```rust
pub struct CapabilityProbe {
    probes: Vec<CapabilityTest>,
    max_capability_score: f32,
}

pub struct CapabilityTest {
    name: String,
    input: Vec<f32>,
    check: Box<dyn Fn(&[f32]) -> f32>,  // Returns capability score
}

impl CapabilityProbe {
    pub fn evaluate(&self, model: &Model) -> CapabilityReport {
        let scores: Vec<(String, f32)> = self.probes.iter()
            .map(|probe| {
                let output = model.forward(&probe.input);
                let score = (probe.check)(&output);
                (probe.name.clone(), score)
            })
            .collect();
        
        CapabilityReport { scores }
    }
    
    pub fn check(&self, proposed: &Model) -> SafetyResult {
        let report = self.evaluate(proposed);
        
        for (name, score) in &report.scores {
            if *score > self.max_capability_score {
                return SafetyResult::Violation(format!(
                    "Capability '{}' score {} exceeds max {}",
                    name, score, self.max_capability_score
                ));
            }
        }
        
        SafetyResult::Safe
    }
}
```

## 4. Gradual Capability Release

Allow capability increase only with oversight:

```rust
pub struct GradualRelease {
    stages: Vec<CapabilityStage>,
    current_stage: usize,
    required_oversight_hours: u32,
}

pub struct CapabilityStage {
    name: String,
    max_parameters: usize,
    max_compute: u64,
    allowed_operations: Vec<String>,
}

impl GradualRelease {
    pub fn propose_advancement(&self) -> Option<AdvancementRequest> {
        if self.current_stage + 1 >= self.stages.len() {
            return None;
        }
        
        Some(AdvancementRequest {
            from_stage: self.current_stage,
            to_stage: self.current_stage + 1,
            required_oversight: self.required_oversight_hours,
            justification_required: true,
        })
    }
    
    pub fn check_bounds(&self, proposed: &Architecture) -> SafetyResult {
        let stage = &self.stages[self.current_stage];
        
        if proposed.count_parameters() > stage.max_parameters {
            return SafetyResult::Violation("Exceeds stage parameter limit".into());
        }
        
        if proposed.estimate_flops() as u64 > stage.max_compute {
            return SafetyResult::Violation("Exceeds stage compute limit".into());
        }
        
        SafetyResult::Safe
    }
}
```

## 5. Hard Limits (Non-negotiable)

```rust
pub struct HardLimits {
    absolute_max_params: usize,      // e.g., 100B
    absolute_max_flops: u64,         // e.g., 10^18
    forbidden_operations: Vec<String>,
    required_properties: Vec<Property>,
}

impl HardLimits {
    pub fn check(&self, proposed: &Architecture) -> SafetyResult {
        // These cannot be overridden
        
        if proposed.count_parameters() > self.absolute_max_params {
            return SafetyResult::HardViolation("Absolute parameter limit".into());
        }
        
        for op in &proposed.operations {
            if self.forbidden_operations.contains(op) {
                return SafetyResult::HardViolation(format!("Forbidden operation: {}", op));
            }
        }
        
        for prop in &self.required_properties {
            if !proposed.has_property(prop) {
                return SafetyResult::HardViolation(format!("Missing required property: {:?}", prop));
            }
        }
        
        SafetyResult::Safe
    }
}
```

## 6. Monitoring Dashboard

```rust
pub struct CapabilityMonitor {
    history: Vec<CapabilitySnapshot>,
    alerts: Vec<Alert>,
}

impl CapabilityMonitor {
    pub fn log(&mut self, architecture: &Architecture, model: &Model) {
        let snapshot = CapabilitySnapshot {
            timestamp: now(),
            parameters: architecture.count_parameters(),
            flops: architecture.estimate_flops(),
            capability_scores: self.evaluate_capabilities(model),
        };
        
        // Check for rapid growth
        if let Some(prev) = self.history.last() {
            let growth_rate = (snapshot.parameters as f32 / prev.parameters as f32) - 1.0;
            if growth_rate > 0.1 {
                self.alerts.push(Alert::RapidGrowth { rate: growth_rate });
            }
        }
        
        self.history.push(snapshot);
    }
    
    pub fn generate_report(&self) -> CapabilityReport {
        CapabilityReport {
            current: self.history.last().cloned(),
            growth_trend: self.compute_trend(),
            alerts: self.alerts.clone(),
            projected_breach: self.project_breach(),
        }
    }
}
```
