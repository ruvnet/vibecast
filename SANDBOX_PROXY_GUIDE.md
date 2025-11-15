# Sandbox Localhost Proxy Guide

## Overview

The **Sandbox Localhost Proxy** runs inside the Claude Code Web sandbox container, providing a `localhost:8080` endpoint for API access without needing external hosting.

## Architecture Comparison

### External Proxy (Vercel/Fly.io)
```
Claude Code Web (browser)
    ↓ HTTPS
External Proxy (Vercel)
    ↓ HTTPS
Remote APIs
```

### Sandbox Localhost Proxy
```
Claude Code Web (browser)
    ↓ Internal
Sandbox Container
    ↓ localhost:8080
Sandbox Proxy (this container)
    ↓ Outbound HTTPS
Remote APIs
```

## Key Differences

| Feature | External Proxy | Sandbox Localhost |
|---------|----------------|-------------------|
| **Hosting** | Vercel/Fly.io/Railway | Inside sandbox |
| **URL** | https://your-proxy.vercel.app | http://localhost:8080 |
| **Setup** | Deploy once, reuse | Start per session |
| **Cost** | Free tier (with limits) | $0 (included) |
| **Latency** | +5-10ms | +1-3ms |
| **Persistence** | Always running | Session lifetime |
| **Security** | Public endpoint | Internal only |
| **Best For** | Production, shared use | Development, testing |

## Quick Start

### Step 1: Start the Proxy in Sandbox

```bash
# Inside Claude Code Web sandbox
chmod +x scripts/start-sandbox-proxy.sh
./scripts/start-sandbox-proxy.sh
```

Or manually:
```bash
npm install express node-fetch
node proxy/sandbox-proxy.js
```

### Step 2: Configure Environment

Set in Claude Code Web (or in your code):
```bash
CLAUDE_PROXY_URL=http://localhost:8080/route
OPENROUTER_API_KEY=sk-or-v1-...
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Step 3: Use the Proxy

```typescript
import { createProxyClient } from './src/lib/proxy-client';

// Client automatically detects localhost proxy
const proxy = createProxyClient({
  proxyUrl: 'http://localhost:8080/route'
  // No proxyKey needed for localhost
});

// Make API calls
const response = await proxy.openRouter({
  model: 'deepseek/deepseek-chat',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Network Architecture

### Understanding Sandbox Networking

**Important:** `localhost` in the sandbox refers to the sandbox container, NOT your personal computer.

```
┌─────────────────────────────────────────────────────────┐
│  Your Browser                                           │
│  (Claude Code Web UI)                                   │
└───────────────────────┬─────────────────────────────────┘
                        │ WebSocket/HTTP
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Sandbox Container (Remote VM)                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  localhost:8080                                   │  │
│  │  (Sandbox Proxy Server)                          │  │
│  │                                                   │  │
│  │  • Accepts requests from sandbox code           │  │
│  │  • Validates host whitelist                     │  │
│  │  • Forwards to remote APIs                      │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                                 │
│                        │ Outbound                        │
└────────────────────────┼─────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Remote APIs         │
              │  • OpenRouter        │
              │  • Anthropic         │
              │  • Perplexity        │
              │  • Google Gemini     │
              │  • Hugging Face      │
              └──────────────────────┘
```

## Configuration Options

### Environment Variables

```bash
# Proxy port (default: 8080)
PROXY_PORT=8080

# Allowed API hosts (comma-separated)
ALLOWED_HOSTS=api.openrouter.ai,api.anthropic.com,api.perplexity.ai

# Log level
LOG_LEVEL=info
```

### Adding New API Hosts

Edit `ALLOWED_HOSTS` before starting:
```bash
export ALLOWED_HOSTS="api.openrouter.ai,api.newservice.com"
node proxy/sandbox-proxy.js
```

## API Endpoints

### `GET /health`
Check proxy status:
```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "service": "sandbox-proxy",
  "version": "1.0.0",
  "uptime": 123,
  "port": 8080,
  "environment": "sandbox-localhost",
  "allowedHosts": [...]
}
```

### `POST /route`
Proxy single request:
```bash
curl -X POST http://localhost:8080/route \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.openrouter.ai/api/v1/models",
    "method": "GET"
  }'
```

### `POST /batch`
Proxy multiple requests:
```bash
curl -X POST http://localhost:8080/batch \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"url": "https://api.openrouter.ai/api/v1/models"},
      {"url": "https://api.anthropic.com/v1/messages", "method": "POST", "body": {...}}
    ]
  }'
```

## Using with Flow Nexus

### Create Sandbox with Proxy

```bash
# Create Flow Nexus sandbox
/mcp__flow-nexus__sandbox_create template=node name=proxy-sandbox

# Start proxy in sandbox
/mcp__flow-nexus__sandbox_execute id=<sandbox_id> cmd="node proxy/sandbox-proxy.js"

# Get sandbox URL
export SANDBOX_URL=$(flow-nexus-sandbox-url <sandbox_id>)

# Set environment
export CLAUDE_PROXY_URL=$SANDBOX_URL/route
```

## Code Examples

### Basic Usage

```typescript
// proxy-client automatically uses localhost when configured
import { createProxyClient } from './src/lib/proxy-client';

const proxy = createProxyClient({
  proxyUrl: 'http://localhost:8080/route'
});

const response = await proxy.openRouter({
  model: 'deepseek/deepseek-chat',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Agent Swarm with Localhost Proxy

```typescript
import { FranchiseAgentSwarm } from './src/real-agents/franchise-swarm';

// Set environment to use localhost
process.env.CLAUDE_PROXY_URL = 'http://localhost:8080/route';

const swarm = new FranchiseAgentSwarm();
await swarm.executeSwarmTask(task, data);
```

### Direct Fetch

```typescript
const response = await fetch('http://localhost:8080/route', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://api.openrouter.ai/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: {
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: 'Hello!' }]
    }
  })
});

