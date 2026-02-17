import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { createKeyRateLimiter } from '../../../middleware/rateLimitByKey.js';
import { AuthenticatedRequest } from '../../../middleware/authentication.js';

describe('Rate Limit By Key Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Mock request
    mockRequest = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET',
    };

    // Mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    // Mock next function
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createKeyRateLimiter', () => {
    it('should allow requests under the limit', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      mockRequest.apiKey = 'test-key-1';

      // Make 5 requests (all should pass)
      for (let i = 0; i < 5; i++) {
        limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding the limit', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 3,
      });

      mockRequest.apiKey = 'test-key-2';

      // Make 3 requests (should pass)
      for (let i = 0; i < 3; i++) {
        limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      }

      // 4th request should be blocked
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Rate limit exceeded'),
        })
      );
    });

    it('should track limits per API key independently', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      // Key 1 - make 2 requests
      mockRequest.apiKey = 'test-key-1';
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Key 2 - should still be able to make requests
      mockRequest.apiKey = 'test-key-2';
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(4);
      expect(mockResponse.status).not.toHaveBeenCalled();

      // Key 1 - should be blocked now
      mockRequest.apiKey = 'test-key-1';
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(4); // Still 4, not 5
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });

    it('should fall back to IP address when no API key is present', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      // No API key set
      mockRequest.apiKey = undefined;
      mockRequest.ip = '192.168.1.1';

      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);

      // 3rd request should be blocked
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });

    it('should set rate limit headers', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });

      mockRequest.apiKey = 'test-key-3';

      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should include retry-after information in error response', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      mockRequest.apiKey = 'test-key-4';

      // First request passes
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Second request is blocked
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAfter: expect.stringContaining('seconds'),
        })
      );
    });

    it('should use custom error message when provided', () => {
      const customMessage = 'Custom rate limit message';
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        message: customMessage,
      });

      mockRequest.apiKey = 'test-key-5';

      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: customMessage,
        })
      );
    });

    it('should reset count after window expires', (done) => {
      const limiter = createKeyRateLimiter({
        windowMs: 100, // 100ms window
        maxRequests: 1,
      });

      mockRequest.apiKey = 'test-key-6';

      // First request passes
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second request is blocked
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Wait for window to expire
      setTimeout(() => {
        // Third request should pass (window reset)
        limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(2);
        done();
      }, 150);
    }, 10000);

    it('should handle requests with no IP and no API key gracefully', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      mockRequest.apiKey = undefined;
      mockRequest.ip = undefined;

      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);

      // Should still rate limit using 'unknown' identifier
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Rate limit tracking across different IPs', () => {
    it('should track limits per IP independently when no API key', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      // IP 1
      mockRequest.ip = '192.168.1.1';
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // IP 2
      mockRequest.ip = '192.168.1.2';
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(4);

      // IP 1 should be blocked
      mockRequest.ip = '192.168.1.1';
      limiter(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(4);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });
});
