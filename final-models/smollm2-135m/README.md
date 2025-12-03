# SONA-Optimized SmolLM2-135M

## Overview

This model was trained using SONA (Self-Optimizing Neural Architecture) with optimized hyperparameters.

| Metric | Value |
|--------|-------|
| Parameters | 135M |
| Hidden Dim | 576 |
| Context Length | 8192 |
| Final Quality | 0.724 |
| Throughput | 9542 ops/sec |

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Micro-LoRA Rank | 1 |
| Base-LoRA Rank | 4 |
| Learning Rate | 0.005 |
| Total Trajectories | 4000 |
| Training Time | 68.4s |

## Training Phases

1. **Bootstrap**
2. **Foundation**
3. **Refinement**
4. **Mastery**

## Quick Start

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("HuggingFaceTB/SmolLM2-135M")
tokenizer = AutoTokenizer.from_pretrained("HuggingFaceTB/SmolLM2-135M")

# With LoRA adapter
from peft import PeftModel
model = PeftModel.from_pretrained(model, "./smollm2-135m")
```

## Quantization

For deployment, we recommend INT4-AWQ:

```bash
# Memory: ~68MB
pip install autoawq
```

## Files

- `manifest.json` - Complete training manifest
- `adapter_config.json` - PEFT-compatible LoRA config
- `quantization.json` - Quantization guide
- `load_model.py` - Python loader script
