import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { DatabaseManager } from '../database/DatabaseManager.js';
import { BlockchainDataCollector } from '../collectors/BlockchainDataCollector.js';
import { RateLimitMonitor } from '../utils/RateLimitMonitor.js';

/**
 * CFV Metrics API Server
 * 
 * REST API for accessing cryptocurrency metrics data.
 */

export interface APIServerConfig {
  port: number;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  coingeckoApiKey?: string;
}

export class APIServer {
  private app: express.Application;
  private db: DatabaseManager;
  private collector: BlockchainDataCollector;
  private config: APIServerConfig;
  private rateLimitMonitor: RateLimitMonitor;

  constructor(config: APIServerConfig) {
    this.config = config;
    this.app = express();
    this.db = new DatabaseManager(config.database);
    this.collector = new BlockchainDataCollector({
      coingeckoApiKey: config.coingeckoApiKey
    });
    this.rateLimitMonitor = new RateLimitMonitor();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });

    // General API rate limiter
    const apiLimiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '900000'), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_API_MAX_REQUESTS || '100'), // 100 requests per window
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: '15 minutes'
        });
      }
    });

    // Apply general rate limiter to all API routes
    this.app.use('/api/', apiLimiter);
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Strict rate limiter for expensive operations
    const strictLimiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_STRICT_WINDOW_MS || '60000'), // 1 minute
      max: parseInt(process.env.RATE_LIMIT_STRICT_MAX_REQUESTS || '10'), // 10 requests per minute
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Rate limit exceeded for this operation.',
        retryAfter: '1 minute'
      },
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for this operation.',
          retryAfter: '1 minute'
        });
      }
    });

    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const dbHealthy = await this.db.testConnection();
        res.json({
          status: dbHealthy ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          database: dbHealthy ? 'connected' : 'disconnected'
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Rate limit status endpoints
    this.app.get('/api/rate-limits/status', async (req, res) => {
      try {
        const statuses = this.rateLimitMonitor.getAllStatus();
        res.json({
          success: true,
          data: statuses
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.app.get('/api/rate-limits/:service', async (req, res) => {
      try {
        const { service } = req.params;
        const validServices = ['coingecko', 'etherscan', 'github'];
        
        if (!validServices.includes(service)) {
          return res.status(400).json({
            success: false,
            error: `Invalid service. Must be one of: ${validServices.join(', ')}`
          });
        }

        const status = this.rateLimitMonitor.getStatus(service as any);
        
        if (!status) {
          return res.status(404).json({
            success: false,
            error: `No rate limit data for service: ${service}`
          });
        }

        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get all coins
    this.app.get('/api/coins', async (req, res, next) => {
      try {
        const coins = await this.db.getActiveCoins();
        res.json({
          success: true,
          data: coins,
          count: coins.length
        });
      } catch (error) {
        next(error);
      }
    });

    // Get all latest metrics
    this.app.get('/api/metrics', async (req, res, next) => {
      try {
        const metrics = await this.db.getAllLatestMetrics();
        res.json({
          success: true,
          data: metrics,
          count: metrics.length
        });
      } catch (error) {
        next(error);
      }
    });

    // Get metrics for specific coin (with strict rate limiting)
    this.app.get('/api/metrics/:symbol', strictLimiter, async (req, res, next) => {
      try {
        const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
        const metrics = await this.db.getLatestMetrics(symbol.toUpperCase());
        
        if (!metrics) {
          return res.status(404).json({
            success: false,
            error: `No metrics found for ${symbol}`
          });
        }

        res.json({
          success: true,
          data: metrics
        });
      } catch (error) {
        next(error);
      }
    });

    // Get metrics history for specific coin
    this.app.get('/api/metrics/:symbol/history', async (req, res, next) => {
      try {
        const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
        const limit = parseInt(req.query.limit as string) || 100;
        
        const history = await this.db.getMetricsHistory(symbol.toUpperCase(), limit);
        
        res.json({
          success: true,
          data: history,
          count: history.length
        });
      } catch (error) {
        next(error);
      }
    });

    // Collect fresh metrics for specific coin (with strict rate limiting)
    this.app.post('/api/collect/:symbol', strictLimiter, async (req, res, next) => {
      try {
        const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
        
        console.log(`Collecting fresh metrics for ${symbol}...`);
        const metrics = await this.collector.getTransactionMetrics(symbol.toUpperCase());
        
        // Save to database
        await this.db.saveMetrics(symbol.toUpperCase(), metrics);
        
        res.json({
          success: true,
          message: `Metrics collected for ${symbol}`,
          data: metrics
        });
      } catch (error) {
        next(error);
      }
    });

    // Collect metrics for all coins (with strict rate limiting)
    this.app.post('/api/collect', strictLimiter, async (req, res, next) => {
      try {
        const coins = await this.db.getActiveCoins();
        const runId = await this.db.startCollectionRun(coins.length);
        
        // Start collection in background
        this.collectAllMetrics(runId, coins).catch(error => {
          console.error('Collection run failed:', error);
        });
        
        res.json({
          success: true,
          message: 'Collection started',
          runId,
          totalCoins: coins.length
        });
      } catch (error) {
        next(error);
      }
    });

    // Get collection run summary
    this.app.get('/api/collection-runs', async (req, res, next) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const runs = await this.db.getCollectionRunSummary(limit);
        
        res.json({
          success: true,
          data: runs,
          count: runs.length
        });
      } catch (error) {
        next(error);
      }
    });

    // Get metrics summary
    this.app.get('/api/summary', async (req, res, next) => {
      try {
        const summary = await this.db.getMetricsSummary();
        res.json({
          success: true,
          data: summary
        });
      } catch (error) {
        next(error);
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('API Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
      });
    });
  }

  /**
   * Collect metrics for all coins (background task)
   */
  private async collectAllMetrics(runId: number, coins: any[]): Promise<void> {
    let successful = 0;
    let failed = 0;
    let errorMessage: string | undefined;

    for (const coin of coins) {
      try {
        console.log(`Collecting metrics for ${coin.symbol}...`);
        const metrics = await this.collector.getTransactionMetrics(coin.symbol);
        await this.db.saveMetrics(coin.symbol, metrics);
        successful++;
        
        // Rate limiting: 5 second delay
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`Failed to collect ${coin.symbol}:`, error);
        failed++;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Update collection run
    const status = failed === 0 ? 'completed' : (successful > 0 ? 'completed' : 'failed');
    await this.db.updateCollectionRun(runId, status, successful, failed, errorMessage);
  }

  /**
   * Start the API server
   */
  async start(): Promise<void> {
    // Test database connection
    const dbHealthy = await this.db.testConnection();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }

    // Start server
    this.app.listen(this.config.port, () => {
      console.log(`CFV Metrics API Server running on port ${this.config.port}`);
      console.log(`Health check: http://localhost:${this.config.port}/health`);
      console.log(`API docs: http://localhost:${this.config.port}/api/metrics`);
    });
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    await this.db.close();
  }
}

export default APIServer;
