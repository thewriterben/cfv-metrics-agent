# CoinGecko MCP Integration - Complete Guide

## Overview

The CFV Metrics Agent now uses the **official CoinGecko MCP (Model Context Protocol) server** for reliable, structured cryptocurrency data collection. This provides significant advantages over direct API calls.

## ✅ What's Working

- ✅ **CoinGecko MCP Server** - Connected and operational
- ✅ **50+ Tools Available** - Full access to CoinGecko data
- ✅ **Metric Collection** - Community, price, market cap, developers
- ✅ **Data Validation** - Confidence scoring and issue detection
- ✅ **CFV Calculation** - Complete 70/10/10/10 formula implementation
- ✅ **API Key Authentication** - Configured and tested

## 🎯 Advantages Over Direct API

| Feature | Direct API | MCP Server |
|---------|-----------|------------|
| **Data Structure** | Raw JSON | Typed, structured data |
| **Tool Discovery** | Manual | Automatic (50+ tools) |
| **Rate Limiting** | Manual handling | Built-in management |
| **Authentication** | Per-request headers | Session-based |
| **Real-time Updates** | Polling | HTTP streaming |
| **Reliability** | Variable | 24/7 uptime (Pro) |
| **Error Handling** | Custom | Standardized MCP errors |

## 📊 Metrics Collected

### Primary Metrics (from CoinGecko MCP)

1. **Community Size**
   - Source: Twitter followers, Reddit subscribers, Telegram users
   - Method: Takes the maximum of all community metrics
   - Confidence: HIGH

2. **Current Price**
   - Source: Aggregated from 1,000+ exchanges
   - Confidence: HIGH

3. **Market Cap**
   - Source: Calculated from price × circulating supply
   - Confidence: HIGH

4. **Circulating Supply**
   - Source: CoinGecko verified data
   - Confidence: HIGH

5. **Developers**
   - Source: GitHub contributors, forks, stars
   - Method: Weighted calculation
   - Confidence: MEDIUM

### Estimated Metrics (require blockchain data)

6. **Annual Transaction Value**
   - Current Method: 24h volume × 365
   - Confidence: MEDIUM
   - ⚠️ Recommendation: Use blockchain explorer for accuracy

7. **Annual Transaction Count**
   - Current Method: Circulating supply × 2
   - Confidence: LOW
   - ⚠️ Recommendation: Use blockchain explorer for accuracy

## 🔧 Available MCP Tools

The CoinGecko MCP server provides 50 tools across multiple categories:

### Coin Data (10 tools)
- `get_id_coins` - Complete coin metadata and market data
- `get_coins_markets` - Market data for multiple coins
- `get_coins_top_gainers_losers` - Trending coins
- `get_new_coins_list` - Recently listed coins
- `get_coins_history` - Historical data
- `get_range_coins_market_chart` - Historical charts
- `get_range_coins_ohlc` - OHLCV data
- And more...

### Exchange Data (5 tools)
- `get_id_exchanges` - Exchange information
- `get_list_exchanges` - All exchanges
- `get_exchanges_tickers` - Exchange tickers
- And more...

### On-chain Data (20+ tools)
- `get_onchain_networks` - Network information
- `get_pools_networks_onchain_info` - DEX pool data
- `get_tokens_networks_onchain_info` - Token information
- And more...

### Global Data (5 tools)
- `get_global` - Global crypto market data
- `get_search` - Search coins
- `get_search_trending` - Trending searches
- And more...

## 🚀 Usage

### Basic Usage

```typescript
import { CoinGeckoMCPCollector } from './collectors/CoinGeckoMCPCollector.js';

// Initialize collector
const collector = new CoinGeckoMCPCollector(process.env.COINGECKO_API_KEY);

// Collect metrics
const metrics = await collector.collectMetrics('nano');

console.log(metrics);
// {
//   communitySize: 4339,
//   annualTxValue: 551020060,
//   annualTxCount: 266496594,
//   developers: 11,
//   currentPrice: 0.62379,
//   marketCap: 81644738,
//   circulatingSupply: 133248297
// }

// Validate metrics
const validation = collector.validateMetrics(metrics);
console.log(validation.confidence); // 'MEDIUM'
console.log(validation.issues); // Array of issues

// Disconnect when done
await collector.disconnect();
```

### With CFV Calculation

```typescript
import { CoinGeckoMCPCollector } from './collectors/CoinGeckoMCPCollector.js';
import { CFVCalculator } from './utils/CFVCalculator.js';

const collector = new CoinGeckoMCPCollector(process.env.COINGECKO_API_KEY);
const metrics = await collector.collectMetrics('dash');

// Convert to full metrics format
const fullMetrics = {
  communitySize: { 
    value: metrics.communitySize!, 
    confidence: 'MEDIUM', 
    source: 'CoinGecko MCP', 
    timestamp: new Date() 
  },
  annualTransactionValue: { 
    value: metrics.annualTxValue!, 
    confidence: 'MEDIUM', 
    source: 'CoinGecko MCP', 
    timestamp: new Date() 
  },
  annualTransactions: { 
    value: metrics.annualTxCount!, 
    confidence: 'MEDIUM', 
    source: 'CoinGecko MCP', 
    timestamp: new Date() 
  },
  developers: { 
    value: metrics.developers!, 
    confidence: 'MEDIUM', 
    source: 'CoinGecko MCP', 
    timestamp: new Date() 
  },
  price: { 
    value: metrics.currentPrice!, 
    confidence: 'HIGH', 
    source: 'CoinGecko MCP', 
    timestamp: new Date() 
  },
  circulatingSupply: { 
    value: metrics.circulatingSupply!, 
    confidence: 'HIGH', 
    source: 'CoinGecko MCP', 
    timestamp: new Date() 
  }
};

// Calculate CFV
const result = CFVCalculator.calculate(fullMetrics);

console.log(`Fair Value: $${result.fairValue.toFixed(2)}`);
console.log(`Current Price: $${result.currentPrice}`);
console.log(`Valuation: ${result.valuationStatus}`);
console.log(`Network Power Score: ${result.networkPowerScore.toFixed(2)}`);
```

