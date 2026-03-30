import axios, { AxiosInstance } from 'axios';
import Bottleneck from 'bottleneck';
import type {
  MetricCollector,
  MetricType,
  MetricResult,
  CollectorHealth,
  CollectorPriority,
  ConfidenceLevel,
} from '../types/index.js';
import { CircuitBreaker } from '../utils/CircuitBreaker.js';
import { RequestCoalescer } from '../utils/RequestCoalescer.js';
import { logger } from '../utils/logger.js';

/**
 * Twitter / X Collector
 *
 * Collects community adoption metrics from the Twitter API v2.
 * Returns follower counts for coin-specific Twitter accounts as a
 * proxy for community size / adoption.
 *
 * Priority: fallback — social data is the least reliable signal.
 * Confidence: LOW — social metrics are easy to game.
 */
export class TwitterCollector implements MetricCollector {
  name = 'Twitter';
  priority: CollectorPriority = 'fallback';

  private client: AxiosInstance;
  private bearerToken: string | undefined;
  private lastHealthCheck: Date = new Date();
  private errorCount = 0;
  private requestCount = 0;

  private circuitBreaker: CircuitBreaker;
  private coalescer: RequestCoalescer<MetricResult>;
  // Local Bottleneck limiter — 'twitter' is not a registered ServiceName
  // in the shared RateLimiter.  Twitter free tier: 15 requests / 15 minutes.
  private limiter: Bottleneck;

  private static readonly TWITTER_MAP: Record<string, string> = {
    'BTC': 'Bitcoin',
    'ETH': 'ethereum',
    'DASH': 'Dashpay',
    'DGB': 'DigiByteCoin',
    'XMR': 'monero',
    'RVN': 'Ravencoin',
    'XCH': 'chia_project',
    'XEC': 'eCashOfficial',
    'XNO': 'nano',
    'NEAR': 'NEARProtocol',
    'ICP': 'dfinity',
    'EGLD': 'MultiversX',
  };

  constructor(bearerToken?: string) {
    this.bearerToken = bearerToken || process.env.TWITTER_BEARER_TOKEN;

    this.client = axios.create({
      baseURL: 'https://api.twitter.com/2',
      timeout: 30000,
      headers: {
        ...(this.bearerToken
          ? { Authorization: `Bearer ${this.bearerToken}` }
          : {}),
        Accept: 'application/json',
      },
    });

    const coalescerTTL = parseInt(process.env.REQUEST_COALESCER_TTL || '5000');
    this.circuitBreaker = new CircuitBreaker();
    this.coalescer = new RequestCoalescer(coalescerTTL);

    // 15 requests per 15 minutes ≈ 1 request per 60 seconds
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: 60000,
      reservoir: 15,
      reservoirRefreshAmount: 15,
      reservoirRefreshInterval: 15 * 60 * 1000,
    });

    this.limiter.on('failed', (error: Error) => {
      logger.warn('TwitterCollector: Rate-limited request failed', {
        error: error.message,
      });
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        const retryAfter = 60000;
        logger.info('TwitterCollector: Retrying after rate limit', { retryAfter });
        return retryAfter;
      }
      return undefined;
    });
  }

  async collect(coin: string, metric: MetricType): Promise<MetricResult> {
    if (metric !== 'adoption') {
      throw new Error(
        `Metric '${metric}' is not supported by Twitter collector. Only 'adoption' is supported.`,
      );
    }

    const username = TwitterCollector.TWITTER_MAP[coin.toUpperCase()];
    if (!username) {
      throw new Error(`Twitter collector does not have a handle mapping for ${coin}`);
    }

    if (!this.bearerToken) {
      throw new Error('Twitter collector is not configured: TWITTER_BEARER_TOKEN is missing');
    }

    const key = `twitter:${coin}:${metric}`;

    return this.coalescer.coalesce(key, async () => {
      return this.circuitBreaker.execute(async () => {
        return this.limiter.schedule(async () => {
          try {
            this.requestCount++;
            return await this.collectAdoption(coin, username);
          } catch (error) {
            this.errorCount++;
            throw error;
          }
        });
      });
    });
  }

  async supports(coin: string): Promise<boolean> {
    if (!this.bearerToken) return false;
    return coin.toUpperCase() in TwitterCollector.TWITTER_MAP;
  }

  async getHealth(): Promise<CollectorHealth> {
    if (!this.bearerToken) {
      return {
        status: 'down',
        lastCheck: new Date(),
        errorRate: 0,
        responseTime: 0,
      };
    }

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

  private async collectAdoption(coin: string, username: string): Promise<MetricResult> {
    try {
      const response = await this.client.get(
        `/users/by/username/${username}`,
        { params: { 'user.fields': 'public_metrics' } },
      );

      const data = response.data?.data;
      if (!data) {
        throw new Error(`No data returned for Twitter user @${username}`);
      }

      const followers: number = data.public_metrics?.followers_count ?? 0;

      return {
        value: followers,
        confidence: 'LOW' as ConfidenceLevel,
        source: 'Twitter',
        timestamp: new Date(),
        metadata: {
          username,
          followers,
          twitterUrl: `https://x.com/${username}`,
          coin: coin.toUpperCase(),
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          throw new Error(
            `Twitter API unauthorized — check TWITTER_BEARER_TOKEN (user @${username})`,
          );
        }
        if (status === 403) {
          throw new Error(
            `Twitter API forbidden — insufficient permissions for @${username}`,
          );
        }
        if (status === 429) {
          throw new Error(`Twitter API rate limit exceeded for @${username}`);
        }
        throw new Error(
          `Twitter API error for @${username}: ${status} ${error.response?.statusText || error.message}`,
        );
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to collect Twitter adoption data for ${coin}: ${errorMessage}`);
    }
  }
}

export default TwitterCollector;
