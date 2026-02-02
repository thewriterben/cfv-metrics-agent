import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

async function testCoinGeckoMCP() {
  console.log('🚀 Testing CoinGecko MCP Server Integration\n');

  try {
    // Spawn the MCP server process
    const serverProcess = spawn('npx', ['-y', '@coingecko/coingecko-mcp'], {
      env: {
        ...process.env,
        COINGECKO_DEMO_API_KEY: process.env.COINGECKO_API_KEY || '',
        COINGECKO_ENVIRONMENT: 'demo'
      }
    });

    // Create transport using stdio
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@coingecko/coingecko-mcp'],
      env: {
        COINGECKO_DEMO_API_KEY: process.env.COINGECKO_API_KEY || '',
        COINGECKO_ENVIRONMENT: 'demo'
      }
    });

    // Create MCP client
    const client = new Client({
      name: 'cfv-metrics-agent',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Connect to the server
    console.log('📡 Connecting to CoinGecko MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!\n');

    // List available tools
    console.log('🔧 Available Tools:');
    const tools = await client.listTools();
    console.log(`Found ${tools.tools.length} tools:\n`);
    
    tools.tools.slice(0, 10).forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   ${tool.description}\n`);
    });

    if (tools.tools.length > 10) {
      console.log(`... and ${tools.tools.length - 10} more tools\n`);
    }

    // Test a simple tool call - get Bitcoin data
    console.log('🪙 Testing: Get Bitcoin market data...');
    const btcResult = await client.callTool({
      name: 'get_coin_by_id',
      arguments: {
        id: 'bitcoin',
        localization: 'false',
        tickers: 'false',
        market_data: 'true',
        community_data: 'true',
        developer_data: 'true'
      }
    });

    console.log('✅ Bitcoin data retrieved!');
    const content = (btcResult.content as any)[0];
    if (content.type === 'text') {
      const data = JSON.parse(content.text);
      console.log('\nKey Metrics:');
      console.log(`- Name: ${data.name}`);
      console.log(`- Symbol: ${data.symbol}`);
      console.log(`- Price (USD): $${data.market_data?.current_price?.usd?.toLocaleString()}`);
      console.log(`- Market Cap (USD): $${data.market_data?.market_cap?.usd?.toLocaleString()}`);
      console.log(`- 24h Volume (USD): $${data.market_data?.total_volume?.usd?.toLocaleString()}`);
      console.log(`- Community Score: ${data.community_score}`);
      console.log(`- Developer Score: ${data.developer_score}`);
    }

    // Close connection
    await client.close();
    serverProcess.kill();
    
    console.log('\n✨ MCP integration test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing MCP:', error);
    process.exit(1);
  }
}

// Run the test
testCoinGeckoMCP();
