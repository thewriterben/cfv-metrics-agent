import axios, { AxiosInstance } from 'axios';
import { TransactionMetrics } from '../types/index.js';
import { getNetworkDaysLive } from '../utils/networkLifetime.js';

/**
 * Nano Collector
 * 
 * Collects HIGH confidence blockchain data for Nano (XNO) using the
 * SomeNano public RPC node.
 */

export interface NanoCollectorConfig {
  endpoint?: string;
  timeout?: number;
}

interface BlockCountResponse {
  count: string;
  unchecked: string;
  cemented: string;
}

interface AvailableSupplyResponse {
  available: string;
}

interface PriceResponse {
  id: string;
  name: string;
  symbol: string;
  quotes: {
    USD: {
      price: number;
      volume_24h: number;
      market_cap: number;
    };
  };
}

export class NanoCollector {
  private client: AxiosInstance;
  private endpoint: string;
  
  // Nano (formerly RaiBlocks) genesis date
  private static readonly GENESIS_DATE = '2015-10-01';
  
  // Transaction estimation constants
  private static readonly DAYS_PER_YEAR = 365; // Days in a year for annualization
  private static readonly SUPPLY_VELOCITY = 0.05; // 5% annual velocity (conservative estimate)

  constructor(config: NanoCollectorConfig = {}) {
    this.endpoint = config.endpoint || 'https://node.somenano.com/proxy';
    
    this.client = axios.create({
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Make RPC call to Nano node
   */
  private async call<T>(action: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await this.client.post(this.endpoint, {
        action,
        ...params
      });

      return response.data as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Nano RPC error: ${error.response?.status} ${error.response?.statusText || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Convert raw amount to Nano
   */
  private rawToNano(raw: string): number {
    // 1 Nano = 10^30 raw
    const rawBigInt = BigInt(raw);
    const nanoDivisor = BigInt('1000000000000000000000000000000');
    return Number(rawBigInt / nanoDivisor);
  }

  /**
   * Calculate days since Nano genesis
   * Nano (formerly RaiBlocks) launched October 2015
   */
  private calculateDaysLive(): number {
    const genesisDate = new Date(NanoCollector.GENESIS_DATE);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - genesisDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get transaction metrics for Nano
   */
  async getTransactionMetrics(): Promise<TransactionMetrics> {
    try {
      // Get blockchain data
      const [blockCount, supply, price] = await Promise.all([
        this.call<BlockCountResponse>('block_count'),
        this.call<AvailableSupplyResponse>('available_supply'),
        this.call<PriceResponse>('price').catch(() => null)
      ]);

      // Parse data
      const totalBlocks = parseInt(blockCount.count);
      const circulatingSupply = this.rawToNano(supply.available);
      const currentPrice = price?.quotes.USD.price || 0;


      const blocksPerDay = totalBlocks / daysLive;

      // Annual transaction count (blocks per day * 365)
      const annualTxCount = Math.round(blocksPerDay * NanoCollector.DAYS_PER_YEAR);

      // Estimate transaction value
      // HEURISTIC: Assume 5% velocity (5% of supply moves annually)
      // This is a conservative estimate based on typical cryptocurrency velocity
      // Confidence: MEDIUM due to velocity estimation
      const annualSupplyMovement = circulatingSupply * NanoCollector.SUPPLY_VELOCITY;
      const annualTxValue = annualSupplyMovement * currentPrice;

      // Average transaction value
      const avgTxValue = annualTxCount > 0 ? annualTxValue / annualTxCount : 0;

      const issues: string[] = [];
      issues.push(`Transaction value estimated using ${NanoCollector.SUPPLY_VELOCITY * 100}% velocity heuristic (conservative estimate)`);

      return {
        annualTxCount,
        annualTxValue,
        avgTxValue,
        confidence: 'MEDIUM',
        sources: ['Nano RPC (SomeNano)', 'Blockchain Data', 'Velocity Heuristic (5%)'],
        timestamp: new Date(),
        issues,
        metadata: {
          daysLive,
          genesisDate: NanoCollector.GENESIS_DATE,
          supplyVelocity: NanoCollector.SUPPLY_VELOCITY,
          velocityNote: 'Estimated using conservative 5% annual velocity'
        }
      };
    } catch (error) {
      throw new Error(`Failed to get Nano metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default NanoCollector;
