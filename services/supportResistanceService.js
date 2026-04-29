/**
 * Support & Resistance Service - Automatic S/R detection
 */

/**
 * Calculate support and resistance levels
 * @param {Array} candles - Array of candlestick data
 * @returns {object} Support and resistance levels
 */
function calculate(candles) {
  if (!candles || candles.length < 20) {
    return {
      supports: [],
      resistances: [],
      currentSupport: null,
      currentResistance: null,
      pivotPoints: null
    };
  }
  
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const currentPrice = candles[candles.length - 1].close;
  
  // Find pivot points (local highs and lows)
  const pivots = findPivotPoints(candles);
  
  // Cluster nearby levels
  const supports = clusterLevels(pivots.lows);
  const resistances = clusterLevels(pivots.highs);
  
  // Sort and get nearest levels
  const nearestSupport = findNearestLevel(currentPrice, supports, 'below');
  const nearestResistance = findNearestLevel(currentPrice, resistances, 'above');
  
  // Calculate pivot points (floor trader method)
  const pivotPoints = calculatePivotPoints(candles);
  
  // Generate trading recommendation
  const recommendation = getSRRecommendation(
    currentPrice, 
    nearestSupport, 
    nearestResistance,
    pivotPoints
  );
  
  return {
    supports: supports.slice(0, 5).map(s => ({
      level: s.level.toFixed(2),
      strength: s.strength,
      touches: s.touches
    })),
    resistances: resistances.slice(0, 5).map(r => ({
      level: r.level.toFixed(2),
      strength: r.strength,
      touches: r.touches
    })),
    currentSupport: nearestSupport ? nearestSupport.level.toFixed(2) : null,
    currentResistance: nearestResistance ? nearestResistance.level.toFixed(2) : null,
    supportStrength: nearestSupport ? nearestSupport.strength : null,
    resistanceStrength: nearestResistance ? nearestResistance.strength : null,
    pivotPoints: pivotPoints,
    recommendation: recommendation,
    timestamp: new Date().toISOString()
  };
}

/**
 * Find pivot points (local highs and lows)
 */
function findPivotPoints(candles, left = 2, right = 2) {
  const highs = [];
  const lows = [];
  
  for (let i = left; i < candles.length - right; i++) {
    let isHighPivot = true;
    let isLowPivot = true;
    
    // Check left and right candles
    for (let j = 1; j <= left; j++) {
      if (candles[i].high <= candles[i - j].high) isHighPivot = false;
      if (candles[i].high <= candles[i + j].high) isHighPivot = false;
      if (candles[i].low >= candles[i - j].low) isLowPivot = false;
      if (candles[i].low >= candles[i + j].low) isLowPivot = false;
    }
    
    if (isHighPivot) {
      highs.push({
        price: candles[i].high,
        index: i,
        strength: calculatePivotStrength(candles, i, 'high')
      });
    }
    
    if (isLowPivot) {
      lows.push({
        price: candles[i].low,
        index: i,
        strength: calculatePivotStrength(candles, i, 'low')
      });
    }
  }
  
  return { highs, lows };
}

/**
 * Calculate pivot strength based on volume and time
 */
function calculatePivotStrength(candles, index, type) {
  let strength = 1;
  const candle = candles[index];
  
  // Volume strength
  const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
  if (candle.volume > avgVolume * 1.5) strength += 1;
  if (candle.volume > avgVolume * 2) strength += 1;
  
  // Time strength (how long ago)
  const age = candles.length - index;
  if (age < 20) strength += 1;
  if (age < 10) strength += 1;
  
  // Price action strength
  if (type === 'high') {
    if (candle.close < candle.high * 0.95) strength += 1; // Rejection
  } else {
    if (candle.close > candle.low * 1.05) strength += 1; // Bounce
  }
  
  return Math.min(5, strength);
}

/**
 * Cluster nearby price levels
 */
function clusterLevels(pivots, threshold = 0.005) { // 0.5% threshold
  const clusters = [];
  
  pivots.forEach(pivot => {
    let added = false;
    
    for (const cluster of clusters) {
      const diff = Math.abs(cluster.level - pivot.price) / cluster.level;
      if (diff < threshold) {
        cluster.level = (cluster.level + pivot.price) / 2;
        cluster.strength += pivot.strength;
        cluster.touches += 1;
        added = true;
        break;
      }
    }
    
    if (!added) {
      clusters.push({
        level: pivot.price,
        strength: pivot.strength,
        touches: 1
      });
    }
  });
  
  // Sort by strength and level
  return clusters.sort((a, b) => b.strength - a.strength);
}

