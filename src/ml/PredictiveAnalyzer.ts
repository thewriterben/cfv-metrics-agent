/**
 * Phase 3 — Predictive Analytics
 *
 * Provides time-series forecasting for CFV metrics using:
 *
 *   1. Holt's Linear Exponential Smoothing (double exponential smoothing)
 *   2. Simple linear regression extrapolation
 *   3. Weighted ensemble combining both models
 *
 * All methods produce confidence intervals and a fit-quality metric.
 * No external ML libraries required.
 */

import type { HistoricalDataPoint } from '../utils/HistoricalAnalyzer.js';
import type { Prediction, ForecastResult, HoltWintersParams } from './types.js';
import type { ConfidenceLevel } from '../types/index.js';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

// ── Holt's Double Exponential Smoothing ──────────────────────────────────────

export class HoltSmoother {
  private alpha: number;
  private beta: number;
  private level: number = 0;
  private trend: number = 0;
  private fitted = false;

  constructor(alpha: number = 0.3, beta: number = 0.1) {
    this.alpha = Math.max(0.01, Math.min(0.99, alpha));
    this.beta = Math.max(0.01, Math.min(0.99, beta));
  }

  /**
   * Fit the model to historical data (chronologically sorted).
   * Returns the fitted parameters.
   */
  fit(data: HistoricalDataPoint[]): HoltWintersParams {
    if (data.length < 2) {
      throw new Error('Need at least 2 data points for Holt smoothing');
    }

    const sorted = [...data].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    // Initialise level and trend from first two points
    this.level = sorted[0].value;
    this.trend = sorted[1].value - sorted[0].value;

    // Smooth through the data
    for (let i = 1; i < sorted.length; i++) {
      const prevLevel = this.level;
      this.level =
        this.alpha * sorted[i].value + (1 - this.alpha) * (this.level + this.trend);
      this.trend =
        this.beta * (this.level - prevLevel) + (1 - this.beta) * this.trend;
    }

    this.fitted = true;
    return {
      alpha: this.alpha,
      beta: this.beta,
      level: this.level,
      trend: this.trend,
    };
  }

  /**
   * Predict the value `stepsAhead` time steps into the future.
   * Each step corresponds to the average interval between data points.
   */
  predict(stepsAhead: number): number {
    if (!this.fitted) throw new Error('Model must be fitted before prediction');
    return this.level + this.trend * stepsAhead;
  }

  /** Get current smoothed level */
  getLevel(): number {
    return this.level;
  }

  /** Get current trend per step */
  getTrend(): number {
    return this.trend;
  }
}

// ── Linear Regression Forecaster ─────────────────────────────────────────────

export class LinearForecaster {
  private slope = 0;
  private intercept = 0;
  private rSquared = 0;
  private residualStdDev = 0;
  private fitted = false;
  private baseTimestamp = 0;

  /**
   * Fit a linear regression line through the data.
   * X-axis is time in hours from the first data point.
   */
  fit(data: HistoricalDataPoint[]): { slope: number; intercept: number; rSquared: number } {
    if (data.length < 2) {
      throw new Error('Need at least 2 data points for linear regression');
    }

    const sorted = [...data].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    this.baseTimestamp = sorted[0].timestamp.getTime();
    const xs = sorted.map((d) => (d.timestamp.getTime() - this.baseTimestamp) / MS_PER_HOUR);
    const ys = sorted.map((d) => d.value);

    const n = xs.length;
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;

    let ssXY = 0;
    let ssXX = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      ssXY += (xs[i] - xMean) * (ys[i] - yMean);
      ssXX += (xs[i] - xMean) ** 2;
      ssTot += (ys[i] - yMean) ** 2;
    }

    this.slope = ssXX !== 0 ? ssXY / ssXX : 0;
    this.intercept = yMean - this.slope * xMean;

    const ssRes = ys.reduce(
      (sum, y, i) => sum + (y - (this.slope * xs[i] + this.intercept)) ** 2,
      0,
    );
    this.rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    // Residual standard deviation for confidence intervals
    this.residualStdDev = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

    this.fitted = true;
    return { slope: this.slope, intercept: this.intercept, rSquared: this.rSquared };
  }

  /**
   * Predict value at `hoursFromNow` hours into the future.
   */
  predict(hoursFromNow: number): number {
    if (!this.fitted) throw new Error('Model must be fitted before prediction');
    const hoursFromBase = (Date.now() - this.baseTimestamp) / MS_PER_HOUR + hoursFromNow;
    return this.slope * hoursFromBase + this.intercept;
  }

  /** Get the residual standard deviation for confidence intervals */
  getResidualStdDev(): number {
    return this.residualStdDev;
  }

  /** Get R² fit quality */
  getRSquared(): number {
    return this.rSquared;
  }
}

