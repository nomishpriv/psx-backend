/**
 * Confidence Score Service
 * Combines multiple indicators into a single 0-100 confidence score
 * OPTIMIZED: Reduced branching, precomputed thresholds, faster math
 */

// Precomputed constants
const BASE_SCORE = 50;
const WEIGHTS = { trend: 0.3, momentum: 0.3, volume: 0.2, volatility: 0.1, strength: 0.1 };
const LEVELS = [
  { min: 75, level: 'VERY_HIGH', action: 'STRONG_BUY', color: '#10b981' },
  { min: 65, level: 'HIGH', action: 'BUY', color: '#22c55e' },
  { min: 55, level: 'MEDIUM_HIGH', action: 'CONSIDER', color: '#84cc16' },
  { min: 45, level: 'MEDIUM', action: 'MONITOR', color: '#eab308' },
  { min: 35, level: 'MEDIUM_LOW', action: 'CAUTION', color: '#f97316' },
  { min: 25, level: 'LOW', action: 'AVOID', color: '#ef4444' },
];
const VERY_LOW = { level: 'VERY_LOW', action: 'STRONG_AVOID', color: '#dc2626' };

function n(v, fallback = 0) {
  return (typeof v === 'number' && !isNaN(v)) ? v : fallback;
}

function calculateConfidence(stock = {}) {
  const reasons = [];
  const price = n(stock.price);
  const rsi = n(stock.rsi, 50);
  const volRatio = n(stock.volumeRatio, 100);
  const bbPos = n(stock.bbPosition, 50);
  const adx = n(stock.adx, 20);
  const ema9 = n(stock.ema9, price);
  const ema20 = n(stock.ema20, price);
  const signal = stock.signal || 'NEUTRAL';

  // Trend (max ±25)
  let trend = 0;
  if (price > ema9 && price > ema20) { trend += 10; reasons.push('Price above EMAs (+10)'); }
  else if (price < ema9 && price < ema20) { trend -= 10; reasons.push('Price below EMAs (-10)'); }
  if (ema9 > ema20) { trend += 8; reasons.push('EMA9 > EMA20 (+8)'); }
  else { trend -= 8; reasons.push('EMA9 < EMA20 (-8)'); }
  if (stock.vwapSignal === 'Bullish') { trend += 7; reasons.push('Above VWAP (+7)'); }
  else if (stock.vwapSignal === 'Bearish') { trend -= 7; reasons.push('Below VWAP (-7)'); }

  // Momentum (max ±25)
  let momentum = 0;
  if (rsi < 30) { momentum += 12; reasons.push(`Oversold RSI(${rsi.toFixed(1)}) (+12)`); }
  else if (rsi > 70) { momentum -= 12; reasons.push(`Overbought RSI(${rsi.toFixed(1)}) (-12)`); }
  else if (rsi > 40 && rsi < 60) { momentum += 5; reasons.push(`Neutral RSI(+5)`); }
  if (stock.macdTrend === 'Bullish') { momentum += 8; reasons.push('MACD Bullish (+8)'); }
  else if (stock.macdTrend === 'Bearish') { momentum -= 8; reasons.push('MACD Bearish (-8)'); }
  const stoch = stock.stochSignal;
  if (stoch === 'Oversold') { momentum += 5; reasons.push('Stoch Oversold (+5)'); }
  else if (stoch === 'Overbought') { momentum -= 5; reasons.push('Stoch Overbought (-5)'); }
  else if (stoch === 'Bullish') { momentum += 3; reasons.push('Stoch Bullish (+3)'); }

  // Volume (max ±20)
  let volume = 0;
  if (volRatio > 150) { volume += 15; reasons.push(`Vol spike(${volRatio.toFixed(0)}%) (+15)`); }
  else if (volRatio > 120) { volume += 10; reasons.push(`High vol(${volRatio.toFixed(0)}%) (+10)`); }
  else if (volRatio > 80) { volume += 5; reasons.push(`Normal vol(+5)`); }
  else if (volRatio < 50) { volume -= 10; reasons.push(`Very low vol(-10)`); }
  else if (volRatio < 80) { volume -= 5; reasons.push(`Low vol(-5)`); }
  if (volRatio > 120 && price > ema20) { volume += 5; reasons.push('Vol confirms uptrend (+5)'); }
  else if (volRatio > 120 && price < ema20) { volume -= 5; reasons.push('Vol confirms downtrend (-5)'); }

  // Volatility (max ±15)
  let volatility = 0;
  if (bbPos < 20) { volatility += 8; reasons.push(`Lower BB(${bbPos.toFixed(0)}%) (+8)`); }
  else if (bbPos > 80) { volatility -= 8; reasons.push(`Upper BB(${bbPos.toFixed(0)}%) (-8)`); }
  else if (bbPos > 40 && bbPos < 60) { volatility += 3; reasons.push(`Mid BB(+3)`); }
  const bbSig = stock.bbSignal;
  if (bbSig === 'Buy') { volatility += 7; reasons.push('BB Buy (+7)'); }
  else if (bbSig === 'Sell') { volatility -= 7; reasons.push('BB Sell (-7)'); }

  // Strength (max ±15)
  let strength = 0;
  if (adx > 25) {
    if (trend > 0) { strength += 10; reasons.push(`Strong uptrend ADX(${adx.toFixed(1)}) (+10)`); }
    else { strength -= 10; reasons.push(`Strong downtrend ADX(${adx.toFixed(1)}) (-10)`); }
  } else if (adx < 20) {
    strength += 5; reasons.push(`Weak trend ADX(+5)`);
  }

  // Final score
  const raw = BASE_SCORE + trend * WEIGHTS.trend + momentum * WEIGHTS.momentum + volume * WEIGHTS.volume + volatility * WEIGHTS.volatility + strength * WEIGHTS.strength;
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  // Level lookup
  let levelInfo = VERY_LOW;
  for (const l of LEVELS) { if (score >= l.min) { levelInfo = l; break; } }

  // Recommendation
  let recommendation = levelInfo.action;
  if (signal === 'BUY' && score > 60) recommendation = 'STRONG_BUY - Technical + Confidence';
  else if (signal === 'SELL' && score < 40) recommendation = 'STRONG_SELL - Technical + Confidence';
  else if (signal === 'BUY' && score < 40) recommendation = 'CAUTION - Buy signal, low confidence';
  else if (signal === 'SELL' && score > 60) recommendation = 'CAUTION - Sell signal, high confidence';

  return {
    score,
    level: levelInfo.level,
    action: levelInfo.action,
    color: levelInfo.color,
    recommendation,
    breakdown: {
      trend: Math.round(trend),
      momentum: Math.round(momentum),
      volume: Math.round(volume),
      volatility: Math.round(volatility),
      strength: Math.round(strength)
    },
    reasons: reasons.slice(0, 5),
    timestamp: new Date().toISOString()
  };
}

