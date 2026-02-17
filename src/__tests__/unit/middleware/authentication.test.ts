import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin, optionalAuth, AuthenticatedRequest } from '../../../middleware/authentication.js';

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Setup environment with test API keys
    process.env.API_KEYS = 'test-key-1,test-key-2,test-key-3';
    process.env.ADMIN_API_KEYS = 'admin-key-1,admin-key-2';

    // Mock request
    mockRequest = {
      get: jest.fn(),
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET',
      params: {},
      query: {},
    };

    // Mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock next function
    mockNext = jest.fn();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should allow valid API key via X-API-Key header', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'test-key-1';
        return undefined;
      });

      requireAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.apiKey).toBe('test-key-1');
      expect(mockRequest.isAdmin).toBe(false);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow valid API key via Authorization Bearer header', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'Authorization') return 'Bearer test-key-2';
        return undefined;
      });

      requireAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.apiKey).toBe('test-key-2');
      expect(mockRequest.isAdmin).toBe(false);
    });

    it('should allow admin API key and set isAdmin flag', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'admin-key-1';
        return undefined;
      });

      requireAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.apiKey).toBe('admin-key-1');
      expect(mockRequest.isAdmin).toBe(true);
    });

    it('should reject request with no API key', () => {
      (mockRequest.get as jest.Mock).mockReturnValue(undefined);

      requireAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Authentication required'),
        })
      );
    });

    it('should reject request with invalid API key', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'invalid-key';
        return undefined;
      });

      requireAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid API key',
        })
      );
    });

    it('should handle empty API_KEYS environment variable', () => {
      process.env.API_KEYS = '';
      process.env.ADMIN_API_KEYS = '';

      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'any-key';
        return undefined;
      });

      requireAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAdmin', () => {
    it('should allow authenticated admin user', () => {
      mockRequest.apiKey = 'admin-key-1';
      mockRequest.isAdmin = true;

      requireAdmin(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated user', () => {
      // No apiKey set

      requireAdmin(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authentication required',
        })
      );
    });

    it('should reject non-admin authenticated user', () => {
      mockRequest.apiKey = 'test-key-1';
      mockRequest.isAdmin = false;

      requireAdmin(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Admin privileges required',
        })
      );
    });
  });

  describe('optionalAuth', () => {
    it('should add auth info for valid API key', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'test-key-1';
        return undefined;
      });

      optionalAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.apiKey).toBe('test-key-1');
      expect(mockRequest.isAdmin).toBe(false);
    });

    it('should add admin flag for admin API key', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'admin-key-1';
        return undefined;
      });

      optionalAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.apiKey).toBe('admin-key-1');
      expect(mockRequest.isAdmin).toBe(true);
    });

    it('should continue without auth info when no API key provided', () => {
      (mockRequest.get as jest.Mock).mockReturnValue(undefined);

      optionalAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.apiKey).toBeUndefined();
      expect(mockRequest.isAdmin).toBeUndefined();
    });

    it('should continue without auth info when invalid API key provided', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'invalid-key';
        return undefined;
      });

      optionalAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.apiKey).toBeUndefined();
      expect(mockRequest.isAdmin).toBeUndefined();
    });
  });

  describe('API key extraction', () => {
    it('should prefer X-API-Key header over Authorization header', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'test-key-1';
        if (header === 'Authorization') return 'Bearer test-key-2';
        return undefined;
      });

      requireAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.apiKey).toBe('test-key-1');
    });

    it('should handle malformed Authorization header', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'Authorization') return 'InvalidFormat';
        return undefined;
      });

      requireAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should handle Authorization header without Bearer prefix', () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'Authorization') return 'test-key-1';
        return undefined;
      });

      requireAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });
});
