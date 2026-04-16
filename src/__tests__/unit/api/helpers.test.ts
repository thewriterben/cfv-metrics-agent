import { describe, it, expect } from '@jest/globals';
import { extractSymbol } from '../../../api/helpers.js';

/**
 * Phase 4 — Web API helpers unit tests
 */

describe('API helpers', () => {
  describe('extractSymbol', () => {
    it('should return valid symbol unchanged', () => {
      expect(extractSymbol({ symbol: 'btc' })).toBe('btc');
      expect(extractSymbol({ symbol: 'BTC' })).toBe('BTC');
      expect(extractSymbol({ symbol: 'XNO' })).toBe('XNO');
    });

    it('should accept alphanumeric symbols', () => {
      expect(extractSymbol({ symbol: 'NEAR' })).toBe('NEAR');
      expect(extractSymbol({ symbol: 'ICP' })).toBe('ICP');
      expect(extractSymbol({ symbol: 'EGLD' })).toBe('EGLD');
      expect(extractSymbol({ symbol: 'BLK' })).toBe('BLK');
      expect(extractSymbol({ symbol: 'DGD' })).toBe('DGD');
    });

    it('should throw for missing symbol', () => {
      expect(() => extractSymbol({})).toThrow('Invalid symbol parameter');
    });

    it('should throw for non-string symbol', () => {
      expect(() => extractSymbol({ symbol: 123 })).toThrow('Invalid symbol parameter');
    });

    it('should throw for symbol with special characters', () => {
      expect(() => extractSymbol({ symbol: 'BTC/ETH' })).toThrow('Symbol must be alphanumeric');
      expect(() => extractSymbol({ symbol: 'BTC ETH' })).toThrow('Symbol must be alphanumeric');
      expect(() => extractSymbol({ symbol: 'BTC-ETH' })).toThrow('Symbol must be alphanumeric');
    });
  });
});
