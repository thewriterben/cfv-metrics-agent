# CFV Metrics Agent - Architecture Overview

## Introduction

The CFV Metrics Agent is a sophisticated system for calculating fair cryptocurrency valuations using the Community Fair Value (CFV) formula. This document provides an overview of the refactored architecture.

## Architecture Refactor (February 2026)

The system underwent a major refactor to address architectural debt:
- **Unified collector interface** with registry pattern
- **Merged validation engines** into single cohesive system  
- **Organized test structure** with manual tests separated from production code

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CFV Agent                            │
│  (High-level orchestrator for CFV calculations)             │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─────────────────────────────────────────────────┐
             │                                                 │
             v                                                 v
┌────────────────────────┐                    ┌─────────────────────────┐
│   Collector Registry   │                    │  Validation Engine      │
│  (Unified collector    │                    │  (Data quality checks)  │
│   management)          │                    └─────────────────────────┘
└────────┬───────────────┘
         │
         │ Routes to appropriate collectors
         │
         ├──────────────┬──────────────┬──────────────┐
         v              v              v              v
    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │  API   │    │ Block  │    │  MCP   │    │ Manual │
    │Collect-│    │ chain  │    │Collect-│    │ Data   │
    │  ors   │    │Collect-│    │  ors   │    │ Entry  │
    │        │    │  ors   │    │        │    │        │
    └────────┘    └────────┘    └────────┘    └────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                           │
                           v
                  ┌─────────────────┐
                  │ External APIs   │
                  ├─────────────────┤
                  │ • CoinGecko     │
                  │ • 3xpl          │
                  │ • Etherscan     │
                  │ • GitHub        │
                  │ • Blockchain    │
                  │   Explorers     │
                  └─────────────────┘
```

## Core Components

### 1. CFV Agent (`src/CFVAgent.ts`)

The main orchestrator that:
- Coordinates metric collection from multiple sources
- Applies the CFV formula
- Manages caching and retry logic
- Provides high-level API for calculations

**Key Methods:**
- `calculateCFV(coinSymbol)` - Calculate fair value for a coin
- `collectAllMetrics(coinSymbol)` - Gather all required metrics
- `collectMetric(coinSymbol, metric)` - Get specific metric with fallback

### 2. Collector Registry (`src/collectors/CollectorRegistry.ts`)

Centralized registry for all data collectors:
- **Dynamic Registration**: Add/remove collectors at runtime
- **Priority-based Fallback**: Automatic retry with secondary sources
- **Type-based Routing**: Group by API/Blockchain/MCP collectors
- **Health Monitoring**: Track collector status

**Key Methods:**
- `register(collector, metadata)` - Register a collector
- `collectMetric(coin, metric)` - Collect with automatic fallback
- `getCollectorsForCoin(coin)` - Find supporting collectors
- `getHealthStatus()` - Check all collector health

### 3. Unified Validation Engine (`src/validators/UnifiedValidationEngine.ts`)

Comprehensive validation system:
- **Metric Aggregation**: Validate and combine results from multiple sources
- **Quality Checks**: Verify transaction metrics quality
- **Cross-Validation**: Build consensus from multiple sources
- **Confidence Scoring**: Assign HIGH/MEDIUM/LOW confidence levels

**Key Methods:**
- `validateMetricResults(results)` - Aggregate multi-source metrics
- `validateTransactionMetrics(metrics)` - Check data quality
- `crossValidate(metricsArray)` - Create consensus from sources

### 4. Collectors (`src/collectors/`)

Data collectors implement `IDataCollector` interface:

#### API Collectors
- **CoinGeckoCollector** - Market data, community metrics
- **EtherscanCollector** - Ethereum blockchain data
- **GitHubCollector** - Developer activity metrics

#### Blockchain Collectors
- **BlockchainDataCollector** - Router for blockchain sources
- **ThreeXplCollector** - 5 DGF coins with 3xpl support (BTC, ETH, DASH, DGB, XEC)
- **DashApiClient** - Dash-specific metrics
- **NanoCollector** - Nano blockchain
- **NEARCollector** - NEAR Protocol
- **ICPCollector** - Internet Computer

#### MCP Collectors
- **CoinGeckoMCPCollector** - CoinGecko via Model Context Protocol

## Data Flow

### CFV Calculation Flow

```
1. User Request: calculateCFV('BTC')
                     │
                     v
2. CFV Agent: Collect 6 metrics
                     │
    ┌────────────────┼────────────────┐
    v                v                v
3. Collectors: CoinGecko, 3xpl, GitHub
                     │
                     v
4. Validation: Aggregate & validate results
                     │
                     v
5. Calculator: Apply CFV formula
                     │
                     v
6. Result: Fair value, valuation status, confidence
```

### Metric Collection with Fallback

```
1. Registry: Find collectors for coin
                     │
    ┌────────────────┼────────────────┐
    v                v                v
2. Try Primary → Try Secondary → Try Fallback
    │                │                │
    ├─ Success ──────┼───────────────→ Return result
    ├─ Fail → ───────┤
    └─ Fail ──────────┼───────────────→ Return result
                      └─ All fail ─────→ Throw error
