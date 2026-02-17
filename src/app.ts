import * as dotenv from 'dotenv';
import { APIServer } from './api/server.js';
import { CollectionScheduler } from './scheduler/CollectionScheduler.js';
import { initializeDatabase } from './database/initDatabase.js';
import { validateAndReportEnvironment } from './utils/validateEnv.js';

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
      console.error('Failed to parse MYSQL_URL:', error);
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
    console.log('✅ CoinGecko API key loaded');
  } else {
    // Development: Show only first 4 characters
    console.log(`✅ CoinGecko API key loaded: ${coingeckoKey.substring(0, 4)}...`);
  }
} else {
  console.log('⚠️  CoinGecko API key not found in environment');
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
    delayBetweenCoins: parseInt(process.env.DELAY_BETWEEN_COINS_MS || '5000'), // Deprecated, kept for backwards compatibility
    maxConcurrency: parseInt(process.env.MAX_COLLECTION_CONCURRENCY || '5')
  }
};

// Initialize components
const apiServer = new APIServer(config.api);
const scheduler = new CollectionScheduler(config.scheduler);

// Graceful shutdown handler
async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  try {
    await scheduler.stop();
    await apiServer.stop();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start application
async function start() {
  try {
    console.log('='.repeat(80));
    console.log('CFV Metrics Agent - Starting...');
    console.log('='.repeat(80));
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Port: ${config.api.port}`);
    console.log(`Database: ${config.api.database.host}:${config.api.database.port}/${config.api.database.database}`);
    console.log(`Collection Interval: ${config.scheduler.intervalMinutes} minutes`);
    console.log(`Max Concurrency: ${config.scheduler.maxConcurrency} coins`);
    console.log('='.repeat(80) + '\n');

    // Initialize database schema (if needed)
    console.log('Checking database schema...');
    try {
      await initializeDatabase(config.api.database);
      console.log('✅ Database initialized successfully');
    } catch (error) {
      const err = error as Error;
      console.error('❌ Database initialization failed:', err.message);
      console.error('Database config:', {
        host: config.api.database.host,
        port: config.api.database.port,
        database: config.api.database.database,
        user: config.api.database.user
      });
      
      // Don't exit - allow app to continue if database is optional
      // or already initialized from a previous run
      console.log('⚠️  Continuing without fresh database initialization...');
    }
    console.log('');

    // Start API server
    console.log('Starting API server...');
    await apiServer.start();
    console.log('✅ API server started\n');

    // Start scheduler
    console.log('Starting collection scheduler...');
    await scheduler.start();
    console.log('✅ Scheduler started\n');

    console.log('='.repeat(80));
    console.log('CFV Metrics Agent - Running');
    console.log('='.repeat(80));
    console.log(`API: http://localhost:${config.api.port}`);
    console.log(`Health: http://localhost:${config.api.port}/health`);
    console.log(`Metrics: http://localhost:${config.api.port}/api/metrics`);
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
start();
