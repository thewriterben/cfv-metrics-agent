import type { CoinInfo } from '../../types/index.js';

/**
 * Mock coin information
 */
export const mockBTCCoin: CoinInfo = {
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  platforms: {},
};

export const mockETHCoin: CoinInfo = {
  id: 'ethereum',
  symbol: 'ETH',
  name: 'Ethereum',
  platforms: {
    ethereum: '0x0000000000000000000000000000000000000000',
  },
};

export const mockCoins: CoinInfo[] = [
  mockBTCCoin,
  mockETHCoin,
  {
    id: 'cardano',
    symbol: 'ADA',
    name: 'Cardano',
    platforms: {},
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    platforms: {},
  },
];
