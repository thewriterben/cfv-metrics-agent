import axios, { AxiosInstance } from 'axios';
import type {
  MetricCollector,
  MetricType,
  MetricResult,
  CollectorHealth,
  CollectorPriority,
  CoinGeckoResponse,
  CoinInfo,
} from '../types';
import { RateLimiter } from '../utils/RateLimiter.js';
import { CircuitBreaker } from '../utils/CircuitBreaker.js';
import { RequestCoalescer } from '../utils/RequestCoalescer.js';
import { RateLimitMonitor } from '../utils/RateLimitMonitor.js';

export class CoinGeckoCollector implements MetricCollector {
  name = 'CoinGecko';
  priority: CollectorPriority = 'primary';
  
  private client: AxiosInstance;
  private apiKey?: string;
  private baseURL = 'https://api.coingecko.com/api/v3';
  private coinCache: Map<string, CoinInfo> = new Map();
  private lastHealthCheck: Date = new Date();
  private errorCount = 0;
  private requestCount = 0;
  
  // Rate limiting and protection
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private coalescer: RequestCoalescer<any>;
  private monitor: RateLimitMonitor;
  
  constructor(apiKey?: string, rateLimiter?: RateLimiter, monitor?: RateLimitMonitor) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : {},
    });
    
    // Initialize rate limiting and protection components
    this.rateLimiter = rateLimiter || new RateLimiter();
    this.circuitBreaker = new CircuitBreaker();
    this.coalescer = new RequestCoalescer(5000); // 5 second cache
    this.monitor = monitor || new RateLimitMonitor();
  }
  
  async collect(coin: string, metric: MetricType): Promise<MetricResult> {
    const key = `coingecko:${coin}:${metric}`;
    
    return this.coalescer.coalesce(key, async () => {
      return this.circuitBreaker.execute(async () => {
        return this.rateLimiter.schedule('coingecko', async () => {
          try {
            this.requestCount++;
            this.monitor.incrementUsage('coingecko');
            
            // Get coin ID first
            const coinInfo = await this.getCoinInfo(coin);
            
            switch (metric) {
              case 'communitySize':
                return await this.collectCommunitySize(coinInfo.id);
              
              case 'developers':
                return await this.collectDevelopers(coinInfo.id);
              
              case 'price':
                return await this.collectPrice(coinInfo.id);
              
              case 'circulatingSupply':
                return await this.collectCirculatingSupply(coinInfo.id);
              
              case 'marketCap':
                return await this.collectMarketCap(coinInfo.id);
              
              default:
                throw new Error(`Metric ${metric} not supported by CoinGecko collector`);
            }
          } catch (error) {
            this.errorCount++;
            throw error;
          }
        });
      });
    });
  }
  
  async supports(coin: string): Promise<boolean> {
    try {
      await this.getCoinInfo(coin);
      return true;
    } catch {
      return false;
    }
  }
  
  async getHealth(): Promise<CollectorHealth> {
    const now = new Date();
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (errorRate > 0.5) status = 'down';
    else if (errorRate > 0.2) status = 'degraded';
    
    return {
      status,
      lastCheck: now,
      errorRate,
      responseTime: 0, // TODO: Track average response time
    };
  }
  
  private async getCoinInfo(symbol: string): Promise<CoinInfo> {
    const normalizedSymbol = symbol.toLowerCase();
    
    // Check cache
    if (this.coinCache.has(normalizedSymbol)) {
      return this.coinCache.get(normalizedSymbol)!;
    }
    
    // Fetch coin list
    const response = await this.client.get<CoinInfo[]>('/coins/list', {
      params: { include_platform: true },
    });
    
    // Find coin by symbol
    const coin = response.data.find(c => c.symbol.toLowerCase() === normalizedSymbol);
    
    if (!coin) {
      throw new Error(`Coin ${symbol} not found on CoinGecko`);
    }
    
    // Cache result
    this.coinCache.set(normalizedSymbol, coin);
    
    return coin;
  }
  
  private async getCoinData(coinId: string): Promise<CoinGeckoResponse> {
    const response = await this.client.get<CoinGeckoResponse>(`/coins/${coinId}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: true,
        developer_data: true,
        sparkline: false,
      },
    });
    
    return response.data;
  }
  
  private async collectCommunitySize(coinId: string): Promise<MetricResult> {
    const data = await this.getCoinData(coinId);
    
    const twitter = data.community_data?.twitter_followers || 0;
    const reddit = data.community_data?.reddit_subscribers || 0;
    const telegram = data.community_data?.telegram_channel_user_count || 0;
    
    // Aggregate community size with weights
    // Twitter: 1x, Reddit: 1.5x (more engaged), Telegram: 0.8x (may include inactive)
    const communitySize = Math.round(
      twitter * 1.0 +
      reddit * 1.5 +
      telegram * 0.8
    );
    
    // Determine confidence based on data availability
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    const sourcesAvailable = [twitter, reddit, telegram].filter(v => v > 0).length;
    
    if (sourcesAvailable >= 3) confidence = 'HIGH';
    else if (sourcesAvailable >= 2) confidence = 'MEDIUM';
    
    return {
      value: communitySize,
      confidence,
      source: 'CoinGecko',
      timestamp: new Date(),
      metadata: {
        twitter,
        reddit,
        telegram,
        sourcesAvailable,
      },
    };
  }
  
  private async collectDevelopers(coinId: string): Promise<MetricResult> {
    const data = await this.getCoinData(coinId);
    
    const contributors = data.developer_data?.pull_request_contributors || 0;
    const commits4Weeks = data.developer_data?.commit_count_4_weeks || 0;
    
    // Estimate active developers based on recent commit activity
    // Assume average developer makes 10 commits per month
    const estimatedActiveDevelopers = Math.max(
      contributors,
      Math.round(commits4Weeks / 10)
    );
    
    // Determine confidence
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (contributors > 0 && commits4Weeks > 0) confidence = 'HIGH';
    else if (contributors > 0 || commits4Weeks > 0) confidence = 'MEDIUM';
    
    return {
      value: estimatedActiveDevelopers,
      confidence,
      source: 'CoinGecko',
      timestamp: new Date(),
      metadata: {
        contributors,
        commits4Weeks,
        forks: data.developer_data?.forks || 0,
        stars: data.developer_data?.stars || 0,
      },
    };
  }
  
  private async collectPrice(coinId: string): Promise<MetricResult> {
    const data = await this.getCoinData(coinId);
    
    const price = data.market_data?.current_price?.usd || 0;
    
    if (price === 0) {
      throw new Error(`Price data not available for ${coinId}`);
    }
    
    return {
      value: price,
      confidence: 'HIGH',
      source: 'CoinGecko',
      timestamp: new Date(),
      metadata: {
        coinId,
      },
    };
  }
  
  private async collectCirculatingSupply(coinId: string): Promise<MetricResult> {
    const data = await this.getCoinData(coinId);
    
    const supply = data.market_data?.circulating_supply || 0;
    
    if (supply === 0) {
      throw new Error(`Circulating supply not available for ${coinId}`);
    }
    
    return {
      value: supply,
      confidence: 'HIGH',
      source: 'CoinGecko',
      timestamp: new Date(),
      metadata: {
        coinId,
      },
    };
  }
  
  private async collectMarketCap(coinId: string): Promise<MetricResult> {
    const data = await this.getCoinData(coinId);
    
    const marketCap = data.market_data?.market_cap?.usd || 0;
    
    if (marketCap === 0) {
      throw new Error(`Market cap not available for ${coinId}`);
    }
    
    return {
      value: marketCap,
      confidence: 'HIGH',
      source: 'CoinGecko',
      timestamp: new Date(),
      metadata: {
        coinId,
      },
    };
  }
}
