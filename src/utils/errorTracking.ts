import * as Sentry from '@sentry/node';
import { Application } from 'express';
import { logger } from './logger.js';

/**
 * Error Tracking with Sentry
 * 
 * Provides centralized error tracking with:
 * - Automatic error capture
 * - Context enrichment
 * - Performance tracing
 * - Release tracking
 */

let initialized = false;

export interface ErrorTrackingConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

/**
 * Initialize Sentry error tracking
 */
export function initializeErrorTracking(app?: Application, config?: ErrorTrackingConfig): void {
  const dsn = config?.dsn || process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.info('Sentry DSN not configured, error tracking disabled');
    return;
  }

  if (initialized) {
    logger.warn('Sentry already initialized');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: config?.environment || process.env.NODE_ENV || 'development',
      release: config?.release || process.env.npm_package_version,
      tracesSampleRate: config?.tracesSampleRate || 1.0,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        ...(app ? [new Sentry.Integrations.Express({ app })] : [])
      ]
    });

    initialized = true;
    logger.info('Sentry error tracking initialized', {
      environment: config?.environment || process.env.NODE_ENV,
      release: config?.release || process.env.npm_package_version
    });
  } catch (error) {
    logger.error('Failed to initialize Sentry', { error });
  }
}

/**
 * Request handler middleware (must be first)
 */
export const sentryRequestHandler = Sentry.Handlers.requestHandler;

/**
 * Tracing handler middleware (after request handler)
 */
export const sentryTracingHandler = Sentry.Handlers.tracingHandler;

/**
 * Error handler middleware (must be last)
 */
export const sentryErrorHandler = Sentry.Handlers.errorHandler;

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, any>): string {
  if (!initialized) {
    logger.error('Sentry not initialized, logging error locally', { error, context });
    return '';
  }

  return Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): string {
  if (!initialized) {
    logger.info(`Sentry message (not sent): ${message}`);
    return '';
  }

  return Sentry.captureMessage(message, level);
}

/**
 * Set user context
 */
export function setUser(user: { id?: string; email?: string; username?: string }): void {
  if (initialized) {
    Sentry.setUser(user);
  }
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  if (initialized) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}

/**
 * Set context
 */
export function setContext(name: string, context: Record<string, any>): void {
  if (initialized) {
    Sentry.setContext(name, context);
  }
}

/**
 * Check if Sentry is initialized
 */
export function isInitialized(): boolean {
  return initialized;
}

export default {
  initializeErrorTracking,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  setContext,
  isInitialized
};
