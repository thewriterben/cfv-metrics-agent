import axios from 'axios';
import type { SimpleCFVMetrics, DataSource, ValidationResult } from '../types/index.js';

/**
 * CoinGecko REST API Collector
 * Direct HTTP API calls to CoinGecko - more reliable than MCP for simple use cases
 */
export class CoinGeckoAPICollector {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
    // Use demo API endpoint
    this.baseUrl = 'https://api.coingecko.com/api/v3';
  }

  /**
   * Collect CFV metrics for a cryptocurrency
   */
  async collectMetrics(symbol: string): Promise<SimpleCFVMetrics> {
    try {
      // Convert symbol to coin ID (simplified mapping)
      const coinId = this.symbolToCoinId(symbol);

      // Get comprehensive coin data
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };

      if (this.apiKey) {
        headers['x-cg-demo-api-key'] = this.apiKey;
      }

      const response = await axios.get(`${this.baseUrl}/coins/${coinId}`, {
        headers,
        params: {
          localization: 'false',
          tickers: 'false',
          market_data: 'true',
          community_data: 'true',
          developer_data: 'true',
          sparkline: 'false'
        },
        timeout: 30000
      });

      const data = response.data;

      // Extract CFV metrics
      const marketData = data.market_data || {};
      const communityData = data.community_data || {};
      const developerData = data.developer_data || {};

      // Community Size (social media followers + active addresses)
      const twitterFollowers = communityData.twitter_followers || 0;
      const redditSubscribers = communityData.reddit_subscribers || 0;
      const telegramUsers = communityData.telegram_channel_user_count || 0;
      const communitySize = twitterFollowers + redditSubscribers + telegramUsers;

      // Transaction metrics (estimated from volume)
      const volume24h = marketData.total_volume?.usd || 0;
      const marketCap = marketData.market_cap?.usd || 0;
      const price = marketData.current_price?.usd || 0;
      const circulatingSupply = marketData.circulating_supply || 0;

      // Estimate annual transactions from 24h volume
      // Improved heuristic: Use a tiered approach based on market cap
      // Large caps (>$10B): avg tx = 0.05% of market cap
      // Mid caps ($1B-$10B): avg tx = 0.1% of market cap  
      // Small caps (<$1B): avg tx = price * 10 (smaller transactions)
      let estimatedAvgTxValue: number;
      if (marketCap > 10_000_000_000) {
        // Large cap: assume larger average transactions
        estimatedAvgTxValue = marketCap * 0.0005; // 0.05%
      } else if (marketCap > 1_000_000_000) {
        // Mid cap
        estimatedAvgTxValue = marketCap * 0.001; // 0.1%
      } else if (marketCap > 0) {
        // Small cap: use supply-based estimate
        estimatedAvgTxValue = (circulatingSupply > 0 && price > 0) 
          ? (circulatingSupply * price * 0.01) 
          : price * 10;
      } else {
        // Fallback
        estimatedAvgTxValue = price * 100;
      }
      
      const dailyTxCount = estimatedAvgTxValue > 0 ? volume24h / estimatedAvgTxValue : 0;
      const annualTxCount = Math.round(dailyTxCount * 365);
      const annualTxValue = volume24h * 365;

      // Developer activity
      const developers = developerData.forks || 0;

      return {
        communitySize,
        annualTxCount,
        annualTxValue,
        developers,
        currentPrice: price,
        marketCap,
        circulatingSupply: marketData.circulating_supply || 0,
        totalSupply: marketData.total_supply || 0
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`CoinGecko API error: ${error.response?.status} ${error.response?.statusText || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Convert symbol to CoinGecko coin ID
   * This is a simplified mapping - in production, use CoinGecko's /coins/list endpoint
   */
  private symbolToCoinId(symbol: string): string {
    const mapping: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'DASH': 'dash',
      'DGB': 'digibyte',
      'XMR': 'monero',
      'RVN': 'ravencoin',
      'XCH': 'chia',
      'XEC': 'ecash',
      'XNO': 'nano',
      'NEAR': 'near',
      'ICP': 'internet-computer',
      'EGLD': 'elrond-erd-2',
      'DGD': 'digixdao',
      'ZCL': 'zclassic'
    };

    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  /**
   * Validate collected data
   */
  validateData(metrics: SimpleCFVMetrics): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (metrics.communitySize === 0) {
      warnings.push('No community data available');
    }

    if (metrics.annualTxCount === 0) {
      warnings.push('No transaction data available');
    } else {
      warnings.push('Transaction count estimated using volume-based heuristics - confidence MEDIUM');
    }

    if (metrics.developers === 0) {
      warnings.push('No developer data available');
    }

    // Mark confidence as MEDIUM due to estimation heuristics
    return {
      isValid: errors.length === 0,
      confidence: 'MEDIUM',
      issues: [...errors, ...warnings]
    };
  }
}
