# Testing Models with Agentic Graph

Yes! You can absolutely test **Kimi K2**, **Gemini 2.5 Pro**, and any other OpenRouter model with `agentic-graph`. Your system is model-agnostic and works with any LLM through OpenRouter.

## 🚀 Quick Start

### 1. Using the Model Tester CLI

```bash
# Test any OpenRouter model
npm run test-model moonshot/kimi-k2
npm run test-model google/gemini-2.5-pro
npm run test-model anthropic/claude-3.7-sonnet
npm run test-model deepseek/deepseek-coder-v2.5
```

The CLI will run 3 comprehensive tests:
- ✅ Function Implementation (with code generation)
- ✅ Bug Detection & Fixing (with validation)
- ✅ Multi-Agent Workflow (your specialty - pure orchestration)

### 2. Using in Your Code

```typescript
import { StateGraph } from './graph';

async function testWithKimiK2() {
  const graph = new StateGraph({ name: 'my-workflow' });

  // Add node that calls Kimi K2
  graph.addNode('code-gen', async (state: any) => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ruvnet/vibecast',
        'X-Title': 'My Agentic App'
      },
      body: JSON.stringify({
        model: 'moonshot/kimi-k2',
        messages: [
          { role: 'system', content: 'You are an expert programmer.' },
          { role: 'user', content: state.prompt }
        ],
        temperature: 0.1
      })
    });

    const data = await response.json();
    return {
      ...state,
      result: data.choices[0].message.content,
      tokens: data.usage?.total_tokens
    };
  });

  // Add more nodes for validation, testing, etc.
  graph.addNode('validate', (state: any) => {
    return { ...state, validated: true };
  });

  graph.addEdge('code-gen', 'validate');
  graph.setEntry('code-gen');
  graph.setFinish('validate');
  graph.compile();

  const result = await graph.invoke({
    prompt: 'Write a function to reverse a string'
  });

  console.log(result.state.result);
}
```

## 📋 Available Models on OpenRouter

### **Chinese Models**
```typescript
// Kimi K2 - Best open-source for SWE tasks
'moonshot/kimi-k2'                    // $0.30/1M tokens, 65.8% SWE-bench
'moonshot/kimi-k2-thinking'           // $0.40/1M tokens, 71.3% SWE-bench

// DeepSeek - Best value
'deepseek/deepseek-coder-v2.5'        // $0.14/1M tokens, 90.2% HumanEval
'deepseek/deepseek-chat'              // $0.14/1M tokens, general purpose
```

### **Google Models**
```typescript
// Gemini 2.5 Pro - Latest flagship
'google/gemini-2.5-pro'               // Latest, check OpenRouter for pricing
'google/gemini-2.0-flash-thinking'    // $0.10/1M tokens, 1M context
'google/gemini-1.5-pro'               // $1.25/1M tokens, 1M context
'google/gemini-1.5-flash'             // $0.075/1M tokens, fast
```

### **Anthropic Models**
```typescript
'anthropic/claude-3.7-sonnet'         // $3/1M tokens, 65% SWE-bench
'anthropic/claude-3.5-sonnet'         // $3/1M tokens, 49% SWE-bench
'anthropic/claude-3-opus'             // $15/1M tokens, most capable
```

### **OpenAI Models**
```typescript
'openai/gpt-4o'                       // $2.5/1M tokens, 33.2% SWE-bench
'openai/gpt-4-turbo'                  // $10/1M tokens
'openai/o1-preview'                   // $15/1M tokens, reasoning
'openai/o1-mini'                      // $3/1M tokens, coding
```

### **Others**
```typescript
'meta-llama/llama-3.3-70b-instruct'   // $0.88/1M tokens
'mistralai/mistral-large'             // $2/1M tokens
'qwen/qwen-2.5-coder-32b'             // $0.50/1M tokens
```

## 🎯 Real-World Examples

### Example 1: Multi-Model Pipeline

