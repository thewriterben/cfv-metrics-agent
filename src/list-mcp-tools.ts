import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import dotenv from 'dotenv';

dotenv.config();

async function listMCPTools() {
  console.log('🔧 Listing CoinGecko MCP Tools\n');

  try {
    // Create transport
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

    // Connect
    console.log('📡 Connecting...');
    await client.connect(transport);
    console.log('✅ Connected!\n');

    // List all tools
    const tools = await client.listTools();
    console.log(`Found ${tools.tools.length} tools:\n`);
    
    tools.tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Input Schema:`, JSON.stringify(tool.inputSchema, null, 2).substring(0, 200) + '...\n');
    });

    // Close
    await client.close();
    console.log('\n✨ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listMCPTools();
