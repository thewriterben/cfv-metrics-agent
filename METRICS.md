# Metrics Reference

## Overview

This document describes all metrics tracked by the CFV Metrics Agent and their meanings.

## Metric Types

### Counters
Counters are cumulative values that only increase (or reset to zero on restart). Use counters for counting events.

### Gauges
Gauges are values that can go up and down. Use gauges for current state values.

### Histograms
Histograms track distributions of values. Use histograms for durations, sizes, etc.

## Available Metrics

### HTTP Metrics

#### http_requests_total
**Type:** Counter  
**Description:** Total number of HTTP requests received  
**Labels:** None  
**Use case:** Track overall API usage

#### http_requests_200
**Type:** Counter  
**Description:** Total number of successful requests (HTTP 200)  
**Labels:** None  
**Use case:** Track successful requests

#### http_requests_400
**Type:** Counter  
**Description:** Total number of client error requests (HTTP 4xx)  
**Labels:** None  
**Use case:** Track client errors (bad requests, not found, etc.)

#### http_requests_500
**Type:** Counter  
**Description:** Total number of server error requests (HTTP 5xx)  
**Labels:** None  
**Use case:** Track server errors, set up alerts

#### http_request_all
**Type:** Histogram  
**Description:** HTTP request duration in milliseconds for all requests  
**Metrics:**
- count: Total number of requests
- sum: Total duration of all requests
- p50: Median request duration
- p95: 95th percentile request duration
- p99: 99th percentile request duration

**Use case:** Analyze request latency, identify slow endpoints

### Connection Metrics

#### active_connections
**Type:** Gauge  
**Description:** Number of currently active HTTP connections  
**Use case:** Monitor concurrent load, identify traffic spikes

### API Call Metrics

#### api_calls_coins
**Type:** Counter  
**Description:** Total number of calls to GET /api/coins endpoint  
**Use case:** Track usage of coins listing API

#### api_calls_metrics
**Type:** Counter  
**Description:** Total number of calls to GET /api/metrics endpoint  
**Use case:** Track usage of metrics retrieval API

#### api_calls_collect
**Type:** Counter  
**Description:** Total number of calls to POST /api/collect endpoints  
**Use case:** Track usage of metrics collection API

### CFV Calculation Metrics

#### cfv_calculations_total
**Type:** Counter  
**Description:** Total number of CFV calculations attempted  
**Use case:** Track overall calculation volume

#### cfv_calculations_success
**Type:** Counter  
**Description:** Total number of successful CFV calculations  
**Use case:** Track calculation success rate

#### cfv_calculations_failed
**Type:** Counter  
**Description:** Total number of failed CFV calculations  
**Use case:** Monitor calculation failures, set up alerts

### Error Metrics

#### errors_total
**Type:** Counter  
**Description:** Total number of errors encountered  
**Use case:** Monitor overall error rate, set up alerts

## Performance Metrics

These are available via `/metrics/performance` endpoint but not exported to Prometheus by default.

### Operation-Specific Metrics

Each HTTP route is tracked separately with the following stats:
- **count**: Number of times the operation was performed
- **mean**: Average duration
- **median**: Median duration
- **p50**: 50th percentile
- **p95**: 95th percentile
- **p99**: 99th percentile
- **min**: Minimum duration
- **max**: Maximum duration

Example operations tracked:
- `GET /health`
- `GET /health/ready`
- `GET /api/coins`
- `GET /api/metrics`
- `POST /api/collect/:symbol`

## System Metrics

Available via `/metrics/system` endpoint.

### Memory Metrics
- **rss**: Resident Set Size (total memory allocated)
- **heapTotal**: Total heap size
- **heapUsed**: Used heap size
- **external**: Memory used by C++ objects bound to JS
- **arrayBuffers**: Memory allocated for ArrayBuffers

### CPU Metrics
- **user**: User CPU time used
- **system**: System CPU time used

### Process Metrics
- **uptime**: Process uptime in seconds
- **pid**: Process ID
- **version**: Node.js version
- **platform**: Operating system platform
- **arch**: CPU architecture

## Querying Metrics

### JSON Format
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
      "cfv_calculations_total": 456
    },
    "gauges": {
      "active_connections": 5
    },
    "histograms": {
      "http_request_all": {
        "count": 1234,
        "sum": 123456,
        "mean": 100,
        "p50": 85,
        "p95": 250,
        "p99": 500
      }
    }
  }
}
```

### Prometheus Format
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

# HELP http_request_all Histogram
# TYPE http_request_all histogram
http_request_all_sum 123456
http_request_all_count 1234
http_request_all_bucket{le="0.5"} 85
http_request_all_bucket{le="0.95"} 250
http_request_all_bucket{le="0.99"} 500
http_request_all_bucket{le="+Inf"} 1234
```

