import { CoinGeckoMCPCollector } from './collectors/CoinGeckoMCPCollector.js';
import { CFVCalculator } from './utils/CFVCalculator.js';
import dotenv from 'dotenv';

dotenv.config();

async function testMCPCollector() {
  console.log('🧪 Testing CoinGecko MCP Collector\n');

  const collector = new CoinGeckoMCPCollector(process.env.COINGECKO_API_KEY);
  const calculator = new CFVCalculator();

  try {
    // Test with multiple DGF coins
    const testCoins = ['nano', 'dash', 'digibyte'];

    for (const coin of testCoins) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing: ${coin.toUpperCase()}`);
      console.log('='.repeat(60));

      // Collect metrics
      console.log('\n📊 Collecting metrics...');
      const metrics = await collector.collectMetrics(coin);

      console.log('\n✅ Metrics collected:');
      console.log(`- Community Size: ${metrics.communitySize?.toLocaleString()}`);
      console.log(`- Annual TX Value: $${metrics.annualTxValue?.toLocaleString()}`);
      console.log(`- Annual TX Count: ${metrics.annualTxCount?.toLocaleString()}`);
      console.log(`- Developers: ${metrics.developers}`);
      console.log(`- Current Price: $${metrics.currentPrice}`);
      console.log(`- Market Cap: $${metrics.marketCap?.toLocaleString()}`);
      console.log(`- Circulating Supply: ${metrics.circulatingSupply?.toLocaleString()}`);

      // Validate metrics
      console.log('\n🔍 Validating metrics...');
      const validation = collector.validateMetrics(metrics);
      console.log(`- Valid: ${validation.isValid}`);
      console.log(`- Confidence: ${validation.confidence}`);
      if (validation.issues.length > 0) {
        console.log('- Issues:');
        validation.issues.forEach(issue => console.log(`  • ${issue}`));
      }

      // Calculate CFV if we have enough data
      if (metrics.communitySize && metrics.annualTxValue && 
          metrics.annualTxCount && metrics.developers) {
        console.log('\n💰 Calculating CFV...');
        const result = CFVCalculator.calculate({
          communitySize: { value: metrics.communitySize!, confidence: 'MEDIUM', source: 'CoinGecko MCP', timestamp: new Date() },
          annualTransactionValue: { value: metrics.annualTxValue!, confidence: 'MEDIUM', source: 'CoinGecko MCP', timestamp: new Date() },
          annualTransactions: { value: metrics.annualTxCount!, confidence: 'MEDIUM', source: 'CoinGecko MCP', timestamp: new Date() },
          developers: { value: metrics.developers!, confidence: 'MEDIUM', source: 'CoinGecko MCP', timestamp: new Date() },
          price: { value: metrics.currentPrice || 0, confidence: 'HIGH', source: 'CoinGecko MCP', timestamp: new Date() },
          circulatingSupply: { value: metrics.circulatingSupply || 0, confidence: 'HIGH', source: 'CoinGecko MCP', timestamp: new Date() }
        });

        console.log(`- Network Power Score: ${result.networkPowerScore.toFixed(2)}`);
        console.log(`- Fair Value: $${result.fairValue.toFixed(2)}`);
        console.log(`- Current Price: $${result.currentPrice}`);
        console.log(`- Valuation Status: ${result.valuationStatus}`);
        console.log(`- Valuation Percent: ${result.valuationPercent > 0 ? '+' : ''}${result.valuationPercent.toFixed(2)}%`);
      }
    }

    // Disconnect
    await collector.disconnect();
    console.log('\n\n✨ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await collector.disconnect();
    process.exit(1);
  }
}

testMCPCollector();
