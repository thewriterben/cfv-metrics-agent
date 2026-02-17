import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ThreeXplCollector } from '../../../collectors/ThreeXplCollector.js';

// Mock axios for 3xpl API calls
jest.mock('axios');

describe('ThreeXplCollector', () => {
  let collector: ThreeXplCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a new collector instance for each test
    collector = new ThreeXplCollector({
      apiKey: 'test-3xpl-key',
      coingeckoApiKey: 'test-coingecko-key'
    });
  });

  describe('isSupported', () => {
    it('should return true for supported coins', () => {
      expect(collector.isSupported('BTC')).toBe(true);
      expect(collector.isSupported('ETH')).toBe(true);
      expect(collector.isSupported('DASH')).toBe(true);
      expect(collector.isSupported('DGB')).toBe(true);
      expect(collector.isSupported('XEC')).toBe(true);
    });

    it('should return false for unsupported coins', () => {
      expect(collector.isSupported('XMR')).toBe(false);
      expect(collector.isSupported('RVN')).toBe(false);
      expect(collector.isSupported('XCH')).toBe(false);
      expect(collector.isSupported('UNKNOWN')).toBe(false);
    });
  });

  describe('calculateAnnualMetrics with CoinGecko fallback', () => {
    it('should use CoinGecko fallback for volume data when available', async () => {
      // Mock 3xpl to return transaction count but no volume
      const mockStats = {
        events_24h: 100000,
        best_block: 800000,
        best_block_time: new Date().toISOString()
      };
      jest.spyOn(collector as any, 'getChainStats').mockResolvedValue(mockStats);

      // Mock CoinGecko to return volume data
      const mockCoinGeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(mockCoinGeckoCollector, 'collectMetrics').mockResolvedValue({
        communitySize: 1000000,
        annualTxCount: 36500000,
        annualTxValue: 5000000000000, // $5 trillion annually
        developers: 500,
        currentPrice: 50000,
        marketCap: 1000000000000,
        circulatingSupply: 19000000,
        totalSupply: 21000000
      });

      const result = await (collector as any).calculateAnnualMetrics('BTC');

      expect(result.annualTxCount).toBe(36500000); // 100000 * 365
      expect(result.annualTxValue).toBe(5000000000000); // From CoinGecko
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackSource).toBe('CoinGecko (volume24h × 365)');
      expect(result.avgTxValue).toBeGreaterThan(0);
    });

    it('should handle CoinGecko fallback failure gracefully', async () => {
      // Mock 3xpl to return transaction count
      const mockStats = {
        events_24h: 100000,
        best_block: 800000,
        best_block_time: new Date().toISOString()
      };
      jest.spyOn(collector as any, 'getChainStats').mockResolvedValue(mockStats);

      // Mock CoinGecko to fail
      const mockCoinGeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(mockCoinGeckoCollector, 'collectMetrics').mockRejectedValue(
        new Error('CoinGecko API error')
      );

      const result = await (collector as any).calculateAnnualMetrics('BTC');

      expect(result.annualTxCount).toBe(36500000); // 100000 * 365
      expect(result.annualTxValue).toBe(0); // Fallback failed
      expect(result.avgTxValue).toBe(0);
      expect(result.usedFallback).toBe(false);
      expect(result.fallbackSource).toBeUndefined();
    });

    it('should calculate avgTxValue correctly when fallback succeeds', async () => {
      // Mock 3xpl to return transaction count
      const mockStats = {
        events_24h: 1000,
        best_block: 800000,
        best_block_time: new Date().toISOString()
      };
      jest.spyOn(collector as any, 'getChainStats').mockResolvedValue(mockStats);

      // Mock CoinGecko to return volume data
      const mockCoinGeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(mockCoinGeckoCollector, 'collectMetrics').mockResolvedValue({
        communitySize: 50000,
        annualTxCount: 365000,
        annualTxValue: 365000000, // $365M annually
        developers: 50,
        currentPrice: 100,
        marketCap: 10000000,
        circulatingSupply: 100000,
        totalSupply: 200000
      });

      const result = await (collector as any).calculateAnnualMetrics('DGB');

      const expectedAnnualTxCount = 365000; // 1000 * 365
      const expectedAvgTxValue = 365000000 / expectedAnnualTxCount; // ~1000

      expect(result.annualTxCount).toBe(expectedAnnualTxCount);
      expect(result.annualTxValue).toBe(365000000);
      expect(result.avgTxValue).toBeCloseTo(expectedAvgTxValue, 2);
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('collectMetrics', () => {
    it('should return MEDIUM confidence when using CoinGecko fallback', async () => {
      // Mock 3xpl to return transaction count
      const mockStats = {
        events_24h: 50000,
        best_block: 700000,
        best_block_time: new Date().toISOString()
      };
      jest.spyOn(collector as any, 'getChainStats').mockResolvedValue(mockStats);

      // Mock CoinGecko to return volume data
      const mockCoinGeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(mockCoinGeckoCollector, 'collectMetrics').mockResolvedValue({
        communitySize: 500000,
        annualTxCount: 18250000,
        annualTxValue: 1000000000000,
        developers: 200,
        currentPrice: 2000,
        marketCap: 500000000000,
        circulatingSupply: 120000000,
        totalSupply: 120000000
      });

      const result = await collector.collectMetrics('ETH');

      expect(result.confidence).toBe('MEDIUM');
      expect(result.annualTxValue).toBeGreaterThan(0);
      expect(result.sources).toContain('3xpl.com (ethereum)');
      expect(result.sources).toContain('CoinGecko (volume24h × 365)');
      expect(result.issues).toContain('Transaction volume estimated using CoinGecko (volume24h × 365)');
      expect(result.metadata?.usedFallback).toBe(true);
      expect(result.metadata?.fallbackSource).toBe('CoinGecko (volume24h × 365)');
    });

    it('should return LOW confidence when fallback fails', async () => {
      // Mock 3xpl to return transaction count
      const mockStats = {
        events_24h: 50000,
        best_block: 700000,
        best_block_time: new Date().toISOString()
      };
      jest.spyOn(collector as any, 'getChainStats').mockResolvedValue(mockStats);

      // Mock CoinGecko to fail
      const mockCoinGeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(mockCoinGeckoCollector, 'collectMetrics').mockRejectedValue(
        new Error('CoinGecko API error')
      );

      const result = await collector.collectMetrics('ETH');

      expect(result.confidence).toBe('LOW');
      expect(result.annualTxValue).toBe(0);
      expect(result.issues).toContain('Transaction volume data not available from 3xpl stats endpoint and fallback failed');
      expect(result.metadata?.usedFallback).toBe(false);
    });

    it('should throw error for unsupported coins', async () => {
      await expect(collector.collectMetrics('XMR')).rejects.toThrow(
        'Coin XMR not supported by 3xpl'
      );
    });

    it('should include metadata about transaction counts and fallback', async () => {
      const mockStats = {
        events_24h: 10000,
        best_block: 600000,
        best_block_time: new Date().toISOString()
      };
      jest.spyOn(collector as any, 'getChainStats').mockResolvedValue(mockStats);

      const mockCoinGeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(mockCoinGeckoCollector, 'collectMetrics').mockResolvedValue({
        communitySize: 100000,
        annualTxCount: 3650000,
        annualTxValue: 50000000000,
        developers: 100,
        currentPrice: 50,
        marketCap: 5000000000,
        circulatingSupply: 100000000,
        totalSupply: 100000000
      });

      const result = await collector.collectMetrics('DASH');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.blockchain).toBe('dash');
      expect(result.metadata?.usedFallback).toBe(true);
      expect(result.metadata?.fallbackSource).toBe('CoinGecko (volume24h × 365)');
      expect(result.metadata?.txCount24h).toBe(10000);
    });
  });

  describe('getSupportedCoins', () => {
    it('should return list of supported coins', () => {
      const supported = ThreeXplCollector.getSupportedCoins();
      
      expect(supported).toContain('BTC');
      expect(supported).toContain('ETH');
      expect(supported).toContain('DASH');
      expect(supported).toContain('DGB');
      expect(supported).toContain('XEC');
      expect(supported).toHaveLength(5);
    });
  });
});
