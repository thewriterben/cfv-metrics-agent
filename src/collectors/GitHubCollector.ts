import axios, { AxiosInstance } from 'axios';
import type {
  MetricCollector,
  MetricType,
  MetricResult,
  CollectorHealth,
  CollectorPriority,
  GitHubRepository,
  GitHubContributor,
} from '../types';

export class GitHubCollector implements MetricCollector {
  name = 'GitHub';
  priority: CollectorPriority = 'secondary';
  
  private client: AxiosInstance;
  private token?: string;
  private baseURL = 'https://api.github.com';
  private repoCache: Map<string, string> = new Map(); // coin -> repo mapping
  private lastHealthCheck: Date = new Date();
  private errorCount = 0;
  private requestCount = 0;
  
  constructor(token?: string) {
    this.token = token;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: token ? { 
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      } : {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
  }
  
  async collect(coin: string, metric: MetricType): Promise<MetricResult> {
    try {
      this.requestCount++;
      
      if (metric !== 'developers') {
        throw new Error(`Metric ${metric} not supported by GitHub collector`);
      }
      
      return await this.collectDevelopers(coin);
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }
  
  async supports(coin: string): Promise<boolean> {
    try {
      await this.findRepository(coin);
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
      responseTime: 0,
    };
  }
  
  private async findRepository(coin: string): Promise<string> {
    const normalizedCoin = coin.toLowerCase();
    
    // Check cache
    if (this.repoCache.has(normalizedCoin)) {
      return this.repoCache.get(normalizedCoin)!;
    }
    
    // Search for repository
    const searchQuery = `${coin} cryptocurrency language:TypeScript OR language:JavaScript OR language:Go OR language:Rust`;
    
    const response = await this.client.get('/search/repositories', {
      params: {
        q: searchQuery,
        sort: 'stars',
        order: 'desc',
        per_page: 5,
      },
    });
    
    if (response.data.items.length === 0) {
      throw new Error(`No GitHub repository found for ${coin}`);
    }
    
    // Get the most starred repo
    const repo = response.data.items[0];
    const repoFullName = repo.full_name;
    
    // Cache result
    this.repoCache.set(normalizedCoin, repoFullName);
    
    return repoFullName;
  }
  
  private async getRepository(repoFullName: string): Promise<GitHubRepository> {
    const response = await this.client.get(`/repos/${repoFullName}`);
    return response.data;
  }
  
  private async getContributors(repoFullName: string): Promise<GitHubContributor[]> {
    const response = await this.client.get(`/repos/${repoFullName}/contributors`, {
      params: {
        per_page: 100,
      },
    });
    
    return response.data;
  }
  
  private async getCommitActivity(repoFullName: string): Promise<number> {
    // Get commit activity for the last year
    const response = await this.client.get(`/repos/${repoFullName}/stats/commit_activity`);
    
    if (!response.data || response.data.length === 0) {
      return 0;
    }
    
    // Sum all commits from the last year (52 weeks)
    const totalCommits = response.data.reduce((sum: number, week: any) => sum + week.total, 0);
    
    return totalCommits;
  }
  
  private async collectDevelopers(coin: string): Promise<MetricResult> {
    const repoFullName = await this.findRepository(coin);
    const repo = await this.getRepository(repoFullName);
    const contributors = await this.getContributors(repoFullName);
    
    // Get active contributors (those with significant contributions)
    const activeContributors = contributors.filter(c => c.contributions >= 5);
    
    // Try to get commit activity
    let commitActivity = 0;
    try {
      commitActivity = await this.getCommitActivity(repoFullName);
    } catch (error) {
      // Commit activity endpoint may fail for large repos
      console.warn(`Could not fetch commit activity for ${repoFullName}`);
    }
    
    // Estimate active developers based on recent activity
    // Assume average developer makes 20 commits per year
    const estimatedFromCommits = commitActivity > 0 ? Math.round(commitActivity / 20) : 0;
    
    // Use the higher estimate
    const developerCount = Math.max(activeContributors.length, estimatedFromCommits);
    
    // Determine confidence
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (activeContributors.length > 10 && commitActivity > 100) {
      confidence = 'HIGH';
    } else if (activeContributors.length < 5 || commitActivity === 0) {
      confidence = 'LOW';
    }
    
    return {
      value: developerCount,
      confidence,
      source: 'GitHub',
      timestamp: new Date(),
      metadata: {
        repository: repoFullName,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        totalContributors: contributors.length,
        activeContributors: activeContributors.length,
        commitActivity,
      },
    };
  }
}
