import Redis from 'ioredis';
import type { MetricResult, CFVResult } from '../types';

export class CacheManager {
  private redis: Redis;
  private ttls: {
    short: number;
    medium: number;
    long: number;
    veryLong: number;
  };
  
  constructor(redisUrl?: string, ttls?: any) {
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
    this.ttls = ttls || {
      short: 300,      // 5 minutes
      medium: 3600,    // 1 hour
      long: 86400,     // 24 hours
      veryLong: 604800, // 7 days
    };
  }
  
  /**
   * Get cached metric result
   */
  async getMetric(coin: string, metric: string): Promise<MetricResult | null> {
    const key = `cfv:metric:${coin}:${metric}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    // Convert timestamp back to Date object
    parsed.timestamp = new Date(parsed.timestamp);
    
    return parsed as MetricResult;
  }
  
  /**
   * Cache metric result
   */
  async setMetric(
    coin: string,
    metric: string,
    result: MetricResult,
    ttl: 'short' | 'medium' | 'long' | 'veryLong' = 'medium'
  ): Promise<void> {
    const key = `cfv:metric:${coin}:${metric}`;
    await this.redis.setex(
      key,
      this.ttls[ttl],
      JSON.stringify(result)
    );
  }
  
  /**
   * Get cached CFV result
   */
  async getCFVResult(coin: string): Promise<CFVResult | null> {
    const key = `cfv:result:${coin}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    // Convert timestamps back to Date objects
    parsed.timestamp = new Date(parsed.timestamp);
    Object.keys(parsed.metrics).forEach(metricKey => {
      parsed.metrics[metricKey].timestamp = new Date(parsed.metrics[metricKey].timestamp);
    });
    
    return parsed as CFVResult;
  }
  
  /**
   * Cache CFV result
   */
  async setCFVResult(result: CFVResult, ttl: number = 3600): Promise<void> {
    const key = `cfv:result:${result.coinSymbol}`;
    await this.redis.setex(
      key,
      ttl,
      JSON.stringify(result)
    );
  }
  
  /**
   * Get collector health status
   */
  async getCollectorHealth(collectorName: string): Promise<any> {
    const key = `cfv:collector:${collectorName}:health`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    parsed.lastCheck = new Date(parsed.lastCheck);
    
    return parsed;
  }
  
  /**
   * Cache collector health status
   */
  async setCollectorHealth(collectorName: string, health: any): Promise<void> {
    const key = `cfv:collector:${collectorName}:health`;
    await this.redis.setex(
      key,
      300, // 5 minutes
      JSON.stringify(health)
    );
  }
  
  /**
   * Invalidate all cache for a coin
   */
  async invalidateCoin(coin: string): Promise<void> {
    const pattern = `cfv:*:${coin}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    hits: number;
    misses: number;
  }> {
    const info = await this.redis.info('stats');
    const keyspace = await this.redis.info('keyspace');
    
    // Parse info string
    const stats: any = {};
    info.split('\r\n').forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key] = value;
      }
    });
    
    // Count keys
    const keys = await this.redis.dbsize();
    
    return {
      keys,
      memory: stats.used_memory_human || '0B',
      hits: parseInt(stats.keyspace_hits || '0'),
      misses: parseInt(stats.keyspace_misses || '0'),
    };
  }
  
  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
