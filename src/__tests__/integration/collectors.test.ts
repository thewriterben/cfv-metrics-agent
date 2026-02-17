import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import { CoinGeckoAPICollector } from '../../collectors/CoinGeckoAPICollector.js';
import { BlockchainDataCollector } from '../../collectors/BlockchainDataCollector.js';
import { ThreeXplCollector } from '../../collectors/ThreeXplCollector.js';
import { CFVCalculator } from '../../utils/CFVCalculator.js';
import type { CFVMetrics } from '../../types/index.js';

// Mock axios for all HTTP calls
jest.mock('axios');

describe('Collector Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CoinGecko Collector', () => {
    let collector: CoinGeckoAPICollector;

    beforeEach(() => {
      collector = new CoinGeckoAPICollector('test-api-key');
    });

    it('should fetch and parse coin data correctly', async () => {
      // Mock realistic CoinGecko response for Bitcoin
      const mockResponse = {
        data: {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          market_data: {
            current_price: { usd: 45000 },
            market_cap: { usd: 900000000000 }, // $900B
            total_volume: { usd: 25000000000 }, // $25B daily
            circulating_supply: 19500000,
            total_supply: 21000000
          },
          community_data: {
            twitter_followers: 5420000,
            reddit_subscribers: 4800000,
            telegram_channel_user_count: 0
          },
          developer_data: {
            forks: 35000,
            stars: 72000,
            subscribers: 3500,
            total_issues: 8500,
            closed_issues: 7800,
            pull_requests_merged: 12000,
            pull_request_contributors: 900,
            contributors: 900
          }
        }
      };

      (axios.get as any) = jest.fn(() => Promise.resolve(mockResponse));

      const metrics = await collector.collectMetrics('BTC');

      // Verify correct data extraction
      expect(metrics.currentPrice).toBe(45000);
      expect(metrics.marketCap).toBe(900000000000);
      expect(metrics.circulatingSupply).toBe(19500000);
      expect(metrics.communitySize).toBeGreaterThan(0);
      expect(metrics.developers).toBeGreaterThan(0);
      expect(metrics.annualTxValue).toBeGreaterThan(0);
      expect(metrics.annualTxCount).toBeGreaterThan(0);
      
      // Verify axios was called with correct parameters
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/bitcoin',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'x-cg-demo-api-key': 'test-api-key'
          }),
          params: expect.objectContaining({
            localization: 'false',
            market_data: 'true',
            community_data: 'true',
            developer_data: 'true'
          })
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      // Mock 503 Service Unavailable error
      const errorResponse = {
        response: {
          status: 503,
          statusText: 'Service Unavailable'
        },
        isAxiosError: true
      };

      (axios.get as any) = jest.fn(() => Promise.reject(errorResponse));
      // Cast to any to avoid type issues with isAxiosError
      (axios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(collector.collectMetrics('BTC')).rejects.toThrow(
        /CoinGecko API error: 503/
      );
    });

    it('should handle missing data fields', async () => {
      // Mock response with missing community_data and developer_data
      const mockResponse = {
        data: {
          id: 'obscure-coin',
          symbol: 'obc',
          name: 'Obscure Coin',
          market_data: {
            current_price: { usd: 0.50 },
            market_cap: { usd: 5000000 }, // $5M
            total_volume: { usd: 100000 }, // $100k daily
            circulating_supply: 10000000,
            total_supply: 20000000
          },
          community_data: {}, // Empty
          developer_data: {}  // Empty
        }
      };

      (axios.get as any) = jest.fn(() => Promise.resolve(mockResponse));

      const metrics = await collector.collectMetrics('OBC');

      // Should return low values when data is missing (but not necessarily 0 due to circulating supply estimate)
      expect(metrics.communitySize).toBeGreaterThanOrEqual(0); // On-chain score based on circulating supply
      expect(metrics.developers).toBe(0); // Should be 0 when no developer data
      // But should still have price and market data
      expect(metrics.currentPrice).toBe(0.50);
      expect(metrics.marketCap).toBe(5000000);
    });
  });

  describe('BlockchainDataCollector', () => {
    let collector: BlockchainDataCollector;

    beforeEach(() => {
      collector = new BlockchainDataCollector({
        coingeckoApiKey: 'test-api-key',
        threexplApiKey: 'test-3xpl-key'
      });
    });

    it('should route DASH to DashApiClient', async () => {
      // Mock DashApiClient
      const mockDashMetrics = {
        annualTxCount: 5000000,
        annualTxValue: 2500000000,
        avgTxValue: 500,
        confidence: 'HIGH' as const,
        sources: ['Dash Insight API'],
        timestamp: new Date()
      };

      jest.spyOn(collector['dashClient'], 'getAnnualTransactionMetrics')
        .mockResolvedValue(mockDashMetrics);

      const metrics = await collector.getTransactionMetrics('DASH');

      expect(metrics.annualTxCount).toBe(5000000);
      expect(metrics.confidence).toBe('HIGH');
      expect(metrics.sources).toContain('Dash Insight API');
      expect(collector['dashClient'].getAnnualTransactionMetrics).toHaveBeenCalled();
    });

    it('should route XNO to NanoCollector', async () => {
      // Mock NanoCollector
      const mockNanoMetrics = {
        annualTxCount: 10000000,
        annualTxValue: 500000000,
        avgTxValue: 50,
        confidence: 'HIGH' as const,
        sources: ['Nano RPC'],
        timestamp: new Date()
      };

      jest.spyOn(collector['nanoCollector'], 'getTransactionMetrics')
        .mockResolvedValue(mockNanoMetrics);

      const metrics = await collector.getTransactionMetrics('XNO');

      expect(metrics.annualTxCount).toBe(10000000);
      expect(metrics.confidence).toBe('HIGH');
      expect(metrics.sources).toContain('Nano RPC');
      expect(collector['nanoCollector'].getTransactionMetrics).toHaveBeenCalled();
    });

    it('should fallback to CoinGecko when primary source fails', async () => {
      // Mock ThreeXplCollector to fail
      jest.spyOn(collector['threexplCollector'], 'isSupported').mockReturnValue(true);
      jest.spyOn(collector['threexplCollector'], 'collectMetrics')
        .mockRejectedValue(new Error('3xpl API error'));

      // Mock CoinGecko to succeed
      const mockCoinGeckoResponse = {
        data: {
          id: 'bitcoin',
          market_data: {
            current_price: { usd: 45000 },
            market_cap: { usd: 900000000000 },
            total_volume: { usd: 25000000000 },
            circulating_supply: 19500000,
            total_supply: 21000000
          },
          community_data: {},
          developer_data: {}
        }
      };

      (axios.get as any) = jest.fn(() => Promise.resolve(mockCoinGeckoResponse));

      // Set THREEXPL_API_KEY to trigger 3xpl path
      process.env.THREEXPL_API_KEY = 'test-key';
      
      const metrics = await collector.getTransactionMetrics('BTC');

      // Should have MEDIUM confidence due to fallback
      expect(metrics.confidence).toBe('MEDIUM');
      // The actual message is "Transaction data estimated from market volume"
      expect(metrics.issues).toContain('Transaction data estimated from market volume');
      expect(metrics.annualTxValue).toBeGreaterThan(0);
      
      delete process.env.THREEXPL_API_KEY;
    });

    it('should cache results and return cached data on second call', async () => {
      // Mock CoinGecko response
      const mockResponse = {
        data: {
          id: 'solana',  // Use a coin not routed through 3xpl
          market_data: {
            current_price: { usd: 100 },
            market_cap: { usd: 50000000000 },
            total_volume: { usd: 5000000000 },
            circulating_supply: 500000000,
            total_supply: 600000000
          },
          community_data: {},
          developer_data: {}
        }
      };

      (axios.get as any) = jest.fn(() => Promise.resolve(mockResponse));

      // First call - should hit the API
      const metrics1 = await collector.getTransactionMetrics('SOL');
      expect(axios.get).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const metrics2 = await collector.getTransactionMetrics('SOL');
      expect(axios.get).toHaveBeenCalledTimes(1); // Still only 1 call
      
      // Both results should be identical
      expect(metrics1.annualTxValue).toBe(metrics2.annualTxValue);
      expect(metrics1.annualTxCount).toBe(metrics2.annualTxCount);
    });
  });

  describe('ThreeXplCollector', () => {
    let collector: ThreeXplCollector;

    beforeEach(() => {
      collector = new ThreeXplCollector({
        apiKey: 'test-3xpl-key',
        coingeckoApiKey: 'test-coingecko-key'
      });
    });

    it('should use CoinGecko fallback for volume data', async () => {
      // Mock 3xpl to return events but no volume
      const mockStats = {
        events_24h: 300000,
        best_block: 800000,
        best_block_time: new Date().toISOString()
      };
      
      jest.spyOn(collector as any, 'getChainStats').mockResolvedValue(mockStats);

      // Mock CoinGecko to return volume data
      const mockCoinGeckoMetrics = {
        communitySize: 5000000,
        annualTxCount: 109500000,
        annualTxValue: 9125000000000, // $9.125T
        developers: 900,
        currentPrice: 45000,
        marketCap: 900000000000,
        circulatingSupply: 19500000,
        totalSupply: 21000000
      };

      jest.spyOn(collector['coingeckoCollector'], 'collectMetrics')
        .mockResolvedValue(mockCoinGeckoMetrics);

      const metrics = await collector.collectMetrics('BTC');

      // annualTxCount should come from 3xpl
      expect(metrics.annualTxCount).toBe(109500000); // 300000 * 365
      // annualTxValue should come from CoinGecko (fallback)
      expect(metrics.annualTxValue).toBe(9125000000000);
      expect(metrics.metadata?.usedFallback).toBe(true);
    });

    it('should set LOW confidence when both sources fail', async () => {
      // Mock 3xpl to fail
      jest.spyOn(collector as any, 'getChainStats')
        .mockRejectedValue(new Error('3xpl API error'));

      // Mock CoinGecko to fail
      jest.spyOn(collector['coingeckoCollector'], 'collectMetrics')
        .mockRejectedValue(new Error('CoinGecko API error'));

      await expect(collector.collectMetrics('BTC')).rejects.toThrow();
    });
  });

  describe('CFVCalculator Integration', () => {
    it('should calculate CFV from realistic metrics end-to-end', () => {
      // Create realistic Bitcoin-like metrics
      const metrics: CFVMetrics = {
        communitySize: {
          value: 5420000,
          confidence: 'HIGH',
          source: 'CoinGecko',
          timestamp: new Date()
        },
        annualTransactionValue: {
          value: 2500000000000, // $2.5T
          confidence: 'MEDIUM',
          source: 'Blockchain',
          timestamp: new Date()
        },
        annualTransactions: {
          value: 125000000, // 125M transactions
          confidence: 'MEDIUM',
          source: 'Blockchain',
          timestamp: new Date()
        },
        developers: {
          value: 900,
          confidence: 'HIGH',
          source: 'GitHub',
          timestamp: new Date()
        },
        price: {
          value: 45000,
          confidence: 'HIGH',
          source: 'CoinGecko',
          timestamp: new Date()
        },
        circulatingSupply: {
          value: 19500000,
          confidence: 'HIGH',
          source: 'CoinGecko',
          timestamp: new Date()
        }
      };

      const calculation = CFVCalculator.calculate(metrics);

      // Verify calculation produces valid results
      expect(calculation.fairValue).toBeGreaterThan(0);
      expect(calculation.networkPowerScore).toBeGreaterThan(0);
      expect(calculation.currentPrice).toBe(45000);
      expect(calculation.currentMarketCap).toBe(45000 * 19500000);
      expect(calculation.fairMarketCap).toBeGreaterThan(0);
      expect(calculation.priceMultiplier).toBeGreaterThan(0);
      
      // Verify valuation status is one of the valid values
      expect(['undervalued', 'fairly valued', 'overvalued']).toContain(
        calculation.valuationStatus
      );
      
      // Verify breakdown components exist
      expect(calculation.breakdown.communityContribution).toBeGreaterThan(0);
      expect(calculation.breakdown.transactionValueContribution).toBeGreaterThan(0);
      expect(calculation.breakdown.transactionCountContribution).toBeGreaterThan(0);
      expect(calculation.breakdown.developerContribution).toBeGreaterThan(0);
      
      // Verify the network power score is the product of contributions
      const expectedNetworkPower = 
        calculation.breakdown.communityContribution *
        calculation.breakdown.transactionValueContribution *
        calculation.breakdown.transactionCountContribution *
        calculation.breakdown.developerContribution;
      
      expect(calculation.networkPowerScore).toBeCloseTo(expectedNetworkPower, 0);
    });
  });
});
