/**
 * ATR Service - Stop Loss & Take Profit calculations
 */

/**
 * Calculate risk levels based on ATR
 * @param {number} currentPrice - Current stock price
 * @param {number} atr - Average True Range
 * @returns {object} Risk levels
 */
function calculateRiskLevels(currentPrice, atr) {
  if (!currentPrice || !atr || atr <= 0) {
    return {
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      riskReward1: null,
      riskReward2: null,
      positionSize: null
    };
  }
  
  // ATR multipliers (conservative for intraday)
  const multipliers = {
    tightStop: 1.0,      // Very conservative
    normalStop: 1.5,     // Standard
    wideStop: 2.0,       // For volatile stocks
    tp1: 2.0,            // Take profit 1 (2x risk)
    tp2: 3.0,            // Take profit 2 (3x risk)
    tp3: 4.0             // Take profit 3 (4x risk)
  };
  
  const stopLossTight = currentPrice - (atr * multipliers.tightStop);
  const stopLossNormal = currentPrice - (atr * multipliers.normalStop);
  const stopLossWide = currentPrice - (atr * multipliers.wideStop);
  
  const takeProfit1 = currentPrice + (atr * multipliers.tp1);
  const takeProfit2 = currentPrice + (atr * multipliers.tp2);
  const takeProfit3 = currentPrice + (atr * multipliers.tp3);
  
  // Risk/Reward ratios
  const risk1 = currentPrice - stopLossNormal;
  const reward1 = takeProfit1 - currentPrice;
  const reward2 = takeProfit2 - currentPrice;
  
  const riskReward1 = (reward1 / risk1).toFixed(2);
  const riskReward2 = (reward2 / risk1).toFixed(2);
  
  // Position size suggestion (assuming 2% risk per trade with 1,000,000 capital)
  const accountRiskPercent = 0.02; // 2% risk per trade
  const accountSize = 1000000; // Example: PKR 1,000,000
  const riskAmount = accountSize * accountRiskPercent;
  const positionSize = riskAmount / risk1;
  
  return {
    currentPrice,
    atr: atr.toFixed(2),
    atrPercent: ((atr / currentPrice) * 100).toFixed(2),
    
    stopLoss: {
      tight: stopLossTight.toFixed(2),
      normal: stopLossNormal.toFixed(2),
      wide: stopLossWide.toFixed(2)
    },
    
    takeProfit: {
      tp1: takeProfit1.toFixed(2),
      tp2: takeProfit2.toFixed(2),
      tp3: takeProfit3.toFixed(2)
    },
    
    riskReward: {
      tp1: riskReward1,
      tp2: riskReward2
    },
    
    positionSize: {
      shares: Math.floor(positionSize),
      investment: Math.floor(positionSize * currentPrice),
      riskAmount: Math.floor(riskAmount)
    },
    
    recommendation: getRiskRecommendation(riskReward1, atr, currentPrice)
  };
}

/**
 * Get risk recommendation based on RR ratio
 */
function getRiskRecommendation(riskReward, atr, price) {
  const rr = parseFloat(riskReward);
  const atrPercent = (atr / price) * 100;
  
  if (rr >= 3) {
    return {
      action: 'AGGRESSIVE',
      message: `Excellent RR ratio (1:${rr}) - Consider full position`,
      color: '#10b981'
    };
  } else if (rr >= 2) {
    return {
      action: 'MODERATE',
      message: `Good RR ratio (1:${rr}) - Standard position size recommended`,
      color: '#22c55e'
    };
  } else if (rr >= 1.5) {
    return {
      action: 'CONSERVATIVE',
      message: `Fair RR ratio (1:${rr}) - Consider half position`,
      color: '#eab308'
    };
  } else {
    return {
      action: 'AVOID',
      message: `Poor RR ratio (1:${rr}) - Skip this trade`,
      color: '#ef4444'
    };
  }
}

/**
 * Calculate dynamic position size
 * @param {number} accountSize - Total account size
 * @param {number} riskPercent - Risk per trade (0.01 = 1%)
 * @param {number} entryPrice - Entry price
 * @param {number} stopLoss - Stop loss price
 * @returns {object} Position sizing details
 */
function calculatePositionSize(accountSize, riskPercent, entryPrice, stopLoss) {
  const riskAmount = accountSize * riskPercent;
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  
  if (riskPerShare <= 0) {
    return {
      shares: 0,
      investment: 0,
      riskAmount: 0,
      error: "Invalid stop loss"
    };
  }
  
  const shares = Math.floor(riskAmount / riskPerShare);
  const investment = shares * entryPrice;
  const actualRisk = shares * riskPerShare;
  
  return {
    shares,
    investment,
    riskAmount: actualRisk,
    riskPercent: ((actualRisk / accountSize) * 100).toFixed(2),
    marginRequired: investment * 0.4 // 40% margin for PSX
  };
}

/**
 * Calculate trailing stop levels
 * @param {number} currentPrice - Current price
 * @param {number} highestPrice - Highest price since entry
 * @param {number} atr - Current ATR
 * @returns {object} Trailing stop levels
 */
function calculateTrailingStop(currentPrice, highestPrice, atr) {
  const trailingStop = highestPrice - (atr * 2);
  const parabolics = currentPrice - (atr * 1.5);
  
  return {
    initial: (currentPrice - (atr * 1.5)).toFixed(2),
    trailing: trailingStop.toFixed(2),
    aggressive: parabolics.toFixed(2),
    distance: ((currentPrice - trailingStop) / currentPrice * 100).toFixed(2)
  };
}

/**
 * Check if service is available
 */
function isAvailable() {
  return true;
}

module.exports = {
  calculateRiskLevels,
  calculatePositionSize,
  calculateTrailingStop,
  isAvailable
};