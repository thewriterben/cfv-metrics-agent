#!/usr/bin/env node

/**
 * Manual test script for database migration
 * 
 * This script tests the migration that adds collector_type and confidence_level
 * columns to the coins table.
 * 
 * Prerequisites:
 * - MySQL database running
 * - Environment variables set (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 * 
 * Usage:
 *   node scripts/test-migration.js
 */

import { MigrationManager } from '../src/database/MigrationManager.js';
import { initializeDatabase } from '../src/database/initDatabase.js';
import { DatabaseManager } from '../src/database/DatabaseManager.js';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cfv_metrics_test'
};

async function testMigration() {
  console.log('🧪 Testing Database Migration 002');
  console.log('==================================\n');

  try {
    // Step 1: Run migrations
    console.log('1. Running migrations...');
    const migrationManager = new MigrationManager(config);
    await migrationManager.runMigrations();
    const currentVersion = await migrationManager.getCurrentVersion();
    console.log(`   ✅ Migrations complete. Current version: ${currentVersion}\n`);

    // Step 2: Initialize database (insert coin data)
    console.log('2. Initializing database with coin data...');
    await initializeDatabase(config);
    console.log('   ✅ Database initialized\n');

    // Step 3: Verify data can be read
    console.log('3. Verifying data can be read...');
    const dbManager = new DatabaseManager(config);
    const coins = await dbManager.getActiveCoins();
    console.log(`   ✅ Found ${coins.length} coins\n`);

    // Step 4: Display sample coin data
    if (coins.length > 0) {
      console.log('4. Sample coin data:');
      const sampleCoin = coins[0];
      console.log('   Symbol:', sampleCoin.symbol);
      console.log('   Name:', sampleCoin.name);
      console.log('   Collector Type:', sampleCoin.collector_type);
      console.log('   Confidence Level:', sampleCoin.confidence_level);
      console.log('   Active:', sampleCoin.active);
      console.log();
    }

    // Step 5: Verify all coins have the required fields
    console.log('5. Verifying all coins have required fields...');
    let hasErrors = false;
    for (const coin of coins) {
      if (!coin.collector_type) {
        console.error(`   ❌ ${coin.symbol} is missing collector_type`);
        hasErrors = true;
      }
      if (!coin.confidence_level) {
        console.error(`   ❌ ${coin.symbol} is missing confidence_level`);
        hasErrors = true;
      }
    }
    
    if (!hasErrors) {
      console.log('   ✅ All coins have collector_type and confidence_level\n');
    } else {
      console.log('   ❌ Some coins are missing required fields\n');
    }

    await dbManager.close();

    console.log('==================================');
    console.log('✅ Migration test completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Migration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
