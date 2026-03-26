/**
 * Blockchain Configuration
 * 
 * Contains verified launch dates, genesis dates, and other blockchain-specific constants.
 * These values are used to calculate dynamic metrics like daysLive.
 * 
 * Sources ("Beyond Bitcoin: The Digital Gold Standard Benchmark & Crypto Fair Value Formula"
 *          by Sir John Wright Gotts, Chapter 27):
 * - BTC: Bitcoin whitepaper October 2008, Genesis block January 3, 2009
 * - ETH: Ethereum mainnet launch July 30, 2015
 * - DGB: DigiByte launch January 10, 2014
 * - DASH: Digital Cash (formerly Darkcoin/XCoin) launch January 18, 2014
 * - BLK: Blackcoin launch February 24, 2014
 * - XMR: Monero launch April 18, 2014
 * - XNO: Nano (formerly RaiBlocks) released October 2015, rebranded to Nano January 2018
 * - ZCL: ZClassic launch November 6, 2016
 * - RVN: Ravencoin genesis block January 3, 2018
 * - XEC: eCash (formerly Bitcoin Cash ABC) launch November 15, 2020
 * - EGLD: Elrond (now MultiversX) mainnet launch July 30, 2020
 * - NEAR: NEAR Protocol mainnet launch October 2020
 * - ICP: Internet Computer mainnet launch May 10, 2021
 * - XCH: Chia mainnet launch March 19, 2021
 * - DGD: Digital Gold (Wealth-Preserving Money)
 */

export interface BlockchainInfo {
  symbol: string;
  name: string;
  genesisDate: string; // ISO 8601 date string
  notes?: string;
}

export const BLOCKCHAIN_CONFIG: Record<string, BlockchainInfo> = {
  'BTC': {
    symbol: 'BTC',
    name: 'Bitcoin',
    genesisDate: '2009-01-03',
    notes: 'Genesis block mined January 3, 2009'
  },
  'ETH': {
    symbol: 'ETH',
    name: 'Ethereum',
    genesisDate: '2015-07-30',
    notes: 'Ethereum mainnet launch'
  },
  'DGB': {
    symbol: 'DGB',
    name: 'DigiByte',
    genesisDate: '2014-01-10',
    notes: 'First block mined January 10, 2014'
  },
  'DASH': {
    symbol: 'DASH',
    name: 'Digital Cash',
    genesisDate: '2014-01-18',
    notes: 'Launched as XCoin, renamed Darkcoin, rebranded Digital Cash (Dash) March 2015'
  },
  'BLK': {
    symbol: 'BLK',
    name: 'Blackcoin',
    genesisDate: '2014-02-24',
    notes: 'Pure proof-of-stake pioneer, eliminated mining'
  },
  'XMR': {
    symbol: 'XMR',
    name: 'Monero',
    genesisDate: '2014-04-18'
  },
  'XNO': {
    symbol: 'XNO',
    name: 'Nano',
    genesisDate: '2015-10-01',
    notes: 'Released as RaiBlocks in October 2015, rebranded to Nano in January 2018'
  },
  'ZCL': {
    symbol: 'ZCL',
    name: 'ZClassic',
    genesisDate: '2016-11-06',
    notes: 'Forked from Zcash by Rhett Creighton, removing Founders\' Reward'
  },
  'RVN': {
    symbol: 'RVN',
    name: 'Ravencoin',
    genesisDate: '2018-01-03',
    notes: 'Genesis block January 3, 2018 — nine years to the day after Bitcoin genesis'
  },
  'XEC': {
    symbol: 'XEC',
    name: 'eCash',
    genesisDate: '2020-11-15',
    notes: 'eCash launch (formerly Bitcoin Cash ABC)'
  },
  'EGLD': {
    symbol: 'EGLD',
    name: 'MultiversX',
    genesisDate: '2020-07-30',
    notes: 'Elrond mainnet launch (now MultiversX)'
  },
  'NEAR': {
    symbol: 'NEAR',
    name: 'NEAR Protocol',
    genesisDate: '2020-10-01',
    notes: 'NEAR Protocol mainnet launched October 2020'
  },
  'ICP': {
    symbol: 'ICP',
    name: 'Internet Computer',
    genesisDate: '2021-05-10',
    notes: 'Internet Computer mainnet launch'
  },
  'XCH': {
    symbol: 'XCH',
    name: 'Chia',
    genesisDate: '2021-03-19',
    notes: 'Chia mainnet launch'
  },
  'DGD': {
    symbol: 'DGD',
    name: 'Digital Gold',
    genesisDate: '2026-01-01',
    notes: 'Digital Gold (Wealth-Preserving Money) by John Gotts, white paper 2014–2026'
  }
};

/**
 * Calculate the number of days a blockchain has been live
 * @param symbol - Blockchain symbol (e.g., 'BTC', 'ETH')
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Number of days the blockchain has been live
 */
export function calculateDaysLive(symbol: string, referenceDate?: Date): number {
  const config = BLOCKCHAIN_CONFIG[symbol.toUpperCase()];
  
  if (!config) {
    throw new Error(`No blockchain configuration found for symbol: ${symbol}`);
  }
  
  const genesisDate = new Date(config.genesisDate);
  const refDate = referenceDate || new Date();
  
  const diffMs = refDate.getTime() - genesisDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Get blockchain information
 * @param symbol - Blockchain symbol
 * @returns BlockchainInfo object or undefined if not found
 */
export function getBlockchainInfo(symbol: string): BlockchainInfo | undefined {
  return BLOCKCHAIN_CONFIG[symbol.toUpperCase()];
}
