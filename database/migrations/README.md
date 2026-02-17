# Database Migrations

This directory contains all database schema migrations for the CFV Metrics Agent.

## ⚠️ IMPORTANT: Data Safety

**Migrations NEVER drop tables automatically.** All migrations are designed to:
- Preserve existing data in `metrics`, `metric_history`, `collection_runs`, and `coins` tables
- Use `CREATE TABLE IF NOT EXISTS` to safely create new tables
- Use `ALTER TABLE` for schema changes (in future migrations)
- Be idempotent (safe to run multiple times)

## Migration System

The application uses a custom migration system that:
1. Tracks applied migrations in the `schema_version` table
2. Only runs migrations that haven't been applied yet
3. Runs migrations in order (by version number)
4. Runs each migration in a transaction for safety

## Migration File Format

Migration files must follow this naming convention:
```
NNN_descriptive_name.sql
```

Examples:
- `001_initial_schema.sql` - Creates base tables
- `002_add_confidence_index.sql` - Adds an index to improve queries
- `003_add_metadata_column.sql` - Adds a new column

## Creating a New Migration

1. Create a new SQL file with the next version number
2. Use `CREATE TABLE IF NOT EXISTS` for new tables
3. Use `ALTER TABLE` for modifying existing tables
4. Add appropriate indexes and constraints
5. Test the migration on a copy of production data

Example migration:
```sql
-- Migration 002: Add index for better query performance
-- This migration is safe to run multiple times (idempotent)

CREATE INDEX IF NOT EXISTS idx_metrics_confidence 
ON metrics(confidence_level);
```

## Running Migrations

Migrations run automatically on application startup via `initializeDatabase()`.

You can also run migrations manually:
```typescript
import { MigrationManager } from './src/database/MigrationManager.js';

const manager = new MigrationManager(config);
await manager.runMigrations();
```

## Current Schema Version

To check the current schema version:
```typescript
const version = await manager.getCurrentVersion();
console.log(`Current schema version: ${version}`);
```

## Migration History

| Version | Name | Description |
|---------|------|-------------|
| 001 | initial_schema | Creates base tables (coins, metrics, metric_history, collection_runs) |

## Best Practices

1. **Never drop tables with user data** - Use ALTER TABLE to modify schema
2. **Always test migrations** - Test on a copy of production data first
3. **Make migrations idempotent** - Use IF NOT EXISTS, IF EXISTS clauses
4. **Use transactions** - The migration system wraps each migration in a transaction
5. **Document changes** - Add comments explaining what and why
6. **Version incrementally** - Each migration should be a small, focused change

## Troubleshooting

If a migration fails:
1. Check the error message in the logs
2. Verify the SQL syntax
3. Check database permissions
4. Look at the `schema_version` table to see which migrations have been applied

To manually rollback (use with extreme caution):
```sql
-- Only do this if you understand the implications
DELETE FROM schema_version WHERE version = X;
-- Then manually undo the schema changes made by that migration
```
