# Claude Code Web Proxy

Secure proxy server for API calls from Claude Code Web sandbox environment.

## Overview

Claude Code Web runs in a restricted sandbox that cannot make direct external API calls. This proxy server enables secure, controlled access to approved AI APIs.

## Features

- ✅ **Host Whitelisting** - Only approved API endpoints allowed
- ✅ **Authentication** - API key validation on all requests
- ✅ **Rate Limiting** - 60 requests/minute per IP (Node.js)
- ✅ **Request Logging** - Complete audit trail
- ✅ **Batch Requests** - Process up to 10 concurrent requests
- ✅ **CORS Support** - Cross-origin requests enabled
- ✅ **Health Checks** - `/health` endpoint for monitoring
- ✅ **Two Implementations** - Node.js and Rust (high-performance)

## Allowed API Hosts

- `api.openrouter.ai` - OpenRouter (DeepSeek, etc.)
- `api.anthropic.com` - Anthropic Claude
- `api.perplexity.ai` - Perplexity AI
- `generativelanguage.googleapis.com` - Google Gemini
- `api-inference.huggingface.co` - Hugging Face

## Quick Start

### Node.js Version

```bash
cd proxy
npm install express node-fetch cors express-rate-limit
node node-proxy.js
```

Environment variables:
```bash
export PORT=8080
export CLAUDE_PROXY_KEY=your-secure-key-here
export ALLOWED_ORIGINS=https://claude.ai
```

### Rust Version (High Performance)

```bash
cd proxy/rust-proxy
cargo build --release
./target/release/claude-proxy
```

Environment variables:
```bash
export PORT=8080
export CLAUDE_PROXY_KEY=your-secure-key-here
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "claude-proxy",
  "version": "1.0.0",
  "uptime": 12345
}
```

### Single Request Proxy

```bash
POST /route
```

Request body:
```json
{
  "url": "https://api.openrouter.ai/api/v1/chat/completions",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer sk-or-v1-...",
    "Content-Type": "application/json"
  },
  "body": {
    "model": "deepseek/deepseek-chat",
    "messages": [{"role": "user", "content": "Hello"}]
  },
  "key": "your-proxy-key"
}
```

Response:
```json
{
  "status": 200,
  "statusText": "OK",
  "data": { ... },
  "duration": 1234,
  "headers": { ... }
}
```

### Batch Request Proxy

```bash
POST /batch
```

Request body:
```json
{
  "requests": [
    {
      "url": "https://api.openrouter.ai/api/v1/models",
      "method": "GET"
    },
    {
      "url": "https://api.anthropic.com/v1/messages",
      "method": "POST",
      "headers": { ... },
      "body": { ... }
    }
  ],
  "key": "your-proxy-key"
}
```

## Claude Code Web Configuration

### 1. Deploy Proxy

Deploy to any hosting platform:
- **Vercel**: `vercel deploy`
- **Fly.io**: `fly deploy`
- **Render**: Connect GitHub repo
- **Railway**: One-click deploy

### 2. Configure Claude Code Web

In Claude Code Web → Settings → Environment:

```bash
CLAUDE_PROXY_URL=https://your-proxy.vercel.app/route
CLAUDE_PROXY_KEY=your-secure-key-here
```

### 3. Use in Code

```typescript
import * as dotenv from 'dotenv';
dotenv.config();

async function callAPI(url: string, options: any) {
  const response = await fetch(process.env.CLAUDE_PROXY_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      key: process.env.CLAUDE_PROXY_KEY
    })
  });

  const result = await response.json();
  return result.data;
}

// Use it
const aiResponse = await callAPI('https://api.openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: {
    model: 'deepseek/deepseek-chat',
    messages: [{ role: 'user', content: 'Hello!' }]
  }
});
```

## Security Best Practices

1. **Use HTTPS Only** - Never deploy on HTTP
2. **Rotate Keys** - Change `CLAUDE_PROXY_KEY` periodically
3. **Monitor Logs** - Review request logs regularly
4. **Limit Origins** - Restrict CORS to trusted domains
5. **Update Dependencies** - Keep packages up-to-date
6. **No Wildcard Domains** - Only whitelist specific hosts

## Performance

### Node.js
- ~5-10ms latency overhead
- ~1,000 req/sec on single core
- Good for most use cases

### Rust
- ~1-2ms latency overhead
- ~20,000 req/sec on single core
- Best for high-traffic scenarios

## Deployment Examples

### Vercel (Node.js)

```json
{
  "version": 2,
  "builds": [
    { "src": "proxy/node-proxy.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "proxy/node-proxy.js" }
  ],
  "env": {
    "CLAUDE_PROXY_KEY": "@claude-proxy-key"
  }
}
```

### Fly.io (Rust)

```toml
# fly.toml
app = "claude-proxy"

[build]
  builder = "paketobuildpacks/builder:base"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

### Docker (Both)

```dockerfile
# Node.js
FROM node:20-alpine
WORKDIR /app
COPY proxy/node-proxy.js package.json ./
RUN npm install
CMD ["node", "node-proxy.js"]

# Rust
FROM rust:1.75 as builder
WORKDIR /app
COPY proxy/rust-proxy ./
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/claude-proxy /usr/local/bin/
CMD ["claude-proxy"]
```

## Troubleshooting

### 403 Forbidden - Unauthorized
- Check `CLAUDE_PROXY_KEY` matches in proxy and client
- Verify key is passed in request body

### 403 Forbidden - Blocked host
- Ensure target API is in `ALLOWED_HOSTS`
- Check URL format is correct

### 500 Internal Server Error
- Check proxy server logs
- Verify target API is accessible
- Confirm API credentials are valid

### Rate Limit Exceeded (Node.js only)
- Implement request queuing
- Use batch endpoint
- Deploy multiple proxy instances

## License

MIT License - See LICENSE file

## Support

- **Issues**: https://github.com/vibecast/franchise-manager/issues
- **Documentation**: Full franchise platform docs
- **Examples**: See `examples/` directory
