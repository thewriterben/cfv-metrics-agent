import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MigrationManager } from '../../database/MigrationManager.js';
import mysql from 'mysql2/promise';

describe('Database Migration Tests', () => {
  // Note: These tests require a running MySQL database
  // They are skipped by default and should be run in CI environment
  
  const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
  
  const testIf = shouldRunIntegrationTests ? it : it.skip;

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cfv_metrics_test'
  };

  let connection: mysql.Connection | null = null;

  beforeAll(async () => {
    if (shouldRunIntegrationTests) {
      try {
        connection = await mysql.createConnection(config);
      } catch (error) {
        console.error('Failed to connect to test database:', error);
      }
    }
  });

  afterAll(async () => {
    if (connection) {
      await connection.end();
    }
  });

  describe('Migration 002: Add collector_type and confidence_level columns', () => {
    testIf('should run all migrations successfully', async () => {
      const migrationManager = new MigrationManager(config);
      await expect(migrationManager.runMigrations()).resolves.not.toThrow();
    });

    testIf('should have collector_type column in coins table', async () => {
      if (!connection) {
        throw new Error('Database connection not established');
      }

      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'coins' AND COLUMN_NAME = 'collector_type'`,
        [config.database]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].COLUMN_NAME).toBe('collector_type');
      expect(rows[0].DATA_TYPE).toBe('varchar');
      expect(rows[0].IS_NULLABLE).toBe('NO');
    });

    testIf('should have confidence_level column in coins table', async () => {
      if (!connection) {
        throw new Error('Database connection not established');
      }

      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'coins' AND COLUMN_NAME = 'confidence_level'`,
        [config.database]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].COLUMN_NAME).toBe('confidence_level');
      expect(rows[0].DATA_TYPE).toBe('enum');
      expect(rows[0].COLUMN_TYPE).toContain('HIGH');
      expect(rows[0].COLUMN_TYPE).toContain('MEDIUM');
      expect(rows[0].COLUMN_TYPE).toContain('LOW');
      expect(rows[0].IS_NULLABLE).toBe('NO');
    });

    testIf('should be idempotent - running migrations twice should not fail', async () => {
      const migrationManager = new MigrationManager(config);
      
      // Run migrations first time
      await expect(migrationManager.runMigrations()).resolves.not.toThrow();
      
      // Run migrations second time - should not fail
      await expect(migrationManager.runMigrations()).resolves.not.toThrow();
    });

    testIf('should allow inserting coin data with new columns', async () => {
      if (!connection) {
        throw new Error('Database connection not established');
      }

      // Insert a test coin with the new columns
      const [result] = await connection.execute(
        `INSERT INTO coins (symbol, name, coingecko_id, collector_type, confidence_level, active)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        ['TEST', 'Test Coin', 'test-coin', 'CoinGeckoAPI', 'HIGH', true]
      );

      expect(result).toBeDefined();

      // Verify we can read the data back
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT symbol, collector_type, confidence_level FROM coins WHERE symbol = ?',
        ['TEST']
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].symbol).toBe('TEST');
      expect(rows[0].collector_type).toBe('CoinGeckoAPI');
      expect(rows[0].confidence_level).toBe('HIGH');

      // Clean up test data
      await connection.execute('DELETE FROM coins WHERE symbol = ?', ['TEST']);
    });

    testIf('should have default values for new columns', async () => {
      if (!connection) {
        throw new Error('Database connection not established');
      }

      // Insert a coin without specifying the new columns
      await connection.execute(
        `INSERT INTO coins (symbol, name, coingecko_id, active)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        ['TEST2', 'Test Coin 2', 'test-coin-2', true]
      );

      // Verify default values are applied
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT symbol, collector_type, confidence_level FROM coins WHERE symbol = ?',
        ['TEST2']
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].collector_type).toBe('CoinGeckoAPI');
      expect(rows[0].confidence_level).toBe('MEDIUM');

      // Clean up test data
      await connection.execute('DELETE FROM coins WHERE symbol = ?', ['TEST2']);
    });
  });

  describe('Migration tracking', () => {
    testIf('should track applied migrations in schema_version table', async () => {
      if (!connection) {
        throw new Error('Database connection not established');
      }

      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT version, name FROM schema_version ORDER BY version'
      );

      expect(rows.length).toBeGreaterThan(0);
      
      // Check that migration 002 is recorded
      const migration002 = rows.find((row: mysql.RowDataPacket) => row.version === 2);
      expect(migration002).toBeDefined();
      expect(migration002?.name).toContain('collector');
    });

    testIf('should return correct current version', async () => {
      const migrationManager = new MigrationManager(config);
      const currentVersion = await migrationManager.getCurrentVersion();
      
      expect(currentVersion).toBeGreaterThanOrEqual(2);
    });
  });
});
