/**
 * Phase 3 — ML & Analytics Module Exports
 */

export { AnomalyDetector, EWMADetector, IsolationForest, CorrelationDetector, pearsonCorrelation } from './AnomalyDetector.js';
export { PredictiveAnalyzer, HoltSmoother, LinearForecaster } from './PredictiveAnalyzer.js';
export { SentimentAnalyzer } from './SentimentAnalyzer.js';
export type {
  AnomalyScore,
  DetectorResult,
  EWMAState,
  IsolationForestConfig,
  Prediction,
  ForecastResult,
  HoltWintersParams,
  SentimentScore,
  SentimentCategories,
  TextItem,
  StreamEventType,
  StreamEvent,
  StreamConfig,
} from './types.js';
