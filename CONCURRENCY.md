# Collection Scheduler Concurrency

## Overview

The collection scheduler now supports concurrent processing of coin metrics, dramatically improving performance by running multiple coin collections in parallel instead of sequentially.

## Performance Improvement

- **Before**: Sequential processing with 5s delays = ~70s for 11 coins
- **After**: Concurrent processing (max=5) = ~5s for 11 coins
- **Speedup**: 90-93% faster

## Configuration

### Environment Variables

```bash
# Maximum number of coins to collect concurrently (default: 5)
MAX_COLLECTION_CONCURRENCY=5

# Collection interval in minutes (default: 60)
COLLECTION_INTERVAL_MINUTES=60

# DEPRECATED: Use MAX_COLLECTION_CONCURRENCY instead
DELAY_BETWEEN_COINS_MS=5000
```

### Recommended Settings

- **Small deployments (1-10 coins)**: `MAX_COLLECTION_CONCURRENCY=3`
- **Medium deployments (11-30 coins)**: `MAX_COLLECTION_CONCURRENCY=5` (default)
- **Large deployments (30+ coins)**: `MAX_COLLECTION_CONCURRENCY=8`

## How It Works

### Concurrency Control

The scheduler uses a Promise-based concurrency limiter that:
1. Maintains a pool of at most N concurrent operations
2. Starts new collections as soon as a slot becomes available
3. Uses `Set` for O(1) cleanup operations
4. Properly handles errors without blocking other operations

### Rate Limiting

Each data source has its own rate limiter:
- **CoinGecko**: 3 concurrent requests, 2s minimum between requests (30/min)
- **3xpl**: Independent rate limiting per blockchain
- **Custom collectors**: Each has its own configuration

Concurrent collections are safe because:
- Different data sources don't share rate limiters
- Same-source requests are queued by the source's rate limiter
- No single API can starve others

## Code Example

```typescript
// Old sequential approach (slow)
for (const coin of coins) {
  await collectCoin(coin);
  await delay(5000); // Sequential delay
}

// New concurrent approach (fast)
const executing = new Set();
for (const coin of coins) {
  const promise = collectCoin(coin);
  executing.add(promise);
  promise.finally(() => executing.delete(promise));
  
  if (executing.size >= maxConcurrency) {
    await Promise.race(executing);
  }
}
await Promise.all(results);
```

## Verification

Run the verification script to see the performance difference:

```bash
npx tsx scripts/verify-concurrency.ts
```

This simulates collection runs with different concurrency levels and shows the speedup.

## Monitoring

The scheduler logs show:
- Total coins being processed
- Max concurrency level
- Individual coin collection times
- Overall success/failure statistics

Example output:
```
Processing 11 coins with max concurrency: 5

📊 Collecting Bitcoin (BTC)...
📊 Collecting Ethereum (ETH)...
📊 Collecting Dash (DASH)...
✅ ETH Success in 1500ms
📊 Collecting DigiByte (DGB)...
...
```

## Migration Guide

### Updating from Sequential Version

1. Update environment variables:
   ```bash
   # Add this new variable
   MAX_COLLECTION_CONCURRENCY=5
   
   # Optional: Keep old variable for compatibility
   DELAY_BETWEEN_COINS_MS=5000
   ```

2. No code changes needed - the scheduler automatically uses the new concurrent approach

3. Monitor the first few runs to ensure rate limits are respected

### Rollback

If you need to revert to sequential processing:
```bash
MAX_COLLECTION_CONCURRENCY=1
```

This processes one coin at a time (sequential), matching the old behavior.

## Troubleshooting

### Rate Limit Errors

If you see rate limit errors:
1. Reduce `MAX_COLLECTION_CONCURRENCY`
2. Check rate limiter configurations in `src/utils/RateLimiter.ts`
3. Verify API keys are correctly configured

### Memory Usage

With higher concurrency, memory usage increases slightly:
- Each concurrent collection holds its data in memory
- Collections are cleaned up after completion
- Monitor with `process.memoryUsage()` if concerned

### Debugging

Enable detailed logging:
```bash
DEBUG=scheduler:* npm start
```

## Implementation Details

### Files Changed

- `src/scheduler/CollectionScheduler.ts`: Main implementation
- `src/app.ts`: Configuration loading
- `.env.example`: Documentation

### Key Functions

- `processCoinsConcurrently()`: Manages concurrent collection pool
- `collectCoin()`: Individual coin collection wrapper
- Uses `Set<Promise>` for O(1) cleanup operations

### Error Handling

- Individual coin failures don't block others
- Errors are logged and tracked separately
- Collection run completes even with partial failures
- Success/failure statistics maintained

## Benefits

1. **Performance**: 90-93% faster collection runs
2. **Scalability**: Handles more coins without proportional time increase
3. **Flexibility**: Configurable concurrency per deployment
4. **Safety**: Rate limiters ensure API limits respected
5. **Reliability**: Errors isolated to individual coins

## Future Enhancements

Potential improvements:
- Per-source concurrency limits (e.g., `MAX_COINGECKO_CONCURRENCY`)
- Dynamic concurrency based on API response times
- Priority queue for high-value coins
- Batching for APIs that support multi-coin requests
