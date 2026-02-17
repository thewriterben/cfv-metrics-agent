import { Request } from 'express';

/**
 * API Server Helper Functions
 * 
 * Utility functions for the API server.
 */

/**
 * Extract and validate symbol from request parameters
 */
export function extractSymbol(params: Record<string, any>): string {
  const symbol = params.symbol;
  
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol parameter');
  }
  
  // Basic validation - alphanumeric only
  if (!/^[A-Za-z0-9]+$/.test(symbol)) {
    throw new Error('Symbol must be alphanumeric');
  }
  
  return symbol;
}

/**
 * Dummy Sentry handlers for when Sentry is not configured
 * These allow the code to run without Sentry but can be replaced with actual Sentry integration
 */

export function sentryRequestHandler() {
  return (req: Request, res: any, next: any) => {
    // No-op when Sentry is not configured
    next();
  };
}

export function sentryTracingHandler() {
  return (req: Request, res: any, next: any) => {
    // No-op when Sentry is not configured
    next();
  };
}

export function sentryErrorHandler() {
  return (err: Error, req: Request, res: any, next: any) => {
    // No-op when Sentry is not configured
    next(err);
  };
}
