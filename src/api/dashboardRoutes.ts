import { Router, Request, Response } from 'express';
import { HealthChecker } from '../utils/HealthChecker.js';
import { metricsCollector } from '../utils/MetricsCollector.js';
import { performanceMonitor } from '../utils/PerformanceMonitor.js';
import { logger } from '../utils/logger.js';

/**
 * Dashboard and Metrics Routes
 * 
 * Provides endpoints for:
 * - Complete dashboard data
 * - Metrics in JSON and Prometheus formats
 * - Performance statistics
 * - System information
 */

export interface DashboardRoutesConfig {
  healthChecker: HealthChecker;
}

export function createDashboardRoutes(config: DashboardRoutesConfig): Router {
  const router = Router();
  const { healthChecker } = config;

  /**
   * GET /dashboard
   * Complete dashboard data
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const [health, metrics, performance] = await Promise.all([
        healthChecker.checkHealth(),
        Promise.resolve(metricsCollector.getMetrics()),
        Promise.resolve(performanceMonitor.getAllStats())
      ]);

      res.json({
        health,
        metrics,
        performance,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Dashboard data retrieval failed', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /metrics
   * All metrics in JSON format
   */
  router.get('/metrics', (req: Request, res: Response) => {
    try {
      const metrics = metricsCollector.getMetrics();
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Metrics retrieval failed', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /metrics/prometheus
   * Metrics in Prometheus format
   */
  router.get('/metrics/prometheus', (req: Request, res: Response) => {
    try {
      const prometheusData = metricsCollector.exportPrometheus();
      res.set('Content-Type', 'text/plain');
      res.send(prometheusData);
    } catch (error) {
      logger.error('Prometheus export failed', { error });
      res.status(500).send('# Error exporting metrics\n');
    }
  });

  /**
   * GET /metrics/performance
   * Performance statistics
   */
  router.get('/metrics/performance', (req: Request, res: Response) => {
    try {
      const stats = performanceMonitor.getAllStats();
      res.json({
        success: true,
        data: stats,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Performance stats retrieval failed', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /metrics/system
   * System resource metrics
   */
  router.get('/metrics/system', (req: Request, res: Response) => {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      res.json({
        success: true,
        data: {
          uptime: process.uptime(),
          memory: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
            arrayBuffers: memoryUsage.arrayBuffers
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          process: {
            pid: process.pid,
            version: process.version,
            platform: process.platform,
            arch: process.arch
          }
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('System metrics retrieval failed', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export default createDashboardRoutes;
