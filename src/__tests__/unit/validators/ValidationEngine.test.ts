import { ValidationEngine } from '../../../validators/ValidationEngine.js';
import { createMultipleMetricResults, createTestMetricResult } from '../../fixtures/metrics.js';

describe('ValidationEngine', () => {
  describe('validateMetric', () => {
    it('should return invalid for empty results', () => {
      const result = ValidationEngine.validateMetric([]);

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe('LOW');
      expect(result.issues).toContain('No data available');
    });

    it('should validate single metric result', () => {
      const results = [createTestMetricResult(100, 'HIGH', 'CoinGecko')];

      const validation = ValidationEngine.validateMetric(results);

      expect(validation.isValid).toBe(true);
      expect(validation.adjustedValue).toBe(100);
    });

    it('should detect outliers when value is far from mean', () => {
      // Create results where one value is clearly > 3 standard deviations away
      // Use many similar values and one very different one
      const results = createMultipleMetricResults(
        [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 5000],
        Array(16).fill('HIGH') as ('HIGH')[],
        Array(16).fill(0).map((_, i) => `source-${i}`)
      );

      const validation = ValidationEngine.validateMetric(results);

      // With 15 values of 100 and 1 value of 5000:
      // Mean = (15*100 + 5000)/16 = 6500/16 = 406.25
      // Most values have deviation of ~306, one has deviation of ~4594
      // This should be detected as an outlier
      expect(validation.issues.some(issue => issue.includes('outlier'))).toBe(true);
    });

    it('should detect zero values', () => {
      const results = createMultipleMetricResults(
        [100, 0, 105],
        ['HIGH', 'HIGH', 'HIGH']
      );

      const validation = ValidationEngine.validateMetric(results);

      expect(validation.issues.some(issue => issue.includes('zero value'))).toBe(true);
    });

    it('should calculate high confidence for consistent data from multiple sources', () => {
      const results = createMultipleMetricResults(
        [100, 102, 101], // Very consistent values
        ['HIGH', 'HIGH', 'HIGH'],
        ['CoinGecko', 'Etherscan', 'Blockchain']
      );

      const validation = ValidationEngine.validateMetric(results);

      expect(validation.confidence).toBe('HIGH');
      expect(validation.isValid).toBe(true);
    });

    it('should calculate medium confidence for moderately consistent data', () => {
      const results = createMultipleMetricResults(
        [100, 120, 110], // Moderate variation
        ['MEDIUM', 'MEDIUM', 'HIGH']
      );

      const validation = ValidationEngine.validateMetric(results);

      expect(['MEDIUM', 'HIGH']).toContain(validation.confidence);
    });

    it('should calculate low confidence for inconsistent data', () => {
      const results = createMultipleMetricResults(
        [100, 50, 200, 75], // High variation
        ['LOW', 'LOW', 'LOW', 'LOW']
      );

      const validation = ValidationEngine.validateMetric(results);

      expect(validation.confidence).toBe('LOW');
    });

    it('should prefer primary sources in best value selection', () => {
      const results = [
        createTestMetricResult(100, 'HIGH', 'CoinGecko'),
        createTestMetricResult(150, 'HIGH', 'Unknown'),
      ];

      const validation = ValidationEngine.validateMetric(results);

      // Should weight CoinGecko more heavily
      expect(validation.adjustedValue).toBeLessThan(150);
      expect(validation.adjustedValue).toBeGreaterThanOrEqual(100);
    });

    it('should consider recency in best value selection', () => {
      const now = Date.now();
      const results = [
        {
          value: 100,
          confidence: 'HIGH' as const,
          source: 'source1',
          timestamp: new Date(now - 1000 * 60 * 60), // 1 hour old
          metadata: {},
        },
        {
          value: 110,
          confidence: 'HIGH' as const,
          source: 'source2',
          timestamp: new Date(now), // Recent
          metadata: {},
        },
      ];

      const validation = ValidationEngine.validateMetric(results);

      // Should favor more recent value
      expect(validation.adjustedValue).toBeGreaterThan(100);
    });

    it('should handle all high confidence results', () => {
      const results = createMultipleMetricResults(
        [100, 102, 101],
        ['HIGH', 'HIGH', 'HIGH'],
        ['CoinGecko', 'Etherscan', 'Blockchain']
      );

      const validation = ValidationEngine.validateMetric(results);

      expect(validation.confidence).toBe('HIGH');
      expect(validation.isValid).toBe(true);
    });

    it('should handle mixed confidence levels', () => {
      const results = createMultipleMetricResults(
        [100, 105, 102],
        ['HIGH', 'MEDIUM', 'LOW']
      );

      const validation = ValidationEngine.validateMetric(results);

      expect(['HIGH', 'MEDIUM']).toContain(validation.confidence);
    });
  });

  describe('validateRange', () => {
    it('should validate communitySize range', () => {
      expect(ValidationEngine.validateRange('communitySize', 1000000)).toBe(true);
      expect(ValidationEngine.validateRange('communitySize', 0)).toBe(true);
      expect(ValidationEngine.validateRange('communitySize', 1e9)).toBe(true);
      expect(ValidationEngine.validateRange('communitySize', 1e10)).toBe(false);
      expect(ValidationEngine.validateRange('communitySize', -100)).toBe(false);
    });

    it('should validate annualTransactionValue range', () => {
      expect(ValidationEngine.validateRange('annualTransactionValue', 1e12)).toBe(true);
      expect(ValidationEngine.validateRange('annualTransactionValue', 0)).toBe(true);
      expect(ValidationEngine.validateRange('annualTransactionValue', 1e15)).toBe(true);
      expect(ValidationEngine.validateRange('annualTransactionValue', 1e16)).toBe(false);
      expect(ValidationEngine.validateRange('annualTransactionValue', -1000)).toBe(false);
    });

    it('should validate annualTransactions range', () => {
      expect(ValidationEngine.validateRange('annualTransactions', 1000000)).toBe(true);
      expect(ValidationEngine.validateRange('annualTransactions', 0)).toBe(true);
    });

    it('should validate developers range', () => {
      expect(ValidationEngine.validateRange('developers', 100)).toBe(true);
      expect(ValidationEngine.validateRange('developers', 0)).toBe(true);
    });

    it('should validate price range', () => {
      expect(ValidationEngine.validateRange('price', 100)).toBe(true);
      expect(ValidationEngine.validateRange('price', 0)).toBe(true);
    });

    it('should validate circulatingSupply range', () => {
      expect(ValidationEngine.validateRange('circulatingSupply', 1000000)).toBe(true);
      expect(ValidationEngine.validateRange('circulatingSupply', 0)).toBe(true);
    });
  });
});
