import { describe, it, expect } from '@jest/globals';
import { 
  calculateDaysLive, 
  getBlockchainInfo, 
  BLOCKCHAIN_CONFIG 
} from '../../../config/blockchainConfig.js';

describe('blockchainConfig', () => {
  describe('BLOCKCHAIN_CONFIG', () => {
    it('should contain all expected blockchains', () => {
      const expectedSymbols = ['BTC', 'ETH', 'DASH', 'DGB', 'XMR', 'RVN', 'XCH', 'XEC', 'XNO', 'NEAR', 'ICP', 'EGLD'];
      
      for (const symbol of expectedSymbols) {
        expect(BLOCKCHAIN_CONFIG[symbol]).toBeDefined();
        expect(BLOCKCHAIN_CONFIG[symbol].symbol).toBe(symbol);
        expect(BLOCKCHAIN_CONFIG[symbol].name).toBeTruthy();
        expect(BLOCKCHAIN_CONFIG[symbol].genesisDate).toBeTruthy();
      }
    });

    it('should have valid date formats', () => {
      for (const [symbol, config] of Object.entries(BLOCKCHAIN_CONFIG)) {
        const date = new Date(config.genesisDate);
        expect(date.toString()).not.toBe('Invalid Date');
        expect(date.getFullYear()).toBeGreaterThan(2008); // Bitcoin is first
        expect(date.getFullYear()).toBeLessThan(2025);
      }
    });
  });

  describe('calculateDaysLive', () => {
    it('should calculate days live for BTC correctly', () => {
      // Bitcoin genesis: 2009-01-03
      const referenceDate = new Date('2024-01-03');
      const daysLive = calculateDaysLive('BTC', referenceDate);
      
      // Should be exactly 15 years = 5478 days (including leap years)
      expect(daysLive).toBe(5478);
    });

    it('should calculate days live for NEAR correctly', () => {
      // NEAR mainnet: 2020-04-22
      const referenceDate = new Date('2024-04-22');
      const daysLive = calculateDaysLive('NEAR', referenceDate);
      
      // Should be exactly 4 years = 1461 days (including leap year 2020)
      expect(daysLive).toBe(1461);
    });

    it('should calculate days live for XNO correctly', () => {
      // Nano launch: 2015-03-01
      const referenceDate = new Date('2024-03-01');
      const daysLive = calculateDaysLive('XNO', referenceDate);
      
      // Should be exactly 9 years = 3288 days (including leap years)
      expect(daysLive).toBe(3288);
    });

    it('should use current date when referenceDate is not provided', () => {
      const daysLive = calculateDaysLive('BTC');
      const now = new Date();
      const genesis = new Date(BLOCKCHAIN_CONFIG['BTC'].genesisDate);
      const expectedDays = Math.floor((now.getTime() - genesis.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(daysLive).toBeCloseTo(expectedDays, 0);
    });

    it('should handle case-insensitive symbols', () => {
      const daysLiveLower = calculateDaysLive('btc', new Date('2024-01-03'));
      const daysLiveUpper = calculateDaysLive('BTC', new Date('2024-01-03'));
      
      expect(daysLiveLower).toBe(daysLiveUpper);
    });

    it('should throw error for unsupported blockchain', () => {
      expect(() => calculateDaysLive('UNKNOWN')).toThrow('No blockchain configuration found');
    });
  });

  describe('getBlockchainInfo', () => {
    it('should return blockchain info for valid symbol', () => {
      const info = getBlockchainInfo('BTC');
      
      expect(info).toBeDefined();
      expect(info?.symbol).toBe('BTC');
      expect(info?.name).toBe('Bitcoin');
      expect(info?.genesisDate).toBe('2009-01-03');
    });

    it('should handle case-insensitive symbols', () => {
      const infoLower = getBlockchainInfo('btc');
      const infoUpper = getBlockchainInfo('BTC');
      
      expect(infoLower).toEqual(infoUpper);
    });

    it('should return undefined for unsupported blockchain', () => {
      const info = getBlockchainInfo('UNKNOWN');
      
      expect(info).toBeUndefined();
    });
  });
});
