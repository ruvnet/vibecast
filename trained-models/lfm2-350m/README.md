---
license: apache-2.0
tags:
- sona
- lora
- federated-learning
- lfm2-350m
base_model: liquid/lfm2-350m
---

# SONA-Trained LFM2-350M

This adapter was trained using SONA (Self-Optimizing Neural Architecture) federated learning.

## Training Details

- **Base Model**: LFM2-350M (350M)
- **Hidden Dimension**: 1024
- **Context Length**: 32768
- **Training Trajectories**: 1750
- **Federated Agents**: 12
- **LoRA Rank**: 8

## Usage

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained("liquid/lfm2-350m")
model = PeftModel.from_pretrained(model, "path/to/lfm2-350m")
```

## Quantization

Recommended: int4-awq
Estimated memory: 167MB

## SONA Benefits

- Federated learning across ephemeral agents
- EWC++ prevents catastrophic forgetting
- Dual-loop LoRA adaptation (micro + base)
- Pattern-based query routing
