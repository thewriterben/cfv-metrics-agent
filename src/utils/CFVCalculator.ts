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
   * 
   * Enhanced with safety checks for:
   * - Division by zero protection
   * - Negative value validation
   * - NaN and Infinity detection
   * - Minimum value enforcement
   */
  static calculate(metrics: CFVMetrics): CFVCalculation {
    // Extract metric values
    const communitySize = metrics.communitySize.value;
    const annualTxValue = metrics.annualTransactionValue.value;
    const annualTxCount = metrics.annualTransactions.value;
    const developers = metrics.developers.value;
    const currentPrice = metrics.price.value;
    const circulatingSupply = metrics.circulatingSupply.value;
    
    // Comprehensive input validation
    
    // Check for negative or zero values
    if (currentPrice <= 0) {
      throw new Error(`Invalid price: ${currentPrice}. Price must be greater than 0`);
    }
    
    if (circulatingSupply <= 0) {
      throw new Error(`Invalid circulating supply: ${circulatingSupply}. Supply must be greater than 0`);
    }
    
    // Check for NaN or Infinity in inputs
    const inputs = [communitySize, annualTxValue, annualTxCount, developers, currentPrice, circulatingSupply];
    const inputNames = ['communitySize', 'annualTransactionValue', 'annualTransactions', 'developers', 'price', 'circulatingSupply'];
    
    for (let i = 0; i < inputs.length; i++) {
      if (!isFinite(inputs[i]) || isNaN(inputs[i])) {
        throw new Error(`Invalid ${inputNames[i]}: ${inputs[i]}. Must be a finite number`);
      }
    }
    
    // Ensure minimum values (floor at 1) to prevent pow(0, weight) = 0
    // which would zero out the entire network power score calculation
    const safeCommunitySize = Math.max(1, communitySize);
    const safeAnnualTxValue = Math.max(1, annualTxValue);
    const safeAnnualTxCount = Math.max(1, annualTxCount);
    const safeDevelopers = Math.max(1, developers);
    
    // Calculate individual contributions with safety checks
    const communityContribution = Math.pow(safeCommunitySize, this.WEIGHTS.communitySize);
    const txValueContribution = Math.pow(safeAnnualTxValue, this.WEIGHTS.annualTransactionValue);
    const txCountContribution = Math.pow(safeAnnualTxCount, this.WEIGHTS.annualTransactions);
    const developerContribution = Math.pow(safeDevelopers, this.WEIGHTS.developers);
    
    // Validate intermediate calculations
    const contributions = [communityContribution, txValueContribution, txCountContribution, developerContribution];
    const contributionNames = ['community', 'transactionValue', 'transactionCount', 'developer'];
    
    for (let i = 0; i < contributions.length; i++) {
      if (!isFinite(contributions[i]) || isNaN(contributions[i])) {
        throw new Error(`Invalid ${contributionNames[i]} contribution: ${contributions[i]}. Check input values and weights`);
      }
    }
    
    // Calculate Network Power Score
    const networkPowerScore = 
      communityContribution *
      txValueContribution *
      txCountContribution *
      developerContribution;
    
    // Validate network power score
    if (!isFinite(networkPowerScore) || isNaN(networkPowerScore)) {
      throw new Error(`Invalid network power score: ${networkPowerScore}. Calculation produced invalid result`);
    }
    
    // Calculate Fair Value
    const fairValue = networkPowerScore / circulatingSupply;
    
    // Validate fair value
    if (!isFinite(fairValue) || isNaN(fairValue) || fairValue <= 0) {
      throw new Error(`Invalid fair value: ${fairValue}. Check circulating supply and network power score`);
    }
    
    // Calculate Fair Market Cap
    const fairMarketCap = fairValue * circulatingSupply;
    
    // Calculate Current Market Cap
    const currentMarketCap = currentPrice * circulatingSupply;
    
    // Validate market caps
    if (!isFinite(fairMarketCap) || isNaN(fairMarketCap)) {
      throw new Error(`Invalid fair market cap: ${fairMarketCap}`);
    }
    
    if (!isFinite(currentMarketCap) || isNaN(currentMarketCap)) {
      throw new Error(`Invalid current market cap: ${currentMarketCap}`);
    }
    
    // Calculate valuation metrics
    const valuationPercent = ((currentPrice - fairValue) / fairValue) * 100;
    const priceMultiplier = currentPrice / fairValue;
    
    // Validate final calculations
    if (!isFinite(valuationPercent) || isNaN(valuationPercent)) {
      throw new Error(`Invalid valuation percent: ${valuationPercent}`);
    }
    
    if (!isFinite(priceMultiplier) || isNaN(priceMultiplier)) {
      throw new Error(`Invalid price multiplier: ${priceMultiplier}`);
    }
    
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
