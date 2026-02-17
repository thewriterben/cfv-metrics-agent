import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BlockchainDataCollector } from '../../../collectors/BlockchainDataCollector.js';
import { logger } from '../../../utils/logger.js';

// Mock all dependencies
jest.mock('../../../collectors/CoinGeckoAPICollector.js');
jest.mock('../../../collectors/ThreeXplCollector.js');
jest.mock('../../../collectors/DashApiClient.js');
jest.mock('../../../collectors/NanoCollector.js');
jest.mock('../../../collectors/NEARCollector.js');
jest.mock('../../../collectors/ICPCollector.js');
jest.mock('../../../utils/logger.js');

describe('BlockchainDataCollector', () => {
  let collector: BlockchainDataCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a new collector instance for each test
    collector = new BlockchainDataCollector({
      coingeckoApiKey: 'test-coingecko-key',
      threexplApiKey: 'test-3xpl-key'
    });
  });

  describe('getSupportedCoins', () => {
    it('should return correct supported coins categories', () => {
      const supported = collector.getSupportedCoins();
      
      expect(supported).toHaveProperty('threexpl');
      expect(supported).toHaveProperty('custom');
      expect(supported).toHaveProperty('estimatedOnly');
      expect(supported).toHaveProperty('fallback');
      
      // Custom collectors
      expect(supported.custom).toContain('DASH');
      expect(supported.custom).toContain('XNO');
      expect(supported.custom).toContain('NEAR');
      expect(supported.custom).toContain('ICP');
      
      // Coins with only CoinGecko estimation
      expect(supported.estimatedOnly).toContain('XMR');
      expect(supported.estimatedOnly).toContain('RVN');
      expect(supported.estimatedOnly).toContain('XCH');
      expect(supported.estimatedOnly).toContain('EGLD');
      expect(supported.estimatedOnly).toContain('ZCL');
    });

    it('should list exactly 5 coins for estimatedOnly category', () => {
      const supported = collector.getSupportedCoins();
      expect(supported.estimatedOnly).toHaveLength(5);
    });

    it('should list exactly 4 coins for custom category', () => {
      const supported = collector.getSupportedCoins();
      expect(supported.custom).toHaveLength(4);
    });
  });

  describe('hasHighConfidenceData', () => {
    beforeEach(() => {
      // Set THREEXPL_API_KEY for tests
      process.env.THREEXPL_API_KEY = 'test-key';
    });

    afterEach(() => {
      delete process.env.THREEXPL_API_KEY;
    });

    it('should return true for DASH (high confidence)', () => {
      expect(collector.hasHighConfidenceData('DASH')).toBe(true);
    });

    it('should return true for XNO (high confidence)', () => {
      expect(collector.hasHighConfidenceData('XNO')).toBe(true);
    });

    it('should return true for BTC when 3xpl API key is available', () => {
      // Mock ThreeXplCollector.isSupported
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(true);
      
      expect(collector.hasHighConfidenceData('BTC')).toBe(true);
    });

    it('should return false for BTC when 3xpl API key is NOT available', () => {
      delete process.env.THREEXPL_API_KEY;
      
      // Mock ThreeXplCollector.isSupported
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(true);
      
      expect(collector.hasHighConfidenceData('BTC')).toBe(false);
    });

    it('should return false for XMR (no dedicated collector)', () => {
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(false);
      
      expect(collector.hasHighConfidenceData('XMR')).toBe(false);
    });

    it('should return false for RVN (no dedicated collector)', () => {
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(false);
      
      expect(collector.hasHighConfidenceData('RVN')).toBe(false);
    });

    it('should return false for XCH (no dedicated collector)', () => {
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(false);
      
      expect(collector.hasHighConfidenceData('XCH')).toBe(false);
    });

    it('should return false for EGLD (no dedicated collector)', () => {
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(false);
      
      expect(collector.hasHighConfidenceData('EGLD')).toBe(false);
    });

    it('should return false for ZCL (no dedicated collector)', () => {
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(false);
      
      expect(collector.hasHighConfidenceData('ZCL')).toBe(false);
    });
  });

  describe('getTransactionMetrics - unsupported coins', () => {
    it('should log info message for unsupported coin using CoinGecko', async () => {
      // Mock ThreeXplCollector.isSupported to return false
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(false);
      
      // Mock CoinGecko to return metrics
      const coingeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(coingeckoCollector, 'collectMetrics').mockResolvedValue({
        communitySize: 100000,
        annualTxCount: 1000000,
        annualTxValue: 5000000000,
        developers: 50,
        currentPrice: 100,
        marketCap: 1000000000,
        circulatingSupply: 10000000,
        totalSupply: 20000000
      });
      
      await collector.getTransactionMetrics('XMR');
      
      // Verify logger.info was called
      expect(logger.info).toHaveBeenCalledWith(
        'No dedicated collector for coin, using CoinGecko estimation',
        expect.objectContaining({
          coinSymbol: 'XMR',
          reason: 'No blockchain-specific data source available'
        })
      );
    });

    it('should add issue to metrics for unsupported coin', async () => {
      // Mock ThreeXplCollector.isSupported to return false
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(false);
      
      // Mock CoinGecko to return metrics
      const coingeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(coingeckoCollector, 'collectMetrics').mockResolvedValue({
        communitySize: 50000,
        annualTxCount: 500000,
        annualTxValue: 2000000000,
        developers: 25,
        currentPrice: 50,
        marketCap: 500000000,
        circulatingSupply: 10000000,
        totalSupply: 10000000
      });
      
      const result = await collector.getTransactionMetrics('RVN');
      
      // Verify issue was added
      expect(result.issues).toBeDefined();
      expect(result.issues).toContain('No dedicated blockchain collector for RVN — using CoinGecko volume estimation');
    });

    it('should handle multiple unsupported coins correctly', async () => {
      const unsupportedCoins = ['XMR', 'RVN', 'XCH', 'EGLD', 'ZCL'];
      
      // Mock ThreeXplCollector.isSupported to return false
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(false);
      
      // Mock CoinGecko to return metrics
      const coingeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(coingeckoCollector, 'collectMetrics').mockResolvedValue({
        communitySize: 10000,
        annualTxCount: 100000,
        annualTxValue: 1000000000,
        developers: 10,
        currentPrice: 10,
        marketCap: 100000000,
        circulatingSupply: 10000000,
        totalSupply: 10000000
      });
      
      for (const coin of unsupportedCoins) {
        const result = await collector.getTransactionMetrics(coin);
        
        expect(result.issues).toContain(`No dedicated blockchain collector for ${coin} — using CoinGecko volume estimation`);
        expect(logger.info).toHaveBeenCalledWith(
          'No dedicated collector for coin, using CoinGecko estimation',
          expect.objectContaining({
            coinSymbol: coin,
            reason: 'No blockchain-specific data source available'
          })
        );
      }
    });
  });

  describe('getDataSource', () => {
    it('should return correct data source for custom collectors', () => {
      expect(collector.getDataSource('DASH')).toBe('custom-dash');
      expect(collector.getDataSource('XNO')).toBe('custom-nano');
      expect(collector.getDataSource('NANO')).toBe('custom-nano');
      expect(collector.getDataSource('NEAR')).toBe('custom-near');
      expect(collector.getDataSource('ICP')).toBe('custom-icp');
    });

    it('should return coingecko for unsupported coins', () => {
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(false);
      
      expect(collector.getDataSource('XMR')).toBe('coingecko');
      expect(collector.getDataSource('RVN')).toBe('coingecko');
      expect(collector.getDataSource('XCH')).toBe('coingecko');
      expect(collector.getDataSource('EGLD')).toBe('coingecko');
      expect(collector.getDataSource('ZCL')).toBe('coingecko');
    });

    it('should return 3xpl for supported coins when API key is available', () => {
      process.env.THREEXPL_API_KEY = 'test-key';
      
      const threexplCollector = (collector as any).threexplCollector;
      jest.spyOn(threexplCollector, 'isSupported').mockReturnValue(true);
      
      expect(collector.getDataSource('BTC')).toBe('3xpl');
      expect(collector.getDataSource('ETH')).toBe('3xpl');
      
      delete process.env.THREEXPL_API_KEY;
    });
  });
});
