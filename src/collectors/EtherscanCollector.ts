import axios, { AxiosInstance } from 'axios';
import type {
  MetricCollector,
  MetricType,
  MetricResult,
  CollectorHealth,
  CollectorPriority,
  EtherscanTransaction,
} from '../types';
import { RateLimiter } from '../utils/RateLimiter.js';
import { CircuitBreaker } from '../utils/CircuitBreaker.js';
import { RequestCoalescer } from '../utils/RequestCoalescer.js';
import { RateLimitMonitor } from '../utils/RateLimitMonitor.js';
import { CoinGeckoAPICollector } from './CoinGeckoAPICollector.js';

export class EtherscanCollector implements MetricCollector {
  name = 'Etherscan';
  priority: CollectorPriority = 'primary';
  
  private client: AxiosInstance;
  private apiKey?: string;
  private baseURL = 'https://api.etherscan.io/api';
  private lastHealthCheck: Date = new Date();
  private errorCount = 0;
  private requestCount = 0;
  
  // Rate limiting and protection
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private coalescer: RequestCoalescer<any>;
  private monitor: RateLimitMonitor;
  private coingeckoCollector: CoinGeckoAPICollector;
  
  // Ethereum blockchain constants
  private static readonly BLOCKS_PER_DAY = 7200; // ~12 second block time
  private static readonly DAYS_PER_YEAR = 365;
  private static readonly AVG_TXS_PER_BLOCK = 175; // Ethereum average transactions per block
  
