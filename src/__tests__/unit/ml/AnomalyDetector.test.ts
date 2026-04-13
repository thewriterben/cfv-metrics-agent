/**
 * Unit tests for Phase 3 — ML Anomaly Detection
 */

import {
  AnomalyDetector,
  EWMADetector,
  IsolationForest,
  CorrelationDetector,
  pearsonCorrelation,
} from '../../../ml/AnomalyDetector.js';
import type { HistoricalDataPoint } from '../../../utils/HistoricalAnalyzer.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDataPoints(values: number[], startHoursAgo = 100): HistoricalDataPoint[] {
  const now = Date.now();
  const intervalMs = (startHoursAgo * 3_600_000) / values.length;
  return values.map((value, i) => ({
    value,
    timestamp: new Date(now - startHoursAgo * 3_600_000 + i * intervalMs),
    confidence: 'HIGH' as const,
    source: 'test',
  }));
}

// ── pearsonCorrelation ───────────────────────────────────────────────────────

describe('pearsonCorrelation', () => {
  it('returns 1 for perfectly correlated arrays', () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(r).toBeCloseTo(1.0, 5);
  });

  it('returns −1 for perfectly inversely correlated arrays', () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
    expect(r).toBeCloseTo(-1.0, 5);
  });

  it('returns 0 for uncorrelated data', () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [5, 5, 5, 5, 5]);
    expect(r).toBe(0);
  });

  it('returns 0 for fewer than 2 data points', () => {
    expect(pearsonCorrelation([1], [2])).toBe(0);
    expect(pearsonCorrelation([], [])).toBe(0);
  });
});

// ── EWMADetector ─────────────────────────────────────────────────────────────

