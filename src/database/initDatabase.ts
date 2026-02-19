import mysql from 'mysql2/promise';
import { MigrationManager } from './MigrationManager.js';
import { logger } from '../utils/logger.js';

/**
 * Initialize database schema safely using migrations
 * 
 * IMPORTANT: This function NEVER drops tables automatically.
 * - Uses migration system to track and apply schema changes incrementally
 * - Preserves all historical data (metrics, metric_history, collection_runs)
 * - Only runs migrations that haven't been applied yet
 * - Safe to run on every application startup
 */
export async function initializeDatabase(config: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}): Promise<void> {
  let connection;
  
  try {
    logger.info('Initializing database schema...');
    
    // Run migrations (safe, idempotent, preserves data)
    const migrationManager = new MigrationManager(config);
    await migrationManager.runMigrations();
    
    // Create connection for coin data initialization
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database
    });

    // Insert initial coin data (safe with ON DUPLICATE KEY UPDATE)
    // This preserves any existing coin data and only updates if needed
    const insertCoins = `
      INSERT INTO coins (symbol, name, coingecko_id, collector_type, confidence_level, active) VALUES
      ('BTC', 'Bitcoin', 'bitcoin', 'CoinGeckoAPI', 'MEDIUM', TRUE),
      ('ETH', 'Ethereum', 'ethereum', 'CoinGeckoAPI', 'MEDIUM', TRUE),
      ('DASH', 'Dash', 'dash', 'DashAPI', 'MEDIUM', TRUE),
      ('DGB', 'DigiByte', 'digibyte', 'CoinGeckoAPI', 'MEDIUM', TRUE),
      ('XMR', 'Monero', 'monero', 'CoinGeckoAPI', 'MEDIUM', TRUE),
      ('RVN', 'Ravencoin', 'ravencoin', 'CoinGeckoAPI', 'MEDIUM', TRUE),
      ('XCH', 'Chia', 'chia', 'CoinGeckoAPI', 'MEDIUM', TRUE),
      ('XEC', 'eCash', 'ecash', 'CoinGeckoAPI', 'MEDIUM', TRUE),
      ('XNO', 'Nano', 'nano', 'NanoRPC', 'HIGH', TRUE),
      ('NEAR', 'NEAR Protocol', 'near', 'NearBlocksAPI', 'MEDIUM', TRUE),
      ('ICP', 'Internet Computer', 'internet-computer', 'CoinGeckoAPI', 'MEDIUM', TRUE),
      ('ZCL', 'Zclassic', 'zclassic', 'CoinGeckoAPI', 'MEDIUM', TRUE)
      ON DUPLICATE KEY UPDATE 
          name=VALUES(name), 
          coingecko_id=VALUES(coingecko_id),
          collector_type=VALUES(collector_type),
          confidence_level=VALUES(confidence_level),
          active=VALUES(active);
    `;

    await connection.query(insertCoins);
    logger.info('Initial coin data inserted/updated', { count: 12, type: 'DGF coins' });

    // Verify
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM coins');
    const count = (rows as any)[0].count;
    logger.info('Database initialized successfully', { totalCoins: count });

  } catch (error) {
    logger.error('Database initialization failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
