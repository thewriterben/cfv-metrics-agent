import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BlockchairCollector } from '../../../collectors/BlockchairCollector.js';
import axios from 'axios';

jest.mock('axios');

describe('BlockchairCollector', () => {
  let collector: BlockchairCollector;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
    };
    (axios.create as jest.Mock) = jest.fn().mockReturnValue(mockAxiosInstance);

    collector = new BlockchairCollector('test-blockchair-key');
  });

  describe('supports', () => {
    it('should return true for supported coins', async () => {
      expect(await collector.supports('BTC')).toBe(true);
      expect(await collector.supports('ETH')).toBe(true);
      expect(await collector.supports('DGB')).toBe(true);
      expect(await collector.supports('DASH')).toBe(true);
      expect(await collector.supports('XEC')).toBe(true);
      expect(await collector.supports('XMR')).toBe(true);
    });

    it('should return true for lowercase symbols', async () => {
      expect(await collector.supports('btc')).toBe(true);
      expect(await collector.supports('eth')).toBe(true);
    });

    it('should return false for unsupported coins', async () => {
      expect(await collector.supports('XNO')).toBe(false);
      expect(await collector.supports('NEAR')).toBe(false);
      expect(await collector.supports('ICP')).toBe(false);
      expect(await collector.supports('INVALID')).toBe(false);
    });
  });

  describe('collect - annualTransactions', () => {
    it('should collect and annualize transaction count', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            transactions_24h: 400000,
            blocks_24h: 144,
            transactions: 900000000,
          },
        },
      });

      const result = await collector.collect('BTC', 'annualTransactions');

      expect(result.value).toBe(400000 * 365);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.source).toBe('Blockchair');
      expect(result.metadata?.transactions24h).toBe(400000);
      expect(result.metadata?.chain).toBe('bitcoin');
    });

    it('should throw when transactions_24h is missing', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { blocks_24h: 144 } },
      });

      await expect(collector.collect('BTC', 'annualTransactions')).rejects.toThrow(
        /transactions_24h not available/,
      );
    });

    it('should throw when API returns no data', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: {} });

      await expect(collector.collect('BTC', 'annualTransactions')).rejects.toThrow(
        /Blockchair returned no data/,
      );
    });
  });

  describe('collect - annualTransactionValue', () => {
    it('should collect and annualize transaction value for BTC', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            volume_24h: 5000000000000, // satoshis
            market_price_usd: 60000,
          },
        },
      });

      const result = await collector.collect('BTC', 'annualTransactionValue');

      // (5e12 / 1e8) * 60000 * 365
      const expected = (5000000000000 / 1e8) * 60000 * 365;
      expect(result.value).toBe(expected);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.source).toBe('Blockchair');
      expect(result.metadata?.marketPriceUsd).toBe(60000);
    });

    it('should use correct divisor for ETH (wei)', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            volume_24h: 1e21, // wei
            market_price_usd: 3000,
          },
        },
      });

      const result = await collector.collect('ETH', 'annualTransactionValue');

      const expected = (1e21 / 1e18) * 3000 * 365;
      expect(result.value).toBe(expected);
    });

    it('should throw when volume_24h is missing', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { market_price_usd: 60000 } },
      });

      await expect(collector.collect('BTC', 'annualTransactionValue')).rejects.toThrow(
        /volume_24h or market_price_usd not available/,
      );
    });
  });

  describe('collect - unsupported metric', () => {
    it('should throw for unsupported metrics', async () => {
      await expect(collector.collect('BTC', 'price')).rejects.toThrow(
        /not supported by Blockchair/,
      );
      await expect(collector.collect('BTC', 'adoption')).rejects.toThrow(
        /not supported by Blockchair/,
      );
    });
  });

  describe('collect - unsupported coin', () => {
    it('should throw for unsupported coins', async () => {
      await expect(collector.collect('XNO', 'annualTransactions')).rejects.toThrow(
        /does not support XNO/,
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
