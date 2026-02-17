import { TransactionMetrics, ConfidenceLevel } from '../types/index.js';
import { CoinGeckoAPICollector } from './CoinGeckoAPICollector.js';
import { ThreeXplCollector } from './ThreeXplCollector.js';
import { DashApiClient } from './DashApiClient.js';
import { NanoCollector } from './NanoCollector.js';
import { NEARCollector } from './NEARCollector.js';
import { ICPCollector } from './ICPCollector.js';

/**
 * Unified Blockchain Data Collector
 * 
 * Routes requests to appropriate data source:
 * - 3xpl for 8 DGF coins (BTC, ETH, DASH, DGB, XMR, RVN, XCH, XEC)
 * - Custom collectors for remaining coins (XNO, NEAR, ICP, EGLD, DGD)
 * - CoinGecko MCP as fallback for market data
 * 
 * Implements fallback chain and caching for reliability
 */

interface CollectorConfig {
  coingeckoApiKey?: string;
  threexplApiKey?: string;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

export class BlockchainDataCollector {
  private static readonly MAX_CACHE_SIZE = 100;
  
  private coingeckoCollector: CoinGeckoAPICollector;
  private threexplCollector: ThreeXplCollector;
  private dashClient: DashApiClient;
  private nanoCollector: NanoCollector;
  private nearCollector: NEARCollector;
  private icpCollector: ICPCollector;
  private cacheEnabled: boolean;
  private cacheTTL: number;
  private cache: Map<string, { data: TransactionMetrics; expiry: number }>;

  constructor(config: CollectorConfig = {}) {
    this.coingeckoCollector = new CoinGeckoAPICollector(config.coingeckoApiKey || '');
    
    this.threexplCollector = new ThreeXplCollector({
      apiKey: config.threexplApiKey,
      coingeckoApiKey: config.coingeckoApiKey
    });
    
    this.dashClient = new DashApiClient();
    this.nanoCollector = new NanoCollector();
    this.nearCollector = new NEARCollector();
    this.icpCollector = new ICPCollector({ coingeckoApiKey: config.coingeckoApiKey });
    
    this.cacheEnabled = config.cacheEnabled !== false;
    this.cacheTTL = config.cacheTTL || 3600000; // 1 hour default
    this.cache = new Map();
  }

  /**
   * Get transaction metrics for a coin
   * Routes to appropriate collector based on coin support
   */
  async getTransactionMetrics(coinSymbol: string): Promise<TransactionMetrics> {
    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.getFromCache(coinSymbol);
      if (cached) {
        return cached;
      }
    }

    let metrics: TransactionMetrics;

