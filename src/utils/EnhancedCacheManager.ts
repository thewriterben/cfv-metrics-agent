import Redis from 'ioredis';
import { TransactionMetrics } from '../types/index.js';

/**
 * Enhanced Cache Manager with Multi-Tier Strategy
 * 
 * Implements three-tier caching:
 * 1. Memory cache (fastest, 5 min TTL)
 * 2. Redis cache (fast, 1 hour TTL)
 * 3. Database cache (persistent, 24 hour TTL)
 * 
 * For Phase 1, we implement tiers 1 and 2
 */

export interface CacheConfig {
  redisUrl?: string;
  memoryTTL?: number;  // milliseconds
  redisTTL?: number;   // seconds
  enabled?: boolean;
}

export interface CacheStats {
  memoryHits: number;
  memoryMisses: number;
  redisHits: number;
  redisMisses: number;
  totalRequests: number;
  hitRate: number;
  memorySize: number;
  redisConnected: boolean;
}

export class EnhancedCacheManager {
  private redis: Redis | null = null;
  private memoryCache: Map<string, { data: any; expiry: number }>;
  private memoryTTL: number;
  private redisTTL: number;
  private enabled: boolean;
  
  // Statistics
  private stats: {
    memoryHits: number;
    memoryMisses: number;
    redisHits: number;
    redisMisses: number;
  };

  constructor(config: CacheConfig = {}) {
    this.memoryCache = new Map();
    this.memoryTTL = config.memoryTTL || 300000; // 5 minutes
    this.redisTTL = config.redisTTL || 3600; // 1 hour
    this.enabled = config.enabled !== false;
    
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      redisHits: 0,
      redisMisses: 0
    };

    // Initialize Redis if URL provided
    if (config.redisUrl) {
      this.initRedis(config.redisUrl);
    } else if (process.env.REDIS_URL) {
      this.initRedis(process.env.REDIS_URL);
    }
  }

  /**
   * Initialize Redis connection
   */
  private initRedis(url: string): void {
    try {
      this.redis = new Redis(url, {
        retryStrategy: (times) => {
          if (times > 3) {
            console.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 1000, 3000);
        },
        maxRetriesPerRequest: 3
      });

      this.redis.on('connect', () => {
        console.log('✅ Redis connected');
      });

      this.redis.on('error', (error) => {
        console.error('Redis error:', error.message);
      });
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.redis = null;
    }
  }

  /**
   * Get value from cache (checks memory first, then Redis)
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    // Try memory cache first
    const memoryValue = this.getFromMemory<T>(key);
    if (memoryValue !== null) {
      this.stats.memoryHits++;
      return memoryValue;
    }
    this.stats.memoryMisses++;

    // Try Redis cache
    if (this.redis) {
      try {
        const redisValue = await this.redis.get(this.prefixKey(key));
        if (redisValue) {
          this.stats.redisHits++;
          const parsed = JSON.parse(redisValue) as T;
          
          // Store in memory cache for faster subsequent access
          this.setInMemory(key, parsed);
          
          return parsed;
        }
        this.stats.redisMisses++;
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    return null;
  }

  /**
   * Set value in cache (stores in both memory and Redis)
   */
  async set<T = any>(key: string, value: T): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Store in memory cache
    this.setInMemory(key, value);

    // Store in Redis cache
    if (this.redis) {
      try {
        await this.redis.setex(
          this.prefixKey(key),
          this.redisTTL,
          JSON.stringify(value)
        );
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }
  }

  /**
   * Get from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Set in memory cache
   */
  private setInMemory<T>(key: string, value: T): void {
    this.memoryCache.set(key, {
      data: value,
      expiry: Date.now() + this.memoryTTL
    });
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    if (this.redis) {
      try {
        await this.redis.del(this.prefixKey(key));
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.redis) {
      try {
        const keys = await this.redis.keys('cfv:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.error('Redis clear error:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.memoryHits + this.stats.memoryMisses;
    const totalHits = this.stats.memoryHits + this.stats.redisHits;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    return {
      memoryHits: this.stats.memoryHits,
      memoryMisses: this.stats.memoryMisses,
      redisHits: this.stats.redisHits,
      redisMisses: this.stats.redisMisses,
      totalRequests,
      hitRate,
      memorySize: this.memoryCache.size,
      redisConnected: this.redis?.status === 'ready'
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      redisHits: 0,
      redisMisses: 0
    };
  }

  /**
   * Prefix key with namespace
   */
  private prefixKey(key: string): string {
    return `cfv:${key}`;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.redis?.status === 'ready';
  }
}

export default EnhancedCacheManager;
