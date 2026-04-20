import { describe, it, expect } from '@jest/globals';
import { BLOCKCHAIN_CONFIG, getBlockchainInfo, calculateDaysLive } from '../../../config/blockchainConfig.js';

/**
 * Multi-chain configuration coverage for DGF report set
 */

describe('blockchainConfig Phase 4 additions', () => {
  it('should include ZCL (Zclassic)', () => {
    const zcl = BLOCKCHAIN_CONFIG['ZCL'];
    expect(zcl).toBeDefined();
    expect(zcl.symbol).toBe('ZCL');
    expect(zcl.name).toBe('Zclassic');
    expect(zcl.genesisDate).toBe('2016-09-28');
  });

  it('should include DGD (Digital Gold)', () => {
    const dgd = BLOCKCHAIN_CONFIG['DGD'];
    expect(dgd).toBeDefined();
    expect(dgd.symbol).toBe('DGD');
    expect(dgd.name).toBe('Digital Gold');
    expect(dgd.genesisDate).toBe('2016-03-30');
  });

  it('should include EGLD (MultiversX)', () => {
    const egld = BLOCKCHAIN_CONFIG['EGLD'];
    expect(egld).toBeDefined();
    expect(egld.symbol).toBe('EGLD');
    expect(egld.name).toBe('MultiversX');
    expect(egld.genesisDate).toBe('2020-07-30');
  });

  it('should contain all 12 DGF report coins', () => {
    const allCoins = ['DGB', 'DASH', 'XMR', 'XNO', 'ZCL', 'RVN', 'XEC', 'EGLD', 'NEAR', 'ICP', 'XCH', 'DGD'];
    for (const symbol of allCoins) {
      expect(BLOCKCHAIN_CONFIG[symbol]).toBeDefined();
    }
  });

  it('should calculate daysLive for ZCL correctly', () => {
    const ref = new Date('2020-09-28');
    const days = calculateDaysLive('ZCL', ref);
    expect(days).toBe(1461);
  });

  it('should calculate daysLive for DGD correctly', () => {
    const ref = new Date('2020-03-30');
    const days = calculateDaysLive('DGD', ref);
    // 4 years from 2016-03-30 to 2020-03-30.
    // Feb 29 2016 precedes the start date (2016-03-30), so not counted.
    // Feb 29 2020 precedes the end date (2020-03-30), so it IS counted: 4×365+1 = 1461 days.
    expect(days).toBe(1461);
  });

  it('should return correct info for ZCL via getBlockchainInfo', () => {
    const info = getBlockchainInfo('ZCL');
    expect(info).toBeDefined();
    expect(info?.symbol).toBe('ZCL');
    expect(info?.name).toBe('Zclassic');
  });

  it('should handle lowercase for new coins', () => {
    expect(getBlockchainInfo('zcl')).toEqual(getBlockchainInfo('ZCL'));
    expect(getBlockchainInfo('dgd')).toEqual(getBlockchainInfo('DGD'));
  });
});
