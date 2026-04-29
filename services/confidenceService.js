/**
 * Confidence Score Service
 * Combines multiple indicators into a single 0-100 confidence score
 */

/**
 * Calculate overall confidence score for a stock
 */
function calculateConfidence(stock) {
  let score = 50; // Neutral base
  const reasons = [];
  
  // Safely extract values with null checks and defaults
  const {
    symbol = 'UNKNOWN',
    price = 0,
    signal = 'NEUTRAL',
    rsi = 50,
    macdTrend = 'NEUTRAL',
    volumeRatio = 100,
    bbPosition = 50,
    bbSignal = 'Neutral',
    stochSignal = 'Neutral',
    vwapSignal = 'Neutral',
    adx = 20,
    ema9 = price,
    ema20 = price,
    vwap = price,
    pctFromEma9 = 0,
    pctFromEma20 = 0,
    pctFromVWAP = 0
  } = stock || {};
  
  // Ensure numeric values are valid numbers
  const safePrice = (typeof price === 'number' && !isNaN(price)) ? price : 0;
  const safeRsi = (typeof rsi === 'number' && !isNaN(rsi)) ? rsi : 50;
  const safeVolumeRatio = (typeof volumeRatio === 'number' && !isNaN(volumeRatio)) ? volumeRatio : 100;
  const safeBbPosition = (typeof bbPosition === 'number' && !isNaN(bbPosition)) ? bbPosition : 50;
  const safeAdx = (typeof adx === 'number' && !isNaN(adx)) ? adx : 20;
  const safeEma9 = (typeof ema9 === 'number' && !isNaN(ema9)) ? ema9 : safePrice;
  const safeEma20 = (typeof ema20 === 'number' && !isNaN(ema20)) ? ema20 : safePrice;
  const safeVwap = (typeof vwap === 'number' && !isNaN(vwap)) ? vwap : safePrice;
  
  // ============ TREND SCORE (max 25 points) ============
  let trendScore = 0;
  
  // Price vs EMAs
  if (safePrice > safeEma9 && safePrice > safeEma20) {
    trendScore += 10;
    reasons.push("Price above key EMAs (+10)");
  } else if (safePrice < safeEma9 && safePrice < safeEma20) {
    trendScore -= 10;
    reasons.push("Price below key EMAs (-10)");
  }
  
  // EMA alignment
  if (safeEma9 > safeEma20) {
    trendScore += 8;
    reasons.push("EMA9 above EMA20 (+8)");
  } else {
    trendScore -= 8;
    reasons.push("EMA9 below EMA20 (-8)");
  }
  
  // VWAP position
  if (vwapSignal === 'Bullish') {
    trendScore += 7;
    reasons.push("Above VWAP (+7)");
  } else if (vwapSignal === 'Bearish') {
    trendScore -= 7;
    reasons.push("Below VWAP (-7)");
  }
  
  // ============ MOMENTUM SCORE (max 25 points) ============
  let momentumScore = 0;
  
  // RSI
  if (safeRsi < 30) {
    momentumScore += 12;
    reasons.push(`Oversold RSI (${safeRsi.toFixed(1)}) - Bounce potential (+12)`);
  } else if (safeRsi > 70) {
    momentumScore -= 12;
    reasons.push(`Overbought RSI (${safeRsi.toFixed(1)}) - Pullback risk (-12)`);
  } else if (safeRsi > 40 && safeRsi < 60) {
    momentumScore += 5;
    reasons.push(`Neutral RSI (${safeRsi.toFixed(1)}) - Room to move (+5)`);
  }
  
  // MACD trend
  if (macdTrend === 'Bullish') {
    momentumScore += 8;
    reasons.push("Bullish MACD (+8)");
  } else if (macdTrend === 'Bearish') {
    momentumScore -= 8;
    reasons.push("Bearish MACD (-8)");
  }
  
  // Stochastic
  if (stochSignal === 'Oversold') {
    momentumScore += 5;
    reasons.push("Stochastic oversold (+5)");
  } else if (stochSignal === 'Overbought') {
    momentumScore -= 5;
    reasons.push("Stochastic overbought (-5)");
  } else if (stochSignal === 'Bullish') {
    momentumScore += 3;
    reasons.push("Stochastic bullish crossover (+3)");
  }
  
  // ============ VOLUME CONFIRMATION (max 20 points) ============
  let volumeScore = 0;
  
  if (safeVolumeRatio > 150) {
    volumeScore += 15;
    reasons.push(`Very high volume (${safeVolumeRatio.toFixed(0)}% of avg) (+15)`);
  } else if (safeVolumeRatio > 120) {
    volumeScore += 10;
    reasons.push(`High volume (${safeVolumeRatio.toFixed(0)}% of avg) (+10)`);
  } else if (safeVolumeRatio > 80) {
    volumeScore += 5;
    reasons.push(`Normal volume (${safeVolumeRatio.toFixed(0)}% of avg) (+5)`);
  } else if (safeVolumeRatio < 50) {
    volumeScore -= 10;
    reasons.push(`Very low volume (${safeVolumeRatio.toFixed(0)}% of avg) (-10)`);
  } else if (safeVolumeRatio < 80) {
    volumeScore -= 5;
    reasons.push(`Low volume (${safeVolumeRatio.toFixed(0)}% of avg) (-5)`);
  }
  
  // Volume + Price action confirmation
  if (safeVolumeRatio > 120 && safePrice > safeEma20) {
    volumeScore += 5;
    reasons.push("Volume confirms uptrend (+5)");
  } else if (safeVolumeRatio > 120 && safePrice < safeEma20) {
    volumeScore -= 5;
    reasons.push("Volume confirms downtrend (-5)");
  }
  
  // ============ VOLATILITY & BREAKOUT (max 15 points) ============
  let volatilityScore = 0;
  
  // Bollinger Band position
  if (safeBbPosition < 20) {
    volatilityScore += 8;
    reasons.push(`Near lower BB (${safeBbPosition.toFixed(0)}%) - Support zone (+8)`);
  } else if (safeBbPosition > 80) {
    volatilityScore -= 8;
    reasons.push(`Near upper BB (${safeBbPosition.toFixed(0)}%) - Resistance zone (-8)`);
  } else if (safeBbPosition > 40 && safeBbPosition < 60) {
    volatilityScore += 3;
    reasons.push(`Mid-BB (${safeBbPosition.toFixed(0)}%) - Neutral (+3)`);
  }
  
  // Bollinger signal
  if (bbSignal === 'Buy') {
    volatilityScore += 7;
    reasons.push("Bollinger Buy signal (+7)");
  } else if (bbSignal === 'Sell') {
    volatilityScore -= 7;
    reasons.push("Bollinger Sell signal (-7)");
  }
  
  // ============ TREND STRENGTH (max 15 points) ============
  let strengthScore = 0;
  
  if (safeAdx > 25) {
    if (trendScore > 0) {
      strengthScore += 10;
      reasons.push(`Strong uptrend (ADX: ${safeAdx.toFixed(1)}) (+10)`);
    } else if (trendScore < 0) {
      strengthScore -= 10;
      reasons.push(`Strong downtrend (ADX: ${safeAdx.toFixed(1)}) (-10)`);
    }
  } else if (safeAdx < 20) {
    strengthScore += 5;
    reasons.push(`Weak trend (ADX: ${safeAdx.toFixed(1)}) - Range bound (+5)`);
  }
  
  // ============ FINAL SCORE CALCULATION ============
  let totalScore = 50 + 
    (trendScore * 0.3) + 
    (momentumScore * 0.3) + 
    (volumeScore * 0.2) + 
    (volatilityScore * 0.1) + 
    (strengthScore * 0.1);
  
  // Ensure score is between 0 and 100
  totalScore = Math.min(100, Math.max(0, totalScore));
  
  // Determine confidence level and action
  let level = 'LOW';
  let action = 'AVOID';
  let color = '#ef4444';
  
  if (totalScore >= 75) {
    level = 'VERY_HIGH';
    action = 'STRONG_BUY';
    color = '#10b981';
  } else if (totalScore >= 65) {
    level = 'HIGH';
    action = 'BUY';
    color = '#22c55e';
  } else if (totalScore >= 55) {
    level = 'MEDIUM_HIGH';
    action = 'CONSIDER';
    color = '#84cc16';
  } else if (totalScore >= 45) {
    level = 'MEDIUM';
    action = 'MONITOR';
    color = '#eab308';
  } else if (totalScore >= 35) {
    level = 'MEDIUM_LOW';
    action = 'CAUTION';
    color = '#f97316';
  } else if (totalScore >= 25) {
    level = 'LOW';
    action = 'AVOID';
    color = '#ef4444';
  } else {
    level = 'VERY_LOW';
    action = 'STRONG_AVOID';
    color = '#dc2626';
  }
  
  // Add recommendation based on signal
  let recommendation = action;
  if (signal === 'BUY' && totalScore > 60) {
    recommendation = 'STRONG_BUY - Technical + Confidence';
  } else if (signal === 'SELL' && totalScore < 40) {
    recommendation = 'STRONG_SELL - Technical + Confidence';
  } else if (signal === 'BUY' && totalScore < 40) {
    recommendation = 'CAUTION - Buy signal but low confidence';
  } else if (signal === 'SELL' && totalScore > 60) {
    recommendation = 'CAUTION - Sell signal but high confidence';
  }
  
  return {
    score: Math.round(totalScore),
    level,
    action,
    color,
    recommendation,
    breakdown: {
      trend: Math.round(trendScore),
      momentum: Math.round(momentumScore),
      volume: Math.round(volumeScore),
      volatility: Math.round(volatilityScore),
      strength: Math.round(strengthScore)
    },
    reasons: reasons.slice(0, 5),
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate real-time alerts based on confidence changes
 */
function generateAlerts(stocks) {
  const alerts = [];
  
  stocks.forEach(stock => {
    if (!stock) return;
    
    const confidence = calculateConfidence(stock);
    const safeRsi = (typeof stock.rsi === 'number' && !isNaN(stock.rsi)) ? stock.rsi : 50;
    const safeVolumeRatio = (typeof stock.volumeRatio === 'number' && !isNaN(stock.volumeRatio)) ? stock.volumeRatio : 100;
    const safeBbPosition = (typeof stock.bbPosition === 'number' && !isNaN(stock.bbPosition)) ? stock.bbPosition : 50;
    
    // High confidence buy alert
    if (confidence.score >= 70 && confidence.action === 'BUY') {
      alerts.push({
        type: 'BUY',
        symbol: stock.symbol,
        price: stock.price,
        confidence: confidence.score,
        message: `${stock.symbol} - Strong buy signal with ${confidence.score}% confidence`,
        timestamp: new Date().toISOString(),
        priority: 'HIGH'
      });
    }
    
    // Oversold bounce alert
    if (safeRsi < 30 && safeVolumeRatio > 120) {
      alerts.push({
        type: 'OVERSOLD_BOUNCE',
        symbol: stock.symbol,
        price: stock.price,
        rsi: safeRsi,
        volumeRatio: safeVolumeRatio,
        message: `${stock.symbol} - Oversold (RSI: ${safeRsi.toFixed(1)}) with high volume - Possible bounce`,
        timestamp: new Date().toISOString(),
        priority: 'MEDIUM'
      });
    }
    
    // Volume spike alert
    if (safeVolumeRatio > 200) {
      alerts.push({
        type: 'VOLUME_SPIKE',
        symbol: stock.symbol,
        price: stock.price,
        volumeRatio: safeVolumeRatio,
        message: `${stock.symbol} - Volume spike (${safeVolumeRatio.toFixed(0)}% of avg)`,
        timestamp: new Date().toISOString(),
        priority: 'MEDIUM'
      });
    }
    
    // Breakout alert
    if (safeBbPosition > 80 && safeVolumeRatio > 150) {
      alerts.push({
        type: 'BREAKOUT',
        symbol: stock.symbol,
        price: stock.price,
        message: `${stock.symbol} - Breakout above upper Bollinger Band with high volume`,
        timestamp: new Date().toISOString(),
        priority: 'HIGH'
      });
    }
    
    // Breakdown alert
    if (safeBbPosition < 20 && safeVolumeRatio > 150) {
      alerts.push({
        type: 'BREAKDOWN',
        symbol: stock.symbol,
        price: stock.price,
        message: `${stock.symbol} - Breakdown below lower Bollinger Band with high volume`,
        timestamp: new Date().toISOString(),
        priority: 'HIGH'
      });
    }
    
    // MACD crossover alert
    if (stock.macdTrend === 'Bullish' && stock.macdHistogram > 0) {
      alerts.push({
        type: 'MACD_CROSSOVER',
        symbol: stock.symbol,
        price: stock.price,
        message: `${stock.symbol} - Bullish MACD crossover`,
        timestamp: new Date().toISOString(),
        priority: 'LOW'
      });
    }
  });
  
  // Sort by priority and timestamp
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return alerts;
}

/**
 * Check if service is available
 */
function isAvailable() {
  return true;
}

module.exports = {
  calculateConfidence,
  generateAlerts,
  isAvailable
};