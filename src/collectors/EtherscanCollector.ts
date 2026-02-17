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
  
  constructor(apiKey?: string, rateLimiter?: RateLimiter, monitor?: RateLimitMonitor) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
    });
    
    // Initialize rate limiting and protection components
    this.rateLimiter = rateLimiter || new RateLimiter();
    this.circuitBreaker = new CircuitBreaker();
    this.coalescer = new RequestCoalescer(5000); // 5 second cache
    this.monitor = monitor || new RateLimitMonitor();
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
  
  private async collectAnnualTransactionValue(): Promise<MetricResult> {
    // Get Ethereum stats for the past year
    // Note: This is a simplified implementation
    // In production, you'd need to query historical blocks and sum transaction values
    
    // Get current block number
    const blockResponse = await this.client.get('', {
      params: {
        module: 'proxy',
        action: 'eth_blockNumber',
        apikey: this.apiKey,
      },
    });
    
    const currentBlock = parseInt(blockResponse.data.result, 16);
    
    // Ethereum: ~7200 blocks per day, ~2.6M blocks per year
    const blocksPerYear = 7200 * 365;
    const startBlock = currentBlock - blocksPerYear;
    
    // Get transaction count (simplified - actual implementation would need to sum all tx values)
    // For now, we'll estimate based on average daily volume
    // This is a placeholder - real implementation needs historical data
    
    const estimatedAnnualValue = 0; // Placeholder
    
    return {
      value: estimatedAnnualValue,
      confidence: 'LOW',
      source: 'Etherscan',
      timestamp: new Date(),
      metadata: {
        note: 'Requires full historical scan - placeholder implementation',
        currentBlock,
        startBlock,
      },
    };
  }
  
  private async collectAnnualTransactions(): Promise<MetricResult> {
    // Similar to above - simplified implementation
    // Real implementation would scan blocks and count transactions
    
    const estimatedAnnualTransactions = 0; // Placeholder
    
    return {
      value: estimatedAnnualTransactions,
      confidence: 'LOW',
      source: 'Etherscan',
      timestamp: new Date(),
      metadata: {
        note: 'Requires full historical scan - placeholder implementation',
      },
    };
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
