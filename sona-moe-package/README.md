# @ruvector/sona-moe

SONA Mixture of Experts - Federated learning for tiny LLMs with intelligent routing.

## Features

- **6 Specialized Experts**: Code, Math, Reasoning, Chat, Creative, Knowledge
- **Intelligent Routing**: 87.5% accuracy query-to-expert matching
- **High Throughput**: 3,356+ queries/sec
- **Memory Efficient**: ~270MB active (only 1-2 experts loaded)
- **Federated Learning**: Train across ephemeral agents
- **ONNX/INT4 Ready**: Export for edge deployment

## Installation

```bash
npm install @ruvector/sona-moe
```

## Quick Start

```javascript
const { createTrainedMoE } = require('@ruvector/sona-moe');

// Create and train MoE
const moe = await createTrainedMoE({
  trajectoriesPerExpert: 1000,
});

// Process queries
const result = moe.process("Write a Python function to sort a list");
console.log(result.primaryExpert); // 'code'

const result2 = moe.process("Calculate the sum of 1 to 100");
console.log(result2.primaryExpert); // 'math'
```

## Available Models

| Model | Params | INT4 Size | Best For |
|-------|--------|-----------|----------|
| SmolLM2-135M | 135M | ~67MB | Edge/Mobile |
| LFM2-350M | 350M | ~175MB | Long context (32K) |
| Qwen2.5-0.5B | 0.5B | ~250MB | Code + Multilingual |

## Expert Configuration

| Expert | Base Model | Specialization |
|--------|------------|----------------|
| Code | Qwen2.5-0.5B | Python, JS, SQL, debugging |
| Math | SmolLM2-135M | Calculations, equations |
| Reasoning | LFM2-350M | Logic, analysis, planning |
| Chat | SmolLM2-135M | Conversations |
| Creative | SmolLM2-360M | Stories, ideas |
| Knowledge | Qwen2.5-0.5B | Facts, explanations |

## API Reference

### Quick Functions

```javascript
// Create pre-configured MoE
const moe = createMoE({ topK: 2, threshold: 0.25 });

// Create and train in one step
const moe = await createTrainedMoE({ trajectoriesPerExpert: 1000 });

// Create single-model pipeline
const pipeline = createPipeline('smollm2-135m');

// Get optimal config for model
const config = getOptimalConfig('qwen2.5-0.5b');
```

### MoE Class

```javascript
const { SonaMoE } = require('@ruvector/sona-moe');

const moe = new SonaMoE({ topK: 2 });
moe.addAllExperts();

// Train specific expert
moe.trainExpert('code', [{ input: 'data', quality: 0.8 }]);

// Process query
const result = moe.process("Hello world");
// result.primaryExpert = 'chat'
// result.routing = [{ expert: 'chat', weight: 0.6 }, ...]

// Export
moe.export('./my-moe');
```

### Federated Training

```javascript
const { FederatedCoordinator, EphemeralAgent } = require('@ruvector/sona-moe');

// Create coordinator
const coordinator = new FederatedCoordinator('smollm2-135m');

// Spawn agents
const agent = new EphemeralAgent(coordinator);
await agent.process({ text: 'input' }, 0.8);
await agent.sync();
await agent.shutdown();
```

### ONNX Export

```javascript
const { ONNXExporter } = require('@ruvector/sona-moe');

// Get export commands
const config = ONNXExporter.getConfig('smollm2-135m', 'int4');
console.log(config.exportCommand);
console.log(config.estimatedMemoryMB); // 67
```

## Benchmarks

| Metric | Value |
|--------|-------|
| MoE Routing Accuracy | 87.5% |
| MoE Throughput | 3,356 queries/sec |
| SmolLM2-135M Quality Gain | +96.8% |
| LFM2-350M Quality Gain | +89.9% |
| Qwen2.5-0.5B Quality Gain | +92.3% |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SONA MoE                                │
├─────────────────────────────────────────────────────────────────┤
│   Input ──▶ Router ──▶ Top-K Experts ──▶ Weighted Combine       │
│                │                                                │
│                ├── Code Expert (Qwen2.5-0.5B)                   │
│                ├── Math Expert (SmolLM2-135M)                   │
│                ├── Reasoning Expert (LFM2-350M)                 │
│                ├── Chat Expert (SmolLM2-135M)                   │
│                ├── Creative Expert (SmolLM2-360M)               │
│                └── Knowledge Expert (Qwen2.5-0.5B)              │
└─────────────────────────────────────────────────────────────────┘
```

## License

Apache-2.0
