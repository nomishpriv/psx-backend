/**
 * Correlation Service - Stock correlation analysis
 */

/**
 * Calculate correlation between two stocks
 * @param {Array} candles1 - Candlestick data for stock 1
 * @param {Array} candles2 - Candlestick data for stock 2
 * @returns {object} Correlation analysis
 */
function calculate(candles1, candles2) {
  if (!candles1 || !candles2 || candles1.length < 20 || candles2.length < 20) {
    return {
      value: null,
      strength: 'INSUFFICIENT_DATA',
      direction: 'NEUTRAL',
      interpretation: 'Need at least 20 candles for correlation'
    };
  }
  
  // Get closing prices (align lengths)
  const minLength = Math.min(candles1.length, candles2.length);
  const prices1 = candles1.slice(-minLength).map(c => c.close);
  const prices2 = candles2.slice(-minLength).map(c => c.close);
  
  // Calculate Pearson correlation coefficient
  const correlation = pearsonCorrelation(prices1, prices2);
  
  // Determine strength and direction
  let strength = 'NO_CORRELATION';
  let direction = 'NEUTRAL';
  let interpretation = '';
  
  const absCorr = Math.abs(correlation);
  
  if (absCorr > 0.8) {
    strength = 'VERY_STRONG';
    interpretation = 'Strong correlation - Stocks move almost identically';
  } else if (absCorr > 0.6) {
    strength = 'STRONG';
    interpretation = 'Strong correlation - Useful for pairs trading';
  } else if (absCorr > 0.4) {
    strength = 'MODERATE';
    interpretation = 'Moderate correlation - Some relationship exists';
  } else if (absCorr > 0.2) {
    strength = 'WEAK';
    interpretation = 'Weak correlation - Limited relationship';
  } else {
    strength = 'VERY_WEAK';
    interpretation = 'Very weak correlation - Independent movement';
  }
  
  if (correlation > 0.2) {
    direction = 'POSITIVE';
    interpretation += ' - Stocks tend to move together';
  } else if (correlation < -0.2) {
    direction = 'NEGATIVE';
    interpretation += ' - Stocks tend to move opposite';
  } else {
    direction = 'NEUTRAL';
    interpretation += ' - No clear directional relationship';
  }
  
  // Calculate rolling correlation (last 10 periods)
  const rollingCorrelation = calculateRollingCorrelation(prices1, prices2, 10);
  
  // Calculate correlation stability
  const stability = calculateCorrelationStability(rollingCorrelation);
  
  return {
    value: correlation.toFixed(3),
    strength,
    direction,
    interpretation,
    rollingCorrelation: rollingCorrelation.slice(-5).map(r => r.toFixed(3)),
    stability,
    sampleSize: minLength,
    timestamp: new Date().toISOString()
  };
}

/**
 * Calculate Pearson correlation coefficient
 */
function pearsonCorrelation(x, y) {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b) / n;
  const meanY = y.reduce((a, b) => a + b) / n;
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }
  
  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate rolling correlation
 */
function calculateRollingCorrelation(prices1, prices2, period) {
  const correlations = [];
  
  for (let i = period; i <= prices1.length; i++) {
    const slice1 = prices1.slice(i - period, i);
    const slice2 = prices2.slice(i - period, i);
    const corr = pearsonCorrelation(slice1, slice2);
    correlations.push(corr);
  }
  
  return correlations;
}

/**
 * Calculate correlation stability (how consistent is the correlation)
 */
function calculateCorrelationStability(rollingCorrelation) {
  if (rollingCorrelation.length < 5) {
    return { status: 'INSUFFICIENT_DATA', message: 'Need more data' };
  }
  
  const recent = rollingCorrelation.slice(-5);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const stdDev = Math.sqrt(
    recent.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / recent.length
  );
  
  let status = 'STABLE';
  let message = 'Correlation is consistent';
  
  if (stdDev > 0.3) {
    status = 'UNSTABLE';
    message = 'Correlation is volatile - May break down';
  } else if (stdDev > 0.15) {
    status = 'MODERATELY_STABLE';
    message = 'Some variation in correlation';
  }
  
  return {
    status,
    standardDeviation: stdDev.toFixed(3),
    averageCorrelation: avg.toFixed(3),
    message
  };
}

