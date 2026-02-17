import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Authentication Middleware
 * 
 * Provides API key-based authentication for protected endpoints.
 * Supports multiple API keys with optional per-key rate limiting.
 */

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  isAdmin?: boolean;
}

/**
 * Extract API key from request headers
 * Supports both 'X-API-Key' and 'Authorization: Bearer <key>' formats
 */
function extractApiKey(req: Request): string | null {
  // Check X-API-Key header
  const apiKeyHeader = req.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Check Authorization header with Bearer token
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Validate API key against configured keys
 * Returns { valid: boolean, isAdmin: boolean }
 */
function validateApiKey(apiKey: string): { valid: boolean; isAdmin: boolean } {
  const validKeys = (process.env.API_KEYS || '').split(',').filter(k => k.trim());
  const adminKeys = (process.env.ADMIN_API_KEYS || '').split(',').filter(k => k.trim());

  // Check if key is an admin key
  if (adminKeys.includes(apiKey)) {
    return { valid: true, isAdmin: true };
  }

  // Check if key is a regular API key
  if (validKeys.includes(apiKey)) {
    return { valid: true, isAdmin: false };
  }

  return { valid: false, isAdmin: false };
}

/**
 * Authentication middleware - requires valid API key
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    logger.warn('Authentication failed: No API key provided', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid API key via X-API-Key header or Authorization: Bearer <key>.'
    });
    return;
  }

  const validation = validateApiKey(apiKey);

  if (!validation.valid) {
    logger.warn('Authentication failed: Invalid API key', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
    return;
  }

  // Store authentication info on request
  req.apiKey = apiKey;
  req.isAdmin = validation.isAdmin;

  logger.debug('Authentication successful', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    isAdmin: validation.isAdmin
  });

  next();
}

/**
 * Admin-only middleware - requires admin API key
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.apiKey) {
    logger.warn('Admin authorization failed: Not authenticated', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  if (!req.isAdmin) {
    logger.warn('Admin authorization failed: Insufficient privileges', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      apiKey: req.apiKey.substring(0, 8) + '...'
    });
    res.status(403).json({
      success: false,
      error: 'Admin privileges required'
    });
    return;
  }

  next();
}

/**
 * Optional authentication middleware - adds auth info if key is provided but doesn't require it
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const apiKey = extractApiKey(req);

  if (apiKey) {
    const validation = validateApiKey(apiKey);
    if (validation.valid) {
      req.apiKey = apiKey;
      req.isAdmin = validation.isAdmin;
    }
  }

  next();
}
