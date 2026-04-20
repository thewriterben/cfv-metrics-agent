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
import { RateLimiter } from '../utils/RateLimiter.js';
import { CircuitBreaker } from '../utils/CircuitBreaker.js';
import { RequestCoalescer } from '../utils/RequestCoalescer.js';
import { logger } from '../utils/logger.js';

/**
 * Reddit Collector
 *
 * Collects community adoption metrics from Reddit's public JSON API.
 * Returns subscriber counts for coin-specific subreddits as a proxy
 * for community size / adoption.
 *
 * Priority: fallback — social data is the least reliable signal.
 * Confidence: LOW — social metrics are easy to game.
 */
export class RedditCollector implements MetricCollector {
  name = 'Reddit';
  priority: CollectorPriority = 'fallback';

  private client: AxiosInstance;
  private lastHealthCheck: Date = new Date();
  private errorCount = 0;
  private requestCount = 0;

  private circuitBreaker: CircuitBreaker;
  private coalescer: RequestCoalescer<any>;
  // Local Bottleneck limiter because 'reddit' is not a registered ServiceName
  // in the shared RateLimiter. 10 requests per minute, polite to Reddit.
  private limiter: Bottleneck;

  private static readonly SUBREDDIT_MAP: Record<string, string> = {
    'DASH': 'dashpay',
    'DGB': 'Digibyte',
    'XMR': 'Monero',
    'RVN': 'Ravencoin',
    'XCH': 'chia',
    'XEC': 'ecash',
    'XNO': 'nanocurrency',
    'NEAR': 'nearprotocol',
    'ICP': 'dfinity',
    'EGLD': 'MultiversX',
    'ZCL': 'ZClassic',
  };

  constructor(_rateLimiter?: RateLimiter) {
    this.client = axios.create({
      baseURL: 'https://www.reddit.com',
      timeout: 30000,
      headers: {
        'User-Agent': 'cfv-metrics-agent/1.0 (Crypto Fair Value Calculator)',
        'Accept': 'application/json',
      },
    });

    const coalescerTTL = parseInt(process.env.REQUEST_COALESCER_TTL || '5000');
    this.circuitBreaker = new CircuitBreaker();
    this.coalescer = new RequestCoalescer(coalescerTTL);

    // 10 requests per minute: minTime 6000ms, reservoir 10, refresh every 60s
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: 6000,
      reservoir: 10,
      reservoirRefreshAmount: 10,
      reservoirRefreshInterval: 60000,
    });

    this.limiter.on('failed', (error: Error) => {
      logger.warn('RedditCollector: Rate-limited request failed', {
        error: error.message,
      });
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        const retryAfter = 10000;
        logger.info('RedditCollector: Retrying after rate limit', { retryAfter });
        return retryAfter;
      }
      return undefined;
    });
  }

  async collect(coin: string, metric: MetricType): Promise<MetricResult> {
    if (metric !== 'adoption') {
      throw new Error(
        `Metric '${metric}' is not supported by Reddit collector. Only 'adoption' is supported.`,
      );
    }

    const subreddit = RedditCollector.SUBREDDIT_MAP[coin.toUpperCase()];
    if (!subreddit) {
      throw new Error(`Reddit collector does not have a subreddit mapping for ${coin}`);
    }

    const key = `reddit:${coin}:${metric}`;

    return this.coalescer.coalesce(key, async () => {
      return this.circuitBreaker.execute(async () => {
        return this.limiter.schedule(async () => {
          try {
            this.requestCount++;
            return await this.collectAdoption(coin, subreddit);
          } catch (error) {
            this.errorCount++;
            throw error;
          }
        });
      });
    });
  }

  async supports(coin: string): Promise<boolean> {
    return coin.toUpperCase() in RedditCollector.SUBREDDIT_MAP;
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

  private async collectAdoption(coin: string, subreddit: string): Promise<MetricResult> {
    try {
      const response = await this.client.get(`/r/${subreddit}/about.json`);
      const data = response.data?.data;

      if (!data) {
        throw new Error(`No data returned for subreddit r/${subreddit}`);
      }

      const subscribers: number = data.subscribers ?? 0;
      const activeUsers: number = data.accounts_active ?? 0;

      return {
        value: subscribers,
        confidence: 'LOW' as ConfidenceLevel,
        source: 'Reddit',
        timestamp: new Date(),
        metadata: {
          subreddit,
          subscribers,
          activeUsers,
          subredditUrl: `https://www.reddit.com/r/${subreddit}`,
          coin: coin.toUpperCase(),
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          throw new Error(`Subreddit r/${subreddit} not found for ${coin}`);
        }
        if (status === 429) {
          throw new Error(`Reddit API rate limit exceeded for r/${subreddit}`);
        }
        throw new Error(
          `Reddit API error for r/${subreddit}: ${status} ${error.response?.statusText || error.message}`,
        );
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to collect Reddit adoption data for ${coin}: ${errorMessage}`);
    }
  }
}

export default RedditCollector;
