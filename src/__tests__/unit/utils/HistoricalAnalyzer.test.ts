import { describe, it, expect } from '@jest/globals';
import {
  HistoricalAnalyzer,
  type HistoricalDataPoint,
} from '../../../utils/HistoricalAnalyzer.js';

function makeDataPoints(values: number[], startDaysAgo: number = 30): HistoricalDataPoint[] {
  const now = Date.now();
  const msPerDay = 86400000;
  return values.map((value, i) => ({
    value,
    timestamp: new Date(now - (startDaysAgo - i) * msPerDay),
    confidence: 'HIGH' as const,
    source: 'test',
  }));
}

describe('HistoricalAnalyzer', () => {
  describe('analyzeTrend', () => {
    it('should detect a rising trend', () => {
      const data = makeDataPoints([100, 110, 120, 130, 140, 150]);
      const result = HistoricalAnalyzer.analyzeTrend(data);
      expect(result.direction).toBe('rising');
      expect(result.slope).toBeGreaterThan(0);
      expect(result.percentChange).toBeGreaterThan(0);
      expect(result.rSquared).toBeGreaterThan(0.9);
    });

    it('should detect a falling trend', () => {
      const data = makeDataPoints([150, 130, 110, 90, 70, 50]);
      const result = HistoricalAnalyzer.analyzeTrend(data);
      expect(result.direction).toBe('falling');
      expect(result.slope).toBeLessThan(0);
      expect(result.percentChange).toBeLessThan(0);
    });

    it('should detect a stable trend', () => {
      const data = makeDataPoints([100, 100.1, 99.9, 100, 100.2, 99.8]);
      const result = HistoricalAnalyzer.analyzeTrend(data);
      expect(result.direction).toBe('stable');
    });

    it('should return default for empty data', () => {
      const result = HistoricalAnalyzer.analyzeTrend([]);
      expect(result.direction).toBe('stable');
      expect(result.slope).toBe(0);
    });

    it('should return default for single data point', () => {
      const result = HistoricalAnalyzer.analyzeTrend(makeDataPoints([100]));
      expect(result.direction).toBe('stable');
    });

    it('should filter by periodDays', () => {
      const data = makeDataPoints([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 10);
      const result = HistoricalAnalyzer.analyzeTrend(data, 5);
      expect(result.periodDays).toBeLessThanOrEqual(5);
    });
  });

  describe('calculateMovingAverage', () => {
    it('should calculate SMA and EMA', () => {
      const data = makeDataPoints([10, 20, 30, 40, 50]);
      const result = HistoricalAnalyzer.calculateMovingAverage(data, 3);

      // SMA of last 3 values: (30+40+50)/3 = 40
      expect(result.sma).toBe(40);
      expect(result.currentValue).toBe(50);
      expect(result.signal).toBe('above');
    });

    it('should handle single data point', () => {
      const data = makeDataPoints([42]);
      const result = HistoricalAnalyzer.calculateMovingAverage(data);

      expect(result.sma).toBe(42);
      expect(result.ema).toBe(42);
      expect(result.currentValue).toBe(42);
    });

    it('should handle empty data', () => {
      const result = HistoricalAnalyzer.calculateMovingAverage([]);

      expect(result.sma).toBe(0);
      expect(result.ema).toBe(0);
      expect(result.currentValue).toBe(0);
    });

    it('should handle window larger than data', () => {
      const data = makeDataPoints([10, 20, 30]);
      const result = HistoricalAnalyzer.calculateMovingAverage(data, 100);

      // SMA should be average of all 3
      expect(result.sma).toBe(20);
    });
  });

  describe('calculateVolatility', () => {
    it('should calculate low volatility for consistent data', () => {
      const data = makeDataPoints([100, 101, 99, 100, 101, 99]);
      const result = HistoricalAnalyzer.calculateVolatility(data);

      expect(result.volatilityRating).toBe('low');
      expect(result.coefficientOfVariation).toBeLessThan(0.1);
    });

    it('should detect high volatility', () => {
      const data = makeDataPoints([100, 50, 150, 30, 200, 20]);
      const result = HistoricalAnalyzer.calculateVolatility(data);

      expect(['high', 'extreme']).toContain(result.volatilityRating);
      expect(result.maxDrawdown).toBeGreaterThan(0);
    });

    it('should calculate max drawdown correctly', () => {
      const data = makeDataPoints([100, 120, 60, 80, 40]);
      const result = HistoricalAnalyzer.calculateVolatility(data);

      // Peak is 120, trough is 40, drawdown = (120-40)/120*100 = 66.67%
      expect(result.maxDrawdown).toBeCloseTo(66.67, 0);
    });

    it('should return default for insufficient data', () => {
      const result = HistoricalAnalyzer.calculateVolatility(makeDataPoints([100]));
      expect(result.standardDeviation).toBe(0);
      expect(result.volatilityRating).toBe('low');
    });
  });

  describe('detectAnomaly', () => {
    it('should not flag normal values', () => {
      const data = makeDataPoints([100, 102, 98, 101, 99, 100]);
      const result = HistoricalAnalyzer.detectAnomaly(data, 101);

      expect(result.isAnomaly).toBe(false);
      expect(result.severity).toBe('none');
    });

    it('should flag extreme anomalies', () => {
      const data = makeDataPoints([100, 102, 98, 101, 99, 100]);
      const result = HistoricalAnalyzer.detectAnomaly(data, 200);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe('severe');
      expect(Math.abs(result.zScore)).toBeGreaterThan(4);
    });

    it('should detect mild anomalies', () => {
      const data = makeDataPoints([100, 102, 98, 101, 99, 100]);
      // Need value ~2 std devs away, stddev is ~1.4, so ~103 would be mild
      const stdDev = Math.sqrt(
        data.map(d => d.value).reduce((s, v) => {
          const mean = 100;
          return s + (v - mean) ** 2;
        }, 0) / data.length,
      );
      const mildValue = 100 + 2.5 * stdDev;
      const result = HistoricalAnalyzer.detectAnomaly(data, mildValue);

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe('mild');
    });

    it('should handle insufficient data gracefully', () => {
      const result = HistoricalAnalyzer.detectAnomaly(makeDataPoints([100]), 200);
      expect(result.isAnomaly).toBe(false);
      expect(result.severity).toBe('none');
    });

    it('should handle all-identical values', () => {
      const data = makeDataPoints([100, 100, 100, 100]);
      const result = HistoricalAnalyzer.detectAnomaly(data, 101);
      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe('severe');
    });
  });

  describe('generateSummary', () => {
    it('should generate a comprehensive summary', () => {
      const data = makeDataPoints([100, 110, 120, 130, 140, 150, 160, 170, 180, 190]);
      const summary = HistoricalAnalyzer.generateSummary(data);

      expect(summary.trend.direction).toBe('rising');
      expect(summary.movingAverage.currentValue).toBe(190);
      expect(summary.volatility).toBeDefined();
      expect(summary.latestAnomaly).toBeDefined();
      expect(summary.dataQuality.totalPoints).toBe(10);
      expect(summary.dataQuality.highConfidencePoints).toBe(10);
    });

    it('should handle empty data', () => {
      const summary = HistoricalAnalyzer.generateSummary([]);

      expect(summary.trend.direction).toBe('stable');
      expect(summary.dataQuality.totalPoints).toBe(0);
    });
  });

  describe('calculatePercentileRank', () => {
    it('should calculate correct percentile rank', () => {
      const data = makeDataPoints([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      
      // Value below all data
      expect(HistoricalAnalyzer.calculatePercentileRank(data, 5)).toBe(0);
      
      // Value above all data
      expect(HistoricalAnalyzer.calculatePercentileRank(data, 110)).toBe(100);
      
      // Value at median
      const median = HistoricalAnalyzer.calculatePercentileRank(data, 55);
      expect(median).toBe(50);
    });

    it('should handle empty data', () => {
      expect(HistoricalAnalyzer.calculatePercentileRank([], 50)).toBe(0);
    });

    it('should handle value matching existing data', () => {
      const data = makeDataPoints([10, 20, 30, 40, 50]);
      const rank = HistoricalAnalyzer.calculatePercentileRank(data, 30);
      // 2 below, 1 equal, 5 total: (2 + 0.5) / 5 * 100 = 50%
      expect(rank).toBe(50);
    });
  });
});
