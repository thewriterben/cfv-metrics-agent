import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';
import { AuthenticatedRequest } from './authentication.js';

/**
 * Per-API-Key Rate Limiting
 * 
 * Provides rate limiting based on API key instead of IP address.
 * Falls back to IP-based limiting if no API key is present.
 */

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

/**
 * Create a rate limiter that tracks limits per API key
 */
export function createKeyRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, message } = options;

  // Store for tracking requests per key
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  // Cleanup old entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
      if (data.resetTime < now) {
        requestCounts.delete(key);
      }
    }
  }, 60000);

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Use API key if available, otherwise use IP
    const identifier = req.apiKey || req.ip || 'unknown';
    const now = Date.now();

    let data = requestCounts.get(identifier);

    // Initialize or reset if window expired
    if (!data || data.resetTime < now) {
      data = {
        count: 0,
        resetTime: now + windowMs
      };
      requestCounts.set(identifier, data);
    }

    // Increment count
    data.count++;

    // Check if limit exceeded
    if (data.count > maxRequests) {
      const retryAfter = Math.ceil((data.resetTime - now) / 1000);
      
      logger.warn('Rate limit exceeded', {
        identifier: req.apiKey ? 'API_KEY:' + req.apiKey.substring(0, 8) + '...' : `IP:${req.ip}`,
        path: req.path,
        method: req.method,
        count: data.count,
        limit: maxRequests
      });

      res.status(429).json({
        success: false,
        error: message || 'Rate limit exceeded. Please try again later.',
        retryAfter: `${retryAfter} seconds`
      });
      return;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - data.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(data.resetTime).toISOString());

    next();
  };
}

/**
 * Strict rate limiter for expensive operations (per-key)
 * Default: 10 requests per minute per API key
 */
export const strictKeyLimiter = createKeyRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_STRICT_WINDOW_MS || '60000'),
  maxRequests: parseInt(process.env.RATE_LIMIT_STRICT_MAX_REQUESTS || '10'),
  message: 'Too many requests. This endpoint is strictly rate-limited.'
});

/**
 * Standard rate limiter for normal operations (per-key)
 * Default: 100 requests per 15 minutes per API key
 */
export const standardKeyLimiter = createKeyRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '900000'),
  maxRequests: parseInt(process.env.RATE_LIMIT_API_MAX_REQUESTS || '100'),
  message: 'Rate limit exceeded. Please try again later.'
});
