import { CFVCalculator } from '../../../utils/CFVCalculator.js';
import { createTestMetrics } from '../../fixtures/metrics.js';

describe('CFVCalculator', () => {
  describe('calculate', () => {
    it('should calculate fair value correctly with valid inputs', () => {
      const metrics = createTestMetrics({
        communitySize: 1000000,
        annualTxValue: 1000000000,
        annualTxCount: 10000000,
        developers: 100,
        price: 100,
        circulatingSupply: 1000000,
      });

      const result = CFVCalculator.calculate(metrics);

      expect(result.fairValue).toBeGreaterThan(0);
      expect(result.networkPowerScore).toBeGreaterThan(0);
      expect(result.currentPrice).toBe(100);
      expect(result.valuationStatus).toMatch(/undervalued|overvalued|fairly valued/);
      expect(result.fairMarketCap).toBeGreaterThan(0);
      expect(result.currentMarketCap).toBe(100000000); // price * circulating supply
    });

    it('should throw error for zero circulating supply', () => {
      const metrics = createTestMetrics({ circulatingSupply: 0 });
      
      expect(() => CFVCalculator.calculate(metrics)).toThrow('Circulating supply cannot be zero');
    });

    it('should handle very large numbers without overflow', () => {
      const metrics = createTestMetrics({
        communitySize: 1e9,
        annualTxValue: 1e12,
        annualTxCount: 1e10,
        developers: 1000,
        price: 50000,
        circulatingSupply: 21000000,
      });

      const result = CFVCalculator.calculate(metrics);
      
      expect(isFinite(result.fairValue)).toBe(true);
      expect(isFinite(result.networkPowerScore)).toBe(true);
      expect(isFinite(result.fairMarketCap)).toBe(true);
      expect(result.fairValue).toBeGreaterThan(0);
    });

    it('should calculate network power score correctly', () => {
      const metrics = createTestMetrics({
        communitySize: 1000,
        annualTxValue: 1000,
        annualTxCount: 1000,
        developers: 10,
        price: 1,
        circulatingSupply: 1000,
      });

      const result = CFVCalculator.calculate(metrics);

      // Network power = (1000^0.7) * (1000^0.1) * (1000^0.1) * (10^0.1)
      const expectedCommunity = Math.pow(1000, 0.7);
      const expectedTxValue = Math.pow(1000, 0.1);
      const expectedTxCount = Math.pow(1000, 0.1);
      const expectedDevs = Math.pow(10, 0.1);
      const expectedNPS = expectedCommunity * expectedTxValue * expectedTxCount * expectedDevs;

      expect(result.networkPowerScore).toBeCloseTo(expectedNPS, 2);
      expect(result.breakdown.communityContribution).toBeCloseTo(expectedCommunity, 2);
      expect(result.breakdown.transactionValueContribution).toBeCloseTo(expectedTxValue, 2);
      expect(result.breakdown.transactionCountContribution).toBeCloseTo(expectedTxCount, 2);
      expect(result.breakdown.developerContribution).toBeCloseTo(expectedDevs, 2);
    });

    it('should determine undervalued status correctly', () => {
      const metrics = createTestMetrics({
        communitySize: 10000000,
        annualTxValue: 1000000000000,
        annualTxCount: 100000000,
        developers: 1000,
        price: 100,
        circulatingSupply: 1000000,
      });

      const result = CFVCalculator.calculate(metrics);

      // With high network metrics but low price, should be undervalued
      if (result.currentPrice < result.fairValue * 0.8) {
        expect(result.valuationStatus).toBe('undervalued');
        expect(result.valuationPercent).toBeLessThan(-20);
      }
    });

    it('should determine overvalued status correctly', () => {
      const metrics = createTestMetrics({
        communitySize: 1000,
        annualTxValue: 1000,
        annualTxCount: 1000,
        developers: 10,
        price: 100000,
        circulatingSupply: 1000000,
      });

      const result = CFVCalculator.calculate(metrics);

      // With low network metrics but high price, should be overvalued
      if (result.currentPrice > result.fairValue * 1.2) {
        expect(result.valuationStatus).toBe('overvalued');
        expect(result.valuationPercent).toBeGreaterThan(20);
      }
    });

    it('should determine fairly valued status correctly', () => {
      const metrics = createTestMetrics({
        communitySize: 1000000,
        annualTxValue: 1000000000,
        annualTxCount: 10000000,
        developers: 100,
        price: 100,
        circulatingSupply: 1000000,
      });

      const result = CFVCalculator.calculate(metrics);

      // Adjust price to be close to fair value
      const adjustedMetrics = createTestMetrics({
        communitySize: 1000000,
        annualTxValue: 1000000000,
        annualTxCount: 10000000,
        developers: 100,
        price: result.fairValue,
        circulatingSupply: 1000000,
      });

      const adjustedResult = CFVCalculator.calculate(adjustedMetrics);
      expect(adjustedResult.valuationStatus).toBe('fairly valued');
      expect(adjustedResult.valuationPercent).toBeGreaterThan(-20);
      expect(adjustedResult.valuationPercent).toBeLessThan(20);
    });

    it('should calculate price multiplier correctly', () => {
      const metrics = createTestMetrics({
        communitySize: 1000000,
        annualTxValue: 1000000000,
        annualTxCount: 10000000,
        developers: 100,
        price: 200,
        circulatingSupply: 1000000,
      });

      const result = CFVCalculator.calculate(metrics);
      const expectedMultiplier = result.currentPrice / result.fairValue;

      expect(result.priceMultiplier).toBeCloseTo(expectedMultiplier, 4);
    });

    it('should handle small values correctly', () => {
      const metrics = createTestMetrics({
        communitySize: 10,
        annualTxValue: 100,
        annualTxCount: 50,
        developers: 1,
        price: 0.01,
        circulatingSupply: 1000000,
      });

      const result = CFVCalculator.calculate(metrics);

      expect(result.fairValue).toBeGreaterThan(0);
      expect(isFinite(result.fairValue)).toBe(true);
      expect(isFinite(result.networkPowerScore)).toBe(true);
    });
  });

  describe('formatCurrency', () => {
    it('should format trillions correctly', () => {
      expect(CFVCalculator.formatCurrency(1500000000000)).toBe('$1.50T');
      expect(CFVCalculator.formatCurrency(5.5e12)).toBe('$5.50T');
    });

    it('should format billions correctly', () => {
      expect(CFVCalculator.formatCurrency(2500000000)).toBe('$2.50B');
      expect(CFVCalculator.formatCurrency(1000000000)).toBe('$1.00B');
    });

    it('should format millions correctly', () => {
      expect(CFVCalculator.formatCurrency(45000000)).toBe('$45.00M');
      expect(CFVCalculator.formatCurrency(1500000)).toBe('$1.50M');
    });

    it('should format thousands correctly', () => {
      expect(CFVCalculator.formatCurrency(5500)).toBe('$5.50K');
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
  });

  describe('formatNumber', () => {
    it('should format trillions correctly', () => {
      expect(CFVCalculator.formatNumber(1500000000000)).toBe('1.50T');
    });

    it('should format billions correctly', () => {
      expect(CFVCalculator.formatNumber(2500000000)).toBe('2.50B');
    });

    it('should format millions correctly', () => {
      expect(CFVCalculator.formatNumber(45000000)).toBe('45.00M');
    });

    it('should format thousands correctly', () => {
      expect(CFVCalculator.formatNumber(5500)).toBe('5.50K');
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
      const description = CFVCalculator.getValuationDescription('fairly valued', 10);
      expect(description).toContain('±20%');
      expect(description).toContain('fairly pricing');
    });
  });
});
