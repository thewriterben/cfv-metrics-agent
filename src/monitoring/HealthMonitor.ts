import { DatabaseManager } from '../database/DatabaseManager.js';

/**
 * Health Monitor
 * 
 * Monitors system health and provides status information.
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  components: {
    database: ComponentHealth;
    collectors: ComponentHealth;
    api: ComponentHealth;
  };
  metrics: {
    totalCoins: number;
    coinsWithData: number;
    highConfidenceCount: number;
    lastCollectionTime?: Date;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'down';
  message?: string;
  lastCheck: Date;
}

export class HealthMonitor {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  /**
   * Get overall system health
   */
  async getHealth(): Promise<HealthStatus> {
    const timestamp = new Date();

    // Check database
    const databaseHealth = await this.checkDatabase();

    // Check collectors (basic check)
    const collectorsHealth = await this.checkCollectors();

    // Check API (always healthy if this code is running)
    const apiHealth: ComponentHealth = {
      status: 'healthy',
      lastCheck: timestamp
    };

    // Get metrics summary
    const metricsSummary = await this.getMetricsSummary();

    // Determine overall status
    const componentStatuses = [
      databaseHealth.status,
      collectorsHealth.status,
      apiHealth.status
    ];

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (componentStatuses.includes('down')) {
      overallStatus = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      timestamp,
      components: {
        database: databaseHealth,
        collectors: collectorsHealth,
        api: apiHealth
      },
      metrics: metricsSummary
    };
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      const isHealthy = await this.db.testConnection();
      return {
        status: isHealthy ? 'healthy' : 'down',
        message: isHealthy ? 'Connected' : 'Connection failed',
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check collectors health
   */
  private async checkCollectors(): Promise<ComponentHealth> {
    try {
      // Check if we have recent data (within last 2 hours)
      const summary = await this.db.getMetricsSummary();
      
      if (!summary || !summary.last_collection_time) {
        return {
          status: 'degraded',
          message: 'No recent data collection',
          lastCheck: new Date()
        };
      }

      const lastCollection = new Date(summary.last_collection_time);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      if (lastCollection < twoHoursAgo) {
        return {
          status: 'degraded',
          message: 'Data collection is stale',
          lastCheck: new Date()
        };
      }

      return {
        status: 'healthy',
        message: 'Recent data available',
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      };
    }
  }

  /**
   * Get metrics summary
   */
  private async getMetricsSummary(): Promise<{
    totalCoins: number;
    coinsWithData: number;
    highConfidenceCount: number;
    lastCollectionTime?: Date;
  }> {
    try {
      const summary = await this.db.getMetricsSummary();
      
      return {
        totalCoins: summary?.total_coins || 0,
        coinsWithData: summary?.coins_with_data || 0,
        highConfidenceCount: summary?.high_confidence_count || 0,
        lastCollectionTime: summary?.last_collection_time 
          ? new Date(summary.last_collection_time)
          : undefined
      };
    } catch (error) {
      return {
        totalCoins: 0,
        coinsWithData: 0,
        highConfidenceCount: 0
      };
    }
  }
}

export default HealthMonitor;
