/**
 * Unified Validation Engine
 * 
 * Combines functionality from ValidationEngine and EnhancedValidationEngine
 * into a single, cohesive validation system.
 * 
 * This engine can validate:
 * - Multiple MetricResults from different sources (aggregation)
 * - Individual TransactionMetrics (quality checks)
 * - Cross-source validation
 * - Rate-of-change detection (Phase 2)
 * - Source diversity scoring (Phase 2)
 * - Weighted temporal decay (Phase 2)
 */

import type { 
  MetricResult, 
  ConfidenceLevel, 
  ValidationResult,
  TransactionMetrics 
} from '../types/index.js';

export interface EnhancedValidationResult extends ValidationResult {
  warnings?: string[];
  recommendations?: string[];
  score?: number;
}

export interface CrossValidationResult {
  consensus: TransactionMetrics;
  variance: number;
  agreement: number; // percentage
  sources: number;
}

export interface RateOfChangeResult {
  changePercent: number;
  isSignificant: boolean;
  direction: 'increasing' | 'decreasing' | 'stable';
  severity: 'normal' | 'notable' | 'extreme';
}

export interface SourceDiversityScore {
  score: number;           // 0-100
  uniqueSources: number;
  sourceTypes: string[];   // e.g., ['api', 'blockchain', 'social']
  recommendation: string;
}

export class UnifiedValidationEngine {
  // Source priority weights for value selection
  private static readonly PRIMARY_SOURCE_WEIGHT = 1.5;
  private static readonly SECONDARY_SOURCE_WEIGHT = 1.2;
  private static readonly PRIMARY_SOURCES = ['CoinGecko', 'Etherscan', '3xpl'];
  private static readonly SECONDARY_SOURCES = ['Blockchair', 'CryptoCompare'];

  // Temporal decay parameters
  private static readonly TEMPORAL_HALF_LIFE_HOURS = 12;
  private static readonly MIN_TEMPORAL_WEIGHT = 0.1;

  /**
   * Validate and aggregate multiple metric results from different sources
   * Combines logic from original ValidationEngine
   */
  static validateMetricResults(results: MetricResult[]): ValidationResult {
    if (results.length === 0) {
      return {
        isValid: false,
        confidence: 'LOW',
        issues: ['No data available'],
      };
    }
    
    const issues: string[] = [];
    
    // Check for outliers
    const values = results.map(r => r.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = this.calculateVariance(values, mean);
    const stdDev = Math.sqrt(variance);
    
    // Flag outliers (values > 3 standard deviations from mean)
    const outliers = results.filter(r => Math.abs(r.value - mean) > 3 * stdDev);
    if (outliers.length > 0) {
      issues.push(`${outliers.length} outlier(s) detected`);
    }
    
    // Check for zero values
    const zeroValues = results.filter(r => r.value === 0);
    if (zeroValues.length > 0) {
      issues.push(`${zeroValues.length} zero value(s) found`);
    }
    
    // Calculate confidence based on multiple factors
    const confidence = this.calculateAggregateConfidence(results, variance);
    
    // Select best value (weighted by confidence and recency)
    const adjustedValue = this.selectBestValue(results);
    
    return {
      isValid: issues.length === 0 || confidence !== 'LOW',
      confidence,
      issues,
      adjustedValue,
    };
  }
  
  /**
   * Validate transaction metrics quality
   * Combines logic from EnhancedValidationEngine
   */
  static validateTransactionMetrics(metrics: TransactionMetrics): EnhancedValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check for missing or zero values
    if (!metrics.annualTxCount || metrics.annualTxCount === 0) {
      issues.push('Annual transaction count is missing or zero');
      score -= 40;
    }

    if (!metrics.annualTxValue || metrics.annualTxValue === 0) {
      issues.push('Annual transaction value is missing or zero');
      score -= 40;
    }

    if (!metrics.avgTxValue || metrics.avgTxValue === 0) {
      issues.push('Average transaction value is missing or zero');
      score -= 20;
    }

    // Check for unrealistic values
    if (metrics.annualTxCount && metrics.annualTxCount < 1000) {
      warnings.push('Annual transaction count seems unusually low (<1,000)');
      score -= 10;
    }

    if (metrics.annualTxCount && metrics.annualTxCount > 1e12) {
      warnings.push('Annual transaction count seems unusually high (>1 trillion)');
      score -= 10;
    }

    if (metrics.avgTxValue && metrics.avgTxValue < 0.0001) {
      warnings.push('Average transaction value seems unusually low (<$0.0001)');
      score -= 5;
    }

    // Check data sources
    if (!metrics.sources || metrics.sources.length === 0) {
      warnings.push('No data sources specified');
      score -= 10;
    }

    if (metrics.sources && metrics.sources.length === 1) {
      recommendations.push('Consider adding additional data sources for cross-validation');
    }

    // Check confidence level
    if (metrics.confidence === 'LOW') {
      recommendations.push('Data quality is low. Consider using manual input or blockchain explorer data');
      score -= 20;
    } else if (metrics.confidence === 'MEDIUM') {
      recommendations.push('Data is estimated. For critical calculations, verify with blockchain explorer');
      score -= 10;
    }

    // Check timestamp
    if (!metrics.timestamp) {
      warnings.push('No timestamp provided for metrics');
      score -= 5;
    } else {
      const age = Date.now() - metrics.timestamp.getTime();
      const hoursSinceUpdate = age / (1000 * 60 * 60);
      
      if (hoursSinceUpdate > 24) {
        warnings.push(`Data is ${Math.round(hoursSinceUpdate)} hours old`);
        score -= 5;
      }
    }

    // Determine final confidence level based on score
    let confidence: ConfidenceLevel;
    if (score >= 90) {
      confidence = 'HIGH';
    } else if (score >= 70) {
      confidence = 'MEDIUM';
    } else {
      confidence = 'LOW';
    }

    return {
      isValid: issues.length === 0,
      confidence,
      issues,
      warnings,
      recommendations,
      score,
    };
  }

