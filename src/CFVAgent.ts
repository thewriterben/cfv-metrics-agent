import { CopilotClient } from '@github/copilot-sdk';
import { CoinGeckoCollector } from './collectors/CoinGeckoCollector';
import { EtherscanCollector } from './collectors/EtherscanCollector';
import { GitHubCollector } from './collectors/GitHubCollector';
import { ValidationEngine } from './validators/ValidationEngine';
import { CFVCalculator } from './utils/CFVCalculator';
import { CacheManager } from './utils/CacheManager';
import type {
  MetricCollector,
  MetricType,
  MetricResult,
  CFVMetrics,
  CFVResult,
  AgentConfig,
} from './types';

export class CFVAgent {
  private collectors: MetricCollector[];
  private cache: CacheManager;
  private config: AgentConfig;
  private copilot?: CopilotClient;
  
  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      coinGeckoApiKey: config.coinGeckoApiKey || process.env.COINGECKO_API_KEY,
      etherscanApiKey: config.etherscanApiKey || process.env.ETHERSCAN_API_KEY,
      githubToken: config.githubToken || process.env.GITHUB_TOKEN,
      redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      cacheTTL: config.cacheTTL || {
        short: 300,
        medium: 3600,
        long: 86400,
        veryLong: 604800,
      },
      rateLimits: config.rateLimits || {
        coinGecko: 30,
        etherscan: 5,
        github: 5000,
      },
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      collectorTimeout: config.collectorTimeout || 30000,
    };
    
    // Initialize collectors
    this.collectors = [
      new CoinGeckoCollector(this.config.coinGeckoApiKey),
      new EtherscanCollector(
        this.config.etherscanApiKey,
        undefined,
        undefined,
        this.config.coinGeckoApiKey
      ),
      new GitHubCollector(this.config.githubToken),
    ];
    
    // Initialize cache
    this.cache = new CacheManager(this.config.redisUrl, this.config.cacheTTL);
  }
  
  /**
   * Initialize Copilot SDK for AI-powered enhancements
   */
  async initializeCopilot(): Promise<void> {
    this.copilot = new CopilotClient({
      logLevel: 'info',
    });
  }
  
  /**
   * Calculate CFV for a cryptocurrency
   */
  async calculateCFV(coinSymbol: string): Promise<CFVResult> {
    console.log(`\n🔍 Calculating CFV for ${coinSymbol.toUpperCase()}...`);
    
    // Check cache first
    const cachedResult = await this.cache.getCFVResult(coinSymbol);
    if (cachedResult) {
      const age = Date.now() - cachedResult.timestamp.getTime();
      if (age < this.config.cacheTTL.medium * 1000) {
        console.log(`✅ Using cached result (${Math.round(age / 1000)}s old)`);
        return cachedResult;
      }
    }
    
    // Collect all metrics
    const metrics = await this.collectAllMetrics(coinSymbol);
    
    // Calculate CFV
    const calculation = CFVCalculator.calculate(metrics);
    
    // Determine overall confidence
    const confidences = Object.values(metrics).map(m => m.confidence);
    const highCount = confidences.filter(c => c === 'HIGH').length;
    const mediumCount = confidences.filter(c => c === 'MEDIUM').length;
    
    let overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
    if (highCount >= 4) overallConfidence = 'HIGH';
    else if (highCount + mediumCount >= 4) overallConfidence = 'MEDIUM';
    else overallConfidence = 'LOW';
    
    // Create result
    const result: CFVResult = {
      coinSymbol: coinSymbol.toUpperCase(),
      coinName: coinSymbol, // TODO: Get actual name from CoinGecko
      metrics,
      calculation,
      timestamp: new Date(),
      overallConfidence,
    };
    
    // Cache result
    await this.cache.setCFVResult(result, this.config.cacheTTL.medium);
    
    console.log(`✅ CFV calculation complete!`);
    
    return result;
  }
  
  /**
   * Collect all required metrics for CFV calculation
   */
  private async collectAllMetrics(coinSymbol: string): Promise<CFVMetrics> {
    const metricsToCollect: MetricType[] = [
      'communitySize',
      'annualTransactionValue',
      'annualTransactions',
      'developers',
      'price',
      'circulatingSupply',
    ];
    
    const results: Partial<CFVMetrics> = {};
    
    // Collect each metric in parallel
    await Promise.all(
      metricsToCollect.map(async (metric) => {
        try {
          const result = await this.collectMetric(coinSymbol, metric);
          results[metric as keyof CFVMetrics] = result;
        } catch (error) {
          console.error(`❌ Failed to collect ${metric}:`, error);
          // Use fallback value
          results[metric as keyof CFVMetrics] = {
            value: 0,
            confidence: 'LOW',
            source: 'fallback',
            timestamp: new Date(),
            metadata: { error: String(error) },
          };
        }
      })
    );
    
    return results as CFVMetrics;
  }
  
  /**
   * Collect a specific metric from multiple sources
   */
  private async collectMetric(coinSymbol: string, metric: MetricType): Promise<MetricResult> {
    console.log(`  📊 Collecting ${metric}...`);
    
    // Check cache first
    const cached = await this.cache.getMetric(coinSymbol, metric);
    if (cached) {
      const age = Date.now() - cached.timestamp.getTime();
      if (age < this.getTTLForMetric(metric) * 1000) {
        console.log(`    ✓ ${metric}: ${cached.value} (cached, ${cached.confidence})`);
        return cached;
      }
    }
    
    // Collect from multiple sources
    const results: MetricResult[] = [];
    
    for (const collector of this.collectors) {
      try {
        // Check if collector supports this coin
        const supports = await collector.supports(coinSymbol);
        if (!supports) continue;
        
        // Collect metric with timeout
        const result = await this.withTimeout(
          collector.collect(coinSymbol, metric),
          this.config.collectorTimeout
        );
        
        results.push(result);
        console.log(`    ✓ ${collector.name}: ${result.value} (${result.confidence})`);
      } catch (error) {
        // Collector failed, continue with others
        console.log(`    ✗ ${collector.name}: ${error}`);
      }
    }
    
    // Validate and aggregate results
    const validation = ValidationEngine.validateMetric(results);
    
    if (!validation.isValid || !validation.adjustedValue) {
      throw new Error(`Failed to collect valid data for ${metric}`);
    }
    
    // Create final result
    const finalResult: MetricResult = {
      value: validation.adjustedValue,
      confidence: validation.confidence,
      source: 'aggregated',
      timestamp: new Date(),
      metadata: {
        sources: results.map(r => r.source),
        rawValues: results.map(r => r.value),
        issues: validation.issues,
      },
    };
    
    // Cache result
    const ttl = this.getTTLForMetric(metric);
    await this.cache.setMetric(coinSymbol, metric, finalResult, this.getTTLCategory(ttl));
    
    console.log(`    → Final: ${finalResult.value} (${finalResult.confidence})`);
    
    return finalResult;
  }
  
  /**
   * Get TTL for specific metric type
   */
  private getTTLForMetric(metric: MetricType): number {
    switch (metric) {
      case 'price':
        return this.config.cacheTTL.short; // 5 minutes
      case 'annualTransactionValue':
      case 'annualTransactions':
        return this.config.cacheTTL.medium; // 1 hour
      case 'communitySize':
      case 'developers':
        return this.config.cacheTTL.long; // 24 hours
      case 'circulatingSupply':
      case 'marketCap':
        return this.config.cacheTTL.medium; // 1 hour
      default:
        return this.config.cacheTTL.medium;
    }
  }
  
  /**
   * Get TTL category from seconds
   */
  private getTTLCategory(seconds: number): 'short' | 'medium' | 'long' | 'veryLong' {
    if (seconds <= this.config.cacheTTL.short) return 'short';
    if (seconds <= this.config.cacheTTL.medium) return 'medium';
    if (seconds <= this.config.cacheTTL.long) return 'long';
    return 'veryLong';
  }
  
  /**
   * Execute promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);
  }
  
  /**
   * Format CFV result for display
   */
  formatResult(result: CFVResult): string {
    const { calculation, metrics } = result;
    
    let output = `\n${'='.repeat(60)}\n`;
    output += `CFV ANALYSIS: ${result.coinSymbol}\n`;
    output += `${'='.repeat(60)}\n\n`;
    
    output += `📊 METRICS (Confidence: ${result.overallConfidence})\n`;
    output += `${'─'.repeat(60)}\n`;
    output += `  Community Size:        ${CFVCalculator.formatNumber(metrics.communitySize.value)} (${metrics.communitySize.confidence})\n`;
    output += `  Annual TX Value:       ${CFVCalculator.formatCurrency(metrics.annualTransactionValue.value)} (${metrics.annualTransactionValue.confidence})\n`;
    output += `  Annual TX Count:       ${CFVCalculator.formatNumber(metrics.annualTransactions.value)} (${metrics.annualTransactions.confidence})\n`;
    output += `  Developers:            ${metrics.developers.value} (${metrics.developers.confidence})\n`;
    output += `  Current Price:         ${CFVCalculator.formatCurrency(metrics.price.value)}\n`;
    output += `  Circulating Supply:    ${CFVCalculator.formatNumber(metrics.circulatingSupply.value)}\n\n`;
    
    output += `💰 VALUATION\n`;
    output += `${'─'.repeat(60)}\n`;
    output += `  Network Power Score:   ${calculation.networkPowerScore.toExponential(2)}\n`;
    output += `  Fair Value:            ${CFVCalculator.formatCurrency(calculation.fairValue)}\n`;
    output += `  Current Price:         ${CFVCalculator.formatCurrency(calculation.currentPrice)}\n`;
    output += `  Price Multiplier:      ${calculation.priceMultiplier.toFixed(2)}x\n\n`;
    
    output += `  Fair Market Cap:       ${CFVCalculator.formatCurrency(calculation.fairMarketCap)}\n`;
    output += `  Current Market Cap:    ${CFVCalculator.formatCurrency(calculation.currentMarketCap)}\n\n`;
    
    const statusEmoji = calculation.valuationStatus === 'undervalued' ? '📉' : 
                        calculation.valuationStatus === 'overvalued' ? '📈' : '⚖️';
    output += `  Status:                ${statusEmoji} ${calculation.valuationStatus.toUpperCase()}\n`;
    output += `  Valuation:             ${calculation.valuationPercent > 0 ? '+' : ''}${calculation.valuationPercent.toFixed(1)}%\n\n`;
    
    output += `📝 ANALYSIS\n`;
    output += `${'─'.repeat(60)}\n`;
    output += `  ${CFVCalculator.getValuationDescription(calculation.valuationStatus, calculation.valuationPercent)}\n\n`;
    
    output += `${'='.repeat(60)}\n`;
    
    return output;
  }
  
  /**
   * Close agent and cleanup resources
   */
  async close(): Promise<void> {
    await this.cache.close();
  }
}