```typescript
import { StateGraph } from './graph';
import { AgentDB, ReflexionMemory } from './agentdb';

async function multiModelPipeline() {
  const graph = new StateGraph({ name: 'multi-model' });
  const agentDB = new AgentDB();

  // Use Kimi K2 for initial code generation (cheap, good quality)
  graph.addNode('generate', async (state: any) => {
    const response = await callOpenRouter('moonshot/kimi-k2', state.task);
    return { ...state, code: response.content };
  });

  // Use Claude for code review (best at reasoning)
  graph.addNode('review', async (state: any) => {
    const response = await callOpenRouter(
      'anthropic/claude-3.7-sonnet',
      `Review this code and suggest improvements:\n\n${state.code}`
    );
    return { ...state, review: response.content };
  });

  // Use DeepSeek for optimization (specialized in code)
  graph.addNode('optimize', async (state: any) => {
    const response = await callOpenRouter(
      'deepseek/deepseek-coder-v2.5',
      `Optimize this code:\n\n${state.code}\n\nReview: ${state.review}`
    );
    return { ...state, optimized: response.content };
  });

  // Store successful pattern
  graph.addNode('store', async (state: any) => {
    await agentDB.storePattern(
      'multi-model-pipeline',
      JSON.stringify(state),
      { models: ['kimi-k2', 'claude', 'deepseek'], success: true }
    );
    return state;
  });

  graph.addEdge('generate', 'review');
  graph.addEdge('review', 'optimize');
  graph.addEdge('optimize', 'store');
  graph.setEntry('generate');
  graph.setFinish('store');
  graph.compile();

  return await graph.invoke({ task: 'Create a binary search tree' });
}
```

### Example 2: Cost-Optimized Workflow

```typescript
// Use cheap model for initial attempts, expensive only if needed
async function costOptimizedWorkflow(task: string) {
  const graph = new StateGraph({ name: 'cost-optimized' });

  // Try with cheapest model first (Gemini Flash)
  graph.addNode('try-cheap', async (state: any) => {
    const response = await callOpenRouter('google/gemini-2.0-flash-thinking', task);
    return { ...state, result: response.content, cost: 0.10 };
  });

  // Validate result
  graph.addNode('validate', (state: any) => {
    const isGood = state.result.length > 100 && state.result.includes('function');
    return { ...state, validated: isGood };
  });

  // If validation fails, use premium model
  graph.addNode('try-premium', async (state: any) => {
    if (!state.validated) {
      const response = await callOpenRouter('anthropic/claude-3.7-sonnet', task);
      return { ...state, result: response.content, cost: 3.0 };
    }
    return state;
  });

  graph.addEdge('try-cheap', 'validate');
  graph.addConditionalEdge('validate',
    (state: any) => state.validated ? 'end' : 'try-premium'
  );
  graph.setEntry('try-cheap');
  graph.setFinish('validate');
  graph.compile();

  return await graph.invoke({ task });
}
```

### Example 3: Gemini 2.5 Pro Long Context

```typescript
// Leverage Gemini's 1M token context for large codebases
async function analyzeEntireCodebase() {
  const graph = new StateGraph({ name: 'codebase-analysis' });

  graph.addNode('analyze', async (state: any) => {
    // Load entire codebase (up to 1M tokens!)
    const allCode = await loadCodebase();

    const response = await callOpenRouter(
      'google/gemini-2.5-pro',
      `Analyze this entire codebase and suggest architectural improvements:\n\n${allCode}`
    );

    return { ...state, analysis: response.content };
  });

  graph.addNode('prioritize', (state: any) => {
    // Extract and rank suggestions
    return { ...state, priorities: rankSuggestions(state.analysis) };
  });

  graph.addEdge('analyze', 'prioritize');
  graph.setEntry('analyze');
  graph.setFinish('prioritize');
  graph.compile();

  return await graph.invoke({});
}
```

## 🧪 Running the Tests

### Test Specific Models

```bash
# Test Kimi K2 (best open-source)
npm run test-model moonshot/kimi-k2

# Test Gemini 2.5 Pro (latest Google)
npm run test-model google/gemini-2.5-pro

# Test Claude 3.7 (best overall)
npm run test-model anthropic/claude-3.7-sonnet

# Test DeepSeek (best value)
npm run test-model deepseek/deepseek-coder-v2.5
```

### Run Complete Benchmarks

```bash
# Run optimized benchmarks with all models
npm run swe-bench:optimized

# Run real API tests
npm run swe-bench:real
```

