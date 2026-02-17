import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BlockchainDataCollector } from '../../../collectors/BlockchainDataCollector.js';

// Mock all the collectors
jest.mock('../../../collectors/CoinGeckoAPICollector.js');
jest.mock('../../../collectors/ThreeXplCollector.js');
jest.mock('../../../collectors/DashApiClient.js');
jest.mock('../../../collectors/NanoCollector.js');
jest.mock('../../../collectors/NEARCollector.js');
jest.mock('../../../collectors/ICPCollector.js');

describe('BlockchainDataCollector', () => {
  let collector: BlockchainDataCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    collector = new BlockchainDataCollector({
      cacheEnabled: true,
      cacheTTL: 1000 // 1 second for testing
    });
  });

  describe('Cache bounded size and LRU eviction', () => {
    it('should evict oldest entry when cache exceeds max size', async () => {
      // Create a collector with a very small cache for testing
      const testCollector = new BlockchainDataCollector({
        cacheEnabled: true,
        cacheTTL: 3600000
      });

      // Access the private MAX_CACHE_SIZE through getCacheStats
      const stats = testCollector.getCacheStats();
      expect(stats.maxSize).toBe(100);

      // Add entries up to max size
      const mockMetrics = {
        annualTxCount: 1000000,
        annualTxValue: 1000000000,
        avgTxValue: 1000,
        confidence: 'HIGH' as const,
        sources: ['test'],
        timestamp: new Date(),
        issues: []
      };

      // Add MAX_CACHE_SIZE entries
      for (let i = 0; i < 100; i++) {
        (testCollector as any).setInCache(`COIN${i}`, mockMetrics);
      }

      // Verify cache is at max size
      expect(testCollector.getCacheStats().size).toBe(100);

      // Add one more entry - should evict the oldest (COIN0)
      (testCollector as any).setInCache('COIN100', mockMetrics);

      // Cache should still be at max size
      expect(testCollector.getCacheStats().size).toBe(100);

      // COIN0 should be evicted
      expect((testCollector as any).getFromCache('COIN0')).toBeNull();

      // COIN100 should be in cache
      expect((testCollector as any).getFromCache('COIN100')).not.toBeNull();

      // COIN1 (second oldest) should still be in cache
      expect((testCollector as any).getFromCache('COIN1')).not.toBeNull();
    });

    it('should clean expired entries when cache is getting full', async () => {
      // Create collector with short TTL
      const testCollector = new BlockchainDataCollector({
        cacheEnabled: true,
        cacheTTL: 100 // 100ms TTL
      });

      const mockMetrics = {
        annualTxCount: 1000000,
        annualTxValue: 1000000000,
        avgTxValue: 1000,
        confidence: 'HIGH' as const,
        sources: ['test'],
        timestamp: new Date(),
        issues: []
      };

      // Add 60 entries (more than MAX_CACHE_SIZE / 2 = 50)
      for (let i = 0; i < 60; i++) {
        (testCollector as any).setInCache(`COIN${i}`, mockMetrics);
      }

      expect(testCollector.getCacheStats().size).toBe(60);

      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Add a new entry - this should trigger cleanExpiredEntries
      (testCollector as any).setInCache('NEWCOIN', mockMetrics);

      // All old entries should be cleaned up, only NEWCOIN should remain
      expect(testCollector.getCacheStats().size).toBe(1);
      expect((testCollector as any).getFromCache('NEWCOIN')).not.toBeNull();
      expect((testCollector as any).getFromCache('COIN0')).toBeNull();
    });
  });

  describe('getCacheStats', () => {
    it('should return maxSize in cache stats', () => {
      const stats = collector.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('ttl');
      expect(stats).toHaveProperty('enabled');

      expect(stats.maxSize).toBe(100);
      expect(stats.enabled).toBe(true);
      expect(stats.ttl).toBe(1000);
      expect(stats.size).toBe(0);
    });

    it('should reflect correct cache size', () => {
      const mockMetrics = {
        annualTxCount: 1000000,
        annualTxValue: 1000000000,
        avgTxValue: 1000,
        confidence: 'HIGH' as const,
        sources: ['test'],
        timestamp: new Date(),
        issues: []
      };

      // Add some entries
      (collector as any).setInCache('BTC', mockMetrics);
      (collector as any).setInCache('ETH', mockMetrics);
      (collector as any).setInCache('DASH', mockMetrics);

      const stats = collector.getCacheStats();
      expect(stats.size).toBe(3);
      expect(stats.maxSize).toBe(100);
    });
  });

  describe('Cache expiry', () => {
    it('should not return expired entries from cache', async () => {
      const mockMetrics = {
        annualTxCount: 1000000,
        annualTxValue: 1000000000,
        avgTxValue: 1000,
        confidence: 'HIGH' as const,
        sources: ['test'],
        timestamp: new Date(),
        issues: []
      };

      // Add entry to cache
      (collector as any).setInCache('BTC', mockMetrics);

      // Entry should be available immediately
      expect((collector as any).getFromCache('BTC')).not.toBeNull();

      // Wait for TTL to expire (1 second + buffer)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Entry should be expired and return null
      expect((collector as any).getFromCache('BTC')).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear all entries from cache', () => {
      const mockMetrics = {
        annualTxCount: 1000000,
        annualTxValue: 1000000000,
        avgTxValue: 1000,
        confidence: 'HIGH' as const,
        sources: ['test'],
        timestamp: new Date(),
        issues: []
      };

      // Add entries
      (collector as any).setInCache('BTC', mockMetrics);
      (collector as any).setInCache('ETH', mockMetrics);
      (collector as any).setInCache('DASH', mockMetrics);

      expect(collector.getCacheStats().size).toBe(3);

      // Clear cache
      collector.clearCache();

      expect(collector.getCacheStats().size).toBe(0);
    });
  });
});
