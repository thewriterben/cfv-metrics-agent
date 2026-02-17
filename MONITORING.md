# Monitoring and Observability Guide

## Overview

The CFV Metrics Agent includes comprehensive monitoring and observability features to help you track system health, performance, and reliability.

## Features

### 1. Structured Logging
- **Winston-based logging** with multiple log levels
- **JSON format** for machine parsing
- **Daily log rotation** to manage disk space
- **Separate error logs** for critical issues
- **Colorized console output** for development

### 2. Performance Monitoring
- **Request duration tracking** with percentile metrics (p50, p95, p99)
- **Slow request detection** (>1s automatically logged)
- **Operation-level tracking** for all HTTP routes
- **Custom operation tracking** via the PerformanceMonitor API

### 3. Health Checks
- **Kubernetes-compatible probes** (liveness and readiness)
- **Component-level health** (database, system resources)
- **Response time tracking** for all health checks
- **Detailed health reports** with error context

### 4. Metrics Collection
- **Counters** for counting events (requests, errors, calculations)
- **Gauges** for current state values (active connections, memory)
- **Histograms** for distributions (request duration)
- **Prometheus export** for Grafana integration

### 5. Error Tracking
- **Sentry integration** for centralized error tracking (optional)
- **Automatic error capture** for unhandled exceptions
- **Context enrichment** with request details
- **Release tracking** for version-based error analysis

## Endpoints

### Health Checks

#### GET /health/live
Kubernetes liveness probe - checks if the server is running.

```bash
curl http://localhost:3000/health/live
```

