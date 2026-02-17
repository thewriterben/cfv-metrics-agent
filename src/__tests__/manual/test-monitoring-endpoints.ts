#!/usr/bin/env node
import axios from 'axios';

/**
 * Test monitoring endpoints
 * This script assumes the API server is running on port 3000
 */

const BASE_URL = 'http://localhost:3000';

console.log('='.repeat(80));
console.log('Testing Monitoring Endpoints');
console.log('='.repeat(80));
console.log('');
console.log('NOTE: Ensure the API server is running before running this test');
console.log('      Run: npm start');
console.log('');

async function testEndpoint(name: string, url: string, checkResponse?: (data: any) => void) {
  try {
    console.log(`Testing ${name}...`);
    const response = await axios.get(url);
    console.log(`  ✓ Status: ${response.status}`);
    
    if (checkResponse) {
      checkResponse(response.data);
    }
    
    console.log('');
    return true;
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}`);
    if (error.response) {
      console.error(`    Status: ${error.response.status}`);
    }
    console.log('');
    return false;
  }
}

async function runTests() {
  const results: boolean[] = [];
  
  // Test 1: Health Live
  results.push(await testEndpoint(
    'Liveness Probe',
    `${BASE_URL}/health/live`,
    (data) => {
      console.log(`  Status: ${data.status}`);
    }
  ));
  
  // Test 2: Health Ready
  results.push(await testEndpoint(
    'Readiness Probe',
    `${BASE_URL}/health/ready`,
    (data) => {
      console.log(`  Status: ${data.status}`);
      console.log(`  Uptime: ${data.uptime?.toFixed(2)}s`);
    }
  ));
  
  // Test 3: Health Detailed
  results.push(await testEndpoint(
    'Detailed Health Check',
    `${BASE_URL}/health/detailed`,
    (data) => {
      console.log(`  Status: ${data.status}`);
      console.log(`  Database: ${data.checks?.database?.status}`);
      console.log(`  System: ${data.checks?.system?.status}`);
    }
  ));
  
  // Test 4: Metrics JSON
  results.push(await testEndpoint(
    'Metrics (JSON)',
    `${BASE_URL}/metrics`,
    (data) => {
      console.log(`  Counters: ${Object.keys(data.data?.counters || {}).length} metrics`);
      console.log(`  Gauges: ${Object.keys(data.data?.gauges || {}).length} metrics`);
    }
  ));
  
  // Test 5: Metrics Prometheus
  results.push(await testEndpoint(
    'Metrics (Prometheus)',
    `${BASE_URL}/metrics/prometheus`,
    (data) => {
      const lines = data.split('\n').filter((l: string) => l.trim()).length;
      console.log(`  Lines: ${lines}`);
    }
  ));
  
  // Test 6: Performance Metrics
  results.push(await testEndpoint(
    'Performance Metrics',
    `${BASE_URL}/metrics/performance`,
    (data) => {
      const ops = Object.keys(data.data || {}).length;
      console.log(`  Operations tracked: ${ops}`);
    }
  ));
  
  // Test 7: System Metrics
  results.push(await testEndpoint(
    'System Metrics',
    `${BASE_URL}/metrics/system`,
    (data) => {
      console.log(`  Uptime: ${data.data?.uptime?.toFixed(2)}s`);
      console.log(`  Heap Used: ${(data.data?.memory?.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
  ));
  
  // Test 8: Dashboard
  results.push(await testEndpoint(
    'Dashboard',
    `${BASE_URL}/dashboard`,
    (data) => {
      console.log(`  Health status: ${data.health?.status}`);
      console.log(`  Metrics included: ${data.metrics ? 'Yes' : 'No'}`);
      console.log(`  Performance included: ${data.performance ? 'Yes' : 'No'}`);
      console.log(`  System info included: ${data.system ? 'Yes' : 'No'}`);
    }
  ));
  
  console.log('='.repeat(80));
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Tests Passed: ${passed}/${total}`);
  console.log('='.repeat(80));
  
  if (passed === total) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
