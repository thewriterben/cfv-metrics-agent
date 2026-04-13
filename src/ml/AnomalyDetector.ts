/**
 * Phase 3 — ML-Based Anomaly Detection
 *
 * Provides multiple anomaly detection strategies that work together
 * as an ensemble for robust detection of unusual metric values:
 *
 *   1. EWMA (Exponentially Weighted Moving Average) detector
 *   2. Isolation Forest (simplified, pure-TS implementation)
 *   3. Multi-metric correlation detector
 *
 * The ensemble score is the weighted average of individual detectors.
 * No external ML libraries are required — all algorithms are implemented
 * in pure TypeScript for portability and minimal dependency footprint.
 */

import type { HistoricalDataPoint } from '../utils/HistoricalAnalyzer.js';
import type {
  AnomalyScore,
  DetectorResult,
  EWMAState,
  IsolationForestConfig,
} from './types.js';

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_EWMA_ALPHA = 0.3;
const DEFAULT_EWMA_THRESHOLD = 3.0; // standard deviations
const DEFAULT_IF_CONFIG: IsolationForestConfig = {
  numTrees: 100,
  subsampleSize: 256,
  threshold: 0.6,
};
const ENSEMBLE_WEIGHTS = { ewma: 0.4, isolationForest: 0.35, correlation: 0.25 };

// ── EWMA Detector ────────────────────────────────────────────────────────────

/**
 * Exponentially Weighted Moving Average anomaly detector.
 *
 * Maintains a running mean and variance using exponential smoothing,
 * then flags values that exceed a configurable number of standard
 * deviations from the current estimate.
 */
export class EWMADetector {
  private alpha: number;
  private threshold: number;
  private state: EWMAState;

  constructor(alpha: number = DEFAULT_EWMA_ALPHA, threshold: number = DEFAULT_EWMA_THRESHOLD) {
    this.alpha = Math.max(0, Math.min(1, alpha));
    this.threshold = threshold;
    this.state = { mean: 0, variance: 0, count: 0 };
  }

  /** Reset internal state */
  reset(): void {
    this.state = { mean: 0, variance: 0, count: 0 };
  }

  /** Get current EWMA state */
  getState(): Readonly<EWMAState> {
    return { ...this.state };
  }

  /**
   * Train the detector on a batch of historical data.
   * Points are processed in chronological order.
   */
  train(data: HistoricalDataPoint[]): void {
    const sorted = [...data].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    for (const point of sorted) {
      this.update(point.value);
    }
  }

  /**
   * Update running statistics with a new value (online learning).
   */
  update(value: number): void {
    if (this.state.count === 0) {
      this.state.mean = value;
      this.state.variance = 0;
      this.state.count = 1;
      return;
    }
    const diff = value - this.state.mean;
    this.state.mean += this.alpha * diff;
    this.state.variance =
      (1 - this.alpha) * (this.state.variance + this.alpha * diff * diff);
    this.state.count++;
  }

  /**
   * Detect whether a new value is anomalous.
   */
  detect(value: number): DetectorResult {
    if (this.state.count < 2) {
      return { name: 'ewma', score: 0, isAnomaly: false };
    }

    const stdDev = Math.sqrt(this.state.variance);
    if (stdDev === 0) {
      const isAnomaly = value !== this.state.mean;
      return {
        name: 'ewma',
        score: isAnomaly ? 1.0 : 0,
        isAnomaly,
        details: { zScore: isAnomaly ? Infinity : 0, mean: this.state.mean, stdDev: 0 },
      };
    }

    const zScore = Math.abs(value - this.state.mean) / stdDev;
    const score = Math.min(1, zScore / (this.threshold * 2));

    return {
      name: 'ewma',
      score,
      isAnomaly: zScore > this.threshold,
      details: { zScore, mean: this.state.mean, stdDev },
    };
  }
}

// ── Isolation Forest ─────────────────────────────────────────────────────────

interface ITreeNode {
  splitValue: number;
  left: ITreeNode | null;
  right: ITreeNode | null;
  size: number;
  depth: number;
}

/**
 * Simplified Isolation Forest for univariate anomaly detection.
 *
 * The core idea: anomalies are easier to isolate with random splits
 * and therefore have shorter average path lengths in the forest.
 */
export class IsolationForest {
  private config: IsolationForestConfig;
  private trees: ITreeNode[] = [];
  private trained = false;

  constructor(config: Partial<IsolationForestConfig> = {}) {
    this.config = { ...DEFAULT_IF_CONFIG, ...config };
  }

  /** Train the forest on historical data */
  train(data: HistoricalDataPoint[]): void {
    const values = data.map((d) => d.value);
    if (values.length < 4) {
      this.trained = false;
      return;
    }

    const maxDepth = Math.ceil(Math.log2(Math.min(values.length, this.config.subsampleSize)));
    this.trees = [];

    for (let i = 0; i < this.config.numTrees; i++) {
      const subsample = this.sampleWithoutReplacement(
        values,
        Math.min(values.length, this.config.subsampleSize),
      );
      this.trees.push(this.buildTree(subsample, 0, maxDepth));
    }
    this.trained = true;
  }

