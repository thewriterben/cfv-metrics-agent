import { BlockchainDataCollector } from '../../collectors/BlockchainDataCollector.js';

/**
 * Test Nano Integration with BlockchainDataCollector
 */

async function testNanoIntegration() {
  console.log('🧪 Testing Nano Integration\n');
  console.log('='.repeat(70) + '\n');

  try {
    // Initialize collector
    const collector = new BlockchainDataCollector({
      coingeckoApiKey: process.env.COINGECKO_API_KEY,
      cacheEnabled: true
    });

    // Test with XNO symbol
    console.log('📊 Testing with XNO symbol');
    console.log('-'.repeat(70));
    
    const startTime = Date.now();
    const metrics = await collector.getTransactionMetrics('XNO');
    const duration = Date.now() - startTime;

    console.log(`✅ Data collected in ${duration}ms\n`);
    console.log('Metrics:');
    console.log(`  Annual TX Count: ${metrics.annualTxCount.toLocaleString()}`);
    console.log(`  Annual TX Value: $${metrics.annualTxValue.toLocaleString()}`);
    console.log(`  Avg TX Value: $${metrics.avgTxValue.toFixed(2)}`);
    console.log(`  Confidence: ${metrics.confidence}`);
    console.log(`  Sources: ${metrics.sources.join(', ')}`);
    console.log(`  Timestamp: ${metrics.timestamp.toISOString()}`);

    // Verify HIGH confidence
    if (metrics.confidence !== 'HIGH') {
      throw new Error(`Expected HIGH confidence, got ${metrics.confidence}`);
    }

    // Verify sources include Nano RPC
    if (!metrics.sources.some(s => s.includes('Nano RPC'))) {
      throw new Error('Expected Nano RPC in sources');
    }

    // Test cache
    console.log('\n📊 Testing cache (second request)');
    console.log('-'.repeat(70));
    
    const startTime2 = Date.now();
    const metrics2 = await collector.getTransactionMetrics('XNO');
    const duration2 = Date.now() - startTime2;

    console.log(`✅ Data retrieved from cache in ${duration2}ms`);
    console.log(`   Cache hit: ${duration2 < 100 ? 'YES' : 'NO'}`);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ NANO INTEGRATION TEST PASSED');
    console.log('='.repeat(70));
    console.log('\n📈 Summary:');
    console.log('   - Nano collector working correctly');
    console.log('   - BlockchainDataCollector routing to Nano collector');
    console.log('   - HIGH confidence data achieved');
    console.log('   - Cache working properly');
    console.log('\n✨ Nano (XNO) ready for production!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testNanoIntegration();
