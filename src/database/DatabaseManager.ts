import mysql from 'mysql2/promise';
import { TransactionMetrics } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Database Manager
 * 
 * Handles all database operations for the CFV Metrics Agent.
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface Coin {
  id: number;
  symbol: string;
  name: string;
  coingecko_id?: string;
  collector_type: string;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  active: boolean;
}

export interface MetricRecord {
  id: number;
  coin_id: number;
  annual_tx_count: number;
  annual_tx_value: number;
  avg_tx_value: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  sources: string;
  metadata?: any;
  collected_at: Date;
}

export interface CollectionRun {
  id: number;
  status: 'running' | 'completed' | 'failed';
  coins_total: number;
  coins_successful: number;
  coins_failed: number;
  error_message?: string;
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;
}

export class DatabaseManager {
  private pool: mysql.Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      return true;
    } catch (error) {
      logger.error('Database connection test failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Get all active coins
   */
  async getActiveCoins(): Promise<Coin[]> {
    const [rows] = await this.pool.execute<any[]>(
      'SELECT * FROM coins WHERE active = TRUE ORDER BY symbol'
    );
    return rows;
  }

  /**
   * Get coin by symbol
   */
  async getCoinBySymbol(symbol: string): Promise<Coin | null> {
    const [rows] = await this.pool.execute<any[]>(
      'SELECT * FROM coins WHERE symbol = ? AND active = TRUE',
      [symbol]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Save metrics for a coin
   */
  async saveMetrics(symbol: string, metrics: TransactionMetrics): Promise<void> {
    const coin = await this.getCoinBySymbol(symbol);
    if (!coin) {
      throw new Error(`Coin ${symbol} not found in database`);
    }

    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Insert into metrics table (current)
      await connection.execute(
        `INSERT INTO metrics (coin_id, annual_tx_count, annual_tx_value, avg_tx_value, 
         confidence_level, sources, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         annual_tx_count = VALUES(annual_tx_count),
         annual_tx_value = VALUES(annual_tx_value),
         avg_tx_value = VALUES(avg_tx_value),
         confidence_level = VALUES(confidence_level),
         sources = VALUES(sources),
         metadata = VALUES(metadata),
         created_at = VALUES(created_at)`,
        [
          coin.id,
          metrics.annualTxCount,
          metrics.annualTxValue,
          metrics.avgTxValue,
          metrics.confidence,
          JSON.stringify(metrics.sources),
          JSON.stringify(metrics.metadata || {}),
          metrics.timestamp
        ]
      );

      // Insert into metric_history table
      await connection.execute(
        `INSERT INTO metric_history (coin_id, annual_tx_count, annual_tx_value, avg_tx_value,
         confidence_level, sources, metadata, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          coin.id,
          metrics.annualTxCount,
          metrics.annualTxValue,
          metrics.avgTxValue,
          metrics.confidence,
          JSON.stringify(metrics.sources),
          JSON.stringify(metrics.metadata || {}),
          metrics.timestamp
        ]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get latest metrics for a coin
   */
  async getLatestMetrics(symbol: string): Promise<MetricRecord | null> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT m.* FROM metrics m
       JOIN coins c ON m.coin_id = c.id
       WHERE c.symbol = ? AND c.active = TRUE`,
      [symbol]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all latest metrics
   */
  async getAllLatestMetrics(): Promise<any[]> {
    const [rows] = await this.pool.execute<any[]>(
      'SELECT * FROM v_latest_metrics'
    );
    return rows;
  }

  /**
   * Get metrics history for a coin
   */
  async getMetricsHistory(symbol: string, limit: number = 100): Promise<any[]> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT mh.* FROM metric_history mh
       JOIN coins c ON mh.coin_id = c.id
       WHERE c.symbol = ? AND c.active = TRUE
       ORDER BY mh.collected_at DESC
       LIMIT ?`,
      [symbol, limit]
    );
    return rows;
  }

  /**
   * Start a collection run
   */
  async startCollectionRun(coinsTotal: number): Promise<number> {
    const [result] = await this.pool.execute<any>(
      `INSERT INTO collection_runs (status, coins_total, started_at)
       VALUES ('running', ?, NOW())`,
      [coinsTotal]
    );
    return result.insertId;
  }

  /**
   * Update collection run
   */
  async updateCollectionRun(
    runId: number,
    status: 'running' | 'completed' | 'failed',
    successful: number,
    failed: number,
    errorMessage?: string
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE collection_runs
       SET status = ?, coins_successful = ?, coins_failed = ?,
           error_message = ?, completed_at = NOW(),
           duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) / 1000
       WHERE id = ?`,
      [status, successful, failed, errorMessage || null, runId]
    );
  }

  /**
   * Get collection run summary
   */
  async getCollectionRunSummary(limit: number = 10): Promise<any[]> {
    const [rows] = await this.pool.execute<any[]>(
      'SELECT * FROM v_collection_runs LIMIT ?',
      [limit]
    );
    return rows;
  }

  /**
   * Get metrics summary
   */
  async getMetricsSummary(): Promise<any> {
    const [rows] = await this.pool.execute<any[]>(
      'SELECT * FROM v_metrics_summary'
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  // ─── Custom Metric Definitions ───────────────────────────────────────────

  /**
   * Create a new custom metric definition
   */
  async createCustomMetricDefinition(params: {
    name: string;
    description?: string;
    unit?: string;
    formula?: string;
  }): Promise<number> {
    const [result] = await this.pool.execute<any>(
      `INSERT INTO custom_metrics_definitions (name, description, unit, formula)
       VALUES (?, ?, ?, ?)`,
      [params.name, params.description || null, params.unit || null, params.formula || null]
    );
    return result.insertId;
  }

  /**
   * Get all active custom metric definitions
   */
  async getCustomMetricDefinitions(): Promise<any[]> {
    const [rows] = await this.pool.execute<any[]>(
      'SELECT * FROM custom_metrics_definitions WHERE active = TRUE ORDER BY name'
    );
    return rows;
  }

  /**
   * Get a single custom metric definition by id
   */
  async getCustomMetricDefinition(id: number): Promise<any | null> {
    const [rows] = await this.pool.execute<any[]>(
      'SELECT * FROM custom_metrics_definitions WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Update a custom metric definition
   */
  async updateCustomMetricDefinition(
    id: number,
    params: { name?: string; description?: string; unit?: string; formula?: string; active?: boolean }
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (params.name !== undefined)        { fields.push('name = ?');        values.push(params.name); }
    if (params.description !== undefined) { fields.push('description = ?'); values.push(params.description); }
    if (params.unit !== undefined)        { fields.push('unit = ?');        values.push(params.unit); }
    if (params.formula !== undefined)     { fields.push('formula = ?');     values.push(params.formula); }
    if (params.active !== undefined)      { fields.push('active = ?');      values.push(params.active); }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await this.pool.execute<any>(
      `UPDATE custom_metrics_definitions SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  /**
   * Soft-delete a custom metric definition
   */
  async deleteCustomMetricDefinition(id: number): Promise<boolean> {
    const [result] = await this.pool.execute<any>(
      'UPDATE custom_metrics_definitions SET active = FALSE WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  // ─── Custom Metric Values ─────────────────────────────────────────────────

  /**
   * Upsert a custom metric value for a coin
   */
  async setCustomMetricValue(params: {
    definitionId: number;
    symbol: string;
    value: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const coin = await this.getCoinBySymbol(params.symbol);
    if (!coin) {
      throw new Error(`Coin ${params.symbol} not found in database`);
    }

    await this.pool.execute(
      `INSERT INTO custom_metric_values (definition_id, coin_id, value, metadata, collected_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         value = VALUES(value),
         metadata = VALUES(metadata),
         collected_at = VALUES(collected_at)`,
      [
        params.definitionId,
        coin.id,
        params.value,
        JSON.stringify(params.metadata || {})
      ]
    );
  }

  /**
   * Get the latest custom metric values for a coin
   */
  async getCustomMetricValues(symbol: string): Promise<any[]> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT d.id AS definition_id, d.name, d.unit, d.description,
              v.value, v.metadata, v.collected_at
       FROM custom_metric_values v
       JOIN custom_metrics_definitions d ON v.definition_id = d.id
       JOIN coins c ON v.coin_id = c.id
       WHERE c.symbol = ? AND d.active = TRUE
       ORDER BY d.name`,
      [symbol.toUpperCase()]
    );
    return rows;
  }

  /**
   * Get all values for a specific custom metric definition (across all coins)
   */
  async getCustomMetricValuesByDefinition(definitionId: number): Promise<any[]> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT c.symbol, c.name AS coin_name,
              v.value, v.metadata, v.collected_at
       FROM custom_metric_values v
       JOIN coins c ON v.coin_id = c.id
       WHERE v.definition_id = ? AND c.active = TRUE
       ORDER BY c.symbol`,
      [definitionId]
    );
    return rows;
  }
}

export default DatabaseManager;