  /** Detect whether a value is anomalous */
  detect(value: number): DetectorResult {
    if (!this.trained || this.trees.length === 0) {
      return { name: 'isolation_forest', score: 0, isAnomaly: false };
    }

    const avgPathLength =
      this.trees.reduce((sum, tree) => sum + this.pathLength(value, tree, 0), 0) /
      this.trees.length;

    const n = this.config.subsampleSize;
    const c = this.avgPathLengthC(n);
    // Anomaly score: s(x, n) = 2^(-E(h(x)) / c(n))
    const score = Math.pow(2, -avgPathLength / c);

    return {
      name: 'isolation_forest',
      score,
      isAnomaly: score > this.config.threshold,
      details: { avgPathLength, expectedPathLength: c },
    };
  }

  // ── Private helpers ──────────────────────────────────────────────

  private buildTree(values: number[], depth: number, maxDepth: number): ITreeNode {
    if (values.length <= 1 || depth >= maxDepth) {
      return { splitValue: 0, left: null, right: null, size: values.length, depth };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return { splitValue: min, left: null, right: null, size: values.length, depth };
    }

    const splitValue = min + Math.random() * (max - min);
    const leftValues = values.filter((v) => v < splitValue);
    const rightValues = values.filter((v) => v >= splitValue);

    return {
      splitValue,
      left: this.buildTree(leftValues, depth + 1, maxDepth),
      right: this.buildTree(rightValues, depth + 1, maxDepth),
      size: values.length,
      depth,
    };
  }

  private pathLength(value: number, node: ITreeNode, currentDepth: number): number {
    if (node.left === null || node.right === null) {
      return currentDepth + this.avgPathLengthC(node.size);
    }
    if (value < node.splitValue) {
      return this.pathLength(value, node.left, currentDepth + 1);
    }
    return this.pathLength(value, node.right, currentDepth + 1);
  }

  /** Average path length of unsuccessful search in BST (harmonic number approx) */
  private avgPathLengthC(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    const harmonicNumber = Math.log(n - 1) + 0.5772156649; // Euler–Mascheroni constant
    return 2 * harmonicNumber - (2 * (n - 1)) / n;
  }

  private sampleWithoutReplacement(arr: number[], size: number): number[] {
    const copy = [...arr];
    const result: number[] = [];
    for (let i = 0; i < size && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy[idx]);
      copy[idx] = copy[copy.length - 1];
      copy.pop();
    }
    return result;
  }
}

// ── Multi-Metric Correlation Detector ────────────────────────────────────────

export interface CorrelationPair {
  metricA: string;
  metricB: string;
  correlation: number;
}

/**
 * Detects anomalies by checking whether the relationships between
 * multiple metrics remain consistent with historical correlations.
 *
 * For example, if price and transaction count are normally correlated
 * at 0.8, a sudden decorrelation may indicate anomalous data.
 */
export class CorrelationDetector {
  private baselineCorrelations: Map<string, number> = new Map();

  /**
   * Compute baseline correlations from historical data.
   * `metricsMap` keys are metric names, values are arrays of data points
   * that should be aligned by timestamp.
   */
  train(metricsMap: Map<string, HistoricalDataPoint[]>): void {
    this.baselineCorrelations.clear();
    const names = Array.from(metricsMap.keys());

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = metricsMap.get(names[i])!.map((d) => d.value);
        const b = metricsMap.get(names[j])!.map((d) => d.value);
        const len = Math.min(a.length, b.length);
        if (len < 3) continue;

        const cor = pearsonCorrelation(a.slice(0, len), b.slice(0, len));
        const key = `${names[i]}|${names[j]}`;
        this.baselineCorrelations.set(key, cor);
      }
    }
  }

  /**
   * Detect anomalies by comparing current metric correlations with baselines.
   * `currentValues` maps metric names to their latest values.
   * `recentData` maps metric names to their recent history (for window correlation).
   */
  detect(recentData: Map<string, HistoricalDataPoint[]>): DetectorResult {
    if (this.baselineCorrelations.size === 0) {
      return { name: 'correlation', score: 0, isAnomaly: false };
    }

    const names = Array.from(recentData.keys());
    let totalDeviation = 0;
    let pairCount = 0;

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = `${names[i]}|${names[j]}`;
        const reverseKey = `${names[j]}|${names[i]}`;
        const baseline = this.baselineCorrelations.get(key) ?? this.baselineCorrelations.get(reverseKey);
        if (baseline === undefined) continue;

        const a = recentData.get(names[i])!.map((d) => d.value);
        const b = recentData.get(names[j])!.map((d) => d.value);
        const len = Math.min(a.length, b.length);
        if (len < 3) continue;

        const currentCor = pearsonCorrelation(a.slice(0, len), b.slice(0, len));
        totalDeviation += Math.abs(currentCor - baseline);
        pairCount++;
      }
    }

    if (pairCount === 0) {
      return { name: 'correlation', score: 0, isAnomaly: false };
    }

    const avgDeviation = totalDeviation / pairCount;
    // Normalise: deviation of 0.5 in correlation → score ≈ 1.0
    const score = Math.min(1, avgDeviation / 0.5);

    return {
      name: 'correlation',
      score,
      isAnomaly: score > 0.5,
      details: { avgDeviation, pairsChecked: pairCount },
    };
  }

  /** Get current baseline correlations */
  getBaselines(): CorrelationPair[] {
    return Array.from(this.baselineCorrelations.entries()).map(([key, correlation]) => {
      const [metricA, metricB] = key.split('|');
      return { metricA, metricB, correlation };
    });
  }
}

