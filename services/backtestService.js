/**
 * Backtest Service - Strategy backtesting engine
 * Test trading strategies on historical data
 */

/**
 * Backtest a trading strategy on historical candles
 * @param {Array} candles - Historical candlestick data
 * @param {Object} strategy - Strategy configuration
 * @returns {Object} Backtest results
 */
function backtestStrategy(candles, strategy) {
  if (!candles || candles.length < 50) {
    return {
      success: false,
      error: "Insufficient data for backtesting (need at least 50 candles)",
      timestamp: new Date().toISOString()
    };
  }

  const {
    name = "Custom Strategy",
    initialCapital = 100000,
    positionSize = 0.1, // 10% of capital per trade
    commission = 0.001, // 0.1% commission
    slippage = 0.001, // 0.1% slippage
    stopLoss = null, // Will use ATR if not specified
    takeProfit = null,
    maxPositions = 1,
    strategyType = "INDICATOR_BASED" // INDICATOR_BASED, PRICE_ACTION, CUSTOM
  } = strategy;

  // Add indicators if not present
  let data = candles;
  if (!candles[0].rsi) {
    const indicatorsUtil = require("../utils/indicators");
    data = indicatorsUtil.addIndicators(candles);
  }

  const trades = [];
  let capital = initialCapital;
  let positions = [];
  let equity = [];
  let drawdowns = [];

  // Strategy signals
  let inPosition = false;
  let entryPrice = 0;
  let entryIndex = 0;
  let entryCapital = 0;

  // For tracking performance
  let winningTrades = 0;
  let losingTrades = 0;
  let totalProfit = 0;
  let maxDrawdown = 0;
  let peakEquity = initialCapital;

  // Loop through each candle
  for (let i = 50; i < data.length; i++) {
    const current = data[i];
    const prev = data[i - 1];
    const prev2 = data[i - 2];
    
    // Calculate current equity
    let currentEquity = capital;
    if (inPosition && entryPrice > 0) {
      const positionValue = (entryCapital / entryPrice) * current.close;
      const pnl = positionValue - entryCapital;
      currentEquity = capital + pnl;
    }
    
    equity.push({
      index: i,
      price: current.close,
      equity: currentEquity,
      timestamp: current.time
    });
    
    // Track peak equity for drawdown
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
    drawdowns.push(drawdown);
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    // Generate signal based on strategy type
    let signal = null;
    
    if (strategyType === "INDICATOR_BASED") {
      signal = generateIndicatorSignal(current, prev, prev2, strategy);
    } else if (strategyType === "PRICE_ACTION") {
      signal = generatePriceActionSignal(current, prev, prev2, data.slice(i - 10, i));
    } else if (strategyType === "CUSTOM" && strategy.signalGenerator) {
      signal = strategy.signalGenerator(current, prev, prev2, data.slice(i - 20, i));
    }

    // Exit conditions
    if (inPosition) {
      let exitSignal = false;
      let exitReason = "";
      let exitPrice = current.close;

      // Stop loss
      if (stopLoss) {
        const stopPrice = entryPrice * (1 - stopLoss);
        if (current.low <= stopPrice) {
          exitSignal = true;
          exitReason = "STOP_LOSS";
          exitPrice = stopPrice;
        }
      } else if (current.atr) {
        // ATR-based stop loss
        const atrStop = entryPrice - (current.atr * 1.5);
        if (current.low <= atrStop) {
          exitSignal = true;
          exitReason = "ATR_STOP_LOSS";
          exitPrice = atrStop;
        }
      }

      // Take profit
      if (takeProfit) {
        const targetPrice = entryPrice * (1 + takeProfit);
        if (current.high >= targetPrice) {
          exitSignal = true;
          exitReason = "TAKE_PROFIT";
          exitPrice = targetPrice;
        }
      }

      // Opposite signal
      if (signal === "SELL" && !exitSignal) {
        exitSignal = true;
        exitReason = "OPPOSITE_SIGNAL";
        exitPrice = current.close;
      }

      // Time stop (exit after 50 candles if no signal)
      if (i - entryIndex >= 50 && !exitSignal) {
        exitSignal = true;
        exitReason = "TIME_STOP";
        exitPrice = current.close;
      }

      if (exitSignal) {
        // Apply slippage
        const finalExitPrice = exitPrice * (1 - slippage);
        
        // Calculate P&L
        const shares = entryCapital / entryPrice;
        const exitValue = shares * finalExitPrice;
        const grossProfit = exitValue - entryCapital;
        const commissionCost = entryCapital * commission + exitValue * commission;
        const netProfit = grossProfit - commissionCost;
        
        totalProfit += netProfit;
        capital = capital + netProfit;
        
        if (netProfit > 0) {
          winningTrades++;
        } else {
          losingTrades++;
        }
        
        trades.push({
          entryIndex,
          exitIndex: i,
          entryPrice: entryPrice.toFixed(2),
          exitPrice: finalExitPrice.toFixed(2),
          shares: Math.floor(shares),
          capital: entryCapital,
          grossProfit: grossProfit.toFixed(2),
          commission: commissionCost.toFixed(2),
          netProfit: netProfit.toFixed(2),
          profitPercent: ((netProfit / entryCapital) * 100).toFixed(2),
          exitReason,
          entryTime: new Date(entryIndex * 30000).toISOString(),
          exitTime: new Date(i * 30000).toISOString()
        });
        
        inPosition = false;
        entryPrice = 0;
        entryCapital = 0;
      }
    }

    // Entry conditions
    if (!inPosition && (signal === "BUY" || signal === "STRONG_BUY")) {
      const positionCapital = capital * positionSize;
      const finalEntryPrice = current.close * (1 + slippage);
      const commissionCost = positionCapital * commission;
      
      inPosition = true;
      entryPrice = finalEntryPrice;
      entryIndex = i;
      entryCapital = positionCapital - commissionCost;
    }
  }

  // Calculate final metrics
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
  const finalCapital = capital;
  const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
  
  // Calculate Sharpe Ratio
  const returns = trades.map(t => parseFloat(t.netProfit) / initialCapital);
  const sharpeRatio = calculateSharpeRatio(returns);
  
  // Calculate Profit Factor
  const grossProfitSum = trades.filter(t => parseFloat(t.netProfit) > 0).reduce((sum, t) => sum + parseFloat(t.netProfit), 0);
  const grossLossSum = Math.abs(trades.filter(t => parseFloat(t.netProfit) < 0).reduce((sum, t) => sum + parseFloat(t.netProfit), 0));
  const profitFactor = grossLossSum > 0 ? grossProfitSum / grossLossSum : grossProfitSum > 0 ? 999 : 0;
  
  // Calculate Expectancy
  const expectancy = totalTrades > 0 ? totalProfit / totalTrades : 0;
  
  // Calculate Maximum Consecutive Wins/Losses
  let consecutiveWins = 0;
  let maxConsecutiveWins = 0;
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  
  trades.forEach(trade => {
    if (parseFloat(trade.netProfit) > 0) {
      consecutiveWins++;
      consecutiveLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
    } else {
      consecutiveLosses++;
      consecutiveWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
    }
  });

  // Calculate Recovery Factor
  const recoveryFactor = maxDrawdown > 0 ? totalReturn / maxDrawdown : totalReturn;

  return {
    success: true,
    strategy: {
      name,
      type: strategyType,
      initialCapital,
      positionSize: positionSize * 100,
      commission: commission * 100,
      slippage: slippage * 100
    },
    results: {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: winRate.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      totalReturn: totalReturn.toFixed(2),
      finalCapital: finalCapital.toFixed(2),
      avgProfit: avgProfit.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      sharpeRatio: sharpeRatio.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      expectancy: expectancy.toFixed(2),
      maxConsecutiveWins,
      maxConsecutiveLosses,
      recoveryFactor: recoveryFactor.toFixed(2)
    },
    trades: trades.slice(-20), // Last 20 trades
    equity: equity.slice(-100), // Last 100 equity points
    drawdowns: drawdowns.slice(-100),
    summary: generateSummary({
      totalReturn,
      winRate,
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      totalTrades
    }),
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate indicator-based trading signals
 */
function generateIndicatorSignal(current, prev, prev2, strategy) {
  let buySignal = false;
  let sellSignal = false;
  let strength = 0;
  
  const { indicators = {} } = strategy;
  
  // RSI strategy
  if (indicators.useRSI) {
    if (current.rsi < 30) {
      buySignal = true;
      strength += 2;
    }
    if (current.rsi > 70) {
      sellSignal = true;
      strength += 2;
    }
    // RSI divergence
    if (prev.rsi < 30 && current.rsi > prev.rsi && current.rsi < 35) {
      buySignal = true;
      strength += 3;
    }
  }
  
  // MACD strategy
  if (indicators.useMACD) {
    if (current.macd > current.macdSignal && prev.macd <= prev.macdSignal) {
      buySignal = true;
      strength += 3;
    }
    if (current.macd < current.macdSignal && prev.macd >= prev.macdSignal) {
      sellSignal = true;
      strength += 3;
    }
  }
  
  // Moving Average strategy
  if (indicators.useMA) {
    if (current.price > current.ema20 && prev.price <= prev.ema20) {
      buySignal = true;
      strength += 2;
    }
    if (current.price < current.ema20 && prev.price >= prev.ema20) {
      sellSignal = true;
      strength += 2;
    }
    // Golden cross
    if (current.ema9 > current.ema20 && prev.ema9 <= prev.ema20) {
      buySignal = true;
      strength += 3;
    }
    // Death cross
    if (current.ema9 < current.ema20 && prev.ema9 >= prev.ema20) {
      sellSignal = true;
      strength += 3;
    }
  }
  
  // Bollinger Bands strategy
  if (indicators.useBB) {
    if (current.price <= current.bbLower && prev.price > current.bbLower) {
      buySignal = true;
      strength += 2;
    }
    if (current.price >= current.bbUpper && prev.price < current.bbUpper) {
      sellSignal = true;
      strength += 2;
    }
  }
  
  // Volume strategy
  if (indicators.useVolume && current.volumeRatio > 150) {
    if (current.price > current.ema20) {
      buySignal = true;
      strength += 1;
    }
    if (current.price < current.ema20) {
      sellSignal = true;
      strength += 1;
    }
  }
  
  // VWAP strategy
  if (indicators.useVWAP) {
    if (current.price > current.vwap && prev.price <= prev.vwap) {
      buySignal = true;
      strength += 2;
    }
    if (current.price < current.vwap && prev.price >= prev.vwap) {
      sellSignal = true;
      strength += 2;
    }
  }
  
  if (buySignal && strength >= 3) return "STRONG_BUY";
  if (buySignal) return "BUY";
  if (sellSignal && strength >= 3) return "STRONG_SELL";
  if (sellSignal) return "SELL";
  
  return null;
}

/**
 * Generate price action-based signals
 */
function generatePriceActionSignal(current, prev, prev2, recentCandles) {
  // Bullish engulfing
  const isBullishEngulfing = 
    current.close > current.open &&
    prev.close < prev.open &&
    current.close > prev.open &&
    current.open < prev.close;
  
  // Bearish engulfing
  const isBearishEngulfing = 
    current.close < current.open &&
    prev.close > prev.open &&
    current.close < prev.open &&
    current.open > prev.close;
  
  // Hammer
  const isHammer = 
    (current.close - current.low) > (current.high - current.close) * 2 &&
    (current.close - current.low) > (current.open - current.low) * 2;
  
  // Shooting star
  const isShootingStar = 
    (current.high - current.close) > (current.close - current.low) * 2 &&
    (current.high - current.close) > (current.high - current.open) * 2;
  
  // Higher highs / higher lows
  const recentHighs = recentCandles.slice(-5).map(c => c.high);
  const higherHighs = current.high > Math.max(...recentHighs.slice(0, -1));
  
  const recentLows = recentCandles.slice(-5).map(c => c.low);
  const higherLows = current.low > Math.min(...recentLows.slice(0, -1));
  
  if (isBullishEngulfing || isHammer || (higherHighs && higherLows)) {
    return "BUY";
  }
  
  if (isBearishEngulfing || isShootingStar) {
    return "SELL";
  }
  
  return null;
}

/**
 * Calculate Sharpe Ratio
 */
function calculateSharpeRatio(returns, riskFreeRate = 0.02) {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  return (avgReturn * 252 - riskFreeRate) / (stdDev * Math.sqrt(252));
}

/**
 * Generate backtest summary
 */
function generateSummary({ totalReturn, winRate, maxDrawdown, sharpeRatio, profitFactor, totalTrades }) {
  let rating = "NEUTRAL";
  let recommendation = "";
  
  if (totalReturn > 50 && winRate > 60 && maxDrawdown < 20 && sharpeRatio > 1) {
    rating = "EXCELLENT";
    recommendation = "Strategy shows excellent risk-adjusted returns";
  } else if (totalReturn > 20 && winRate > 50 && maxDrawdown < 30 && sharpeRatio > 0.5) {
    rating = "GOOD";
    recommendation = "Strategy performs well with acceptable risk";
  } else if (totalReturn > 0 && winRate > 40 && maxDrawdown < 40) {
    rating = "AVERAGE";
    recommendation = "Strategy is profitable but needs optimization";
  } else if (totalReturn > -20) {
    rating = "POOR";
    recommendation = "Strategy underperforms - consider modifications";
  } else {
    rating = "VERY_POOR";
    recommendation = "Strategy is losing money - significant changes needed";
  }
  
  return {
    rating,
    recommendation,
    keyMetrics: {
      "Total Return": `${totalReturn.toFixed(2)}%`,
      "Win Rate": `${winRate.toFixed(2)}%`,
      "Max Drawdown": `${maxDrawdown.toFixed(2)}%`,
      "Sharpe Ratio": sharpeRatio.toFixed(2),
      "Profit Factor": profitFactor.toFixed(2),
      "Total Trades": totalTrades
    }
  };
}

/**
 * Compare multiple strategies
 * @param {Array} strategies - Array of strategy configurations
 * @param {Array} candles - Historical candlestick data
 * @returns {Object} Comparison results
 */
function compareStrategies(strategies, candles) {
  const results = [];
  
  for (const strategy of strategies) {
    const result = backtestStrategy(candles, strategy);
    if (result.success) {
      results.push({
        name: strategy.name,
        totalReturn: parseFloat(result.results.totalReturn),
        winRate: parseFloat(result.results.winRate),
        maxDrawdown: parseFloat(result.results.maxDrawdown),
        sharpeRatio: parseFloat(result.results.sharpeRatio),
        profitFactor: parseFloat(result.results.profitFactor),
        totalTrades: result.results.totalTrades,
        rating: result.summary.rating
      });
    }
  }
  
  // Sort by total return
  results.sort((a, b) => b.totalReturn - a.totalReturn);
  
  return {
    success: true,
    strategies: results,
    bestPerformer: results[0] || null,
    timestamp: new Date().toISOString()
  };
}

/**
 * Predefined strategies for quick testing
 */
const PREDEFINED_STRATEGIES = {
  // Momentum strategy
  MOMENTUM: {
    name: "Momentum Strategy",
    initialCapital: 100000,
    positionSize: 0.1,
    commission: 0.001,
    slippage: 0.001,
    stopLoss: 0.02,
    takeProfit: 0.04,
    strategyType: "INDICATOR_BASED",
    indicators: {
      useRSI: true,
      useMACD: true,
      useVolume: true
    }
  },
  
  // Mean reversion strategy
  MEAN_REVERSION: {
    name: "Mean Reversion Strategy",
    initialCapital: 100000,
    positionSize: 0.1,
    commission: 0.001,
    slippage: 0.001,
    stopLoss: 0.015,
    takeProfit: 0.03,
    strategyType: "INDICATOR_BASED",
    indicators: {
      useRSI: true,
      useBB: true,
      useVWAP: true
    }
  },
  
  // Trend following strategy
  TREND_FOLLOWING: {
    name: "Trend Following Strategy",
    initialCapital: 100000,
    positionSize: 0.15,
    commission: 0.001,
    slippage: 0.001,
    stopLoss: null, // Use ATR
    takeProfit: 0.06,
    strategyType: "INDICATOR_BASED",
    indicators: {
      useMA: true,
      useMACD: true,
      useVolume: true
    }
  },
  
  // Scalping strategy
  SCALPING: {
    name: "Scalping Strategy",
    initialCapital: 50000,
    positionSize: 0.2,
    commission: 0.001,
    slippage: 0.0005,
    stopLoss: 0.005,
    takeProfit: 0.01,
    strategyType: "INDICATOR_BASED",
    indicators: {
      useRSI: true,
      useVWAP: true
    }
  },
  
  // Breakout strategy
  BREAKOUT: {
    name: "Breakout Strategy",
    initialCapital: 100000,
    positionSize: 0.1,
    commission: 0.001,
    slippage: 0.001,
    stopLoss: 0.025,
    takeProfit: 0.05,
    strategyType: "PRICE_ACTION"
  }
};

/**
 * Optimize strategy parameters
 * @param {Array} candles - Historical data
 * @param {Object} baseStrategy - Base strategy configuration
 * @param {Object} paramRanges - Parameter ranges to test
 * @returns {Object} Optimization results
 */
function optimizeStrategy(candles, baseStrategy, paramRanges) {
  const results = [];
  const {
    positionSizeRange = [0.05, 0.1, 0.15, 0.2],
    stopLossRange = [0.01, 0.015, 0.02, 0.025, 0.03],
    takeProfitRange = [0.02, 0.03, 0.04, 0.05, 0.06]
  } = paramRanges;
  
  for (const positionSize of positionSizeRange) {
    for (const stopLoss of stopLossRange) {
      for (const takeProfit of takeProfitRange) {
        const strategy = {
          ...baseStrategy,
          positionSize,
          stopLoss,
          takeProfit
        };
        
        const result = backtestStrategy(candles, strategy);
        if (result.success) {
          results.push({
            params: { positionSize, stopLoss, takeProfit },
            totalReturn: parseFloat(result.results.totalReturn),
            winRate: parseFloat(result.results.winRate),
            maxDrawdown: parseFloat(result.results.maxDrawdown),
            sharpeRatio: parseFloat(result.results.sharpeRatio),
            profitFactor: parseFloat(result.results.profitFactor)
          });
        }
      }
    }
  }
  
  // Find best parameters by Sharpe Ratio
  const best = results.reduce((best, current) => 
    current.sharpeRatio > best.sharpeRatio ? current : best, results[0]);
  
  return {
    success: true,
    totalCombinations: results.length,
    bestParameters: best.params,
    bestPerformance: {
      totalReturn: best.totalReturn.toFixed(2),
      winRate: best.winRate.toFixed(2),
      maxDrawdown: best.maxDrawdown.toFixed(2),
      sharpeRatio: best.sharpeRatio.toFixed(2),
      profitFactor: best.profitFactor.toFixed(2)
    },
    topResults: results
      .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
      .slice(0, 5)
      .map(r => ({
        params: r.params,
        totalReturn: r.totalReturn.toFixed(2),
        sharpeRatio: r.sharpeRatio.toFixed(2)
      })),
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  backtestStrategy,
  compareStrategies,
  optimizeStrategy,
  PREDEFINED_STRATEGIES,
  generateIndicatorSignal,
  generatePriceActionSignal
};