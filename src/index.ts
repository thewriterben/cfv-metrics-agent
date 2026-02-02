import * as dotenv from 'dotenv';
import { CFVAgent } from './CFVAgent';

// Load environment variables
dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║          CFV METRICS AGENT - Crypto Fair Value           ║
╚═══════════════════════════════════════════════════════════╝

Usage: npm run dev <COIN_SYMBOL>

Example:
  npm run dev BTC
  npm run dev ETH
  npm run dev XNO

The agent will:
  1. Gather metrics from multiple sources (CoinGecko, Etherscan, GitHub)
  2. Validate and aggregate data
  3. Calculate fair value using the 70/10/10/10 formula
  4. Compare with current market price

Environment Variables:
  COINGECKO_API_KEY    - CoinGecko API key (optional, demo key used if not set)
  ETHERSCAN_API_KEY    - Etherscan API key (optional)
  GITHUB_TOKEN         - GitHub personal access token (optional)
  REDIS_URL            - Redis connection URL (default: redis://localhost:6379)
`);
    process.exit(0);
  }
  
  const coinSymbol = args[0].toUpperCase();
  
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          CFV METRICS AGENT - Crypto Fair Value           ║
╚═══════════════════════════════════════════════════════════╝
`);
  
  // Initialize agent
  const agent = new CFVAgent({
    coinGeckoApiKey: process.env.COINGECKO_API_KEY,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    githubToken: process.env.GITHUB_TOKEN,
    redisUrl: process.env.REDIS_URL,
  });
  
  try {
    // Calculate CFV
    const result = await agent.calculateCFV(coinSymbol);
    
    // Display formatted result
    console.log(agent.formatResult(result));
    
    // Display data sources
    console.log(`📚 DATA SOURCES`);
    console.log(`${'─'.repeat(60)}`);
    Object.entries(result.metrics).forEach(([metric, data]) => {
      if (data.metadata?.sources) {
        console.log(`  ${metric}: ${data.metadata.sources.join(', ')}`);
      } else {
        console.log(`  ${metric}: ${data.source}`);
      }
    });
    console.log();
    
    // Display timestamp
    console.log(`⏰ Generated: ${result.timestamp.toLocaleString()}`);
    console.log();
    
  } catch (error) {
    console.error(`\n❌ Error calculating CFV for ${coinSymbol}:`);
    console.error(error);
    process.exit(1);
  } finally {
    await agent.close();
  }
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
