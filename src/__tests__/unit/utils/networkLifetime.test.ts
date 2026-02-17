import { describe, it, expect } from '@jest/globals';
import {
  calculateDaysSinceGenesis,
  getNetworkDaysLive,
  GENESIS_DATES
} from '../../../utils/networkLifetime.js';

describe('networkLifetime', () => {
  describe('calculateDaysSinceGenesis', () => {
    it('should calculate days between genesis and current date', () => {
      const genesis = new Date('2020-01-01T00:00:00Z');
      const current = new Date('2020-01-11T00:00:00Z');
      
      const days = calculateDaysSinceGenesis(genesis, current);
      
      expect(days).toBe(10);
    });

    it('should calculate days for a full year', () => {
      const genesis = new Date('2020-01-01T00:00:00Z');
      const current = new Date('2021-01-01T00:00:00Z');
      
      const days = calculateDaysSinceGenesis(genesis, current);
      
      // 2020 was a leap year, so 366 days
      expect(days).toBe(366);
    });

    it('should calculate days for multiple years', () => {
      const genesis = new Date('2015-10-04T00:00:00Z');
      const current = new Date('2026-02-17T00:00:00Z');
      
      const days = calculateDaysSinceGenesis(genesis, current);
      
      // Verify it's in the expected range (approximately 10+ years)
      expect(days).toBeGreaterThan(3700); // More than 10 years
      expect(days).toBeLessThan(3900); // Less than 11 years
    });

    it('should handle same-day dates', () => {
      const genesis = new Date('2020-01-01T12:00:00Z');
      const current = new Date('2020-01-01T18:00:00Z');
      
      const days = calculateDaysSinceGenesis(genesis, current);
      
      expect(days).toBe(0);
    });

    it('should use current date when not provided', () => {
      const genesis = new Date('2020-01-01T00:00:00Z');
      
      const days = calculateDaysSinceGenesis(genesis);
      
      // Should be more than 6 years (2190 days) since we're in 2026
      expect(days).toBeGreaterThan(2190);
    });
  });

  describe('GENESIS_DATES', () => {
    it('should have correct Nano genesis date', () => {
      expect(GENESIS_DATES.NANO.toISOString()).toBe('2015-10-04T00:00:00.000Z');
    });

    it('should have correct NEAR genesis date', () => {
      expect(GENESIS_DATES.NEAR.toISOString()).toBe('2020-04-22T00:00:00.000Z');
    });
  });

  describe('getNetworkDaysLive', () => {
    it('should calculate days for NANO network', () => {
      const specificDate = new Date('2026-02-17T00:00:00Z');
      
      const days = getNetworkDaysLive('NANO', specificDate);
      
      // Nano launched Oct 4, 2015
      // From Oct 4, 2015 to Feb 17, 2026 is approximately 3785 days
      expect(days).toBeGreaterThan(3780);
      expect(days).toBeLessThan(3790);
    });

    it('should calculate days for NEAR network', () => {
      const specificDate = new Date('2026-02-17T00:00:00Z');
      
      const days = getNetworkDaysLive('NEAR', specificDate);
      
      // NEAR launched April 22, 2020
      // From April 22, 2020 to Feb 17, 2026 is approximately 2127 days
      expect(days).toBeGreaterThan(2120);
      expect(days).toBeLessThan(2135);
    });

    it('should use current date when not provided', () => {
      const days = getNetworkDaysLive('NANO');
      
      // Should be at least 10 years (3650 days)
      expect(days).toBeGreaterThan(3650);
    });

    it('should return consistent results for fixed dates', () => {
      const fixedDate = new Date('2025-01-01T00:00:00Z');
      
      const days1 = getNetworkDaysLive('NANO', fixedDate);
      const days2 = getNetworkDaysLive('NANO', fixedDate);
      
      expect(days1).toBe(days2);
    });
  });
});
