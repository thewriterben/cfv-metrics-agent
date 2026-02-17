/**
 * Community Scoring Constants
 * 
 * Shared constants for composite community size calculation across all collectors.
 * These values are used to normalize and weight different metrics.
 */

/**
 * Divisor for circulating supply when estimating on-chain score
 * Divides circulating supply by 1000 to normalize the value
 */
export const CIRCULATING_SUPPLY_DIVISOR = 1000;

/**
 * Maximum on-chain score cap to prevent extremely large supplies from skewing results
 */
export const MAX_ONCHAIN_SCORE = 1000000;

/**
 * Divisor for GitHub stars when calculating GitHub score
 * Stars are weighted lower as they're easier to game than contributors
 */
export const STARS_WEIGHT_DIVISOR = 1000;

/**
 * Divisor for GitHub forks when calculating GitHub score
 * Forks are weighted lower than contributors but higher than stars
 */
export const FORKS_WEIGHT_DIVISOR = 100;
