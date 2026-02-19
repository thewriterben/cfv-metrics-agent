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
  
  // NEAR mainnet genesis date
  private static readonly GENESIS_DATE = '2020-04-22';
  
  // Transaction estimation constants
  private static readonly DAYS_PER_YEAR = 365; // Days in a year for annualization

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
   * Calculate days since NEAR genesis
   * NEAR mainnet launched April 22, 2020
   */
  private calculateDaysLive(): number {
    const genesisDate = new Date(NEARCollector.GENESIS_DATE);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - genesisDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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

      // Calculate days since NEAR genesis
      const daysLive = this.calculateDaysLive();
      const txnsPerDay = totalTxns / daysLive;
      const annualTxCount = Math.round(txnsPerDay * NEARCollector.DAYS_PER_YEAR);

      // Estimate annual transaction value
      // HEURISTIC: Use 24h volume × 365
      // This assumes current 24h volume is representative of average daily volume
      // Confidence: MEDIUM due to volatility in daily volume
      const annualTxValue = volume24h * NEARCollector.DAYS_PER_YEAR;

      // Average transaction value
      const avgTxValue = annualTxCount > 0 ? annualTxValue / annualTxCount : 0;

      const issues: string[] = [];
      issues.push('Transaction value estimated using 24h volume extrapolation (volume24h × 365)');

      return {
        annualTxCount,
        annualTxValue,
        avgTxValue,
        confidence: 'MEDIUM',
        sources: ['NearBlocks API', 'Indexed Blockchain Data', 'Volume Extrapolation'],
        timestamp: new Date(),
        issues,
        metadata: {
          daysLive,
          genesisDate: NEARCollector.GENESIS_DATE,
          volumeNote: 'Estimated by extrapolating 24h volume to annual'
        }
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
