import mysql from 'mysql2/promise';
import { MigrationManager } from './MigrationManager.js';

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
    console.log('Initializing database schema...');
    
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
      INSERT INTO coins (symbol, name, coingecko_id, active) VALUES
      ('BTC', 'Bitcoin', 'bitcoin', TRUE),
      ('ETH', 'Ethereum', 'ethereum', TRUE),
      ('DASH', 'Dash', 'dash', TRUE),
      ('DGB', 'DigiByte', 'digibyte', TRUE),
      ('XMR', 'Monero', 'monero', TRUE),
      ('RVN', 'Ravencoin', 'ravencoin', TRUE),
      ('XCH', 'Chia', 'chia', TRUE),
      ('XEC', 'eCash', 'ecash', TRUE),
      ('XNO', 'Nano', 'nano', TRUE),
      ('NEAR', 'NEAR Protocol', 'near', TRUE),
      ('ICP', 'Internet Computer', 'internet-computer', TRUE),
      ('ZCL', 'Zclassic', 'zclassic', TRUE)
      ON DUPLICATE KEY UPDATE 
          name=VALUES(name), 
          coingecko_id=VALUES(coingecko_id),
          active=VALUES(active);
    `;

    await connection.query(insertCoins);
    console.log('✅ Initial coin data inserted/updated (12 DGF coins)');

    // Verify
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM coins');
    const count = (rows as any)[0].count;
    console.log(`✅ Database initialized successfully (${count} coins)`);

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
