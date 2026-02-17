/**
 * Metrics Collection System
 * 
 * Provides metrics collection with:
 * - Counters for counting events
 * - Gauges for current state values
 * - Histograms for distributions
 * - Prometheus format export
 */

export interface MetricsSummary {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  }>;
}

export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private maxHistogramSamples = 10000; // Keep last 10k samples

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  /**
   * Get counter value
   */
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Get gauge value
   */
  getGauge(name: string): number | undefined {
    return this.gauges.get(name);
  }

  /**
   * Increment a gauge
   */
  incrementGauge(name: string, value: number = 1): void {
    const current = this.gauges.get(name) || 0;
    this.gauges.set(name, current + value);
  }

  /**
   * Decrement a gauge
   */
  decrementGauge(name: string, value: number = 1): void {
    const current = this.gauges.get(name) || 0;
    this.gauges.set(name, current - value);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    
    const values = this.histograms.get(name)!;
    values.push(value);
    
    // Keep only recent samples to prevent memory growth
    if (values.length > this.maxHistogramSamples) {
      values.shift();
    }
  }

  /**
   * Get all metrics as a summary object
   */
  getMetrics(): MetricsSummary {
    const counters: Record<string, number> = {};
    for (const [name, value] of this.counters) {
      counters[name] = value;
    }

    const gauges: Record<string, number> = {};
    for (const [name, value] of this.gauges) {
      gauges[name] = value;
    }

    const histograms: Record<string, any> = {};
    for (const [name, values] of this.histograms) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((acc, val) => acc + val, 0);
        
        histograms[name] = {
          count: values.length,
          sum,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          mean: sum / values.length,
          p50: this.percentile(sorted, 0.50),
          p95: this.percentile(sorted, 0.95),
          p99: this.percentile(sorted, 0.99)
        };
      }
    }

    return { counters, gauges, histograms };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    let output = '';
    
    // Counters
    for (const [name, value] of this.counters) {
      output += `# HELP ${name} Total count\n`;
      output += `# TYPE ${name} counter\n`;
      output += `${name} ${value}\n\n`;
    }
    
    // Gauges
    for (const [name, value] of this.gauges) {
      output += `# HELP ${name} Current value\n`;
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${value}\n\n`;
    }
    
    // Histograms
    for (const [name, values] of this.histograms) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((acc, val) => acc + val, 0);
        
        output += `# HELP ${name} Histogram\n`;
        output += `# TYPE ${name} histogram\n`;
        output += `${name}_sum ${sum}\n`;
        output += `${name}_count ${values.length}\n`;
        output += `${name}_bucket{le="0.5"} ${this.percentile(sorted, 0.50)}\n`;
        output += `${name}_bucket{le="0.95"} ${this.percentile(sorted, 0.95)}\n`;
        output += `${name}_bucket{le="0.99"} ${this.percentile(sorted, 0.99)}\n`;
        output += `${name}_bucket{le="+Inf"} ${values.length}\n\n`;
      }
    }
    
    return output;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

export default metricsCollector;
