import type { CFVMetrics, MetricResult } from '../../types/index.js';
import { DGS_BENCHMARK } from '../../utils/CFVCalculator.js';

/**
 * Create a test metric result
 */
export function createTestMetricResult(
  value: number,
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH',
  source: string = 'test'
): MetricResult {
  return {
    value,
    confidence,
    source,
    timestamp: new Date(),
    metadata: {},
  };
}

/**
 * Create test CFV metrics with default values.
 * Uses the `adoption` field (unique holders) as specified in "Beyond Bitcoin".
 */
export function createTestMetrics(overrides?: Partial<{
  adoption: number;
  annualTxValue: number;
  annualTxCount: number;
  developers: number;
  price: number;
  circulatingSupply: number;
}>): CFVMetrics {
  const defaults = {
    adoption:          1_000_000,
    annualTxValue:     1_000_000_000,
    annualTxCount:     10_000_000,
    developers:        100,
    price:             100,
    circulatingSupply: 1_000_000,
  };

  const values = { ...defaults, ...overrides };

  return {
    adoption:               createTestMetricResult(values.adoption),
    annualTransactionValue: createTestMetricResult(values.annualTxValue),
    annualTransactions:     createTestMetricResult(values.annualTxCount),
    developers:             createTestMetricResult(values.developers),
    price:                  createTestMetricResult(values.price),
    circulatingSupply:      createTestMetricResult(values.circulatingSupply),
  };
}

/**
 * Bitcoin at the December 2024 DGS calibration point.
 * All ratios should equal 1.0, composite score S = 1.0,
 * fair market cap = $1.983T, fair price = $100,000.
 */
export const mockBTCMetrics: CFVMetrics = {
  adoption:               createTestMetricResult(DGS_BENCHMARK.adoption,           'HIGH', 'DGS Benchmark'),
  annualTransactionValue: createTestMetricResult(DGS_BENCHMARK.annualTxValue,       'HIGH', 'DGS Benchmark'),
  annualTransactions:     createTestMetricResult(DGS_BENCHMARK.annualTransactions,  'HIGH', 'DGS Benchmark'),
  developers:             createTestMetricResult(DGS_BENCHMARK.developers,          'HIGH', 'DGS Benchmark'),
  price:                  createTestMetricResult(100_000,                           'HIGH', 'CoinGecko'),
  circulatingSupply:      createTestMetricResult(19_830_000,                        'HIGH', 'CoinGecko'),
};

/**
 * Ethereum — representative metrics for testing (not DGS calibration values)
 */
export const mockETHMetrics: CFVMetrics = {
  adoption:               createTestMetricResult(50_000_000,           'HIGH', 'CoinGecko'),
  annualTransactionValue: createTestMetricResult(3_000_000_000_000,    'HIGH', 'Etherscan'),
  annualTransactions:     createTestMetricResult(1_200_000_000,        'HIGH', 'Etherscan'),
  developers:             createTestMetricResult(2_400,                'HIGH', 'Electric Capital'),
  price:                  createTestMetricResult(3_500,                'HIGH', 'CoinGecko'),
  circulatingSupply:      createTestMetricResult(120_000_000,          'HIGH', 'Etherscan'),
};

/**
 * Create multiple metric results for validation testing
 */
export function createMultipleMetricResults(
  values: number[],
  confidences?: ('HIGH' | 'MEDIUM' | 'LOW')[],
  sources?: string[]
): MetricResult[] {
  return values.map((value, index) => ({
    value,
    confidence: confidences?.[index] || 'HIGH',
    source: sources?.[index] || `source-${index}`,
    timestamp: new Date(Date.now() - index * 1000 * 60),
    metadata: {},
  }));
}
