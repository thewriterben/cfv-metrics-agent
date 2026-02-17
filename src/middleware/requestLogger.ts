import { Request, Response, NextFunction, RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Request Context Logging Middleware
 * 
 * Provides comprehensive request logging with:
 * - Unique request IDs for tracing
 * - Request and response logging
 * - Duration tracking
 * - Error context capture
 */

// Extend Express Request type to include custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Request logging middleware
 */
export const requestLogger: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  const requestId = randomUUID();
  req.requestId = requestId;
  req.startTime = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || Date.now());
    
    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    };
    
    // Use appropriate log level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
};

/**
 * Error logging middleware (should be added after all routes)
 */
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Request error', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack
  });
  
  next(err);
};

export default requestLogger;
