/**
 * Market Breadth Service - Overall market health analysis
 */

/**
 * Calculate market breadth from stocks data
 * @param {Array} stocks - Array of stock objects with price and change data
 * @returns {object} Market breadth analysis
 */
function calculate(stocks) {
  if (!stocks || stocks.length === 0) {
    return {
      error: "No stock data available",
      timestamp: new Date().toISOString()
    };
  }
  
  const validStocks = stocks.filter(s => s.price !== null && !s.error);
  const total = validStocks.length;
  
  // Basic breadth metrics
  const gainers = validStocks.filter(s => s.changePercent > 0);
  const losers = validStocks.filter(s => s.changePercent < 0);
  const unchanged = validStocks.filter(s => s.changePercent === 0);
  
  const advancers = gainers.length;
  const decliners = losers.length;
  const advanceDeclineRatio = decliners > 0 ? advancers / decliners : advancers;
  
  // Volume breadth
  const gainersVolume = gainers.reduce((sum, s) => sum + (s.ohlc?.volume || 0), 0);
  const losersVolume = losers.reduce((sum, s) => sum + (s.ohlc?.volume || 0), 0);
  const volumeRatio = losersVolume > 0 ? gainersVolume / losersVolume : gainersVolume;
  
  // Calculate percentage changes
  const avgGain = gainers.length > 0 
    ? gainers.reduce((sum, s) => sum + s.changePercent, 0) / gainers.length 
    : 0;
  const avgLoss = losers.length > 0 
    ? Math.abs(losers.reduce((sum, s) => sum + s.changePercent, 0) / losers.length)
    : 0;
  
  // McClellan Oscillator (simplified)
  const mcclellan = calculateMcClellan(validStocks);
  
  // TRIN (Arms Index) - Lower than 1 is bullish
  const trin = calculateTRIN(validStocks);
  
  // Market sentiment
  const sentiment = calculateSentiment({
    advanceDeclineRatio,
    volumeRatio,
    avgGain,
    avgLoss,
    mcclellan,
    trin
  });
  
  // Generate market outlook
  const outlook = generateMarketOutlook(sentiment, advanceDeclineRatio, trin);
  
  return {
    timestamp: new Date().toISOString(),
    totalStocks: total,
    breadth: {
      advances: advancers,
      declines: decliners,
      unchanged: unchanged.length,
      advanceDeclineRatio: advanceDeclineRatio.toFixed(2),
      percentAdvancers: ((advancers / total) * 100).toFixed(1),
      percentDecliners: ((decliners / total) * 100).toFixed(1)
    },
    volumeBreadth: {
      gainersVolume: formatNumber(gainersVolume),
      losersVolume: formatNumber(losersVolume),
      volumeRatio: volumeRatio.toFixed(2),
      bullishVolumePercent: ((gainersVolume / (gainersVolume + losersVolume)) * 100).toFixed(1)
    },
    momentum: {
      averageGain: avgGain.toFixed(2),
      averageLoss: avgLoss.toFixed(2),
      mcclellanOscillator: mcclellan.toFixed(0),
      trin: trin.toFixed(2)
    },
    sentiment: sentiment,
    outlook: outlook,
    topContributors: getTopContributors(validStocks, 5),
    topDrags: getTopDrags(validStocks, 5),
    sectorPerformance: calculateSectorPerformance(validStocks)
  };
}

/**
 * Calculate McClellan Oscillator (simplified)
 * Measures market breadth momentum
 */
function calculateMcClellan(stocks) {
  // Simplified version using 5-day EMA of advances/declines
  // For intraday, we use a shorter period
  const netAdvances = stocks.filter(s => s.changePercent > 0).length - 
                      stocks.filter(s => s.changePercent < 0).length;
  
  // Normalize to -100 to +100 scale
  const normalized = (netAdvances / stocks.length) * 100;
  
  return Math.min(100, Math.max(-100, normalized));
}

/**
 * Calculate TRIN (Arms Index)
 * TRIN = (Advancing Volume / Declining Volume) / (Advancing Issues / Declining Issues)
 */
