# Logging Conventions and Best Practices

## Overview

This document describes logging conventions and best practices for the CFV Metrics Agent.

## Log Levels

### DEBUG
**When to use:** Detailed diagnostic information useful during development and troubleshooting.

**Examples:**
```typescript
logger.debug('Processing coin data', { 
  symbol: 'BTC', 
  dataPoints: 1000,
  processingTime: 150 
});

logger.debug('Cache lookup', { key: 'metrics:BTC', hit: true });
```

**Note:** Debug logs should never be used in production by default. Enable only when troubleshooting specific issues.

### INFO
**When to use:** General informational messages about normal application operation.

**Examples:**
```typescript
logger.info('Application started', { 
  port: 3000, 
  environment: 'production' 
});

logger.info('User logged in', { 
  userId: '123', 
  ip: '192.168.1.1' 
});

logger.info('Metrics collected successfully', { 
  symbol: 'ETH', 
  duration: 250 
});
```

### WARN
**When to use:** Something unexpected happened, but the application can continue. Potential issues that don't immediately affect operation.

**Examples:**
```typescript
logger.warn('High memory usage detected', { 
  heapUsed: 850, 
  heapTotal: 1024,
  percentage: 83 
});

logger.warn('Slow database query', { 
  query: 'SELECT * FROM metrics', 
  duration: 2500 
});

logger.warn('Rate limit approaching', { 
  current: 95, 
  limit: 100 
});
```

### ERROR
**When to use:** An error occurred that prevented an operation from completing. The application can recover but the specific operation failed.

**Examples:**
```typescript
logger.error('Database connection failed', { 
  error: error.message,
  stack: error.stack,
  host: 'db.example.com'
});

logger.error('API call failed', { 
  api: 'CoinGecko',
  endpoint: '/coins/bitcoin',
  statusCode: 503,
  error: error.message
});
```

## Log Structure

All logs use a structured JSON format with the following standard fields:

```typescript
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "info",
  "message": "Human-readable message",
  "service": "cfv-metrics-agent",
  // ... additional context fields
}
```

### Standard Context Fields

Always include these fields when applicable:

- **requestId**: Unique identifier for request tracing
- **userId**: User identifier (if applicable)
- **symbol**: Cryptocurrency symbol (BTC, ETH, etc.)
- **duration**: Operation duration in milliseconds
- **error**: Error message (for errors)
- **stack**: Error stack trace (for errors)

## Best Practices

### 1. Include Context
Always add relevant context to logs. Context helps understand what happened and why.

**❌ Bad:**
```typescript
logger.error('Failed to save');
```

**✅ Good:**
```typescript
logger.error('Failed to save metrics', {
  symbol: 'BTC',
  metricsCount: 5,
  error: error.message,
  stack: error.stack
});
```

### 2. Use Meaningful Messages
Write clear, descriptive messages that explain what happened.

**❌ Bad:**
```typescript
logger.info('Done');
```

**✅ Good:**
```typescript
logger.info('Metrics collection completed', {
  symbol: 'ETH',
  metricsCollected: 10,
  duration: 1250
});
```

### 3. Don't Log Sensitive Data
Never log passwords, API keys, or other sensitive information.

**❌ Bad:**
```typescript
logger.info('User credentials', {
  username: 'john',
  password: 'secret123'  // NEVER DO THIS
});
```

**✅ Good:**
```typescript
logger.info('User authenticated', {
  userId: '123',
  username: 'john'
});
```

### 4. Log at Appropriate Levels
Choose the right log level for the situation.

- Use INFO for normal operations
- Use WARN for issues that don't prevent operation
- Use ERROR for failures that affect functionality
- Use DEBUG for detailed diagnostic information

### 5. Include Performance Metrics
For operations that may be slow, include duration.

```typescript
const start = Date.now();
// ... operation ...
logger.info('Database query completed', {
  query: 'getLatestMetrics',
  duration: Date.now() - start,
  recordsReturned: results.length
});
```

### 6. Use Consistent Field Names
Use the same field names across the application:
- `duration` (not `time`, `elapsed`, etc.)
- `error` (not `err`, `exception`, etc.)
- `userId` (not `user_id`, `uid`, etc.)

### 7. Log Request/Response Boundaries
Always log when requests start and complete.

```typescript
logger.info('Incoming request', {
  requestId,
  method: 'GET',
  path: '/api/metrics/BTC',
  ip: req.ip
});

// ... handle request ...

logger.info('Request completed', {
  requestId,
  statusCode: 200,
  duration: 150
});
```

## Common Logging Patterns

