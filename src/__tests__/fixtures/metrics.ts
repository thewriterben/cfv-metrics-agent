import type { CFVMetrics, MetricResult } from '../../types/index.js';

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
 * Create test CFV metrics with default values
 */
export function createTestMetrics(overrides?: Partial<{
  communitySize: number;
  annualTxValue: number;
  annualTxCount: number;
  developers: number;
  price: number;
  circulatingSupply: number;
}>): CFVMetrics {
  const defaults = {
    communitySize: 1000000,
    annualTxValue: 1000000000,
    annualTxCount: 10000000,
    developers: 100,
    price: 100,
    circulatingSupply: 1000000,
  };
  
  const values = { ...defaults, ...overrides };
  
  return {
    communitySize: createTestMetricResult(values.communitySize),
    annualTransactionValue: createTestMetricResult(values.annualTxValue),
    annualTransactions: createTestMetricResult(values.annualTxCount),
    developers: createTestMetricResult(values.developers),
    price: createTestMetricResult(values.price),
    circulatingSupply: createTestMetricResult(values.circulatingSupply),
  };
}

/**
 * Mock Bitcoin metrics
 */
export const mockBTCMetrics: CFVMetrics = {
  communitySize: createTestMetricResult(5420000, 'HIGH', 'CoinGecko'),
  annualTransactionValue: createTestMetricResult(2500000000000, 'MEDIUM', 'Blockchain'),
  annualTransactions: createTestMetricResult(125000000, 'MEDIUM', 'Blockchain'),
  developers: createTestMetricResult(850, 'HIGH', 'GitHub'),
  price: createTestMetricResult(45000, 'HIGH', 'CoinGecko'),
  circulatingSupply: createTestMetricResult(19500000, 'HIGH', 'CoinGecko'),
};

/**
 * Mock Ethereum metrics
 */
export const mockETHMetrics: CFVMetrics = {
  communitySize: createTestMetricResult(3200000, 'HIGH', 'CoinGecko'),
  annualTransactionValue: createTestMetricResult(1800000000000, 'HIGH', 'Etherscan'),
  annualTransactions: createTestMetricResult(365000000, 'HIGH', 'Etherscan'),
  developers: createTestMetricResult(5200, 'HIGH', 'GitHub'),
  price: createTestMetricResult(3000, 'HIGH', 'CoinGecko'),
  circulatingSupply: createTestMetricResult(120000000, 'HIGH', 'Etherscan'),
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
    timestamp: new Date(Date.now() - index * 1000 * 60), // Stagger timestamps
    metadata: {},
  }));
}
