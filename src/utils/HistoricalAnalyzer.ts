/**
 * Historical Data Analysis for CFV Metrics
 *
 * Provides trend analysis, moving averages, volatility tracking,
 * and anomaly detection from stored metric history data.
 *
 * This utility operates purely on in-memory data arrays —
 * it does NOT access the database directly.
 */

export interface HistoricalDataPoint {
  value: number;
  timestamp: Date;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  source?: string;
}

export interface TrendAnalysis {
  direction: 'rising' | 'falling' | 'stable';
  slope: number;
  rSquared: number;
  percentChange: number;
  periodDays: number;
}

export interface MovingAverageResult {
  sma: number;
  ema: number;
  currentValue: number;
  smaDeviation: number;
  emaDeviation: number;
  signal: 'above' | 'below' | 'at';
}

export interface VolatilityMetrics {
  standardDeviation: number;
  coefficientOfVariation: number;
  maxDrawdown: number;
  averageDailyChange: number;
  volatilityRating: 'low' | 'moderate' | 'high' | 'extreme';
}

export interface AnomalyResult {
  isAnomaly: boolean;
  zScore: number;
  expectedRange: { min: number; max: number };
  severity: 'none' | 'mild' | 'moderate' | 'severe';
}

export interface HistoricalSummary {
  trend: TrendAnalysis;
  movingAverage: MovingAverageResult;
  volatility: VolatilityMetrics;
  latestAnomaly: AnomalyResult;
  dataQuality: {
    totalPoints: number;
    highConfidencePoints: number;
    averageAge: number;
    gapCount: number;
  };
}

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

export class HistoricalAnalyzer {
  /**
   * Analyse the trend direction and strength of a metric over time
   * using ordinary least-squares linear regression.
   */
  static analyzeTrend(
    data: HistoricalDataPoint[],
    periodDays?: number,
  ): TrendAnalysis {
    const defaultResult: TrendAnalysis = {
      direction: 'stable',
      slope: 0,
      rSquared: 0,
      percentChange: 0,
      periodDays: 0,
    };

    if (data.length < 2) return defaultResult;

    const sorted = HistoricalAnalyzer.sortByTime(data);
    const filtered = periodDays
      ? HistoricalAnalyzer.filterByPeriod(sorted, periodDays)
      : sorted;

    if (filtered.length < 2) return defaultResult;

    const firstTs = filtered[0].timestamp.getTime();
    const lastTs = filtered[filtered.length - 1].timestamp.getTime();
    const spanDays = (lastTs - firstTs) / MS_PER_DAY;
    if (spanDays === 0) return defaultResult;

    // Convert timestamps to "days since first point" for regression
    const xs = filtered.map((d) => (d.timestamp.getTime() - firstTs) / MS_PER_DAY);
    const ys = filtered.map((d) => d.value);

    const { slope, rSquared } = HistoricalAnalyzer.linearRegression(xs, ys);

    const firstValue = filtered[0].value;
    const lastValue = filtered[filtered.length - 1].value;
    const percentChange =
      firstValue !== 0 ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100 : 0;

    // Normalise slope as % of mean per day to decide direction
    const mean = HistoricalAnalyzer.mean(ys);
    const slopePctPerDay = mean !== 0 ? (slope / Math.abs(mean)) * 100 : 0;

    let direction: TrendAnalysis['direction'] = 'stable';
    if (slopePctPerDay > 1) direction = 'rising';
    else if (slopePctPerDay < -1) direction = 'falling';

    return {
      direction,
      slope,
      rSquared,
      percentChange,
      periodDays: spanDays,
    };
  }

