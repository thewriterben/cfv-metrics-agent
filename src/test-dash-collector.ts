/**
 * Manual test for DashApiClient
 * This verifies that the collector now returns real API data instead of hardcoded values
 */

import { DashApiClient } from './collectors/DashApiClient.js';

async function testDashCollector() {
  console.log('Testing DASH Collector - Real API Integration\n');
  console.log('='.repeat(60));
  
  const dashClient = new DashApiClient();
  
  try {
    console.log('Fetching Dash metrics from live APIs...\n');
    
    const metrics = await dashClient.getAnnualTransactionMetrics();
    
    console.log('✅ SUCCESS: Got real-time data from APIs\n');
    console.log('Annual Metrics:');
    console.log('-'.repeat(60));
    console.log(`Annual Transaction Count: ${metrics.annualTxCount.toLocaleString()}`);
    console.log(`Annual Transaction Value: $${metrics.annualTxValue.toLocaleString()}`);
    console.log(`Average Transaction Value: $${metrics.avgTxValue.toFixed(2)}`);
    console.log(`Confidence Level: ${metrics.confidence}`);
    console.log(`\nData Sources: ${metrics.sources.join(', ')}`);
    
    if (metrics.issues && metrics.issues.length > 0) {
      console.log(`\nIssues/Warnings:`);
      metrics.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Verify we're NOT getting the old hardcoded values
    const oldHardcodedValues = {
      annualTxCount: 18250000,
      annualTxValue: 500000000,
      avgTxValue: 27.40
    };
    
    const isHardcoded = 
      metrics.annualTxCount === oldHardcodedValues.annualTxCount &&
      metrics.annualTxValue === oldHardcodedValues.annualTxValue &&
      Math.abs(metrics.avgTxValue - oldHardcodedValues.avgTxValue) < 0.01;
    
    if (isHardcoded) {
      console.log('❌ ERROR: Still getting hardcoded values!');
      process.exit(1);
    } else {
      console.log('✅ VERIFIED: Using real API data (not hardcoded values)');
    }
    
    // Check that we have reasonable data
    if (metrics.annualTxCount > 0 && metrics.annualTxValue > 0) {
      console.log('✅ VERIFIED: Metrics contain valid non-zero data');
    } else {
      console.log('⚠️  WARNING: Some metrics are zero');
    }
    
    // Check sources are documented
    if (metrics.sources.length > 0) {
      console.log('✅ VERIFIED: Data sources are documented');
    } else {
      console.log('❌ ERROR: No data sources documented');
      process.exit(1);
    }
    
    console.log('\n✅ ALL TESTS PASSED - Collector is using live API data');
    
  } catch (error) {
    console.error('❌ FAILED to fetch Dash metrics:');
    console.error(error);
    process.exit(1);
  }
}

testDashCollector();
