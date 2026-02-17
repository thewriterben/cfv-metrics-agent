import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { requireAuth, requireAdmin, optionalAuth } from '../../../middleware/authentication.js';

describe('Authentication Middleware', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.API_KEYS = 'test-key-1,test-key-2,test-key-3';
    process.env.ADMIN_API_KEYS = 'admin-key-1,admin-key-2';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('requireAuth', () => {
    it('should allow valid API key via X-API-Key header', () => {
      const mockReq: any = {
        get: (header: string) => header === 'X-API-Key' ? 'test-key-1' : undefined,
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
      };
      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      requireAuth(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockReq.apiKey).toBe('test-key-1');
      expect(mockReq.isAdmin).toBe(false);
    });

    it('should reject request with no API key', () => {
      const mockReq: any = {
        get: () => undefined,
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
      };
      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      requireAuth(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
    });

    it('should allow admin API key and set isAdmin flag', () => {
      const mockReq: any = {
        get: (header: string) => header === 'X-API-Key' ? 'admin-key-1' : undefined,
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
      };
      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      requireAuth(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockReq.apiKey).toBe('admin-key-1');
      expect(mockReq.isAdmin).toBe(true);
    });
  });

  describe('requireAdmin', () => {
    it('should allow authenticated admin user', () => {
      const mockReq: any = {
        apiKey: 'admin-key-1',
        isAdmin: true,
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
      };
      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(true);
    });

    it('should reject non-admin authenticated user', () => {
      const mockReq: any = {
        apiKey: 'test-key-1',
        isAdmin: false,
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {
        status: function(code: number) { this.statusCode = code; return this; },
        json: function(data: any) { this.body = data; return this; },
      };
      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);
    });
  });

  describe('optionalAuth', () => {
    it('should add auth info for valid API key', () => {
      const mockReq: any = {
        get: (header: string) => header === 'X-API-Key' ? 'test-key-1' : undefined,
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {};
      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      optionalAuth(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockReq.apiKey).toBe('test-key-1');
      expect(mockReq.isAdmin).toBe(false);
    });

    it('should continue without auth info when no API key provided', () => {
      const mockReq: any = {
        get: () => undefined,
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
      };
      const mockRes: any = {};
      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      optionalAuth(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockReq.apiKey).toBeUndefined();
    });
  });
});