```

## Type System

### Core Types (`src/types/index.ts`)

- **MetricType**: Type of metric (price, marketCap, communitySize, etc.)
- **MetricResult**: Single metric value with confidence and metadata
- **CFVMetrics**: Complete set of metrics for CFV calculation
- **CFVResult**: Final CFV calculation result
- **TransactionMetrics**: Blockchain transaction data
- **ConfidenceLevel**: HIGH | MEDIUM | LOW

### Collector Types (`src/types/collectors.ts`)

- **IDataCollector**: Base interface for all collectors
- **IBlockchainCollector**: Extended interface for blockchain collectors
- **CollectorMetadata**: Registration information
- **CollectorRegistration**: Registry entry

## Configuration

### Environment Variables

```bash
# API Keys
COINGECKO_API_KEY=your_key
ETHERSCAN_API_KEY=your_key
GITHUB_TOKEN=your_token
THREEXPL_API_KEY=your_key

# Redis Cache
REDIS_URL=redis://localhost:6379

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=cfv_metrics
```

### Agent Configuration

```typescript
const config: AgentConfig = {
  // API keys
  coinGeckoApiKey: process.env.COINGECKO_API_KEY,
  etherscanApiKey: process.env.ETHERSCAN_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,
  
  // Cache TTL (seconds)
  cacheTTL: {
    short: 300,      // 5 minutes
    medium: 3600,    // 1 hour
    long: 86400,     // 24 hours
    veryLong: 604800 // 7 days
  },
  
  // Rate limits (calls per minute)
  rateLimits: {
    coinGecko: 30,
    etherscan: 5,
    github: 5000
  },
  
  // Retry settings
  maxRetries: 3,
  retryDelay: 1000,
  collectorTimeout: 30000
};
```

## Testing Structure

```
src/__tests__/
├── unit/              # Fast, isolated tests (Jest)
│   ├── collectors/    # Collector unit tests
│   ├── utils/         # Utility function tests
│   └── validators/    # Validation logic tests
├── integration/       # End-to-end tests (Jest)
│   ├── api.test.ts    # API endpoint tests
│   ├── database.test.ts
│   └── collectors.test.ts
├── manual/            # Manual test scripts (Not in CI)
│   ├── test-standalone.ts
│   ├── test-all-coins.ts
│   └── test-*.ts      # Other manual tests
├── fixtures/          # Test data
├── helpers/           # Test utilities
└── setup.ts           # Global test setup
```

### Test Commands

```bash
npm test              # All automated tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run test:standalone   # Manual standalone test
```

## API Endpoints

### GET /api/metrics/:symbol

Calculate CFV for a cryptocurrency.

**Response:**
```json
{
  "coinSymbol": "BTC",
  "coinName": "Bitcoin",
  "fairValue": 45000,
  "currentPrice": 40000,
  "valuationStatus": "undervalued",
  "confidence": "HIGH",
  "metrics": { ... },
  "calculation": { ... }
}
```

## Deployment

The agent can be deployed as:
1. **Standalone Service** - Run the agent independently
2. **API Server** - Expose REST endpoints
3. **Scheduled Jobs** - Periodic calculations
4. **GitHub Copilot Extension** - Integration with Copilot CLI

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Performance Considerations

### Caching Strategy

- **Short-lived** (5m): Frequently changing data (prices)
- **Medium-lived** (1h): Moderate change rate (transaction metrics)
- **Long-lived** (24h): Slowly changing data (developer counts)
- **Very long** (7d): Rarely changing data (circulating supply)

### Rate Limiting

Each collector implements rate limiting:
- **CoinGecko**: 30 calls/minute (free tier)
- **Etherscan**: 5 calls/second
- **GitHub**: 5000 calls/hour
- **3xpl**: As per API key tier

### Parallel Collection

Metrics are collected in parallel when possible:
```typescript
await Promise.all(
  metricsToCollect.map(metric => 
    collectMetric(coin, metric)
  )
);
```

## Security Considerations

1. **API Key Management**: Never commit keys to version control
2. **Rate Limiting**: Protect against abuse
3. **Input Validation**: Sanitize all user inputs
4. **Error Handling**: Never expose internal errors to users
5. **Data Validation**: Verify all external data before use

## Migration Guide

### From Old Architecture

#### Before (Dual Systems)
```typescript
// CFVAgent for orchestration
const agent = new CFVAgent(config);
const result = await agent.calculateCFV('BTC');

// BlockchainDataCollector for blockchain data
const collector = new BlockchainDataCollector(config);
const txMetrics = await collector.getTransactionMetrics('BTC');
```

#### After (Unified Registry)
```typescript
// Single registry for all collectors
import { collectorRegistry } from './collectors/CollectorRegistry';

// Automatic routing and fallback
const metric = await collectorRegistry.collectMetric('BTC', 'price');

// CFVAgent now uses registry internally
const agent = new CFVAgent(config);
const result = await agent.calculateCFV('BTC');
```

## Future Enhancements

1. **Machine Learning**: Price prediction models
2. **Real-time Updates**: WebSocket support for live data
3. **Advanced Analytics**: Historical trend analysis
4. **Custom Formulas**: User-defined valuation models
5. **Multi-chain Support**: Expand to more blockchains

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

ISC License - see [LICENSE](./LICENSE) file.

## References

- [Collectors Documentation](./src/collectors/README.md)
- [Validation Documentation](./src/validators/README.md)
- [Testing Guide](./TESTING.md)
- [Deployment Guide](./DEPLOYMENT.md)
