import type { MetricResult, ConfidenceLevel, ValidationResult } from '../types';

export class ValidationEngine {
  /**
   * Validate and aggregate multiple metric results
   */
  static validateMetric(results: MetricResult[]): ValidationResult {
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
      r.source === 'CoinGecko' || r.source === 'Etherscan'
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
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }
  
  /**
   * Select best value from multiple results
   */
  private static selectBestValue(results: MetricResult[]): number {
    if (results.length === 0) return 0;
    if (results.length === 1) return results[0].value;
    
    // Weight by confidence and recency
    const now = Date.now();
    const weights = results.map(r => {
      let weight = 1;
      
      // Confidence weight
      if (r.confidence === 'HIGH') weight *= 3;
      else if (r.confidence === 'MEDIUM') weight *= 2;
      
      // Recency weight (decay over 24 hours)
      const ageHours = (now - r.timestamp.getTime()) / (1000 * 60 * 60);
      const recencyWeight = Math.exp(-ageHours / 24);
      weight *= recencyWeight;
      
      // Source priority weight
      if (r.source === 'CoinGecko' || r.source === 'Etherscan') weight *= 1.5;
      
      return weight;
    });
    
    // Calculate weighted average
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weightedSum = results.reduce((sum, r, i) => sum + r.value * weights[i], 0);
    
    return Math.round(weightedSum / totalWeight);
  }
  
  /**
   * Validate range for specific metric types
   */
  static validateRange(metricType: string, value: number): boolean {
    switch (metricType) {
      case 'communitySize':
        return value >= 0 && value <= 1e9; // Max 1 billion
      
      case 'annualTransactionValue':
        return value >= 0 && value <= 1e15; // Max 1 quadrillion USD
      
      case 'annualTransactions':
        return value >= 0 && value <= 1e12; // Max 1 trillion transactions
      
      case 'developers':
        return value >= 0 && value <= 100000; // Max 100k developers
      
      case 'price':
        return value >= 0 && value <= 1e9; // Max $1 billion per coin
      
      case 'circulatingSupply':
        return value >= 0 && value <= 1e15; // Max 1 quadrillion coins
      
      case 'marketCap':
        return value >= 0 && value <= 1e15; // Max $1 quadrillion
      
      default:
        return true;
    }
  }
  
  /**
   * Check temporal consistency (detect sudden spikes/drops)
   */
  static checkTemporalConsistency(
    currentValue: number,
    historicalValue?: number
  ): { isConsistent: boolean; changePercent: number } {
    if (!historicalValue) {
      return { isConsistent: true, changePercent: 0 };
    }
    
    const changePercent = ((currentValue - historicalValue) / historicalValue) * 100;
    
    // Flag changes > 500% as potentially inconsistent
    const isConsistent = Math.abs(changePercent) <= 500;
    
    return { isConsistent, changePercent };
  }
}
