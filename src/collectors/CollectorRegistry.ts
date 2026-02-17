/**
 * Collector Registry
 * 
 * Central registry for all data collectors in the system.
 * Provides unified access to collectors with automatic fallback and routing.
 */

import type { 
  IDataCollector, 
  CollectorRegistration, 
  CollectorMetadata 
} from '../types/collectors.js';
import type { MetricType, MetricResult, CollectorHealth } from '../types/index.js';

export class CollectorRegistry {
  private collectors: Map<string, CollectorRegistration> = new Map();
  private collectorsByType: Map<string, IDataCollector[]> = new Map();
  
  /**
   * Register a collector
   */
  register(collector: IDataCollector, metadata: CollectorMetadata): void {
    const registration: CollectorRegistration = {
      collector,
      metadata
    };
    
    this.collectors.set(metadata.name, registration);
    
    // Group by type for efficient lookup
    const typeCollectors = this.collectorsByType.get(metadata.type) || [];
    typeCollectors.push(collector);
    this.collectorsByType.set(metadata.type, typeCollectors);
  }
  
  /**
   * Unregister a collector
   */
  unregister(name: string): boolean {
    const registration = this.collectors.get(name);
    if (!registration) return false;
    
    this.collectors.delete(name);
    
    // Remove from type grouping
    const typeCollectors = this.collectorsByType.get(registration.metadata.type) || [];
    const filtered = typeCollectors.filter(c => c.name !== name);
    this.collectorsByType.set(registration.metadata.type, filtered);
    
    return true;
  }
  
  /**
   * Get collector by name
   */
  getCollector(name: string): IDataCollector | undefined {
    return this.collectors.get(name)?.collector;
  }
  
  /**
   * Get all collectors
   */
  getAllCollectors(): IDataCollector[] {
    return Array.from(this.collectors.values()).map(reg => reg.collector);
  }
  
  /**
   * Get collectors by type
   */
  getCollectorsByType(type: 'blockchain' | 'api' | 'mcp'): IDataCollector[] {
    return this.collectorsByType.get(type) || [];
  }
  
  /**
   * Get collectors that support a specific coin
   */
  async getCollectorsForCoin(coin: string): Promise<IDataCollector[]> {
    const supported: IDataCollector[] = [];
    
    for (const collector of this.getAllCollectors()) {
      try {
        const supports = await collector.supports(coin);
        if (supports) {
          supported.push(collector);
        }
      } catch (error) {
        // Skip collectors that error during support check
        continue;
      }
    }
    
    // Sort by priority
    return supported.sort((a, b) => {
      const priorityOrder = { primary: 0, secondary: 1, fallback: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  /**
   * Get collectors that support a specific metric
   */
  getCollectorsForMetric(metric: MetricType): IDataCollector[] {
    const result: IDataCollector[] = [];
    
    for (const registration of this.collectors.values()) {
      const { metadata, collector } = registration;
      
      // If supportedMetrics is not specified, assume all metrics are supported
      if (!metadata.supportedMetrics || metadata.supportedMetrics.includes(metric)) {
        result.push(collector);
      }
    }
    
    return result;
  }
  
  /**
   * Collect metric with automatic fallback
   * Tries collectors in priority order until one succeeds
   */
  async collectMetric(coin: string, metric: MetricType): Promise<MetricResult> {
    const collectors = await this.getCollectorsForCoin(coin);
    const errors: Error[] = [];
    
    for (const collector of collectors) {
      try {
        const result = await collector.collect(coin, metric);
        return result;
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        continue;
      }
    }
    
    throw new Error(
      `Failed to collect ${metric} for ${coin} from all collectors. ` +
      `Errors: ${errors.map(e => e.message).join(', ')}`
    );
  }
  
  /**
   * Get health status of all collectors
   */
  async getHealthStatus(): Promise<Map<string, CollectorHealth>> {
    const healthMap = new Map<string, CollectorHealth>();
    
    for (const registration of this.collectors.values()) {
      try {
        const health = await registration.collector.getHealth();
        healthMap.set(registration.metadata.name, health);
      } catch (error) {
        healthMap.set(registration.metadata.name, {
          status: 'down',
          lastCheck: new Date(),
          errorRate: 1.0,
          responseTime: 0
        });
      }
    }
    
    return healthMap;
  }
  
  /**
   * Get registry statistics
   */
  getStats(): {
    totalCollectors: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    
    for (const registration of this.collectors.values()) {
      const { metadata, collector } = registration;
      
      byType[metadata.type] = (byType[metadata.type] || 0) + 1;
      byPriority[collector.priority] = (byPriority[collector.priority] || 0) + 1;
    }
    
    return {
      totalCollectors: this.collectors.size,
      byType,
      byPriority
    };
  }
}

/**
 * Global registry instance
 */
export const collectorRegistry = new CollectorRegistry();