  /**
   * Cross-validate transaction metrics from multiple sources
   */
  static crossValidate(metricsArray: TransactionMetrics[]): CrossValidationResult {
    if (metricsArray.length === 0) {
      throw new Error('No metrics to cross-validate');
    }

    if (metricsArray.length === 1) {
      return {
        consensus: metricsArray[0],
        variance: 0,
        agreement: 100,
        sources: 1,
      };
    }

    // Calculate variance across sources
    const txCounts = metricsArray.map(m => m.annualTxCount);
    const txValues = metricsArray.map(m => m.annualTxValue);
    
    const countVariance = this.calculateVariance(txCounts);
    const valueVariance = this.calculateVariance(txValues);
    const totalVariance = (countVariance + valueVariance) / 2;

    // Calculate agreement percentage (lower variance = higher agreement)
    const maxVariance = 1.0; // Normalized max variance
    const agreement = Math.max(0, Math.min(100, 100 * (1 - totalVariance / maxVariance)));

    // Create consensus by weighted average (prefer higher confidence sources)
    const weights = metricsArray.map(m => {
      switch (m.confidence) {
        case 'HIGH': return 3;
        case 'MEDIUM': return 2;
        case 'LOW': return 1;
      }
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weightedTxCount = metricsArray.reduce((sum, m, i) => 
      sum + m.annualTxCount * weights[i], 0) / totalWeight;
    const weightedTxValue = metricsArray.reduce((sum, m, i) => 
      sum + m.annualTxValue * weights[i], 0) / totalWeight;
    const weightedAvgValue = weightedTxValue / weightedTxCount;

    // Determine consensus confidence
    const highCount = metricsArray.filter(m => m.confidence === 'HIGH').length;
    const mediumCount = metricsArray.filter(m => m.confidence === 'MEDIUM').length;
    let consensusConfidence: ConfidenceLevel;
    
    if (highCount >= metricsArray.length / 2) {
      consensusConfidence = 'HIGH';
    } else if (highCount + mediumCount >= metricsArray.length / 2) {
      consensusConfidence = 'MEDIUM';
    } else {
      consensusConfidence = 'LOW';
    }

    // Collect all sources
    const allSources = new Set<string>();
    metricsArray.forEach(m => m.sources.forEach(s => allSources.add(s)));

    const consensus: TransactionMetrics = {
      annualTxCount: weightedTxCount,
      annualTxValue: weightedTxValue,
      avgTxValue: weightedAvgValue,
      confidence: consensusConfidence,
      sources: Array.from(allSources),
      timestamp: new Date(),
      metadata: {
        crossValidated: true,
        sourceCount: metricsArray.length,
        variance: totalVariance,
        agreement,
      }
    };

    return {
      consensus,
      variance: totalVariance,
      agreement,
      sources: metricsArray.length,
    };
  }

  /**
   * Calculate variance of values
   */
  private static calculateVariance(values: number[], mean?: number): number {
    if (values.length === 0) return 0;
    
    const avg = mean ?? values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate aggregate confidence from multiple results
   */
  private static calculateAggregateConfidence(
    results: MetricResult[],
    variance: number
  ): ConfidenceLevel {
    let score = 0;
    
    // Factor 1: Number of sources (max 30 points)
    const sourceCount = results.length;
    if (sourceCount >= 3) score += 30;
    else if (sourceCount === 2) score += 20;
    else score += 10;
    
    // Factor 2: Primary source availability (max 30 points)
    const hasPrimarySource = results.some(r => 
      r.source === 'CoinGecko' || r.source === 'Etherscan' || r.source === '3xpl'
    );
    if (hasPrimarySource) score += 30;
    
    // Factor 3: Data consistency (max 25 points)
    const values = results.map(r => r.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
    
    if (coefficientOfVariation < 0.1) score += 25; // <10% variation
    else if (coefficientOfVariation < 0.2) score += 15; // <20% variation
    else if (coefficientOfVariation < 0.3) score += 5; // <30% variation
    
    // Factor 4: Individual confidence scores (max 15 points)
    const highConfidenceCount = results.filter(r => r.confidence === 'HIGH').length;
    const mediumConfidenceCount = results.filter(r => r.confidence === 'MEDIUM').length;
    
    if (highConfidenceCount >= 2) score += 15;
    else if (highConfidenceCount >= 1) score += 10;
    else if (mediumConfidenceCount >= 2) score += 5;
    
    // Convert score to confidence level
    if (score >= 70) return 'HIGH';
    else if (score >= 50) return 'MEDIUM';
    else return 'LOW';
  }

  /**
   * Select best value from multiple results
   * Weighted by confidence, recency, and temporal decay (Phase 2 enhanced)
   */
  private static selectBestValue(results: MetricResult[]): number {
    if (results.length === 0) return 0;
    if (results.length === 1) return results[0].value;
    
    const now = Date.now();
    
    // Weight by confidence with exponential temporal decay (Phase 2)
    const weights = results.map(r => {
      let weight = 1;
      if (r.confidence === 'HIGH') weight = 3;
      else if (r.confidence === 'MEDIUM') weight = 2;
      
      // Exponential temporal decay (Phase 2 enhancement)
      const ageHours = (now - r.timestamp.getTime()) / (1000 * 60 * 60);
      const decayFactor = Math.pow(0.5, ageHours / this.TEMPORAL_HALF_LIFE_HOURS);
      weight *= Math.max(decayFactor, this.MIN_TEMPORAL_WEIGHT);
      
      // Source type bonus (Phase 2: reward diverse source types)
      if (this.PRIMARY_SOURCES.includes(r.source)) {
        weight *= this.PRIMARY_SOURCE_WEIGHT;
      } else if (this.SECONDARY_SOURCES.includes(r.source)) {
        weight *= this.SECONDARY_SOURCE_WEIGHT;
      }
      
      return weight;
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weightedSum = results.reduce((sum, r, i) => sum + r.value * weights[i], 0);
    
    return weightedSum / totalWeight;
  }

  // ============================================================
  // Phase 2: Enhanced Validation Methods
  // ============================================================

  /**
   * Detect rate of change between current and previous metric value
   * Flags significant changes that may indicate data quality issues or real events
   */
  static detectRateOfChange(
    currentValue: number,
    previousValue: number,
    metricType?: string
  ): RateOfChangeResult {
    if (previousValue === 0) {
      return {
        changePercent: currentValue > 0 ? 100 : 0,
        isSignificant: currentValue > 0,
        direction: currentValue > 0 ? 'increasing' : 'stable',
        severity: currentValue > 0 ? 'notable' : 'normal',
      };
    }

    const changePercent = ((currentValue - previousValue) / previousValue) * 100;
    const absChange = Math.abs(changePercent);

    // Thresholds vary by metric type
    const thresholds = this.getChangeThresholds(metricType);

    let direction: 'increasing' | 'decreasing' | 'stable';
    if (changePercent > thresholds.stableThreshold) direction = 'increasing';
    else if (changePercent < -thresholds.stableThreshold) direction = 'decreasing';
    else direction = 'stable';

    let severity: 'normal' | 'notable' | 'extreme';
    if (absChange > thresholds.extremeThreshold) severity = 'extreme';
    else if (absChange > thresholds.notableThreshold) severity = 'notable';
    else severity = 'normal';

    return {
      changePercent,
      isSignificant: absChange > thresholds.notableThreshold,
      direction,
      severity,
    };
  }

  /**
   * Get change thresholds based on metric type
   * Different metrics have different expected variability
   */
  private static getChangeThresholds(metricType?: string): {
    stableThreshold: number;
    notableThreshold: number;
    extremeThreshold: number;
  } {
    switch (metricType) {
      case 'price':
        // Prices can be volatile
        return { stableThreshold: 5, notableThreshold: 20, extremeThreshold: 50 };
      case 'adoption':
        // Adoption changes slowly
        return { stableThreshold: 2, notableThreshold: 10, extremeThreshold: 30 };
      case 'developers':
        // Developer counts are relatively stable
        return { stableThreshold: 5, notableThreshold: 25, extremeThreshold: 50 };
      case 'annualTransactions':
      case 'annualTransactionValue':
        // Transaction metrics can vary moderately
        return { stableThreshold: 5, notableThreshold: 30, extremeThreshold: 100 };
      default:
        return { stableThreshold: 5, notableThreshold: 25, extremeThreshold: 50 };
    }
  }

  /**
   * Calculate source diversity score
   * Higher scores indicate more diverse and reliable data collection
   */
  static calculateSourceDiversity(results: MetricResult[]): SourceDiversityScore {
    if (results.length === 0) {
      return {
        score: 0,
        uniqueSources: 0,
        sourceTypes: [],
        recommendation: 'No data sources available. Add at least one collector.',
      };
    }

    const uniqueSources = new Set(results.map(r => r.source));
    const sourceTypes = new Set<string>();

    // Classify sources by type
    for (const source of uniqueSources) {
      if (['CoinGecko', 'CryptoCompare'].includes(source)) {
        sourceTypes.add('api');
      } else if (['Etherscan', '3xpl', 'Blockchair'].includes(source)) {
        sourceTypes.add('blockchain');
      } else if (['Reddit', 'Twitter'].includes(source)) {
        sourceTypes.add('social');
      } else if (['GitHub'].includes(source)) {
        sourceTypes.add('developer');
      } else {
        sourceTypes.add('other');
      }
    }

    // Score calculation (max 100)
    let score = 0;

    // Source count component (max 40)
    score += Math.min(uniqueSources.size * 10, 40);

    // Source type diversity (max 40)
    score += Math.min(sourceTypes.size * 15, 40);

    // Confidence diversity bonus (max 20)
    const confidenceLevels = new Set(results.map(r => r.confidence));
    const hasHighConfidence = results.some(r => r.confidence === 'HIGH');
    if (hasHighConfidence) score += 10;
    if (confidenceLevels.size >= 2) score += 10;

    score = Math.min(score, 100);

    // Generate recommendation
    let recommendation: string;
    if (score >= 80) {
      recommendation = 'Excellent source diversity. Data is well-corroborated.';
    } else if (score >= 60) {
      recommendation = 'Good source diversity. Consider adding blockchain-specific sources for higher confidence.';
    } else if (score >= 40) {
      recommendation = 'Moderate source diversity. Add sources from different categories (API, blockchain, social).';
    } else {
      recommendation = 'Low source diversity. Data relies on too few sources. Add more collectors for reliability.';
    }

    return {
      score,
      uniqueSources: uniqueSources.size,
      sourceTypes: Array.from(sourceTypes),
      recommendation,
    };
  }

  /**
   * Enhanced metric validation with Phase 2 improvements
   * Combines basic validation with rate-of-change and source diversity checks
   */
  static validateMetricWithHistory(
    results: MetricResult[],
    previousValue?: number,
    metricType?: string
  ): ValidationResult & {
    rateOfChange?: RateOfChangeResult;
    sourceDiversity: SourceDiversityScore;
  } {
    // Base validation
    const baseValidation = this.validateMetricResults(results);
    
    // Source diversity analysis
    const sourceDiversity = this.calculateSourceDiversity(results);
    
    // Rate of change detection (if previous value available)
    let rateOfChange: RateOfChangeResult | undefined;
    if (previousValue !== undefined && baseValidation.adjustedValue !== undefined) {
      rateOfChange = this.detectRateOfChange(
        baseValidation.adjustedValue,
        previousValue,
        metricType
      );
      
      // Adjust confidence if extreme change detected
      if (rateOfChange.severity === 'extreme') {
        baseValidation.issues.push(
          `Extreme change detected: ${rateOfChange.changePercent.toFixed(1)}% ${rateOfChange.direction}`
        );
        // Downgrade confidence for extreme changes
        if (baseValidation.confidence === 'HIGH') {
          baseValidation.confidence = 'MEDIUM';
        }
      }
    }
    
    // Adjust confidence based on source diversity
    if (sourceDiversity.score < 30 && baseValidation.confidence === 'HIGH') {
      baseValidation.confidence = 'MEDIUM';
      baseValidation.issues.push('Low source diversity may reduce reliability');
    }

    return {
      ...baseValidation,
      rateOfChange,
      sourceDiversity,
    };
  }
}
