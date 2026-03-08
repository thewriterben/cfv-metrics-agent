/**
 * CFVCalculator Tests
 * Validates the Digital Gold Standard formula from "Beyond Bitcoin" by John Gotts
 */

import { CFVCalculator, DGS_BENCHMARK, CFV_WEIGHTS } from '../../../utils/CFVCalculator.js';
import { createTestMetrics, mockBTCMetrics } from '../../fixtures/metrics.js';

describe('CFVCalculator', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // DGS Benchmark constants
  // ─────────────────────────────────────────────────────────────────────────

  describe('DGS_BENCHMARK', () => {
    it('should have correct Beyond Bitcoin December 2024 values', () => {
      expect(DGS_BENCHMARK.marketCap).toBe(1_983_000_000_000);
      expect(DGS_BENCHMARK.adoption).toBe(80_000_000);
      expect(DGS_BENCHMARK.annualTransactions).toBe(6_000_000_000);
      expect(DGS_BENCHMARK.annualTxValue).toBe(13_470_000_000_000);
      expect(DGS_BENCHMARK.developers).toBe(905);
    });
  });

  describe('CFV_WEIGHTS', () => {
    it('should have correct formula weights', () => {
      expect(CFV_WEIGHTS.adoption).toBe(0.70);
      expect(CFV_WEIGHTS.annualTransactions).toBe(0.10);
      expect(CFV_WEIGHTS.annualTxValue).toBe(0.10);
      expect(CFV_WEIGHTS.developers).toBe(0.10);
    });

    it('should have weights that sum to 1.0', () => {
      const sum =
        CFV_WEIGHTS.adoption +
        CFV_WEIGHTS.annualTransactions +
        CFV_WEIGHTS.annualTxValue +
        CFV_WEIGHTS.developers;
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bitcoin self-check: all ratios = 1.0 → S = 1.0 → CFV = $1.983T
  // ─────────────────────────────────────────────────────────────────────────

  describe('Bitcoin self-check', () => {
    it('should produce S = 1.0 and fair market cap = $1.983T for Bitcoin at calibration', () => {
      const result = CFVCalculator.calculate(mockBTCMetrics);

      expect(result.compositeScore).toBeCloseTo(1.0, 10);
      expect(result.fairMarketCap).toBeCloseTo(DGS_BENCHMARK.marketCap, -6);
      expect(result.fairValue).toBeCloseTo(100_000, 0);

      expect(result.componentScores.adoptionScore).toBe(1.0);
      expect(result.componentScores.transactionCountScore).toBe(1.0);
      expect(result.componentScores.transactionValueScore).toBe(1.0);
      expect(result.componentScores.developerScore).toBe(1.0);
    });

    it('should report Bitcoin as fairly valued at $100,000', () => {
      const result = CFVCalculator.calculate(mockBTCMetrics);
      expect(result.valuationStatus).toBe('fairly valued');
      expect(Math.abs(result.valuationPercent)).toBeLessThan(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Core formula calculation
  // ─────────────────────────────────────────────────────────────────────────

  describe('calculate', () => {
    it('should calculate fair value correctly with valid inputs', () => {
      const metrics = createTestMetrics({
        adoption:          1_000_000,
        annualTxValue:     1_000_000_000,
        annualTxCount:     10_000_000,
        developers:        100,
        price:             100,
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(metrics);

      expect(result.fairValue).toBeGreaterThan(0);
      expect(result.compositeScore).toBeGreaterThan(0);
      expect(result.currentPrice).toBe(100);
      expect(result.valuationStatus).toMatch(/undervalued|overvalued|fairly valued/);
      expect(result.fairMarketCap).toBeGreaterThan(0);
      expect(result.currentMarketCap).toBe(100_000_000); // price × circulating supply
    });

    it('should calculate correct component scores', () => {
      const metrics = createTestMetrics({
        adoption:          40_000_000,   // 50% of 80M
        annualTxValue:     6_735_000_000_000, // 50% of $13.47T
        annualTxCount:     3_000_000_000, // 50% of 6B
        developers:        452,           // ~50% of 905
        price:             50,
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(metrics);

      expect(result.componentScores.adoptionScore).toBeCloseTo(0.5, 4);
      expect(result.componentScores.transactionCountScore).toBeCloseTo(0.5, 4);
      expect(result.componentScores.transactionValueScore).toBeCloseTo(0.5, 4);
      expect(result.componentScores.developerScore).toBeCloseTo(0.4994, 3);
    });

    it('should calculate composite score as weighted sum of ratios', () => {
      const metrics = createTestMetrics({
        adoption:          40_000_000,
        annualTxValue:     6_735_000_000_000,
        annualTxCount:     3_000_000_000,
        developers:        452,
        price:             50,
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(metrics);
      // All ratios ≈ 0.5 → S ≈ 0.5
      expect(result.compositeScore).toBeCloseTo(0.5, 1);
    });

    it('should calculate fair market cap as benchmarkMarketCap × compositeScore', () => {
      const metrics = createTestMetrics({
        adoption:          40_000_000,
        annualTxValue:     6_735_000_000_000,
        annualTxCount:     3_000_000_000,
        developers:        452,
        price:             50,
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(metrics);
      const expected = DGS_BENCHMARK.marketCap * result.compositeScore;
      expect(result.fairMarketCap).toBeCloseTo(expected, 0);
    });

    it('should calculate fair value as fairMarketCap / circulatingSupply', () => {
      const metrics = createTestMetrics({
        adoption:          10_000_000,
        annualTxValue:     1_000_000_000_000,
        annualTxCount:     500_000_000,
        developers:        320,
        price:             1,
        circulatingSupply: 1_000_000_000,
      });

      const result = CFVCalculator.calculate(metrics);
      expect(result.fairValue).toBeCloseTo(result.fairMarketCap / 1_000_000_000, 6);
    });

    it('should calculate price multiplier correctly', () => {
      const metrics = createTestMetrics({
        adoption:          10_000_000,
        annualTxValue:     1_000_000_000_000,
        annualTxCount:     500_000_000,
        developers:        320,
        price:             200,
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(metrics);
      expect(result.priceMultiplier).toBeCloseTo(result.currentPrice / result.fairValue, 4);
    });

    it('should handle very large numbers without overflow', () => {
      const metrics = createTestMetrics({
        adoption:          1_000_000_000,
        annualTxValue:     50_000_000_000_000,
        annualTxCount:     20_000_000_000,
        developers:        2_000,
        price:             50_000,
        circulatingSupply: 21_000_000,
      });

      const result = CFVCalculator.calculate(metrics);

      expect(isFinite(result.fairValue)).toBe(true);
      expect(isFinite(result.compositeScore)).toBe(true);
      expect(isFinite(result.fairMarketCap)).toBe(true);
      expect(result.fairValue).toBeGreaterThan(0);
    });

    it('should handle small values correctly', () => {
      const metrics = createTestMetrics({
        adoption:          10,
        annualTxValue:     100,
        annualTxCount:     50,
        developers:        1,
        price:             0.01,
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(metrics);

      expect(result.fairValue).toBeGreaterThan(0);
      expect(isFinite(result.fairValue)).toBe(true);
      expect(isFinite(result.compositeScore)).toBe(true);
    });

    it('should return zero fair value when all metrics are zero', () => {
      const metrics = createTestMetrics({
        adoption:          0,
        annualTxValue:     0,
        annualTxCount:     0,
        developers:        0,
        price:             0.01,
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(metrics);
      expect(result.fairValue).toBe(0);
      expect(result.compositeScore).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Valuation status
  // ─────────────────────────────────────────────────────────────────────────

  describe('valuation status', () => {
    it('should determine undervalued status correctly', () => {
      const metrics = createTestMetrics({
        adoption:          10_000_000,
        annualTxValue:     1_000_000_000_000,
        annualTxCount:     100_000_000,
        developers:        1_000,
        price:             0.001,  // Very low price
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(metrics);

      expect(result.valuationStatus).toBe('undervalued');
      expect(result.valuationPercent).toBeLessThan(-10);
    });

    it('should determine overvalued status correctly', () => {
      const metrics = createTestMetrics({
        adoption:          1_000,
        annualTxValue:     1_000,
        annualTxCount:     1_000,
        developers:        1,
        price:             100_000,  // Very high price
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(metrics);

      expect(result.valuationStatus).toBe('overvalued');
      expect(result.valuationPercent).toBeGreaterThan(10);
    });

    it('should determine fairly valued status when price equals fair value', () => {
      const metrics = createTestMetrics({
        adoption:          10_000_000,
        annualTxValue:     1_000_000_000_000,
        annualTxCount:     10_000_000,
        developers:        100,
        price:             100,
        circulatingSupply: 1_000_000,
      });

      const initial = CFVCalculator.calculate(metrics);

      const adjustedMetrics = createTestMetrics({
        adoption:          10_000_000,
        annualTxValue:     1_000_000_000_000,
        annualTxCount:     10_000_000,
        developers:        100,
        price:             initial.fairValue,
        circulatingSupply: 1_000_000,
      });

      const result = CFVCalculator.calculate(adjustedMetrics);
      expect(result.valuationStatus).toBe('fairly valued');
      expect(Math.abs(result.valuationPercent)).toBeLessThan(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Input validation
  // ─────────────────────────────────────────────────────────────────────────

  describe('input validation', () => {
    it('should throw error for zero circulating supply', () => {
      const metrics = createTestMetrics({ circulatingSupply: 0 });
      expect(() => CFVCalculator.calculate(metrics)).toThrow('Supply must be greater than 0');
    });

    it('should throw error for negative circulating supply', () => {
      const metrics = createTestMetrics({ circulatingSupply: -1000 });
      expect(() => CFVCalculator.calculate(metrics)).toThrow('Supply must be greater than 0');
    });

    it('should throw error for negative price', () => {
      const metrics = createTestMetrics({ price: -1 });
      expect(() => CFVCalculator.calculate(metrics)).toThrow('Invalid price');
    });

    it('should throw error for negative adoption', () => {
      const metrics = createTestMetrics({ adoption: -1000 });
      expect(() => CFVCalculator.calculate(metrics)).toThrow('Invalid adoption');
    });

    it('should throw error for NaN values', () => {
      const metrics = createTestMetrics({ adoption: NaN });
      expect(() => CFVCalculator.calculate(metrics)).toThrow('Invalid adoption');
    });

    it('should throw error for Infinity values', () => {
      const metrics = createTestMetrics({ annualTxValue: Infinity });
      expect(() => CFVCalculator.calculate(metrics)).toThrow('Invalid annualTransactionValue');
    });

    it('should accept zero price (unpriced coin)', () => {
      const metrics = createTestMetrics({ price: 0 });
      expect(() => CFVCalculator.calculate(metrics)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Formatting utilities
  // ─────────────────────────────────────────────────────────────────────────

  describe('formatCurrency', () => {
    it('should format trillions correctly', () => {
      expect(CFVCalculator.formatCurrency(1_500_000_000_000)).toBe('$1.50T');
      expect(CFVCalculator.formatCurrency(5.5e12)).toBe('$5.50T');
    });

    it('should format billions correctly', () => {
      expect(CFVCalculator.formatCurrency(2_500_000_000)).toBe('$2.50B');
      expect(CFVCalculator.formatCurrency(1_000_000_000)).toBe('$1.00B');
    });

    it('should format millions correctly', () => {
      expect(CFVCalculator.formatCurrency(45_000_000)).toBe('$45.00M');
      expect(CFVCalculator.formatCurrency(1_500_000)).toBe('$1.50M');
    });

    it('should format thousands correctly', () => {
      expect(CFVCalculator.formatCurrency(5_500)).toBe('$5.50K');
      expect(CFVCalculator.formatCurrency(999)).toBe('$999.00');
    });

    it('should format regular dollars correctly', () => {
      expect(CFVCalculator.formatCurrency(100)).toBe('$100.00');
      expect(CFVCalculator.formatCurrency(50.5)).toBe('$50.50');
    });

    it('should format cents correctly', () => {
      expect(CFVCalculator.formatCurrency(0.5)).toBe('$0.5000');
      expect(CFVCalculator.formatCurrency(0.01)).toBe('$0.0100');
    });

    it('should format very small values in scientific notation', () => {
      const result = CFVCalculator.formatCurrency(0.00001);
      expect(result).toMatch(/\$.*e.*/);
    });

    it('should handle negative numbers', () => {
      expect(CFVCalculator.formatCurrency(-1_000_000_000)).toBe('-$1.00B');
    });
  });

  describe('formatNumber', () => {
    it('should format trillions correctly', () => {
      expect(CFVCalculator.formatNumber(1_500_000_000_000)).toBe('1.50T');
    });

    it('should format billions correctly', () => {
      expect(CFVCalculator.formatNumber(2_500_000_000)).toBe('2.50B');
    });

    it('should format millions correctly', () => {
      expect(CFVCalculator.formatNumber(45_000_000)).toBe('45.00M');
    });

    it('should format thousands correctly', () => {
      expect(CFVCalculator.formatNumber(5_500)).toBe('5.50K');
    });

    it('should format regular numbers correctly', () => {
      expect(CFVCalculator.formatNumber(999)).toBe('999');
      expect(CFVCalculator.formatNumber(100)).toBe('100');
    });
  });

  describe('getValuationDescription', () => {
    it('should provide undervalued description', () => {
      const description = CFVCalculator.getValuationDescription('undervalued', -30);
      expect(description).toContain('30.0%');
      expect(description).toContain('below fair value');
      expect(description).toContain('upside');
    });

    it('should provide overvalued description', () => {
      const description = CFVCalculator.getValuationDescription('overvalued', 40);
      expect(description).toContain('40.0%');
      expect(description).toContain('above fair value');
      expect(description).toContain('downside');
    });

    it('should provide fairly valued description', () => {
      const description = CFVCalculator.getValuationDescription('fairly valued', 5);
      expect(description).toContain('±10%');
      expect(description).toContain('fairly pricing');
    });
  });

  describe('getWeights', () => {
    it('should return the CFV formula weights', () => {
      const weights = CFVCalculator.getWeights();

      expect(weights.adoption).toBe(0.70);
      expect(weights.annualTransactions).toBe(0.10);
      expect(weights.annualTxValue).toBe(0.10);
      expect(weights.developers).toBe(0.10);
    });

    it('should return a copy of weights, not the original', () => {
      const weights1 = CFVCalculator.getWeights();
      const weights2 = CFVCalculator.getWeights();

      expect(weights1).not.toBe(weights2);
      expect(weights1).toEqual(weights2);
    });
  });

  describe('getBenchmark', () => {
    it('should return the DGS benchmark values', () => {
      const benchmark = CFVCalculator.getBenchmark();

      expect(benchmark.marketCap).toBe(1_983_000_000_000);
      expect(benchmark.adoption).toBe(80_000_000);
      expect(benchmark.annualTransactions).toBe(6_000_000_000);
      expect(benchmark.annualTxValue).toBe(13_470_000_000_000);
      expect(benchmark.developers).toBe(905);
    });

    it('should return a copy of the benchmark, not the original', () => {
      const b1 = CFVCalculator.getBenchmark();
      const b2 = CFVCalculator.getBenchmark();

      expect(b1).not.toBe(b2);
      expect(b1).toEqual(b2);
    });
  });
});