describe('EWMADetector', () => {
  it('initialises with zero state', () => {
    const d = new EWMADetector();
    const state = d.getState();
    expect(state.count).toBe(0);
    expect(state.mean).toBe(0);
  });

  it('trains on historical data and tracks running mean', () => {
    const d = new EWMADetector(0.3);
    const data = makeDataPoints([100, 101, 99, 100, 102, 98, 100]);
    d.train(data);
    const state = d.getState();
    expect(state.count).toBe(7);
    expect(state.mean).toBeGreaterThan(95);
    expect(state.mean).toBeLessThan(105);
  });

  it('detects normal values as non-anomalous', () => {
    const d = new EWMADetector(0.3, 3.0);
    const data = makeDataPoints([100, 101, 99, 100, 102, 98, 100, 101, 99]);
    d.train(data);
    const result = d.detect(100);
    expect(result.isAnomaly).toBe(false);
    expect(result.score).toBeLessThan(0.5);
  });

  it('detects extreme values as anomalous', () => {
    const d = new EWMADetector(0.3, 3.0);
    const data = makeDataPoints([100, 101, 99, 100, 102, 98, 100, 101, 99]);
    d.train(data);
    const result = d.detect(200);
    expect(result.isAnomaly).toBe(true);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('returns non-anomalous when not enough data', () => {
    const d = new EWMADetector();
    d.update(100);
    const result = d.detect(200);
    expect(result.isAnomaly).toBe(false);
  });

  it('can be reset', () => {
    const d = new EWMADetector();
    d.update(100);
    d.reset();
    expect(d.getState().count).toBe(0);
  });
});

// ── IsolationForest ──────────────────────────────────────────────────────────

describe('IsolationForest', () => {
  it('trains and detects normal values', () => {
    const forest = new IsolationForest({ numTrees: 50, subsampleSize: 50 });
    const data = makeDataPoints(Array.from({ length: 100 }, () => 100 + (Math.random() - 0.5) * 10));
    forest.train(data);
    const result = forest.detect(100);
    expect(result.name).toBe('isolation_forest');
    // Normal value should have lower anomaly score
    expect(result.score).toBeLessThan(0.8);
  });

  it('assigns higher anomaly score to outlier values', () => {
    const forest = new IsolationForest({ numTrees: 50, subsampleSize: 50, threshold: 0.6 });
    // Tight cluster around 100
    const values = Array.from({ length: 100 }, () => 100 + (Math.random() - 0.5) * 2);
    const data = makeDataPoints(values);
    forest.train(data);
    
    const normalResult = forest.detect(100);
    const outlierResult = forest.detect(1000);
    
    // Outlier should score higher
    expect(outlierResult.score).toBeGreaterThan(normalResult.score);
  });

  it('returns non-anomalous when not trained', () => {
    const forest = new IsolationForest();
    const result = forest.detect(100);
    expect(result.isAnomaly).toBe(false);
    expect(result.score).toBe(0);
  });

  it('handles insufficient data gracefully', () => {
    const forest = new IsolationForest();
    forest.train(makeDataPoints([1, 2, 3])); // Less than 4
    const result = forest.detect(100);
    expect(result.isAnomaly).toBe(false);
  });
});

// ── CorrelationDetector ──────────────────────────────────────────────────────

describe('CorrelationDetector', () => {
  it('learns baseline correlations', () => {
    const detector = new CorrelationDetector();
    const metricsMap = new Map<string, HistoricalDataPoint[]>();
    metricsMap.set('price', makeDataPoints([100, 200, 300, 400, 500]));
    metricsMap.set('volume', makeDataPoints([10, 20, 30, 40, 50]));
    
    detector.train(metricsMap);
    const baselines = detector.getBaselines();
    expect(baselines.length).toBe(1);
    expect(baselines[0].correlation).toBeCloseTo(1.0, 3);
  });

  it('detects decorrelation as anomalous', () => {
    const detector = new CorrelationDetector();
    const metricsMap = new Map<string, HistoricalDataPoint[]>();
    metricsMap.set('price', makeDataPoints([100, 200, 300, 400, 500]));
    metricsMap.set('volume', makeDataPoints([10, 20, 30, 40, 50]));
    detector.train(metricsMap);
    
    // Now check with decorrelated recent data
    const recentData = new Map<string, HistoricalDataPoint[]>();
    recentData.set('price', makeDataPoints([100, 200, 300, 400, 500], 5));
    recentData.set('volume', makeDataPoints([50, 40, 30, 20, 10], 5)); // Inversely correlated
    
    const result = detector.detect(recentData);
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns non-anomalous when no baselines exist', () => {
    const detector = new CorrelationDetector();
    const recentData = new Map<string, HistoricalDataPoint[]>();
    recentData.set('price', makeDataPoints([100, 200, 300]));
    
    const result = detector.detect(recentData);
    expect(result.isAnomaly).toBe(false);
    expect(result.score).toBe(0);
  });
});

// ── Ensemble AnomalyDetector ─────────────────────────────────────────────────

describe('AnomalyDetector (ensemble)', () => {
  it('trains and detects with single-metric data', () => {
    const detector = new AnomalyDetector();
    const data = makeDataPoints(
      Array.from({ length: 50 }, () => 100 + (Math.random() - 0.5) * 5),
    );
    detector.train(data);
    
    const result = detector.detect(100);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('isAnomaly');
    expect(result).toHaveProperty('severity');
    expect(result).toHaveProperty('detectors');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reasons');
    expect(result.detectors).toHaveLength(3);
  });

  it('classifies normal values as non-anomalous', () => {
    const detector = new AnomalyDetector();
    const data = makeDataPoints(
      Array.from({ length: 50 }, () => 100 + (Math.random() - 0.5) * 5),
    );
    detector.train(data);
    
    const result = detector.detect(100);
    expect(result.severity).toBe('none');
  });

  it('classifies extreme outliers with higher severity', () => {
    const detector = new AnomalyDetector(0.3, { numTrees: 50 });
    const data = makeDataPoints(
      Array.from({ length: 50 }, () => 100 + (Math.random() - 0.5) * 2),
    );
    detector.train(data);
    
    const normalResult = detector.detect(100);
    const outlierResult = detector.detect(500);
    
    expect(outlierResult.score).toBeGreaterThan(normalResult.score);
  });

  it('trains with multi-metric data for correlation detection', () => {
    const detector = new AnomalyDetector();
    const mainData = makeDataPoints([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    const multiMetric = new Map<string, HistoricalDataPoint[]>();
    multiMetric.set('price', mainData);
    multiMetric.set('volume', makeDataPoints([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]));
    
    detector.train(mainData, multiMetric);
    
    const result = detector.detect(1100, multiMetric);
    expect(result.detectors).toHaveLength(3);
  });

  it('provides explanatory reasons when anomaly detected', () => {
    const detector = new AnomalyDetector(0.3, { numTrees: 50 });
    const data = makeDataPoints(
      Array.from({ length: 50 }, () => 100),
    );
    detector.train(data);
    
    const result = detector.detect(1000);
    if (result.isAnomaly) {
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it('exposes sub-detectors for fine-tuning', () => {
    const detector = new AnomalyDetector();
    const detectors = detector.getDetectors();
    expect(detectors.ewma).toBeInstanceOf(EWMADetector);
    expect(detectors.forest).toBeInstanceOf(IsolationForest);
    expect(detectors.correlation).toBeInstanceOf(CorrelationDetector);
  });
});
