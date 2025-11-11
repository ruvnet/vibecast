# OpenRouter API Integration Guide

Complete guide for integrating and using the OpenRouter API in your projects.

## 📋 Table of Contents

1. [What is OpenRouter?](#what-is-openrouter)
2. [Quick Start](#quick-start)
3. [Using the Demo Script](#using-the-demo-script)
4. [API Reference](#api-reference)
5. [Available Models](#available-models)
6. [Pricing](#pricing)
7. [Best Practices](#best-practices)

## What is OpenRouter?

OpenRouter is a unified API gateway that provides access to multiple AI models from different providers through a single interface. It supports:

- **342+ Models** from 55+ providers
- **Unified API** - One API format for all models
- **Pay-as-you-go** - No subscriptions required
- **Free Models** - 47+ free models available for testing
- **High Performance** - Sub-second response times

### Supported Providers

- OpenAI (GPT-4, GPT-3.5, etc.)
- Anthropic (Claude 3.5 Sonnet, Opus, etc.)
- Google (Gemini, PaLM)
- Meta (Llama models)
- Mistral AI
- Cohere
- And 50+ more...

## Quick Start

### 1. Get an API Key

1. Visit [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up or log in
3. Create a new API key
4. Copy your key (keep it secure!)

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

Or install manually:

```bash
pip install requests
```

### 3. Set Up Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```env
OPENROUTER_API_KEY=sk-or-v1-...your-key-here...
```

### 4. Test Connectivity

```bash
python openrouter_demo.py test
```

Expected output:
```
🔍 Testing OpenRouter API connectivity...

✅ Successfully connected to OpenRouter API
📊 Found 342 available models

Statistics:
  • Total models: 342
  • Free models: 47
  • Unique providers: 55
```

## Using the Demo Script

The `openrouter_demo.py` script provides a comprehensive CLI for testing and using OpenRouter.

### Available Commands

#### Test Connectivity

Test basic API connectivity without requiring an API key:

```bash
python openrouter_demo.py test
```

#### List Models

List all available models:

```bash
python openrouter_demo.py list
```

List models from a specific provider:

```bash
python openrouter_demo.py list --provider anthropic
python openrouter_demo.py list --provider openai
python openrouter_demo.py list --provider google
```

List only free models:

```bash
python openrouter_demo.py list --free
```

Sort by context length (largest first):

```bash
python openrouter_demo.py list --sort context --limit 10
```

Show detailed information:

```bash
python openrouter_demo.py list --provider anthropic --detailed
```

#### Chat Completion

Send a simple message (requires API key):

```bash
python openrouter_demo.py chat "What is the capital of France?"
```

Use a specific model:

```bash
# Use Claude
python openrouter_demo.py chat "Explain quantum computing" \
  --model anthropic/claude-3.5-sonnet

# Use GPT-4
python openrouter_demo.py chat "Write a haiku" \
  --model openai/gpt-4

# Use a free model
python openrouter_demo.py chat "Tell me a joke" \
  --model google/gemini-flash-1.5
```

Stream the response:

```bash
python openrouter_demo.py chat "Tell me a story" --stream
```

Adjust temperature (0-2):

```bash
# More focused/deterministic (0.1-0.3)
python openrouter_demo.py chat "What is 2+2?" --temperature 0.1

# More creative (0.8-1.5)
python openrouter_demo.py chat "Write a poem" --temperature 1.2
```

Limit response length:

```bash
python openrouter_demo.py chat "Explain AI" --max-tokens 100
```

### Environment Variables

The script supports these environment variables:

- `OPENROUTER_API_KEY` - Your OpenRouter API key (required for chat)
- `OPENROUTER_SITE_URL` - Your site URL (optional, for rankings)
- `OPENROUTER_APP_NAME` - Your app name (optional, for display)

You can also pass the API key as a command-line argument:

```bash
python openrouter_demo.py chat "Hello" --api-key sk-or-v1-...
```

## API Reference

### Python Client Usage

```python
from openrouter_demo import OpenRouterClient

# Initialize client
client = OpenRouterClient(api_key="your-key-here")

# List models
models = client.list_models()
print(f"Found {len(models)} models")

# Get specific model
model = client.get_model_by_id("anthropic/claude-3.5-sonnet")
print(f"Context length: {model['context_length']} tokens")

# Chat completion
response = client.chat_completion(
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    model="anthropic/claude-3.5-sonnet",
    temperature=0.7
)

print(response['choices'][0]['message']['content'])
```

### Streaming Example

```python
response = client.chat_completion(
    messages=[{"role": "user", "content": "Tell me a story"}],
    model="anthropic/claude-3.5-sonnet",
    stream=True
)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = line[6:]
            if data != '[DONE]':
                chunk = json.loads(data)
                content = chunk['choices'][0]['delta'].get('content', '')
                if content:
                    print(content, end='', flush=True)
```

### Multi-turn Conversation

```python
messages = [
    {"role": "user", "content": "What is Python?"},
    {"role": "assistant", "content": "Python is a high-level programming language..."},
    {"role": "user", "content": "What are its main features?"}
]

response = client.chat_completion(
    messages=messages,
    model="anthropic/claude-3.5-sonnet"
)
```

## Available Models

### Top Recommended Models

#### For General Use

- **anthropic/claude-3.5-sonnet** - Excellent balance of performance and cost
- **openai/gpt-4-turbo** - Great for complex reasoning
- **google/gemini-pro-1.5** - Good for multimodal tasks

#### For Code

- **anthropic/claude-3.5-sonnet** - Superior code understanding
- **openai/gpt-4** - Strong code generation
- **deepseek/deepseek-coder** - Specialized for coding

#### Free Models (No API Key Cost)

- **google/gemini-flash-1.5** - Fast, good quality
- **meta-llama/llama-3.2-3b-instruct** - Small but capable
- **qwen/qwen-2.5-7b-instruct** - Good general purpose
- **microsoft/phi-3-mini-128k-instruct** - Long context

### Model Categories

Check current models with:

```bash
python openrouter_demo.py list --provider <provider-name>
```

Available providers:
- `openai` - GPT models
- `anthropic` - Claude models
- `google` - Gemini models
- `meta-llama` - Llama models
- `mistralai` - Mistral models
- `cohere` - Command models
- And many more...

## Pricing

### How Pricing Works

OpenRouter uses a pay-per-token model:

- **Prompt tokens**: Input text you send
- **Completion tokens**: Output text generated
- Prices vary by model (see below)

### Example Costs

Get current pricing:

```bash
python openrouter_demo.py list --provider anthropic
```

Sample pricing (as of testing):

| Model | Prompt | Completion | Context |
|-------|--------|------------|---------|
| Claude 3.5 Sonnet | $3/1M tokens | $15/1M tokens | 200K |
| GPT-4 Turbo | $10/1M tokens | $30/1M tokens | 128K |
| GPT-3.5 Turbo | $0.50/1M tokens | $1.50/1M tokens | 16K |
| Gemini Flash 1.5 | Free | Free | 1M |

### Cost Estimation

The demo script shows estimated costs after each request:

```bash
python openrouter_demo.py chat "Explain quantum physics"
```

Output includes:
```
📊 Statistics:
   Time: 2.34s
   Prompt tokens: 12
   Completion tokens: 150
   Total tokens: 162
   Estimated cost: $0.000486
```

## Best Practices

### 1. Model Selection

**Choose based on your needs:**

- **Complex reasoning**: Claude 3.5 Sonnet, GPT-4
- **Speed**: GPT-3.5 Turbo, Gemini Flash
- **Cost**: Free models for testing, GPT-3.5 for production
- **Long context**: Claude (200K), Gemini (1M tokens)

### 2. Prompt Engineering

**Be specific:**
```python
# ❌ Vague
"Tell me about AI"

# ✅ Specific
"Explain how transformer models work in 3 paragraphs, focusing on attention mechanisms"
```

**Use system messages:**
```python
messages = [
    {"role": "system", "content": "You are a helpful Python expert."},
    {"role": "user", "content": "How do I read a file in Python?"}
]
```

### 3. Error Handling

```python
import requests
from requests.exceptions import RequestException

try:
    response = client.chat_completion(
        messages=[{"role": "user", "content": "Hello"}],
        model="anthropic/claude-3.5-sonnet"
    )
except RequestException as e:
    print(f"API request failed: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

### 4. Rate Limiting

OpenRouter handles rate limiting automatically, but consider:

- Using exponential backoff for retries
- Caching responses when possible
- Batching requests when appropriate

### 5. Security

**Protect your API key:**

- Never commit `.env` files to git
- Use environment variables in production
- Rotate keys periodically
- Monitor usage on OpenRouter dashboard

**The `.gitignore` already includes:**
```gitignore
.env
.env.local
*.key
```

### 6. Cost Optimization

**Reduce costs:**

```python
# Use max_tokens to limit response length
response = client.chat_completion(
    messages=[{"role": "user", "content": "Explain AI"}],
    max_tokens=200  # Limit to 200 tokens
)

# Use cheaper models for simple tasks
simple_tasks_model = "openai/gpt-3.5-turbo"
complex_tasks_model = "anthropic/claude-3.5-sonnet"

# Cache responses for repeated queries
cache = {}
def get_completion(message):
    if message in cache:
        return cache[message]
    response = client.chat_completion(...)
    cache[message] = response
    return response
```

## Advanced Usage

### Custom Headers

```python
client = OpenRouterClient(
    api_key="your-key",
    site_url="https://yourdomain.com",  # For rankings
    app_name="Your App Name"             # For display
)
```

### Provider Preferences

You can specify provider preferences in the API call:

```python
response = client.chat_completion(
    messages=[{"role": "user", "content": "Hello"}],
    model="anthropic/claude-3.5-sonnet",
    provider={
        "order": ["Anthropic", "AWS"],  # Try Anthropic first, then AWS
        "allow_fallbacks": True
    }
)
```

### Monitoring Usage

Track your usage on the OpenRouter dashboard:

https://openrouter.ai/activity

## Troubleshooting

### Common Issues

**401 Unauthorized**
```
Error: No auth credentials found
```
Solution: Check your API key is set correctly

**429 Rate Limited**
```
Error: Rate limit exceeded
```
Solution: Wait a moment and retry with exponential backoff

**400 Bad Request**
```
Error: Invalid model ID
```
Solution: Check model ID is correct with `python openrouter_demo.py list`

### Getting Help

- OpenRouter Docs: https://openrouter.ai/docs
- OpenRouter Discord: https://discord.gg/openrouter
- OpenRouter Status: https://status.openrouter.ai

## Examples

### Example 1: Text Summarization

```python
long_text = """..."""  # Your long text here

response = client.chat_completion(
    messages=[
        {"role": "system", "content": "You are a helpful summarization assistant."},
        {"role": "user", "content": f"Summarize this text in 3 bullet points:\n\n{long_text}"}
    ],
    model="anthropic/claude-3.5-sonnet",
    temperature=0.3  # Lower temperature for more focused output
)

print(response['choices'][0]['message']['content'])
```

### Example 2: Code Review

```python
code = """
def calculate_sum(numbers):
    total = 0
    for num in numbers:
        total = total + num
    return total
"""

response = client.chat_completion(
    messages=[
        {"role": "user", "content": f"Review this code and suggest improvements:\n\n```python\n{code}\n```"}
    ],
    model="anthropic/claude-3.5-sonnet"
)
```

### Example 3: Language Translation

```python
response = client.chat_completion(
    messages=[
        {"role": "user", "content": "Translate to French: 'Hello, how are you today?'"}
    ],
    model="openai/gpt-3.5-turbo",
    temperature=0.3
)
```

### Example 4: Interactive Chatbot

```python
def chatbot():
    messages = []

    print("Chatbot started. Type 'quit' to exit.")

    while True:
        user_input = input("\nYou: ")
        if user_input.lower() == 'quit':
            break

        messages.append({"role": "user", "content": user_input})

        response = client.chat_completion(
            messages=messages,
            model="anthropic/claude-3.5-sonnet"
        )

        assistant_message = response['choices'][0]['message']['content']
        messages.append({"role": "assistant", "content": assistant_message})

        print(f"\nAssistant: {assistant_message}")

chatbot()
```

## Next Steps

1. **Get your API key**: https://openrouter.ai/keys
2. **Try the demo**: `python openrouter_demo.py test`
3. **Explore models**: `python openrouter_demo.py list`
4. **Start building**: Integrate the `OpenRouterClient` into your project

## Resources

- **OpenRouter Website**: https://openrouter.ai
- **API Documentation**: https://openrouter.ai/docs
- **Model Rankings**: https://openrouter.ai/rankings
- **Pricing**: https://openrouter.ai/models

## License

This demo code is provided as-is for educational and testing purposes.