/**
 * Find nearest level above or below current price
 */
function findNearestLevel(price, levels, direction) {
  const filtered = levels.filter(level => 
    direction === 'below' ? level.level < price : level.level > price
  );
  
  if (filtered.length === 0) return null;
  
  return filtered.reduce((nearest, current) => {
    const nearestDiff = Math.abs(nearest.level - price);
    const currentDiff = Math.abs(current.level - price);
    return currentDiff < nearestDiff ? current : nearest;
  });
}

/**
 * Calculate pivot points (Floor Trader method)
 */
function calculatePivotPoints(candles) {
  const lastCandle = candles[candles.length - 1];
  const high = lastCandle.high;
  const low = lastCandle.low;
  const close = lastCandle.close;
  
  const pivot = (high + low + close) / 3;
  const r1 = (2 * pivot) - low;
  const r2 = pivot + (high - low);
  const r3 = high + 2 * (pivot - low);
  const s1 = (2 * pivot) - high;
  const s2 = pivot - (high - low);
  const s3 = low - 2 * (high - pivot);
  
  return {
    pivot: pivot.toFixed(2),
    resistance: {
      r1: r1.toFixed(2),
      r2: r2.toFixed(2),
      r3: r3.toFixed(2)
    },
    support: {
      s1: s1.toFixed(2),
      s2: s2.toFixed(2),
      s3: s3.toFixed(2)
    }
  };
}

/**
 * Generate trading recommendation based on S/R levels
 */
function getSRRecommendation(currentPrice, support, resistance, pivotPoints) {
  let action = 'NEUTRAL';
  let entry = null;
  let target = null;
  let stopLoss = null;
  let message = '';
  
  const supportDistance = support ? ((currentPrice - support.level) / currentPrice * 100) : null;
  const resistanceDistance = resistance ? ((resistance.level - currentPrice) / currentPrice * 100) : null;
  
  // Buy near strong support
  if (support && supportDistance < 1 && support.strength >= 3) {
    action = 'BUY_NEAR_SUPPORT';
    entry = currentPrice.toFixed(2);
    target = resistance ? resistance.level.toFixed(2) : pivotPoints.resistance.r1;
    stopLoss = (support.level - (support.level * 0.01)).toFixed(2);
    message = `Price near strong support at ${support.level.toFixed(2)} - Good buying opportunity`;
  }
  
  // Sell near strong resistance
  else if (resistance && resistanceDistance < 1 && resistance.strength >= 3) {
    action = 'SELL_NEAR_RESISTANCE';
    entry = currentPrice.toFixed(2);
    target = support ? support.level.toFixed(2) : pivotPoints.support.s1;
    stopLoss = (resistance.level + (resistance.level * 0.01)).toFixed(2);
    message = `Price near strong resistance at ${resistance.level.toFixed(2)} - Selling opportunity`;
  }
  
  // Breakout above resistance
  else if (resistance && currentPrice > resistance.level) {
    action = 'BREAKOUT_ABOVE_RESISTANCE';
    entry = currentPrice.toFixed(2);
    target = pivotPoints.resistance.r2;
    stopLoss = resistance.level.toFixed(2);
    message = `Breakout above resistance at ${resistance.level.toFixed(2)} - Bullish signal`;
  }
  
  // Breakdown below support
  else if (support && currentPrice < support.level) {
    action = 'BREAKDOWN_BELOW_SUPPORT';
    entry = currentPrice.toFixed(2);
    target = pivotPoints.support.s2;
    stopLoss = support.level.toFixed(2);
    message = `Breakdown below support at ${support.level.toFixed(2)} - Bearish signal`;
  }
  
  // Range bound
  else if (support && resistance && (supportDistance < 2 || resistanceDistance < 2)) {
    action = 'RANGE_BOUND';
    message = `Trading between S/R - Range strategy recommended`;
  }
  
  return {
    action,
    entry,
    target,
    stopLoss,
    message,
    supportDistance: supportDistance ? `${supportDistance.toFixed(2)}%` : null,
    resistanceDistance: resistanceDistance ? `${resistanceDistance.toFixed(2)}%` : null
  };
}

/**
 * Check if service is available
 */
function isAvailable() {
  return true;
}

module.exports = {
  calculate,
  isAvailable
};