/**
 * Unified Data Collector Types
 * 
 * This file defines the unified interface for all data collectors in the system.
 * All collectors should implement IDataCollector to ensure consistent behavior.
 */

import type { 
  MetricType, 
  MetricResult, 
  CollectorHealth, 
  CollectorPriority,
  TransactionMetrics,
  ConfidenceLevel 
} from './index.js';

/**
 * Unified data collector interface
 * All collectors (blockchain, API, MCP) should implement this interface
 */
export interface IDataCollector {
  /**
   * Unique identifier for the collector
   */
  readonly name: string;
  
  /**
   * Priority level for fallback chain
   */
  readonly priority: CollectorPriority;
  
  /**
   * Collect specific metric for a coin
   * @param coin - Coin symbol (e.g., 'BTC', 'ETH')
   * @param metric - Type of metric to collect
   * @returns Promise with metric result
   */
  collect(coin: string, metric: MetricType): Promise<MetricResult>;
  
  /**
   * Check if collector supports the given coin
   * @param coin - Coin symbol to check
   * @returns Promise<boolean> indicating support
   */
  supports(coin: string): Promise<boolean>;
  
  /**
   * Get health status of the collector
   * @returns Promise with health status
   */
  getHealth(): Promise<CollectorHealth>;
}

/**
 * Extended interface for blockchain-specific collectors
 * Adds transaction metrics collection capability
 */
export interface IBlockchainCollector extends IDataCollector {
  /**
   * Get transaction metrics for a coin
   * @param coinSymbol - Coin symbol
   * @returns Promise with transaction metrics
   */
  getTransactionMetrics(coinSymbol: string): Promise<TransactionMetrics>;
}

/**
 * Collector metadata for registry
 */
export interface CollectorMetadata {
  name: string;
  type: 'blockchain' | 'api' | 'mcp';
  priority: CollectorPriority;
  supportedCoins?: string[];
  supportedMetrics?: MetricType[];
  description?: string;
}

/**
 * Collector registration entry
 */
export interface CollectorRegistration {
  collector: IDataCollector;
  metadata: CollectorMetadata;
}
