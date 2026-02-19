import * as dotenv from 'dotenv';
import { APIServer } from './api/server.js';
import { CollectionScheduler } from './scheduler/CollectionScheduler.js';
import { initializeDatabase } from './database/initDatabase.js';
import { validateAndReportEnvironment } from './utils/validateEnv.js';
import { logger } from './utils/logger.js';

/**
 * CFV Metrics Agent - Main Application
 * 
 * Production-ready application with:
 * - REST API server
 * - Automated data collection
 * - Database integration
 * - Monitoring and logging
 */

// Load environment variables
dotenv.config();

// Validate environment variables
validateAndReportEnvironment();

// Configuration
// Parse database configuration from MYSQL_URL or individual variables
function parseDatabaseConfig() {
  // If MYSQL_URL is provided (Railway format), parse it
  if (process.env.MYSQL_URL) {
    try {
      const url = new URL(process.env.MYSQL_URL);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1) || 'cfv_metrics' // Remove leading '/'
      };
    } catch (error) {
      logger.error('Failed to parse MYSQL_URL', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  // Fall back to individual environment variables
  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306'),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'cfv_metrics'
  };
}

const dbConfig = parseDatabaseConfig();

// Debug: Check if API key is loaded
const coingeckoKey = process.env.COINGECKO_API_KEY;
const isProduction = process.env.NODE_ENV === 'production';

if (coingeckoKey) {
  if (isProduction) {
    // Production: Don't show any part of the key
    logger.info('CoinGecko API key loaded');
  } else {
    // Development: Show only first 4 characters
    logger.info('CoinGecko API key loaded', { keyPrefix: coingeckoKey.substring(0, 4) });
  }
} else {
  logger.warn('CoinGecko API key not found in environment');
}

const config = {
  api: {
    port: parseInt(process.env.API_PORT || process.env.PORT || '3000'),
    database: dbConfig,
    coingeckoApiKey: coingeckoKey
  },
  scheduler: {
    database: dbConfig,
    coingeckoApiKey: coingeckoKey,
    intervalMinutes: parseInt(process.env.COLLECTION_INTERVAL_MINUTES || '60'),

  }
};

// Initialize components
const apiServer = new APIServer(config.api);
const scheduler = new CollectionScheduler(config.scheduler);

// Graceful shutdown handler
async function shutdown(signal: string) {
  logger.info('Shutting down gracefully', { signal });
  
  try {
    await scheduler.stop();
    await apiServer.stop();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start application
async function start() {
  try {
    logger.info('CFV Metrics Agent - Starting...', {
      environment: process.env.NODE_ENV || 'development',
      apiPort: config.api.port,
      database: `${config.api.database.host}:${config.api.database.port}/${config.api.database.database}`,
      collectionInterval: `${config.scheduler.intervalMinutes} minutes`,
      maxConcurrency: `${config.scheduler.maxConcurrency} coins`
    });

    // Initialize database schema (if needed)
    logger.info('Checking database schema...');
    try {
      await initializeDatabase(config.api.database);
      logger.info('Database initialized successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Database initialization failed', { 
        error: err.message,
        config: {
          host: config.api.database.host,
          port: config.api.database.port,
          database: config.api.database.database,
          user: config.api.database.user
        }
      });
      
      // Don't exit - allow app to continue if database is optional
      // or already initialized from a previous run
      logger.warn('Continuing without fresh database initialization...');
    }

    // Start API server
    logger.info('Starting API server...');
    await apiServer.start();
    logger.info('API server started');

    // Start scheduler
    logger.info('Starting collection scheduler...');
    await scheduler.start();
    logger.info('Scheduler started');

    logger.info('CFV Metrics Agent - Running', {
      api: `http://localhost:${config.api.port}`,
      health: `http://localhost:${config.api.port}/health`,
      metrics: `http://localhost:${config.api.port}/api/metrics`
    });
  } catch (error) {
    logger.error('Failed to start application', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Start the application
start();