Response:
```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /health/ready
Kubernetes readiness probe - checks if the server is ready to serve traffic.

```bash
curl http://localhost:3000/health/ready
```

Response (200 if healthy, 503 if not):
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "message": "Database connection OK",
      "lastCheck": "2024-01-15T10:30:00.000Z"
    },
    "system": {
      "status": "healthy",
      "message": "System resources OK",
      "lastCheck": "2024-01-15T10:30:00.000Z"
    }
  },
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### GET /health/detailed
Detailed health status with full diagnostic information.

```bash
curl http://localhost:3000/health/detailed
```

### Metrics

#### GET /metrics
All metrics in JSON format.

```bash
curl http://localhost:3000/metrics
```

Response:
```json
{
  "success": true,
  "data": {
    "counters": {
      "http_requests_total": 1234,
      "http_requests_200": 1150,
      "http_requests_404": 50,
      "http_requests_500": 34,
      "cfv_calculations_total": 456,
      "cfv_calculations_success": 450,
      "cfv_calculations_failed": 6
    },
    "gauges": {
      "active_connections": 5
    },
    "histograms": {
      "http_request_all": {
        "count": 1234,
        "sum": 123456,
        "min": 5,
        "max": 2500,
        "mean": 100,
        "p50": 85,
        "p95": 250,
        "p99": 500
      }
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /metrics/prometheus
Metrics in Prometheus text format for scraping.

```bash
curl http://localhost:3000/metrics/prometheus
```

Response:
```
# HELP http_requests_total Total count
# TYPE http_requests_total counter
http_requests_total 1234

# HELP active_connections Current value
# TYPE active_connections gauge
active_connections 5
```

#### GET /metrics/performance
Performance statistics for all tracked operations.

```bash
curl http://localhost:3000/metrics/performance
```

Response:
```json
{
  "success": true,
  "data": {
    "GET /health": {
      "count": 100,
      "mean": 15.5,
      "median": 12,
      "p50": 12,
      "p95": 25,
      "p99": 40,
      "min": 8,
      "max": 45
    },
    "GET /api/metrics": {
      "count": 50,
      "mean": 120.3,
      "median": 100,
      "p50": 100,
      "p95": 250,
      "p99": 400,
      "min": 50,
      "max": 500
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /metrics/system
System resource metrics (CPU, memory, process info).

```bash
curl http://localhost:3000/metrics/system
```

#### GET /dashboard
Complete dashboard data (health + metrics + performance + system).

```bash
curl http://localhost:3000/dashboard
```

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info              # debug | info | warn | error
LOG_DIR=logs                # Directory for log files

# Sentry (optional)
SENTRY_DSN=https://...      # Sentry DSN for error tracking

# Application
NODE_ENV=production         # development | production
```

### Log Levels

- **debug**: Detailed information for debugging
- **info**: General informational messages (default)
- **warn**: Warning messages (non-critical issues)
- **error**: Error messages (critical issues)

## Integration Examples

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cfv-metrics-agent
spec:
  template:
    spec:
      containers:
      - name: cfv-metrics-agent
        image: cfv-metrics-agent:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Prometheus Scraping

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'cfv-metrics-agent'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics/prometheus'
    scrape_interval: 15s
```

### Grafana Dashboard

1. Add Prometheus as a data source
2. Create a new dashboard
3. Add panels querying metrics like:
   - `rate(http_requests_total[5m])` - Request rate
   - `histogram_quantile(0.95, http_request_duration_ms)` - P95 latency
   - `active_connections` - Active connections

## Using the Logger in Code

```typescript
import { logger } from './utils/logger.js';

// Info logging
logger.info('User logged in', { userId: '123', email: 'user@example.com' });

// Warning
logger.warn('High memory usage detected', { heapUsed: 850, heapTotal: 1024 });

// Error
logger.error('Database connection failed', { 
  error: error.message,
  stack: error.stack 
});

// Debug (only shown when LOG_LEVEL=debug)
logger.debug('Processing request', { requestId, data });
```

## Using the PerformanceMonitor

```typescript
import { performanceMonitor } from './utils/PerformanceMonitor.js';

// Track an operation
await performanceMonitor.track('database_query', async () => {
  return await db.query('SELECT * FROM users');
});

// Get stats for an operation
const stats = performanceMonitor.getStats('database_query');
console.log(`P95 latency: ${stats.p95}ms`);
```

## Using the MetricsCollector

```typescript
import { metricsCollector } from './utils/MetricsCollector.js';

// Increment a counter
metricsCollector.incrementCounter('user_logins');

// Set a gauge
metricsCollector.setGauge('active_users', 42);

// Record a histogram value
metricsCollector.recordHistogram('request_size_bytes', 1024);
```

## Log Files

Logs are stored in the `logs/` directory with daily rotation:

- `logs/combined-YYYY-MM-DD.log` - All logs
- `logs/error-YYYY-MM-DD.log` - Error logs only
- `logs/exceptions-YYYY-MM-DD.log` - Uncaught exceptions
- `logs/rejections-YYYY-MM-DD.log` - Unhandled promise rejections

Old log files are automatically compressed and deleted after retention period.

## Performance Impact

The monitoring system has minimal overhead:
- **CPU**: <2% increase under normal load
- **Memory**: <10MB for metrics storage
- **Latency**: <1ms per request

## Troubleshooting

### Logs not appearing
- Check `LOG_LEVEL` environment variable
- Ensure `logs/` directory is writable
- Check for disk space issues

### High memory usage
- Metrics are capped at 10,000 samples per operation
- Log files are rotated to prevent disk filling
- Consider reducing retention period

### Sentry not working
- Verify `SENTRY_DSN` is set correctly
- Check network connectivity to Sentry
- Review Sentry logs for errors

## Best Practices

1. **Use appropriate log levels**: Debug for development, Info for production
2. **Include context**: Always add relevant metadata to logs
3. **Monitor trends**: Watch P95/P99 latencies over time, not just averages
4. **Set up alerts**: Use Prometheus AlertManager for critical metrics
5. **Review error tracking**: Regularly check Sentry for new errors
6. **Test health checks**: Ensure liveness and readiness work correctly

## Security Considerations

- Log files may contain sensitive data - ensure proper access controls
- Sentry captures error context - review data before sending
- Metrics endpoints are public - consider adding authentication for production
- Use HTTPS in production to encrypt metrics data in transit
