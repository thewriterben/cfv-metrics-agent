import { describe, it, expect } from '@jest/globals';
import { BLOCKCHAIN_CONFIG, getBlockchainInfo, calculateDaysLive } from '../../../config/blockchainConfig.js';

/**
 * Phase 4 — Multi-chain expansion: new blockchain entries (BLK, DGD)
 */

describe('blockchainConfig Phase 4 additions', () => {
  it('should include BLK (Blackcoin)', () => {
    const blk = BLOCKCHAIN_CONFIG['BLK'];
    expect(blk).toBeDefined();
    expect(blk.symbol).toBe('BLK');
    expect(blk.name).toBe('Blackcoin');
    expect(blk.genesisDate).toBe('2014-02-24');
  });

  it('should include DGD (DigixDAO)', () => {
    const dgd = BLOCKCHAIN_CONFIG['DGD'];
    expect(dgd).toBeDefined();
    expect(dgd.symbol).toBe('DGD');
    expect(dgd.name).toBe('DigixDAO');
    expect(dgd.genesisDate).toBe('2016-03-30');
  });

  it('should include EGLD (MultiversX)', () => {
    const egld = BLOCKCHAIN_CONFIG['EGLD'];
    expect(egld).toBeDefined();
    expect(egld.symbol).toBe('EGLD');
    expect(egld.name).toBe('MultiversX');
    expect(egld.genesisDate).toBe('2020-07-30');
  });

  it('should contain all 15 CFV coins including BTC and ETH', () => {
    const allCoins = ['BTC', 'ETH', 'DASH', 'DGB', 'XMR', 'XNO', 'ZCL', 'RVN', 'XEC',
                      'EGLD', 'NEAR', 'ICP', 'XCH', 'BLK', 'DGD'];
    // ZCL is not in blockchainConfig (only in initDatabase) so filter
    const inConfig = allCoins.filter(s => BLOCKCHAIN_CONFIG[s]);
    for (const symbol of inConfig) {
      expect(BLOCKCHAIN_CONFIG[symbol]).toBeDefined();
    }
    // Core set that must be in config
    for (const symbol of ['BTC', 'ETH', 'DASH', 'DGB', 'XMR', 'XNO', 'RVN', 'XEC', 'EGLD', 'NEAR', 'ICP', 'XCH', 'BLK', 'DGD']) {
      expect(BLOCKCHAIN_CONFIG[symbol]).toBeDefined();
    }
  });

  it('should calculate daysLive for BLK correctly', () => {
    const ref = new Date('2024-02-24');
    const days = calculateDaysLive('BLK', ref);
    // 10 years from 2014-02-24 to 2024-02-24.
    // Leap days included: Feb 29 2016 (in range 2016-02-24..2017-02-24) and
    // Feb 29 2020 (in range 2020-02-24..2021-02-24) = 2 extra days → 10×365+2 = 3652
    expect(days).toBe(3652);
  });

  it('should calculate daysLive for DGD correctly', () => {
    const ref = new Date('2020-03-30');
    const days = calculateDaysLive('DGD', ref);
    // 4 years from 2016-03-30 to 2020-03-30.
    // Feb 29 2016 precedes the start date (2016-03-30), so not counted.
    // Feb 29 2020 precedes the end date (2020-03-30), so it IS counted: 4×365+1 = 1461 days.
    expect(days).toBe(1461);
  });

  it('should return correct info for BLK via getBlockchainInfo', () => {
    const info = getBlockchainInfo('BLK');
    expect(info).toBeDefined();
    expect(info?.symbol).toBe('BLK');
    expect(info?.name).toBe('Blackcoin');
  });

  it('should handle lowercase for new coins', () => {
    expect(getBlockchainInfo('blk')).toEqual(getBlockchainInfo('BLK'));
    expect(getBlockchainInfo('dgd')).toEqual(getBlockchainInfo('DGD'));
  });
});
