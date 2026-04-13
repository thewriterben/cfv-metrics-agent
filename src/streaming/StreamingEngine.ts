/**
 * Phase 3 — Real-Time Streaming Engine
 *
 * Event-driven streaming pipeline that:
 *   - Periodically collects metrics at configurable intervals
 *   - Emits events for metric updates, anomaly alerts, predictions, and sentiment
 *   - Supports backpressure via bounded buffers
 *   - Provides a subscriber/listener pattern for downstream consumers
 *
 * Uses Node.js EventEmitter internally. WebSocket or SSE adapters can
 * subscribe to events for real-time client delivery.
 */

import { EventEmitter } from 'events';
import type {
  StreamEvent,
  StreamEventType,
  StreamConfig,
} from '../ml/types.js';

// ── Default Configuration ────────────────────────────────────────────────────

const DEFAULT_CONFIG: StreamConfig = {
  intervals: {
    price: 60,          // 1 minute
    transactions: 300,  // 5 minutes
    adoption: 3600,     // 1 hour
    developers: 86400,  // 24 hours
    sentiment: 900,     // 15 minutes
  },
  maxBufferSize: 1000,
  coins: [],
  enableAnomalyAlerts: true,
  enablePredictions: true,
};

// ── Types ────────────────────────────────────────────────────────────────────

export type StreamListener<T = unknown> = (event: StreamEvent<T>) => void;

export interface StreamStats {
  totalEvents: number;
  droppedEvents: number;
  activeSubscriptions: number;
  bufferSize: number;
  isRunning: boolean;
  uptimeMs: number;
}

// ── Streaming Engine ─────────────────────────────────────────────────────────

export class StreamingEngine {
  private emitter: EventEmitter;
  private config: StreamConfig;
  private buffer: StreamEvent[] = [];
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private running = false;
  private startTime = 0;
  private stats = { totalEvents: 0, droppedEvents: 0 };
  private paused = false;

  constructor(config: Partial<StreamConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (config.intervals) {
      this.config.intervals = { ...DEFAULT_CONFIG.intervals, ...config.intervals };
    }
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  /**
   * Start the streaming engine.
   * Begins periodic emission cycles for all configured coins.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTime = Date.now();
    this.paused = false;
  }

  /**
   * Stop the streaming engine and clear all timers.
   */
  stop(): void {
    this.running = false;
    for (const [key, timer] of this.timers) {
      clearInterval(timer);
      this.timers.delete(key);
    }
    this.buffer = [];
  }

  /**
   * Pause event emission without stopping timers.
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume event emission after a pause.
   */
  resume(): void {
    this.paused = false;
    // Flush buffered events
    this.flushBuffer();
  }

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function.
   */
  subscribe<T = unknown>(
    eventType: StreamEventType,
    listener: StreamListener<T>,
  ): () => void {
    const wrappedListener = (event: StreamEvent<T>) => {
      listener(event);
    };
    this.emitter.on(eventType, wrappedListener);
    return () => {
      this.emitter.off(eventType, wrappedListener);
    };
  }

  /**
   * Subscribe to all event types.
   * Returns an unsubscribe function.
   */
  subscribeAll<T = unknown>(listener: StreamListener<T>): () => void {
    const eventTypes: StreamEventType[] = [
      'metric_update',
      'anomaly_detected',
      'prediction_update',
      'sentiment_update',
      'cfv_recalculated',
      'health_change',
      'error',
    ];

    const wrappedListener = (event: StreamEvent<T>) => {
      listener(event);
    };

    for (const type of eventTypes) {
      this.emitter.on(type, wrappedListener);
    }

    return () => {
      for (const type of eventTypes) {
        this.emitter.off(type, wrappedListener);
      }
    };
  }

  /**
   * Emit a stream event.
   * Handles backpressure by buffering or dropping events.
   */
  emit<T = unknown>(event: StreamEvent<T>): boolean {
    if (!this.running) return false;

    this.stats.totalEvents++;

    if (this.paused) {
      // Buffer while paused
      if (this.buffer.length < this.config.maxBufferSize) {
        this.buffer.push(event as StreamEvent);
        return true;
      }
      this.stats.droppedEvents++;
      return false;
    }

    // Check backpressure: if too many events are buffered
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.stats.droppedEvents++;
      // Emit error event about backpressure
      this.emitter.emit('error', {
        type: 'error' as StreamEventType,
        coinSymbol: event.coinSymbol,
        timestamp: new Date(),
        data: { message: 'Buffer full — event dropped due to backpressure' },
      });
      return false;
    }

    this.emitter.emit(event.type, event);
    return true;
  }

