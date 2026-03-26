/**
 * CFV Calculator — Digital Gold Standard Formula
 * Based on "Beyond Bitcoin: The Digital Gold Standard Benchmark & Crypto Fair Value Formula"
 * by Sir John Wright Gotts
 *
 * The Digital Gold Standard (DGS) calculates fair value for any Layer-1 cryptocurrency
 * by measuring its fundamental metrics relative to Bitcoin's fixed December 2024 benchmark.
 *
 * Formula:
 *   S = (0.70 × adoption/80M) + (0.10 × txCount/6B) + (0.10 × txValue/$13.47T) + (0.10 × devs/905)
 *   Fair Market Cap = $1.983T × S
 *   Fair Coin Price = Fair Market Cap / Circulating Supply
 *
 * Self-check: Bitcoin at calibration (all ratios = 1.0) → S = 1.0 → CFV = $1.983T → $100,000/BTC ✓
 */

import type { CFVMetrics, CFVCalculation, ValuationStatus, ComponentScores } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Digital Gold Standard Benchmark (DGSB)
// Fixed December 2024 values — never updated
// Source: "Beyond Bitcoin" by Sir John Wright Gotts, Chapters 19–23
// ─────────────────────────────────────────────────────────────────────────────
export const DGS_BENCHMARK = {
  /** Bitcoin's market capitalisation at December 2024 — the constant multiplier */
  marketCap: 1_983_000_000_000,          // $1.983 Trillion

  /** Unique Bitcoin owners (conservative central estimate, Dec 2024) */
  adoption: 80_000_000,                  // 80 Million users

  /** Annual Bitcoin transactions (on-chain + Lightning Network, Dec 2024) */
  annualTransactions: 6_000_000_000,     // 6 Billion transactions

  /** Annual Bitcoin transaction value (entity-adjusted, Dec 2024) */
  annualTxValue: 13_470_000_000_000,     // $13.47 Trillion

  /** Active Bitcoin developers (core + Lightning + major wallets, Dec 2024) */
  developers: 905,                       // 905 active developers
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CFV Formula Weights
// ─────────────────────────────────────────────────────────────────────────────
export const CFV_WEIGHTS = {
  adoption: 0.70,            // 70% — Adoption (dominant metric per Menger's theory)
  annualTransactions: 0.10,  // 10% — Transaction Count
  annualTxValue: 0.10,       // 10% — Transaction Value
  developers: 0.10,          // 10% — Developer Ecosystem
} as const;

// Valuation thresholds (±10% = fairly valued)
const UNDERVALUED_THRESHOLD = -10;
const OVERVALUED_THRESHOLD = 10;

export class CFVCalculator {
  /**
   * Calculate CFV using the Digital Gold Standard formula.
   *
   * Steps:
   *   1. Normalise each metric as a ratio to the DGS benchmark.
   *   2. Apply weights to produce composite score S.
   *   3. Fair Market Cap = DGS benchmark market cap × S.
   *   4. Fair Coin Price = Fair Market Cap / Circulating Supply.
   *   5. Compare to current price to determine valuation status.
   *
   * @param metrics - The four fundamental CFV metrics plus price and supply
   * @returns Complete CFV calculation result
   * @throws Error if any required metric is invalid
   */
  static calculate(metrics: CFVMetrics): CFVCalculation {
    const adoption       = metrics.adoption.value;
    const annualTxValue  = metrics.annualTransactionValue.value;
    const annualTxCount  = metrics.annualTransactions.value;
    const developers     = metrics.developers.value;
    const currentPrice   = metrics.price.value;
    const supply         = metrics.circulatingSupply.value;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!isFinite(currentPrice) || isNaN(currentPrice) || currentPrice < 0) {
      throw new Error(`Invalid price: ${currentPrice}. Price must be a non-negative finite number`);
    }

    if (!isFinite(supply) || isNaN(supply) || supply <= 0) {
      throw new Error(`Invalid circulating supply: ${supply}. Supply must be greater than 0`);
    }

    const metricValues = [adoption, annualTxValue, annualTxCount, developers];
    const metricNames  = ['adoption', 'annualTransactionValue', 'annualTransactions', 'developers'];

    for (let i = 0; i < metricValues.length; i++) {
      if (!isFinite(metricValues[i]) || isNaN(metricValues[i])) {
        throw new Error(`Invalid ${metricNames[i]}: ${metricValues[i]}. Must be a finite number`);
      }
      if (metricValues[i] < 0) {
        throw new Error(`Invalid ${metricNames[i]}: ${metricValues[i]}. Cannot be negative`);
      }
    }

    // ── Step 1: Normalise each metric against the DGS benchmark ──────────────
    const componentScores: ComponentScores = {
      adoptionScore:         adoption      / DGS_BENCHMARK.adoption,
      transactionCountScore: annualTxCount / DGS_BENCHMARK.annualTransactions,
      transactionValueScore: annualTxValue / DGS_BENCHMARK.annualTxValue,
      developerScore:        developers    / DGS_BENCHMARK.developers,
    };

    // ── Step 2: Weighted composite score S ───────────────────────────────────
    const compositeScore =
      CFV_WEIGHTS.adoption           * componentScores.adoptionScore +
      CFV_WEIGHTS.annualTransactions * componentScores.transactionCountScore +
      CFV_WEIGHTS.annualTxValue      * componentScores.transactionValueScore +
      CFV_WEIGHTS.developers         * componentScores.developerScore;

    if (!isFinite(compositeScore) || isNaN(compositeScore)) {
      throw new Error(`Invalid composite score: ${compositeScore}. Check input values`);
    }

    // ── Step 3: Fair Market Cap ───────────────────────────────────────────────
    const fairMarketCap = DGS_BENCHMARK.marketCap * compositeScore;

    // ── Step 4: Fair Coin Price ───────────────────────────────────────────────
    const fairValue = fairMarketCap / supply;

    if (!isFinite(fairValue) || isNaN(fairValue)) {
      throw new Error(`Invalid fair value: ${fairValue}. Check circulating supply`);
    }

    // ── Step 5: Valuation metrics ─────────────────────────────────────────────
    const currentMarketCap = currentPrice * supply;
    const valuationPercent = fairValue > 0
      ? ((currentPrice - fairValue) / fairValue) * 100
      : 0;
    const priceMultiplier = fairValue > 0 ? currentPrice / fairValue : 0;

    let valuationStatus: ValuationStatus;
    if (valuationPercent < UNDERVALUED_THRESHOLD) {
      valuationStatus = 'undervalued';
    } else if (valuationPercent > OVERVALUED_THRESHOLD) {
      valuationStatus = 'overvalued';
    } else {
      valuationStatus = 'fairly valued';
    }

    return {
      compositeScore,
      fairMarketCap,
      fairValue,
      currentPrice,
      currentMarketCap,
      valuationStatus,
      valuationPercent,
      priceMultiplier,
      componentScores,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Formatting utilities
  // ─────────────────────────────────────────────────────────────────────────

  /** Format a number as a currency string with T/B/M/K suffix */
  static formatCurrency(value: number): string {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3)  return `${sign}$${(abs / 1e3).toFixed(2)}K`;
    if (abs >= 1)    return `${sign}$${abs.toFixed(2)}`;
    if (abs >= 0.01) return `${sign}$${abs.toFixed(4)}`;
    return `${sign}$${abs.toExponential(2)}`;
  }

  /** Format a large number with T/B/M/K suffix */
  static formatNumber(value: number): string {
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9)  return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6)  return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3)  return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(0);
  }

  /** Get a human-readable valuation description */
  static getValuationDescription(status: ValuationStatus, percent: number): string {
    switch (status) {
      case 'undervalued':
        return `The current price is ${Math.abs(percent).toFixed(1)}% below fair value, suggesting potential upside.`;
      case 'overvalued':
        return `The current price is ${percent.toFixed(1)}% above fair value, suggesting potential downside.`;
      case 'fairly valued':
        return `The current price is within ±10% of fair value, suggesting the market is fairly pricing the asset.`;
    }
  }

  /** Get the CFV formula weights */
  static getWeights() {
    return { ...CFV_WEIGHTS };
  }

  /** Get the DGS benchmark values */
  static getBenchmark() {
    return { ...DGS_BENCHMARK };
  }

  /**
   * Get the default community composite scoring weights.
   * Used by collectors to combine on-chain, GitHub, and social data
   * into the single Adoption figure fed into the CFV formula.
   */
  static getCommunityWeights(): { onChain: number; github: number; social: number } {
    return { onChain: 0.5, github: 0.3, social: 0.2 };
  }
}
