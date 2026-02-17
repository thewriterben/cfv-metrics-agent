import Redis from 'ioredis';
import type { MetricResult, CFVResult } from '../types';

/**
 * CacheManager with Redis and graceful degradation to memory-only mode
 * 
 * Features:
 * - Lazy connection with retry strategy
 * - Graceful degradation when Redis is unavailable
 * - Proper error event handling
 * - Connection health monitoring
 */
export class CacheManager {
  private redis: Redis | null = null;
  private redisUrl: string;
  private isRedisAvailable: boolean = false;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;
  private ttls: {
    short: number;
    medium: number;
    long: number;
    veryLong: number;
  };
  
  constructor(redisUrl?: string, ttls?: any) {
    this.redisUrl = redisUrl || 'redis://localhost:6379';
    this.ttls = ttls || {
      short: 300,      // 5 minutes
      medium: 3600,    // 1 hour
      long: 86400,     // 24 hours
      veryLong: 604800, // 7 days
    };
    
    // Lazy initialization - don't connect immediately
    this.initializeRedis();
  }
  
  /**
   * Initialize Redis connection with error handling and retry logic
   */
  private initializeRedis(): void {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      
      this.redis = new Redis(this.redisUrl, {
        retryStrategy: (times) => {
          if (times > this.maxConnectionAttempts) {
            console.warn('⚠️  Redis: Max connection attempts reached, falling back to memory-only cache');
            this.isRedisAvailable = false;
            return null; // Stop retrying
          }
          const delay = Math.min(times * 1000, 5000);
          if (!isProduction) {
            console.log(`Redis: Retry attempt ${times} in ${delay}ms...`);
          }
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true, // Don't connect until first command
      });
      
      // Handle successful connection
      this.redis.on('connect', () => {
        if (!isProduction) {
          console.log('✅ Redis: Connected successfully');
        }
        this.isRedisAvailable = true;
        this.connectionAttempts = 0;
      });
      
      // Handle ready state
      this.redis.on('ready', () => {
        this.isRedisAvailable = true;
      });
      
      // Handle connection errors
      this.redis.on('error', (error) => {
        this.connectionAttempts++;
        if (!isProduction || this.connectionAttempts <= 1) {
          console.warn('⚠️  Redis connection error:', error.message);
        }
        this.isRedisAvailable = false;
        
        // After max attempts, fall back to memory cache
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
          console.warn('⚠️  Redis: Degrading to memory-only cache mode');
        }
      });
      
      // Handle disconnection
      this.redis.on('close', () => {
        if (!isProduction) {
          console.log('Redis: Connection closed');
        }
        this.isRedisAvailable = false;
      });
      
      // Handle reconnection
      this.redis.on('reconnecting', () => {
        if (!isProduction) {
          console.log('Redis: Attempting to reconnect...');
        }
      });
      
    } catch (error) {
      console.warn('⚠️  Redis initialization failed, using memory-only cache:', (error as Error).message);
      this.isRedisAvailable = false;
      this.redis = null;
    }
  }
  
  /**
   * Check if Redis is available and healthy
   */
  private async isRedisHealthy(): Promise<boolean> {
    if (!this.redis || !this.isRedisAvailable) {
      return false;
    }
    
    try {
      await this.redis.ping();
      return true;
    } catch {
      this.isRedisAvailable = false;
      return false;
    }
  }
  
  /**
   * Get from memory cache (fallback)
   */
  private getFromMemory(key: string): any | null {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() > cached.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return cached.value;
  }
  
  /**
   * Set in memory cache (fallback)
   */
  private setInMemory(key: string, value: any, ttlSeconds: number): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.memoryCache.set(key, { value, expiry });
    
    // Clean up expired entries periodically
    if (this.memoryCache.size > 1000) {
      this.cleanupMemoryCache();
    }
  }
  
  /**
   * Clean up expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.memoryCache.entries()) {
      if (now > cached.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }
  
  /**
   * Get cached metric result
   */
  async getMetric(coin: string, metric: string): Promise<MetricResult | null> {
    const key = `cfv:metric:${coin}:${metric}`;
    
    try {
      // Try Redis first if available
      if (await this.isRedisHealthy()) {
        const data = await this.redis!.get(key);
        
        if (!data) return null;
        
        const parsed = JSON.parse(data);
        // Convert timestamp back to Date object
        parsed.timestamp = new Date(parsed.timestamp);
        
        return parsed as MetricResult;
      }
    } catch (error) {
      console.warn(`Cache warning (getMetric): ${(error as Error).message}`);
    }
    
    // Fall back to memory cache
    const memData = this.getFromMemory(key);
    if (memData) {
      const parsed = JSON.parse(memData);
      parsed.timestamp = new Date(parsed.timestamp);
      return parsed as MetricResult;
    }
    
    return null;
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
    const ttlSeconds = this.ttls[ttl];
    const data = JSON.stringify(result);
    
    try {
      // Try Redis first if available
      if (await this.isRedisHealthy()) {
        await this.redis!.setex(key, ttlSeconds, data);
        return;
      }
    } catch (error) {
      console.warn(`Cache warning (setMetric): ${(error as Error).message}`);
    }
    
    // Fall back to memory cache
    this.setInMemory(key, data, ttlSeconds);
  }
  
  /**
   * Get cached CFV result
   */
  async getCFVResult(coin: string): Promise<CFVResult | null> {
    const key = `cfv:result:${coin}`;
    
    try {
      // Try Redis first if available
      if (await this.isRedisHealthy()) {
        const data = await this.redis!.get(key);
        
        if (!data) return null;
        
        const parsed = JSON.parse(data);
        // Convert timestamps back to Date objects
        parsed.timestamp = new Date(parsed.timestamp);
        Object.keys(parsed.metrics).forEach(metricKey => {
          parsed.metrics[metricKey].timestamp = new Date(parsed.metrics[metricKey].timestamp);
        });
        
        return parsed as CFVResult;
      }
    } catch (error) {
      console.warn(`Cache warning (getCFVResult): ${(error as Error).message}`);
    }
    
    // Fall back to memory cache
    const memData = this.getFromMemory(key);
    if (memData) {
      const parsed = JSON.parse(memData);
      parsed.timestamp = new Date(parsed.timestamp);
      Object.keys(parsed.metrics).forEach(metricKey => {
        parsed.metrics[metricKey].timestamp = new Date(parsed.metrics[metricKey].timestamp);
      });
      return parsed as CFVResult;
    }
    
    return null;
  }
  
  /**
   * Cache CFV result
   */
  async setCFVResult(result: CFVResult, ttl: number = 3600): Promise<void> {
    const key = `cfv:result:${result.coinSymbol}`;
    const data = JSON.stringify(result);
    
    try {
      // Try Redis first if available
      if (await this.isRedisHealthy()) {
        await this.redis!.setex(key, ttl, data);
        return;
      }
    } catch (error) {
      console.warn(`Cache warning (setCFVResult): ${(error as Error).message}`);
    }
    
    // Fall back to memory cache
    this.setInMemory(key, data, ttl);
  }
  
  /**
   * Get collector health status
   */
  async getCollectorHealth(collectorName: string): Promise<any> {
    const key = `cfv:collector:${collectorName}:health`;
    
    try {
      // Try Redis first if available
      if (await this.isRedisHealthy()) {
        const data = await this.redis!.get(key);
        
        if (!data) return null;
        
        const parsed = JSON.parse(data);
        parsed.lastCheck = new Date(parsed.lastCheck);
        
        return parsed;
      }
    } catch (error) {
      console.warn(`Cache warning (getCollectorHealth): ${(error as Error).message}`);
    }
    
    // Fall back to memory cache
    const memData = this.getFromMemory(key);
    if (memData) {
      const parsed = JSON.parse(memData);
      parsed.lastCheck = new Date(parsed.lastCheck);
      return parsed;
    }
    
    return null;
  }
  
  /**
   * Cache collector health status
   */
  async setCollectorHealth(collectorName: string, health: any): Promise<void> {
    const key = `cfv:collector:${collectorName}:health`;
    const data = JSON.stringify(health);
    
    try {
      // Try Redis first if available
      if (await this.isRedisHealthy()) {
        await this.redis!.setex(key, 300, data); // 5 minutes
        return;
      }
    } catch (error) {
      console.warn(`Cache warning (setCollectorHealth): ${(error as Error).message}`);
    }
    
    // Fall back to memory cache
    this.setInMemory(key, data, 300);
  }
  
  /**
   * Invalidate all cache for a coin
   */
  async invalidateCoin(coin: string): Promise<void> {
    const pattern = `cfv:*:${coin}:*`;
    
    try {
      // Try Redis first if available
      if (await this.isRedisHealthy()) {
        const keys = await this.redis!.keys(pattern);
        
        if (keys.length > 0) {
          await this.redis!.del(...keys);
        }
        return;
      }
    } catch (error) {
      console.warn(`Cache warning (invalidateCoin): ${(error as Error).message}`);
    }
    
    // Fall back to memory cache - remove matching keys
    for (const key of this.memoryCache.keys()) {
      if (key.includes(coin)) {
        this.memoryCache.delete(key);
      }
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
    mode: 'redis' | 'memory';
  }> {
    try {
      // Try Redis first if available
      if (await this.isRedisHealthy()) {
        const info = await this.redis!.info('stats');
        const keyspace = await this.redis!.info('keyspace');
        
        // Parse info string
        const stats: any = {};
        info.split('\r\n').forEach(line => {
          const [key, value] = line.split(':');
          if (key && value) {
            stats[key] = value;
          }
        });
        
        // Count keys
        const keys = await this.redis!.dbsize();
        
        return {
          keys,
          memory: stats.used_memory_human || '0B',
          hits: parseInt(stats.keyspace_hits || '0'),
          misses: parseInt(stats.keyspace_misses || '0'),
          mode: 'redis',
        };
      }
    } catch (error) {
      console.warn(`Cache warning (getStats): ${(error as Error).message}`);
    }
    
    // Fall back to memory cache stats
    return {
      keys: this.memoryCache.size,
      memory: `${Math.round(JSON.stringify(Array.from(this.memoryCache.entries())).length / 1024)}KB`,
      hits: 0,
      misses: 0,
      mode: 'memory',
    };
  }
  
  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        console.warn('Error closing Redis connection:', (error as Error).message);
      }
    }
    
    // Clear memory cache
    this.memoryCache.clear();
  }
}
