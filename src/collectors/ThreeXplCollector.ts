import axios from 'axios';
import { TransactionMetrics, DataSource, ConfidenceLevel } from '../types/index.js';
import { CoinGeckoAPICollector } from './CoinGeckoAPICollector.js';

/**
 * 3xpl API Collector
 * 
 * Collects blockchain transaction data from 3xpl.com API
 * Supports 5 DGF coins with verified coverage:
 * - Bitcoin (BTC)
 * - Ethereum (ETH)
 * - Dash (DASH)
 * - DigiByte (DGB)
 * - eCash (XEC)
 * 
 * NOT supported by 3xpl:
 * - Monero (XMR) - Privacy coin
 * - Ravencoin (RVN) - Not available
 * - Chia (XCH) - Not available
 * 
 * IMPORTANT: 3xpl does not provide volume data in its stats endpoint.
 * This collector uses CoinGecko as a fallback to get volume estimates
 * (volume24h × 365) when 3xpl returns zero for transaction values.
 */

interface ThreeXplConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  coingeckoApiKey?: string;
}

interface ThreeXplStatsResponse {
  data?: {
    blockchains?: Record<string, {
      best_block?: number;
      best_block_hash?: string;
      best_block_time?: string;
      events_24h?: Record<string, number>;
      mempool_events?: Record<string, number>;
      progress?: Record<string, number>;
    }>;
  };
}

export class ThreeXplCollector {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private coingeckoCollector: CoinGeckoAPICollector;

