import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { SimpleCFVMetrics, DataSource, ValidationResult } from '../types/index.js';

/**
 * CoinGecko MCP Collector
 * Uses the official CoinGecko MCP server for reliable, structured data access
 */
export class CoinGeckoMCPCollector {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  constructor(private apiKey: string = '') {}

  /**
   * Connect to the CoinGecko MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      // Create transport
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@coingecko/coingecko-mcp'],
        env: {
          COINGECKO_DEMO_API_KEY: this.apiKey,
          COINGECKO_ENVIRONMENT: 'demo'
        }
      });

      // Create client
      this.client = new Client({
        name: 'cfv-metrics-agent',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Connect
      await this.client.connect(this.transport);
      this.isConnected = true;
      console.log('✅ Connected to CoinGecko MCP server');
    } catch (error) {
      console.error('❌ Failed to connect to CoinGecko MCP:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔌 Disconnected from CoinGecko MCP server');
    }
  }

  /**
   * Collect CFV metrics for a cryptocurrency
   */
  async collectMetrics(symbol: string): Promise<SimpleCFVMetrics> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      // Convert symbol to coin ID (simplified - in production, use a mapping)
      const coinId = symbol.toLowerCase();

      // Get comprehensive coin data
      const result = await this.client.callTool({
        name: 'get_id_coins',
        arguments: {
          id: coinId,
          localization: 'false',
          tickers: 'false',
          market_data: 'true',
          community_data: 'true',
          developer_data: 'true',
          sparkline: 'false'
        }
      });

      // Parse response
      const content = (result.content as any)[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from MCP');
      }

      const data = JSON.parse(content.text);

      // Extract CFV metrics
      const metrics: SimpleCFVMetrics = {
        communitySize: this.extractCommunitySize(data),
        annualTxValue: this.estimateAnnualTxValue(data),
        annualTxCount: this.estimateAnnualTxCount(data),
        developers: this.extractDevelopers(data),
        currentPrice: data.market_data?.current_price?.usd || 0,
        marketCap: data.market_data?.market_cap?.usd || 0,
        circulatingSupply: data.market_data?.circulating_supply || 0,
        totalSupply: data.market_data?.total_supply || 0
      };

      return metrics;
    } catch (error) {
      console.error(`❌ Error collecting metrics for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Extract community size from CoinGecko data
   * Uses composite scoring: onChain (50%), GitHub (30%), Social (20%)
   */
  private extractCommunitySize(data: any): number {
    const community = data.community_data || {};
    const developer = data.developer_data || {};
    const market = data.market_data || {};
    
    // Social metrics (easier to game)
    const twitter = community.twitter_followers || 0;
    const reddit = community.reddit_subscribers || 0;
    const telegram = community.telegram_channel_user_count || 0;
    
    // GitHub metrics (moderate difficulty to game)
    const contributors = developer.contributors || 0;
    const stars = developer.stars || 0;
    const forks = developer.forks || 0;
    
    // Calculate component scores
    const socialMetrics = [twitter, reddit, telegram].filter(v => v > 0);
    const socialScore = socialMetrics.length > 0 
      ? socialMetrics.reduce((sum, val) => sum + val, 0) / socialMetrics.length 
      : 0;
    
    const githubScore = contributors > 0 
      ? contributors + (stars / 1000) + (forks / 100)
      : 0;
    
    // On-chain estimation
    const circulatingSupply = market.circulating_supply || 0;
    const onChainScore = circulatingSupply > 0 
      ? Math.min(circulatingSupply / 1000, 1000000)
      : 0;
    
    // Apply composite weights
    return Math.round(
      onChainScore * 0.5 +
      githubScore * 0.3 +
      socialScore * 0.2
    );
  }

  /**
   * Estimate annual transaction value
   * Note: This is an estimation based on market data
   */
  private estimateAnnualTxValue(data: any): number {
    const marketData = data.market_data || {};
    const volume24h = marketData.total_volume?.usd || 0;
    
    // Estimate annual volume (365 days)
    // This is a rough estimate - actual on-chain data would be more accurate
    return volume24h * 365;
  }

  /**
   * Estimate annual transaction count
   * Note: This is an estimation based on supply and market activity
   */
  private estimateAnnualTxCount(data: any): number {
    const marketData = data.market_data || {};
    const circulatingSupply = marketData.circulating_supply || 0;
    
    // Rough estimate: assume 2x supply as annual transactions
    // This varies greatly by coin - actual blockchain data would be more accurate
    return circulatingSupply * 2;
  }

  /**
   * Extract developer activity metrics
   */
  private extractDevelopers(data: any): number {
    const devData = data.developer_data || {};
    
    // Use GitHub contributors as proxy for active developers
    const contributors = devData.contributors || 0;
    const forks = devData.forks || 0;
    const stars = devData.stars || 0;
    
    // Weight contributors more heavily
    return Math.floor(contributors + (forks / 100) + (stars / 1000));
  }

  /**
   * Get data source information
   */
  getDataSource(): DataSource {
    return {
      name: 'CoinGecko MCP',
      type: 'mcp',
      reliability: 0.95, // High reliability for official MCP server
      lastUpdated: new Date()
    };
  }

  /**
   * Validate collected metrics
   */
  validateMetrics(metrics: SimpleCFVMetrics): ValidationResult {
    const issues: string[] = [];
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';

    // Check for missing critical data
    if (!metrics.communitySize || metrics.communitySize === 0) {
      issues.push('Community size is missing or zero');
      confidence = 'MEDIUM';
    }

    if (!metrics.currentPrice || metrics.currentPrice === 0) {
      issues.push('Current price is missing or zero');
      confidence = 'LOW';
    }

    if (!metrics.marketCap || metrics.marketCap === 0) {
      issues.push('Market cap is missing or zero');
      confidence = 'LOW';
    }

    // Note about estimated values
    if (metrics.annualTxValue || metrics.annualTxCount) {
      issues.push('Transaction metrics are estimated - consider using blockchain explorer data for accuracy');
      if (confidence === 'HIGH') confidence = 'MEDIUM';
    }

    return {
      isValid: issues.length === 0 || confidence !== 'LOW',
      confidence,
      issues,
      source: this.getDataSource()
    };
  }
}

export default CoinGeckoMCPCollector;
