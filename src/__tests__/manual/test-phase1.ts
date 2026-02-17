import { BlockchainDataCollector } from '../../collectors/BlockchainDataCollector.js';
import { EnhancedValidationEngine } from '../../validators/EnhancedValidationEngine.js';
import { EnhancedCacheManager } from '../../utils/EnhancedCacheManager.js';

/**
 * Phase 1 Integration Test
 * 
 * Tests blockchain data collection for 8 DGF coins supported by 3xpl:
 * - BTC (Bitcoin)
 * - ETH (Ethereum)
 * - DASH (Dash)
 * - DGB (DigiByte)
 * - XMR (Monero)
 * - RVN (Ravencoin)
 * - XCH (Chia)
 * - XEC (eCash)
 */

const DGF_COINS_PHASE1 = ['BTC', 'ETH', 'DASH', 'DGB', 'XMR', 'RVN', 'XCH', 'XEC'];

async function testPhase1() {
  console.log('🚀 Phase 1 Integration Test\n');
  console.log('Testing blockchain data collection for 8 DGF coins\n');
  console.log('='.repeat(70) + '\n');

  // Initialize components
  const collector = new BlockchainDataCollector({
    coingeckoApiKey: process.env.COINGECKO_API_KEY,
    threexplApiKey: process.env.THREEXPL_API_KEY,
    cacheEnabled: true
  });

  const validator = new EnhancedValidationEngine();
  const cache = new EnhancedCacheManager({
    redisUrl: process.env.REDIS_URL
  });

  // Test each coin
  const results: any[] = [];
  let successCount = 0;
  let highConfidenceCount = 0;

  for (const coin of DGF_COINS_PHASE1) {
    console.log(`\n📊 Testing ${coin}`);
    console.log('-'.repeat(70));

    // Rate limiting: wait 2 seconds between requests to avoid 429 errors
    if (results.length > 0) {
      console.log('⏳ Waiting 2s for rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      // Collect metrics
      const startTime = Date.now();
      const metrics = await collector.getTransactionMetrics(coin);
      const duration = Date.now() - startTime;

      // Validate metrics
      const validation = validator.validate(metrics);

      // Display results
      console.log(`✅ Data collected in ${duration}ms`);
      console.log(`\nMetrics:`);
      console.log(`  Annual TX Count: ${metrics.annualTxCount.toLocaleString()}`);
      console.log(`  Annual TX Value: $${metrics.annualTxValue.toLocaleString()}`);
      console.log(`  Avg TX Value: $${metrics.avgTxValue.toFixed(2)}`);
      console.log(`  Confidence: ${metrics.confidence}`);
      console.log(`  Sources: ${metrics.sources.join(', ')}`);

      console.log(`\nValidation:`);
      console.log(`  Score: ${validation.score}/100`);
      console.log(`  Valid: ${validation.isValid ? 'YES' : 'NO'}`);
      
      if (validation.issues.length > 0) {
        console.log(`  Issues: ${validation.issues.join('; ')}`);
      }
      
      if (validation.warnings.length > 0) {
        console.log(`  Warnings: ${validation.warnings.join('; ')}`);
      }

      // Track success
      successCount++;
      if (metrics.confidence === 'HIGH') {
        highConfidenceCount++;
      }

      results.push({
        coin,
        success: true,
        metrics,
        validation,
        duration
      });

    } catch (error) {
      console.log(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        coin,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Display summary
  console.log('\n' + '='.repeat(70));
  console.log('📈 PHASE 1 TEST SUMMARY');
  console.log('='.repeat(70) + '\n');

  console.log(`Total Coins Tested: ${DGF_COINS_PHASE1.length}`);
  console.log(`Successful: ${successCount}/${DGF_COINS_PHASE1.length} (${Math.round(successCount / DGF_COINS_PHASE1.length * 100)}%)`);
  console.log(`HIGH Confidence: ${highConfidenceCount}/${successCount} (${successCount > 0 ? Math.round(highConfidenceCount / successCount * 100) : 0}%)`);

  // Cache statistics
  const cacheStats = cache.getStats();
  console.log(`\nCache Performance:`);
  console.log(`  Total Requests: ${cacheStats.totalRequests}`);
  console.log(`  Hit Rate: ${cacheStats.hitRate.toFixed(1)}%`);
  console.log(`  Memory Hits: ${cacheStats.memoryHits}`);
  console.log(`  Redis Hits: ${cacheStats.redisHits}`);
  console.log(`  Redis Connected: ${cacheStats.redisConnected ? 'YES' : 'NO'}`);

  // Supported coins
  const supported = collector.getSupportedCoins();
  console.log(`\nSupported Coins:`);
  console.log(`  3xpl: ${supported.threexpl.join(', ')}`);
  console.log(`  Custom: ${supported.custom.join(', ')}`);

  // Phase 1 completion status
  console.log(`\n${'='.repeat(70)}`);
  if (successCount === DGF_COINS_PHASE1.length && highConfidenceCount >= 6) {
    console.log('✅ PHASE 1 COMPLETE - All coins tested successfully!');
  } else if (successCount >= 6) {
    console.log('⚠️  PHASE 1 PARTIAL - Most coins working, some issues detected');
  } else {
    console.log('❌ PHASE 1 INCOMPLETE - Multiple failures detected');
  }
  console.log('='.repeat(70) + '\n');

  // Cleanup
  await cache.close();

  return {
    success: successCount === DGF_COINS_PHASE1.length,
    results,
    summary: {
      total: DGF_COINS_PHASE1.length,
      successful: successCount,
      highConfidence: highConfidenceCount,
      cacheStats
    }
  };
}

// Run test
testPhase1()
  .then(result => {
    console.log('\n✨ Test completed\n');
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
