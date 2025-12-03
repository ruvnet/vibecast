---
license: apache-2.0
tags:
- sona
- lora
- federated-learning
- smollm2-135m
base_model: HuggingFaceTB/SmolLM2-135M
---

# SONA-Trained SmolLM2-135M

This adapter was trained using SONA (Self-Optimizing Neural Architecture) federated learning.

## Training Details

- **Base Model**: SmolLM2-135M (135M)
- **Hidden Dimension**: 576
- **Context Length**: 8192
- **Training Trajectories**: 1750
- **Federated Agents**: 12
- **LoRA Rank**: 8

## Usage

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained("HuggingFaceTB/SmolLM2-135M")
model = PeftModel.from_pretrained(model, "path/to/smollm2-135m")
```

## Quantization

Recommended: int4-awq
Estimated memory: 64MB

## SONA Benefits

- Federated learning across ephemeral agents
- EWC++ prevents catastrophic forgetting
- Dual-loop LoRA adaptation (micro + base)
- Pattern-based query routing
