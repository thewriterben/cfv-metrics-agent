/**
 * Request Coalescing
 * 
 * Prevents duplicate concurrent requests by coalescing multiple
 * identical requests into a single external API call.
 */

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class RequestCoalescer<T = any> {
  private pending = new Map<string, Promise<T>>();
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(defaultTTL: number = 5000) {
    this.defaultTTL = defaultTTL;
    
    // Clean up expired cache entries periodically
    this.cleanupInterval = setInterval(() => this.cleanupExpiredCache(), 60000); // Every minute
  }

  /**
   * Coalesce requests with the same key
   * 
   * If a request is already pending for this key, return the same promise.
   * If cached data exists and is not expired, return cached data.
   * Otherwise, execute the function and cache the result.
   */
  async coalesce(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cacheTTL = ttl ?? this.defaultTTL;

    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      console.log(`[RequestCoalescer] Cache hit for key: ${key}`);
      return cached.data;
    }

    // Check if request is already pending
    if (this.pending.has(key)) {
      console.log(`[RequestCoalescer] Request already pending for key: ${key}`);
      return this.pending.get(key)!;
    }

    // Execute request
    console.log(`[RequestCoalescer] Executing new request for key: ${key}`);
    const promise = fn()
      .then(data => {
        // Cache the result
        this.cache.set(key, {
          data,
          expiry: Date.now() + cacheTTL
        });
        return data;
      })
      .catch(error => {
        // Don't cache errors
        throw error;
      })
      .finally(() => {
        // Remove from pending
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Invalidate cache entry for a specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    console.log(`[RequestCoalescer] Invalidated cache for key: ${key}`);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    console.log(`[RequestCoalescer] Invalidated ${count} cache entries matching pattern`);
  }

  /**
   * Clear all cache and pending requests
   */
  clear(): void {
    this.cache.clear();
    this.pending.clear();
    console.log('[RequestCoalescer] Cleared all cache and pending requests');
  }

  /**
   * Dispose and clean up resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    console.log('[RequestCoalescer] Disposed');
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RequestCoalescer] Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    cacheSize: number;
    pendingRequests: number;
  } {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pending.size,
    };
  }

  /**
   * Get cache entry for debugging
   */
  getCacheEntry(key: string): CacheEntry<T> | undefined {
    return this.cache.get(key);
  }
}
