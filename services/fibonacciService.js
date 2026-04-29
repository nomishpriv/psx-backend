/**
 * Fibonacci Service - Fibonacci Retracement and Extension Levels
 */

/**
 * Calculate Fibonacci retracement levels from a swing high/low
 * @param {Array} candles - Array of candlestick data
 * @returns {object} Fibonacci levels
 */
function calculateFibonacci(candles) {
  // Default return structure with all required properties
  const defaultReturn = {
    retracement: {
      level0: null,
      level236: null,
      level382: null,
      level500: null,
      level618: null,
      level786: null,
      level100: null
    },
    extension: {
      ext127: null,
      ext161: null,
      ext200: null,
      ext261: null
    },
    swingHigh: null,
    swingLow: null,
    range: null,
    currentPrice: null,
    currentLevel: null,
    support: null,
    resistance: null,
    recommendation: {
      action: 'NEUTRAL',
      message: 'Insufficient data for Fibonacci calculation'
    },
    timestamp: new Date().toISOString()
  };

  if (!candles || candles.length < 20) {
    return defaultReturn;
  }
  
  try {
    // Find recent swing high and low (last 20 candles)
    const recentCandles = candles.slice(-20);
    const swingHigh = Math.max(...recentCandles.map(c => c.high || 0));
    const swingLow = Math.min(...recentCandles.map(c => c.low || Infinity));
    const range = swingHigh - swingLow;
    
    if (range <= 0) {
      return defaultReturn;
    }
    
    // Fibonacci retracement levels
    const retracement = {
      level0: swingHigh,
      level236: swingHigh - (range * 0.236),
      level382: swingHigh - (range * 0.382),
      level500: swingHigh - (range * 0.500),
      level618: swingHigh - (range * 0.618),
      level786: swingHigh - (range * 0.786),
      level100: swingLow
    };
    
    // Fibonacci extension levels
    const extension = {
      ext127: swingHigh + (range * 0.27),
      ext161: swingHigh + (range * 0.61),
      ext200: swingHigh + (range * 1.00),
      ext261: swingHigh + (range * 1.61)
    };
    
    // Find current price position
    const currentPrice = candles[candles.length - 1]?.close || 0;
    let currentLevel = null;
    let nextSupport = null;
    let nextResistance = null;
    
    // Determine which level price is at
    for (const [level, price] of Object.entries(retracement)) {
      if (price && Math.abs(currentPrice - price) / price < 0.005) {
        currentLevel = level;
        break;
      }
    }
    
    // Find next support and resistance
    const sortedLevels = Object.entries(retracement)
      .filter(([_, price]) => price !== null && price !== undefined)
      .sort((a, b) => a[1] - b[1]);
      
    for (let i = 0; i < sortedLevels.length; i++) {
      const [level, price] = sortedLevels[i];
      if (price > currentPrice && !nextResistance) {
        nextResistance = { level, price: price.toFixed(2) };
      }
      if (price < currentPrice) {
        nextSupport = { level, price: price.toFixed(2) };
      }
    }
    
    // Generate recommendation
    let action = 'NEUTRAL';
    let message = '';
    
    if (currentPrice <= retracement.level618 && currentPrice > retracement.level500) {
      action = 'BUY_ON_DIP';
      message = 'Price at 61.8% Fibonacci support - Strong buying zone';
    } else if (currentPrice <= retracement.level500 && currentPrice > retracement.level382) {
      action = 'ACCUMULATE';
      message = 'Price at 50% Fibonacci level - Accumulation zone';
    } else if (currentPrice >= retracement.level382 && currentPrice < retracement.level500) {
      action = 'SELL_ON_RALLY';
      message = 'Price at 38.2% Fibonacci resistance - Selling zone';
    } else if (currentPrice >= retracement.level500 && currentPrice < retracement.level618) {
      action = 'REDUCE';
      message = 'Price at 50% Fibonacci - Distribution zone';
    } else if (currentPrice > retracement.level236) {
      action = 'STRONG_UPTREND';
      message = 'Price above 23.6% Fibonacci - Strong bullish momentum';
    } else if (currentPrice < retracement.level786) {
      action = 'STRONG_DOWNTREND';
      message = 'Price below 78.6% Fibonacci - Strong bearish momentum';
    }
    
    return {
      retracement: {
        level0: retracement.level0?.toFixed(2) || null,
        level236: retracement.level236?.toFixed(2) || null,
        level382: retracement.level382?.toFixed(2) || null,
        level500: retracement.level500?.toFixed(2) || null,
        level618: retracement.level618?.toFixed(2) || null,
        level786: retracement.level786?.toFixed(2) || null,
        level100: retracement.level100?.toFixed(2) || null
      },
      extension: {
        ext127: extension.ext127?.toFixed(2) || null,
        ext161: extension.ext161?.toFixed(2) || null,
        ext200: extension.ext200?.toFixed(2) || null,
        ext261: extension.ext261?.toFixed(2) || null
      },
      swingHigh: swingHigh?.toFixed(2) || null,
      swingLow: swingLow?.toFixed(2) || null,
      range: range?.toFixed(2) || null,
      currentPrice: currentPrice?.toFixed(2) || null,
      currentLevel: currentLevel,
      support: nextSupport,
      resistance: nextResistance,
      recommendation: {
        action: action,
        message: message,
        confidence: getFibonacciConfidence(currentPrice, retracement)
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.warn('Fibonacci calculation error:', error.message);
    return defaultReturn;
  }
}

/**
 * Calculate confidence score for Fibonacci signals
 */
function getFibonacciConfidence(currentPrice, levels) {
  let confidence = 50;
  
  // Check confluence with other Fibonacci levels
  if (levels.level618 && Math.abs(currentPrice - levels.level618) / levels.level618 < 0.01) {
    confidence += 25;
  }
  if (levels.level382 && Math.abs(currentPrice - levels.level382) / levels.level382 < 0.01) {
    confidence += 20;
  }
  if (levels.level500 && Math.abs(currentPrice - levels.level500) / levels.level500 < 0.01) {
    confidence += 15;
  }
  
  return Math.min(100, confidence);
}

/**
 * Calculate Fibonacci extensions for profit targets
 */
function calculateProfitTargets(entry, stopLoss, swingHigh, swingLow) {
  const risk = Math.abs(entry - stopLoss);
  const range = swingHigh - swingLow;
  
  const targets = {
    target1: entry + (risk * 1.618),
    target2: entry + (risk * 2.618),
    target3: entry + range,
    target4: entry + (range * 0.618)
  };
  
  return {
    targets: {
      target1: targets.target1?.toFixed(2) || null,
      target2: targets.target2?.toFixed(2) || null,
      target3: targets.target3?.toFixed(2) || null,
      target4: targets.target4?.toFixed(2) || null
    },
    riskReward: {
      rr1: ((targets.target1 - entry) / risk)?.toFixed(2) || null,
      rr2: ((targets.target2 - entry) / risk)?.toFixed(2) || null
    }
  };
}

/**
 * Check if service is available
 */
function isAvailable() {
  return true;
}

module.exports = {
  calculateFibonacci,
  calculateProfitTargets,
  isAvailable
};