import { BlockchainDataCollector } from '../../collectors/BlockchainDataCollector.js';

/**
 * Quick Test - 3 Coins with Conservative Rate Limiting
 */

const TEST_COINS = ['BTC', 'DASH', 'XEC'];

async function testQuick() {
  console.log('🚀 Quick Test - 3 Coins\n');
  console.log('Testing with 5-second delays to respect rate limits\n');
  console.log('='.repeat(70) + '\n');

  // Initialize collector
  const collector = new BlockchainDataCollector({
    coingeckoApiKey: process.env.COINGECKO_API_KEY,
    cacheEnabled: true
  });

  const results: any[] = [];
  let successCount = 0;

  for (const coin of TEST_COINS) {
    console.log(`\n📊 Testing ${coin}`);
    console.log('-'.repeat(70));

    // Rate limiting: wait 5 seconds between requests
    if (results.length > 0) {
      console.log('⏳ Waiting 5s for rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    try {
      const startTime = Date.now();
      const metrics = await collector.getTransactionMetrics(coin);
      const duration = Date.now() - startTime;

      console.log(`✅ Data collected in ${duration}ms`);
      console.log(`\nMetrics:`);
      console.log(`  Annual TX Count: ${metrics.annualTxCount.toLocaleString()}`);
      console.log(`  Annual TX Value: $${metrics.annualTxValue.toLocaleString()}`);
      console.log(`  Avg TX Value: $${metrics.avgTxValue.toFixed(2)}`);
      console.log(`  Confidence: ${metrics.confidence}`);
      console.log(`  Sources: ${metrics.sources.join(', ')}`);

      successCount++;
      results.push({ coin, success: true, metrics });
    } catch (error) {
      console.log(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      results.push({ coin, success: false, error });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📈 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Coins Tested: ${TEST_COINS.length}`);
  console.log(`Successful: ${successCount}/${TEST_COINS.length} (${Math.round(successCount/TEST_COINS.length*100)}%)`);
  console.log('='.repeat(70));

  if (successCount === TEST_COINS.length) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log('⚠️  SOME TESTS FAILED');
  }

  console.log('='.repeat(70));
  console.log('✨ Test completed\n');
}

testQuick().catch(console.error);
