import { DatabaseManager } from '../database/DatabaseManager.js';
import { logger } from './logger.js';

/**
 * Enhanced Health Check System
 * 
 * Provides comprehensive health monitoring with:
 * - Component-level health checks
 * - Response time tracking
 * - System resource monitoring
 * - Kubernetes-compatible probes
 */

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  error?: string;
  lastCheck: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: ComponentHealth;
    system: ComponentHealth;
  };
  uptime: number;
  version?: string;
}

export class HealthChecker {
  private db?: DatabaseManager;

  constructor(db?: DatabaseManager) {
    this.db = db;
  }

  /**
   * Get overall health status
   */
  async checkHealth(): Promise<HealthStatus> {
    const timestamp = new Date();
    
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkSystemResources()
    ]);

    const database = checks[0].status === 'fulfilled' 
      ? checks[0].value 
      : this.failedCheck('Database check failed');
      
    const system = checks[1].status === 'fulfilled'
      ? checks[1].value
      : this.failedCheck('System check failed');

    const overallStatus = this.aggregateStatus([database, system]);

    return {
      status: overallStatus,
      timestamp,
      checks: {
        database,
        system
      },
      uptime: process.uptime(),
      version: process.env.npm_package_version
    };
  }

  /**
   * Check database health
   */
  async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    
    try {
      if (!this.db) {
        return {
          status: 'degraded',
          message: 'Database not configured',
          lastCheck: new Date()
        };
      }

      const isHealthy = await this.db.testConnection();
      const responseTime = Date.now() - start;
      
      if (!isHealthy) {
        return {
          status: 'unhealthy',
          responseTime,
          message: 'Database connection failed',
          lastCheck: new Date()
        };
      }

      return {
        status: 'healthy',
        responseTime,
        message: 'Database connection OK',
        lastCheck: new Date()
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Database health check failed', { error });
      
      return {
        status: 'unhealthy',
        responseTime,
        message: 'Database health check error',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check system resources
   */
  async checkSystemResources(): Promise<ComponentHealth> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Convert to MB
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
      const rssMB = memoryUsage.rss / 1024 / 1024;
      
      // Check if memory usage is concerning (>90% heap used)
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'System resources OK';
      
      if (heapUsagePercent > 90) {
        status = 'unhealthy';
        message = `High memory usage: ${heapUsagePercent.toFixed(1)}%`;
      } else if (heapUsagePercent > 80) {
        status = 'degraded';
        message = `Elevated memory usage: ${heapUsagePercent.toFixed(1)}%`;
      }

      return {
        status,
        message,
        lastCheck: new Date()
      };
    } catch (error) {
      logger.error('System health check failed', { error });
      
      return {
        status: 'unhealthy',
        message: 'System health check error',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      };
    }
  }

  /**
   * Aggregate component statuses into overall status
   */
  private aggregateStatus(components: ComponentHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = components.map(c => c.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Create a failed check result
   */
  private failedCheck(message: string): ComponentHealth {
    return {
      status: 'unhealthy',
      message,
      lastCheck: new Date()
    };
  }
}

export default HealthChecker;
