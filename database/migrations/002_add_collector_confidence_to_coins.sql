-- Migration 002: Add collector_type and confidence_level columns to coins table
-- This migration adds the missing columns that are expected by the Coin interface
-- Uses a safe approach that checks for column existence before adding

-- Check and add collector_type column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'coins' 
  AND COLUMN_NAME = 'collector_type';

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE coins ADD COLUMN collector_type VARCHAR(50) NOT NULL DEFAULT ''CoinGeckoAPI'' AFTER coingecko_id',
  'SELECT ''Column collector_type already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add confidence_level column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'coins' 
  AND COLUMN_NAME = 'confidence_level';

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE coins ADD COLUMN confidence_level ENUM(''HIGH'', ''MEDIUM'', ''LOW'') NOT NULL DEFAULT ''MEDIUM'' AFTER collector_type',
  'SELECT ''Column confidence_level already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
