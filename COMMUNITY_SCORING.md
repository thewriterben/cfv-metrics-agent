# Community Size Composite Scoring

## Overview

The CFV (Community, Fundamentals, Value) formula weights community size at **70%** of the total calculation. To prevent gaming and reward genuine activity, we implemented a **composite scoring approach** that combines multiple data sources with different weights based on their resistance to manipulation.

## Problem Statement

Previously, community size was calculated as a simple sum of:
- Twitter followers
- Reddit subscribers  
- Telegram users

This approach had significant issues:
1. **Easy to game**: Social media followers can be purchased or botted
2. **Ignores real usage**: No consideration of on-chain activity or developer engagement
3. **No differentiation**: All metrics weighted equally despite varying reliability

## Solution: Composite Scoring

### Weight Distribution

Community size is now calculated as a **weighted composite** of three categories:

| Category | Weight | Rationale | Data Sources |
|----------|--------|-----------|--------------|
| **On-chain** | 50% | Hardest to fake; requires real economic activity | Unique wallet addresses, active addresses, transaction counts |
| **GitHub** | 30% | Moderate difficulty to game; shows developer commitment | Contributors, meaningful commits, active maintainers |
| **Social** | 20% | Easiest to manipulate; useful but not primary | Twitter, Reddit, Telegram, Discord |

### Formula

```
communitySize = (onChainScore × 0.5) + (githubScore × 0.3) + (socialScore × 0.2)
```

The overall CFV formula remains:
```
CFV = (communitySize^0.7) × (txValue^0.1) × (txCount^0.1) × (developers^0.1) / circulatingSupply
```

## Implementation Details

### Type Definitions

New interfaces in `src/types/index.ts`:

```typescript
interface CommunitySubMetrics {
  onChain?: {
    uniqueAddresses?: number;
    activeAddresses?: number;
    confidence: ConfidenceLevel;
  };
  social?: {
    twitter?: number;
    reddit?: number;
    telegram?: number;
    discord?: number;
    confidence: ConfidenceLevel;
  };
  github?: {
    contributors?: number;
    stars?: number;
    forks?: number;
    confidence: ConfidenceLevel;
  };
}

interface CommunityWeights {
  onChain: number;   // default: 0.5
  github: number;    // default: 0.3
  social: number;    // default: 0.2
}
```

### CFVCalculator Configuration

Access the weights programmatically:

```typescript
import { CFVCalculator } from './utils/CFVCalculator';

// Get top-level CFV formula weights
const weights = CFVCalculator.getWeights();
// { communitySize: 0.7, annualTransactionValue: 0.1, ... }

// Get community composite weights
const communityWeights = CFVCalculator.getCommunityWeights();
// { onChain: 0.5, github: 0.3, social: 0.2 }
```

### Data Collection

All three CoinGecko collectors now use composite scoring:

1. **CoinGeckoCollector** (primary)
2. **CoinGeckoAPICollector** (REST API)
3. **CoinGeckoMCPCollector** (MCP server)

Each collector:
- Collects available metrics from all three categories
- Applies weighted composite formula
- Returns detailed metadata showing the breakdown
- Adjusts confidence based on data availability

### Confidence Levels

Confidence is determined by category coverage:

- **HIGH**: Data available in all 3 categories (onChain + GitHub + social)
- **MEDIUM**: Data available in 2 categories
- **LOW**: Data available in 1 category only

## Data Sources

### Current Implementation

| Metric | Source | Notes |
|--------|--------|-------|
| Twitter followers | CoinGecko API | Direct from social APIs |
| Reddit subscribers | CoinGecko API | Direct from social APIs |
| Telegram users | CoinGecko API | Direct from social APIs |
| GitHub contributors | CoinGecko API | Scraped from project repos |
| GitHub stars/forks | CoinGecko API | Public GitHub data |
| On-chain addresses | **Estimated** | Currently estimated from circulating supply; needs enhancement |

### Future Enhancements

To fully implement on-chain metrics, integrate with:

1. **Block Explorer APIs**
   - Etherscan (Ethereum)
   - Blockchain.com (Bitcoin)
   - Chain-specific explorers

2. **Analytics Platforms**
   - Dune Analytics
   - The Graph
   - CoinMetrics
   - Glassnode

3. **On-chain Data Providers**
   - Covalent API
   - Alchemy
   - Infura + custom queries

## Example Output

### Metadata Structure

```json
{
  "value": 125000,
  "confidence": "HIGH",
  "source": "CoinGecko",
  "timestamp": "2024-01-15T10:30:00Z",
  "metadata": {
    "twitter": 50000,
    "reddit": 30000,
    "telegram": 20000,
    "socialScore": 33333,
    "contributors": 150,
    "stars": 5000,
    "forks": 1200,
    "githubScore": 167,
    "onChainScore": 85000,
    "onChainEstimated": true,
    "categoriesAvailable": 3,
    "weights": {
      "onChain": 0.5,
      "github": 0.3,
      "social": 0.2
    },
    "note": "Community size uses composite scoring: onChain (50%) + GitHub (30%) + social (20%)"
  }
}
```

## Migration Notes

### Backward Compatibility

- Existing API responses remain unchanged
- The `communitySize` field continues to be a single number
- Enhanced metadata is added, not replacing existing data
- The 70/10/10/10 formula weights are unchanged

### Impact on Calculations

Coins will be affected differently based on their metric profiles:

| Profile | Previous Score | New Score | Impact |
|---------|----------------|-----------|--------|
| High social, low activity | High | Lower | More accurate (reduced gaming) |
| High on-chain, low social | Low | Higher | Better recognition of real usage |
| Balanced across metrics | Medium | Medium | Minimal change |

## Configuration

### Adjusting Weights

To customize weights in the future, modify `CFVCalculator.ts`:

```typescript
private static readonly DEFAULT_COMMUNITY_WEIGHTS: CommunityWeights = {
  onChain: 0.5,   // Adjust as needed
  github: 0.3,    // Must sum to 1.0
  social: 0.2,
};
```

### Environment Variables

Consider adding these for dynamic configuration:

```bash
COMMUNITY_WEIGHT_ONCHAIN=0.5
COMMUNITY_WEIGHT_GITHUB=0.3
COMMUNITY_WEIGHT_SOCIAL=0.2
```

## Testing

Run the CFV Calculator tests:

```bash
npm test -- --testPathPatterns=CFVCalculator
```

All 29 tests should pass, including new tests for:
- `getWeights()` method
- `getCommunityWeights()` method
- Weight sum validation
- Composite scoring logic

## Related Files

- `src/types/index.ts` - Type definitions
- `src/utils/CFVCalculator.ts` - Core calculation logic
- `src/collectors/CoinGeckoCollector.ts` - Primary collector
- `src/collectors/CoinGeckoAPICollector.ts` - REST API collector
- `src/collectors/CoinGeckoMCPCollector.ts` - MCP collector
- `src/__tests__/unit/utils/CFVCalculator.test.ts` - Unit tests

## References

- Original issue: Community size calculation is incomplete and over-weighted
- Related docs: See METRICS.md for general CFV documentation
