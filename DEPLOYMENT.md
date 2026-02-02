# CFV Metrics Agent - Deployment Guide

## 🎯 Project Status

### ✅ Working Features
- Core agent architecture with multi-source data collection
- CoinGecko API integration for cryptocurrency metrics
- GitHub API integration for developer statistics
- Etherscan integration framework (ready for API key)
- Data validation engine with confidence scoring
- CFV calculation using 70/10/10/10 formula
- Redis caching system
- Standalone testing capability
- Comprehensive error handling

### 🔄 Framework (Needs Implementation)
- Full Copilot SDK integration (requires Copilot CLI installation)
- Blockchain explorer integration for accurate transaction data
- Additional exchange API integrations
- Real-time streaming data

### 📋 Planned Features
- Machine learning for anomaly detection
- Sentiment analysis from social media
- Historical trend analysis
- Web API for third-party integrations
- Dashboard UI

## 📦 Installation

### Prerequisites

1. **Node.js 18+** or **TypeScript 5+**
2. **Redis Server**
   ```bash
   sudo apt-get update
   sudo apt-get install -y redis-server
   sudo service redis-server start
   ```

3. **API Keys** (Optional but recommended):
   - CoinGecko API key: https://www.coingecko.com/en/api/pricing
   - Etherscan API key: https://etherscan.io/apis
   - GitHub Token: https://github.com/settings/tokens

### Setup Steps

1. **Navigate to project directory**:
   ```bash
   cd /home/ubuntu/cfv-metrics-agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment** (`.env` file already created):
   ```bash
   # Edit .env to add your API keys
   nano .env
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

## 🚀 Usage

### Standalone Testing (Recommended)

Test the agent without Copilot CLI:

```bash
# Test with a cryptocurrency symbol
npm run test:standalone <SYMBOL>

# Examples:
npm run test:standalone BTC    # Bitcoin (note: may find wrong coin)
npm run test:standalone DASH   # Dash
npm run test:standalone DGB    # DigiByte
```

**Note**: CoinGecko uses internal IDs, not always ticker symbols. For accurate results, you may need to use the CoinGecko ID instead of the ticker symbol.

### Full Agent (Requires Copilot CLI)

```bash
# Development mode with hot reload
npm run dev <SYMBOL>

# Production mode
npm run build
npm start <SYMBOL>
```

## ⚠️ Known Issues & Limitations

### 1. Coin Symbol Resolution

**Issue**: CoinGecko uses internal IDs that don't always match ticker symbols.

**Example**: 
- Searching for "BTC" might find a small alt-coin instead of Bitcoin
- "ETH" might not be recognized as Ethereum

**Solutions**:
- Use CoinGecko's coin list API to map symbols to IDs
- Implement a symbol-to-ID mapping database
- Add manual override capability

**Workaround**: Test with known working coins like DASH, DGB, or use full coin names.

### 2. Transaction Data Accuracy

**Issue**: Without blockchain explorer integration, transaction metrics are estimated.

**Current Behavior**:
- Annual TX Value: Estimated as 50% of market cap
- Annual TX Count: Estimated as 2× circulating supply

**Impact**: Fair value calculations may be inaccurate.

**Solution**: Implement blockchain explorer integration:
- Etherscan for Ethereum tokens
- Blockchain.com for Bitcoin
- Chain-specific explorers for other coins

### 3. Developer Metrics

**Issue**: Not all coins have GitHub repositories or public developer data.

**Current Behavior**:
- Falls back to CoinGecko developer stats
- May return 0 if no data available

**Solution**: 
- Add GitLab support
- Scrape project websites
- Use alternative developer activity metrics

### 4. API Rate Limits

**Issue**: Free tier API limits can be restrictive.

**Limits**:
- CoinGecko Demo: 30 calls/minute
- Etherscan Free: 5 calls/second
- GitHub Unauthenticated: 60 requests/hour

**Solution**:
- Upgrade to paid API plans
- Implement aggressive caching
- Add request queuing

## 🔧 Configuration

### Environment Variables

Edit `.env` file:

```bash
# API Keys (add your keys here)
COINGECKO_API_KEY=your_key_here
ETHERSCAN_API_KEY=your_key_here
GITHUB_TOKEN=your_token_here

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Cache TTLs (seconds)
CACHE_TTL_SHORT=300       # 5 minutes (price data)
CACHE_TTL_MEDIUM=3600     # 1 hour (transaction data)
CACHE_TTL_LONG=86400      # 24 hours (community data)
CACHE_TTL_VERY_LONG=604800 # 7 days (static metadata)

# Rate Limits
RATE_LIMIT_COINGECKO=30
RATE_LIMIT_ETHERSCAN=5
RATE_LIMIT_GITHUB=5000

# Timeouts
COLLECTOR_TIMEOUT=30000   # 30 seconds
```

