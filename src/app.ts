import dotenv from 'dotenv';
import { APIServer } from './api/server.js';
import { CollectionScheduler } from './scheduler/CollectionScheduler.js';

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

// Configuration
// Railway provides MySQL variables as MYSQLHOST, MYSQLPORT, etc.
// We support both Railway's format and custom DB_* format
const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306'),
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'cfv_metrics'
};

const config = {
  api: {
    port: parseInt(process.env.API_PORT || process.env.PORT || '3000'),
    database: dbConfig,
    coingeckoApiKey: process.env.COINGECKO_API_KEY
  },
  scheduler: {
    database: dbConfig,
    coingeckoApiKey: process.env.COINGECKO_API_KEY,
    intervalMinutes: parseInt(process.env.COLLECTION_INTERVAL_MINUTES || '60'),
    delayBetweenCoins: parseInt(process.env.DELAY_BETWEEN_COINS_MS || '5000')
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
    console.log(`Rate Limit Delay: ${config.scheduler.delayBetweenCoins / 1000} seconds`);
    console.log('='.repeat(80) + '\n');

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
