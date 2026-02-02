import type { CFVMetrics, CFVCalculation, ValuationStatus } from '../types';

export class CFVCalculator {
  // Formula weights (70/10/10/10)
  private static readonly WEIGHTS = {
    communitySize: 0.7,
    annualTransactionValue: 0.1,
    annualTransactions: 0.1,
    developers: 0.1,
  };
  
  /**
   * Calculate CFV using the 70/10/10/10 formula
   */
  static calculate(metrics: CFVMetrics): CFVCalculation {
    // Extract metric values
    const communitySize = metrics.communitySize.value;
    const annualTxValue = metrics.annualTransactionValue.value;
    const annualTxCount = metrics.annualTransactions.value;
    const developers = metrics.developers.value;
    const currentPrice = metrics.price.value;
    const circulatingSupply = metrics.circulatingSupply.value;
    
    // Validate inputs
    if (circulatingSupply === 0) {
      throw new Error('Circulating supply cannot be zero');
    }
    
    // Calculate individual contributions
    const communityContribution = Math.pow(communitySize, this.WEIGHTS.communitySize);
    const txValueContribution = Math.pow(annualTxValue, this.WEIGHTS.annualTransactionValue);
    const txCountContribution = Math.pow(annualTxCount, this.WEIGHTS.annualTransactions);
    const developerContribution = Math.pow(developers, this.WEIGHTS.developers);
    
    // Calculate Network Power Score
    const networkPowerScore = 
      communityContribution *
      txValueContribution *
      txCountContribution *
      developerContribution;
    
    // Calculate Fair Value
    const fairValue = networkPowerScore / circulatingSupply;
    
    // Calculate Fair Market Cap
    const fairMarketCap = fairValue * circulatingSupply;
    
    // Calculate Current Market Cap
    const currentMarketCap = currentPrice * circulatingSupply;
    
    // Calculate valuation metrics
    const valuationPercent = ((currentPrice - fairValue) / fairValue) * 100;
    const priceMultiplier = currentPrice / fairValue;
    
    // Determine valuation status
    let valuationStatus: ValuationStatus;
    if (valuationPercent < -20) {
      valuationStatus = 'undervalued';
    } else if (valuationPercent > 20) {
      valuationStatus = 'overvalued';
    } else {
      valuationStatus = 'fairly valued';
    }
    
    return {
      fairValue,
      fairMarketCap,
      currentPrice,
      currentMarketCap,
      networkPowerScore,
      valuationStatus,
      valuationPercent,
      priceMultiplier,
      breakdown: {
        communityContribution,
        transactionValueContribution: txValueContribution,
        transactionCountContribution: txCountContribution,
        developerContribution,
      },
    };
  }
  
  /**
   * Format currency values
   */
  static formatCurrency(value: number): string {
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    } else if (value >= 1) {
      return `$${value.toFixed(2)}`;
    } else if (value >= 0.01) {
      return `$${value.toFixed(4)}`;
    } else {
      return `$${value.toExponential(2)}`;
    }
  }
  
  /**
   * Format large numbers
   */
  static formatNumber(value: number): string {
    if (value >= 1e12) {
      return `${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K`;
    } else {
      return value.toFixed(0);
    }
  }
  
  /**
   * Get valuation description
   */
  static getValuationDescription(status: ValuationStatus, percent: number): string {
    switch (status) {
      case 'undervalued':
        return `The current price is ${Math.abs(percent).toFixed(1)}% below fair value, suggesting potential upside.`;
      case 'overvalued':
        return `The current price is ${percent.toFixed(1)}% above fair value, suggesting potential downside.`;
      case 'fairly valued':
        return `The current price is within ±20% of fair value, suggesting the market is fairly pricing the asset.`;
    }
  }
}
