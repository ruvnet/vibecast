# Load SONA-trained adapter
from peft import PeftModel, PeftConfig
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load base model
base_model = "HuggingFaceTB/SmolLM2-135M"
model = AutoModelForCausalLM.from_pretrained(base_model, device_map="auto")
tokenizer = AutoTokenizer.from_pretrained(base_model)

# Load SONA adapter (after training with PEFT export)
# model = PeftModel.from_pretrained(model, "./smollm2-135m")

# For ONNX inference:
# import onnxruntime as ort
# session = ort.InferenceSession("./smollm2-135m-int4.onnx")

print(f"Loaded {base_model}")
print(f"SONA training: 1750 trajectories from 12 agents")
