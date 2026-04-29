/**
 * Build candlestick data from tick data
 * @param {Array} data - Raw tick data from PSX API
 * @param {number} interval - Candle interval in seconds (default: 60)
 * @returns {Array} - Candlestick data
 */
function buildCandles(data, interval = 60) {
  if (!data || data.length === 0) return [];
  
  const candles = [];
  let current = null;

  for (let i = 0; i < data.length; i++) {
    const t = data[i];
    const bucketTime = Math.floor(t[0] / interval) * interval;

    if (!current || current.time !== bucketTime) {
      if (current) candles.push(current);

      current = {
        time: bucketTime,
        open: t[1],
        high: t[1],
        low: t[1],
        close: t[1],
        volume: t[2],
      };
    } else {
      current.high = Math.max(current.high, t[1]);
      current.low = Math.min(current.low, t[1]);
      current.close = t[1];
      current.volume += t[2];
    }
  }

  if (current) candles.push(current);
  
  // Sort by time ascending
  return candles.sort((a, b) => a.time - b.time);
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(data, period) {
  if (data.length < period) return null;
  const sum = data.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * Calculate Exponential Moving Average
 */
function calculateEMA(data, period) {
  if (data.length < period) return null;
  
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  
  return ema;
}

module.exports = {
  buildCandles,
  calculateSMA,
  calculateEMA
};