  constructor(apiKey?: string, rateLimiter?: RateLimiter, monitor?: RateLimitMonitor, coingeckoApiKey?: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
    });
    
    // Initialize rate limiting and protection components
    const coalescerTTL = parseInt(process.env.REQUEST_COALESCER_TTL || '5000');
    this.rateLimiter = rateLimiter || new RateLimiter();
    this.circuitBreaker = new CircuitBreaker();
    this.coalescer = new RequestCoalescer(coalescerTTL);
    this.monitor = monitor || new RateLimitMonitor();
    this.coingeckoCollector = new CoinGeckoAPICollector(
      coingeckoApiKey || process.env.COINGECKO_API_KEY || ''
    );
  }
  
  async collect(coin: string, metric: MetricType): Promise<MetricResult> {
    // Only works for Ethereum-based tokens
    if (coin.toUpperCase() !== 'ETH') {
      throw new Error(`Etherscan only supports Ethereum, not ${coin}`);
    }
    
    const key = `etherscan:${coin}:${metric}`;
    
    return this.coalescer.coalesce(key, async () => {
      return this.circuitBreaker.execute(async () => {
        return this.rateLimiter.schedule('etherscan', async () => {
          try {
            this.requestCount++;
            this.monitor.incrementUsage('etherscan');
            
            switch (metric) {
              case 'annualTransactionValue':
                return await this.collectAnnualTransactionValue();
              
              case 'annualTransactions':
                return await this.collectAnnualTransactions();
              
              default:
                throw new Error(`Metric ${metric} not supported by Etherscan collector`);
            }
          } catch (error) {
            this.errorCount++;
            throw error;
          }
        });
      });
    });
  }
  
  async supports(coin: string): Promise<boolean> {
    // Only supports Ethereum
    return coin.toUpperCase() === 'ETH';
  }
  
  async getHealth(): Promise<CollectorHealth> {
    const now = new Date();
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (errorRate > 0.5) status = 'down';
    else if (errorRate > 0.2) status = 'degraded';
    
    return {
      status,
      lastCheck: now,
      errorRate,
      responseTime: 0,
    };
  }
  
  /**
   * Collect annual transaction value for Ethereum
   * 
   * Data Sources:
   * - Primary: CoinGecko volume data (volume24h × 365)
   * - Fallback: If CoinGecko fails, returns zero with LOW confidence
   * 
   * Methodology:
   * Uses CoinGecko's 24-hour trading volume and extrapolates to annual.
   * This is a reliable proxy for transaction value as it represents actual
   * economic activity on the Ethereum network.
   * 
   * @returns MetricResult with annual transaction value in USD
   */
  private async collectAnnualTransactionValue(): Promise<MetricResult> {
    try {
      // Get current block number for metadata
      const blockResponse = await this.client.get('', {
        params: {
          module: 'proxy',
          action: 'eth_blockNumber',
          apikey: this.apiKey,
        },
      });
      
      const currentBlock = parseInt(blockResponse.data.result, 16);
      const blocksPerYear = EtherscanCollector.BLOCKS_PER_DAY * EtherscanCollector.DAYS_PER_YEAR;
      const startBlock = currentBlock - blocksPerYear;
      
      // Use CoinGecko as primary data source for volume
      // This is consistent with ThreeXplCollector pattern
      let annualTxValue = 0;
      let usedFallback = false;
      let fallbackSource: string | undefined;
      
      try {
        const geckoMetrics = await this.coingeckoCollector.collectMetrics('ETH');
        
        // Use CoinGecko volume data (volume24h × 365)
        if (geckoMetrics.annualTxValue && geckoMetrics.annualTxValue > 0) {
          annualTxValue = geckoMetrics.annualTxValue;
          usedFallback = true;
          fallbackSource = 'CoinGecko (volume24h × 365)';
        }
      } catch (error) {
        // If CoinGecko fallback fails, log warning but continue with zero
        console.warn('CoinGecko fallback failed for ETH:', error instanceof Error ? error.message : String(error));
      }
      
      // Determine confidence level
      const confidence = annualTxValue > 0 ? 'MEDIUM' : 'LOW';
      const issues: string[] = [];
      const sources: string[] = ['Etherscan'];
      
      if (usedFallback && fallbackSource) {
        issues.push(`Transaction volume estimated using ${fallbackSource}`);
        sources.push(fallbackSource);
      } else if (annualTxValue === 0) {
        issues.push('Transaction volume data not available - CoinGecko fallback failed');
      }
      
      return {
        value: annualTxValue,
        confidence,
        source: sources.join(', '),
        timestamp: new Date(),
        metadata: {
          methodology: 'CoinGecko volume24h × 365 for annual transaction value',
          currentBlock,
          startBlock,
          blocksPerYear,
          usedFallback,
          fallbackSource,
          issues: issues.length > 0 ? issues : undefined,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to collect annual transaction value for ETH: ${errorMessage}`);
    }
  }
  
  /**
   * Collect annual transaction count for Ethereum
   * 
   * Methodology:
   * Estimates annual transactions using blockchain constants:
   * - Ethereum produces ~7,200 blocks per day (~12 second block time)
   * - Each block contains ~175 transactions on average
   * - Annual estimate: 7,200 blocks/day × 365 days × 175 txs/block
   * 
   * This is a conservative estimation approach that provides a reasonable
   * approximation without requiring historical blockchain scanning.
   * 
   * Confidence: MEDIUM
   * - Based on well-established blockchain constants
   * - Average transactions per block is an estimate that varies with network activity
   * - For exact counts, would require scanning all historical blocks
   * 
   * @returns MetricResult with annual transaction count
   */
  private async collectAnnualTransactions(): Promise<MetricResult> {
    try {
      // Get current block number for metadata
      const blockResponse = await this.client.get('', {
        params: {
          module: 'proxy',
          action: 'eth_blockNumber',
          apikey: this.apiKey,
        },
      });
      
      const currentBlock = parseInt(blockResponse.data.result, 16);
      
      // Calculate annual transactions using blockchain constants
      const blocksPerDay = EtherscanCollector.BLOCKS_PER_DAY;
      const blocksPerYear = blocksPerDay * EtherscanCollector.DAYS_PER_YEAR;
      const avgTxsPerBlock = EtherscanCollector.AVG_TXS_PER_BLOCK;
      
      // Annual transaction estimate
      const estimatedAnnualTransactions = Math.round(blocksPerYear * avgTxsPerBlock);
      
      return {
        value: estimatedAnnualTransactions,
        confidence: 'MEDIUM',
        source: 'Etherscan, Blockchain Constants',
        timestamp: new Date(),
        metadata: {
          methodology: `Estimated using blockchain constants: ${blocksPerDay} blocks/day × ${EtherscanCollector.DAYS_PER_YEAR} days × ${avgTxsPerBlock} txs/block`,
          currentBlock,
          blocksPerDay,
          blocksPerYear,
          avgTxsPerBlock,
          estimationNote: 'Average transactions per block (~175) varies with network activity. For exact counts, historical blockchain scanning would be required.',
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to collect annual transactions for ETH: ${errorMessage}`);
    }
  }
  
  /**
   * Get transactions for a specific address
   * Useful for token contracts
   */
  private async getAddressTransactions(
    address: string,
    startBlock: number,
    endBlock: number
  ): Promise<EtherscanTransaction[]> {
    const response = await this.client.get('', {
      params: {
        module: 'account',
        action: 'txlist',
        address,
        startblock: startBlock,
        endblock: endBlock,
        sort: 'asc',
        apikey: this.apiKey,
      },
    });
    
    if (response.data.status !== '1') {
      throw new Error(`Etherscan API error: ${response.data.message}`);
    }
    
    return response.data.result;
  }
}
