/**
 * Unit tests for Phase 3 — Real-Time Streaming Engine
 */

import { StreamingEngine } from '../../../streaming/StreamingEngine.js';
import type { StreamEvent, StreamEventType } from '../../../ml/types.js';

describe('StreamingEngine', () => {
  let engine: StreamingEngine;

  beforeEach(() => {
    engine = new StreamingEngine({ maxBufferSize: 10 });
  });

  afterEach(() => {
    engine.stop();
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('starts and reports running status', () => {
      engine.start();
      const stats = engine.getStats();
      expect(stats.isRunning).toBe(true);
      expect(stats.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it('stops cleanly', () => {
      engine.start();
      engine.stop();
      const stats = engine.getStats();
      expect(stats.isRunning).toBe(false);
    });

    it('is idempotent on start', () => {
      engine.start();
      engine.start(); // should not throw
      expect(engine.getStats().isRunning).toBe(true);
    });
  });

  // ── Event Emission ───────────────────────────────────────────────────────

  describe('event emission', () => {
    it('emits metric update events', (done) => {
      engine.start();
      engine.subscribe('metric_update', (event: StreamEvent) => {
        expect(event.type).toBe('metric_update');
        expect(event.coinSymbol).toBe('BTC');
        expect((event.data as Record<string, unknown>).metricName).toBe('price');
        done();
      });
      
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'CoinGecko');
    });

    it('emits anomaly alert events', (done) => {
      engine.start();
      engine.subscribe('anomaly_detected', (event: StreamEvent) => {
        expect(event.type).toBe('anomaly_detected');
        expect((event.data as Record<string, unknown>).severity).toBe('severe');
        done();
      });
      
      engine.emitAnomalyAlert('BTC', 'price', 0.9, 'severe', ['EWMA: extreme deviation']);
    });

    it('emits prediction update events', (done) => {
      engine.start();
      engine.subscribe('prediction_update', (event: StreamEvent) => {
        expect(event.type).toBe('prediction_update');
        expect((event.data as Record<string, unknown>).horizonHours).toBe(24);
        done();
      });
      
      engine.emitPredictionUpdate('BTC', 'price', {
        value: 55000, lowerBound: 50000, upperBound: 60000, horizonHours: 24,
      });
    });

    it('emits sentiment update events', (done) => {
      engine.start();
      engine.subscribe('sentiment_update', (event: StreamEvent) => {
        expect(event.type).toBe('sentiment_update');
        expect((event.data as Record<string, unknown>).label).toBe('positive');
        done();
      });
      
      engine.emitSentimentUpdate('BTC', 0.6, 'positive', 100);
    });

    it('does not emit when not running', () => {
      const result = engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      expect(result).toBe(false);
    });

    it('does not emit anomaly alerts when disabled', () => {
      engine.updateConfig({ enableAnomalyAlerts: false });
      engine.start();
      const result = engine.emitAnomalyAlert('BTC', 'price', 0.9, 'severe', []);
      expect(result).toBe(false);
    });

    it('does not emit predictions when disabled', () => {
      engine.updateConfig({ enablePredictions: false });
      engine.start();
      const result = engine.emitPredictionUpdate('BTC', 'price', {
        value: 55000, lowerBound: 50000, upperBound: 60000, horizonHours: 24,
      });
      expect(result).toBe(false);
    });
  });

  // ── Subscriptions ────────────────────────────────────────────────────────

  describe('subscriptions', () => {
    it('supports unsubscribing', () => {
      engine.start();
      let callCount = 0;
      const unsub = engine.subscribe('metric_update', () => { callCount++; });
      
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      expect(callCount).toBe(1);
      
      unsub();
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      expect(callCount).toBe(1); // Should not increase
    });

    it('subscribeAll receives events of all types', () => {
      engine.start();
      const received: string[] = [];
      engine.subscribeAll((event: StreamEvent) => {
        received.push(event.type);
      });
      
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      engine.emitSentimentUpdate('BTC', 0.5, 'positive', 10);
      
      expect(received).toContain('metric_update');
      expect(received).toContain('sentiment_update');
    });

    it('subscribeAll returns unsubscribe function', () => {
      engine.start();
      let callCount = 0;
      const unsub = engine.subscribeAll(() => { callCount++; });
      
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      expect(callCount).toBe(1);
      
      unsub();
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      expect(callCount).toBe(1);
    });
  });

  // ── Backpressure ─────────────────────────────────────────────────────────

  describe('backpressure', () => {
    it('buffers events when paused', () => {
      engine.start();
      engine.pause();
      
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      engine.emitMetricUpdate('BTC', 'price', 51000, 'HIGH', 'test');
      
      const stats = engine.getStats();
      expect(stats.bufferSize).toBe(2);
    });

    it('flushes buffer on resume', (done) => {
      engine.start();
      let callCount = 0;
      engine.subscribe('metric_update', () => { callCount++; });
      
      engine.pause();
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      engine.emitMetricUpdate('BTC', 'price', 51000, 'HIGH', 'test');
      
      expect(callCount).toBe(0);
      
      engine.resume();
      
      // Give a tick for events to flush
      setTimeout(() => {
        expect(callCount).toBe(2);
        done();
      }, 10);
    });

    it('drops events when buffer is full', () => {
      engine = new StreamingEngine({ maxBufferSize: 2 });
      engine.start();
      engine.pause();
      
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      engine.emitMetricUpdate('BTC', 'price', 51000, 'HIGH', 'test');
      const result = engine.emitMetricUpdate('BTC', 'price', 52000, 'HIGH', 'test');
      
      expect(result).toBe(false);
      expect(engine.getStats().droppedEvents).toBe(1);
    });
  });

  // ── Scheduling ───────────────────────────────────────────────────────────

  describe('scheduling', () => {
    it('schedules a periodic task', (done) => {
      engine.start();
      let callCount = 0;
      
      engine.schedule('test-task', 0.1, () => {
        callCount++;
        return {
          type: 'metric_update' as StreamEventType,
          coinSymbol: 'BTC',
          timestamp: new Date(),
          data: { test: true },
        };
      });
      
      setTimeout(() => {
        expect(callCount).toBeGreaterThan(0);
        engine.cancelSchedule('test-task');
        done();
      }, 350);
    });

    it('cancels a scheduled task', () => {
      engine.start();
      engine.schedule('test-task', 1, () => null);
      const cancelled = engine.cancelSchedule('test-task');
      expect(cancelled).toBe(true);
    });

    it('returns false when cancelling non-existent task', () => {
      const cancelled = engine.cancelSchedule('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  // ── Configuration ────────────────────────────────────────────────────────

  describe('configuration', () => {
    it('returns current config', () => {
      const config = engine.getConfig();
      expect(config.intervals).toBeDefined();
      expect(config.maxBufferSize).toBe(10);
    });

    it('updates configuration dynamically', () => {
      engine.updateConfig({ maxBufferSize: 500 });
      expect(engine.getConfig().maxBufferSize).toBe(500);
    });

    it('updates interval configuration', () => {
      engine.updateConfig({ intervals: { price: 30, transactions: 300, adoption: 3600, developers: 86400, sentiment: 900 } });
      expect(engine.getConfig().intervals.price).toBe(30);
    });

    it('updates feature flags', () => {
      engine.updateConfig({ enableAnomalyAlerts: false, enablePredictions: false });
      const config = engine.getConfig();
      expect(config.enableAnomalyAlerts).toBe(false);
      expect(config.enablePredictions).toBe(false);
    });
  });

  // ── Statistics ───────────────────────────────────────────────────────────

  describe('statistics', () => {
    it('tracks total events emitted', () => {
      engine.start();
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      engine.emitMetricUpdate('BTC', 'price', 51000, 'HIGH', 'test');
      
      expect(engine.getStats().totalEvents).toBe(2);
    });

    it('tracks dropped events', () => {
      engine = new StreamingEngine({ maxBufferSize: 1 });
      engine.start();
      engine.pause();
      
      engine.emitMetricUpdate('BTC', 'price', 50000, 'HIGH', 'test');
      engine.emitMetricUpdate('BTC', 'price', 51000, 'HIGH', 'test'); // dropped
      
      expect(engine.getStats().droppedEvents).toBe(1);
    });

    it('tracks active subscriptions', () => {
      const unsub = engine.subscribe('metric_update', () => {});
      expect(engine.getStats().activeSubscriptions).toBeGreaterThan(0);
      unsub();
    });
  });

  // ── Custom Events ────────────────────────────────────────────────────────

  describe('custom events', () => {
    it('emits arbitrary event types', (done) => {
      engine.start();
      engine.subscribe('cfv_recalculated', (event: StreamEvent) => {
        expect(event.type).toBe('cfv_recalculated');
        expect((event.data as Record<string, unknown>).fairValue).toBe(52000);
        done();
      });
      
      engine.emit({
        type: 'cfv_recalculated',
        coinSymbol: 'BTC',
        timestamp: new Date(),
        data: { fairValue: 52000, compositeScore: 0.95 },
      });
    });
  });
});