### Redis Configuration

Default configuration works for local development. For production:

```bash
# Redis with authentication
REDIS_URL=redis://username:password@host:port/database

# Redis Cluster
REDIS_URL=redis://host1:port1,host2:port2,host3:port3
```

## 📊 Testing Results

### Test Case 1: Small Alt-Coin (BTC - wrong coin)
- ✅ API calls successful
- ✅ Data collection working
- ⚠️  Low confidence due to limited data
- ⚠️  Symbol resolution issue

### Test Case 2: Major Cryptocurrency
- ❌ Symbol not recognized (ETH, XNO)
- 📋 Need to implement coin ID mapping

### Recommendations:
1. Implement CoinGecko coin list caching
2. Add symbol-to-ID mapping
3. Test with known working symbols
4. Add coin search/autocomplete feature

## 🎯 Next Steps for Production

### Priority 1: Critical Fixes
1. **Implement coin symbol resolution**
   - Cache CoinGecko coin list
   - Map symbols to IDs
   - Add fuzzy search

2. **Add blockchain explorer integration**
   - Etherscan for ETH tokens
   - Blockchain.com for BTC
   - Chain-specific explorers

3. **Improve error handling**
   - Better error messages
   - Graceful fallbacks
   - Retry logic

### Priority 2: Enhanced Features
1. **Add more data sources**
   - CryptoCompare API
   - Messari API
   - Glassnode (on-chain metrics)

2. **Implement caching improvements**
   - Cache warming
   - Background refresh
   - Cache invalidation strategies

3. **Add monitoring**
   - Health checks
   - Performance metrics
   - Error tracking

### Priority 3: User Experience
1. **Create web interface**
   - Search and autocomplete
   - Real-time updates
   - Historical charts

2. **Add export capabilities**
   - PDF reports
   - CSV data export
   - API endpoints

3. **Implement user preferences**
   - Custom formulas
   - Favorite coins
   - Alert notifications

## 📝 API Key Setup Guide

### CoinGecko API Key

1. Visit: https://www.coingecko.com/en/api/pricing
2. Choose plan:
   - **Demo** (Free): 30 calls/min, 10,000 calls/month
   - **Analyst** ($129/month): 500 calls/min, unlimited calls
3. Copy API key to `.env`: `COINGECKO_API_KEY=your_key`

### Etherscan API Key

1. Visit: https://etherscan.io/apis
2. Sign up for free account
3. Create API key (Free: 5 calls/second)
4. Copy to `.env`: `ETHERSCAN_API_KEY=your_key`

### GitHub Token

1. Visit: https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scope: `public_repo` (read-only)
4. Copy to `.env`: `GITHUB_TOKEN=your_token`

**Benefits**:
- Unauthenticated: 60 requests/hour
- Authenticated: 5,000 requests/hour

## 🐛 Troubleshooting

### Redis Connection Error

```bash
# Check Redis status
sudo service redis-server status

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping
# Should return: PONG
```

### API Rate Limit Exceeded

**Symptoms**: "429 Too Many Requests" errors

**Solutions**:
1. Wait for rate limit to reset (typically 1 minute)
2. Upgrade to paid API plan
3. Increase cache TTLs
4. Reduce request frequency

### Coin Not Found

**Symptoms**: "Coin not supported" error

**Solutions**:
1. Try different symbol variations (BTC, Bitcoin, bitcoin)
2. Check CoinGecko website for correct ID
3. Use coin's full name instead of symbol
4. Implement coin search feature

### Low Confidence Results

**Symptoms**: All metrics show "LOW" confidence

**Causes**:
- Coin has limited data available
- API keys not configured
- Blockchain explorer not implemented

**Solutions**:
1. Add API keys to `.env`
2. Use coins with better data availability
3. Implement additional data sources
4. Use manual input for critical calculations

## 📚 Additional Resources

- **CoinGecko API Docs**: https://docs.coingecko.com/
- **Etherscan API Docs**: https://docs.etherscan.io/
- **GitHub API Docs**: https://docs.github.com/en/rest
- **Redis Docs**: https://redis.io/documentation
- **Copilot SDK**: https://github.com/github/copilot-sdk

## 🤝 Support

For issues, questions, or feature requests:
1. Check this documentation
2. Review error messages carefully
3. Test with known working coins
4. Open an issue on GitHub

## 📄 License

ISC

## ✨ Acknowledgments

- Built with GitHub Copilot SDK
- Data provided by CoinGecko, Etherscan, and GitHub
- Inspired by THE FAIR VALUE FORMULA FOR BITCOIN, ALTCOINS & DIGITAL GOLD (DGD)
