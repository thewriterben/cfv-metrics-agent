import mysql from 'mysql2/promise';

/**
 * Initialize database schema
 * Creates all required tables and inserts initial coin data
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
    
    // Create connection
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: true
    });

    // Drop and recreate tables to fix schema mismatches
    // (Safe because metrics can be recollected)
    await connection.query('DROP TABLE IF EXISTS metric_history');
    await connection.query('DROP TABLE IF EXISTS metrics');
    await connection.query('DROP TABLE IF EXISTS collection_runs');
    console.log('✅ Dropped old tables (if exist) to fix schema');

    // Create tables
    const schema = `
      -- Create coins table
      CREATE TABLE IF NOT EXISTS coins (
          id INT PRIMARY KEY AUTO_INCREMENT,
          symbol VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          coingecko_id VARCHAR(100),
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_symbol (symbol),
          INDEX idx_active (active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- Create metrics table
      CREATE TABLE IF NOT EXISTS metrics (
          id INT PRIMARY KEY AUTO_INCREMENT,
          coin_id INT NOT NULL,
          annual_tx_count BIGINT,
          annual_tx_value DECIMAL(30, 2),
          avg_tx_value DECIMAL(20, 8),
          confidence_level VARCHAR(20),
          sources TEXT,
          metadata JSON,
          collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE,
          INDEX idx_coin_collected (coin_id, collected_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- Create metric_history table
      CREATE TABLE IF NOT EXISTS metric_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          coin_id INT NOT NULL,
          annual_tx_count BIGINT,
          annual_tx_value DECIMAL(30, 2),
          avg_tx_value DECIMAL(20, 8),
          confidence_level VARCHAR(20),
          sources TEXT,
          metadata JSON,
          recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE,
          INDEX idx_coin_recorded (coin_id, recorded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- Create collection_runs table
      CREATE TABLE IF NOT EXISTS collection_runs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          status VARCHAR(20) DEFAULT 'running',
          coins_total INT DEFAULT 0,
          coins_successful INT DEFAULT 0,
          coins_failed INT DEFAULT 0,
          error_message TEXT,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP NULL,
          duration_ms INT,
          INDEX idx_started_at (started_at),
          INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.query(schema);
    console.log('✅ Database tables created');

    // Insert initial coin data
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
      ('ICP', 'Internet Computer', 'internet-computer', TRUE)
      ON DUPLICATE KEY UPDATE 
          name=VALUES(name), 
          coingecko_id=VALUES(coingecko_id),
          active=VALUES(active);
    `;

    await connection.query(insertCoins);
    console.log('✅ Initial coin data inserted (11 DGF coins)');

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