  /**
   * Compute simple and exponential moving averages over the most
   * recent `window` data points.
   */
  static calculateMovingAverage(
    data: HistoricalDataPoint[],
    window: number = 7,
  ): MovingAverageResult {
    const defaultResult: MovingAverageResult = {
      sma: 0,
      ema: 0,
      currentValue: 0,
      smaDeviation: 0,
      emaDeviation: 0,
      signal: 'at',
    };

    if (data.length === 0) return defaultResult;

    const sorted = HistoricalAnalyzer.sortByTime(data);
    const currentValue = sorted[sorted.length - 1].value;

    if (data.length === 1) {
      return { ...defaultResult, sma: currentValue, ema: currentValue, currentValue };
    }

    const effectiveWindow = Math.min(window, sorted.length);
    const windowSlice = sorted.slice(-effectiveWindow);

    // Simple moving average
    const sma = HistoricalAnalyzer.mean(windowSlice.map((d) => d.value));

    // Exponential moving average over the full sorted series
    const smoothing = 2 / (effectiveWindow + 1);
    let ema = sorted[0].value;
    for (let i = 1; i < sorted.length; i++) {
      ema = sorted[i].value * smoothing + ema * (1 - smoothing);
    }

    const smaDeviation = sma !== 0 ? ((currentValue - sma) / Math.abs(sma)) * 100 : 0;
    const emaDeviation = ema !== 0 ? ((currentValue - ema) / Math.abs(ema)) * 100 : 0;

    const TOLERANCE = 0.01; // 0.01 % considered "at"
    let signal: MovingAverageResult['signal'] = 'at';
    if (smaDeviation > TOLERANCE) signal = 'above';
    else if (smaDeviation < -TOLERANCE) signal = 'below';

    return { sma, ema, currentValue, smaDeviation, emaDeviation, signal };
  }

  /**
   * Measure the volatility of a metric's historical values.
   */
  static calculateVolatility(data: HistoricalDataPoint[]): VolatilityMetrics {
    const defaultResult: VolatilityMetrics = {
      standardDeviation: 0,
      coefficientOfVariation: 0,
      maxDrawdown: 0,
      averageDailyChange: 0,
      volatilityRating: 'low',
    };

    if (data.length < 2) return defaultResult;

    const sorted = HistoricalAnalyzer.sortByTime(data);
    const values = sorted.map((d) => d.value);

    const mean = HistoricalAnalyzer.mean(values);
    const standardDeviation = HistoricalAnalyzer.stddev(values);
    const coefficientOfVariation =
      mean !== 0 ? standardDeviation / Math.abs(mean) : 0;

    // Max drawdown: largest peak-to-trough decline as a percentage
    let peak = values[0];
    let maxDrawdown = 0;
    for (const v of values) {
      if (v > peak) peak = v;
      if (peak !== 0) {
        const drawdown = ((peak - v) / Math.abs(peak)) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
    }

    // Average absolute daily % change between consecutive points
    let totalAbsChange = 0;
    let changeCount = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        totalAbsChange += Math.abs(
          ((values[i] - values[i - 1]) / Math.abs(values[i - 1])) * 100,
        );
        changeCount++;
      }
    }
    const averageDailyChange = changeCount > 0 ? totalAbsChange / changeCount : 0;

    const cvPercent = coefficientOfVariation * 100;
    let volatilityRating: VolatilityMetrics['volatilityRating'] = 'low';
    if (cvPercent >= 50) volatilityRating = 'extreme';
    else if (cvPercent >= 25) volatilityRating = 'high';
    else if (cvPercent >= 10) volatilityRating = 'moderate';

