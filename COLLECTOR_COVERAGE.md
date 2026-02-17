# Collector Coverage Documentation

This document provides a comprehensive overview of the data sources and confidence levels for each of the 12 DGF (Digital Gold Fund) coins supported by the CFV Metrics Agent.

## Data Source Summary

| Coin | Symbol | Primary Source | Fallback | Confidence | Notes |
|------|--------|---------------|----------|------------|-------|
| Bitcoin | BTC | 3xpl | CoinGecko | MEDIUM | TX count from 3xpl, volume from CoinGecko |
| Ethereum | ETH | 3xpl | CoinGecko | MEDIUM | TX count from 3xpl, volume from CoinGecko |
| Dash | DASH | Dash API | CoinGecko | MEDIUM-HIGH | Direct blockchain API |
| DigiByte | DGB | 3xpl | CoinGecko | MEDIUM | TX count from 3xpl, volume from CoinGecko |
| eCash | XEC | 3xpl | CoinGecko | MEDIUM | TX count from 3xpl, volume from CoinGecko |
| Nano | XNO | Nano RPC | — | HIGH | Direct node RPC access |
| NEAR | NEAR | NearBlocks API | CoinGecko | MEDIUM | Custom collector |
| Internet Computer | ICP | CoinGecko | — | MEDIUM | No native API available |
| Monero | XMR | CoinGecko only | — | LOW | Privacy coin — on-chain data not accessible |
| Ravencoin | RVN | CoinGecko only | — | LOW | No blockchain explorer API available |
| Chia | XCH | CoinGecko only | — | LOW | No blockchain explorer API available |
| Zclassic | ZCL | CoinGecko only | — | LOW | No blockchain explorer API available |

## Confidence Level Definitions

### HIGH Confidence
Coins with **direct blockchain node access** or **official APIs** that provide real transaction data:
- **Nano (XNO)**: Direct RPC node access provides accurate, real-time transaction counts and values
- **Dash (DASH)**: Official Dash API with verified blockchain statistics

These sources provide the most accurate CFV calculations because they access actual on-chain transaction data directly.

### MEDIUM Confidence
Coins with **blockchain explorer APIs** (like 3xpl) or **custom data collectors**:
- **Bitcoin (BTC), Ethereum (ETH), DigiByte (DGB), eCash (XEC)**: Transaction counts from 3xpl explorer, volume estimates from CoinGecko market data
- **NEAR Protocol (NEAR)**: NearBlocks API for transaction metrics
- **Internet Computer (ICP)**: CoinGecko market data only, but ICP has transparent on-chain governance

These sources combine real transaction counts with estimated volume data, providing reasonably accurate CFV calculations.

### LOW Confidence
Coins with **only CoinGecko volume estimation**:
- **Monero (XMR)**: Privacy coin — transaction values are cryptographically hidden by design
- **Ravencoin (RVN)**: No accessible blockchain explorer API
- **Chia (XCH)**: No accessible blockchain explorer API
- **Zclassic (ZCL)**: No accessible blockchain explorer API

These coins rely entirely on CoinGecko's volume estimates (volume24h × 365), which may not accurately reflect real transaction activity. CFV calculations for these coins should be treated as rough estimates only.

## Data Collection Methods

### 3xpl Explorer (BTC, ETH, DGB, XEC)
**How it works:**
1. Fetches 24-hour transaction counts from 3xpl.com API
2. Extrapolates to annual transaction count (× 365)
3. Falls back to CoinGecko for volume data (volume is not provided by 3xpl stats endpoint)
4. Calculates average transaction value from count and volume

**Limitations:**
- Volume data is estimated from market activity, not direct blockchain data
- Requires THREEXPL_API_KEY environment variable for optimal rate limits
- Does NOT support XMR, RVN, or XCH despite initial documentation claims

### Custom Collectors

#### Dash API Collector
- **Source**: insight.dash.org API
- **Data**: Direct blockchain statistics including transaction counts and values
- **Reliability**: HIGH — official Dash foundation API

#### Nano RPC Collector
- **Source**: Direct Nano node RPC
- **Data**: Block confirmations and account transaction history
- **Reliability**: HIGH — direct node access provides most accurate data

#### NEAR Collector
- **Source**: NearBlocks.io API
- **Data**: Transaction metrics from NEAR Protocol explorer
- **Reliability**: MEDIUM — third-party explorer but well-maintained

#### ICP Collector
- **Source**: CoinGecko market data
- **Data**: Market volume and price data
- **Reliability**: MEDIUM — no transaction-level data available, but ICP has transparent on-chain governance

