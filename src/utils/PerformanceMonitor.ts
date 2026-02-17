import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from './logger.js';

/**
 * Performance Monitoring
 * 
 * Tracks operation performance with:
 * - Duration tracking for all operations
 * - Percentile calculations (p50, p95, p99)
 * - Automatic slow request detection
 * - Express middleware integration
 */

export interface PerformanceStats {
  count: number;
  mean: number;
  median: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private maxSamples = 10000; // Keep last 10k samples per operation

  /**
   * Record operation duration
   */
  recordDuration(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const durations = this.metrics.get(operation)!;
    durations.push(duration);
    
    // Keep only recent samples to prevent memory growth
    if (durations.length > this.maxSamples) {
      durations.shift();
    }
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operation: string): PerformanceStats | null {
    const durations = this.metrics.get(operation);
    if (!durations || durations.length === 0) {
      return null;
    }

    const sorted = [...durations].sort((a, b) => a - b);
    
    return {
      count: durations.length,
      mean: this.calculateMean(durations),
      median: sorted[Math.floor(sorted.length / 2)],
      p50: this.percentile(sorted, 0.50),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): Record<string, PerformanceStats> {
    const allStats: Record<string, PerformanceStats> = {};
    
    for (const [operation, _durations] of this.metrics) {
      const stats = this.getStats(operation);
      if (stats) {
        allStats[operation] = stats;
      }
    }
    
    return allStats;
  }

  /**
   * Clear metrics for an operation
   */
  clearMetrics(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Express middleware for automatic request tracking
   */
  middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const operationName = `${req.method} ${req.route?.path || req.path}`;
        
        this.recordDuration(operationName, duration);
        this.recordDuration('http_request_all', duration);
        
        // Log slow requests
        if (duration > 1000) {
          logger.warn('Slow request detected', {
            method: req.method,
            path: req.path,
            duration,
            statusCode: res.statusCode,
            query: req.query
          });
        }
      });
      
      next();
    };
  }

  /**
   * Wrap an async function to track its performance
   */
  track<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    
    return fn()
      .then((result) => {
        const duration = Date.now() - start;
        this.recordDuration(operationName, duration);
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - start;
        this.recordDuration(operationName, duration);
        this.recordDuration(`${operationName}_error`, duration);
        throw error;
      });
  }

  /**
   * Calculate mean of an array of numbers
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
