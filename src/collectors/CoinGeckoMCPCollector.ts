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
  
  // Transaction estimation constants
  private static readonly DAYS_PER_YEAR = 365; // Days in a year for annualization
  private static readonly SUPPLY_MULTIPLIER = 2; // Placeholder: assume 2x supply as annual transactions

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
   */
  private extractCommunitySize(data: any): number {
    const community = data.community_data || {};
    
    // Aggregate multiple community metrics
    const twitter = community.twitter_followers || 0;
    const reddit = community.reddit_subscribers || 0;
    const telegram = community.telegram_channel_user_count || 0;
    
    // Use the largest community as primary indicator
    return Math.max(twitter, reddit, telegram);
  }

  /**
   * Estimate annual transaction value
   * HEURISTIC: Based on market data (volume24h × 365)
   * This assumes current 24h volume is representative of average daily volume
   * Confidence: LOW-MEDIUM due to volume volatility
   */
  private estimateAnnualTxValue(data: any): number {
    const marketData = data.market_data || {};
    const volume24h = marketData.total_volume?.usd || 0;
    
    // Estimate annual volume (365 days)
    // NOTE: This is a rough estimate - actual on-chain data would be more accurate
    return volume24h * CoinGeckoMCPCollector.DAYS_PER_YEAR;
  }

  /**
   * Estimate annual transaction count
   * HEURISTIC: Placeholder based on circulating supply × 2
   * This is a VERY crude estimate that varies greatly by coin type:
   * - High-velocity payment coins may have 10x+ supply in annual transactions
   * - Store of value coins may have <0.5x supply in annual transactions
   * Confidence: LOW - This needs to be replaced with real blockchain data
   */
  private estimateAnnualTxCount(data: any): number {
    const marketData = data.market_data || {};
    const circulatingSupply = marketData.circulating_supply || 0;
    
    // PLACEHOLDER: assume 2x supply as annual transactions
    // WARNING: This varies greatly by coin - actual blockchain data would be more accurate
    return circulatingSupply * CoinGeckoMCPCollector.SUPPLY_MULTIPLIER;
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
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

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

    // Transaction metrics are estimated with LOW confidence
    if (metrics.annualTxValue || metrics.annualTxCount) {
      issues.push('Transaction value estimated using 24h volume extrapolation (volume24h × 365)');
      issues.push('Transaction count estimated using placeholder heuristic (supply × 2) - LOW confidence, needs blockchain data');
      // Lower confidence to LOW due to crude transaction estimates
      confidence = 'LOW';
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
