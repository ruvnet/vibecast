import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Rate limit store (in-memory)
 * In production, use Redis or similar distributed cache
 */
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  /**
   * Increment request count for client
   * Returns current count and reset time
   */
  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetTime < now) {
      // Create new window
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, resetTime };
    }

    // Increment existing window
    existing.count++;
    this.store.set(key, existing);
    return existing;
  }

  /**
   * Reset count for client
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }
}

// Global rate limit store
const rateLimitStore = new RateLimitStore();

// Cleanup expired entries every minute
setInterval(() => rateLimitStore.cleanup(), 60000);

/**
 * Rate limiting middleware per client
 * Based on ADR-001 Security Considerations
 *
 * Default limits:
 * - 100 requests per minute per client
 * - 1000 requests per hour per client
 */
export function rateLimitMiddleware(config?: Partial<RateLimitConfig>) {
  const defaultConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests, please try again later',
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  };

  const finalConfig = { ...defaultConfig, ...config };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Get client identifier (use authenticated client ID if available, fallback to IP)
    const clientId = req.auth?.clientId || req.ip || 'unknown';
    const key = `ratelimit:${clientId}`;

    // Increment request count
    const { count, resetTime } = rateLimitStore.increment(key, finalConfig.windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', finalConfig.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, finalConfig.maxRequests - count).toString());
    res.setHeader('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());

    // Check if limit exceeded
    if (count > finalConfig.maxRequests) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      return res.status(429).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: finalConfig.message,
        retryAfter
      });
    }

    // Track response status to optionally skip counting
    if (finalConfig.skipSuccessfulRequests || finalConfig.skipFailedRequests) {
      const originalSend = res.send;
      res.send = function(data: any) {
        const shouldSkip =
          (finalConfig.skipSuccessfulRequests && res.statusCode < 400) ||
          (finalConfig.skipFailedRequests && res.statusCode >= 400);

        if (shouldSkip) {
          // Decrement count since we're skipping this request
          const current = rateLimitStore['store'].get(key);
          if (current && current.count > 0) {
            current.count--;
            rateLimitStore['store'].set(key, current);
          }
        }

        return originalSend.call(this, data);
      };
    }

    next();
  };
}

/**
 * Strict rate limit for document uploads
 * More conservative limits for resource-intensive operations
 */
export function uploadRateLimitMiddleware() {
  return rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 uploads per minute
    message: 'Upload rate limit exceeded, please try again later',
    skipFailedRequests: true // Don't count failed uploads against limit
  });
}

/**
 * Query rate limit for read operations
 * More lenient for queries
 */
export function queryRateLimitMiddleware() {
  return rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 queries per minute
    message: 'Query rate limit exceeded, please try again later'
  });
}

/**
 * Reset rate limit for specific client (admin use)
 */
export function resetRateLimit(clientId: string): void {
  rateLimitStore.reset(`ratelimit:${clientId}`);
}