## 🔐 Configuration

### Environment Variables

```bash
# Required
COINGECKO_API_KEY=CG-2YSqU75XEvKC2oV38hnvQfGd

# Optional (for other collectors)
ETHERSCAN_API_KEY=your_etherscan_key
GITHUB_TOKEN=your_github_token
REDIS_URL=redis://localhost:6379
```

### MCP Server Options

The collector automatically uses the local MCP server with your API key:

```typescript
// Automatic configuration
const collector = new CoinGeckoMCPCollector(apiKey);

// The collector internally uses:
// - Command: npx -y @coingecko/coingecko-mcp
// - Environment: COINGECKO_DEMO_API_KEY=<your_key>
```

## 📈 Test Results

### Nano (XNO)
```
✅ Metrics collected:
- Community Size: 4,339
- Annual TX Value: $551,020,060
- Annual TX Count: 266,496,594
- Developers: 11
- Current Price: $0.62379
- Market Cap: $81,644,738
- Circulating Supply: 133,248,297

✅ Validation: true
- Confidence: MEDIUM
- Issues: Transaction metrics are estimated
```

### Dash
```
✅ Metrics collected:
- Community Size: 9,971
- Annual TX Value: $49,108,516,930
- Annual TX Count: 25,153,289
- Developers: 0
- Current Price: $42.91
- Market Cap: $538,386,995
- Circulating Supply: 12,576,644.59

✅ Validation: true
- Confidence: MEDIUM
- Issues: Transaction metrics are estimated
```

## ⚠️ Known Limitations

### 1. Transaction Metrics Are Estimated

**Problem**: CoinGecko doesn't provide on-chain transaction data

**Current Solution**: 
- Annual TX Value = 24h volume × 365
- Annual TX Count = Circulating supply × 2

**Recommendation**: Integrate blockchain explorers for accurate data:
- Etherscan (Ethereum)
- Blockchain.com (Bitcoin)
- Nanocrawler (Nano)
- Insight API (Dash, DigiByte)

### 2. Coin Symbol to ID Mapping

**Problem**: CoinGecko uses internal IDs (e.g., "nano" not "XNO")

**Current Solution**: Assumes lowercase symbol = ID

**Recommendation**: Implement coin ID mapping database:
```typescript
const COIN_ID_MAP = {
  'XNO': 'nano',
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'DASH': 'dash',
  // ... etc
};
```

### 3. Developer Metrics Vary by Coin

**Problem**: Not all coins have GitHub data

**Current Solution**: Returns 0 if no data available

**Recommendation**: Add alternative developer metrics:
- Commit frequency
- Active contributors (last 90 days)
- Code quality metrics

## 🎯 Next Steps

### Immediate (High Priority)

1. **Add Blockchain Explorer Integration**
   - Etherscan for Ethereum-based coins
   - Blockchain.com API for Bitcoin
   - Coin-specific explorers for DGF coins

2. **Create Coin ID Mapping**
   - Build comprehensive symbol-to-ID database
   - Add search functionality
   - Handle edge cases (multiple coins with same symbol)

3. **Improve Developer Metrics**
   - Add commit frequency analysis
   - Track active vs. total contributors
   - Include code quality metrics

### Future Enhancements

4. **Add More MCP Tools**
   - Historical data analysis
   - On-chain metrics
   - DEX liquidity data

5. **Implement Caching**
   - Redis integration for MCP responses
   - Reduce API calls
   - Improve performance

6. **Add Real-time Updates**
   - WebSocket support
   - Live price feeds
   - Alert system

## 📚 Resources

- **CoinGecko MCP Docs**: https://docs.coingecko.com/docs/mcp-server
- **MCP SDK**: https://github.com/modelcontextprotocol/sdk
- **CoinGecko API**: https://www.coingecko.com/en/api
- **CFV Formula**: THE FAIR VALUE FORMULA FOR BITCOIN, ALTCOINS & DIGITAL GOLD

## 🐛 Troubleshooting

### Error: "Could not resolve authentication method"

**Solution**: Make sure `COINGECKO_API_KEY` is set in `.env` file

### Error: "Unknown tool: get_coin_by_id"

**Solution**: Use correct tool name `get_id_coins` (check available tools list)

### Error: "Coin not found"

**Solution**: Use CoinGecko coin ID, not symbol (e.g., "nano" not "XNO")

### Low Confidence Scores

**Solution**: This is expected for estimated metrics. Integrate blockchain explorers for better accuracy.

## ✨ Summary

The CoinGecko MCP integration provides:
- ✅ Reliable, structured data access
- ✅ 50+ tools for comprehensive analysis
- ✅ Built-in rate limiting and error handling
- ✅ High confidence for price and market data
- ⚠️ Medium confidence for estimated transaction metrics

**For production use**: Add blockchain explorer integration for accurate transaction data.
