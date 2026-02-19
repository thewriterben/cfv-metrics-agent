import axios from 'axios';
import type { SimpleCFVMetrics, DataSource, ValidationResult } from '../types/index.js';
import { CFVCalculator } from '../utils/CFVCalculator.js';
import {
  CIRCULATING_SUPPLY_DIVISOR,
  MAX_ONCHAIN_SCORE,
  STARS_WEIGHT_DIVISOR,
  FORKS_WEIGHT_DIVISOR,
} from '../utils/CommunityConstants.js';

/**
 * CoinGecko REST API Collector
 * Direct HTTP API calls to CoinGecko - more reliable than MCP for simple use cases
 */
export class CoinGeckoAPICollector {
  private apiKey: string;
  private baseUrl: string;
  
  // Transaction estimation constants
  // Rationale: Different market cap tiers have different transaction patterns
  private static readonly LARGE_CAP_THRESHOLD = 10_000_000_000; // $10B
  private static readonly MID_CAP_THRESHOLD = 1_000_000_000;    // $1B
  private static readonly LARGE_CAP_AVG_TX_RATIO = 0.0005;      // 0.05% of market cap
  private static readonly MID_CAP_AVG_TX_RATIO = 0.001;         // 0.1% of market cap
  private static readonly SMALL_CAP_SUPPLY_VELOCITY = 0.01;     // 1% of supply moves in avg tx
  private static readonly FALLBACK_TX_MULTIPLIER = 100;         // price × 100 when no other data available
  private static readonly MIN_AVG_TX_VALUE = 1;                 // Minimum $1 to prevent unrealistic estimates
  private static readonly MAX_AVG_TX_VALUE = 10000;             // Maximum average transaction value in USD
  private static readonly MARKET_CAP_RATIO = 0.0001;            // 0.0001 of market cap (0.01%) used for avgTxValue estimation
  private static readonly DAYS_PER_YEAR = 365;                  // Days in a year for annualization
  // Note: Small cap uses 1% (not 5% like Nano's annual velocity) because this represents
  // the supply fraction moved in an average transaction. Multiple transactions throughout
  // the year result in higher cumulative velocity.

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

      // Community Size - Composite scoring approach
      // Addresses issue: Reward real activity over vanity metrics
      // Weights: onChain (50%), GitHub (30%), Social (20%)
      
      // Social metrics (easier to game)
      const twitterFollowers = communityData.twitter_followers || 0;
      const redditSubscribers = communityData.reddit_subscribers || 0;
      const telegramUsers = communityData.telegram_channel_user_count || 0;
      
      // GitHub metrics (moderate difficulty to game)
      const contributors = developerData.contributors || 0;
      const stars = developerData.stars || 0;
      const forks = developerData.forks || 0;
      
      // Calculate component scores
      const socialMetrics = [twitterFollowers, redditSubscribers, telegramUsers].filter(v => v > 0);
      const socialScore = socialMetrics.length > 0 
        ? socialMetrics.reduce((sum, val) => sum + val, 0) / socialMetrics.length 
        : 0;
      
      const githubScore = contributors > 0 
        ? contributors + (stars / STARS_WEIGHT_DIVISOR) + (forks / FORKS_WEIGHT_DIVISOR)
        : 0;
      
      // On-chain estimation (CoinGecko doesn't provide this directly)
      const circulatingSupply = marketData.circulating_supply || 0;
      const onChainScore = circulatingSupply > 0 
        ? Math.min(circulatingSupply / CIRCULATING_SUPPLY_DIVISOR, MAX_ONCHAIN_SCORE)
        : 0;
      
      // Get community weights from CFVCalculator (single source of truth)
      const weights = CFVCalculator.getCommunityWeights();
      
      // Apply composite weights
      const communitySize = Math.round(
        onChainScore * weights.onChain +
        githubScore * weights.github +
        socialScore * weights.social
      );

      // Transaction metrics (estimated from volume)
      const volume24h = marketData.total_volume?.usd || 0;
      const marketCap = marketData.market_cap?.usd || 0;
      const price = marketData.current_price?.usd || 0;

      // Estimate transaction metrics from volume
      const annualTxValue = volume24h * CoinGeckoAPICollector.DAYS_PER_YEAR;
      const avgTxValue = this.estimateAvgTxValue(marketCap, price, circulatingSupply);
      const annualTxCount = avgTxValue > 0 ? Math.round(annualTxValue / avgTxValue) : 0;



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
   * Estimate average transaction value based on market cap tier
   */
  private estimateAvgTxValue(marketCap: number, price: number, circulatingSupply: number): number {
    if (marketCap >= CoinGeckoAPICollector.LARGE_CAP_THRESHOLD) {
      // Large cap: use market cap ratio
      return Math.max(
        marketCap * CoinGeckoAPICollector.LARGE_CAP_AVG_TX_RATIO,
        CoinGeckoAPICollector.MIN_AVG_TX_VALUE
      );
    } else if (marketCap >= CoinGeckoAPICollector.MID_CAP_THRESHOLD) {
      // Mid cap: use market cap ratio
      return Math.max(
        marketCap * CoinGeckoAPICollector.MID_CAP_AVG_TX_RATIO,
        CoinGeckoAPICollector.MIN_AVG_TX_VALUE
      );
    } else if (circulatingSupply > 0) {
      // Small cap: use supply velocity
      return Math.max(
        circulatingSupply * CoinGeckoAPICollector.SMALL_CAP_SUPPLY_VELOCITY * price,
        CoinGeckoAPICollector.MIN_AVG_TX_VALUE
      );
    } else {
      // Fallback: price multiplier
      return Math.max(
        price * CoinGeckoAPICollector.FALLBACK_TX_MULTIPLIER,
        CoinGeckoAPICollector.MIN_AVG_TX_VALUE
      );
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

    }

    if (metrics.developers === 0) {
      warnings.push('No developer data available');
    }


    return {
      isValid: errors.length === 0,
      confidence: 'LOW',
      issues: [...errors, ...warnings]
    };
  }
}