function calculateTRIN(stocks) {
  const advancers = stocks.filter(s => s.changePercent > 0);
  const decliners = stocks.filter(s => s.changePercent < 0);
  
  if (decliners.length === 0) return 0.5;
  if (advancers.length === 0) return 2;
  
  const advVolume = advancers.reduce((sum, s) => sum + (s.ohlc?.volume || 0), 0);
  const decVolume = decliners.reduce((sum, s) => sum + (s.ohlc?.volume || 0), 0);
  
  const volumeRatio = decVolume > 0 ? advVolume / decVolume : advVolume;
  const issueRatio = advancers.length / decliners.length;
  
  if (issueRatio === 0) return 2;
  
  const trin = volumeRatio / issueRatio;
  
  return Math.min(3, Math.max(0.3, trin));
}

/**
 * Calculate market sentiment based on multiple indicators
 */
function calculateSentiment({ advanceDeclineRatio, volumeRatio, avgGain, avgLoss, mcclellan, trin }) {
  let sentimentScore = 50;
  const factors = [];
  
  // Advance/Decline Ratio
  if (advanceDeclineRatio > 1.5) {
    sentimentScore += 15;
    factors.push("Strong breadth (A/D > 1.5)");
  } else if (advanceDeclineRatio > 1.2) {
    sentimentScore += 8;
    factors.push("Positive breadth (A/D > 1.2)");
  } else if (advanceDeclineRatio < 0.67) {
    sentimentScore -= 15;
    factors.push("Weak breadth (A/D < 0.67)");
  } else if (advanceDeclineRatio < 0.8) {
    sentimentScore -= 8;
    factors.push("Negative breadth (A/D < 0.8)");
  }
  
  // Volume Ratio
  if (volumeRatio > 1.5) {
    sentimentScore += 12;
    factors.push("Bullish volume confirmation");
  } else if (volumeRatio < 0.67) {
    sentimentScore -= 12;
    factors.push("Bearish volume confirmation");
  }
  
  // Average Gain vs Loss
  if (avgGain > avgLoss * 1.5) {
    sentimentScore += 10;
    factors.push("Strong average gains");
  } else if (avgLoss > avgGain * 1.5) {
    sentimentScore -= 10;
    factors.push("Strong average losses");
  }
  
  // McClellan Oscillator
  if (mcclellan > 30) {
    sentimentScore += 10;
    factors.push("Overbought breadth momentum");
  } else if (mcclellan > 10) {
    sentimentScore += 5;
    factors.push("Positive breadth momentum");
  } else if (mcclellan < -30) {
    sentimentScore -= 10;
    factors.push("Oversold breadth momentum");
  } else if (mcclellan < -10) {
    sentimentScore -= 5;
    factors.push("Negative breadth momentum");
  }
  
  // TRIN (Arms Index)
  if (trin < 0.8) {
    sentimentScore += 10;
    factors.push("Bullish TRIN (< 0.8)");
  } else if (trin > 1.2) {
    sentimentScore -= 10;
    factors.push("Bearish TRIN (> 1.2)");
  }
  
  // Determine sentiment level
  let level = 'NEUTRAL';
  let action = 'HOLD';
  let color = '#94a3b8';
  
  if (sentimentScore >= 70) {
    level = 'STRONG_BULLISH';
    action = 'AGGRESSIVE_BUY';
    color = '#10b981';
  } else if (sentimentScore >= 60) {
    level = 'BULLISH';
    action = 'BUY_ON_DIPS';
    color = '#22c55e';
  } else if (sentimentScore >= 55) {
    level = 'SLIGHTLY_BULLISH';
    action = 'ACCUMULATE';
    color = '#84cc16';
  } else if (sentimentScore <= 30) {
    level = 'STRONG_BEARISH';
    action = 'AVOID';
    color = '#dc2626';
  } else if (sentimentScore <= 40) {
    level = 'BEARISH';
    action = 'REDUCE_EXPOSURE';
    color = '#ef4444';
  } else if (sentimentScore <= 45) {
    level = 'SLIGHTLY_BEARISH';
    action = 'CAUTION';
    color = '#f97316';
  }
  
  return {
    score: Math.round(sentimentScore),
    level,
    action,
    color,
    factors: factors.slice(0, 5),
    interpretation: getSentimentInterpretation(level)
  };
}

