/**
 * Utility functions for calculating network lifetime
 * 
 * Provides dynamic calculation of days since genesis block
 * to avoid hardcoded outdated values that degrade over time.
 */

/**
 * Calculate the number of days between a genesis date and current date
 * @param genesisDate The genesis block date
 * @param currentDate Optional current date (defaults to now)
 * @returns Number of days since genesis
 */
export function calculateDaysSinceGenesis(
  genesisDate: Date,
  currentDate: Date = new Date()
): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const timeDiff = currentDate.getTime() - genesisDate.getTime();
  return Math.floor(timeDiff / millisecondsPerDay);
}

/**
 * Known genesis dates for various networks
 */
export const GENESIS_DATES = {
  // Nano (XNO) - October 4, 2015
  NANO: new Date('2015-10-04T00:00:00Z'),
  
  // NEAR Protocol - April 22, 2020
  NEAR: new Date('2020-04-22T00:00:00Z'),
} as const;

/**
 * Get days since genesis for a specific network
 * @param network The network name
 * @param currentDate Optional current date (defaults to now)
 * @returns Number of days since genesis
 */
export function getNetworkDaysLive(
  network: keyof typeof GENESIS_DATES,
  currentDate: Date = new Date()
): number {
  const genesisDate = GENESIS_DATES[network];
  return calculateDaysSinceGenesis(genesisDate, currentDate);
}
