/**
 * Unit tests for Phase 3 — Predictive Analytics
 */

import {
  PredictiveAnalyzer,
  HoltSmoother,
  LinearForecaster,
} from '../../../ml/PredictiveAnalyzer.js';
import type { HistoricalDataPoint } from '../../../utils/HistoricalAnalyzer.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDataPoints(values: number[], startHoursAgo = 168): HistoricalDataPoint[] {
  const now = Date.now();
  const intervalMs = (startHoursAgo * 3_600_000) / values.length;
  return values.map((value, i) => ({
    value,
    timestamp: new Date(now - startHoursAgo * 3_600_000 + i * intervalMs),
    confidence: 'HIGH' as const,
    source: 'test',
  }));
}

// ── HoltSmoother ─────────────────────────────────────────────────────────────

describe('HoltSmoother', () => {
  it('fits to data and returns parameters', () => {
    const holt = new HoltSmoother(0.3, 0.1);
    const data = makeDataPoints([100, 110, 120, 130, 140, 150]);
    const params = holt.fit(data);
    
    expect(params.alpha).toBe(0.3);
    expect(params.beta).toBe(0.1);
    expect(params.level).toBeGreaterThan(0);
    expect(typeof params.trend).toBe('number');
  });

  it('predicts future values in the direction of the trend', () => {
    const holt = new HoltSmoother(0.3, 0.1);
    const data = makeDataPoints([100, 110, 120, 130, 140, 150]);
    holt.fit(data);
    
    const pred1 = holt.predict(1);
    const pred5 = holt.predict(5);
    
    // Rising trend: further ahead should be higher
    expect(pred5).toBeGreaterThan(pred1);
    // Predictions should be above last value
    expect(pred1).toBeGreaterThan(140);
  });

  it('predicts declining values for falling trend', () => {
    const holt = new HoltSmoother(0.3, 0.1);
    const data = makeDataPoints([150, 140, 130, 120, 110, 100]);
    holt.fit(data);
    
    const pred1 = holt.predict(1);
    const pred5 = holt.predict(5);
    
    // Falling trend: further ahead should be lower
    expect(pred5).toBeLessThan(pred1);
  });

  it('throws error with fewer than 2 data points', () => {
    const holt = new HoltSmoother();
    expect(() => holt.fit(makeDataPoints([100]))).toThrow('Need at least 2 data points');
  });

  it('throws error when predicting before fitting', () => {
    const holt = new HoltSmoother();
    expect(() => holt.predict(1)).toThrow('Model must be fitted');
  });

  it('clamps alpha and beta to valid range', () => {
    const holt = new HoltSmoother(-0.5, 2.0);
    const data = makeDataPoints([100, 110, 120]);
    const params = holt.fit(data);
    expect(params.alpha).toBeGreaterThanOrEqual(0.01);
    expect(params.beta).toBeLessThanOrEqual(0.99);
  });
});

// ── LinearForecaster ─────────────────────────────────────────────────────────

describe('LinearForecaster', () => {
  it('fits a linear model and reports R²', () => {
    const forecaster = new LinearForecaster();
    const data = makeDataPoints([100, 200, 300, 400, 500]);
    const fit = forecaster.fit(data);
    
    expect(fit.slope).toBeGreaterThan(0);
    expect(fit.rSquared).toBeGreaterThan(0.95); // Nearly perfect linear data
  });

  it('predicts values along the regression line', () => {
    const forecaster = new LinearForecaster();
    const data = makeDataPoints([100, 200, 300, 400, 500]);
    forecaster.fit(data);
    
    const pred = forecaster.predict(24);
    expect(pred).toBeGreaterThan(500); // Should extrapolate upward
  });

  it('returns low R² for noisy data', () => {
    const forecaster = new LinearForecaster();
    const data = makeDataPoints([100, 500, 50, 800, 20, 600, 10]);
    const fit = forecaster.fit(data);
    
    expect(fit.rSquared).toBeLessThan(0.5);
  });

  it('throws error with fewer than 2 data points', () => {
    const forecaster = new LinearForecaster();
    expect(() => forecaster.fit(makeDataPoints([100]))).toThrow('Need at least 2 data points');
  });

  it('throws error when predicting before fitting', () => {
    const forecaster = new LinearForecaster();
    expect(() => forecaster.predict(1)).toThrow('Model must be fitted');
  });

  it('computes residual standard deviation', () => {
    const forecaster = new LinearForecaster();
    const data = makeDataPoints([100, 200, 300, 400, 500]);
    forecaster.fit(data);
    expect(forecaster.getResidualStdDev()).toBeGreaterThanOrEqual(0);
  });
});