### CoinGecko Estimation (XMR, RVN, XCH, ZCL, EGLD)
**How it works:**
1. Fetches 24-hour trading volume from CoinGecko
2. Extrapolates to annual volume (volume24h × 365)
3. Estimates transaction count based on average transaction size heuristics
4. Both values are estimates, not real blockchain data

**Limitations:**
- Trading volume ≠ transaction activity (includes exchange trades, not just transfers)
- No access to actual transaction counts
- Cannot verify accuracy against blockchain
- Susceptible to wash trading and market manipulation

## Why Some Coins Lack Dedicated Collectors

### Privacy Coins (XMR)
**Monero (XMR)** uses advanced cryptography (RingCT, stealth addresses) to hide transaction amounts and participants. This is a **fundamental design feature**, not a limitation of the CFV agent. Even with direct blockchain access, transaction values cannot be determined.

**Implication**: XMR's CFV calculation will always rely on volume estimates and cannot achieve HIGH confidence.

### No Available APIs (RVN, XCH, ZCL)
These coins lack:
- Public blockchain explorer APIs with documented endpoints
- Official APIs from the coin foundations/developers
- Sufficient community-maintained infrastructure

**Why this matters**: Without APIs, we cannot programmatically fetch transaction data. Manual blockchain node setup would require:
- Running full nodes for each coin
- Custom RPC implementations
- Significant maintenance overhead

**Future plans**: As blockchain explorers mature or official APIs become available, we will add dedicated collectors.

### Limited Ecosystem (ZCL, EGLD)
Some coins have smaller ecosystems with less infrastructure:
- **Zclassic (ZCL)**: Limited development activity post-fork
- **MultiversX (EGLD)**: API documentation exists but integration not yet implemented

## Confidence Level Impact on CFV

The CFV formula weights transaction data heavily:
```
CFV = (0.70 × Community) + (0.10 × Annual TX Value) + (0.10 × Annual TX Count) + (0.10 × Developers)
```

**LOW confidence** coins (XMR, RVN, XCH, ZCL) have unreliable transaction metrics (20% of formula), making their CFV calculations less accurate.

**Recommendation**: When comparing CFV valuations:
1. HIGH confidence coins: Trust the valuation
2. MEDIUM confidence coins: Reasonable accuracy
3. LOW confidence coins: Use as rough estimate only, cross-reference with other valuation methods

## Future Enhancements

### Short-term (Q1 2026)
- [ ] Implement EGLD (MultiversX) API collector
- [ ] Add fallback transaction estimator using UTXO analysis for Bitcoin-like chains
- [ ] Improve volume estimation algorithms for CoinGecko-only coins

### Medium-term (Q2-Q3 2026)
- [ ] Direct node integration for RVN if APIs become available
- [ ] Chia blockchain API integration when documentation improves
- [ ] Machine learning model to improve transaction estimates

### Long-term
- [ ] Multi-source validation (compare multiple explorers for same coin)
- [ ] Real-time transaction monitoring via WebSocket APIs
- [ ] Historical transaction analysis for trend validation

## Developer Notes

### Adding a New Collector

To add support for a new coin:

1. **Create collector class** implementing `IDataCollector`:
```typescript
export class NewCoinCollector {
  async getTransactionMetrics(): Promise<TransactionMetrics> {
    // Implementation
  }
}
```

2. **Register in BlockchainDataCollector**:
```typescript
if (coinSymbol === 'NEWCOIN') {
  metrics = await this.newCoinCollector.getTransactionMetrics();
}
```

3. **Update `getSupportedCoins()`**:
```typescript
custom: ['DASH', 'XNO', 'NEAR', 'ICP', 'NEWCOIN']
```

4. **Update this documentation** with the new coin's data source and confidence level.

### Testing Coverage

All collectors should have:
- Unit tests mocking API responses
- Integration tests against live APIs (optional, for manual testing)
- Validation tests ensuring confidence levels are accurate

See `src/__tests__/unit/collectors/` for examples.

## References

- [3xpl API Documentation](https://3xpl.com/api)
- [CoinGecko API Documentation](https://www.coingecko.com/en/api/documentation)
- [Dash Insight API](https://insight.dash.org/)
- [Nano RPC Documentation](https://docs.nano.org/commands/rpc-protocol/)
- [NearBlocks API](https://api.nearblocks.io/api-docs)

## Changelog

### 2026-02-17
- Initial documentation created
- Clarified 3xpl supports only 5 coins (not 8)
- Documented XMR privacy limitation
- Added confidence level definitions
- Explained why some coins lack dedicated collectors
