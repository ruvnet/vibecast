#!/usr/bin/env node
/**
 * Sandbox Localhost Proxy
 * Runs inside Claude Code Web sandbox container
 * Provides localhost:8080 proxy for remote API access
 */

import express from 'express';
import fetch from 'node-fetch';
import { createServer } from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';

const app = express();
const PORT = process.env.PROXY_PORT || 8080;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Allowed hosts (can be configured via env)
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ||
  'api.openrouter.ai,api.anthropic.com,api.perplexity.ai,generativelanguage.googleapis.com,api-inference.huggingface.co'
).split(',');

// Create proxy agent if HTTP_PROXY is set (for sandbox outbound access)
const proxyAgent = process.env.HTTP_PROXY ? new HttpsProxyAgent(process.env.HTTP_PROXY) : null;

if (proxyAgent) {
  console.log('✅ Using HTTP_PROXY:', process.env.HTTP_PROXY.substring(0, 30) + '...');
}

// Request logging
const logRequest = (method, url, status, duration) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    method,
    url,
    status,
    duration,
    type: 'proxy-request'
  }));
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sandbox-proxy',
    version: '1.0.0',
    uptime: process.uptime(),
    port: PORT,
    environment: 'sandbox-localhost',
    allowedHosts: ALLOWED_HOSTS
  });
});

// Main proxy route
app.post('/route', async (req, res) => {
  const startTime = Date.now();

  try {
    const { url, method = 'GET', headers = {}, body } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Parse and validate host
    let targetHost;
    try {
      targetHost = new URL(url).hostname;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check if host is allowed
    if (!ALLOWED_HOSTS.includes(targetHost)) {
      logRequest(method, url, 403, Date.now() - startTime);
      return res.status(403).json({
        error: 'Blocked host',
        host: targetHost,
        allowedHosts: ALLOWED_HOSTS
      });
    }

    // Make proxied request
    const fetchOptions = {
      method,
      headers: {
        ...headers,
        'User-Agent': 'Claude-Sandbox-Proxy/1.0'
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Add proxy agent if available (for sandbox outbound access)
    if (proxyAgent) {
      fetchOptions.agent = proxyAgent;
    }

    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;

    // Get response data
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    logRequest(method, url, response.status, duration);

    // Return proxied response
    res.status(response.status).json({
      status: response.status,
      statusText: response.statusText,
      data,
      duration,
      headers: Object.fromEntries(response.headers.entries())
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Proxy error:', error);
    logRequest(req.body?.method || 'UNKNOWN', req.body?.url || 'unknown', 500, duration);

    res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
});

// Batch proxy route
app.post('/batch', async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests)) {
      return res.status(400).json({ error: 'Requests must be an array' });
    }

    if (requests.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 requests per batch' });
    }

    // Process all requests in parallel
    const results = await Promise.all(
      requests.map(async (request, index) => {
        try {
          const { url, method = 'GET', headers = {}, body } = request;

          const targetHost = new URL(url).hostname;
          if (!ALLOWED_HOSTS.includes(targetHost)) {
            return { index, error: 'Blocked host', url };
          }

          const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            agent: proxyAgent // Add proxy agent for sandbox outbound access
          });

          const data = await response.json();

          return {
            index,
            status: response.status,
            data
          };
        } catch (error) {
          return {
            index,
            error: error.message,
            url: request.url
          };
        }
      })
    );

    res.json({ results });

  } catch (error) {
    res.status(500).json({
      error: 'Batch request failed',
      message: error.message
    });
  }
});

// Start server
const server = createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log('═'.repeat(70));
  console.log('🚀 Sandbox Localhost Proxy Started');
  console.log('═'.repeat(70));
  console.log(`Port: ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Environment: Sandbox Container`);
  console.log(`Allowed Hosts: ${ALLOWED_HOSTS.length}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  /health - Health check`);
  console.log(`  POST /route  - Proxy single request`);
  console.log(`  POST /batch  - Proxy batch requests (max 10)`);
  console.log('');
  console.log('✅ Ready to proxy API requests from Claude Code Web');
  console.log('═'.repeat(70));
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
