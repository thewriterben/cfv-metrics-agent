import Bottleneck from 'bottleneck';

/**
 * Service-specific rate limiter using bottleneck library
 * 
 * Implements intelligent rate limiting for external API calls
 * with service-specific configurations.
 */

export type ServiceName = 'coingecko' | 'etherscan' | 'github';

export interface RateLimiterConfig {
  maxConcurrent: number;
  minTime: number;
  reservoir?: number;
  reservoirRefreshInterval?: number;
}

export class RateLimiter {
  private limiters: Map<string, Bottleneck>;
  
  // Default configurations for external services
  private readonly defaultConfigs: Record<ServiceName, RateLimiterConfig> = {
    coingecko: {
      maxConcurrent: 3,
      minTime: 2000,        // 2 seconds between requests (30 calls/min)
      reservoir: 30,        // 30 requests
      reservoirRefreshInterval: 60000  // per minute
    },
    etherscan: {
      maxConcurrent: 1,
      minTime: 200,         // 5 requests per second
      reservoir: 5,
      reservoirRefreshInterval: 1000
    },
    github: {
      maxConcurrent: 5,
      minTime: 720,         // ~5000 per hour
      reservoir: 5000,
      reservoirRefreshInterval: 3600000
    }
  };

  constructor() {
    this.limiters = new Map();
    this.initializeLimiters();
  }

  /**
   * Initialize limiters for all services
   */
  private initializeLimiters(): void {
    for (const [service, config] of Object.entries(this.defaultConfigs)) {
      this.createLimiter(service as ServiceName, config);
    }
  }

  /**
   * Create a rate limiter for a specific service
   */
  private createLimiter(service: ServiceName, config: RateLimiterConfig): void {
    const limiter = new Bottleneck({
      maxConcurrent: config.maxConcurrent,
      minTime: config.minTime,
      reservoir: config.reservoir,
      reservoirRefreshAmount: config.reservoir,
      reservoirRefreshInterval: config.reservoirRefreshInterval,
    });

    // Add event listeners for monitoring
    limiter.on('failed', (error, jobInfo) => {
      console.warn(`[RateLimiter] ${service} job failed:`, error.message);
      
      // Retry logic for 429 errors (Too Many Requests)
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        const retryAfter = 5000; // 5 seconds
        console.log(`[RateLimiter] Retrying ${service} after ${retryAfter}ms`);
        return retryAfter;
      }
    });

    limiter.on('retry', (error, jobInfo) => {
      console.log(`[RateLimiter] Retrying ${service} job`);
    });

    this.limiters.set(service, limiter);
  }

  /**
   * Schedule a function to run with rate limiting
   */
  async schedule<T>(
    service: ServiceName,
    fn: () => Promise<T>,
    priority?: number
  ): Promise<T> {
    const limiter = this.limiters.get(service);
    
    if (!limiter) {
      throw new Error(`No rate limiter configured for service: ${service}`);
    }

    return limiter.schedule({ priority }, fn);
  }

  /**
   * Get current counts for a service
   */
  getCounts(service: ServiceName): Bottleneck.Counts {
    const limiter = this.limiters.get(service);
    
    if (!limiter) {
      throw new Error(`No rate limiter configured for service: ${service}`);
    }

    return limiter.counts();
  }

  /**
   * Update configuration for a service
   */
  updateConfig(service: ServiceName, config: Partial<RateLimiterConfig>): void {
    const limiter = this.limiters.get(service);
    
    if (!limiter) {
      throw new Error(`No rate limiter configured for service: ${service}`);
    }

    limiter.updateSettings({
      maxConcurrent: config.maxConcurrent,
      minTime: config.minTime,
      reservoir: config.reservoir,
      reservoirRefreshAmount: config.reservoir,
      reservoirRefreshInterval: config.reservoirRefreshInterval,
    });
  }

  /**
   * Check if service is currently limiting
   */
  isLimiting(service: ServiceName): boolean {
    const counts = this.getCounts(service);
    return counts.QUEUED > 0 || counts.RUNNING >= this.defaultConfigs[service].maxConcurrent;
  }

  /**
   * Get status for all services
   */
  getAllStatus(): Record<string, Bottleneck.Counts> {
    const status: Record<string, Bottleneck.Counts> = {};
    
    for (const [service, limiter] of this.limiters.entries()) {
      status[service] = limiter.counts();
    }
    
    return status;
  }

  /**
   * Stop all limiters
   */
  async stop(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const limiter of this.limiters.values()) {
      promises.push(limiter.stop());
    }
    
    await Promise.all(promises);
  }
}