  /**
   * Convenience: emit a metric update event.
   */
  emitMetricUpdate(
    coinSymbol: string,
    metricName: string,
    value: number,
    confidence: string,
    source: string,
  ): boolean {
    return this.emit({
      type: 'metric_update',
      coinSymbol,
      timestamp: new Date(),
      data: { metricName, value, confidence, source },
    });
  }

  /**
   * Convenience: emit an anomaly alert event.
   */
  emitAnomalyAlert(
    coinSymbol: string,
    metricName: string,
    anomalyScore: number,
    severity: string,
    reasons: string[],
  ): boolean {
    if (!this.config.enableAnomalyAlerts) return false;
    return this.emit({
      type: 'anomaly_detected',
      coinSymbol,
      timestamp: new Date(),
      data: { metricName, anomalyScore, severity, reasons },
    });
  }

  /**
   * Convenience: emit a prediction update event.
   */
  emitPredictionUpdate(
    coinSymbol: string,
    metricName: string,
    prediction: { value: number; lowerBound: number; upperBound: number; horizonHours: number },
  ): boolean {
    if (!this.config.enablePredictions) return false;
    return this.emit({
      type: 'prediction_update',
      coinSymbol,
      timestamp: new Date(),
      data: { metricName, ...prediction },
    });
  }

  /**
   * Convenience: emit a sentiment update event.
   */
  emitSentimentUpdate(
    coinSymbol: string,
    sentimentScore: number,
    label: string,
    sampleSize: number,
  ): boolean {
    return this.emit({
      type: 'sentiment_update',
      coinSymbol,
      timestamp: new Date(),
      data: { sentimentScore, label, sampleSize },
    });
  }

  /**
   * Register a periodic task that emits events on a schedule.
   * Returns a timer key that can be used to cancel the schedule.
   */
  schedule(
    key: string,
    intervalSeconds: number,
    task: () => StreamEvent | StreamEvent[] | null,
  ): string {
    // Cancel existing timer with same key
    if (this.timers.has(key)) {
      clearInterval(this.timers.get(key)!);
    }

    const timer = setInterval(() => {
      if (!this.running || this.paused) return;
      try {
        const result = task();
        if (result === null) return;
        const events = Array.isArray(result) ? result : [result];
        for (const event of events) {
          this.emit(event);
        }
      } catch {
        // Emit error event on schedule failure
        this.emit({
          type: 'error',
          coinSymbol: 'system',
          timestamp: new Date(),
          data: { message: `Scheduled task '${key}' failed` },
        });
      }
    }, intervalSeconds * 1000);

    // Ensure the timer doesn't prevent process exit
    if (timer.unref) timer.unref();

    this.timers.set(key, timer);
    return key;
  }

  /**
   * Cancel a scheduled task.
   */
  cancelSchedule(key: string): boolean {
    const timer = this.timers.get(key);
    if (!timer) return false;
    clearInterval(timer);
    this.timers.delete(key);
    return true;
  }

  /**
   * Get current streaming statistics.
   */
  getStats(): StreamStats {
    return {
      totalEvents: this.stats.totalEvents,
      droppedEvents: this.stats.droppedEvents,
      activeSubscriptions: this.emitter.listenerCount('metric_update') +
        this.emitter.listenerCount('anomaly_detected') +
        this.emitter.listenerCount('prediction_update') +
        this.emitter.listenerCount('sentiment_update') +
        this.emitter.listenerCount('cfv_recalculated') +
        this.emitter.listenerCount('health_change') +
        this.emitter.listenerCount('error'),
      bufferSize: this.buffer.length,
      isRunning: this.running,
      uptimeMs: this.running ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<StreamConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration dynamically.
   */
  updateConfig(updates: Partial<StreamConfig>): void {
    if (updates.intervals) {
      this.config.intervals = { ...this.config.intervals, ...updates.intervals };
    }
    if (updates.maxBufferSize !== undefined) {
      this.config.maxBufferSize = updates.maxBufferSize;
    }
    if (updates.coins !== undefined) {
      this.config.coins = updates.coins;
    }
    if (updates.enableAnomalyAlerts !== undefined) {
      this.config.enableAnomalyAlerts = updates.enableAnomalyAlerts;
    }
    if (updates.enablePredictions !== undefined) {
      this.config.enablePredictions = updates.enablePredictions;
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  private flushBuffer(): void {
    while (this.buffer.length > 0 && !this.paused) {
      const event = this.buffer.shift()!;
      this.emitter.emit(event.type, event);
    }
  }
}
