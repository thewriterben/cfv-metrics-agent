import { CacheManager } from '../../../utils/CacheManager.js';
import { createMockRedis } from '../../helpers/mocks.js';
import { createTestMetricResult, mockBTCMetrics } from '../../fixtures/metrics.js';
import type { CFVResult } from '../../../types/index.js';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    // Replace the redis instance after construction
    cacheManager = new CacheManager('redis://localhost:6379');
    (cacheManager as any).redis = mockRedis;
  });

  describe('getMetric', () => {
    it('should return null when metric is not cached', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheManager.getMetric('BTC', 'price');

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('cfv:metric:BTC:price');
    });

    it('should return cached metric', async () => {
      const metricResult = createTestMetricResult(45000, 'HIGH', 'CoinGecko');
      mockRedis.get.mockResolvedValue(JSON.stringify(metricResult));

      const result = await cacheManager.getMetric('BTC', 'price');

      expect(result).not.toBeNull();
      expect(result?.value).toBe(45000);
      expect(result?.confidence).toBe('HIGH');
      expect(result?.source).toBe('CoinGecko');
      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it('should handle JSON parse errors gracefully', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      await expect(cacheManager.getMetric('BTC', 'price')).rejects.toThrow();
    });
  });

  describe('setMetric', () => {
    it('should cache metric with default TTL', async () => {
      const metricResult = createTestMetricResult(45000, 'HIGH', 'CoinGecko');

      await cacheManager.setMetric('BTC', 'price', metricResult);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cfv:metric:BTC:price',
        3600, // Default medium TTL
        expect.any(String)
      );
    });

    it('should cache metric with short TTL', async () => {
      const metricResult = createTestMetricResult(45000, 'HIGH', 'CoinGecko');

      await cacheManager.setMetric('BTC', 'price', metricResult, 'short');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cfv:metric:BTC:price',
        300, // Short TTL
        expect.any(String)
      );
    });

    it('should cache metric with long TTL', async () => {
      const metricResult = createTestMetricResult(45000, 'HIGH', 'CoinGecko');

      await cacheManager.setMetric('BTC', 'price', metricResult, 'long');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cfv:metric:BTC:price',
        86400, // Long TTL
        expect.any(String)
      );
    });

    it('should cache metric with veryLong TTL', async () => {
      const metricResult = createTestMetricResult(45000, 'HIGH', 'CoinGecko');

      await cacheManager.setMetric('BTC', 'price', metricResult, 'veryLong');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cfv:metric:BTC:price',
        604800, // Very long TTL
        expect.any(String)
      );
    });
  });

  describe('getCFVResult', () => {
    it('should return null when result is not cached', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheManager.getCFVResult('BTC');

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('cfv:result:BTC');
    });

    it('should return cached CFV result', async () => {
      const cfvResult: CFVResult = {
        coinSymbol: 'BTC',
        coinName: 'Bitcoin',
        metrics: mockBTCMetrics,
        calculation: {
          fairValue: 50000,
          fairMarketCap: 975000000000,
          currentPrice: 45000,
          currentMarketCap: 877500000000,
          networkPowerScore: 1000000,
          valuationStatus: 'undervalued',
          valuationPercent: -10,
          priceMultiplier: 0.9,
          breakdown: {
            communityContribution: 1000,
            transactionValueContribution: 100,
            transactionCountContribution: 100,
            developerContribution: 10,
          },
        },
        timestamp: new Date(),
        overallConfidence: 'HIGH',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cfvResult));

      const result = await cacheManager.getCFVResult('BTC');

      expect(result).not.toBeNull();
      expect(result?.coinSymbol).toBe('BTC');
      expect(result?.calculation.fairValue).toBe(50000);
      expect(result?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('setCFVResult', () => {
    it('should cache CFV result with default TTL', async () => {
      const cfvResult: CFVResult = {
        coinSymbol: 'BTC',
        coinName: 'Bitcoin',
        metrics: mockBTCMetrics,
        calculation: {
          fairValue: 50000,
          fairMarketCap: 975000000000,
          currentPrice: 45000,
          currentMarketCap: 877500000000,
          networkPowerScore: 1000000,
          valuationStatus: 'undervalued',
          valuationPercent: -10,
          priceMultiplier: 0.9,
          breakdown: {
            communityContribution: 1000,
            transactionValueContribution: 100,
            transactionCountContribution: 100,
            developerContribution: 10,
          },
        },
        timestamp: new Date(),
        overallConfidence: 'HIGH',
      };

      await cacheManager.setCFVResult(cfvResult);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cfv:result:BTC',
        3600,
        expect.any(String)
      );
    });

    it('should cache CFV result with custom TTL', async () => {
      const cfvResult: CFVResult = {
        coinSymbol: 'BTC',
        coinName: 'Bitcoin',
        metrics: mockBTCMetrics,
        calculation: {
          fairValue: 50000,
          fairMarketCap: 975000000000,
          currentPrice: 45000,
          currentMarketCap: 877500000000,
          networkPowerScore: 1000000,
          valuationStatus: 'undervalued',
          valuationPercent: -10,
          priceMultiplier: 0.9,
          breakdown: {
            communityContribution: 1000,
            transactionValueContribution: 100,
            transactionCountContribution: 100,
            developerContribution: 10,
          },
        },
        timestamp: new Date(),
        overallConfidence: 'HIGH',
      };

      await cacheManager.setCFVResult(cfvResult, 7200);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cfv:result:BTC',
        7200,
        expect.any(String)
      );
    });
  });

  describe('invalidateCoin', () => {
    it('should delete all keys for a coin', async () => {
      mockRedis.keys.mockResolvedValue([
        'cfv:metric:BTC:price',
        'cfv:metric:BTC:supply',
        'cfv:result:BTC',
      ]);

      await cacheManager.invalidateCoin('BTC');

      expect(mockRedis.keys).toHaveBeenCalledWith('cfv:*:BTC:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'cfv:metric:BTC:price',
        'cfv:metric:BTC:supply',
        'cfv:result:BTC'
      );
    });

    it('should not attempt to delete when no keys exist', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await cacheManager.invalidateCoin('BTC');

      expect(mockRedis.keys).toHaveBeenCalledWith('cfv:*:BTC:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('getCollectorHealth', () => {
    it('should return null when health is not cached', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheManager.getCollectorHealth('CoinGecko');

      expect(result).toBeNull();
    });

    it('should return cached collector health', async () => {
      const health = {
        status: 'healthy',
        lastCheck: new Date(),
        errorRate: 0.01,
        responseTime: 150,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(health));

      const result = await cacheManager.getCollectorHealth('CoinGecko');

      expect(result).not.toBeNull();
      expect(result.status).toBe('healthy');
      expect(result.lastCheck).toBeInstanceOf(Date);
    });
  });

  describe('setCollectorHealth', () => {
    it('should cache collector health with 5 minute TTL', async () => {
      const health = {
        status: 'healthy',
        lastCheck: new Date(),
        errorRate: 0.01,
        responseTime: 150,
      };

      await cacheManager.setCollectorHealth('CoinGecko', health);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cfv:collector:CoinGecko:health',
        300,
        expect.any(String)
      );
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.info.mockResolvedValue('keyspace_hits:1000\r\nkeyspace_misses:100');
      mockRedis.dbsize.mockResolvedValue(500);

      const stats = await cacheManager.getStats();

      expect(stats.keys).toBe(500);
      expect(mockRedis.info).toHaveBeenCalled();
      expect(mockRedis.dbsize).toHaveBeenCalled();
    });
  });
});
