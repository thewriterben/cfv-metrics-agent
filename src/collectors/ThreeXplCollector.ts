import axios from 'axios';
import { TransactionMetrics, DataSource, ConfidenceLevel } from '../types/index.js';

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
 */

interface ThreeXplConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
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
   */
  async calculateAnnualMetrics(coinSymbol: string): Promise<{
    annualTxCount: number;
    annualTxValue: number;
    avgTxValue: number;
  }> {
    const stats = await this.getChainStats(coinSymbol);
    
    // Get 24h transaction count
    const txCount24h = stats.events_24h || 0;

    // Extrapolate to annual (365 days)
    const annualTxCount = Math.round(txCount24h * 365);

    // Note: 3xpl doesn't provide volume data directly in stats endpoint
    // We would need to query individual transactions to calculate volume
    // For now, we'll return 0 for volume and mark it as incomplete
    const annualTxValue = 0;
    const avgTxValue = 0;

    return {
      annualTxCount,
      annualTxValue,
      avgTxValue
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

      // Determine confidence level
      let confidence: ConfidenceLevel = 'MEDIUM';
      const issues: string[] = [];

      // Check if we have real data
      if (metrics.annualTxCount === 0) {
        confidence = 'LOW';
        issues.push('No transaction data available');
      }

      // Note: Volume data not available from stats endpoint
      if (metrics.annualTxValue === 0) {
        issues.push('Transaction volume data not available from 3xpl stats endpoint');
      }

      return {
        annualTxCount: metrics.annualTxCount,
        annualTxValue: metrics.annualTxValue,
        avgTxValue: metrics.avgTxValue,
        confidence,
        sources: [`3xpl.com (${blockchain})`],
        timestamp: new Date(),
        issues: issues.length > 0 ? issues : undefined
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
