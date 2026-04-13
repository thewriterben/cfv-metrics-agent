/**
 * Phase 3 — ML & Analytics Type Definitions
 *
 * Shared interfaces for anomaly detection, predictive analytics,
 * and sentiment analysis modules.
 */

import type { ConfidenceLevel } from '../types/index.js';

// ── Anomaly Detection ────────────────────────────────────────────────────────

export interface AnomalyScore {
  /** Overall anomaly score (0 = normal, 1 = highly anomalous) */
  score: number;
  /** Whether the data point is classified as anomalous */
  isAnomaly: boolean;
  /** Human-readable severity level */
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  /** Individual detector contributions */
  detectors: DetectorResult[];
  /** Confidence in the anomaly classification */
  confidence: ConfidenceLevel;
  /** Explanation of why this was flagged (empty if not anomalous) */
  reasons: string[];
}

export interface DetectorResult {
  name: string;
  score: number;
  isAnomaly: boolean;
  details?: Record<string, unknown>;
}

export interface EWMAState {
  mean: number;
  variance: number;
  count: number;
}

export interface IsolationForestConfig {
  /** Number of isolation trees (default: 100) */
  numTrees: number;
  /** Subsample size for each tree (default: 256) */
  subsampleSize: number;
  /** Anomaly threshold (default: 0.6) */
  threshold: number;
}

// ── Predictive Analytics ─────────────────────────────────────────────────────

export interface Prediction {
  /** Predicted value */
  value: number;
  /** Confidence interval bounds */
  lowerBound: number;
  upperBound: number;
  /** Confidence level of the prediction */
  confidence: ConfidenceLevel;
  /** Prediction horizon (hours from now) */
  horizonHours: number;
  /** Which model produced this prediction */
  model: string;
  /** Model fit quality (0–1, higher is better) */
  fitQuality: number;
}

export interface ForecastResult {
  /** Array of predictions at different horizons */
  predictions: Prediction[];
  /** Ensemble prediction (combined from all models) */
  ensemble: Prediction;
  /** Trend direction */
  trend: 'rising' | 'falling' | 'stable';
  /** Estimated days until a significant change */
  daysToSignificantChange?: number;
}

export interface HoltWintersParams {
  /** Level smoothing factor (0–1) */
  alpha: number;
  /** Trend smoothing factor (0–1) */
  beta: number;
  /** Initial level */
  level: number;
  /** Initial trend */
  trend: number;
}

// ── Sentiment Analysis ───────────────────────────────────────────────────────

export interface SentimentScore {
  /** Overall sentiment score (−1 to +1) */
  score: number;
  /** Sentiment classification */
  label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
  /** Magnitude/intensity (0–1) */
  magnitude: number;
  /** Number of text items analyzed */
  sampleSize: number;
  /** Individual category breakdowns */
  categories: SentimentCategories;
}

export interface SentimentCategories {
  /** Market-related sentiment (price, trading) */
  market: number;
  /** Technology-related sentiment (development, upgrades) */
  technology: number;
  /** Community-related sentiment (adoption, governance) */
  community: number;
  /** Regulatory sentiment */
  regulatory: number;
}

export interface TextItem {
  text: string;
  source: string;
  timestamp: Date;
  weight?: number;
}

// ── Streaming ────────────────────────────────────────────────────────────────

export type StreamEventType =
  | 'metric_update'
  | 'anomaly_detected'
  | 'prediction_update'
  | 'sentiment_update'
  | 'cfv_recalculated'
  | 'health_change'
  | 'error';

export interface StreamEvent<T = unknown> {
  type: StreamEventType;
  coinSymbol: string;
  timestamp: Date;
  data: T;
  metadata?: Record<string, unknown>;
}

export interface StreamConfig {
  /** Update interval per metric type (seconds) */
  intervals: {
    price: number;        // default: 60     (1 min)
    transactions: number; // default: 300    (5 min)
    adoption: number;     // default: 3600   (1 hr)
    developers: number;   // default: 86400  (24 hr)
    sentiment: number;    // default: 900    (15 min)
  };
  /** Maximum events buffered before backpressure kicks in */
  maxBufferSize: number;
  /** Coins to track */
  coins: string[];
  /** Whether to emit anomaly alerts */
  enableAnomalyAlerts: boolean;
  /** Whether to emit prediction updates */
  enablePredictions: boolean;
}
