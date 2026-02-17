# Collectors Architecture

## Overview

The collectors module provides a unified system for gathering cryptocurrency metrics from various data sources. All collectors implement a common interface and are managed through a central registry.

## Architecture

### Collector Registry Pattern

The `CollectorRegistry` provides centralized management of all data collectors:

```typescript
import { collectorRegistry } from './collectors/CollectorRegistry';

// Register collectors
collectorRegistry.register(coinGeckoCollector, {
  name: 'CoinGecko',
  type: 'api',
  priority: 'primary',
  supportedMetrics: ['price', 'marketCap', 'communitySize']
});

// Use registry to collect metrics
const result = await collectorRegistry.collectMetric('BTC', 'price');
```

### Collector Types

#### 1. **IDataCollector** (Base Interface)
All collectors implement this interface:
- `collect(coin, metric)` - Collect a specific metric
- `supports(coin)` - Check if coin is supported
- `getHealth()` - Get collector health status

#### 2. **IBlockchainCollector** (Extended Interface)
Blockchain-specific collectors also provide:
- `getTransactionMetrics(coin)` - Get transaction data

### Available Collectors

#### API Collectors
- **CoinGeckoCollector** - Market data, community metrics
- **CoinGeckoAPICollector** - Direct CoinGecko API access
- **CoinGeckoMCPCollector** - CoinGecko via MCP protocol
- **EtherscanCollector** - Ethereum blockchain data
- **GitHubCollector** - Development activity metrics

#### Blockchain Collectors
- **ThreeXplCollector** - Multi-chain support (BTC, ETH, DASH, etc.)
- **DashApiClient** - Dash-specific metrics
- **NanoCollector** - Nano blockchain data
- **NEARCollector** - NEAR protocol data
- **ICPCollector** - Internet Computer data

#### Unified Collector
- **BlockchainDataCollector** - Routes requests to appropriate blockchain collectors

## Usage Examples

### Basic Usage

```typescript
import { CoinGeckoCollector } from './collectors/CoinGeckoCollector';

const collector = new CoinGeckoCollector(apiKey);

// Check support
if (await collector.supports('BTC')) {
  // Collect metric
  const result = await collector.collect('BTC', 'price');
  console.log(`Price: $${result.value}`);
}
```

### Using the Registry

```typescript
import { collectorRegistry } from './collectors/CollectorRegistry';

// Get all collectors for a coin
const collectors = await collectorRegistry.getCollectorsForCoin('BTC');

// Automatic fallback collection
try {
  const price = await collectorRegistry.collectMetric('BTC', 'price');
} catch (error) {
  // All collectors failed
}

// Get health status
const health = await collectorRegistry.getHealthStatus();
```

### Blockchain Data Collection

```typescript
import { BlockchainDataCollector } from './collectors/BlockchainDataCollector';

const collector = new BlockchainDataCollector({
  coingeckoApiKey: 'your-key',
  threexplApiKey: 'your-key'
});

// Get transaction metrics (auto-routed to best source)
const metrics = await collector.getTransactionMetrics('DASH');
console.log(`Annual TX: ${metrics.annualTxCount}`);
console.log(`Annual Value: $${metrics.annualTxValue}`);
```

## Collector Priority

Collectors are prioritized for fallback:

1. **primary** - First choice, most reliable
2. **secondary** - Backup option
3. **fallback** - Last resort

The registry automatically tries collectors in priority order.

## Adding New Collectors

To add a new collector:

1. Implement `IDataCollector` interface:

```typescript
import { IDataCollector } from '../types/collectors';

export class MyCollector implements IDataCollector {
  name = 'MyCollector';
  priority: CollectorPriority = 'secondary';
  
  async collect(coin: string, metric: MetricType): Promise<MetricResult> {
    // Implementation
  }
  
  async supports(coin: string): Promise<boolean> {
    // Implementation
  }
  
  async getHealth(): Promise<CollectorHealth> {
    // Implementation
  }
}
```

2. Register with the registry:

```typescript
import { collectorRegistry } from './collectors/CollectorRegistry';

collectorRegistry.register(new MyCollector(), {
  name: 'MyCollector',
  type: 'api',
  priority: 'secondary',
  supportedCoins: ['BTC', 'ETH'],
  description: 'My custom collector'
});
```

## Migration Notes

### From Old Architecture

The old system had two parallel architectures:
- **CFVAgent** - Orchestrator with static collector list
- **BlockchainDataCollector** - Router with hard-coded routing

The new unified system:
- Uses `CollectorRegistry` for dynamic collector management
- Provides consistent interface via `IDataCollector`
- Supports automatic fallback and health monitoring
- Enables easier testing and extension

### Backward Compatibility

Existing collectors continue to work. The new interfaces are supersets of the old ones:
- `MetricCollector` → `IDataCollector` (same interface)
- Blockchain collectors can implement `IBlockchainCollector`

## Testing

All collectors can be tested manually using scripts in `src/__tests__/manual/`:

```bash
npm run test:standalone
npm run test:manual -- src/__tests__/manual/test-dash-collector.ts
```

## Related Documentation

- [Validation Engine](../validators/README.md)
- [Testing Guide](../../TESTING.md)
- [Architecture Overview](../../ARCHITECTURE.md)
