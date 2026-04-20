/**
 * Manual test for ThreeXplCollector with CoinGecko fallback
 * 
 * This test verifies that the ThreeXplCollector properly uses CoinGecko
 * as a fallback for volume data when 3xpl doesn't provide it.
 * 
 * Run with: tsx src/__tests__/manual/test-threexpl-fallback.ts
 */

import { ThreeXplCollector } from '../../collectors/ThreeXplCollector.js';

async function testThreeXplFallback() {
  console.log('\n🧪 Testing ThreeXplCollector with CoinGecko Fallback\n');
  console.log('='.repeat(70));

  const collector = new ThreeXplCollector({
    apiKey: process.env.THREEXPL_API_KEY,
    coingeckoApiKey: process.env.COINGECKO_API_KEY
  });

  const testCoins = ['DASH', 'DGB', 'XEC'];

  for (const coin of testCoins) {
    console.log(`\n📊 Testing ${coin}:`);
    console.log('-'.repeat(70));

    try {
      const metrics = await collector.collectMetrics(coin);

      console.log(`✓ Success!`);
      console.log(`  Annual TX Count: ${metrics.annualTxCount.toLocaleString()}`);
      console.log(`  Annual TX Value: $${metrics.annualTxValue.toLocaleString()}`);
      console.log(`  Avg TX Value: $${metrics.avgTxValue.toLocaleString()}`);
      console.log(`  Confidence: ${metrics.confidence}`);
      console.log(`  Sources: ${metrics.sources.join(', ')}`);
      
      if (metrics.issues && metrics.issues.length > 0) {
        console.log(`  Issues:`);
        metrics.issues.forEach(issue => console.log(`    - ${issue}`));
      }

      if (metrics.metadata) {
        console.log(`  Metadata:`);
        console.log(`    - Blockchain: ${metrics.metadata.blockchain}`);
        console.log(`    - Used Fallback: ${metrics.metadata.usedFallback}`);
        if (metrics.metadata.fallbackSource) {
          console.log(`    - Fallback Source: ${metrics.metadata.fallbackSource}`);
        }
        console.log(`    - TX Count 24h: ${metrics.metadata.txCount24h?.toLocaleString()}`);
      }

      // Verify that we got volume data (should not be zero)
      if (metrics.annualTxValue > 0) {
        console.log(`  ✅ Volume data successfully retrieved!`);
      } else {
        console.log(`  ⚠️  Warning: Volume data is zero`);
      }

    } catch (error) {
      console.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Test completed!\n');
}

// Run the test
testThreeXplFallback().catch(console.error);