// ── Ensemble Predictive Analyzer ─────────────────────────────────────────────

/**
 * Combines Holt smoothing and linear regression into an ensemble forecaster.
 * Weights each model by its fit quality.
 */
export class PredictiveAnalyzer {
  private holt: HoltSmoother;
  private linear: LinearForecaster;
  private avgIntervalHours = 1;
  private lastDataStdDev = 0;
  private dataLength = 0;

  constructor(holtAlpha?: number, holtBeta?: number) {
    this.holt = new HoltSmoother(holtAlpha, holtBeta);
    this.linear = new LinearForecaster();
  }

  /**
   * Train both models on historical data.
   */
  train(data: HistoricalDataPoint[]): void {
    if (data.length < 2) {
      throw new Error('Need at least 2 data points for prediction');
    }

    const sorted = [...data].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    this.dataLength = sorted.length;

    // Calculate average interval between data points
    let totalInterval = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalInterval += sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime();
    }
    this.avgIntervalHours = totalInterval / (sorted.length - 1) / MS_PER_HOUR;

    // Standard deviation of values (for confidence intervals)
    const values = sorted.map((d) => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    this.lastDataStdDev = Math.sqrt(variance);

    // Fit both models
    this.holt.fit(sorted);
    this.linear.fit(sorted);
  }

  /**
   * Generate a forecast at a specific horizon.
   */
  forecast(horizonHours: number): Prediction {
    // Holt prediction (convert hours to steps)
    const steps = this.avgIntervalHours > 0 ? horizonHours / this.avgIntervalHours : horizonHours;
    const holtValue = this.holt.predict(steps);

    // Linear prediction
    const linearValue = this.linear.predict(horizonHours);

    // Weighted ensemble based on fit quality
    const linearR2 = Math.max(0, this.linear.getRSquared());
    const holtWeight = 0.6; // Holt generally tracks recent trends better
    const linearWeight = 0.4 * linearR2; // Scale by fit quality
    const totalWeight = holtWeight + linearWeight;

    const ensembleValue =
      totalWeight > 0
        ? (holtWeight * holtValue + linearWeight * linearValue) / totalWeight
        : holtValue;

    // Confidence interval widens with horizon
    const horizonFactor = Math.sqrt(1 + horizonHours / 24);
    const residualStd = this.linear.getResidualStdDev();
    const intervalWidth =
      (residualStd > 0 ? residualStd : this.lastDataStdDev * 0.1) * horizonFactor * 1.96;

    // Fit quality (combined)
    const fitQuality = Math.min(1, (linearR2 * 0.4 + 0.6) * Math.min(1, this.dataLength / 10));

    // Confidence level
    let confidence: ConfidenceLevel;
    if (fitQuality > 0.7 && horizonHours <= 24) confidence = 'HIGH';
    else if (fitQuality > 0.4 && horizonHours <= 72) confidence = 'MEDIUM';
    else confidence = 'LOW';

    return {
      value: ensembleValue,
      lowerBound: ensembleValue - intervalWidth,
      upperBound: ensembleValue + intervalWidth,
      confidence,
      horizonHours,
      model: 'ensemble',
      fitQuality,
    };
  }

  /**
   * Generate a full forecast result with multiple horizons.
   */
  generateForecast(horizons: number[] = [1, 6, 24, 72, 168]): ForecastResult {
    const predictions = horizons.map((h) => this.forecast(h));

    // The 24-hour prediction is the "primary" ensemble prediction
    const ensemble = predictions.find((p) => p.horizonHours === 24) ?? predictions[0];

    // Determine trend direction from Holt's trend component
    const trendPerHour = this.holt.getTrend() / Math.max(0.01, this.avgIntervalHours);
    const currentLevel = this.holt.getLevel();
    const trendPctPerDay =
      currentLevel !== 0 ? (trendPerHour * 24) / Math.abs(currentLevel) * 100 : 0;

    let trend: ForecastResult['trend'] = 'stable';
    if (trendPctPerDay > 1) trend = 'rising';
    else if (trendPctPerDay < -1) trend = 'falling';

    // Estimate days to significant change (>10%)
    let daysToSignificantChange: number | undefined;
    if (trendPctPerDay !== 0) {
      daysToSignificantChange = Math.abs(10 / trendPctPerDay);
      if (daysToSignificantChange > 365) daysToSignificantChange = undefined; // Too far
    }

    return {
      predictions,
      ensemble,
      trend,
      daysToSignificantChange,
    };
  }

  /** Get sub-model instances */
  getModels() {
    return { holt: this.holt, linear: this.linear };
  }
}