// ── Ensemble Anomaly Detector ────────────────────────────────────────────────

/**
 * Ensemble anomaly detector that combines EWMA, Isolation Forest,
 * and correlation analysis into a single anomaly score.
 */
export class AnomalyDetector {
  private ewma: EWMADetector;
  private forest: IsolationForest;
  private correlation: CorrelationDetector;
  private weights: typeof ENSEMBLE_WEIGHTS;

  constructor(
    ewmaAlpha?: number,
    forestConfig?: Partial<IsolationForestConfig>,
  ) {
    this.ewma = new EWMADetector(ewmaAlpha);
    this.forest = new IsolationForest(forestConfig);
    this.correlation = new CorrelationDetector();
    this.weights = { ...ENSEMBLE_WEIGHTS };
  }

  /**
   * Train all sub-detectors on historical data.
   *
   * @param data - Single-metric historical data for EWMA and IF
   * @param multiMetricData - Optional multi-metric data for correlation detector
   */
  train(
    data: HistoricalDataPoint[],
    multiMetricData?: Map<string, HistoricalDataPoint[]>,
  ): void {
    this.ewma.train(data);
    this.forest.train(data);
    if (multiMetricData) {
      this.correlation.train(multiMetricData);
    }
  }

  /**
   * Detect whether a new value is anomalous using the ensemble.
   *
   * @param value - The new value to check
   * @param recentMultiMetric - Optional recent multi-metric data for correlation check
   */
  detect(
    value: number,
    recentMultiMetric?: Map<string, HistoricalDataPoint[]>,
  ): AnomalyScore {
    const detectors: DetectorResult[] = [];

    // 1. EWMA detector
    const ewmaResult = this.ewma.detect(value);
    detectors.push(ewmaResult);

    // 2. Isolation Forest
    const ifResult = this.forest.detect(value);
    detectors.push(ifResult);

    // 3. Correlation detector
    const corResult = recentMultiMetric
      ? this.correlation.detect(recentMultiMetric)
      : { name: 'correlation', score: 0, isAnomaly: false } as DetectorResult;
    detectors.push(corResult);

    // Weighted ensemble score
    const score =
      this.weights.ewma * ewmaResult.score +
      this.weights.isolationForest * ifResult.score +
      this.weights.correlation * corResult.score;

    // Severity classification
    let severity: AnomalyScore['severity'] = 'none';
    if (score > 0.8) severity = 'severe';
    else if (score > 0.5) severity = 'moderate';
    else if (score > 0.3) severity = 'mild';

    const isAnomaly = score > 0.4;

    // Build explanation
    const reasons: string[] = [];
    if (ewmaResult.isAnomaly) {
      const z = (ewmaResult.details as Record<string, number> | undefined)?.zScore;
      reasons.push(`EWMA: value deviates ${z?.toFixed(1) ?? '?'}σ from expected`);
    }
    if (ifResult.isAnomaly) {
      reasons.push('Isolation Forest: value is easily isolated from normal data');
    }
    if (corResult.isAnomaly) {
      reasons.push('Correlation: metric relationships deviate from historical patterns');
    }

    // Confidence based on how many detectors agree
    const agreeing = detectors.filter((d) => d.isAnomaly).length;
    let confidence: AnomalyScore['confidence'];
    if (agreeing >= 2) confidence = 'HIGH';
    else if (agreeing === 1) confidence = 'MEDIUM';
    else confidence = 'LOW';

    // Update EWMA state with this value (online learning)
    this.ewma.update(value);

    return { score, isAnomaly, severity, detectors, confidence, reasons };
  }

  /** Get sub-detector instances for testing or fine-tuning */
  getDetectors() {
    return {
      ewma: this.ewma,
      forest: this.forest,
      correlation: this.correlation,
    };
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Pearson correlation coefficient between two equal-length arrays.
 * Returns a value in [−1, 1]. Returns 0 if either array has zero variance.
 */
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;

  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }

  const denom = Math.sqrt(ssXX * ssYY);
  return denom === 0 ? 0 : ssXY / denom;
}

export { pearsonCorrelation };
