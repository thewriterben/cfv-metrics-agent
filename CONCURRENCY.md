# Collection Scheduler Concurrency

## Overview

The Collection Scheduler now supports concurrent collection of cryptocurrency metrics, dramatically reducing collection run times by processing multiple coins in parallel while respecting rate limits per data source.

## Performance Improvement

- **Before**: Sequential collection with delays between each coin (~50s+ for 11 coins)
- **After**: Concurrent collection grouped by data source (~15-20s for 11 coins)
- **Speedup**: 2-3x faster collection runs

## How It Works

### Data Source Grouping

Coins are automatically grouped by their data source:
- **3xpl**: BTC, ETH, DASH, DGB, XEC (verified blockchain data)
- **CoinGecko**: Fallback for coins not supported by other sources
- **Custom Collectors**: 
  - DASH (custom API)
  - XNO/NANO (Nano-specific API)
  - NEAR (NEAR-specific API)  
  - ICP (ICP-specific API)

### Concurrency Limits

Each data source has its own concurrency limit to respect API rate limits:

```javascript
{
  '3xpl': 3,           // 3 parallel requests to 3xpl
  'coingecko': 5,      // 5 parallel requests to CoinGecko
  'custom-dash': 2,    // 2 parallel requests to custom APIs
  'custom-nano': 2,
  'custom-near': 2,
  'custom-icp': 2
}
```

### Configuration

Concurrency limits can be configured via environment variables:

```bash
# .env
CONCURRENCY_3XPL=3
CONCURRENCY_COINGECKO=5
CONCURRENCY_CUSTOM_DASH=2
CONCURRENCY_CUSTOM_NANO=2
CONCURRENCY_CUSTOM_NEAR=2
CONCURRENCY_CUSTOM_ICP=2
```

## Architecture

### Concurrency Utility (`src/utils/concurrency.ts`)

Provides two main functions:

1. **`executeConcurrent<T>(tasks, concurrency)`**
   - Executes an array of tasks with a maximum concurrency limit
   - Uses a worker pool pattern for efficient task distribution
   - Handles errors gracefully without stopping other tasks

2. **`executeBatchedConcurrent<T>(taskGroups, concurrencyPerGroup)`**
   - Executes multiple groups of tasks in parallel
   - Each group has its own concurrency limit
   - Groups run simultaneously while respecting individual limits

### Collection Flow

1. **Fetch Active Coins**: Get list of coins from database
2. **Group by Source**: Determine data source for each coin
3. **Create Tasks**: Create async task for each coin collection
4. **Execute Concurrently**: Run tasks with appropriate concurrency limits
5. **Process Results**: Aggregate results and update database

## Benefits

### Speed
- Collection runs complete 2-3x faster
- Scales better as more coins are added

### Resource Efficiency
- Better utilization of network I/O
- Multiple API calls can happen simultaneously

### Rate Limit Compliance
- Each API source has independent concurrency limits
- Existing rate limiters in collectors still work
- No single API can starve others

### Reliability
- Errors in one coin don't block others
- Failed collections are tracked and reported
- Successful collections are saved immediately

## Testing

Run the concurrency test to see the performance improvement:

```bash
npm run build
node dist/test-concurrency.js
```

Unit tests for concurrency utilities:

```bash
npm run test:unit -- concurrency.test.ts
```

## Backward Compatibility

The `delayBetweenCoins` configuration option is maintained for backward compatibility but is no longer used in the concurrent collection strategy. The concurrency limits are now the primary mechanism for controlling collection speed.

## Future Enhancements

Possible improvements:
- Dynamic concurrency adjustment based on API response times
- Per-coin priority levels for time-sensitive data
- Adaptive rate limiting based on API feedback
- Collection progress tracking and live updates
