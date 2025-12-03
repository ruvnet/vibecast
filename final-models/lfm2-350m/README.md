# SONA-Optimized LFM2-350M

## Overview

This model was trained using SONA (Self-Optimizing Neural Architecture) with optimized hyperparameters.

| Metric | Value |
|--------|-------|
| Parameters | 350M |
| Hidden Dim | 1024 |
| Context Length | 32768 |
| Final Quality | 0.728 |
| Throughput | 6297 ops/sec |

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Micro-LoRA Rank | 1 |
| Base-LoRA Rank | 16 |
| Learning Rate | 0.005 |
| Total Trajectories | 4000 |
| Training Time | 125.1s |

## Training Phases

1. **Bootstrap**
2. **Foundation**
3. **Refinement**
4. **Mastery**

## Quick Start

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("liquid/lfm2-350m")
tokenizer = AutoTokenizer.from_pretrained("liquid/lfm2-350m")

# With LoRA adapter
from peft import PeftModel
model = PeftModel.from_pretrained(model, "./lfm2-350m")
```

## Quantization

For deployment, we recommend INT4-AWQ:

```bash
# Memory: ~175MB
pip install autoawq
```

## Files

- `manifest.json` - Complete training manifest
- `adapter_config.json` - PEFT-compatible LoRA config
- `quantization.json` - Quantization guide
- `load_model.py` - Python loader script
