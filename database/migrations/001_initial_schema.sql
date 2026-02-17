-- Migration 001: Initial Schema
-- Creates all base tables for CFV Metrics Agent
-- This migration is safe to run multiple times (idempotent)

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

-- Create metrics table (current/latest metrics)
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

-- Create metric_history table (historical data)
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

-- Create collection_runs table (tracking data collection jobs)
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