    try {
      // Route to appropriate collector
      if (coinSymbol === 'DASH') {
        // Use custom Dash collector
        metrics = await this.getDashMetrics();
      } else if (coinSymbol === 'XNO' || coinSymbol === 'NANO') {
        // Use custom Nano collector
        metrics = await this.nanoCollector.getTransactionMetrics();
      } else if (coinSymbol === 'NEAR') {
        // Use custom NEAR collector
        metrics = await this.nearCollector.getTransactionMetrics();
      } else if (coinSymbol === 'ICP') {
        // Use custom ICP collector
        metrics = await this.icpCollector.getTransactionMetrics();
      } else if (this.threexplCollector.isSupported(coinSymbol) && process.env.THREEXPL_API_KEY) {
        // Try 3xpl if API key is available
        try {
          metrics = await this.threexplCollector.collectMetrics(coinSymbol);
        } catch (error) {
          console.warn(`3xpl failed for ${coinSymbol}, falling back to CoinGecko:`, error);
          const simpleMetrics = await this.coingeckoCollector.collectMetrics(coinSymbol);
          metrics = this.convertToTransactionMetrics(simpleMetrics);
        }
      } else {
        // Fallback to CoinGecko (estimated data)
        const simpleMetrics = await this.coingeckoCollector.collectMetrics(coinSymbol);
        metrics = this.convertToTransactionMetrics(simpleMetrics);
      }

      // Cache the result
      if (this.cacheEnabled) {
        this.setInCache(coinSymbol, metrics);
      }

      return metrics;
    } catch (error) {
      // If primary source fails, try fallback
      console.warn(`Primary source failed for ${coinSymbol}, trying fallback:`, error);
      
      try {
        const simpleMetrics = await this.coingeckoCollector.collectMetrics(coinSymbol);
        metrics = this.convertToTransactionMetrics(simpleMetrics);
        
        // Mark as fallback data
        metrics.confidence = 'MEDIUM';
        metrics.issues = metrics.issues || [];
        metrics.issues.push('Using fallback data source (CoinGecko)');
        
        return metrics;
      } catch (fallbackError) {
        throw new Error(`Failed to collect metrics for ${coinSymbol}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Convert SimpleCFVMetrics to TransactionMetrics
   */
  private convertToTransactionMetrics(simple: any): TransactionMetrics {
    const annualTxCount = simple.annualTxCount || 0;
    const annualTxValue = simple.annualTxValue || 0;
    const avgTxValue = annualTxCount > 0 ? annualTxValue / annualTxCount : 0;
    
    return {
      annualTxCount,
      annualTxValue,
      avgTxValue,
      confidence: 'MEDIUM',
      sources: ['CoinGecko REST API'],
      timestamp: new Date(),
      issues: ['Transaction data estimated from market volume']
    };
  }

  /**
   * Get Dash metrics from custom collector
   */
  private async getDashMetrics(): Promise<TransactionMetrics> {
    const annualMetrics = await this.dashClient.getAnnualTransactionMetrics();
    
    return {
      annualTxCount: annualMetrics.annualTxCount,
      annualTxValue: annualMetrics.annualTxValue,
      avgTxValue: annualMetrics.avgTxValue,
      confidence: annualMetrics.confidence as ConfidenceLevel,
      sources: annualMetrics.sources,
      timestamp: new Date(),
      issues: annualMetrics.issues
    };
  }

  /**
   * Get from cache
   */
  private getFromCache(coinSymbol: string): TransactionMetrics | null {
    const cached = this.cache.get(coinSymbol);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiry) {
      this.cache.delete(coinSymbol);
      return null;
    }

    return cached.data;
  }

  /**
   * Set in cache
   */
  private setInCache(coinSymbol: string, data: TransactionMetrics): void {
    // Clean expired entries when cache is getting full
    if (this.cache.size > BlockchainDataCollector.MAX_CACHE_SIZE / 2) {
      this.cleanExpiredEntries();
    }
    
    // Evict oldest entry if cache is still full after cleanup
    if (this.cache.size >= BlockchainDataCollector.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(coinSymbol, {
      data,
      expiry: Date.now() + this.cacheTTL
    });
  }

  /**
   * Clean expired entries from cache
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((value, key) => {
      if (now > value.expiry) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number; enabled: boolean } {
    return {
      size: this.cache.size,
      maxSize: BlockchainDataCollector.MAX_CACHE_SIZE,
      ttl: this.cacheTTL,
      enabled: this.cacheEnabled
    };
  }

  /**
   * Get list of supported coins by source
   */
  getSupportedCoins(): {
    threexpl: string[];
    custom: string[];
    fallback: string[];
  } {
    return {
      threexpl: ThreeXplCollector.getSupportedCoins(),
      custom: ['DASH'], // Will add XNO, NEAR, ICP, EGLD, DGD in Phase 2
      fallback: ['All coins via CoinGecko (estimated)']
    };
  }

  /**
   * Check if a coin has HIGH confidence data available
   */
  hasHighConfidenceData(coinSymbol: string): boolean {
    return this.threexplCollector.isSupported(coinSymbol) || coinSymbol === 'DASH';
  }

  /**
   * Determine the data source for a coin
   * Used for grouping coins by source for concurrent collection
   */
  getDataSource(coinSymbol: string): string {
    if (coinSymbol === 'DASH') {
      return 'custom-dash';
    } else if (coinSymbol === 'XNO' || coinSymbol === 'NANO') {
      return 'custom-nano';
    } else if (coinSymbol === 'NEAR') {
      return 'custom-near';
    } else if (coinSymbol === 'ICP') {
      return 'custom-icp';
    } else if (this.threexplCollector.isSupported(coinSymbol) && process.env.THREEXPL_API_KEY) {
      return '3xpl';
    } else {
      return 'coingecko';
    }
  }
}

export default BlockchainDataCollector;
