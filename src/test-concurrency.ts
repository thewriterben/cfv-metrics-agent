import { BlockchainDataCollector } from './collectors/BlockchainDataCollector.js';
import { executeBatchedConcurrent } from './utils/concurrency.js';
import type { TransactionMetrics } from './types/index.js';

/**
 * Test Concurrency - Compare Sequential vs Concurrent Collection
 * 
 * This test demonstrates the performance improvement from using concurrency
 * by collecting the same coins both sequentially and concurrently.
 */

const TEST_COINS = ['BTC', 'ETH', 'DASH', 'DGB', 'XEC'];

interface CollectionResult {
  coin: string;
  success: boolean;
  metrics?: TransactionMetrics;
  error?: Error;
}

async function testSequential(collector: BlockchainDataCollector) {
  console.log('\n🐌 SEQUENTIAL COLLECTION (Old Method)');
  console.log('='.repeat(70));
  
  const startTime = Date.now();
  const results: CollectionResult[] = [];
  
  for (const coin of TEST_COINS) {
    try {
      console.log(`  Collecting ${coin}...`);
      const metrics = await collector.getTransactionMetrics(coin);
      results.push({ coin, success: true, metrics });
      
      // Simulate the old delay between coins
      if (TEST_COINS.indexOf(coin) < TEST_COINS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.log(`  ❌ ${coin} failed`);
      results.push({ 
        coin, 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }
  
  const duration = Date.now() - startTime;
  const successful = results.filter(r => r.success).length;
  
  console.log(`\n⏱️  Total Time: ${(duration / 1000).toFixed(2)}s`);
  console.log(`✅ Successful: ${successful}/${TEST_COINS.length}`);
  
  return { duration, results };
}

async function testConcurrent(collector: BlockchainDataCollector) {
  console.log('\n🚀 CONCURRENT COLLECTION (New Method)');
  console.log('='.repeat(70));
  
  // Group coins by data source
  const coinsBySource: Record<string, string[]> = {};
  
  for (const coin of TEST_COINS) {
    const source = collector.getDataSource(coin);
    if (!coinsBySource[source]) {
      coinsBySource[source] = [];
    }
    coinsBySource[source].push(coin);
  }
  
  console.log('\n📊 Grouping by data source:');
  for (const [source, coins] of Object.entries(coinsBySource)) {
    console.log(`  ${source}: ${coins.join(', ')}`);
  }
  console.log('');
  
  const startTime = Date.now();
  
  // Create task groups
  interface ConcurrentCollectionResult {
    coin: string;
    metrics: TransactionMetrics;
  }
  
  const taskGroups: Record<string, Array<() => Promise<ConcurrentCollectionResult>>> = {};
  const concurrencyLimits: Record<string, number> = {
    '3xpl': 3,
    'coingecko': 5,
    'custom-dash': 2,
    'custom-nano': 2,
    'custom-near': 2,
    'custom-icp': 2
  };
  
  for (const [source, coins] of Object.entries(coinsBySource)) {
    taskGroups[source] = coins.map(coin => async () => {
      console.log(`  Collecting ${coin} from ${source}...`);
      const metrics = await collector.getTransactionMetrics(coin);
      return { coin, metrics };
    });
  }
  
  // Execute with concurrency
  const resultsBySource = await executeBatchedConcurrent(taskGroups, concurrencyLimits);
  
  // Flatten results into CollectionResult format
  const results: CollectionResult[] = [];
  for (const sourceResults of Object.values(resultsBySource)) {
    for (const result of sourceResults) {
      if (result.success) {
        results.push({
          coin: result.value.coin,
          success: true,
          metrics: result.value.metrics
        });
      } else {
        console.log(`  ❌ ${result.error.message}`);
        results.push({
          coin: 'unknown',
          success: false,
          error: result.error
        });
      }
    }
  }
  
  const duration = Date.now() - startTime;
  const successful = results.filter(r => r.success).length;
  
  console.log(`\n⏱️  Total Time: ${(duration / 1000).toFixed(2)}s`);
  console.log(`✅ Successful: ${successful}/${TEST_COINS.length}`);
  
  return { duration, results };
}

async function main() {
  console.log('🔬 CONCURRENCY TEST');
  console.log('='.repeat(70));
  console.log(`Testing with ${TEST_COINS.length} coins: ${TEST_COINS.join(', ')}`);
  console.log('='.repeat(70));
  
  // Initialize collector with cache disabled for fair comparison
  const collector = new BlockchainDataCollector({
    coingeckoApiKey: process.env.COINGECKO_API_KEY,
    cacheEnabled: false
  });
  
  // Test sequential collection
  const sequential = await testSequential(collector);
  
  // Wait a bit before concurrent test
  console.log('\n⏳ Waiting 5 seconds before concurrent test...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Clear cache before concurrent test
  collector.clearCache();
  
  // Test concurrent collection
  const concurrent = await testConcurrent(collector);
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📈 PERFORMANCE COMPARISON');
  console.log('='.repeat(70));
  console.log(`Sequential Time:  ${(sequential.duration / 1000).toFixed(2)}s`);
  console.log(`Concurrent Time:  ${(concurrent.duration / 1000).toFixed(2)}s`);
  
  const improvement = ((sequential.duration - concurrent.duration) / sequential.duration * 100);
  const speedup = (sequential.duration / concurrent.duration);
  
  console.log(`\n🚀 Improvement: ${improvement.toFixed(1)}%`);
  console.log(`⚡ Speedup: ${speedup.toFixed(2)}x faster`);
  
  if (improvement > 0) {
    console.log(`✅ Time saved: ${((sequential.duration - concurrent.duration) / 1000).toFixed(2)}s`);
  }
  
  console.log('='.repeat(70));
  console.log('✨ Test completed\n');
}

main().catch(console.error);
