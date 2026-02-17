# Transaction Estimation Methodology

This document describes the improved methodology for estimating transaction counts and values in the CFV Metrics Agent collectors.

## Issue Background

Several collectors used flawed or outdated heuristics for transaction estimation:
- **CoinGeckoAPICollector**: Used `avgTxValue = 0.1% of market cap`, underestimating tx counts by 100-10,000x
- **CoinGeckoMCPCollector**: Used `annualTxCount = circulating supply × 2` (placeholder heuristic)
- **NanoCollector**: Used hardcoded `daysLive = 3285` and arbitrary 5% velocity
- **NEARCollector**: Used hardcoded `daysLive = 2099`

## Solutions Implemented

### 1. Dynamic Days Live Calculation

**File**: `src/config/blockchainConfig.ts`

Created a centralized configuration with verified genesis dates for all supported blockchains:
- Bitcoin (BTC): January 3, 2009
- Ethereum (ETH): July 30, 2015
- Nano (XNO): March 1, 2015
- NEAR: April 22, 2020
- And others...

The `calculateDaysLive()` function dynamically calculates the number of days a blockchain has been live, eliminating hardcoded values that become outdated.

### 2. Improved CoinGeckoAPICollector Estimation

**File**: `src/collectors/CoinGeckoAPICollector.ts`

Replaced the single 0.1% heuristic with a **tiered approach** based on market cap:

```typescript
if (marketCap > $10B) {
  avgTxValue = marketCap × 0.05%  // Large caps have larger transactions
} else if (marketCap > $1B) {
  avgTxValue = marketCap × 0.1%   // Mid caps
} else {
  avgTxValue = supply × price × 1%  // Small caps: supply-based
}
```

**Rationale**:
- Large cap coins (BTC, ETH) typically have larger average transactions
- Small cap coins have more retail activity with smaller transactions
- Provides more realistic transaction count estimates

**Confidence**: MEDIUM (due to estimation heuristics)

### 3. Improved CoinGeckoMCPCollector Estimation

**File**: `src/collectors/CoinGeckoMCPCollector.ts`

Changed from supply-based (`supply × 2`) to **volume-based estimation**:

```typescript
if (volume24h > 0 && marketCap > 0) {
  // Use same tiered approach as CoinGeckoAPICollector
  estimatedAvgTxValue = calculateTieredAvgTx(marketCap, supply, price);
  annualTxCount = (volume24h / estimatedAvgTxValue) × 365;
} else {
  // Fallback to conservative supply-based estimate
  annualTxCount = circulatingSupply × 2;
}
```

**Rationale**:
- Volume provides a more direct measure of transaction activity
- Falls back to supply-based estimate when volume unavailable
- Consistent with CoinGeckoAPICollector methodology

**Confidence**: MEDIUM (due to estimation heuristics)

### 4. Enhanced NanoCollector

**File**: `src/collectors/NanoCollector.ts`

**Changes**:
1. Dynamic `daysLive` calculation using `calculateDaysLive('XNO')`
2. Documented 5% velocity assumption
3. Updated confidence from HIGH to MEDIUM
4. Added issue note: "Transaction value estimated using 5% annual velocity heuristic"

**Rationale**:
- Genesis date calculation is now accurate and automatic
- 5% velocity is conservative but documented as a heuristic
- Confidence downgraded to reflect estimation uncertainty

**Actual calculation**:
```typescript
daysLive = calculateDaysLive('XNO');  // Dynamic, updates daily
blocksPerDay = totalBlocks / daysLive;
annualTxCount = blocksPerDay × 365;    // High confidence (blockchain data)

// Velocity-based value estimation
annualSupplyMovement = circulatingSupply × 0.05;  // 5% velocity
annualTxValue = annualSupplyMovement × currentPrice;  // Medium confidence
```

### 5. Enhanced NEARCollector

**File**: `src/collectors/NEARCollector.ts`

**Changes**:
1. Dynamic `daysLive` calculation using `calculateDaysLive('NEAR')`
2. Removed hardcoded 2099 days

**Rationale**:
- Mainnet launch date (April 22, 2020) is now sourced from config
- Calculation stays up-to-date automatically

## Data Confidence Levels

All collectors now properly label their confidence levels:

| Collector | Metric | Confidence | Reason |
|-----------|--------|------------|--------|
| NanoCollector | annualTxCount | HIGH | Direct blockchain data |
| NanoCollector | annualTxValue | MEDIUM | Velocity-based estimate |
| NEARCollector | annualTxCount | MEDIUM | Indexed blockchain data |
| NEARCollector | annualTxValue | MEDIUM | Volume extrapolation |
| CoinGeckoAPICollector | annualTxCount | MEDIUM | Volume-based heuristic |
| CoinGeckoAPICollector | annualTxValue | MEDIUM | Volume extrapolation |
| CoinGeckoMCPCollector | annualTxCount | MEDIUM | Volume-based heuristic |
| CoinGeckoMCPCollector | annualTxValue | MEDIUM | Volume extrapolation |

## Known Limitations

1. **Velocity Assumptions**: 
   - 5% annual velocity for Nano is conservative but arbitrary
   - Real on-chain volume data would be more accurate

2. **Volume-Based Estimation**:
   - Assumes exchange volume approximates on-chain activity
   - May undercount on-chain transactions not reflected in exchange volume
   - Tiered market cap approach is educated but still heuristic

3. **ThreeXplCollector Volume Issue**:
   - 3xpl API doesn't provide volume in stats endpoint
   - Already uses CoinGecko fallback (documented in separate implementation)

## Future Improvements

1. **On-Chain Data Sources**:
   - Integrate BlockCypher, Blockchain.info, or similar for direct on-chain metrics
   - Use CoinMetrics or similar for empirical velocity ratios

2. **Machine Learning**:
   - Learn velocity patterns by coin class (PoW, PoS, DeFi, etc.)
   - Adjust estimates based on historical accuracy

3. **Regular Calibration**:
   - Periodically validate estimates against known on-chain data
   - Update heuristics based on observed patterns

4. **Expanded Genesis Dates**:
   - Add more blockchains to `blockchainConfig.ts`
   - Source genesis dates from verified blockchain explorers

## Testing

All changes are covered by tests:
- `blockchainConfig.test.ts`: Tests genesis dates and daysLive calculation
- Existing collector tests validate estimation logic

## References

- Issue: "Transaction count and velocity estimation is inaccurate for key collectors"
- Blockchain genesis dates verified from official sources
- Market cap tiers based on common cryptocurrency market classification