### API Calls
```typescript
logger.info('Making API call', {
  api: 'CoinGecko',
  endpoint: '/coins/bitcoin',
  method: 'GET'
});

try {
  const response = await axios.get(url);
  logger.info('API call succeeded', {
    api: 'CoinGecko',
    statusCode: response.status,
    duration: Date.now() - start
  });
} catch (error) {
  logger.error('API call failed', {
    api: 'CoinGecko',
    error: error.message,
    statusCode: error.response?.status
  });
}
```

### Database Operations
```typescript
logger.debug('Executing database query', {
  operation: 'getLatestMetrics',
  symbol: 'BTC'
});

try {
  const results = await db.query(sql);
  logger.info('Database query completed', {
    operation: 'getLatestMetrics',
    recordsReturned: results.length,
    duration: Date.now() - start
  });
} catch (error) {
  logger.error('Database query failed', {
    operation: 'getLatestMetrics',
    error: error.message,
    stack: error.stack
  });
}
```

### Background Jobs
```typescript
logger.info('Starting background job', {
  job: 'metrics-collection',
  coinsToProcess: coins.length
});

let processed = 0;
let failed = 0;

for (const coin of coins) {
  try {
    await collectMetrics(coin);
    processed++;
  } catch (error) {
    logger.error('Failed to collect metrics', {
      coin: coin.symbol,
      error: error.message
    });
    failed++;
  }
}

logger.info('Background job completed', {
  job: 'metrics-collection',
  processed,
  failed,
  duration: Date.now() - start
});
```

## Log Rotation

Logs are automatically rotated to prevent disk space issues:

- **Rotation**: Daily at midnight
- **Compression**: Old logs are gzipped
- **Retention**: 
  - Combined logs: 10 days
  - Error logs: 5 days
  - Exception/rejection logs: 5 days
- **Max File Size**: 10MB per file

## Searching Logs

### Using grep (text files)
```bash
# Find all errors
grep '"level":"error"' logs/combined-2024-01-15.log

# Find logs for specific symbol
grep '"symbol":"BTC"' logs/combined-2024-01-15.log

# Find slow requests
grep '"duration":[0-9]\{4,\}' logs/combined-2024-01-15.log
```

### Using jq (JSON parsing)
```bash
# Get all error messages
cat logs/combined-2024-01-15.log | jq 'select(.level == "error") | .message'

# Get average duration
cat logs/combined-2024-01-15.log | jq -s 'map(select(.duration)) | map(.duration) | add/length'

# Count errors by type
cat logs/error-2024-01-15.log | jq -s 'group_by(.message) | map({message: .[0].message, count: length})'
```

### Real-time Monitoring
```bash
# Tail all logs
tail -f logs/combined-*.log

# Tail only errors
tail -f logs/error-*.log

# Filter for specific symbol
tail -f logs/combined-*.log | grep '"symbol":"BTC"'
```

## Log Aggregation

For production deployments, consider using log aggregation tools:

### ELK Stack (Elasticsearch, Logstash, Kibana)
- Centralized log storage
- Powerful search capabilities
- Visualization and dashboards
- Alerting

### Grafana Loki
- Lightweight alternative to ELK
- Integrates well with Grafana
- Label-based indexing
- Lower resource requirements

### Cloud Options
- AWS CloudWatch Logs
- Google Cloud Logging
- Azure Monitor Logs

## Performance Considerations

Logging has minimal performance impact:
- Async logging (non-blocking)
- File writes are buffered
- Console logging can be disabled in production

To minimize performance impact:
1. Avoid logging in tight loops
2. Use DEBUG level for verbose logs
3. Set appropriate log levels per environment
4. Consider sampling for high-volume logs

## Environment-Specific Configuration

### Development
```bash
LOG_LEVEL=debug
LOG_DIR=logs
```
- Verbose logging for debugging
- Console output with colors
- All log levels enabled

### Production
```bash
LOG_LEVEL=info
LOG_DIR=/var/log/cfv-metrics-agent
```
- Only INFO, WARN, ERROR levels
- Console logging minimal
- Focus on actionable logs
- Log rotation enabled

### Testing
```bash
LOG_LEVEL=warn
LOG_DIR=test-logs
```
- Only warnings and errors
- Reduced noise in test output
- Easy to spot test failures

## Troubleshooting

### Logs not appearing
1. Check LOG_LEVEL is set correctly
2. Verify logs directory exists and is writable
3. Check disk space
4. Review file permissions

### Log files growing too large
1. Verify rotation is working
2. Reduce log level
3. Decrease retention period
4. Add log sampling for high-volume operations

### Can't find specific logs
1. Use structured logging fields
2. Include requestId for request tracing
3. Add consistent identifiers (userId, symbol, etc.)
4. Use log aggregation tools for complex searches