// ============ ALERTS (simplified) ============
function generateAlerts(stocks) {
  const alerts = [];
  if (!stocks?.length) return alerts;

  for (const stock of stocks) {
    if (!stock) continue;
    const confidence = calculateConfidence(stock);
    const rsi = n(stock.rsi, 50);
    const vol = n(stock.volumeRatio, 100);
    const bb = n(stock.bbPosition, 50);
    const s = stock.symbol || '?';

    if (confidence.score >= 70 && confidence.action === 'BUY')
      alerts.push({ type: 'BUY', symbol: s, price: stock.price, confidence: confidence.score, message: `${s}: Buy ${confidence.score}%`, timestamp: new Date().toISOString(), priority: 'HIGH' });
    if (rsi < 30 && vol > 120)
      alerts.push({ type: 'OVERSOLD_BOUNCE', symbol: s, price: stock.price, rsi, volumeRatio: vol, message: `${s}: Oversold bounce RSI${rsi.toFixed(1)}`, timestamp: new Date().toISOString(), priority: 'MEDIUM' });
    if (vol > 200)
      alerts.push({ type: 'VOLUME_SPIKE', symbol: s, price: stock.price, volumeRatio: vol, message: `${s}: Vol spike ${vol.toFixed(0)}%`, timestamp: new Date().toISOString(), priority: 'MEDIUM' });
    if (bb > 80 && vol > 150)
      alerts.push({ type: 'BREAKOUT', symbol: s, price: stock.price, message: `${s}: BB breakout`, timestamp: new Date().toISOString(), priority: 'HIGH' });
    if (bb < 20 && vol > 150)
      alerts.push({ type: 'BREAKDOWN', symbol: s, price: stock.price, message: `${s}: BB breakdown`, timestamp: new Date().toISOString(), priority: 'HIGH' });
    if (stock.macdTrend === 'Bullish' && stock.macdHistogram > 0)
      alerts.push({ type: 'MACD_CROSSOVER', symbol: s, price: stock.price, message: `${s}: MACD crossover`, timestamp: new Date().toISOString(), priority: 'LOW' });
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  alerts.sort((a, b) => order[a.priority] - order[b.priority]);
  return alerts;
}

function isAvailable() { return true; }

module.exports = { calculateConfidence, generateAlerts, isAvailable };