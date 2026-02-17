/**
 * Rate Limit Monitor
 * 
 * Tracks and reports rate limit usage for external APIs.
 * Provides real-time monitoring and alerting capabilities.
 */

import { logger } from './logger.js';

export type MonitoredService = 'coingecko' | 'etherscan' | 'github';

export interface RateLimitMetrics {
  used: number;
  limit: number;
  window: number;  // Window in milliseconds
  windowStart: number;  // Timestamp of window start
}

export interface RateLimitStatus {
  service: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  resetAt: Date;
  isNearLimit: boolean;
}

export class RateLimitMonitor {
  private metrics: Map<MonitoredService, RateLimitMetrics>;
  private readonly WARNING_THRESHOLD = 0.8; // 80% usage triggers warning
  private resetInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.metrics = new Map();
    this.initializeMetrics();
    
    // Auto-reset windows periodically
    this.startWindowResetTimer();
  }

  /**
   * Initialize metrics for all monitored services
   */
  private initializeMetrics(): void {
    const now = Date.now();
    
    this.metrics.set('coingecko', {
      used: 0,
      limit: parseInt(process.env.COINGECKO_RATE_LIMIT || '30'),
      window: 60000,  // 1 minute
      windowStart: now,
    });

    this.metrics.set('etherscan', {
      used: 0,
      limit: parseInt(process.env.ETHERSCAN_RATE_LIMIT || '5'),
      window: 1000,   // 1 second
      windowStart: now,
    });

    this.metrics.set('github', {
      used: 0,
      limit: parseInt(process.env.GITHUB_RATE_LIMIT || '5000'),
      window: 3600000,  // 1 hour
      windowStart: now,
    });
  }

  /**
   * Start automatic window reset timer
   */
  private startWindowResetTimer(): void {
    this.resetInterval = setInterval(() => {
      this.resetExpiredWindows();
    }, 1000); // Check every second
  }

  /**
   * Reset windows that have expired
   */
  private resetExpiredWindows(): void {
    const now = Date.now();

    for (const [service, metric] of this.metrics.entries()) {
      if (now - metric.windowStart >= metric.window) {
        const oldUsed = metric.used;
        metric.used = 0;
        metric.windowStart = now;
        
        if (oldUsed > 0) {
          logger.info('Rate limit window reset', { service, previousUsage: `${oldUsed}/${metric.limit}` });
        }
      }
    }
  }

  /**
   * Increment usage counter for a service
   */
  incrementUsage(service: MonitoredService): void {
    const metric = this.metrics.get(service);
    
    if (!metric) {
      logger.warn('Unknown service for rate limit monitoring', { service });
      return;
    }

    metric.used++;

    // Check if approaching limit
    const percentage = (metric.used / metric.limit) * 100;
    if (percentage >= this.WARNING_THRESHOLD * 100) {
      logger.warn('Rate limit warning', {
        service,
        percentage: percentage.toFixed(1) + '%',
        used: metric.used,
        limit: metric.limit
      });
    }
  }

  /**
   * Get current status for a service
   */
  getStatus(service: MonitoredService): RateLimitStatus | null {
    const metric = this.metrics.get(service);
    
    if (!metric) {
      return null;
    }

    const remaining = Math.max(0, metric.limit - metric.used);
    const percentage = (metric.used / metric.limit) * 100;
    const resetAt = new Date(metric.windowStart + metric.window);

    return {
      service,
      used: metric.used,
      limit: metric.limit,
      remaining,
      percentage,
      resetAt,
      isNearLimit: percentage >= this.WARNING_THRESHOLD * 100,
    };
  }

  /**
   * Get status for all services
   */
  getAllStatus(): RateLimitStatus[] {
    const statuses: RateLimitStatus[] = [];

    for (const service of this.metrics.keys()) {
      const status = this.getStatus(service);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  /**
   * Check if service is near limit
   */
  isNearLimit(service: MonitoredService): boolean {
    const metric = this.metrics.get(service);
    
    if (!metric) {
      return false;
    }

    const percentage = (metric.used / metric.limit);
    return percentage >= this.WARNING_THRESHOLD;
  }

  /**
   * Check if service has exceeded limit
   */
  hasExceededLimit(service: MonitoredService): boolean {
    const metric = this.metrics.get(service);
    
    if (!metric) {
      return false;
    }

    return metric.used >= metric.limit;
  }

  /**
   * Manually reset a service's window
   */
  resetWindow(service: MonitoredService): void {
    const metric = this.metrics.get(service);
    
    if (!metric) {
      return;
    }

    metric.used = 0;
    metric.windowStart = Date.now();
    logger.info('Rate limit window manually reset', { service });
  }

  /**
   * Update rate limit for a service
   */
  updateLimit(service: MonitoredService, newLimit: number): void {
    const metric = this.metrics.get(service);
    
    if (!metric) {
      return;
    }

    const oldLimit = metric.limit;
    metric.limit = newLimit;
    logger.info('Rate limit updated', { service, oldLimit, newLimit });
  }

  /**
   * Get summary of all services
   */
  getSummary(): string {
    const statuses = this.getAllStatus();
    const lines = ['Rate Limit Summary:', ''];

    for (const status of statuses) {
      const bar = this.createProgressBar(status.percentage);
      lines.push(
        `${status.service.padEnd(12)} ${bar} ${status.used}/${status.limit} (${status.percentage.toFixed(1)}%)`
      );
    }

    return lines.join('\n');
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(percentage: number, width: number = 20): string {
    // Clamp percentage between 0 and 100
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    const filled = Math.round((clampedPercentage / 100) * width);
    const empty = width - filled;
    return `[${'#'.repeat(filled)}${'-'.repeat(empty)}]`;
  }

  /**
   * Dispose and clean up resources
   */
  dispose(): void {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = null;
    }
    this.metrics.clear();
    logger.info('RateLimitMonitor disposed');
  }
}
