# vibecast
Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

## OpenRouter API Testing

This branch includes comprehensive OpenRouter API integration and testing tools.

### Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Test connectivity (no API key required):**
   ```bash
   python3 openrouter_demo.py test
   ```

3. **Explore available models:**
   ```bash
   # List all models
   python3 openrouter_demo.py list

   # List free models
   python3 openrouter_demo.py list --free

   # List models from specific provider
   python3 openrouter_demo.py list --provider anthropic
   ```

4. **Use chat API (requires API key):**
   ```bash
   # Set your API key
   export OPENROUTER_API_KEY=your_key_here

   # Send a message
   python3 openrouter_demo.py chat "Hello, world!"
   ```

### Files

- `openrouter_demo.py` - Full-featured CLI tool for OpenRouter API
- `OPENROUTER_GUIDE.md` - Complete integration guide and examples
- `.env.example` - Template for environment configuration
- `requirements.txt` - Python dependencies

### Features

✅ **342+ AI models** from 55+ providers
✅ **47 free models** available for testing
✅ **Chat completions** with streaming support
✅ **Cost estimation** for API calls
✅ **Model discovery** and filtering
✅ **Production-ready** Python client

See `OPENROUTER_GUIDE.md` for detailed documentation. 
