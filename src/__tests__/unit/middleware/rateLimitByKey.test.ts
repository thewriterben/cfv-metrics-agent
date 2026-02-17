import { describe, it, expect, beforeEach } from '@jest/globals';
import { createKeyRateLimiter } from '../../../middleware/rateLimitByKey.js';

describe('Rate Limit By Key Middleware', () => {
  describe('createKeyRateLimiter', () => {
    it('should allow requests under the limit', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      const mockReq: any = {
        apiKey: 'test-key-1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
        setHeader: function() { return this; },
      };
      let callCount = 0;
      const mockNext = () => { callCount++; };

      for (let i = 0; i < 5; i++) {
        limiter(mockReq, mockRes, mockNext);
      }

      expect(callCount).toBe(5);
    });

    it('should block requests exceeding the limit', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 3,
      });

      const mockReq: any = {
        apiKey: 'test-key-2',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
        setHeader: function() { return this; },
      };
      let callCount = 0;
      const mockNext = () => { callCount++; };

      for (let i = 0; i < 4; i++) {
        limiter(mockReq, mockRes, mockNext);
      }

      expect(callCount).toBe(3);
      expect(mockRes.statusCode).toBe(429);
    });

    it('should track limits per API key independently', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      let callCount = 0;
      const mockNext = () => { callCount++; };

      const mockReq1: any = {
        apiKey: 'test-key-1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes1: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
        setHeader: function() { return this; },
      };

      const mockReq2: any = {
        apiKey: 'test-key-2',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes2: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
        setHeader: function() { return this; },
      };

      limiter(mockReq1, mockRes1, mockNext);
      limiter(mockReq1, mockRes1, mockNext);
      limiter(mockReq2, mockRes2, mockNext);
      limiter(mockReq2, mockRes2, mockNext);

      expect(callCount).toBe(4);
    });

    it('should fall back to IP address when no API key is present', () => {
      const limiter = createKeyRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      const mockReq: any = {
        ip: '192.168.1.1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
        setHeader: function() { return this; },
      };
      let callCount = 0;
      const mockNext = () => { callCount++; };

      for (let i = 0; i < 3; i++) {
        limiter(mockReq, mockRes, mockNext);
      }

      expect(callCount).toBe(2);
      expect(mockRes.statusCode).toBe(429);
    });
  });
});
