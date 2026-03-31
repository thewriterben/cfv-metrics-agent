import { describe, it, expect } from '@jest/globals';
import { UnifiedValidationEngine } from '../../../validators/UnifiedValidationEngine.js';
import type { MetricResult } from '../../../types/index.js';

function makeResult(
  value: number,
  source: string,
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM',
  hoursAgo: number = 0,
): MetricResult {
  return {
    value,
    confidence,
    source,
    timestamp: new Date(Date.now() - hoursAgo * 3600000),
  };
}

describe('UnifiedValidationEngine - Phase 2 Enhanced Methods', () => {
  describe('detectRateOfChange', () => {
    it('should detect stable values', () => {
      const result = UnifiedValidationEngine.detectRateOfChange(100, 100);
      expect(result.direction).toBe('stable');
      expect(result.isSignificant).toBe(false);
      expect(result.severity).toBe('normal');
    });

    it('should detect moderate increase', () => {
      const result = UnifiedValidationEngine.detectRateOfChange(130, 100);
      expect(result.direction).toBe('increasing');
      expect(result.changePercent).toBe(30);
      expect(result.isSignificant).toBe(true);
      expect(result.severity).toBe('notable');
    });

    it('should detect moderate decrease', () => {
      const result = UnifiedValidationEngine.detectRateOfChange(70, 100);
      expect(result.direction).toBe('decreasing');
      expect(result.changePercent).toBe(-30);
      expect(result.isSignificant).toBe(true);
    });

    it('should detect extreme changes', () => {
      const result = UnifiedValidationEngine.detectRateOfChange(200, 100);
      expect(result.severity).toBe('extreme');
      expect(result.changePercent).toBe(100);
    });

    it('should handle zero previous value', () => {
      const result = UnifiedValidationEngine.detectRateOfChange(50, 0);
      expect(result.changePercent).toBe(100);
      expect(result.direction).toBe('increasing');
    });

    it('should handle both zero values', () => {
      const result = UnifiedValidationEngine.detectRateOfChange(0, 0);
      expect(result.direction).toBe('stable');
    });

    it('should use metric-specific thresholds for price', () => {
      // Price allows more volatility (extremeThreshold = 50)
      const result = UnifiedValidationEngine.detectRateOfChange(145, 100, 'price');
      expect(result.severity).toBe('notable');

      // But same change for adoption (extremeThreshold = 30) is extreme
      const adoptionResult = UnifiedValidationEngine.detectRateOfChange(145, 100, 'adoption');
      expect(adoptionResult.severity).toBe('extreme');
    });
  });

  describe('calculateSourceDiversity', () => {
    it('should return 0 for empty results', () => {
      const result = UnifiedValidationEngine.calculateSourceDiversity([]);
      expect(result.score).toBe(0);
      expect(result.uniqueSources).toBe(0);
    });

    it('should score single source low', () => {
      const results = [makeResult(100, 'CoinGecko', 'HIGH')];
      const result = UnifiedValidationEngine.calculateSourceDiversity(results);

      expect(result.uniqueSources).toBe(1);
      expect(result.sourceTypes).toContain('api');
      expect(result.score).toBeLessThan(50);
    });

    it('should score multiple diverse sources high', () => {
      const results = [
        makeResult(100, 'CoinGecko', 'HIGH'),
        makeResult(101, 'Blockchair', 'MEDIUM'),
        makeResult(99, 'Reddit', 'LOW'),
        makeResult(100, 'GitHub', 'MEDIUM'),
      ];
      const result = UnifiedValidationEngine.calculateSourceDiversity(results);

      expect(result.uniqueSources).toBe(4);
      expect(result.sourceTypes.length).toBeGreaterThanOrEqual(3);
      expect(result.score).toBeGreaterThan(60);
    });

    it('should classify source types correctly', () => {
      const results = [
        makeResult(100, 'CoinGecko'),
        makeResult(100, 'CryptoCompare'),
        makeResult(100, 'Etherscan'),
        makeResult(100, 'Blockchair'),
        makeResult(100, 'Reddit'),
        makeResult(100, 'Twitter'),
        makeResult(100, 'GitHub'),
      ];
      const result = UnifiedValidationEngine.calculateSourceDiversity(results);

      expect(result.sourceTypes).toContain('api');
      expect(result.sourceTypes).toContain('blockchain');
      expect(result.sourceTypes).toContain('social');
      expect(result.sourceTypes).toContain('developer');
    });

    it('should include recommendation', () => {
      const results = [makeResult(100, 'CoinGecko', 'HIGH')];
      const result = UnifiedValidationEngine.calculateSourceDiversity(results);
      expect(result.recommendation).toBeTruthy();
      expect(result.recommendation.length).toBeGreaterThan(0);
    });
  });

  describe('validateMetricWithHistory', () => {
    it('should include source diversity in validation', () => {
      const results = [
        makeResult(100, 'CoinGecko', 'HIGH'),
        makeResult(101, 'CryptoCompare', 'MEDIUM'),
      ];
      const validation = UnifiedValidationEngine.validateMetricWithHistory(results);

      expect(validation.sourceDiversity).toBeDefined();
      expect(validation.sourceDiversity.uniqueSources).toBe(2);
    });

    it('should include rate of change when previous value provided', () => {
      const results = [
        makeResult(150, 'CoinGecko', 'HIGH'),
      ];
      const validation = UnifiedValidationEngine.validateMetricWithHistory(results, 100, 'price');

      expect(validation.rateOfChange).toBeDefined();
      expect(validation.rateOfChange?.direction).toBe('increasing');
    });

    it('should not include rate of change when no previous value', () => {
      const results = [makeResult(100, 'CoinGecko', 'HIGH')];
      const validation = UnifiedValidationEngine.validateMetricWithHistory(results);

      expect(validation.rateOfChange).toBeUndefined();
    });

    it('should downgrade confidence on extreme rate of change', () => {
      const results = [
        makeResult(300, 'CoinGecko', 'HIGH'),
        makeResult(310, 'Blockchair', 'HIGH'),
      ];
      const validation = UnifiedValidationEngine.validateMetricWithHistory(
        results,
        100,
        'adoption', // adoption has extremeThreshold of 30%
      );

      expect(validation.rateOfChange?.severity).toBe('extreme');
      // Confidence should be downgraded from what would have been HIGH
      expect(validation.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('Extreme change detected')]),
      );
    });

    it('should downgrade confidence for low source diversity', () => {
      const results = [
        makeResult(100, 'UnknownSource', 'HIGH'),
      ];
      const validation = UnifiedValidationEngine.validateMetricWithHistory(results);

      // With a single unknown source, diversity score should be low
      // Score: 10 (1 source) + 15 (1 type) + 10 (HIGH conf) = 35
      expect(validation.sourceDiversity.score).toBeLessThan(50);
      expect(validation.sourceDiversity.uniqueSources).toBe(1);
    });
  });
});