// ── PredictiveAnalyzer (ensemble) ────────────────────────────────────────────

describe('PredictiveAnalyzer', () => {
  it('trains and generates a single forecast', () => {
    const analyzer = new PredictiveAnalyzer();
    const data = makeDataPoints([100, 110, 120, 130, 140, 150, 160, 170]);
    analyzer.train(data);
    
    const prediction = analyzer.forecast(24);
    expect(prediction).toHaveProperty('value');
    expect(prediction).toHaveProperty('lowerBound');
    expect(prediction).toHaveProperty('upperBound');
    expect(prediction).toHaveProperty('confidence');
    expect(prediction).toHaveProperty('horizonHours');
    expect(prediction).toHaveProperty('model');
    expect(prediction).toHaveProperty('fitQuality');
    
    expect(prediction.model).toBe('ensemble');
    expect(prediction.lowerBound).toBeLessThan(prediction.value);
    expect(prediction.upperBound).toBeGreaterThan(prediction.value);
  });

  it('generates multi-horizon forecast result', () => {
    const analyzer = new PredictiveAnalyzer();
    const data = makeDataPoints([100, 110, 120, 130, 140, 150, 160, 170]);
    analyzer.train(data);
    
    const result = analyzer.generateForecast();
    expect(result.predictions.length).toBe(5); // default horizons: 1, 6, 24, 72, 168
    expect(result.ensemble).toBeDefined();
    expect(['rising', 'falling', 'stable']).toContain(result.trend);
  });

  it('detects rising trend', () => {
    const analyzer = new PredictiveAnalyzer();
    const data = makeDataPoints(Array.from({ length: 20 }, (_, i) => 100 + i * 10));
    analyzer.train(data);
    
    const result = analyzer.generateForecast();
    expect(result.trend).toBe('rising');
  });

  it('detects falling trend', () => {
    const analyzer = new PredictiveAnalyzer();
    const data = makeDataPoints(Array.from({ length: 20 }, (_, i) => 300 - i * 10));
    analyzer.train(data);
    
    const result = analyzer.generateForecast();
    expect(result.trend).toBe('falling');
  });

  it('confidence intervals widen with longer horizons', () => {
    const analyzer = new PredictiveAnalyzer();
    const data = makeDataPoints(Array.from({ length: 20 }, (_, i) => 100 + i * 5 + (Math.random() - 0.5) * 10));
    analyzer.train(data);
    
    const short = analyzer.forecast(1);
    const long = analyzer.forecast(168);
    
    const shortWidth = short.upperBound - short.lowerBound;
    const longWidth = long.upperBound - long.lowerBound;
    
    expect(longWidth).toBeGreaterThan(shortWidth);
  });

  it('throws error with fewer than 2 data points', () => {
    const analyzer = new PredictiveAnalyzer();
    expect(() => analyzer.train(makeDataPoints([100]))).toThrow('Need at least 2 data points');
  });

  it('allows custom horizon values', () => {
    const analyzer = new PredictiveAnalyzer();
    const data = makeDataPoints([100, 110, 120, 130, 140]);
    analyzer.train(data);
    
    const result = analyzer.generateForecast([12, 48]);
    expect(result.predictions.length).toBe(2);
    expect(result.predictions[0].horizonHours).toBe(12);
    expect(result.predictions[1].horizonHours).toBe(48);
  });

  it('exposes sub-models', () => {
    const analyzer = new PredictiveAnalyzer();
    const models = analyzer.getModels();
    expect(models.holt).toBeInstanceOf(HoltSmoother);
    expect(models.linear).toBeInstanceOf(LinearForecaster);
  });
});
