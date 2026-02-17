#!/usr/bin/env tsx
/**
 * Verification script for concurrent collection scheduler
 * 
 * This script demonstrates the concurrency improvements by simulating
 * coin collections with different concurrency levels.
 */

import { performance } from 'perf_hooks';

interface CoinMock {
  symbol: string;
  name: string;
  delay: number; // Simulated collection time in ms
}

const mockCoins: CoinMock[] = [
  { symbol: 'BTC', name: 'Bitcoin', delay: 2000 },
  { symbol: 'ETH', name: 'Ethereum', delay: 1500 },
  { symbol: 'DASH', name: 'Dash', delay: 1800 },
  { symbol: 'DGB', name: 'DigiByte', delay: 2200 },
  { symbol: 'XMR', name: 'Monero', delay: 1900 },
  { symbol: 'RVN', name: 'Ravencoin', delay: 1700 },
  { symbol: 'XCH', name: 'Chia', delay: 2100 },
  { symbol: 'XEC', name: 'eCash', delay: 1600 },
  { symbol: 'XNO', name: 'Nano', delay: 1400 },
  { symbol: 'NEAR', name: 'NEAR', delay: 2000 },
  { symbol: 'ICP', name: 'Internet Computer', delay: 1800 },
];

// Simulate sequential collection (old approach)
async function collectSequentially(coins: CoinMock[], delayBetweenCoins: number): Promise<number> {
  const startTime = performance.now();
  
  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];
    console.log(`  📊 Collecting ${coin.name} (${coin.symbol})...`);
    await new Promise(resolve => setTimeout(resolve, coin.delay));
    console.log(`  ✅ ${coin.symbol} complete`);
    
    // Add delay between coins (old rate limiting approach)
    if (i < coins.length - 1) {
      console.log(`  ⏳ Waiting ${delayBetweenCoins}ms for rate limiting...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenCoins));
    }
  }
  
  const duration = performance.now() - startTime;
  return duration;
}

// Simulate concurrent collection (new approach)
async function collectConcurrently(coins: CoinMock[], maxConcurrency: number): Promise<number> {
  const startTime = performance.now();
  
  const results: Promise<void>[] = [];
  const executing: Promise<void>[] = [];
  
  for (const coin of coins) {
    const promise = (async () => {
      console.log(`  📊 Collecting ${coin.name} (${coin.symbol})...`);
      await new Promise(resolve => setTimeout(resolve, coin.delay));
      console.log(`  ✅ ${coin.symbol} complete`);
    })();
    
    results.push(promise);
    
    // If we've reached max concurrency, wait for one to finish
    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
    }
    
    executing.push(promise);
    promise.finally(() => {
      const index = executing.indexOf(promise);
      if (index !== -1) {
        executing.splice(index, 1);
      }
    });
  }
  
  // Wait for all remaining promises
  await Promise.all(results);
  
  const duration = performance.now() - startTime;
  return duration;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('Collection Scheduler Concurrency Verification');
  console.log('='.repeat(80));
  console.log(`Testing with ${mockCoins.length} coins\n`);
  
  // Test 1: Sequential (old approach)
  console.log('Test 1: Sequential Collection (Old Approach)');
  console.log('-'.repeat(80));
  const sequentialDuration = await collectSequentially(mockCoins, 5000);
  console.log(`Total time: ${(sequentialDuration / 1000).toFixed(2)}s\n`);
  
  // Test 2: Concurrent with concurrency=3
  console.log('Test 2: Concurrent Collection (maxConcurrency=3)');
  console.log('-'.repeat(80));
  const concurrent3Duration = await collectConcurrently(mockCoins, 3);
  console.log(`Total time: ${(concurrent3Duration / 1000).toFixed(2)}s\n`);
  
  // Test 3: Concurrent with concurrency=5
  console.log('Test 3: Concurrent Collection (maxConcurrency=5)');
  console.log('-'.repeat(80));
  const concurrent5Duration = await collectConcurrently(mockCoins, 5);
  console.log(`Total time: ${(concurrent5Duration / 1000).toFixed(2)}s\n`);
  
  // Summary
  console.log('='.repeat(80));
  console.log('Summary:');
  console.log('-'.repeat(80));
  console.log(`Sequential:              ${(sequentialDuration / 1000).toFixed(2)}s`);
  console.log(`Concurrent (max=3):      ${(concurrent3Duration / 1000).toFixed(2)}s (${((1 - concurrent3Duration / sequentialDuration) * 100).toFixed(1)}% faster)`);
  console.log(`Concurrent (max=5):      ${(concurrent5Duration / 1000).toFixed(2)}s (${((1 - concurrent5Duration / sequentialDuration) * 100).toFixed(1)}% faster)`);
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
