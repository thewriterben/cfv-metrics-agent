import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CryptoCompareCollector } from '../../../collectors/CryptoCompareCollector.js';
import axios from 'axios';

jest.mock('axios');

describe('CryptoCompareCollector', () => {
  let collector: CryptoCompareCollector;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
    };
    (axios.create as jest.Mock) = jest.fn().mockReturnValue(mockAxiosInstance);

    collector = new CryptoCompareCollector('test-api-key');
  });

  describe('supports', () => {
    it('should return true for all CFV coins', async () => {
      const coins = ['BTC', 'ETH', 'DASH', 'DGB', 'XMR', 'RVN', 'XCH', 'XEC', 'XNO', 'NEAR', 'ICP', 'EGLD', 'ZCL', 'DGD', 'BLK'];
      for (const coin of coins) {
        expect(await collector.supports(coin)).toBe(true);
      }
    });

    it('should return true for lowercase symbols', async () => {
      expect(await collector.supports('btc')).toBe(true);
    });

    it('should return false for unknown coins', async () => {
      expect(await collector.supports('UNKNOWN')).toBe(false);
    });
  });

  describe('collect - price', () => {
    it('should collect price from CryptoCompare', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { USD: 62000 },
      });

      const result = await collector.collect('BTC', 'price');

      expect(result.value).toBe(62000);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.source).toBe('CryptoCompare');
    });

    it('should throw when price is 0', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { USD: 0 },
      });

      await expect(collector.collect('BTC', 'price')).rejects.toThrow(
        /Price data not available/,
      );
    });
  });

  describe('collect - marketCap', () => {
    it('should collect market cap from full data', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          RAW: { BTC: { USD: { MKTCAP: 1200000000000 } } },
        },
      });

      const result = await collector.collect('BTC', 'marketCap');

      expect(result.value).toBe(1200000000000);
      expect(result.confidence).toBe('MEDIUM');
    });

    it('should throw when market cap is 0', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { RAW: { BTC: { USD: { MKTCAP: 0 } } } },
      });

      await expect(collector.collect('BTC', 'marketCap')).rejects.toThrow(
        /Market cap not available/,
      );
    });
  });

  describe('collect - circulatingSupply', () => {
    it('should collect circulating supply', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          RAW: { ETH: { USD: { SUPPLY: 120000000 } } },
        },
      });

      const result = await collector.collect('ETH', 'circulatingSupply');

      expect(result.value).toBe(120000000);
      expect(result.confidence).toBe('MEDIUM');
    });
  });

  describe('collect - annualTransactionValue', () => {
    it('should annualize daily volume', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          RAW: { BTC: { USD: { TOTALVOLUME24HTO: 50000000000 } } },
        },
      });

      const result = await collector.collect('BTC', 'annualTransactionValue');

      expect(result.value).toBe(50000000000 * 365);
      expect(result.confidence).toBe('MEDIUM');
    });

    it('should throw when volume is 0', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { RAW: { BTC: { USD: { TOTALVOLUME24HTO: 0 } } } },
      });

      await expect(collector.collect('BTC', 'annualTransactionValue')).rejects.toThrow(
        /Volume data not available/,
      );
    });
  });

  describe('collect - adoption', () => {
    it('should collect social data for coins with IDs', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          Data: {
            Twitter: { followers: 50000 },
            Reddit: { subscribers: 30000 },
          },
        },
      });

      const result = await collector.collect('BTC', 'adoption');

      expect(result.value).toBe(80000);
      expect(result.confidence).toBe('LOW');
      expect(result.metadata?.twitterFollowers).toBe(50000);
      expect(result.metadata?.redditSubscribers).toBe(30000);
    });

    it('should return 0 for coins without CryptoCompare IDs', async () => {
      const result = await collector.collect('XNO', 'adoption');

      expect(result.value).toBe(0);
      expect(result.confidence).toBe('LOW');
      expect(result.metadata?.note).toContain('No CryptoCompare social coin ID');
    });
  });

  describe('collect - unsupported metric', () => {
    it('should throw for unsupported metrics', async () => {
      await expect(collector.collect('BTC', 'developers')).rejects.toThrow(
        /not supported by CryptoCompare/,
      );
    });
  });

  describe('getHealth', () => {
    it('should return healthy status initially', async () => {
      const health = await collector.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.errorRate).toBe(0);
    });
  });
});
