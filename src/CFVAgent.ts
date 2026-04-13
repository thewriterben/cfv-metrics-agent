import { CopilotClient } from '@github/copilot-sdk';
import { logger } from './utils/logger.js';
import { CoinGeckoCollector } from './collectors/CoinGeckoCollector';
import { EtherscanCollector } from './collectors/EtherscanCollector';
import { GitHubCollector } from './collectors/GitHubCollector';
import { BlockchairCollector } from './collectors/BlockchairCollector';
import { CryptoCompareCollector } from './collectors/CryptoCompareCollector';
import { RedditCollector } from './collectors/RedditCollector';
import { TwitterCollector } from './collectors/TwitterCollector';
import { ValidationEngine } from './validators/ValidationEngine';
import { CFVCalculator } from './utils/CFVCalculator';
import { CacheManager } from './utils/CacheManager';
// Phase 3 imports
import { AnomalyDetector } from './ml/AnomalyDetector.js';
import { PredictiveAnalyzer } from './ml/PredictiveAnalyzer.js';
import { SentimentAnalyzer } from './ml/SentimentAnalyzer.js';
import { StreamingEngine } from './streaming/StreamingEngine.js';
import type { HistoricalDataPoint } from './utils/HistoricalAnalyzer.js';
import type { TextItem, AnomalyScore, ForecastResult, SentimentScore } from './ml/types.js';
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
  
  // Phase 3: ML & streaming components
  private anomalyDetectors: Map<string, AnomalyDetector> = new Map();
  private predictiveAnalyzers: Map<string, PredictiveAnalyzer> = new Map();
  private sentimentAnalyzer: SentimentAnalyzer;
  private streamingEngine: StreamingEngine;
  
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
    // Phase 1: Primary collectors
    this.collectors = [
      new CoinGeckoCollector(this.config.coinGeckoApiKey),
      new EtherscanCollector(
        this.config.etherscanApiKey,
        undefined,
        undefined,
        this.config.coinGeckoApiKey
      ),
      new GitHubCollector(this.config.githubToken),
      // Phase 2: Additional blockchain explorers
      new BlockchairCollector(process.env.BLOCKCHAIR_API_KEY),
      new CryptoCompareCollector(process.env.CRYPTOCOMPARE_API_KEY),
      // Phase 2: Social media collectors
      new RedditCollector(),
      new TwitterCollector(process.env.TWITTER_BEARER_TOKEN),
    ];
    
    // Initialize cache
    this.cache = new CacheManager(this.config.redisUrl, this.config.cacheTTL);
    
    // Phase 3: Initialize ML & streaming components
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.streamingEngine = new StreamingEngine();
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
    logger.info(`Calculating CFV for ${coinSymbol.toUpperCase()}`);
    
    // Check cache first
    const cachedResult = await this.cache.getCFVResult(coinSymbol);
    if (cachedResult) {
      const age = Date.now() - cachedResult.timestamp.getTime();
      if (age < this.config.cacheTTL.medium * 1000) {
        logger.info(`Using cached result`, { ageSeconds: Math.round(age / 1000) });
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
    
    logger.info(`CFV calculation complete`);
    
    return result;
  }
  
  /**
   * Collect all required metrics for CFV calculation
   */
  private async collectAllMetrics(coinSymbol: string): Promise<CFVMetrics> {
    const metricsToCollect: MetricType[] = [
      'adoption',
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
          logger.error(`Failed to collect ${metric}`, { error });
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
    logger.info(`Collecting ${metric}`);
    
    // Check cache first
    const cached = await this.cache.getMetric(coinSymbol, metric);
    if (cached) {
      const age = Date.now() - cached.timestamp.getTime();
      if (age < this.getTTLForMetric(metric) * 1000) {
        logger.info(`  ✓ ${metric}: ${cached.value} (cached, ${cached.confidence})`);
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
        logger.info(`  ✓ ${collector.name}: ${result.value} (${result.confidence})`);
      } catch (error) {
        // Collector failed, continue with others
        logger.warn(`  ✗ ${collector.name}: ${error}`);
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
    
    logger.info(`  → Final: ${finalResult.value} (${finalResult.confidence})`);
    
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
      case 'adoption':
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
    output += `  Adoption (Holders):    ${CFVCalculator.formatNumber(metrics.adoption.value)} (${metrics.adoption.confidence})\n`;
    output += `  Annual TX Value:       ${CFVCalculator.formatCurrency(metrics.annualTransactionValue.value)} (${metrics.annualTransactionValue.confidence})\n`;
    output += `  Annual TX Count:       ${CFVCalculator.formatNumber(metrics.annualTransactions.value)} (${metrics.annualTransactions.confidence})\n`;
    output += `  Developers:            ${metrics.developers.value} (${metrics.developers.confidence})\n`;
    output += `  Current Price:         ${CFVCalculator.formatCurrency(metrics.price.value)}\n`;
    output += `  Circulating Supply:    ${CFVCalculator.formatNumber(metrics.circulatingSupply.value)}\n\n`;
    
    output += `💰 VALUATION\n`;
    output += `${'─'.repeat(60)}\n`;
    output += `  Composite Score (S):   ${calculation.compositeScore.toFixed(4)} (1.0 = Bitcoin benchmark)\n`;
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
  
  // ── Phase 3: ML Anomaly Detection ─────────────────────────────────────────
  
  /**
   * Run anomaly detection on a metric value using trained ML models.
   * Automatically trains the detector on first call with available history.
   */
  async detectAnomaly(
    coinSymbol: string,
    metricName: string,
    value: number,
    history?: HistoricalDataPoint[],
  ): Promise<AnomalyScore> {
    const key = `${coinSymbol}:${metricName}`;
    
    if (!this.anomalyDetectors.has(key)) {
      const detector = new AnomalyDetector();
      if (history && history.length >= 2) {
        detector.train(history);
      }
      this.anomalyDetectors.set(key, detector);
    }
    
    const detector = this.anomalyDetectors.get(key)!;
    const result = detector.detect(value);
    
    // Emit anomaly alert via streaming engine if detected
    if (result.isAnomaly) {
      logger.warn(`Anomaly detected for ${coinSymbol}:${metricName}`, {
        score: result.score,
        severity: result.severity,
        reasons: result.reasons,
      });
      this.streamingEngine.emitAnomalyAlert(
        coinSymbol,
        metricName,
        result.score,
        result.severity,
        result.reasons,
      );
    }
    
    return result;
  }
  
  // ── Phase 3: Predictive Analytics ───────────────────────────────────────────
  
  /**
   * Generate predictions for a metric using trained time-series models.
   */
  async generatePrediction(
    coinSymbol: string,
    metricName: string,
    history: HistoricalDataPoint[],
    horizons?: number[],
  ): Promise<ForecastResult> {
    const key = `${coinSymbol}:${metricName}`;
    
    if (!this.predictiveAnalyzers.has(key)) {
      this.predictiveAnalyzers.set(key, new PredictiveAnalyzer());
    }
    
    const analyzer = this.predictiveAnalyzers.get(key)!;
    analyzer.train(history);
    const forecast = analyzer.generateForecast(horizons);
    
    // Emit prediction via streaming engine
    this.streamingEngine.emitPredictionUpdate(coinSymbol, metricName, {
      value: forecast.ensemble.value,
      lowerBound: forecast.ensemble.lowerBound,
      upperBound: forecast.ensemble.upperBound,
      horizonHours: forecast.ensemble.horizonHours,
    });
    
    logger.info(`Prediction for ${coinSymbol}:${metricName}`, {
      trend: forecast.trend,
      ensembleValue: forecast.ensemble.value,
      confidence: forecast.ensemble.confidence,
    });
    
    return forecast;
  }
  
  // ── Phase 3: Sentiment Analysis ─────────────────────────────────────────────
  
  /**
   * Analyse sentiment from social media text items for a coin.
   */
  analyzeSentiment(coinSymbol: string, items: TextItem[]): SentimentScore {
    const result = this.sentimentAnalyzer.analyze(items);
    
    // Emit sentiment update via streaming engine
    this.streamingEngine.emitSentimentUpdate(
      coinSymbol,
      result.score,
      result.label,
      result.sampleSize,
    );
    
    logger.info(`Sentiment for ${coinSymbol}`, {
      score: result.score,
      label: result.label,
      sampleSize: result.sampleSize,
    });
    
    return result;
  }
  
  // ── Phase 3: Streaming Engine ───────────────────────────────────────────────
  
  /**
   * Get the streaming engine for subscribing to real-time events.
   */
  getStreamingEngine(): StreamingEngine {
    return this.streamingEngine;
  }
  
  /**
   * Start real-time streaming of metrics, anomalies, and predictions.
   */
  startStreaming(): void {
    this.streamingEngine.start();
    logger.info('Real-time streaming started');
  }
  
  /**
   * Stop real-time streaming.
   */
  stopStreaming(): void {
    this.streamingEngine.stop();
    logger.info('Real-time streaming stopped');
  }
  
  /**
   * Close agent and cleanup resources
   */
  async close(): Promise<void> {
    this.streamingEngine.stop();
    await this.cache.close();
  }
}
