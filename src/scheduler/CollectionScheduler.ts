import { DatabaseManager } from '../database/DatabaseManager.js';
import { BlockchainDataCollector } from '../collectors/BlockchainDataCollector.js';

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
  delayBetweenCoins: number; // Delay between coin collections in ms
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
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    // Test database connection
    const dbHealthy = await this.db.testConnection();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }

    console.log(`Starting collection scheduler (interval: ${this.config.intervalMinutes} minutes)`);
    this.isRunning = true;

    // Run immediately on start
    await this.runCollection();

    // Schedule periodic collections
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(async () => {
      await this.runCollection();
    }, intervalMs);

    console.log('Scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    console.log('Stopping collection scheduler...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;
    await this.db.close();
    
    console.log('Scheduler stopped');
  }

  /**
   * Run a collection cycle
   */
  private async runCollection(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log(`Starting collection run at ${new Date().toISOString()}`);
    console.log('='.repeat(80));

    try {
      const coins = await this.db.getActiveCoins();
      const runId = await this.db.startCollectionRun(coins.length);

      let successful = 0;
      let failed = 0;
      let lastError: string | undefined;

      for (const coin of coins) {
        try {
          console.log(`\n📊 Collecting ${coin.name} (${coin.symbol})...`);
          
          const startTime = Date.now();
          const metrics = await this.collector.getTransactionMetrics(coin.symbol);
          const duration = Date.now() - startTime;

          await this.db.saveMetrics(coin.symbol, metrics);
          
          console.log(`✅ Success in ${duration}ms`);
          console.log(`   Annual TX Count: ${metrics.annualTxCount.toLocaleString()}`);
          console.log(`   Annual TX Value: $${metrics.annualTxValue.toLocaleString()}`);
          console.log(`   Confidence: ${metrics.confidence}`);
          
          successful++;

          // Rate limiting delay
          if (coins.indexOf(coin) < coins.length - 1) {
            console.log(`   ⏳ Waiting ${this.config.delayBetweenCoins / 1000}s for rate limiting...`);
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenCoins));
          }
        } catch (error) {
          console.error(`❌ Failed to collect ${coin.symbol}:`, error);
          failed++;
          lastError = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      // Update collection run
      const status = failed === 0 ? 'completed' : (successful > 0 ? 'completed' : 'failed');
      await this.db.updateCollectionRun(runId, status, successful, failed, lastError);

      console.log('\n' + '='.repeat(80));
      console.log('Collection run completed');
      console.log(`✅ Successful: ${successful}/${coins.length}`);
      console.log(`❌ Failed: ${failed}/${coins.length}`);
      console.log(`Success Rate: ${((successful / coins.length) * 100).toFixed(1)}%`);
      console.log('='.repeat(80) + '\n');
    } catch (error) {
      console.error('Collection run failed:', error);
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
