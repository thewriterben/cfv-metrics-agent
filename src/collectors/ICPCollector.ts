import { TransactionMetrics } from '../types/index.js';
import { CoinGeckoAPICollector } from './CoinGeckoAPICollector.js';

/**
 * Internet Computer (ICP) Collector
 * 
 * Collects blockchain data for ICP using CoinGecko API.
 * Provides MEDIUM confidence metrics (estimated from volume data).
 * 
 * Note: ICP Dashboard API endpoints are currently unavailable,
 * so we use CoinGecko as the primary source for now.
 */

export interface ICPCollectorConfig {
  coingeckoApiKey?: string;
}

export class ICPCollector {
  private coingeckoCollector: CoinGeckoAPICollector;

  constructor(config: ICPCollectorConfig = {}) {
    this.coingeckoCollector = new CoinGeckoAPICollector(
      config.coingeckoApiKey || process.env.COINGECKO_API_KEY || ''
    );
  }

  /**
   * Get transaction metrics for ICP
   */
  async getTransactionMetrics(): Promise<TransactionMetrics> {
    try {
      // Use CoinGecko to get ICP metrics
      const metrics = await this.coingeckoCollector.collectMetrics('ICP');

      // Convert to TransactionMetrics format
      const annualTxCount = metrics.annualTxCount || 0;
      const annualTxValue = metrics.annualTxValue || 0;
      const avgTxValue = annualTxCount > 0 ? annualTxValue / annualTxCount : 0;

      return {
        annualTxCount,
        annualTxValue,
        avgTxValue,
        confidence: 'MEDIUM',
        sources: ['CoinGecko API', 'Market Volume Data'],
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get ICP metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default ICPCollector;
