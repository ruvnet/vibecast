---
license: apache-2.0
tags:
- sona
- lora
- federated-learning
- qwen2.5-0.5b
base_model: Qwen/Qwen2.5-0.5B
---

# SONA-Trained Qwen2.5-0.5B

This adapter was trained using SONA (Self-Optimizing Neural Architecture) federated learning.

## Training Details

- **Base Model**: Qwen2.5-0.5B (0.5B)
- **Hidden Dimension**: 896
- **Context Length**: 32768
- **Training Trajectories**: 1750
- **Federated Agents**: 12
- **LoRA Rank**: 8

## Usage

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-0.5B")
model = PeftModel.from_pretrained(model, "path/to/qwen2.5-0.5b")
```

## Quantization

Recommended: int4-awq
Estimated memory: 238MB

## SONA Benefits

- Federated learning across ephemeral agents
- EWC++ prevents catastrophic forgetting
- Dual-loop LoRA adaptation (micro + base)
- Pattern-based query routing
