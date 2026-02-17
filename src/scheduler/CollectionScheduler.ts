import { DatabaseManager } from '../database/DatabaseManager.js';
import { BlockchainDataCollector } from '../collectors/BlockchainDataCollector.js';
import { executeBatchedConcurrent } from '../utils/concurrency.js';
import type { TransactionMetrics } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Collection Scheduler
 * 
 * Automates periodic collection of cryptocurrency metrics.
 */

export interface SchedulerConfig {
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  coingeckoApiKey?: string;
  intervalMinutes: number; // Collection interval in minutes
}

export class CollectionScheduler {
  private db: DatabaseManager;
  private collector: BlockchainDataCollector;
  private config: SchedulerConfig;
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: SchedulerConfig) {
    this.config = config;
    this.db = new DatabaseManager(config.database);
    this.collector = new BlockchainDataCollector({
      coingeckoApiKey: config.coingeckoApiKey
    });

    // Set default concurrency limits if not provided
    if (!this.config.concurrency) {
      this.config.concurrency = {
        '3xpl': 3,           // 3xpl can handle multiple coins in parallel
        'coingecko': 5,      // CoinGecko has higher rate limits
        'custom-dash': 2,    // Custom APIs - moderate concurrency
        'custom-nano': 2,
        'custom-near': 2,
        'custom-icp': 2
      };
    }
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info('Scheduler is already running');
      return;
    }

    // Test database connection
    const dbHealthy = await this.db.testConnection();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }

    logger.info('Starting collection scheduler', { intervalMinutes: this.config.intervalMinutes });
    this.isRunning = true;

    // Run immediately on start
    await this.runCollection();

    // Schedule periodic collections
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(async () => {
      await this.runCollection();
    }, intervalMs);

    logger.info('Scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.info('Scheduler is not running');
      return;
    }

    logger.info('Stopping collection scheduler...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;
    await this.db.close();
    
    logger.info('Scheduler stopped');
  }

  /**
   * Process a single coin collection
   */
  private async collectCoin(coin: any): Promise<{ success: boolean; error?: string; duration: number }> {
    const startTime = Date.now();
    
    try {
      logger.info('Collecting coin metrics', { coin: coin.name, symbol: coin.symbol });
      
      const metrics = await this.collector.getTransactionMetrics(coin.symbol);
      await this.db.saveMetrics(coin.symbol, metrics);
      
      const duration = Date.now() - startTime;
      
      logger.info('Collection successful', {
        symbol: coin.symbol,
        duration,
        annualTxCount: metrics.annualTxCount,
        annualTxValue: metrics.annualTxValue,
        confidence: metrics.confidence
      });
      
      return { success: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to collect coin metrics', { 
        symbol: coin.symbol, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration 
      };
    }
  }

  /**
   * Process coins with concurrency control
   */
  private async processCoinsConcurrently(coins: any[], maxConcurrency: number): Promise<{
    successful: number;
    failed: number;
    lastError?: string;
  }> {
    let successful = 0;
    let failed = 0;
    let lastError: string | undefined;

    // Process coins in batches with concurrency limit
    const results: Promise<void>[] = [];
    const executing = new Set<Promise<void>>();

    for (const coin of coins) {
      const promise = this.collectCoin(coin).then(result => {
        if (result.success) {
          successful++;
        } else {
          failed++;
          lastError = result.error;
        }
      });

      results.push(promise);
      executing.add(promise);

      // Clean up when promise completes
      promise.finally(() => {
        executing.delete(promise);
      });

      // If we've reached max concurrency, wait for one to finish
      if (executing.size >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    // Wait for all remaining promises
    await Promise.all(results);

    return { successful, failed, lastError };
  }

  /**
   * Run a collection cycle
   */
  private async runCollection(): Promise<void> {
    logger.info('Starting collection run', { timestamp: new Date().toISOString() });

    try {
      const coins = await this.db.getActiveCoins();
      const runId = await this.db.startCollectionRun(coins.length);


      // Update collection run
      const status = failed === 0 ? 'completed' : (successful > 0 ? 'completed' : 'failed');
      await this.db.updateCollectionRun(runId, status, successful, failed, lastError);

      logger.info('Collection run completed', {
        successful,
        failed,
        total: coins.length,
        successRate: ((successful / coins.length) * 100).toFixed(1) + '%'
      });
    } catch (error) {
      logger.error('Collection run failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    intervalMinutes: number;
    nextRunIn?: number;
  } {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.config.intervalMinutes,
      nextRunIn: this.isRunning ? this.config.intervalMinutes * 60 * 1000 : undefined
    };
  }
}

export default CollectionScheduler;