    return {
      standardDeviation,
      coefficientOfVariation,
      maxDrawdown,
      averageDailyChange,
      volatilityRating,
    };
  }

  /**
   * Detect whether a new value is anomalous relative to historical data
   * using z-score analysis.
   */
  static detectAnomaly(
    data: HistoricalDataPoint[],
    newValue: number,
  ): AnomalyResult {
    const defaultResult: AnomalyResult = {
      isAnomaly: false,
      zScore: 0,
      expectedRange: { min: newValue, max: newValue },
      severity: 'none',
    };

    if (data.length < 2) return defaultResult;

    const values = data.map((d) => d.value);
    const mean = HistoricalAnalyzer.mean(values);
    const sd = HistoricalAnalyzer.stddev(values);

    if (sd === 0) {
      // All historical values are identical
      const isAnomaly = newValue !== mean;
      return {
        isAnomaly,
        zScore: isAnomaly ? Infinity : 0,
        expectedRange: { min: mean, max: mean },
        severity: isAnomaly ? 'severe' : 'none',
      };
    }

    const zScore = (newValue - mean) / sd;
    const absZ = Math.abs(zScore);
    const expectedRange = { min: mean - 2 * sd, max: mean + 2 * sd };

    let severity: AnomalyResult['severity'] = 'none';
    if (absZ > 4) severity = 'severe';
    else if (absZ > 3) severity = 'moderate';
    else if (absZ >= 2) severity = 'mild';

    return {
      isAnomaly: absZ >= 2,
      zScore,
      expectedRange,
      severity,
    };
  }

  /**
   * Generate a comprehensive summary combining trend, moving average,
   * volatility, anomaly, and data-quality information.
   */
  static generateSummary(data: HistoricalDataPoint[]): HistoricalSummary {
    const trend = HistoricalAnalyzer.analyzeTrend(data);
    const movingAverage = HistoricalAnalyzer.calculateMovingAverage(data);
    const volatility = HistoricalAnalyzer.calculateVolatility(data);

    const latestValue = data.length > 0
      ? HistoricalAnalyzer.sortByTime(data)[data.length - 1].value
      : 0;
    const latestAnomaly = HistoricalAnalyzer.detectAnomaly(data, latestValue);

    const now = Date.now();
    const highConfidencePoints = data.filter((d) => d.confidence === 'HIGH').length;
    const averageAge =
      data.length > 0
        ? data.reduce((sum, d) => sum + (now - d.timestamp.getTime()), 0) /
          data.length /
          MS_PER_HOUR
        : 0;

    // Count gaps > 24 h between consecutive sorted points
    const sorted = HistoricalAnalyzer.sortByTime(data);
    let gapCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime();
      if (diff > MS_PER_DAY) gapCount++;
    }

    return {
      trend,
      movingAverage,
      volatility,
      latestAnomaly,
      dataQuality: {
        totalPoints: data.length,
        highConfidencePoints,
        averageAge,
        gapCount,
      },
    };
  }

  /**
   * Return the percentile rank (0-100) of `value` within the
   * historical distribution using the "percentage of scores below" method.
   */
  static calculatePercentileRank(
    data: HistoricalDataPoint[],
    value: number,
  ): number {
    if (data.length === 0) return 0;

    const values = data.map((d) => d.value);
    const below = values.filter((v) => v < value).length;
    const equal = values.filter((v) => v === value).length;

    // Percentile = (B + 0.5 * E) / N * 100
    return ((below + 0.5 * equal) / values.length) * 100;
  }

  // ── Private helpers ────────────────────────────────────────────

  /** Sort data chronologically (oldest first), returns a new array. */
  private static sortByTime(data: HistoricalDataPoint[]): HistoricalDataPoint[] {
    return [...data].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  /** Keep only points within the last `days` days of the latest timestamp. */
  private static filterByPeriod(
    sorted: HistoricalDataPoint[],
    days: number,
  ): HistoricalDataPoint[] {
    const cutoff =
      sorted[sorted.length - 1].timestamp.getTime() - days * MS_PER_DAY;
    return sorted.filter((d) => d.timestamp.getTime() >= cutoff);
  }

  /** Arithmetic mean. */
  private static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  /** Population standard deviation. */
  private static stddev(values: number[]): number {
    if (values.length < 2) return 0;
    const m = HistoricalAnalyzer.mean(values);
    const variance =
      values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Ordinary least-squares linear regression.
   * Returns slope and R² (coefficient of determination).
   */
  private static linearRegression(
    xs: number[],
    ys: number[],
  ): { slope: number; intercept: number; rSquared: number } {
    const n = xs.length;
    const xMean = HistoricalAnalyzer.mean(xs);
    const yMean = HistoricalAnalyzer.mean(ys);

    let ssXY = 0;
    let ssXX = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const dx = xs[i] - xMean;
      const dy = ys[i] - yMean;
      ssXY += dx * dy;
      ssXX += dx * dx;
      ssTot += dy * dy;
    }

    if (ssXX === 0) return { slope: 0, intercept: yMean, rSquared: 0 };

    const slope = ssXY / ssXX;
    const intercept = yMean - slope * xMean;

    const ssRes = ys.reduce((s, y, i) => {
      const predicted = slope * xs[i] + intercept;
      return s + (y - predicted) ** 2;
    }, 0);

    const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, rSquared };
  }
}
