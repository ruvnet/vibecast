#!/usr/bin/env python3
"""
SONA-Optimized LFM2-350M Loader

Trained with:
  - 4000 trajectories
  - Bootstrap → Foundation → Refinement → Mastery phases
  - Final quality: 0.728
  - Throughput: 6297 ops/sec
"""

from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel, LoraConfig, get_peft_model
import torch

def load_base_model(device="auto", dtype=torch.float16):
    """Load the base model"""
    model = AutoModelForCausalLM.from_pretrained(
        "liquid/lfm2-350m",
        torch_dtype=dtype,
        device_map=device,
        trust_remote_code=True,
    )
    tokenizer = AutoTokenizer.from_pretrained("liquid/lfm2-350m")
    return model, tokenizer

def load_with_sona_lora(adapter_path=None, device="auto"):
    """Load model with SONA-trained LoRA adapter"""
    model, tokenizer = load_base_model(device)

    if adapter_path:
        model = PeftModel.from_pretrained(model, adapter_path)

    return model, tokenizer

def create_sona_lora_config():
    """Create LoRA config matching SONA training"""
    return LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.0,
        bias="none",
        task_type="CAUSAL_LM",
    )

if __name__ == "__main__":
    print("Loading LFM2-350M...")
    model, tokenizer = load_base_model()
    print(f"Model loaded: {model.config.hidden_size} hidden dim")
    print(f"Parameters: 350M")
