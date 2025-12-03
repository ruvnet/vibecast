# SONA-Optimized Qwen2.5-0.5B

## Overview

This model was trained using SONA (Self-Optimizing Neural Architecture) with optimized hyperparameters.

| Metric | Value |
|--------|-------|
| Parameters | 0.5B |
| Hidden Dim | 896 |
| Context Length | 32768 |
| Final Quality | 0.737 |
| Throughput | 7215 ops/sec |

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Micro-LoRA Rank | 1 |
| Base-LoRA Rank | 16 |
| Learning Rate | 0.005 |
| Total Trajectories | 4000 |
| Training Time | 108.4s |

## Training Phases

1. **Bootstrap**
2. **Foundation**
3. **Refinement**
4. **Mastery**

## Quick Start

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-0.5B")
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B")

# With LoRA adapter
from peft import PeftModel
model = PeftModel.from_pretrained(model, "./qwen2.5-0.5b")
```

## Quantization

For deployment, we recommend INT4-AWQ:

```bash
# Memory: ~250MB
pip install autoawq
```

## Files

- `manifest.json` - Complete training manifest
- `adapter_config.json` - PEFT-compatible LoRA config
- `quantization.json` - Quantization guide
- `load_model.py` - Python loader script
