# Validation Engine Architecture

## Overview

The validation system ensures data quality and reliability across all metric collection. The `UnifiedValidationEngine` combines functionality from the original `ValidationEngine` and `EnhancedValidationEngine` into a single, cohesive system.

## UnifiedValidationEngine

The unified engine provides three main validation capabilities:

### 1. Metric Results Validation

Validates and aggregates multiple `MetricResult` objects from different sources:

```typescript
import { UnifiedValidationEngine } from './validators/UnifiedValidationEngine';

const results: MetricResult[] = [
  { value: 100, confidence: 'HIGH', source: 'CoinGecko', timestamp: new Date() },
  { value: 102, confidence: 'MEDIUM', source: '3xpl', timestamp: new Date() },
  { value: 98, confidence: 'MEDIUM', source: 'Fallback', timestamp: new Date() }
];

const validation = UnifiedValidationEngine.validateMetricResults(results);

console.log(`Valid: ${validation.isValid}`);
console.log(`Confidence: ${validation.confidence}`);
console.log(`Best value: ${validation.adjustedValue}`);
console.log(`Issues: ${validation.issues.join(', ')}`);
```

**Features:**
- Outlier detection (>3 standard deviations)
- Zero value detection
- Confidence scoring based on:
  - Number of sources
  - Primary source availability
  - Data consistency (variance)
  - Individual confidence levels
- Weighted value selection (by confidence and recency)

### 2. Transaction Metrics Validation

Validates individual `TransactionMetrics` for quality:

```typescript
const metrics: TransactionMetrics = {
  annualTxCount: 50000000,
  annualTxValue: 1000000000,
  avgTxValue: 20,
  confidence: 'HIGH',
  sources: ['3xpl', 'BlockchainAPI'],
  timestamp: new Date()
};

const validation = UnifiedValidationEngine.validateTransactionMetrics(metrics);

console.log(`Score: ${validation.score}/100`);
console.log(`Confidence: ${validation.confidence}`);
console.log(`Issues: ${validation.issues.join(', ')}`);
console.log(`Warnings: ${validation.warnings?.join(', ')}`);
console.log(`Recommendations: ${validation.recommendations?.join(', ')}`);
```

**Checks:**
- Missing or zero values
- Unrealistic values (too high/low)
- Data source count
- Timestamp age
- Confidence alignment

**Scoring System:**
- 90-100: HIGH confidence
- 70-89: MEDIUM confidence
- <70: LOW confidence

### 3. Cross-Source Validation

Validates and creates consensus from multiple transaction metric sources:

```typescript
const sources: TransactionMetrics[] = [
  // Multiple metrics from different sources
];

const crossValidation = UnifiedValidationEngine.crossValidate(sources);

console.log(`Consensus TX Count: ${crossValidation.consensus.annualTxCount}`);
console.log(`Variance: ${crossValidation.variance}`);
console.log(`Agreement: ${crossValidation.agreement}%`);
console.log(`Sources: ${crossValidation.sources}`);
```

**Features:**
- Weighted averaging by confidence
- Variance calculation across sources
- Agreement percentage (100% = perfect match)
- Source aggregation
- Consensus confidence determination

## Validation Results

### ValidationResult

```typescript
interface ValidationResult {
  isValid: boolean;           // Overall validity
  confidence: ConfidenceLevel; // HIGH | MEDIUM | LOW
  issues: string[];            // Critical problems
  adjustedValue?: number;      // Best value from multiple sources
}
```

### EnhancedValidationResult

```typescript
interface EnhancedValidationResult extends ValidationResult {
  warnings?: string[];         // Non-critical issues
  recommendations?: string[];  // Suggested improvements
  score?: number;              // Quality score (0-100)
}
```

### CrossValidationResult

```typescript
interface CrossValidationResult {
  consensus: TransactionMetrics; // Aggregated best estimate
  variance: number;              // Data spread across sources
  agreement: number;             // Agreement percentage (0-100)
  sources: number;               // Number of sources used
}
```

## Confidence Levels

### HIGH Confidence
- Multiple reliable sources agree
- Low variance (<10%)
- Primary sources available
- Recent data (<24h old)
- Direct blockchain data

### MEDIUM Confidence
- 2+ sources with moderate agreement
- Moderate variance (10-20%)
- Mix of primary and secondary sources
- Data reasonably recent (<48h)
- Estimated from reliable sources

### LOW Confidence
- Single source or high disagreement
- High variance (>20%)
- Only fallback sources available
- Stale data (>48h old)
- Missing or incomplete data

## Migration from Old Engines

### ValidationEngine → UnifiedValidationEngine

**Old:**
```typescript
import { ValidationEngine } from './validators/ValidationEngine';
const result = ValidationEngine.validateMetric(results);
```

**New:**
```typescript
import { UnifiedValidationEngine } from './validators/UnifiedValidationEngine';
const result = UnifiedValidationEngine.validateMetricResults(results);
```

### EnhancedValidationEngine → UnifiedValidationEngine

**Old:**
```typescript
import { EnhancedValidationEngine } from './validators/EnhancedValidationEngine';
const engine = new EnhancedValidationEngine();
const result = engine.validate(metrics);
```

**New:**
```typescript
import { UnifiedValidationEngine } from './validators/UnifiedValidationEngine';
const result = UnifiedValidationEngine.validateTransactionMetrics(metrics);
```

## Best Practices

### 1. Always Validate Multiple Sources

```typescript
// Collect from multiple sources
const results = await Promise.all([
  collector1.collect(coin, metric),
  collector2.collect(coin, metric),
  collector3.collect(coin, metric)
]);

// Validate and aggregate
const validation = UnifiedValidationEngine.validateMetricResults(
  results.filter(r => r !== null)
);

if (validation.isValid) {
  return validation.adjustedValue;
}
```

### 2. Check Validation Score

```typescript
const validation = UnifiedValidationEngine.validateTransactionMetrics(metrics);

if (validation.score! < 70) {
  console.warn('Low quality data detected');
  console.warn('Issues:', validation.issues);
  console.warn('Warnings:', validation.warnings);
}
```

### 3. Use Cross-Validation for Critical Data

```typescript
// Collect from all available sources
const allMetrics = await Promise.all(
  collectors.map(c => c.getTransactionMetrics(coin))
);

// Create consensus
const crossVal = UnifiedValidationEngine.crossValidate(allMetrics);

if (crossVal.agreement > 80) {
  // High agreement - use consensus
  return crossVal.consensus;
} else {
  // Low agreement - investigate
  console.warn(`Only ${crossVal.agreement}% agreement`);
}
```

## Testing

The validation engine can be tested with various scenarios:

```typescript
// Test outlier detection
const withOutlier = [
  { value: 100, confidence: 'HIGH', source: 'A', timestamp: new Date() },
  { value: 105, confidence: 'HIGH', source: 'B', timestamp: new Date() },
  { value: 1000, confidence: 'LOW', source: 'C', timestamp: new Date() } // Outlier
];

// Test variance handling
const highVariance = [
  { value: 100, confidence: 'MEDIUM', source: 'A', timestamp: new Date() },
  { value: 200, confidence: 'MEDIUM', source: 'B', timestamp: new Date() }
];

// Test confidence calculation
const mixedConfidence = [
  { value: 100, confidence: 'HIGH', source: 'A', timestamp: new Date() },
  { value: 100, confidence: 'LOW', source: 'B', timestamp: new Date() }
];
```

## Related Documentation

- [Collectors Architecture](../collectors/README.md)
- [Type Definitions](../types/README.md)
- [Testing Guide](../../TESTING.md)
