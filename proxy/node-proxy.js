#!/usr/bin/env node
/**
 * Claude Code Web Proxy - Node.js Implementation
 * Secure proxy for API calls from Claude Code Web sandbox
 */

import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 8080;
const AUTH_KEY = process.env.CLAUDE_PROXY_KEY || 'change-me-in-production';

// Allowed API endpoints
const ALLOWED_HOSTS = [
  'api.openrouter.ai',
  'api.anthropic.com',
  'api.perplexity.ai',
  'generativelanguage.googleapis.com',
  'api-inference.huggingface.co'
];

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['POST', 'GET', 'OPTIONS']
}));

// Rate limiting: 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Rate limit exceeded. Max 60 requests per minute.' }
});

app.use('/route', limiter);

// Request logging
const logRequest = (req, targetUrl, status, error = null) => {
  const log = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    method: req.body.method || 'GET',
    targetUrl,
    status,
    error,
    userAgent: req.headers['user-agent']
  };
  console.log(JSON.stringify(log));
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'claude-proxy',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Main proxy endpoint
app.post('/route', async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, body, key } = req.body;

    // Validate auth key
    if (key !== AUTH_KEY) {
      logRequest(req, url, 403, 'Unauthorized - Invalid key');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Validate URL
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid URL' });
    }

    // Parse and validate target host
    let targetHost;
    try {
      targetHost = new URL(url).hostname;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check if host is allowed
    if (!ALLOWED_HOSTS.includes(targetHost)) {
      logRequest(req, url, 403, `Blocked host: ${targetHost}`);
      return res.status(403).json({
        error: 'Blocked host',
        allowedHosts: ALLOWED_HOSTS
      });
    }

    // Make the proxied request
    const fetchOptions = {
      method,
      headers: {
        ...headers,
        'User-Agent': 'Claude-Code-Proxy/1.0'
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const startTime = Date.now();
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

    // Log successful request
    logRequest(req, url, response.status);

    // Return proxied response
    res.status(response.status).json({
      status: response.status,
      statusText: response.statusText,
      data,
      duration,
      headers: Object.fromEntries(response.headers.entries())
    });

  } catch (error) {
    console.error('Proxy error:', error);
    logRequest(req, req.body?.url, 500, error.message);
    res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
});

// Batch proxy endpoint (for concurrent requests)
app.post('/batch', async (req, res) => {
  try {
    const { requests, key } = req.body;

    if (key !== AUTH_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

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
            body: body ? JSON.stringify(body) : undefined
          });

          const data = await response.json();
          logRequest(req, url, response.status);

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

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Claude Code Proxy running on port ${PORT}`);
  console.log(`📡 Allowed hosts: ${ALLOWED_HOSTS.join(', ')}`);
  console.log(`🔐 Auth key: ${AUTH_KEY.substring(0, 10)}...`);
  console.log(`⏱️  Rate limit: 60 requests/minute per IP`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
