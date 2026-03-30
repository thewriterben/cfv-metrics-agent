import axios, { AxiosInstance } from 'axios';
import type {
  MetricCollector,
  MetricType,
  MetricResult,
  CollectorHealth,
  CollectorPriority,
  ConfidenceLevel,
} from '../types/index.js';
import { RateLimiter } from '../utils/RateLimiter.js';
import { CircuitBreaker } from '../utils/CircuitBreaker.js';
import { RequestCoalescer } from '../utils/RequestCoalescer.js';

// CryptoCompare numeric coin IDs for the social/stats endpoint
const CRYPTOCOMPARE_COIN_IDS: Record<string, number> = {
  BTC: 1182,
  ETH: 7605,
  DASH: 3807,
  DGB: 4432,
  XMR: 5038,
  RVN: 724399,
  XCH: 951440,
  XEC: 1092997,
  NEAR: 856199,
  ICP: 928215,
  EGLD: 774951,
};

const SUPPORTED_SYMBOLS = [
  'BTC', 'ETH', 'DASH', 'DGB', 'XMR', 'RVN', 'XCH',
  'XEC', 'XNO', 'NEAR', 'ICP', 'EGLD', 'ZCL', 'DGD', 'BLK',
];

interface CryptoComparePriceResponse {
  USD?: number;
}

interface CryptoCompareFullDataRaw {
  MKTCAP?: number;
  SUPPLY?: number;
  TOTALVOLUME24HTO?: number;
}

interface CryptoCompareFullResponse {
  RAW?: Record<string, Record<string, CryptoCompareFullDataRaw>>;
}

interface CryptoCompareSocialResponse {
  Data?: {
    Twitter?: { followers?: number };
    Reddit?: { subscribers?: number };
  };
}

export class CryptoCompareCollector implements MetricCollector {
  name = 'CryptoCompare';
  priority: CollectorPriority = 'secondary';

  private client: AxiosInstance;
  private baseURL = 'https://min-api.cryptocompare.com';
  private errorCount = 0;
  private requestCount = 0;

  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private coalescer: RequestCoalescer<MetricResult>;

