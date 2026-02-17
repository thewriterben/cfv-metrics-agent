/**
 * CFV Metrics Agent - Type Definitions
 */

export type MetricType = 
  | 'communitySize'
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
 * Community sub-metrics for composite scoring
 * Addresses issue: reward real activity over vanity metrics
 */
export interface CommunitySubMetrics {
  // On-chain metrics (harder to game)
  onChain?: {
    uniqueAddresses?: number;
    activeAddresses?: number;
    confidence: ConfidenceLevel;
  };
  
  // Social metrics (easier to game, weighted lower)
  social?: {
    twitter?: number;
    reddit?: number;
    telegram?: number;
    discord?: number;
    confidence: ConfidenceLevel;
  };
  
  // GitHub/developer metrics (moderate difficulty to game)
  github?: {
    contributors?: number;
    stars?: number;
    forks?: number;
    confidence: ConfidenceLevel;
  };
}

/**
 * Configuration for community composite scoring weights
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

export interface CFVMetrics {
  communitySize: MetricResult;
  annualTransactionValue: MetricResult;
  annualTransactions: MetricResult;
  developers: MetricResult;
  price: MetricResult;
  circulatingSupply: MetricResult;
}

// Simple metrics for MCP collector
export interface SimpleCFVMetrics {
  communitySize?: number;
  annualTxValue?: number;
  annualTxCount?: number;
  developers?: number;
  currentPrice?: number;
  marketCap?: number;
  circulatingSupply?: number;
  totalSupply?: number;
}

export interface CFVCalculation {
  fairValue: number;
  fairMarketCap: number;
  currentPrice: number;
  currentMarketCap: number;
  networkPowerScore: number;
  valuationStatus: ValuationStatus;
  valuationPercent: number;
  priceMultiplier: number;
  breakdown: {
    communityContribution: number;
    transactionValueContribution: number;
    transactionCountContribution: number;
    developerContribution: number;
  };
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
