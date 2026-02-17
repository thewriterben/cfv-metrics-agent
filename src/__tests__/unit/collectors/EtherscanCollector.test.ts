import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EtherscanCollector } from '../../../collectors/EtherscanCollector.js';
import axios from 'axios';

// Mock axios for API calls
jest.mock('axios');

describe('EtherscanCollector', () => {
  let collector: EtherscanCollector;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create to return a mock instance
    mockAxiosInstance = {
      get: jest.fn(),
    };
    (axios.create as jest.Mock) = jest.fn().mockReturnValue(mockAxiosInstance);
    
    // Create a new collector instance for each test
    collector = new EtherscanCollector(
      'test-etherscan-key',
      undefined,
      undefined,
      'test-coingecko-key'
    );
  });

  describe('supports', () => {
    it('should return true for ETH', async () => {
      const result = await collector.supports('ETH');
      expect(result).toBe(true);
    });

    it('should return false for non-ETH coins', async () => {
      expect(await collector.supports('BTC')).toBe(false);
      expect(await collector.supports('DASH')).toBe(false);
      expect(await collector.supports('XMR')).toBe(false);
    });
  });

  describe('collect - annualTransactionValue', () => {
    it('should collect annual transaction value using CoinGecko fallback', async () => {
      // Mock Etherscan block number response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          result: '0x1234567', // Mock block number in hex
        },
      });

      // Mock CoinGecko collector
      const mockCoinGeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(mockCoinGeckoCollector, 'collectMetrics').mockResolvedValue({
        communitySize: 1000000,
        annualTxCount: 50000000,
        annualTxValue: 10000000000000, // $10 trillion annually
        developers: 1000,
        currentPrice: 2000,
        marketCap: 250000000000,
        circulatingSupply: 120000000,
        totalSupply: 120000000,
      });

      const result = await collector.collect('ETH', 'annualTransactionValue');

      expect(result.value).toBe(10000000000000);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.source).toContain('Etherscan');
      expect(result.source).toContain('CoinGecko');
      expect(result.metadata?.methodology).toContain('volume24h × 365');
      expect(result.metadata?.usedCoinGecko).toBe(true);
      expect(result.metadata?.coinGeckoSource).toBe('CoinGecko (volume24h × 365)');
    });

    it('should return LOW confidence when CoinGecko fallback fails', async () => {
      // Mock Etherscan block number response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          result: '0x1234567',
        },
      });

      // Mock CoinGecko to fail
      const mockCoinGeckoCollector = (collector as any).coingeckoCollector;
      jest.spyOn(mockCoinGeckoCollector, 'collectMetrics').mockRejectedValue(
        new Error('CoinGecko API error')
      );

      const result = await collector.collect('ETH', 'annualTransactionValue');

      expect(result.value).toBe(0);
      expect(result.confidence).toBe('LOW');
      expect(result.metadata?.issues).toContain('Transaction volume data not available - CoinGecko fallback failed');
    });

    it('should handle Etherscan API errors with descriptive messages', async () => {
      // Mock Etherscan to fail
      mockAxiosInstance.get.mockRejectedValueOnce(
        new Error('Etherscan API rate limit exceeded')
      );

      await expect(
        collector.collect('ETH', 'annualTransactionValue')
      ).rejects.toThrow('Failed to collect annual transaction value for ETH');
    });
  });

  describe('collect - annualTransactions', () => {
    it('should collect annual transactions using blockchain constants', async () => {
      // Mock Etherscan block number response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          result: '0x1234567',
        },
      });

      const result = await collector.collect('ETH', 'annualTransactions');

      // Expected: 7200 blocks/day * 365 days * 175 txs/block = 460,050,000
      const expectedValue = 7200 * 365 * 175;
      expect(result.value).toBe(expectedValue);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.source).toContain('Etherscan');
      expect(result.source).toContain('Blockchain Constants');
      expect(result.metadata?.methodology).toContain('7200 blocks/day');
      expect(result.metadata?.methodology).toContain('365 days');
      expect(result.metadata?.methodology).toContain('175 txs/block');
      expect(result.metadata?.avgTxsPerBlock).toBe(175);
    });

    it('should handle Etherscan API errors with descriptive messages', async () => {
      // Mock Etherscan to fail
      mockAxiosInstance.get.mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(
        collector.collect('ETH', 'annualTransactions')
      ).rejects.toThrow('Failed to collect annual transactions for ETH');
    });
  });

  describe('collect - unsupported coin', () => {
    it('should throw error for non-ETH coins', async () => {
      await expect(
        collector.collect('BTC', 'annualTransactionValue')
      ).rejects.toThrow('Etherscan only supports Ethereum, not BTC');
    });
  });

  describe('collect - unsupported metric', () => {
    it('should throw error for unsupported metrics', async () => {
      await expect(
        collector.collect('ETH', 'communitySize' as any)
      ).rejects.toThrow('Metric communitySize not supported by Etherscan collector');
    });
  });

  describe('getHealth', () => {
    it('should return healthy status when no errors', async () => {
      const health = await collector.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.errorRate).toBe(0);
    });
  });
});
