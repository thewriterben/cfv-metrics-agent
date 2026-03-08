import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { SimpleCFVMetrics, DataSource, ValidationResult } from '../types/index.js';
import { CFVCalculator } from '../utils/CFVCalculator.js';
import {
  CIRCULATING_SUPPLY_DIVISOR,
  MAX_ONCHAIN_SCORE,
  STARS_WEIGHT_DIVISOR,
  FORKS_WEIGHT_DIVISOR,
} from '../utils/CommunityConstants.js';
import { logger } from '../utils/logger.js';

export class CoinGeckoMCPCollector {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  private static readonly DAYS_PER_YEAR = 365;
  private static readonly LARGE_CAP_THRESHOLD = 10_000_000_000;
  private static readonly MID_CAP_THRESHOLD = 1_000_000_000;
  private static readonly LARGE_CAP_AVG_TX_RATIO = 0.0005;
  private static readonly MID_CAP_AVG_TX_RATIO = 0.001;
  private static readonly SMALL_CAP_SUPPLY_VELOCITY = 0.01;
  private static readonly FALLBACK_TX_MULTIPLIER = 100;
  private static readonly MIN_AVG_TX_VALUE = 1;

  constructor(private apiKey: string = '') {}

  async connect(): Promise<void> {
    if (this.isConnected) return;
    try {
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@coingecko/coingecko-mcp'],
        env: {
          COINGECKO_DEMO_API_KEY: this.apiKey,
          COINGECKO_ENVIRONMENT: 'demo'
        }
      });
      this.client = new Client({ name: 'cfv-metrics-agent', version: '1.0.0' }, { capabilities: {} });
      await this.client.connect(this.transport);
      this.isConnected = true;
      logger.info('Connected to CoinGecko MCP server');
    } catch (error) {
      logger.error('Failed to connect to CoinGecko MCP', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      logger.info('Disconnected from CoinGecko MCP server');
    }
  }

  async collectMetrics(symbol: string): Promise<SimpleCFVMetrics> {
    if (!this.isConnected) {
      await this.connect();
    }
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }
    try {
      const coinId = symbol.toLowerCase();
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
      const content = (result.content as any)[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from MCP');
      }
      const data = JSON.parse(content.text);
      const metrics: SimpleCFVMetrics = {
        adoption: this.extractAdoption(data),
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
      logger.error('Error collecting metrics', { 
        symbol,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  private extractAdoption(data: any): number {
    const community = data.community_data || {};
    const developer = data.developer_data || {};
    const market = data.market_data || {};
    const twitter = community.twitter_followers || 0;
    const reddit = community.reddit_subscribers || 0;
    const telegram = community.telegram_channel_user_count || 0;
    const contributors = developer.contributors || 0;
    const stars = developer.stars || 0;
    const forks = developer.forks || 0;
    const socialMetrics = [twitter, reddit, telegram].filter(v => v > 0);
    const socialScore = socialMetrics.length > 0 
      ? socialMetrics.reduce((sum, val) => sum + val, 0) / socialMetrics.length 
      : 0;
    const githubScore = contributors > 0 
      ? contributors + (stars / STARS_WEIGHT_DIVISOR) + (forks / FORKS_WEIGHT_DIVISOR)
      : 0;
    const circulatingSupply = market.circulating_supply || 0;
    const onChainScore = circulatingSupply > 0 
      ? Math.min(circulatingSupply / CIRCULATING_SUPPLY_DIVISOR, MAX_ONCHAIN_SCORE)
      : 0;
    const weights = CFVCalculator.getCommunityWeights();
    return Math.round(
      onChainScore * weights.onChain +
      githubScore * weights.github +
      socialScore * weights.social
    );
  }

  private estimateAnnualTxValue(data: any): number {
    const marketData = data.market_data || {};
    const volume24h = marketData.total_volume?.usd || 0;
    return volume24h * CoinGeckoMCPCollector.DAYS_PER_YEAR;
  }

  private estimateAnnualTxCount(data: any): number {
    const marketData = data.market_data || {};
    const volume24h = marketData.total_volume?.usd || 0;
    const marketCap = marketData.market_cap?.usd || 0;
    const price = marketData.current_price?.usd || 0;
    const circulatingSupply = marketData.circulating_supply || 0;
    const avgTxValue = this.estimateAvgTxValue(marketCap, price, circulatingSupply);
    return avgTxValue > 0 ? Math.round((volume24h * 365) / avgTxValue) : 0;
  }

  private extractDevelopers(data: any): number {
    const devData = data.developer_data || {};
    const contributors = devData.contributors || 0;
    const forks = devData.forks || 0;
    const stars = devData.stars || 0;
    return Math.floor(contributors + (forks / 100) + (stars / 1000));
  }

  getDataSource(): DataSource {
    return {
      name: 'CoinGecko MCP',
      type: 'mcp',
      reliability: 0.95,
      lastUpdated: new Date()
    };
  }

  validateMetrics(metrics: SimpleCFVMetrics): ValidationResult {
    const issues: string[] = [];
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (!metrics.adoption || metrics.adoption === 0) {
      issues.push('Adoption data is missing or zero');
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
    return {
      isValid: issues.length === 0 || confidence !== 'LOW',
      confidence,
      issues,
      source: this.getDataSource()
    };
  }

  private estimateAvgTxValue(marketCap: number, price: number, circulatingSupply: number): number {
    if (marketCap >= CoinGeckoMCPCollector.LARGE_CAP_THRESHOLD) {
      return Math.max(
        marketCap * CoinGeckoMCPCollector.LARGE_CAP_AVG_TX_RATIO,
        CoinGeckoMCPCollector.MIN_AVG_TX_VALUE
      );
    } else if (marketCap >= CoinGeckoMCPCollector.MID_CAP_THRESHOLD) {
      return Math.max(
        marketCap * CoinGeckoMCPCollector.MID_CAP_AVG_TX_RATIO,
        CoinGeckoMCPCollector.MIN_AVG_TX_VALUE
      );
    } else if (circulatingSupply > 0) {
      return Math.max(
        circulatingSupply * CoinGeckoMCPCollector.SMALL_CAP_SUPPLY_VELOCITY * price,
        CoinGeckoMCPCollector.MIN_AVG_TX_VALUE
      );
    } else {
      return Math.max(
        price * CoinGeckoMCPCollector.FALLBACK_TX_MULTIPLIER,
        CoinGeckoMCPCollector.MIN_AVG_TX_VALUE
      );
    }
  }
}

export default CoinGeckoMCPCollector;
