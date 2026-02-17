/**
 * Standalone test script for CFV Metrics Agent
 * Tests the agent without requiring Copilot CLI installation
 */

import * as dotenv from 'dotenv';
import { CoinGeckoCollector } from '../../collectors/CoinGeckoCollector.js';
import { GitHubCollector } from '../../collectors/GitHubCollector.js';
import { ValidationEngine } from '../../validators/ValidationEngine.js';
import { CFVCalculator } from '../../utils/CFVCalculator.js';
import type { CFVMetrics, MetricResult } from '../../types/index.js';

// Load environment variables
dotenv.config();

async function testCFVCalculation(coinSymbol: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`CFV METRICS AGENT - STANDALONE TEST`);
  console.log(`${'='.repeat(70)}\n`);
  console.log(`Testing: ${coinSymbol.toUpperCase()}\n`);
  
  // Initialize collectors
  const coinGecko = new CoinGeckoCollector(process.env.COINGECKO_API_KEY);
  const github = new GitHubCollector(process.env.GITHUB_TOKEN);
  
  try {
    // Test 1: Check if coin is supported
    console.log(`📋 Step 1: Checking if ${coinSymbol} is supported...`);
    const supported = await coinGecko.supports(coinSymbol);
    if (!supported) {
      throw new Error(`${coinSymbol} is not supported by CoinGecko`);
    }
    console.log(`✅ ${coinSymbol} is supported\n`);
    
    // Test 2: Collect community size
    console.log(`📊 Step 2: Collecting community size...`);
    const communitySize = await coinGecko.collect(coinSymbol, 'communitySize');
    console.log(`✅ Community Size: ${CFVCalculator.formatNumber(communitySize.value)} (${communitySize.confidence})`);
    console.log(`   Sources: ${JSON.stringify(communitySize.metadata)}\n`);
    
    // Test 3: Collect developers
    console.log(`👨‍💻 Step 3: Collecting developer metrics...`);
    const developersFromCG = await coinGecko.collect(coinSymbol, 'developers');
    console.log(`✅ Developers (CoinGecko): ${developersFromCG.value} (${developersFromCG.confidence})`);
    
    // Try GitHub as well
    let developersFromGH: MetricResult | null = null;
    try {
      const ghSupported = await github.supports(coinSymbol);
      if (ghSupported) {
        developersFromGH = await github.collect(coinSymbol, 'developers');
        console.log(`✅ Developers (GitHub): ${developersFromGH.value} (${developersFromGH.confidence})`);
      }
    } catch (error) {
      console.log(`⚠️  GitHub data not available: ${error}`);
    }
    
    // Validate developer metrics
    const devResults = developersFromGH 
      ? [developersFromCG, developersFromGH]
      : [developersFromCG];
    const devValidation = ValidationEngine.validateMetric(devResults);
    console.log(`   Final Developers: ${devValidation.adjustedValue} (${devValidation.confidence})\n`);
    
    // Test 4: Collect price
    console.log(`💰 Step 4: Collecting price data...`);
    const price = await coinGecko.collect(coinSymbol, 'price');
    console.log(`✅ Price: ${CFVCalculator.formatCurrency(price.value)} (${price.confidence})\n`);
    
    // Test 5: Collect circulating supply
    console.log(`📈 Step 5: Collecting circulating supply...`);
    const supply = await coinGecko.collect(coinSymbol, 'circulatingSupply');
    console.log(`✅ Circulating Supply: ${CFVCalculator.formatNumber(supply.value)} (${supply.confidence})\n`);
    
    // Test 6: Create mock data for transaction metrics (since we don't have blockchain explorer yet)
    console.log(`⚠️  Step 6: Using estimated transaction metrics (blockchain explorer not implemented)...`);
    const annualTxValue: MetricResult = {
      value: price.value * supply.value * 0.5, // Estimate: 50% of market cap transacted annually
      confidence: 'LOW',
      source: 'estimated',
      timestamp: new Date(),
      metadata: { note: 'Estimated based on market cap' },
    };
    const annualTxCount: MetricResult = {
      value: supply.value * 2, // Estimate: 2 transactions per coin per year
      confidence: 'LOW',
      source: 'estimated',
      timestamp: new Date(),
      metadata: { note: 'Estimated based on supply' },
    };
    console.log(`⚠️  Annual TX Value: ${CFVCalculator.formatCurrency(annualTxValue.value)} (estimated)`);
    console.log(`⚠️  Annual TX Count: ${CFVCalculator.formatNumber(annualTxCount.value)} (estimated)\n`);
    
    // Test 7: Calculate CFV
    console.log(`🧮 Step 7: Calculating CFV using 70/10/10/10 formula...`);
    const metrics: CFVMetrics = {
      communitySize,
      annualTransactionValue: annualTxValue,
      annualTransactions: annualTxCount,
      developers: {
        value: devValidation.adjustedValue || developersFromCG.value,
        confidence: devValidation.confidence,
        source: 'aggregated',
        timestamp: new Date(),
      },
      price,
      circulatingSupply: supply,
    };
    
    const calculation = CFVCalculator.calculate(metrics);
    
    // Display results
    console.log(`\n${'='.repeat(70)}`);
    console.log(`CFV CALCULATION RESULTS`);
    console.log(`${'='.repeat(70)}\n`);
    
    console.log(`📊 INPUT METRICS:`);
    console.log(`   Community Size:        ${CFVCalculator.formatNumber(metrics.communitySize.value)}`);
    console.log(`   Annual TX Value:       ${CFVCalculator.formatCurrency(metrics.annualTransactionValue.value)}`);
    console.log(`   Annual TX Count:       ${CFVCalculator.formatNumber(metrics.annualTransactions.value)}`);
    console.log(`   Developers:            ${metrics.developers.value}`);
    console.log(`   Current Price:         ${CFVCalculator.formatCurrency(metrics.price.value)}`);
    console.log(`   Circulating Supply:    ${CFVCalculator.formatNumber(metrics.circulatingSupply.value)}\n`);
    
    console.log(`💰 VALUATION:`);
    console.log(`   Network Power Score:   ${calculation.networkPowerScore.toExponential(2)}`);
    console.log(`   Fair Value:            ${CFVCalculator.formatCurrency(calculation.fairValue)}`);
    console.log(`   Current Price:         ${CFVCalculator.formatCurrency(calculation.currentPrice)}`);
    console.log(`   Price Multiplier:      ${calculation.priceMultiplier.toFixed(2)}x\n`);
    
    console.log(`   Fair Market Cap:       ${CFVCalculator.formatCurrency(calculation.fairMarketCap)}`);
    console.log(`   Current Market Cap:    ${CFVCalculator.formatCurrency(calculation.currentMarketCap)}\n`);
    
    const statusEmoji = calculation.valuationStatus === 'undervalued' ? '📉' : 
                        calculation.valuationStatus === 'overvalued' ? '📈' : '⚖️';
    console.log(`   Status:                ${statusEmoji} ${calculation.valuationStatus.toUpperCase()}`);
    console.log(`   Valuation:             ${calculation.valuationPercent > 0 ? '+' : ''}${calculation.valuationPercent.toFixed(1)}%\n`);
    
    console.log(`📝 ANALYSIS:`);
    console.log(`   ${CFVCalculator.getValuationDescription(calculation.valuationStatus, calculation.valuationPercent)}\n`);
    
    console.log(`${'='.repeat(70)}\n`);
    
    console.log(`✅ Test completed successfully!`);
    console.log(`\n⚠️  NOTE: Transaction metrics are estimated. For accurate results, implement`);
    console.log(`   blockchain explorer integration for ${coinSymbol}.\n`);
    
  } catch (error) {
    console.error(`\n❌ Error during test:`, error);
    throw error;
  }
}

// Main function
async function main() {
  const coinSymbol = process.argv[2] || 'BTC';
  
  try {
    await testCFVCalculation(coinSymbol);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
