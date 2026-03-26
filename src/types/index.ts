/**
 * CFV Metrics Agent - Type Definitions
 * Based on "Beyond Bitcoin: The Digital Gold Standard Benchmark & Crypto Fair Value Formula"
 * by Sir John Wright Gotts
 */

export type MetricType =
  | 'adoption'
  | 'annualTransactionValue'
  | 'annualTransactions'
  | 'developers'
  | 'price'
  | 'circulatingSupply'
  | 'marketCap';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type CollectorPriority = 'primary' | 'secondary' | 'fallback';

export type ValuationStatus = 'undervalued' | 'fairly valued' | 'overvalued';

export interface MetricResult {
  value: number;
  confidence: ConfidenceLevel;
  source: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Community sub-metrics used by collectors to derive the single Adoption figure.
 * The final `adoption` value in CFVMetrics is a single consolidated number.
 * On-chain data (unique/active addresses) is the preferred source.
 */
export interface CommunitySubMetrics {
  // On-chain metrics (highest reliability — preferred source)
  onChain?: {
    uniqueAddresses?: number;
    activeAddresses?: number;
    confidence: ConfidenceLevel;
  };

  // Social metrics (lower reliability — used as fallback only)
  social?: {
    twitter?: number;
    reddit?: number;
    telegram?: number;
    discord?: number;
    confidence: ConfidenceLevel;
  };

  // GitHub/developer metrics (moderate reliability)
  github?: {
    contributors?: number;
    stars?: number;
    forks?: number;
    confidence: ConfidenceLevel;
  };
}

/**
 * Configuration for community composite scoring weights.
 * Used internally by collectors to derive the single Adoption figure.
 * On-chain data is weighted most heavily as it is the hardest to game.
 */
export interface CommunityWeights {
  onChain: number;   // Weight for on-chain metrics (default: 0.5)
  github: number;    // Weight for GitHub metrics (default: 0.3)
  social: number;    // Weight for social metrics (default: 0.2)
}

export interface CollectorHealth {
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  errorRate: number;
  responseTime: number;
}

export interface MetricCollector {
  name: string;
  priority: CollectorPriority;

  /**
   * Collect specific metric for a coin
   */
  collect(coin: string, metric: MetricType): Promise<MetricResult>;

  /**
   * Check if collector supports the coin
   */
  supports(coin: string): Promise<boolean>;

  /**
   * Get collector health status
   */
  getHealth(): Promise<CollectorHealth>;
}

/**
 * The four fundamental metrics required for the CFV formula.
 * All four are measured against the December 2024 Bitcoin DGS Benchmark.
 *
 * Formula:
 *   CFV = $1.983T × [
 *     (0.70 × adoption / 80,000,000) +
 *     (0.10 × annualTransactions / 6,000,000,000) +
 *     (0.10 × annualTransactionValue / $13,470,000,000,000) +
 *     (0.10 × developers / 905)
 *   ]
 */
export interface CFVMetrics {
  /** Unique coin holders / active users — the dominant metric (70% weight) */
  adoption: MetricResult;
  /** Annual USD value of on-chain transactions */
  annualTransactionValue: MetricResult;
  /** Annual on-chain transaction count */
  annualTransactions: MetricResult;
  /** Active developers (12-month rolling window) */
  developers: MetricResult;
  /** Current market price per coin in USD */
  price: MetricResult;
  /** Circulating supply of the coin */
  circulatingSupply: MetricResult;
}

/** Simple flat metrics for MCP collector and API responses */
export interface SimpleCFVMetrics {
  adoption?: number;
  annualTxValue?: number;
  annualTxCount?: number;
  developers?: number;
  currentPrice?: number;
  marketCap?: number;
  circulatingSupply?: number;
  totalSupply?: number;
}

/**
 * Individual ratio scores — each metric normalised against the DGS benchmark.
 * A score of 1.0 means the coin matches Bitcoin's benchmark exactly.
 */
export interface ComponentScores {
  adoptionScore: number;
  transactionCountScore: number;
  transactionValueScore: number;
  developerScore: number;
}

/**
 * The result of a CFV calculation using the Digital Gold Standard formula.
 */
export interface CFVCalculation {
  /** Composite score S (weighted sum of ratios; 1.0 = Bitcoin at calibration) */
  compositeScore: number;
  /** Fair market capitalisation in USD */
  fairMarketCap: number;
  /** Fair value per coin in USD */
  fairValue: number;
  /** Current market price per coin in USD */
  currentPrice: number;
  /** Current market capitalisation in USD */
  currentMarketCap: number;
  /** Valuation status relative to fair value */
  valuationStatus: ValuationStatus;
  /** Percentage difference: (currentPrice − fairValue) / fairValue × 100 */
  valuationPercent: number;
  /** Ratio of current price to fair value */
  priceMultiplier: number;
  /** Individual ratio scores for each metric */
  componentScores: ComponentScores;
}

export interface CFVResult {
  coinSymbol: string;
  coinName: string;
  metrics: CFVMetrics;
  calculation: CFVCalculation;
  timestamp: Date;
  overallConfidence: ConfidenceLevel;
}

export interface AgentConfig {
  // API Keys
  coinGeckoApiKey?: string;
  etherscanApiKey?: string;
  githubToken?: string;

  // Redis
  redisUrl?: string;

  // Cache TTLs (seconds)
  cacheTTL: {
    short: number;    // 5 minutes
    medium: number;   // 1 hour
    long: number;     // 24 hours
    veryLong: number; // 7 days
  };

  // Rate Limits (calls per minute)
  rateLimits: {
    coinGecko: number;
    etherscan: number;
    github: number;
  };

  // Retry settings
  maxRetries: number;
  retryDelay: number; // milliseconds

  // Timeout settings
  collectorTimeout: number; // milliseconds
}

export interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string>;
}

export interface CoinGeckoResponse {
  id: string;
  symbol: string;
  name: string;
  market_data?: {
    current_price?: { usd: number };
    market_cap?: { usd: number };
    circulating_supply?: number;
    total_volume?: { usd: number };
  };
  community_data?: {
    twitter_followers?: number;
    reddit_subscribers?: number;
    telegram_channel_user_count?: number;
  };
  developer_data?: {
    forks?: number;
    stars?: number;
    subscribers?: number;
    total_issues?: number;
    closed_issues?: number;
    pull_requests_merged?: number;
    pull_request_contributors?: number;
    commit_count_4_weeks?: number;
    contributors?: number;
  };
}

export interface EtherscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count: number;
}

export interface GitHubContributor {
  login: string;
  id: number;
  contributions: number;
}

export interface ValidationResult {
  isValid: boolean;
  confidence: ConfidenceLevel;
  issues: string[];
  adjustedValue?: number;
  source?: DataSource;
}

export interface DataSource {
  name: string;
  type: 'api' | 'mcp' | 'blockchain' | 'manual';
  reliability: number; // 0-1
  lastUpdated: Date;
}

export interface TransactionMetrics {
  annualTxCount: number;
  annualTxValue: number;
  avgTxValue: number;
  confidence: ConfidenceLevel;
  sources: string[];
  timestamp: Date;
  issues?: string[];
  metadata?: Record<string, any>;
}
