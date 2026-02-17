/**
 * Test constants for DASH collector tests
 * Shared values to ensure consistency across test files
 */

/**
 * Old hardcoded values that should no longer be returned
 * These were the static values in the original implementation
 */
export const OLD_HARDCODED_DASH_VALUES = {
  annualTxCount: 18250000,
  annualTxValue: 500000000,
  avgTxValue: 27.40
} as const;

/**
 * Dash network constants used in calculations
 * Should match the values in DashApiClient.ts
 */
export const DASH_NETWORK_CONSTANTS = {
  blocksPerDay: 576, // ~2.5 minute block time
  avgTxPerBlock: 100 // Midpoint of 50-200 range observed in historical data
} as const;