  constructor(apiKey?: string, rateLimiter?: RateLimiter) {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['authorization'] = `Apikey ${apiKey}`;
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers,
    });

    const coalescerTTL = parseInt(process.env.REQUEST_COALESCER_TTL || '5000');
    this.rateLimiter = rateLimiter || new RateLimiter();
    this.circuitBreaker = new CircuitBreaker();
    this.coalescer = new RequestCoalescer(coalescerTTL);
  }

  async collect(coin: string, metric: MetricType): Promise<MetricResult> {
    const symbol = coin.toUpperCase();
    const key = `cryptocompare:${symbol}:${metric}`;

    return this.coalescer.coalesce(key, async () => {
      return this.circuitBreaker.execute(async () => {
        return this.rateLimiter.schedule('cryptocompare', async () => {
          try {
            this.requestCount++;

            switch (metric) {
              case 'price':
                return await this.collectPrice(symbol);
              case 'marketCap':
                return await this.collectMarketCap(symbol);
              case 'circulatingSupply':
                return await this.collectCirculatingSupply(symbol);
              case 'annualTransactionValue':
                return await this.collectAnnualTransactionValue(symbol);
              case 'adoption':
                return await this.collectAdoption(symbol);
              default:
                throw new Error(`Metric ${metric} not supported by CryptoCompare collector`);
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
    return SUPPORTED_SYMBOLS.includes(coin.toUpperCase());
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
      responseTime: 0,
    };
  }

  private async fetchPrice(symbol: string): Promise<CryptoComparePriceResponse> {
    const response = await this.client.get<CryptoComparePriceResponse>('/data/price', {
      params: { fsym: symbol, tsyms: 'USD' },
    });
    return response.data;
  }

  private async fetchFullData(symbol: string): Promise<CryptoCompareFullResponse> {
    const response = await this.client.get<CryptoCompareFullResponse>('/data/pricemultifull', {
      params: { fsyms: symbol, tsyms: 'USD' },
    });
    return response.data;
  }

  private async fetchSocialData(coinId: number): Promise<CryptoCompareSocialResponse> {
    const response = await this.client.get<CryptoCompareSocialResponse>('/data/social/coin/latest', {
      params: { coinId },
    });
    return response.data;
  }

  private async collectPrice(symbol: string): Promise<MetricResult> {
    const data = await this.fetchPrice(symbol);
    const price = data.USD || 0;

    if (price === 0) {
      throw new Error(`Price data not available for ${symbol}`);
    }

    return {
      value: price,
      confidence: 'MEDIUM' as ConfidenceLevel,
      source: 'CryptoCompare',
      timestamp: new Date(),
      metadata: { symbol, endpoint: '/data/price' },
    };
  }

  private async collectMarketCap(symbol: string): Promise<MetricResult> {
    const data = await this.fetchFullData(symbol);
    const raw = data.RAW?.[symbol]?.USD;
    const marketCap = raw?.MKTCAP || 0;

    if (marketCap === 0) {
      throw new Error(`Market cap not available for ${symbol}`);
    }

    return {
      value: marketCap,
      confidence: 'MEDIUM' as ConfidenceLevel,
      source: 'CryptoCompare',
      timestamp: new Date(),
      metadata: { symbol, endpoint: '/data/pricemultifull', field: 'MKTCAP' },
    };
  }

  private async collectCirculatingSupply(symbol: string): Promise<MetricResult> {
    const data = await this.fetchFullData(symbol);
    const raw = data.RAW?.[symbol]?.USD;
    const supply = raw?.SUPPLY || 0;

    if (supply === 0) {
      throw new Error(`Circulating supply not available for ${symbol}`);
    }

    return {
      value: supply,
      confidence: 'MEDIUM' as ConfidenceLevel,
      source: 'CryptoCompare',
      timestamp: new Date(),
      metadata: { symbol, endpoint: '/data/pricemultifull', field: 'SUPPLY' },
    };
  }

  private async collectAnnualTransactionValue(symbol: string): Promise<MetricResult> {
    const data = await this.fetchFullData(symbol);
    const raw = data.RAW?.[symbol]?.USD;
    const dailyVolume = raw?.TOTALVOLUME24HTO || 0;

    if (dailyVolume === 0) {
      throw new Error(`Volume data not available for ${symbol}`);
    }

    const annualEstimate = dailyVolume * 365;

    return {
      value: annualEstimate,
      confidence: 'MEDIUM' as ConfidenceLevel,
      source: 'CryptoCompare',
      timestamp: new Date(),
      metadata: {
        symbol,
        endpoint: '/data/pricemultifull',
        field: 'TOTALVOLUME24HTO',
        dailyVolume,
        note: 'Annualized from 24h total volume (TOTALVOLUME24HTO * 365)',
      },
    };
  }

  private async collectAdoption(symbol: string): Promise<MetricResult> {
    const coinId = CRYPTOCOMPARE_COIN_IDS[symbol];

    // Coins without a CryptoCompare social ID
    if (!coinId) {
      return {
        value: 0,
        confidence: 'LOW' as ConfidenceLevel,
        source: 'CryptoCompare',
        timestamp: new Date(),
        metadata: {
          symbol,
          note: 'No CryptoCompare social coin ID available for this symbol',
        },
      };
    }

    const data = await this.fetchSocialData(coinId);

    const twitterFollowers = data.Data?.Twitter?.followers || 0;
    const redditSubscribers = data.Data?.Reddit?.subscribers || 0;
    const socialScore = twitterFollowers + redditSubscribers;

    return {
      value: socialScore,
      confidence: 'LOW' as ConfidenceLevel,
      source: 'CryptoCompare',
      timestamp: new Date(),
      metadata: {
        symbol,
        coinId,
        twitterFollowers,
        redditSubscribers,
        endpoint: '/data/social/coin/latest',
        note: 'Social-only adoption estimate (Twitter followers + Reddit subscribers)',
      },
    };
  }
}
