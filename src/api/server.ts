import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { DatabaseManager } from '../database/DatabaseManager.js';
import { BlockchainDataCollector } from '../collectors/BlockchainDataCollector.js';

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


  constructor(config: APIServerConfig) {
    this.config = config;
    this.app = express();
    this.db = new DatabaseManager(config.database);
    this.collector = new BlockchainDataCollector({
      coingeckoApiKey: config.coingeckoApiKey
    });


    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   * 
   * Middleware order is important:
   * 1. CORS - must be first to handle preflight OPTIONS requests
   * 2. Sentry - captures all requests and errors after CORS
   * 3. Body parsers - parse request bodies
   * 4. Request logging - log after body parsing
   * 5. Performance monitoring - track timing after logging setup
   * 6. Metrics tracking - count requests and connections
   */
  private setupMiddleware(): void {
    // CORS (must be first to handle preflight requests)
    this.app.use(cors());
    
    // Sentry request handler
    this.app.use(sentryRequestHandler());
    
    // Sentry tracing handler
    this.app.use(sentryTracingHandler());
    
    // JSON body parser
    this.app.use(express.json());
    
    // Request logging with context
    this.app.use(requestLogger);
    
    // Performance monitoring
    this.app.use(performanceMonitor.middleware());
    
    // Track requests in metrics
    this.app.use((req, res, next) => {
      metricsCollector.incrementCounter('http_requests_total');
      metricsCollector.incrementGauge('active_connections');
      
      res.on('finish', () => {
        metricsCollector.decrementGauge('active_connections');
        metricsCollector.incrementCounter(`http_requests_${res.statusCode}`);
      });
      
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



    // Get all coins
    this.app.get('/api/coins', async (req, res, next) => {
      try {
        metricsCollector.incrementCounter('api_calls_coins');
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
        metricsCollector.incrementCounter('api_calls_metrics');
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
        const symbol = extractSymbol(req.params);
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
        const symbol = extractSymbol(req.params);
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
        const symbol = extractSymbol(req.params);
        
        metricsCollector.incrementCounter('api_calls_collect');
        logger.info(`Collecting fresh metrics for ${symbol}...`);
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
    // Error logging middleware
    this.app.use(errorLogger);
    
    // Sentry error handler (must be before other error handlers)
    this.app.use(sentryErrorHandler());
    
    // General error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      metricsCollector.incrementCounter('errors_total');
      logger.error('API Error:', { 
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });
      
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
        logger.info(`Collecting metrics for ${coin.symbol}...`);
        metricsCollector.incrementCounter('cfv_calculations_total');
        
        const metrics = await this.collector.getTransactionMetrics(coin.symbol);
        await this.db.saveMetrics(coin.symbol, metrics);
        successful++;
        
        metricsCollector.incrementCounter('cfv_calculations_success');
        
        // Rate limiting: 5 second delay
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        logger.error(`Failed to collect ${coin.symbol}:`, { error });
        metricsCollector.incrementCounter('cfv_calculations_failed');
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
      logger.info(`CFV Metrics API Server running on port ${this.config.port}`);
      logger.info(`Health check: http://localhost:${this.config.port}/health`);
      logger.info(`API endpoints: http://localhost:${this.config.port}/api/metrics`);
      logger.info(`Dashboard: http://localhost:${this.config.port}/dashboard`);
      logger.info(`Prometheus metrics: http://localhost:${this.config.port}/metrics/prometheus`);
    });
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    logger.info('Shutting down API server...');
    await this.db.close();
  }
}

export default APIServer;
