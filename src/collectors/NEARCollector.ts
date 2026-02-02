import axios, { AxiosInstance } from 'axios';
import { TransactionMetrics } from '../types/index.js';

/**
 * NEAR Protocol Collector
 * 
 * Collects blockchain data for NEAR Protocol using NearBlocks API.
 * Provides MEDIUM-HIGH confidence metrics.
 */

export interface NEARCollectorConfig {
  endpoint?: string;
  timeout?: number;
}

interface NearBlocksStatsResponse {
  stats: Array<{
    total_txns: string;
    near_price: string;
    volume: string;
    circulating_supply: string;
    tps: number;
  }>;
}

export class NEARCollector {
  private client: AxiosInstance;
  private endpoint: string;

  constructor(config: NEARCollectorConfig = {}) {
    this.endpoint = config.endpoint || 'https://api.nearblocks.io/v1';
    
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get transaction metrics for NEAR Protocol
   */
  async getTransactionMetrics(): Promise<TransactionMetrics> {
    try {
      // Get network statistics from NearBlocks
      const response = await this.client.get<NearBlocksStatsResponse>('/stats');
      
      if (!response.data.stats || response.data.stats.length === 0) {
        throw new Error('No stats data returned from NearBlocks API');
      }

      const stats = response.data.stats[0];

      // Parse data
      const totalTxns = parseInt(stats.total_txns);
      const currentPrice = parseFloat(stats.near_price);
      const volume24h = parseFloat(stats.volume);
      const tps = stats.tps;

      // Calculate annual metrics
      // NEAR has been live since ~April 2020, approximately 5.75 years = 2099 days
      const daysLive = 2099;
      const txnsPerDay = totalTxns / daysLive;
      const annualTxCount = Math.round(txnsPerDay * 365);

      // Estimate annual transaction value
      // Method 1: Use 24h volume * 365
      const annualTxValue = volume24h * 365;

      // Average transaction value
      const avgTxValue = annualTxCount > 0 ? annualTxValue / annualTxCount : 0;

      return {
        annualTxCount,
        annualTxValue,
        avgTxValue,
        confidence: 'MEDIUM',
        sources: ['NearBlocks API', 'Indexed Blockchain Data'],
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get NEAR metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get network statistics
   */
  async getNetworkStats(): Promise<{
    totalTxns: number;
    currentPrice: number;
    volume24h: number;
    tps: number;
  }> {
    const response = await this.client.get<NearBlocksStatsResponse>('/stats');
    const stats = response.data.stats[0];

    return {
      totalTxns: parseInt(stats.total_txns),
      currentPrice: parseFloat(stats.near_price),
      volume24h: parseFloat(stats.volume),
      tps: stats.tps
    };
  }
}

export default NEARCollector;
