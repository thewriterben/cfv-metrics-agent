import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration Manager
 * 
 * Handles database schema migrations safely without dropping tables.
 * Tracks which migrations have been applied using a schema_version table.
 */

export interface MigrationConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface MigrationRecord {
  version: number;
  name: string;
  applied_at: Date;
}

interface VersionRow {
  version: number;
}

interface CurrentVersionRow {
  current_version: number | null;
}

export class MigrationManager {
  private config: MigrationConfig;
  private migrationsDir: string;

  constructor(config: MigrationConfig) {
    this.config = config;
    // Migrations are in database/migrations relative to project root
    this.migrationsDir = path.join(__dirname, '../../database/migrations');
  }

  /**
   * Ensure schema_version table exists to track migrations
   */
  private async ensureSchemaVersionTable(connection: mysql.Connection): Promise<void> {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_applied_at (applied_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  /**
   * Get list of applied migrations from database
   */
  private async getAppliedMigrations(connection: mysql.Connection): Promise<Set<number>> {
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT version FROM schema_version ORDER BY version'
    );
    return new Set((rows as VersionRow[]).map(row => row.version));
  }

  /**
   * Get list of available migration files
   */
  private getAvailableMigrations(): Array<{ version: number; name: string; filepath: string }> {
    if (!fs.existsSync(this.migrationsDir)) {
      logger.warn('Migrations directory not found', { directory: this.migrationsDir });
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    return files.map(file => {
      // Extract version number from filename (e.g., 001_initial_schema.sql -> 1)
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename format: ${file}. Expected format: NNN_name.sql`);
      }
      return {
        version: parseInt(match[1], 10),
        name: match[2],
        filepath: path.join(this.migrationsDir, file)
      };
    });
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(
    connection: mysql.Connection,
    migration: { version: number; name: string; filepath: string }
  ): Promise<void> {
    logger.info('Applying migration', { version: migration.version, name: migration.name });
    
    const sql = fs.readFileSync(migration.filepath, 'utf-8');
    
    // Split by semicolons and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement separately
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }

    // Record migration as applied
    await connection.query(
      'INSERT INTO schema_version (version, name) VALUES (?, ?)',
      [migration.version, migration.name]
    );

    logger.info('Migration applied successfully', { version: migration.version });
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    let connection;

    try {
      logger.info('Starting database migration check...');

      connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database
      });

      // Ensure schema_version table exists
      await this.ensureSchemaVersionTable(connection);

      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations(connection);
      logger.info('Applied migrations', { 
        count: appliedMigrations.size,
        versions: appliedMigrations.size > 0 ? Array.from(appliedMigrations).join(', ') : 'none'
      });

      // Get available migrations
      const availableMigrations = this.getAvailableMigrations();
      logger.info('Available migrations', { count: availableMigrations.length });

      // Filter to pending migrations
      const pendingMigrations = availableMigrations.filter(m => !appliedMigrations.has(m.version));

      if (pendingMigrations.length === 0) {
        logger.info('Database schema is up to date (no pending migrations)');
        return;
      }

      logger.info('Pending migrations', { count: pendingMigrations.length });

      // Apply each pending migration in a transaction
      for (const migration of pendingMigrations) {
        await connection.beginTransaction();
        try {
          await this.applyMigration(connection, migration);
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw new Error(`Failed to apply migration ${migration.version}: ${error}`);
        }
      }

      logger.info('All migrations applied successfully');

    } catch (error) {
      logger.error('Migration failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Get current schema version
   */
  async getCurrentVersion(): Promise<number> {
    let connection;

    try {
      connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database
      });

      await this.ensureSchemaVersionTable(connection);

      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT MAX(version) as current_version FROM schema_version'
      );

      return (rows as CurrentVersionRow[])[0]?.current_version || 0;

    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }
}