const data = await response.json();
console.log(data.data); // API response
```

## Security Considerations

### ✅ Advantages of Localhost Proxy

1. **No Public Exposure** - Proxy is internal to sandbox
2. **No External Hosting Costs** - Runs in your container
3. **Lower Latency** - No external network hop
4. **Session Isolation** - Each session has its own proxy
5. **No Shared State** - No data leaks between users

### ⚠️ Limitations

1. **Session Lifetime** - Proxy stops when sandbox stops
2. **No Authentication** - Anyone in the sandbox can use it
3. **Restart Required** - Must start for each session
4. **Not Shared** - Each sandbox needs its own proxy
5. **Outbound Required** - Sandbox must allow external calls

## Troubleshooting

### "Connection refused" on localhost:8080

**Cause:** Proxy not started

**Solution:**
```bash
# Check if proxy is running
curl http://localhost:8080/health

# If not, start it
node proxy/sandbox-proxy.js
```

### "Blocked host" error

**Cause:** API host not whitelisted

**Solution:**
```bash
# Add host to ALLOWED_HOSTS
export ALLOWED_HOSTS="api.openrouter.ai,api.newservice.com"
node proxy/sandbox-proxy.js
```

### Proxy stops unexpectedly

**Cause:** Sandbox memory limit or crash

**Solution:**
```bash
# Check logs
tail -f proxy.log

# Restart proxy
node proxy/sandbox-proxy.js
```

### Network errors reaching APIs

**Cause:** Sandbox network restrictions

**Solution:**
1. Verify sandbox has outbound access
2. Check if API endpoint is accessible
3. Review firewall/security group settings

## Performance Tips

1. **Keep Proxy Running** - Start once per session
2. **Use Batch Endpoint** - For multiple concurrent requests
3. **Monitor Memory** - Proxy uses ~20-50MB RAM
4. **Log Rotation** - Limit log file size in long sessions

## When to Use Each Approach

### Use Sandbox Localhost When:
- ✅ Developing/testing in Claude Code Web
- ✅ Short sessions or one-time tasks
- ✅ Want lowest latency
- ✅ Don't want external hosting costs
- ✅ Need maximum privacy/isolation

### Use External Proxy When:
- ✅ Production deployments
- ✅ Multiple users/sessions
- ✅ Need persistence across sessions
- ✅ Want centralized logging/monitoring
- ✅ Prefer deploy-once approach

## Comparison Table

| Aspect | Localhost | External |
|--------|-----------|----------|
| Setup time | ~30 seconds | ~5 minutes |
| Cost | $0 | $0-$20/month |
| Latency | 1-3ms | 5-10ms |
| Reliability | Session-bound | Always available |
| Monitoring | Session logs | Centralized |
| Scaling | Per-session | Shared |
| Privacy | Maximum | Good |

## Advanced: Auto-Start Script

Add to your sandbox startup:

```bash
# .sandbox-init.sh
#!/bin/bash

# Auto-start proxy if not running
if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
  echo "Starting sandbox proxy..."
  node proxy/sandbox-proxy.js &
  sleep 2
fi

echo "✅ Proxy ready at http://localhost:8080"
```

Make executable:
```bash
chmod +x .sandbox-init.sh
```

Run on sandbox start:
```bash
source .sandbox-init.sh
```

## Summary

The **Sandbox Localhost Proxy** is perfect for:
- 🚀 Quick development and testing
- 💰 Zero hosting costs
- 🔒 Maximum security and isolation
- ⚡ Lowest possible latency

It complements the external proxy by providing a lightweight, ephemeral option for sandbox-based work while the external proxy serves production needs.

---

**Next Steps:**
1. Start the proxy: `./scripts/start-sandbox-proxy.sh`
2. Test health: `curl http://localhost:8080/health`
3. Run your agents: `npx tsx src/real-agents/franchise-swarm.ts`

🎉 Your localhost proxy is ready!
