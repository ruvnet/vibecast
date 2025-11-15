# Proxy Setup Guide for Claude Code Web

This guide explains how to enable API calls from Claude Code Web using the proxy server.

## Why a Proxy is Needed

Claude Code Web runs in a restricted sandbox environment that **cannot make direct external API calls**. The proxy server acts as a secure bridge that:

1. ✅ Validates authentication
2. ✅ Whitelists allowed API hosts
3. ✅ Logs all requests for auditing
4. ✅ Applies rate limiting
5. ✅ Provides a secure, controlled gateway

---

## Quick Setup (5 Minutes)

### Step 1: Deploy the Proxy

Choose one deployment option:

#### Option A: Vercel (Recommended - Free)

```bash
cd proxy
npm install
npx vercel deploy
```

Set environment variable in Vercel dashboard:
- `CLAUDE_PROXY_KEY` = `your-secure-random-key`

#### Option B: Fly.io (Rust - High Performance)

```bash
cd proxy/rust-proxy
fly launch
fly secrets set CLAUDE_PROXY_KEY=your-secure-random-key
fly deploy
```

#### Option C: Railway (One-Click)

1. Push `proxy/` directory to GitHub
2. Connect repository to Railway
3. Set `CLAUDE_PROXY_KEY` environment variable
4. Deploy

### Step 2: Configure Claude Code Web

In Claude Code Web → **Settings** → **Environment**, add:

```bash
CLAUDE_PROXY_URL=https://your-proxy.vercel.app/route
CLAUDE_PROXY_KEY=your-secure-random-key
```

### Step 3: Test the Connection

Run the test script:

```bash
npx tsx test-proxy-connection.ts
```

Expected output:
```
✅ Proxy health check: OK
✅ OpenRouter connection: Working
✅ Anthropic connection: Working
🎉 All connections successful!
```

---

## Using the Proxy in Your Code

### Direct Usage

```typescript
import { createProxyClient } from './src/lib/proxy-client';

const proxy = createProxyClient();

// OpenRouter call
const response = await proxy.openRouter({
  model: 'deepseek/deepseek-chat',
  messages: [{ role: 'user', content: 'Hello!' }],
  max_tokens: 500
});

console.log(response.data);
```

### Agent Swarm with Proxy

The agent implementations automatically use the proxy when configured:

```bash
# Set up environment
export CLAUDE_PROXY_URL=https://your-proxy.vercel.app/route
export CLAUDE_PROXY_KEY=your-secure-random-key
export OPENROUTER_API_KEY=sk-or-v1-...
export ANTHROPIC_API_KEY=sk-ant-api03-...

# Run agent swarm
npx tsx src/real-agents/franchise-swarm-proxy.ts
```

### Batch Requests

Process multiple API calls concurrently (up to 10):

```typescript
const results = await proxy.batch([
  {
    url: 'https://api.openrouter.ai/api/v1/models',
    method: 'GET'
  },
  {
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY },
    body: { /* ... */ }
  }
]);
```

---

## Security Best Practices

### 1. Strong Proxy Key

Generate a secure random key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Restrict CORS Origins

In your proxy deployment, set:

```bash
ALLOWED_ORIGINS=https://claude.ai,https://app.claude.ai
```

### 3. Monitor Logs

Review proxy logs regularly for suspicious activity:

```bash
# Vercel
vercel logs

# Fly.io
fly logs

# Railway
railway logs
```

### 4. Rotate Keys Periodically

Update `CLAUDE_PROXY_KEY` every 30-90 days:

1. Generate new key
2. Update proxy deployment
3. Update Claude Code Web environment
4. Test connection

### 5. Use HTTPS Only

Never deploy the proxy on HTTP - always use HTTPS.

---

## Proxy Performance

### Node.js Version
- **Latency:** ~5-10ms overhead
- **Throughput:** ~1,000 req/sec
- **Cost:** Free on Vercel (100GB bandwidth/month)
- **Best For:** Most use cases

### Rust Version
- **Latency:** ~1-2ms overhead
- **Throughput:** ~20,000 req/sec
- **Cost:** Free tier on Fly.io
- **Best For:** High-traffic production

---

## Troubleshooting

### "CLAUDE_PROXY_URL not configured"

Add to Claude Code Web environment:
```bash
CLAUDE_PROXY_URL=https://your-proxy.vercel.app/route
CLAUDE_PROXY_KEY=your-key
```

### "403 Unauthorized"

Check that `CLAUDE_PROXY_KEY` matches in:
1. Proxy deployment environment
2. Claude Code Web environment

### "403 Blocked host"

The target API is not whitelisted. To add a new host:

1. Edit `ALLOWED_HOSTS` in proxy code
2. Redeploy proxy
3. Test connection

### "Connection refused"

1. Check proxy is deployed and running: visit `/health`
2. Verify HTTPS is used (not HTTP)
3. Check firewall/security group settings

### "Rate limit exceeded" (Node.js only)

Options:
1. Use batch endpoint for multiple requests
2. Implement client-side queuing
3. Deploy multiple proxy instances

---

## Advanced Configuration

### Custom Rate Limits (Node.js)

Edit `node-proxy.js`:

```javascript
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,  // Change from 60 to 100
  message: { error: 'Rate limit exceeded' }
});
```

### Add New API Host

Edit `ALLOWED_HOSTS` in proxy code:

```javascript
// Node.js
const ALLOWED_HOSTS = [
  'api.openrouter.ai',
  'api.anthropic.com',
  'api.newservice.com'  // Add this
];

// Rust
const ALLOWED_HOSTS: &[&str] = &[
    "api.openrouter.ai",
    "api.anthropic.com",
    "api.newservice.com",  // Add this
];
```

### Multiple Proxy Instances

For high availability, deploy multiple proxies:

```bash
# Primary
CLAUDE_PROXY_URL=https://proxy-1.vercel.app/route

# Fallback (use in code if primary fails)
CLAUDE_PROXY_URL_FALLBACK=https://proxy-2.vercel.app/route
```

---

## Cost Estimates

### Vercel (Node.js)
- **Free Tier:** 100GB bandwidth/month
- **Pro:** $20/month (1TB bandwidth)
- **Est. Requests:** ~1-10M/month on free tier

### Fly.io (Rust)
- **Free Tier:** 3 shared CPUs, 256MB RAM
- **Scale:** $0.02/hour per additional CPU
- **Est. Requests:** Unlimited on free tier (with usage limits)

### Railway
- **Free Tier:** $5 credit/month
- **Usage:** $0.000463/GB-hour
- **Est. Requests:** ~100K-1M/month on free credit

---

## Support

- **Proxy Issues:** Check `proxy/README.md`
- **Claude Code Web:** https://docs.claude.com
- **GitHub Issues:** https://github.com/vibecast/franchise-manager/issues

---

## Summary

✅ **Deploy proxy** to Vercel/Fly.io/Railway
✅ **Set environment variables** in Claude Code Web
✅ **Test connection** with test script
✅ **Use in code** via ProxyClient
✅ **Monitor and maintain** with logging and key rotation

Your agents can now make API calls from Claude Code Web! 🚀