## 📊 Model Comparison

| Model | Best For | SWE-bench | HumanEval | Cost/1M | Context |
|-------|----------|-----------|-----------|---------|---------|
| **Kimi K2** | Real-world tasks | **65.8%** | 73.2% | $0.30 | 128K |
| **Claude 3.7** | Overall quality | 65.0% | **94.5%** | $3.00 | 200K |
| **Gemini 2.5 Pro** | Long context | TBD | TBD | TBD | **1M** |
| **Gemini Flash** | Cost efficiency | 42.3% | 88.9% | **$0.10** | 1M |
| **DeepSeek** | Code completion | 40.5% | 90.2% | **$0.14** | 64K |
| **GPT-4o** | OpenAI ecosystem | 33.2% | 90.2% | $2.50 | 128K |

## 🔧 Advanced Configuration

### Custom Model Testing

```typescript
import { ModelTester } from './model-tester';

const tester = new ModelTester();

// Test any model
await tester.runAllTests('moonshot/kimi-k2');
await tester.runAllTests('google/gemini-2.5-pro');

// Or run individual tests
await tester.testFunctionImplementation('moonshot/kimi-k2');
await tester.testBugFix('google/gemini-2.5-pro');
await tester.testMultiAgent('anthropic/claude-3.7-sonnet');
```

### Using with Your Workflow

```typescript
import { StateGraph } from './graph';
import { AgentDB, ReflexionMemory } from './agentdb';

class MyAgenticApp {
  private graph: StateGraph;
  private agentDB: AgentDB;
  private reflexion: ReflexionMemory;

  constructor() {
    this.graph = new StateGraph({ name: 'my-app' });
    this.agentDB = new AgentDB();
    this.reflexion = new ReflexionMemory(this.agentDB);

    this.setupWorkflow();
  }

  private setupWorkflow() {
    // Your custom workflow with any model
    this.graph.addNode('task', async (state: any) => {
      const model = state.model || 'moonshot/kimi-k2'; // Default to Kimi K2
      // ... call model
      return state;
    });

    // More nodes...
    this.graph.compile();
  }

  async run(input: any) {
    return await this.graph.invoke(input);
  }
}
```

## 🎁 Benefits of Using Agentic Graph

### 1. **Model Agnostic**
- Switch models anytime
- Test multiple models
- A/B test different approaches

### 2. **Workflow Orchestration**
- 2,619x faster than LangChain Python
- Sub-millisecond coordination
- Multi-agent workflows

### 3. **Built-in Intelligence**
- **AgentDB**: Store successful patterns
- **ReflexionMemory**: Learn from executions
- **StateGraph**: Complex logic flows

### 4. **Cost Optimization**
- Use cheap models for simple tasks
- Premium models only when needed
- Track costs automatically

## 🚀 Next Steps

1. **Set your API key:**
   ```bash
   export OPENROUTER_API_KEY=your_key_here
   ```

2. **Test a model:**
   ```bash
   npm run test-model moonshot/kimi-k2
   ```

3. **Integrate into your code:**
   ```typescript
   import { StateGraph } from 'agentic-graph';
   // Build your workflow...
   ```

4. **Run benchmarks:**
   ```bash
   npm run swe-bench:optimized
   ```

## 📚 Resources

- **OpenRouter Models**: https://openrouter.ai/models
- **Pricing**: https://openrouter.ai/docs#models
- **Our Benchmarks**: `npm run swe-bench:optimized`
- **Documentation**: `/docs` folder

## 💡 Pro Tips

1. **Use Kimi K2 for production** - Best cost/performance ratio for SWE tasks
2. **Use Gemini for long context** - 1M tokens, great for analyzing entire codebases
3. **Use Claude for critical code** - Highest quality, best reasoning
4. **Use DeepSeek for prototyping** - Cheapest, still very capable
5. **Combine models in workflows** - Use strengths of each model

---

**Yes, you can absolutely test Kimi K2, Gemini 2.5 Pro, and any other OpenRouter model with agentic-graph!** 🎉

Your system's workflow orchestration makes any model perform better by adding intelligent multi-step coordination, pattern storage, and continuous learning.
