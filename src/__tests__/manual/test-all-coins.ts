import { BlockchainDataCollector } from '../../collectors/BlockchainDataCollector.js';

/**
 * Test All 12 DGF Coins
 * 
 * Comprehensive test of the BlockchainDataCollector with all 12 DGF coins.
 */

// All 12 DGF coins
const DGF_COINS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'DASH', name: 'Dash' },
  { symbol: 'DGB', name: 'DigiByte' },
  { symbol: 'XMR', name: 'Monero' },
  { symbol: 'RVN', name: 'Ravencoin' },
  { symbol: 'XCH', name: 'Chia' },
  { symbol: 'XEC', name: 'eCash' },
  { symbol: 'XNO', name: 'Nano' },
  { symbol: 'NEAR', name: 'NEAR Protocol' },
  { symbol: 'ICP', name: 'Internet Computer' },
  { symbol: 'ZCL', name: 'Zclassic' }
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAllCoins() {
  console.log('🧪 Testing All 12 DGF Coins\n');
  console.log('='.repeat(80) + '\n');

  const collector = new BlockchainDataCollector({
    coingeckoApiKey: process.env.COINGECKO_API_KEY,
    cacheEnabled: true
  });

  const results: Array<{
    symbol: string;
    name: string;
    success: boolean;
    metrics?: any;
    error?: string;
    duration?: number;
  }> = [];

  for (const coin of DGF_COINS) {
    console.log(`\n📊 Testing ${coin.name} (${coin.symbol})`);
    console.log('-'.repeat(80));

    const startTime = Date.now();
    
    try {
      const metrics = await collector.getTransactionMetrics(coin.symbol);
      const duration = Date.now() - startTime;

      console.log(`✅ Success in ${duration}ms`);
      console.log(`   Annual TX Count: ${metrics.annualTxCount.toLocaleString()}`);
      console.log(`   Annual TX Value: $${metrics.annualTxValue.toLocaleString()}`);
      console.log(`   Avg TX Value: $${metrics.avgTxValue.toFixed(2)}`);
      console.log(`   Confidence: ${metrics.confidence}`);
      console.log(`   Sources: ${metrics.sources.join(', ')}`);

      results.push({
        symbol: coin.symbol,
        name: coin.name,
        success: true,
        metrics,
        duration
      });

      // Rate limiting: 5 second delay between requests
      if (DGF_COINS.indexOf(coin) < DGF_COINS.length - 1) {
        console.log(`   ⏳ Waiting 5 seconds for rate limiting...`);
        await delay(5000);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`❌ Failed in ${duration}ms`);
      console.log(`   Error: ${errorMessage}`);

      results.push({
        symbol: coin.symbol,
        name: coin.name,
        success: false,
        error: errorMessage,
        duration
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY');
  console.log('='.repeat(80) + '\n');

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const successRate = (successCount / results.length) * 100;

  console.log(`Total Coins: ${results.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${successRate.toFixed(1)}%\n`);

  // Confidence breakdown
  const confidenceCounts = {
    HIGH: results.filter(r => r.success && r.metrics?.confidence === 'HIGH').length,
    MEDIUM: results.filter(r => r.success && r.metrics?.confidence === 'MEDIUM').length,
    LOW: results.filter(r => r.success && r.metrics?.confidence === 'LOW').length
  };

  console.log('Confidence Levels:');
  console.log(`  HIGH: ${confidenceCounts.HIGH} coins`);
  console.log(`  MEDIUM: ${confidenceCounts.MEDIUM} coins`);
  console.log(`  LOW: ${confidenceCounts.LOW} coins\n`);

  // Detailed results table
  console.log('Detailed Results:');
  console.log('-'.repeat(80));
  console.log('Symbol | Name              | Status | Confidence | Annual TX Count | Avg TX Value');
  console.log('-'.repeat(80));

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const confidence = result.metrics?.confidence || 'N/A';
    const txCount = result.metrics?.annualTxCount 
      ? result.metrics.annualTxCount.toLocaleString().padEnd(15) 
      : 'N/A'.padEnd(15);
    const avgTxValue = result.metrics?.avgTxValue 
      ? `$${result.metrics.avgTxValue.toFixed(2)}`
      : 'N/A';

    console.log(
      `${result.symbol.padEnd(6)} | ${result.name.padEnd(17)} | ${status}     | ${confidence.padEnd(10)} | ${txCount} | ${avgTxValue}`
    );
  }

  console.log('-'.repeat(80));

  // Failed coins details
  if (failCount > 0) {
    console.log('\n❌ Failed Coins:');
    for (const result of results.filter(r => !r.success)) {
      console.log(`   ${result.symbol} (${result.name}): ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  
  if (successRate === 100) {
    console.log('🎉 ALL TESTS PASSED - 100% SUCCESS RATE!');
  } else if (successRate >= 90) {
    console.log('✅ TESTS MOSTLY PASSED - ' + successRate.toFixed(1) + '% SUCCESS RATE');
  } else {
    console.log('⚠️  TESTS PARTIALLY PASSED - ' + successRate.toFixed(1) + '% SUCCESS RATE');
  }
  
  console.log('='.repeat(80) + '\n');

  if (successRate < 100) {
    process.exit(1);
  }
}

testAllCoins();
