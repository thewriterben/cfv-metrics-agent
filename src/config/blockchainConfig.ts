/**
 * Blockchain Configuration
 * 
 * Contains verified launch dates, genesis dates, and other blockchain-specific constants.
 * These values are used to calculate dynamic metrics like daysLive.
 * 
 * Sources:
 * - BTC: Bitcoin whitepaper October 2008, Genesis block January 3, 2009
 * - ETH: Ethereum mainnet launch July 30, 2015
 * - DASH: Dash (formerly Darkcoin) launch January 18, 2014
 * - DGB: DigiByte launch January 10, 2014
 * - XMR: Monero launch April 18, 2014
 * - RVN: Ravencoin launch October 31, 2017
 * - XCH: Chia mainnet launch March 19, 2021
 * - XEC: eCash (formerly Bitcoin Cash ABC) launch November 15, 2020
 * - XNO: Nano (formerly RaiBlocks) beta launch March 2015, rebranded to Nano January 2018
 * - NEAR: NEAR Protocol mainnet launch April 22, 2020
 * - ICP: Internet Computer mainnet launch May 10, 2021
 * - EGLD: Elrond (now MultiversX) mainnet launch July 30, 2020
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
  'DASH': {
    symbol: 'DASH',
    name: 'Dash',
    genesisDate: '2014-01-18',
    notes: 'Originally launched as Darkcoin'
  },
  'DGB': {
    symbol: 'DGB',
    name: 'DigiByte',
    genesisDate: '2014-01-10'
  },
  'XMR': {
    symbol: 'XMR',
    name: 'Monero',
    genesisDate: '2014-04-18'
  },
  'RVN': {
    symbol: 'RVN',
    name: 'Ravencoin',
    genesisDate: '2017-10-31'
  },
  'XCH': {
    symbol: 'XCH',
    name: 'Chia',
    genesisDate: '2021-03-19',
    notes: 'Chia mainnet launch'
  },
  'XEC': {
    symbol: 'XEC',
    name: 'eCash',
    genesisDate: '2020-11-15',
    notes: 'eCash launch (formerly Bitcoin Cash ABC)'
  },
  'XNO': {
    symbol: 'XNO',
    name: 'Nano',
    genesisDate: '2015-03-01',
    notes: 'Beta launch as RaiBlocks in March 2015, rebranded to Nano in January 2018'
  },
  'NEAR': {
    symbol: 'NEAR',
    name: 'NEAR Protocol',
    genesisDate: '2020-04-22',
    notes: 'NEAR mainnet launch'
  },
  'ICP': {
    symbol: 'ICP',
    name: 'Internet Computer',
    genesisDate: '2021-05-10',
    notes: 'Internet Computer mainnet launch'
  },
  'EGLD': {
    symbol: 'EGLD',
    name: 'MultiversX',
    genesisDate: '2020-07-30',
    notes: 'Elrond mainnet launch (now MultiversX)'
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
