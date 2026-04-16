import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseManager } from '../database/DatabaseManager.js';
import { BlockchainDataCollector } from '../collectors/BlockchainDataCollector.js';
import { HealthChecker } from '../utils/HealthChecker.js';
import { RateLimitMonitor } from '../utils/RateLimitMonitor.js';
import { logger } from '../utils/logger.js';
import { metricsCollector } from '../utils/MetricsCollector.js';
import { performanceMonitor } from '../utils/PerformanceMonitor.js';
import { requestLogger, errorLogger } from '../middleware/requestLogger.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/authentication.js';
import { strictKeyLimiter, standardKeyLimiter } from '../middleware/rateLimitByKey.js';
import { createDashboardRoutes } from './dashboardRoutes.js';
import { 
  extractSymbol, 
  sentryRequestHandler, 
  sentryTracingHandler, 
  sentryErrorHandler 
} from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  private healthChecker: HealthChecker;
  private rateLimitMonitor: RateLimitMonitor;


  constructor(config: APIServerConfig) {
    this.config = config;
    this.app = express();
    this.db = new DatabaseManager(config.database);
    this.collector = new BlockchainDataCollector({
      coingeckoApiKey: config.coingeckoApiKey
    });
    this.healthChecker = new HealthChecker(this.db);
    this.rateLimitMonitor = new RateLimitMonitor();

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
    // Parse ALLOWED_ORIGINS environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS || '*';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Warn if CORS is set to allow all origins in production
    if (allowedOrigins === '*' && isProduction) {
      logger.warn('CORS is configured to allow all origins (*) in production. This is a security risk. Set ALLOWED_ORIGINS to your frontend domain(s).');
    }
    
    // Configure CORS origin
    let corsOrigin: string | string[] | boolean;
    if (allowedOrigins === '*') {
      // Allow all origins (default to true for development, but already warned for production)
      corsOrigin = true;
    } else {
      // Parse comma-separated list of origins
      corsOrigin = allowedOrigins.split(',').map(origin => origin.trim());
      logger.info(`CORS configured for origins: ${corsOrigin.join(', ')}`);
    }
    
    this.app.use(cors({
      origin: corsOrigin,
      credentials: true
    }));
    
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

    // ── Static Dashboard UI ──────────────────────────────────────────────────
    const publicDir = path.join(__dirname, '../public');
    this.app.use(express.static(publicDir));

    // Serve dashboard HTML at /dashboard
    this.app.get('/dashboard', (req, res) => {
      res.sendFile(path.join(publicDir, 'dashboard.html'));
    });

    // ── Dashboard & Monitoring JSON routes ───────────────────────────────────
    const dashboardRouter = createDashboardRoutes({ healthChecker: this.healthChecker });
    this.app.use('/', dashboardRouter);

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



    // Get all coins (with optional auth and standard rate limiting)
    this.app.get('/api/coins', optionalAuth, standardKeyLimiter, async (req, res, next) => {
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

    // Get all latest metrics (with optional auth and standard rate limiting)
    this.app.get('/api/metrics', optionalAuth, standardKeyLimiter, async (req, res, next) => {
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

    // Get metrics for specific coin (with optional auth and strict rate limiting)
    this.app.get('/api/metrics/:symbol', optionalAuth, strictKeyLimiter, async (req, res, next) => {
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

    // Get metrics history for specific coin (with optional auth)
    this.app.get('/api/metrics/:symbol/history', optionalAuth, standardKeyLimiter, async (req, res, next) => {
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

    // Collect fresh metrics for specific coin (REQUIRES AUTH - expensive operation)
    this.app.post('/api/collect/:symbol', requireAuth, strictKeyLimiter, async (req, res, next) => {
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

    // Collect metrics for all coins (REQUIRES ADMIN AUTH - very expensive operation)
    this.app.post('/api/collect', requireAuth, requireAdmin, strictKeyLimiter, async (req, res, next) => {
      try {
        const coins = await this.db.getActiveCoins();
        const runId = await this.db.startCollectionRun(coins.length);
        
        // Start collection in background
        this.collectAllMetrics(runId, coins).catch(error => {
          logger.error('Collection run failed:', { error });
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

    // Get collection run summary (with optional auth)
    this.app.get('/api/collection-runs', optionalAuth, standardKeyLimiter, async (req, res, next) => {
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

    // Get metrics summary (with optional auth)
    this.app.get('/api/summary', optionalAuth, standardKeyLimiter, async (req, res, next) => {
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

    // ── Rate Limit Status Endpoints ──────────────────────────────────────────

    // Get rate limit status for all services
    this.app.get('/api/rate-limits/status', optionalAuth, standardKeyLimiter, (req, res) => {
      const statuses = this.rateLimitMonitor.getAllStatus();
      res.json({ success: true, data: statuses });
    });

    // Get rate limit status for a specific service
    this.app.get('/api/rate-limits/:service', optionalAuth, standardKeyLimiter, (req, res) => {
      const service = req.params.service as any;
      const status = this.rateLimitMonitor.getStatus(service);
      if (!status) {
        return res.status(404).json({ success: false, error: `Unknown service: ${service}` });
      }
      res.json({ success: true, data: status });
    });

    // ── Custom Metrics Endpoints ─────────────────────────────────────────────

    // List custom metric definitions
    this.app.get('/api/custom-metrics', optionalAuth, standardKeyLimiter, async (req, res, next) => {
      try {
        const definitions = await this.db.getCustomMetricDefinitions();
        res.json({ success: true, data: definitions, count: definitions.length });
      } catch (error) {
        next(error);
      }
    });

    // Get a single custom metric definition
    this.app.get('/api/custom-metrics/:id', optionalAuth, standardKeyLimiter, async (req, res, next) => {
      try {
        const id = parseInt(req.params.id as string);
        if (isNaN(id)) {
          return res.status(400).json({ success: false, error: 'Invalid definition id' });
        }
        const def = await this.db.getCustomMetricDefinition(id);
        if (!def) {
          return res.status(404).json({ success: false, error: `Custom metric definition ${id} not found` });
        }
        const values = await this.db.getCustomMetricValuesByDefinition(id);
        res.json({ success: true, data: { ...def, values } });
      } catch (error) {
        next(error);
      }
    });

    // Create a custom metric definition (REQUIRES AUTH)
    this.app.post('/api/custom-metrics', requireAuth, strictKeyLimiter, async (req, res, next) => {
      try {
        const { name, description, unit, formula } = req.body;
        if (!name || typeof name !== 'string') {
          return res.status(400).json({ success: false, error: 'name is required' });
        }
        const id = await this.db.createCustomMetricDefinition({ name, description, unit, formula });
        res.status(201).json({ success: true, data: { id, name, description, unit, formula } });
      } catch (error) {
        next(error);
      }
    });

    // Update a custom metric definition (REQUIRES AUTH)
    this.app.put('/api/custom-metrics/:id', requireAuth, strictKeyLimiter, async (req, res, next) => {
      try {
        const id = parseInt(req.params.id as string);
        if (isNaN(id)) {
          return res.status(400).json({ success: false, error: 'Invalid definition id' });
        }
        const { name, description, unit, formula, active } = req.body;
        const updated = await this.db.updateCustomMetricDefinition(id, { name, description, unit, formula, active });
        if (!updated) {
          return res.status(404).json({ success: false, error: `Custom metric definition ${id} not found` });
        }
        res.json({ success: true, message: `Definition ${id} updated` });
      } catch (error) {
        next(error);
      }
    });

    // Delete a custom metric definition (REQUIRES AUTH)
    this.app.delete('/api/custom-metrics/:id', requireAuth, strictKeyLimiter, async (req, res, next) => {
      try {
        const id = parseInt(req.params.id as string);
        if (isNaN(id)) {
          return res.status(400).json({ success: false, error: 'Invalid definition id' });
        }
        const deleted = await this.db.deleteCustomMetricDefinition(id);
        if (!deleted) {
          return res.status(404).json({ success: false, error: `Custom metric definition ${id} not found` });
        }
        res.json({ success: true, message: `Definition ${id} deleted` });
      } catch (error) {
        next(error);
      }
    });

    // Set a custom metric value for a coin (REQUIRES AUTH)
    this.app.post('/api/custom-metrics/:id/values', requireAuth, strictKeyLimiter, async (req, res, next) => {
      try {
        const id = parseInt(req.params.id as string);
        if (isNaN(id)) {
          return res.status(400).json({ success: false, error: 'Invalid definition id' });
        }
        const { symbol, value, metadata } = req.body;
        if (!symbol || value == null) {
          return res.status(400).json({ success: false, error: 'symbol and value are required' });
        }
        await this.db.setCustomMetricValue({ definitionId: id, symbol, value, metadata });
        res.json({ success: true, message: `Value set for ${symbol}` });
      } catch (error) {
        next(error);
      }
    });

    // Get custom metric values for a coin
    this.app.get('/api/metrics/:symbol/custom', optionalAuth, standardKeyLimiter, async (req, res, next) => {
      try {
        const symbol = extractSymbol(req.params);
        const values = await this.db.getCustomMetricValues(symbol.toUpperCase());
        res.json({ success: true, data: values, count: values.length });
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
    this.rateLimitMonitor.dispose();
    await this.db.close();
  }
}

export default APIServer;
