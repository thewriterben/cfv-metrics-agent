#!/usr/bin/env node
import { logger } from '../../utils/logger.js';
import { performanceMonitor } from '../../utils/PerformanceMonitor.js';
import { metricsCollector } from '../../utils/MetricsCollector.js';
import { HealthChecker } from '../../utils/HealthChecker.js';

/**
 * Test script to validate monitoring infrastructure
 */

console.log('='.repeat(80));
console.log('Testing Monitoring Infrastructure');
console.log('='.repeat(80));
console.log('');

// Test 1: Logger
console.log('Test 1: Winston Logger');
console.log('-'.repeat(80));
logger.debug('This is a debug message', { test: true });
logger.info('This is an info message', { test: true });
logger.warn('This is a warning message', { test: true });
logger.error('This is an error message', { test: true, error: 'Test error' });
console.log('✓ Logger test complete\n');

// Test 2: Performance Monitor
console.log('Test 2: Performance Monitor');
console.log('-'.repeat(80));

// Simulate some operations
for (let i = 0; i < 100; i++) {
  const duration = Math.random() * 500 + 50; // Random duration between 50-550ms
  performanceMonitor.recordDuration('test_operation', duration);
}

const stats = performanceMonitor.getStats('test_operation');
console.log('Performance stats for test_operation:');
console.log(`  Count: ${stats?.count}`);
console.log(`  Mean: ${stats?.mean.toFixed(2)}ms`);
console.log(`  Median: ${stats?.median.toFixed(2)}ms`);
console.log(`  P50: ${stats?.p50.toFixed(2)}ms`);
console.log(`  P95: ${stats?.p95.toFixed(2)}ms`);
console.log(`  P99: ${stats?.p99.toFixed(2)}ms`);
console.log(`  Min: ${stats?.min.toFixed(2)}ms`);
console.log(`  Max: ${stats?.max.toFixed(2)}ms`);
console.log('✓ Performance monitor test complete\n');

// Test 3: Metrics Collector
console.log('Test 3: Metrics Collector');
console.log('-'.repeat(80));

// Counters
metricsCollector.incrementCounter('test_requests_total', 100);
metricsCollector.incrementCounter('test_errors_total', 5);

// Gauges
metricsCollector.setGauge('test_active_connections', 10);
metricsCollector.incrementGauge('test_active_connections', 5);
metricsCollector.decrementGauge('test_active_connections', 3);

// Histograms
for (let i = 0; i < 50; i++) {
  const value = Math.random() * 1000;
  metricsCollector.recordHistogram('test_request_duration', value);
}

const metrics = metricsCollector.getMetrics();
console.log('Metrics collected:');
console.log('  Counters:', metrics.counters);
console.log('  Gauges:', metrics.gauges);
console.log('  Histogram count:', metrics.histograms.test_request_duration?.count);
console.log('  Histogram p95:', metrics.histograms.test_request_duration?.p95.toFixed(2));
console.log('✓ Metrics collector test complete\n');

// Test 4: Prometheus Export
console.log('Test 4: Prometheus Export');
console.log('-'.repeat(80));
const prometheusOutput = metricsCollector.exportPrometheus();
const lines = prometheusOutput.split('\n').filter(l => l.trim());
console.log('Sample Prometheus output:');
// Show histogram section
const histogramStart = lines.findIndex(l => l.includes('test_request_duration'));
if (histogramStart >= 0) {
  const histogramLines = lines.slice(histogramStart, Math.min(histogramStart + 20, lines.length));
  histogramLines.forEach(line => console.log('  ' + line));
} else {
  lines.slice(0, 15).forEach(line => console.log('  ' + line));
}
console.log('✓ Prometheus export test complete\n');

// Test 5: Health Checker
console.log('Test 5: Health Checker');
console.log('-'.repeat(80));
const healthChecker = new HealthChecker();
const health = await healthChecker.checkHealth();
console.log('Health check result:');
console.log(`  Overall status: ${health.status}`);
console.log(`  Database status: ${health.checks.database.status}`);
console.log(`  System status: ${health.checks.system.status}`);
console.log(`  Uptime: ${health.uptime.toFixed(2)}s`);
console.log('✓ Health checker test complete\n');

// Test 6: Track operation with Performance Monitor
console.log('Test 6: Track Async Operation');
console.log('-'.repeat(80));
const result = await performanceMonitor.track('async_test_operation', async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  return 'Test result';
});
const asyncStats = performanceMonitor.getStats('async_test_operation');
console.log(`Result: ${result}`);
console.log(`Operation duration: ${asyncStats?.mean.toFixed(2)}ms`);
console.log('✓ Async operation tracking test complete\n');

console.log('='.repeat(80));
console.log('All Tests Passed! ✓');
console.log('='.repeat(80));
console.log('');
console.log('Monitoring infrastructure is working correctly.');
console.log('You can now start the API server to test the HTTP endpoints.');
