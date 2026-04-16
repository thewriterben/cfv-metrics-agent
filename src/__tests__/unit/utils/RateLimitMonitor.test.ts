import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RateLimitMonitor } from '../../../utils/RateLimitMonitor.js';

/**
 * Phase 4 — RateLimitMonitor unit tests
 */

describe('RateLimitMonitor', () => {
  let monitor: RateLimitMonitor;

  beforeEach(() => {
    monitor = new RateLimitMonitor();
  });

  afterEach(() => {
    monitor.dispose();
  });

  describe('getStatus', () => {
    it('should return status for a known service', () => {
      const status = monitor.getStatus('coingecko');
      expect(status).not.toBeNull();
      expect(status?.service).toBe('coingecko');
      expect(typeof status?.used).toBe('number');
      expect(typeof status?.limit).toBe('number');
      expect(typeof status?.remaining).toBe('number');
      expect(typeof status?.percentage).toBe('number');
      expect(status?.resetAt).toBeInstanceOf(Date);
      expect(typeof status?.isNearLimit).toBe('boolean');
    });

    it('should return null for an unknown service', () => {
      const status = monitor.getStatus('unknown_service' as any);
      expect(status).toBeNull();
    });

    it('should track all monitored services', () => {
      const services = ['coingecko', 'etherscan', 'github', 'blockchair', 'cryptocompare'] as const;
      for (const service of services) {
        expect(monitor.getStatus(service)).not.toBeNull();
      }
    });
  });

  describe('getAllStatus', () => {
    it('should return statuses for all services', () => {
      const statuses = monitor.getAllStatus();
      expect(statuses.length).toBe(5);
      expect(statuses.map(s => s.service)).toEqual(
        expect.arrayContaining(['coingecko', 'etherscan', 'github', 'blockchair', 'cryptocompare'])
      );
    });
  });

  describe('incrementUsage', () => {
    it('should increment used count for a service', () => {
      const before = monitor.getStatus('coingecko')!.used;
      monitor.incrementUsage('coingecko');
      const after = monitor.getStatus('coingecko')!.used;
      expect(after).toBe(before + 1);
    });

    it('should update remaining count correctly', () => {
      const status = monitor.getStatus('etherscan')!;
      const initialRemaining = status.remaining;
      monitor.incrementUsage('etherscan');
      const newStatus = monitor.getStatus('etherscan')!;
      expect(newStatus.remaining).toBe(initialRemaining - 1);
    });
  });

  describe('isNearLimit', () => {
    it('should return false when usage is low', () => {
      expect(monitor.isNearLimit('coingecko')).toBe(false);
    });
  });

  describe('hasExceededLimit', () => {
    it('should return false when usage is zero', () => {
      expect(monitor.hasExceededLimit('coingecko')).toBe(false);
    });
  });

  describe('resetWindow', () => {
    it('should reset usage to zero', () => {
      monitor.incrementUsage('github');
      monitor.incrementUsage('github');
      monitor.resetWindow('github');
      const status = monitor.getStatus('github')!;
      expect(status.used).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should not throw when disposing', () => {
      expect(() => monitor.dispose()).not.toThrow();
    });
  });
});
