-- CFV Metrics Agent Database Schema
-- Version: 1.0 (DEPRECATED - FOR REFERENCE ONLY)
-- Date: 2026-02-02
--
-- ⚠️  WARNING: DO NOT USE THIS FILE DIRECTLY ⚠️ 
-- This file is kept for reference only and should NOT be executed directly.
-- 
-- The application uses a migration system to manage database schema safely.
-- See: database/migrations/ directory and src/database/MigrationManager.ts
--
-- To initialize the database, run the application which will automatically
-- apply migrations. Migrations never drop tables and preserve all data.
--
-- ===========================================================================
-- REFERENCE SCHEMA BELOW (for documentation purposes only)
-- ===========================================================================

-- Coins table
CREATE TABLE IF NOT EXISTS coins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  symbol VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  coingecko_id VARCHAR(50),
  collector_type VARCHAR(50) NOT NULL,
  confidence_level ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_symbol (symbol),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metrics table (current/latest metrics)
CREATE TABLE IF NOT EXISTS metrics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coin_id INT NOT NULL,
  annual_tx_count BIGINT NOT NULL,
  annual_tx_value DECIMAL(20, 2) NOT NULL,
  avg_tx_value DECIMAL(20, 2) NOT NULL,
  confidence_level ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
  sources TEXT NOT NULL,
  metadata JSON,
  collected_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE,
  INDEX idx_coin_id (coin_id),
  INDEX idx_collected_at (collected_at),
  INDEX idx_confidence (confidence_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metric history table (historical data)
CREATE TABLE IF NOT EXISTS metric_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coin_id INT NOT NULL,
  annual_tx_count BIGINT NOT NULL,
  annual_tx_value DECIMAL(20, 2) NOT NULL,
  avg_tx_value DECIMAL(20, 2) NOT NULL,
  confidence_level ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
  sources TEXT NOT NULL,
  metadata JSON,
  collected_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE,
  INDEX idx_coin_id (coin_id),
  INDEX idx_collected_at (collected_at),
  INDEX idx_coin_collected (coin_id, collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Collection runs table (tracking data collection jobs)
CREATE TABLE IF NOT EXISTS collection_runs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  status ENUM('running', 'completed', 'failed') NOT NULL,
  coins_total INT NOT NULL,
  coins_successful INT DEFAULT 0,
  coins_failed INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial coin data (safe with ON DUPLICATE KEY UPDATE)
INSERT INTO coins (symbol, name, coingecko_id, collector_type, confidence_level) VALUES
('BTC', 'Bitcoin', 'bitcoin', 'CoinGeckoAPI', 'MEDIUM'),
('ETH', 'Ethereum', 'ethereum', 'CoinGeckoAPI', 'MEDIUM'),
('DASH', 'Dash', 'dash', 'DashAPI', 'MEDIUM'),
('DGB', 'DigiByte', 'digibyte', 'CoinGeckoAPI', 'MEDIUM'),
('XMR', 'Monero', 'monero', 'CoinGeckoAPI', 'MEDIUM'),
('RVN', 'Ravencoin', 'ravencoin', 'CoinGeckoAPI', 'MEDIUM'),
('XCH', 'Chia', 'chia', 'CoinGeckoAPI', 'MEDIUM'),
('XEC', 'eCash', 'ecash', 'CoinGeckoAPI', 'MEDIUM'),
('XNO', 'Nano', 'nano', 'NanoRPC', 'HIGH'),
('NEAR', 'NEAR Protocol', 'near', 'NearBlocksAPI', 'MEDIUM'),
('ICP', 'Internet Computer', 'internet-computer', 'CoinGeckoAPI', 'MEDIUM')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  coingecko_id = VALUES(coingecko_id),
  collector_type = VALUES(collector_type),
  confidence_level = VALUES(confidence_level);

-- Create views for easy querying

-- Latest metrics view
CREATE OR REPLACE VIEW v_latest_metrics AS
SELECT 
  c.symbol,
  c.name,
  c.collector_type,
  m.annual_tx_count,
  m.annual_tx_value,
  m.avg_tx_value,
  m.confidence_level,
  m.sources,
  m.collected_at,
  m.updated_at
FROM coins c
LEFT JOIN metrics m ON c.id = m.coin_id
WHERE c.active = TRUE
ORDER BY c.symbol;

-- Metrics summary view
CREATE OR REPLACE VIEW v_metrics_summary AS
SELECT 
  COUNT(*) as total_coins,
  SUM(CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END) as coins_with_data,
  SUM(CASE WHEN m.confidence_level = 'HIGH' THEN 1 ELSE 0 END) as high_confidence_count,
  SUM(CASE WHEN m.confidence_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_confidence_count,
  SUM(CASE WHEN m.confidence_level = 'LOW' THEN 1 ELSE 0 END) as low_confidence_count,
  MAX(m.collected_at) as last_collection_time
FROM coins c
LEFT JOIN metrics m ON c.id = m.coin_id
WHERE c.active = TRUE;

-- Collection run summary view
CREATE OR REPLACE VIEW v_collection_runs AS
SELECT 
  id,
  status,
  coins_total,
  coins_successful,
  coins_failed,
  ROUND(coins_successful / coins_total * 100, 2) as success_rate,
  started_at,
  completed_at,
  duration_ms,
  ROUND(duration_ms / 1000, 2) as duration_seconds
FROM collection_runs
ORDER BY started_at DESC
LIMIT 100;
