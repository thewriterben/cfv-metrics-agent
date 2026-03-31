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
import { RateLimitMonitor } from '../utils/RateLimitMonitor.js';
import { logger } from '../utils/logger.js';

/**
 * Blockchair blockchain data collector
 *
 * Uses the Blockchair API (https://api.blockchair.com) to collect
 * on-chain transaction metrics for multiple blockchains. Serves as
 * a secondary data source to complement CoinGecko and 3xpl.
 *
 * Supported chains: Bitcoin, Ethereum, DigiByte, Dash, eCash, Monero
 * Supported metrics: annualTransactions, annualTransactionValue
 */
export class BlockchairCollector implements MetricCollector {
  name = 'Blockchair';
  priority: CollectorPriority = 'secondary';

  private client: AxiosInstance;
  private apiKey?: string;
  private baseURL = 'https://api.blockchair.com';
  private lastHealthCheck: Date = new Date();
  private errorCount = 0;
  private requestCount = 0;

  // Rate limiting and protection
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private coalescer: RequestCoalescer<any>;
  private monitor: RateLimitMonitor;

  // Symbol-to-chain mapping for Blockchair API paths
  private static readonly CHAIN_MAP: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    DGB: 'digibyte',
    DASH: 'dash',
    XEC: 'ecash',
    XMR: 'monero',
  };

  // Divisors to convert base-unit volumes to whole-coin amounts
  private static readonly UNIT_DIVISORS: Record<string, number> = {
    'bitcoin': 1e8,      // satoshis
    'ethereum': 1e18,    // wei
    'digibyte': 1e8,     // satoshis equivalent
    'dash': 1e8,         // duffs
    'ecash': 100,        // satoshis (XEC uses 2 decimal places)
    'monero': 1e12,      // piconero
  };

  private static readonly DAYS_PER_YEAR = 365;

  constructor(apiKey?: string, rateLimiter?: RateLimiter, monitor?: RateLimitMonitor) {
    this.apiKey = apiKey || process.env.BLOCKCHAIR_API_KEY;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
    });

    // Initialize rate limiting and protection components
    const coalescerTTL = parseInt(process.env.REQUEST_COALESCER_TTL || '5000');
    this.rateLimiter = rateLimiter || new RateLimiter();
    this.circuitBreaker = new CircuitBreaker();
    this.coalescer = new RequestCoalescer(coalescerTTL);
    this.monitor = monitor || new RateLimitMonitor();
  }

  async collect(coin: string, metric: MetricType): Promise<MetricResult> {
    const chain = this.resolveChain(coin);
    if (!chain) {
      throw new Error(`Blockchair does not support ${coin}`);
    }

    const key = `blockchair:${coin}:${metric}`;

    return this.coalescer.coalesce(key, async () => {
      return this.circuitBreaker.execute(async () => {
        return this.rateLimiter.schedule('blockchair', async () => {
          try {
            this.requestCount++;
            this.monitor.incrementUsage('blockchair');

            switch (metric) {
              case 'annualTransactions':
                return await this.collectAnnualTransactions(coin, chain);

              case 'annualTransactionValue':
                return await this.collectAnnualTransactionValue(coin, chain);

              default:
                throw new Error(`Metric ${metric} not supported by Blockchair collector`);
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
    return this.resolveChain(coin) !== undefined;
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

  /**
   * Fetch chain stats from Blockchair
   *
   * Endpoint: GET /{chain}/stats
   * Optional query param: key=API_KEY
   */
  private async fetchChainStats(chain: string): Promise<Record<string, any>> {
    const params: Record<string, string> = {};
    if (this.apiKey) {
      params.key = this.apiKey;
    }

    const response = await this.client.get(`/${chain}/stats`, { params });
    const data = response.data?.data;

    if (!data) {
      throw new Error(`Blockchair returned no data for ${chain}/stats`);
    }

    return data;
  }

  /**
   * Collect annual transaction count
   *
   * Methodology:
   * Blockchair returns `transactions_24h` – the number of on-chain
   * transactions confirmed in the last 24 hours. We annualise this
   * by multiplying by 365.
   *
   * Confidence: MEDIUM – 24h snapshots can fluctuate day-to-day but
   * provide a reasonable estimate from a secondary source.
   */
  private async collectAnnualTransactions(coin: string, chain: string): Promise<MetricResult> {
    try {
      const stats = await this.fetchChainStats(chain);

      const transactions24h = stats.transactions_24h;
      if (transactions24h == null || transactions24h <= 0) {
        throw new Error(`transactions_24h not available for ${chain}`);
      }

      const annualTransactions = Math.round(
        transactions24h * BlockchairCollector.DAYS_PER_YEAR,
      );

      return {
        value: annualTransactions,
        confidence: 'MEDIUM' as ConfidenceLevel,
        source: 'Blockchair',
        timestamp: new Date(),
        metadata: {
          methodology: `transactions_24h (${transactions24h}) × ${BlockchairCollector.DAYS_PER_YEAR} days`,
          chain,
          coin: coin.toUpperCase(),
          transactions24h,
          blocks24h: stats.blocks_24h,
          totalTransactions: stats.transactions,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to collect annual transactions for ${coin} via Blockchair: ${errorMessage}`);
    }
  }

  /**
   * Collect annual transaction value (USD)
   *
   * Methodology:
   * Blockchair returns `volume_24h` in the chain's smallest unit
   * (e.g. satoshis for BTC, wei for ETH). We convert to whole coins
   * using the per-chain divisor, multiply by `market_price_usd`, then
   * annualise by × 365.
   *
   * Formula: (volume_24h / unit_divisor) × market_price_usd × 365
   *
   * Confidence: MEDIUM – relies on a single 24h snapshot and the
   * Blockchair-reported price.
   */
  private async collectAnnualTransactionValue(coin: string, chain: string): Promise<MetricResult> {
    try {
      const stats = await this.fetchChainStats(chain);

      const volume24h = stats.volume_24h;
      const marketPriceUsd = stats.market_price_usd;

      if (volume24h == null || marketPriceUsd == null) {
        throw new Error(`volume_24h or market_price_usd not available for ${chain}`);
      }

      const divisor = BlockchairCollector.UNIT_DIVISORS[chain] ?? 1;
      const volumeInCoins = volume24h / divisor;
      const dailyValueUsd = volumeInCoins * marketPriceUsd;
      const annualTransactionValue = dailyValueUsd * BlockchairCollector.DAYS_PER_YEAR;

      return {
        value: annualTransactionValue,
        confidence: 'MEDIUM' as ConfidenceLevel,
        source: 'Blockchair',
        timestamp: new Date(),
        metadata: {
          methodology: `(volume_24h / ${divisor}) × market_price_usd × ${BlockchairCollector.DAYS_PER_YEAR}`,
          chain,
          coin: coin.toUpperCase(),
          volume24hRaw: volume24h,
          volumeInCoins,
          marketPriceUsd,
          dailyValueUsd,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to collect annual transaction value for ${coin} via Blockchair: ${errorMessage}`);
    }
  }

  /**
   * Resolve a coin symbol to its Blockchair chain identifier.
   * Returns undefined when the coin is not supported.
   */
  private resolveChain(coin: string): string | undefined {
    return BlockchairCollector.CHAIN_MAP[coin.toUpperCase()];
  }
}
