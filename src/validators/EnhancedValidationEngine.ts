import { TransactionMetrics, ConfidenceLevel } from '../types/index.js';

/**
 * Enhanced Validation Engine
 * 
 * Validates data quality and assigns confidence scores
 * Implements cross-source verification when multiple sources available
 * 
 * Confidence Levels:
 * - HIGH: Direct blockchain data, verified, <5% variance
 * - MEDIUM: Estimated from reliable sources, 5-20% variance
 * - LOW: Estimated from limited data, >20% variance or missing data
 */

export interface ValidationResult {
  isValid: boolean;
  confidence: ConfidenceLevel;
  issues: string[];
  warnings: string[];
  recommendations: string[];
  score: number; // 0-100
}

export interface CrossValidationResult {
  consensus: TransactionMetrics;
  variance: number;
  agreement: number; // percentage
  sources: number;
}

export class EnhancedValidationEngine {
  /**
   * Validate transaction metrics
   */
  validate(metrics: TransactionMetrics): ValidationResult {
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
      score: Math.max(0, score)
    };
  }

  /**
   * Cross-validate metrics from multiple sources
   */
  crossValidate(metricsArray: TransactionMetrics[]): CrossValidationResult {
    if (metricsArray.length < 2) {
      throw new Error('Need at least 2 sources for cross-validation');
    }

    // Calculate average values
    const avgTxCount = this.average(metricsArray.map(m => m.annualTxCount));
    const avgTxValue = this.average(metricsArray.map(m => m.annualTxValue));
    const avgAvgTxValue = this.average(metricsArray.map(m => m.avgTxValue));

    // Calculate variance
    const txCountVariance = this.calculateVariance(metricsArray.map(m => m.annualTxCount));
    const txValueVariance = this.calculateVariance(metricsArray.map(m => m.annualTxValue));
    const avgVariance = (txCountVariance + txValueVariance) / 2;

    // Calculate agreement (inverse of variance)
    const agreement = Math.max(0, 100 - (avgVariance * 100));

    // Collect all sources
    const allSources = metricsArray.flatMap(m => m.sources);

    // Determine consensus confidence
    let confidence: ConfidenceLevel;
    if (avgVariance < 0.05 && agreement > 95) {
      confidence = 'HIGH';
    } else if (avgVariance < 0.20 && agreement > 80) {
      confidence = 'MEDIUM';
    } else {
      confidence = 'LOW';
    }

    return {
      consensus: {
        annualTxCount: Math.round(avgTxCount),
        annualTxValue: avgTxValue,
        avgTxValue: avgAvgTxValue,
        confidence,
        sources: allSources,
        timestamp: new Date()
      },
      variance: avgVariance,
      agreement,
      sources: metricsArray.length
    };
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate coefficient of variation (variance)
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const avg = this.average(values);
    if (avg === 0) return 0;
    
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const variance = Math.sqrt(this.average(squaredDiffs));
    
    // Return coefficient of variation (normalized)
    return variance / avg;
  }

  /**
   * Compare two metrics and calculate difference
   */
  compareMetrics(metrics1: TransactionMetrics, metrics2: TransactionMetrics): {
    txCountDiff: number;
    txValueDiff: number;
    avgTxValueDiff: number;
    overallDiff: number;
  } {
    const txCountDiff = this.percentDifference(metrics1.annualTxCount, metrics2.annualTxCount);
    const txValueDiff = this.percentDifference(metrics1.annualTxValue, metrics2.annualTxValue);
    const avgTxValueDiff = this.percentDifference(metrics1.avgTxValue, metrics2.avgTxValue);
    const overallDiff = (txCountDiff + txValueDiff + avgTxValueDiff) / 3;

    return {
      txCountDiff,
      txValueDiff,
      avgTxValueDiff,
      overallDiff
    };
  }

  /**
   * Calculate percent difference between two values
   */
  private percentDifference(val1: number, val2: number): number {
    if (val1 === 0 && val2 === 0) return 0;
    if (val1 === 0 || val2 === 0) return 100;
    
    const avg = (val1 + val2) / 2;
    return Math.abs(val1 - val2) / avg * 100;
  }

  /**
   * Generate validation report
   */
  generateReport(metrics: TransactionMetrics): string {
    const validation = this.validate(metrics);
    
    let report = '='.repeat(60) + '\n';
    report += 'VALIDATION REPORT\n';
    report += '='.repeat(60) + '\n\n';
    
    report += `Confidence: ${validation.confidence}\n`;
    report += `Score: ${validation.score}/100\n`;
    report += `Valid: ${validation.isValid ? 'YES' : 'NO'}\n\n`;
    
    if (validation.issues.length > 0) {
      report += '❌ ISSUES:\n';
      validation.issues.forEach(issue => {
        report += `  - ${issue}\n`;
      });
      report += '\n';
    }
    
    if (validation.warnings.length > 0) {
      report += '⚠️  WARNINGS:\n';
      validation.warnings.forEach(warning => {
        report += `  - ${warning}\n`;
      });
      report += '\n';
    }
    
    if (validation.recommendations.length > 0) {
      report += '💡 RECOMMENDATIONS:\n';
      validation.recommendations.forEach(rec => {
        report += `  - ${rec}\n`;
      });
      report += '\n';
    }
    
    report += '='.repeat(60) + '\n';
    
    return report;
  }
}

export default EnhancedValidationEngine;