/**
 * Get sentiment interpretation
 */
function getSentimentInterpretation(level) {
  const interpretations = {
    STRONG_BULLISH: "Market extremely bullish - Consider increasing exposure",
    BULLISH: "Positive market breadth - Favorable for long positions",
    SLIGHTLY_BULLISH: "Cautiously optimistic - Selective buying recommended",
    NEUTRAL: "Mixed signals - Maintain current positions",
    SLIGHTLY_BEARISH: "Cautiously negative - Reduce exposure",
    BEARISH: "Negative market breadth - Favor defensive positions",
    STRONG_BEARISH: "Market extremely bearish - Avoid new positions"
  };
  
  return interpretations[level] || "Market conditions unclear - Stay cautious";
}

/**
 * Generate market outlook
 */
function generateMarketOutlook(sentiment, advanceDeclineRatio, trin) {
  let outlook = "Market showing mixed signals";
  let bias = "NEUTRAL";
  let suggestedAction = "Monitor key levels";
  
  if (sentiment.score >= 60 && advanceDeclineRatio > 1.2 && trin < 0.9) {
    outlook = "Strong bullish momentum with broad participation";
    bias = "BULLISH";
    suggestedAction = "Look for buying opportunities on dips";
  } else if (sentiment.score >= 55 && advanceDeclineRatio > 1) {
    outlook = "Positive but cautious - Confirmation needed";
    bias = "SLIGHTLY_BULLISH";
    suggestedAction = "Selective buying in strong sectors";
  } else if (sentiment.score <= 40 && advanceDeclineRatio < 0.8 && trin > 1.1) {
    outlook = "Bearish pressure with weak breadth";
    bias = "BEARISH";
    suggestedAction = "Reduce exposure, avoid new positions";
  } else if (sentiment.score <= 45 && advanceDeclineRatio < 0.9) {
    outlook = "Cautious - Bears gaining control";
    bias = "SLIGHTLY_BEARISH";
    suggestedAction = "Defensive positioning recommended";
  } else {
    outlook = "Range-bound market - Wait for clearer direction";
    bias = "NEUTRAL";
    suggestedAction = "Trade ranges, avoid directional bets";
  }
  
  return {
    outlook,
    bias,
    suggestedAction,
    confidence: Math.abs(sentiment.score - 50) * 2
  };
}

/**
 * Get top contributors (stocks driving the market up)
 */
function getTopContributors(stocks, limit) {
  return stocks
    .filter(s => s.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, limit)
    .map(s => ({
      symbol: s.symbol,
      changePercent: s.changePercent,
      price: s.price
    }));
}

/**
 * Get top drags (stocks driving the market down)
 */
function getTopDrags(stocks, limit) {
  return stocks
    .filter(s => s.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, limit)
    .map(s => ({
      symbol: s.symbol,
      changePercent: s.changePercent,
      price: s.price
    }));
}

/**
 * Calculate sector performance
 */
function calculateSectorPerformance(stocks) {
  const sectorMap = new Map();
  
  stocks.forEach(stock => {
    if (stock.sector && stock.changePercent !== undefined) {
      if (!sectorMap.has(stock.sector)) {
        sectorMap.set(stock.sector, {
          totalChange: 0,
          count: 0,
          stocks: []
        });
      }
      
      const sector = sectorMap.get(stock.sector);
      sector.totalChange += stock.changePercent;
      sector.count++;
      sector.stocks.push(stock.symbol);
    }
  });
  
  const sectors = Array.from(sectorMap.entries()).map(([name, data]) => ({
    name,
    averageChange: (data.totalChange / data.count).toFixed(2),
    performance: data.totalChange > 0 ? "UP" : data.totalChange < 0 ? "DOWN" : "FLAT",
    stockCount: data.count
  }));
  
  return sectors.sort((a, b) => parseFloat(b.averageChange) - parseFloat(a.averageChange));
}

/**
 * Format large numbers
 */
function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
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