/**
 * Calculate correlation matrix for multiple stocks
 * @param {Array} stocks - Array of stock objects with candles data
 * @returns {object} Correlation matrix
 */
function calculateMatrix(stocks) {
  const symbols = stocks.map(s => s.symbol);
  const n = symbols.length;
  
  // Initialize matrix
  const matrix = Array(n).fill().map(() => Array(n).fill(0));
  const heatmap = [];
  
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        const stock1 = stocks[i];
        const stock2 = stocks[j];
        const correlation = calculate(stock1.candles || [], stock2.candles || []);
        const corrValue = parseFloat(correlation.value) || 0;
        
        matrix[i][j] = corrValue;
        matrix[j][i] = corrValue;
        
        // Build heatmap data
        heatmap.push({
          stock1: symbols[i],
          stock2: symbols[j],
          correlation: corrValue,
          strength: correlation.strength,
          direction: correlation.direction
        });
      }
    }
  }
  
  // Find strongest positive correlation
  let strongestPositive = { value: -1, pair: null };
  let strongestNegative = { value: 1, pair: null };
  
  heatmap.forEach(item => {
    if (item.correlation > strongestPositive.value && item.correlation < 1) {
      strongestPositive = { value: item.correlation, pair: `${item.stock1}-${item.stock2}` };
    }
    if (item.correlation < strongestNegative.value) {
      strongestNegative = { value: item.correlation, pair: `${item.stock1}-${item.stock2}` };
    }
  });
  
  // Generate trading recommendations based on correlations
  const recommendations = generateCorrelationRecommendations(heatmap);
  
  return {
    symbols,
    matrix: matrix.map(row => row.map(v => v.toFixed(3))),
    heatmap: heatmap.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)),
    strongestPositive,
    strongestNegative,
    recommendations,
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate correlation-based trading recommendations
 */
function generateCorrelationRecommendations(heatmap) {
  const recommendations = [];
  
  // Find high positive correlations (> 0.8)
  const highPositive = heatmap.filter(h => h.correlation > 0.8);
  highPositive.forEach(pair => {
    recommendations.push({
      type: 'PAIRS_TRADE',
      action: 'DIVERSIFY',
      pair: `${pair.stock1} & ${pair.stock2}`,
      message: `High positive correlation (${pair.correlation.toFixed(3)}) - Don't buy both for diversification`,
      strategy: 'Choose one for long position'
    });
  });
  
  // Find high negative correlations (< -0.6)
  const highNegative = heatmap.filter(h => h.correlation < -0.6);
  highNegative.forEach(pair => {
    recommendations.push({
      type: 'PAIRS_TRADE',
      action: 'HEDGE',
      pair: `${pair.stock1} & ${pair.stock2}`,
      message: `Negative correlation (${pair.correlation.toFixed(3)}) - Ideal for pairs trading`,
      strategy: 'Long one, short the other'
    });
  });
  
  return recommendations.slice(0, 5);
}

/**
 * Find stocks with highest correlation to a given symbol
 * @param {string} symbol - Target symbol
 * @param {Array} stocks - All stocks data
 * @param {number} limit - Number of results
 * @returns {Array} Most correlated stocks
 */
function findCorrelatedStocks(symbol, stocks, limit = 5) {
  const targetStock = stocks.find(s => s.symbol === symbol);
  
  if (!targetStock || !targetStock.candles) {
    return [];
  }
  
  const correlations = [];
  
  stocks.forEach(stock => {
    if (stock.symbol !== symbol && stock.candles) {
      const correlation = calculate(targetStock.candles, stock.candles);
      correlations.push({
        symbol: stock.symbol,
        correlation: parseFloat(correlation.value),
        strength: correlation.strength,
        direction: correlation.direction
      });
    }
  });
  
  return correlations
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .slice(0, limit);
}

/**
 * Check if service is available
 */
function isAvailable() {
  return true;
}

module.exports = {
  calculate,
  calculateMatrix,
  findCorrelatedStocks,
  isAvailable
};