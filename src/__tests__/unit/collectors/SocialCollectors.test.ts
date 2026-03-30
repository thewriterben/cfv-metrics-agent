import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RedditCollector } from '../../../collectors/RedditCollector.js';
import { TwitterCollector } from '../../../collectors/TwitterCollector.js';
import axios from 'axios';

jest.mock('axios');

describe('RedditCollector', () => {
  let collector: RedditCollector;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
    };
    (axios.create as jest.Mock) = jest.fn().mockReturnValue(mockAxiosInstance);

    collector = new RedditCollector();
  });

  describe('supports', () => {
    it('should return true for coins with subreddit mappings', async () => {
      expect(await collector.supports('BTC')).toBe(true);
      expect(await collector.supports('ETH')).toBe(true);
      expect(await collector.supports('DASH')).toBe(true);
      expect(await collector.supports('XMR')).toBe(true);
      expect(await collector.supports('XNO')).toBe(true);
    });

    it('should return true for lowercase symbols', async () => {
      expect(await collector.supports('btc')).toBe(true);
    });

    it('should return false for coins without mappings', async () => {
      expect(await collector.supports('UNKNOWN')).toBe(false);
    });
  });

  describe('collect - adoption', () => {
    it('should collect subscriber count from Reddit', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            subscribers: 5000000,
            accounts_active: 12000,
          },
        },
      });

      const result = await collector.collect('BTC', 'adoption');

      expect(result.value).toBe(5000000);
      expect(result.confidence).toBe('LOW');
      expect(result.source).toBe('Reddit');
      expect(result.metadata?.subreddit).toBe('Bitcoin');
      expect(result.metadata?.activeUsers).toBe(12000);
    });

    it('should handle missing accounts_active', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            subscribers: 100000,
          },
        },
      });

      const result = await collector.collect('ETH', 'adoption');

      expect(result.value).toBe(100000);
      expect(result.metadata?.activeUsers).toBe(0);
    });
  });

  describe('collect - unsupported metric', () => {
    it('should throw for non-adoption metrics', async () => {
      await expect(collector.collect('BTC', 'price')).rejects.toThrow(
        /not supported by Reddit/,
      );
    });
  });

  describe('collect - error handling', () => {
    it('should handle 404 (subreddit not found)', async () => {
      const error = new Error('Request failed');
      (error as any).response = { status: 404 };
      (error as any).isAxiosError = true;
      Object.defineProperty(axios, 'isAxiosError', {
        value: (e: any) => e.isAxiosError === true,
        writable: true,
      });
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(collector.collect('BTC', 'adoption')).rejects.toThrow(
        /not found/,
      );
    });

    it('should throw for unsupported coins', async () => {
      await expect(collector.collect('UNKNOWN', 'adoption')).rejects.toThrow(
        /does not have a subreddit mapping/,
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

describe('TwitterCollector', () => {
  let collector: TwitterCollector;
  let collectorNoToken: TwitterCollector;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
    };
    (axios.create as jest.Mock) = jest.fn().mockReturnValue(mockAxiosInstance);

    // Store original env
    delete process.env.TWITTER_BEARER_TOKEN;

    collector = new TwitterCollector('test-bearer-token');
    collectorNoToken = new TwitterCollector(undefined);
  });

  describe('supports', () => {
    it('should return true for coins with mappings when token is set', async () => {
      expect(await collector.supports('BTC')).toBe(true);
      expect(await collector.supports('ETH')).toBe(true);
      expect(await collector.supports('NEAR')).toBe(true);
    });

    it('should return false when no bearer token is set', async () => {
      expect(await collectorNoToken.supports('BTC')).toBe(false);
    });

    it('should return false for unmapped coins', async () => {
      expect(await collector.supports('UNKNOWN')).toBe(false);
      expect(await collector.supports('ZCL')).toBe(false);
    });
  });

  describe('collect - adoption', () => {
    it('should collect follower count from Twitter', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            public_metrics: {
              followers_count: 6700000,
            },
          },
        },
      });

      const result = await collector.collect('BTC', 'adoption');

      expect(result.value).toBe(6700000);
      expect(result.confidence).toBe('LOW');
      expect(result.source).toBe('Twitter');
      expect(result.metadata?.username).toBe('Bitcoin');
      expect(result.metadata?.followers).toBe(6700000);
    });

    it('should throw when no bearer token is configured', async () => {
      await expect(collectorNoToken.collect('BTC', 'adoption')).rejects.toThrow(
        /TWITTER_BEARER_TOKEN is missing/,
      );
    });
  });

  describe('collect - unsupported metric', () => {
    it('should throw for non-adoption metrics', async () => {
      await expect(collector.collect('BTC', 'price')).rejects.toThrow(
        /not supported by Twitter/,
      );
    });
  });

  describe('collect - error handling', () => {
    it('should throw for unmapped coins', async () => {
      await expect(collector.collect('ZCL', 'adoption')).rejects.toThrow(
        /does not have a handle mapping/,
      );
    });
  });

  describe('getHealth', () => {
    it('should return down status when no token', async () => {
      const health = await collectorNoToken.getHealth();
      expect(health.status).toBe('down');
    });

    it('should return healthy when token is set', async () => {
      const health = await collector.getHealth();
      expect(health.status).toBe('healthy');
    });
  });
});