## Using Metrics

### Calculate Success Rate
```
(cfv_calculations_success / cfv_calculations_total) * 100
```

### Calculate Error Rate
```
(errors_total / http_requests_total) * 100
```

### Request Rate (requests per second)
```
rate(http_requests_total[5m])
```

### Average Response Time
```
rate(http_request_all_sum[5m]) / rate(http_request_all_count[5m])
```

### P95 Latency
```
histogram_quantile(0.95, http_request_all)
```

## Setting Up Alerts

### High Error Rate
Alert when error rate exceeds 5%:
```yaml
- alert: HighErrorRate
  expr: (rate(errors_total[5m]) / rate(http_requests_total[5m])) > 0.05
  for: 5m
  annotations:
    summary: "High error rate detected"
```

### Slow Requests
Alert when P95 latency exceeds 1 second:
```yaml
- alert: SlowRequests
  expr: histogram_quantile(0.95, http_request_all) > 1000
  for: 5m
  annotations:
    summary: "Slow requests detected (P95 > 1s)"
```

### High CFV Failure Rate
Alert when CFV calculation failure rate exceeds 10%:
```yaml
- alert: HighCFVFailureRate
  expr: (rate(cfv_calculations_failed[5m]) / rate(cfv_calculations_total[5m])) > 0.10
  for: 5m
  annotations:
    summary: "High CFV calculation failure rate"
```

## Grafana Dashboard Examples

### Request Rate Panel
```
Query: rate(http_requests_total[5m])
Visualization: Graph
Legend: Request Rate (req/s)
```

### Response Time Panel
```
Query 1: histogram_quantile(0.50, http_request_all) (P50)
Query 2: histogram_quantile(0.95, http_request_all) (P95)
Query 3: histogram_quantile(0.99, http_request_all) (P99)
Visualization: Graph
Legend: P50, P95, P99
```

### Active Connections Panel
```
Query: active_connections
Visualization: Stat
Unit: connections
```

### Error Rate Panel
```
Query: rate(errors_total[5m])
Visualization: Graph
Legend: Errors/sec
Thresholds: Warning at 1, Critical at 5
```

### CFV Success Rate Panel
```
Query: (rate(cfv_calculations_success[5m]) / rate(cfv_calculations_total[5m])) * 100
Visualization: Gauge
Unit: Percent
Min: 0, Max: 100
Thresholds: Red < 90, Yellow < 95, Green >= 95
```

## Custom Metrics

### Adding New Counters
```typescript
import { metricsCollector } from './utils/MetricsCollector.js';

// Increment counter
metricsCollector.incrementCounter('custom_operation_total');

// Increment by specific value
metricsCollector.incrementCounter('bytes_processed', 1024);
```

### Adding New Gauges
```typescript
// Set gauge value
metricsCollector.setGauge('queue_size', 42);

// Increment gauge
metricsCollector.incrementGauge('active_workers');

// Decrement gauge
metricsCollector.decrementGauge('active_workers');
```

### Adding New Histograms
```typescript
// Record histogram value (e.g., duration in ms)
metricsCollector.recordHistogram('database_query_duration', 150);
```

## Best Practices

1. **Use Counters for Events**: Use counters to track the number of times something happens
2. **Use Gauges for State**: Use gauges to track current values that go up and down
3. **Use Histograms for Distributions**: Use histograms to understand distributions of values
4. **Name Metrics Clearly**: Use descriptive names that explain what the metric measures
5. **Add Units to Names**: Include units in metric names (e.g., `_bytes`, `_seconds`, `_total`)
6. **Monitor Trends**: Watch metrics over time, not just current values
7. **Set Up Alerts**: Create alerts for critical metrics to catch issues early
8. **Review Regularly**: Regularly review metrics to identify patterns and issues

## Metrics Retention

- In-memory metrics are kept for the last 10,000 samples per metric
- Older samples are automatically discarded to prevent memory growth
- For long-term storage, export to Prometheus/Grafana
- Consider using time-series databases for historical analysis

## Performance Impact

Metrics collection has minimal performance overhead:
- **Memory**: ~10MB for typical workload (10k samples per metric)
- **CPU**: <1% overhead per request
- **Latency**: <0.1ms added to request processing

## Troubleshooting

### Metrics not appearing
- Check that the operation is being executed
- Verify metrics endpoint is accessible
- Check Prometheus scraping configuration

### Metrics resetting to zero
- Metrics reset on application restart (expected behavior)
- Use Prometheus for persistent storage
- Consider recording metrics to database for critical counters

### High memory usage
- Metrics are capped at 10k samples per metric
- Clear old metrics if needed: `metricsCollector.reset()`
- Review histogram usage (histograms use more memory than counters/gauges)