  // Mapping of coin symbols to 3xpl blockchain names
  // Only includes coins that are VERIFIED to be supported
  private static readonly BLOCKCHAIN_MAP: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'DASH': 'dash',
    'DGB': 'digibyte',
    'XEC': 'ecash'
  };

  constructor(config: ThreeXplConfig = {}) {
    this.apiKey = config.apiKey || process.env.THREEXPL_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.3xpl.com';
    this.timeout = config.timeout || 30000;
    this.coingeckoCollector = new CoinGeckoAPICollector(
      config.coingeckoApiKey || process.env.COINGECKO_API_KEY || ''
    );
  }

  /**
   * Check if a coin is supported by 3xpl
   */
  isSupported(coinSymbol: string): boolean {
    return coinSymbol in ThreeXplCollector.BLOCKCHAIN_MAP;
  }

  /**
   * Get blockchain name for a coin symbol
   */
  private getBlockchainName(coinSymbol: string): string {
    const blockchain = ThreeXplCollector.BLOCKCHAIN_MAP[coinSymbol];
    if (!blockchain) {
      throw new Error(`Coin ${coinSymbol} not supported by 3xpl`);
    }
    return blockchain;
  }

  /**
   * Make API request to 3xpl
   */
  private async makeRequest<T>(params: Record<string, any> = {}): Promise<T> {
    try {
      const url = this.baseUrl;
      const requestParams: Record<string, string> = {};

      // Add token if available
      if (this.apiKey) {
        requestParams.token = this.apiKey;
      }

      // Add other parameters
      for (const [key, value] of Object.entries(params)) {
        requestParams[key] = String(value);
      }

      const response = await axios.get(url, {
        params: requestParams,
        headers: {
          'Accept': 'application/json'
        },
        timeout: this.timeout
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 'unknown';
        const statusText = error.response?.statusText || error.message;
        throw new Error(`3xpl API error: ${status} ${statusText}`);
      }
      throw error;
    }
  }

  /**
   * Get chain statistics
   */
  async getChainStats(coinSymbol: string): Promise<{
    events_24h: number;
    best_block: number;
    best_block_time: string;
  }> {
    const blockchain = this.getBlockchainName(coinSymbol);
    
    const response = await this.makeRequest<ThreeXplStatsResponse>({
      from: blockchain,
      library: 'blockchains'
    });

    // Parse response
    const blockchainData = response.data?.blockchains?.[blockchain];
    if (!blockchainData) {
      throw new Error(`No data returned for ${blockchain}`);
    }

    // Get main module events (usually blockchain-main)
    const events24h = blockchainData.events_24h || {};
    const mainModule = `${blockchain}-main`;
    const txCount24h = events24h[mainModule] || events24h[Object.keys(events24h)[0]] || 0;

    return {
      events_24h: txCount24h,
      best_block: blockchainData.best_block || 0,
      best_block_time: blockchainData.best_block_time || new Date().toISOString()
    };
  }

  /**
   * Calculate annual transaction metrics from blockchain data
   * Uses CoinGecko as fallback for volume data when 3xpl doesn't provide it
   */
  async calculateAnnualMetrics(coinSymbol: string): Promise<{
    annualTxCount: number;
    annualTxValue: number;
    avgTxValue: number;
    usedFallback: boolean;
    fallbackSource?: string;
  }> {
    const stats = await this.getChainStats(coinSymbol);
    
    // Get 24h transaction count
    const txCount24h = stats.events_24h || 0;

    // Extrapolate to annual (365 days)
    const annualTxCount = Math.round(txCount24h * 365);

    // Note: 3xpl doesn't provide volume data directly in stats endpoint
    // Fetch volume from CoinGecko as fallback
    let annualTxValue = 0;
    let avgTxValue = 0;
    let usedFallback = false;
    let fallbackSource: string | undefined;

    try {
      const geckoMetrics = await this.coingeckoCollector.collectMetrics(coinSymbol);
      
      // Use CoinGecko volume data (volume24h × 365)
      if (geckoMetrics.annualTxValue && geckoMetrics.annualTxValue > 0) {
        annualTxValue = geckoMetrics.annualTxValue;
        avgTxValue = annualTxCount > 0 ? annualTxValue / annualTxCount : 0;
        usedFallback = true;
        fallbackSource = 'CoinGecko (volume24h × 365)';
      }
    } catch (error) {
      // If CoinGecko fallback fails, log warning but continue with zeros
      console.warn(`CoinGecko fallback failed for ${coinSymbol}:`, error instanceof Error ? error.message : String(error));
    }

    return {
      annualTxCount,
      annualTxValue,
      avgTxValue,
      usedFallback,
      fallbackSource
    };
  }

  /**
   * Collect transaction metrics for CFV calculation
   */
  async collectMetrics(coinSymbol: string): Promise<TransactionMetrics> {
    if (!this.isSupported(coinSymbol)) {
      throw new Error(`Coin ${coinSymbol} not supported by 3xpl. Supported coins: ${Object.keys(ThreeXplCollector.BLOCKCHAIN_MAP).join(', ')}`);
    }

    try {
      const blockchain = this.getBlockchainName(coinSymbol);
      const metrics = await this.calculateAnnualMetrics(coinSymbol);

      // Determine confidence level based on data completeness
      let confidence: ConfidenceLevel = 'HIGH';
      const issues: string[] = [];
      const sources: string[] = [`3xpl.com (${blockchain})`];

      // Check if we have real transaction count data
      if (metrics.annualTxCount === 0) {
        confidence = 'LOW';
        issues.push('No transaction data available');
      }

      // Mark confidence as MEDIUM when using fallback for volume
      if (metrics.usedFallback && metrics.fallbackSource) {
        confidence = 'MEDIUM';
        issues.push(`Transaction volume estimated using ${metrics.fallbackSource}`);
        sources.push(metrics.fallbackSource);
      } else if (metrics.annualTxValue === 0) {
        // No fallback available or fallback failed
        confidence = 'LOW';
        issues.push('Transaction volume data not available from 3xpl stats endpoint and fallback failed');
      }

      return {
        annualTxCount: metrics.annualTxCount,
        annualTxValue: metrics.annualTxValue,
        avgTxValue: metrics.avgTxValue,
        confidence,
        sources,
        timestamp: new Date(),
        issues: issues.length > 0 ? issues : undefined,
        metadata: {
          blockchain,
          usedFallback: metrics.usedFallback,
          fallbackSource: metrics.fallbackSource,
          txCount24h: Math.round(metrics.annualTxCount / 365)
        }
      };
    } catch (error) {
      throw new Error(`Failed to collect metrics from 3xpl for ${coinSymbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get supported coins list
   */
  static getSupportedCoins(): string[] {
    return Object.keys(ThreeXplCollector.BLOCKCHAIN_MAP);
  }

  /**
   * Get blockchain name for display
   */
  static getBlockchainName(coinSymbol: string): string | undefined {
    return ThreeXplCollector.BLOCKCHAIN_MAP[coinSymbol];
  }
}
