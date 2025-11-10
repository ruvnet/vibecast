# Using API Keys with Vibecast Research System

## Available Secrets in Environment

I've detected the following API keys in your environment:
- ✅ **ANTHROPIC_API_KEY** - Claude API
- ✅ **PERPLEXITY_API_KEY** - Perplexity AI
- ✅ **E2B_API_KEY** - E2B sandboxing
- ❌ **OPENROUTER_API_KEY** - Not configured (needed for Kimi K2)

## Getting Your OpenRouter API Key

The Vibecast Research System uses **OpenRouter** to access the Kimi K2 model. Here's how to get started:

### Option 1: Get a Free OpenRouter API Key (Recommended)

1. Visit: https://openrouter.ai/keys
2. Sign up or log in (supports Google/GitHub)
3. Create a new API key
4. Copy the key (starts with `sk-or-v1-...`)

### Option 2: Use OpenRouter Free Credits

OpenRouter offers free credits for testing:
- Free tier includes access to many models
- Kimi K2 has both paid and free versions (`moonshotai/kimi-k2:free`)

## Configuration Options

### A. Use OpenRouter with Kimi K2 (Current Setup)

```bash
# 1. Add your OpenRouter key to .env
echo "OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE" >> .env

# 2. Test the system
ts-node test-research.ts

# 3. Start researching
npm run dev
```

### B. Alternative: Use Anthropic Claude Directly

If you prefer to use your existing Anthropic API key instead, I can modify the system to use Claude directly:

```bash
# This would bypass OpenRouter and use Claude directly
# Let me know if you want this option!
```

### C. Use Free Kimi K2 Model

Edit `.env` to use the free version:
```env
OPENROUTER_API_KEY=your_key_here
KIMI_MODEL=moonshotai/kimi-k2:free
```

## Quick Test

Once you have your OpenRouter key:

```bash
# 1. Update .env with your key
nano .env  # or use your favorite editor

# 2. Run the test script
ts-node test-research.ts

# 3. Try interactive mode
npm run dev
```

## Cost Estimates (OpenRouter)

**Kimi K2 0905 (Paid)**:
- Input: $0.15 per million tokens
- Output: $0.50 per million tokens
- Context: 256K tokens

**Kimi K2 Free**:
- Input: $0 (rate limited)
- Output: $0 (rate limited)
- Context: 128K tokens

**Estimated costs for typical research**:
- Single research query: $0.01 - $0.05
- Batch research (3 topics): $0.03 - $0.15
- Interactive session (1 hour): $0.10 - $0.50

## Alternative Configuration: Use Claude Directly

I can modify the system to use your existing **Anthropic Claude API key** instead of OpenRouter. This would:
- Use Claude Sonnet 4 directly (no OpenRouter needed)
- Leverage your existing API key
- Still provide multi-agent research capabilities

Would you like me to create this alternative configuration?

## Next Steps

Choose one of these options:

1. **Get OpenRouter Key** (5 minutes)
   - Visit https://openrouter.ai/keys
   - Add key to `.env`
   - Test with `ts-node test-research.ts`

2. **Use Free Model** (1 minute)
   - Get OpenRouter key (still needed, but free)
   - Change `KIMI_MODEL=moonshotai/kimi-k2:free` in `.env`

3. **Switch to Claude Direct** (I can implement this)
   - Use your existing Anthropic key
   - Let me know and I'll reconfigure the system

## Current Status

- ✅ System built and tested
- ✅ All dependencies installed
- ✅ TypeScript compiled successfully
- ⏳ Waiting for OpenRouter API key
- ✅ Alternative secrets available (Anthropic, Perplexity)

## Quick Commands Reference

```bash
# View current configuration
cat .env

# Edit configuration
nano .env

# Test system
ts-node test-research.ts

# Interactive mode
npm run dev

# Single research
npm start -- research "Your Topic"

# Batch research
npm start -- batch "Topic 1" "Topic 2"

# View stats
npm run stats
```

---

**Ready to proceed?**

Let me know which option you prefer:
1. I'll wait while you get an OpenRouter key
2. You want me to reconfigure for Claude direct (using your Anthropic key)
3. You have a different API provider in mind
