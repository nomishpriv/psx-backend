const axios = require("axios");
const { symbols } = require("../config/symbols");
const { buildCandles } = require("../utils/candles");
const { addIndicators, generateSignal, analyzeTrend15Min } = require("../utils/indicators");
const confidenceService = require("./confidenceService");
const atrService = require("./atrService");
const sessionService = require("./sessionService");
const fibonacciService = require("./fibonacciService");
const supportResistanceService = require("./supportResistanceService");

// ============ IN-MEMORY CACHE ============
const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) {
  cache.set(key, { data, t: Date.now() });
}
function clearCache() {
  cache.clear();
  console.log('🧹 Cache cleared');
}

// ============ HTTP CLIENT (connection reuse) ============
const http = axios.create({
  timeout: 8000,
  headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
});

// ============ BATCH FETCH ============
const BATCH_SIZE = 5;

async function fetchSymbolTicks(sym) {
  try {
    const { data } = await http.get(`https://dps.psx.com.pk/timeseries/int/${sym}`);
    return data?.data || [];
  } catch (e) {
    return [];
  }
}

// ============ 15-MIN TREND ============
async function processSymbolData15Min(sym, rawData = null) {
  const ticks = rawData || await fetchSymbolTicks(sym);
  if (!ticks.length) return { symbol: sym, candles15Min: [], trend15Min: 'NEUTRAL', trendStrength15Min: 0, entrySignal15Min: null, exitSignal15Min: null };

  const candles = buildCandles(ticks, 900);
  const enriched = addIndicators(candles);
  const trend = analyzeTrend15Min(enriched);

  return {
    symbol: sym,
    candles15Min: enriched.slice(-30),
    trend15Min: trend.trend,
    trendStrength15Min: trend.strength,
    entrySignal15Min: trend.entrySignal,
    exitSignal15Min: trend.exitSignal,
    trendReason: trend.reason,
    higherHighs: trend.higherHighs,
    lowerLows: trend.lowerLows,
    emaAlignment15Min: trend.emaAlignment,
    dataPoints15Min: enriched.length
  };
}

// ============ BUILD SAFE INDICATOR OBJECT ============
function safeLatest(latest, sym, signal) {
  const c = (v, fallback) => (typeof v === 'number' && !isNaN(v)) ? v : fallback;
  return {
    symbol: sym,
    price: c(latest?.close, 0),
    signal,
    rsi: c(latest?.rsi, 50),
    macdTrend: latest?.macdTrend || 'NEUTRAL',
    volumeRatio: c(latest?.volumeRatio, 100),
    bbPosition: c(latest?.bbPosition, 50),
    bbSignal: latest?.bbSignal || 'Neutral',
    stochSignal: latest?.stochSignal || 'Neutral',
    vwapSignal: latest?.vwapSignal || 'Neutral',
    adx: c(latest?.adx, 20),
    ema9: c(latest?.ema9, latest?.close || 0),
    ema20: c(latest?.ema20, latest?.close || 0),
    vwap: c(latest?.vwap, latest?.close || 0),
    pctFromEma9: c(latest?.pctFromEma9, 0),
    pctFromEma20: c(latest?.pctFromEma20, 0),
    pctFromVWAP: c(latest?.pctFromVWAP, 0)
  };
}

// ============ COMBINED SIGNAL ============
function getCombinedSignal(signal5Min, trend15Min) {
  const trend = trend15Min?.trend15Min || 'NEUTRAL';
  const strength = trend15Min?.trendStrength15Min || 0;
  const entry15 = trend15Min?.entrySignal15Min || null;
  const exit15 = trend15Min?.exitSignal15Min || null;

  let signal = signal5Min || 'NEUTRAL', confidence = 'Medium', entrySignal = null, exitSignal = null;

  if (trend === 'BULLISH' && strength >= 60) {
    if (signal5Min?.includes('BUY')) { signal = 'STRONG_BUY'; confidence = 'High'; entrySignal = '15-min uptrend confirms buy'; }
    else if (signal5Min === 'NEUTRAL') { signal = 'WEAK_BUY'; confidence = 'Medium'; entrySignal = 'Buy on dips'; }
    else { signal = 'NEUTRAL'; confidence = 'Low'; exitSignal = 'Conflict - wait'; }
  } else if (trend === 'BEARISH' && strength >= 60) {
    if (signal5Min?.includes('SELL')) { signal = 'STRONG_SELL'; confidence = 'High'; exitSignal = '15-min downtrend confirms sell'; }
    else if (signal5Min === 'NEUTRAL') { signal = 'WEAK_SELL'; confidence = 'Medium'; exitSignal = 'Sell on bounces'; }
    else { signal = 'NEUTRAL'; confidence = 'Low'; entrySignal = 'Conflict - wait'; }
  }
  if (strength >= 80) confidence = 'Very High';
  if (entry15 && !entrySignal) entrySignal = entry15;
  if (exit15 && !exitSignal) exitSignal = exit15;
  return { signal, confidence, entrySignal, exitSignal };
}

// ============ TRADE RECOMMENDATION ============
function generateTradeRecommendation({ confidence, riskLevels, combinedSignal, trend15Min, sessionAdvice }) {
  const score = confidence?.score || 50;
  const signal = combinedSignal?.signal || 'NEUTRAL';
  let action = 'HOLD', reason = 'No clear signal', priority = 'LOW';

  if (score >= 65 && signal.includes('BUY')) { action = 'BUY'; reason = `High confidence (${score}%) BUY`; priority = 'HIGH'; }
  else if (score >= 65 && signal.includes('SELL')) { action = 'SELL'; reason = `High confidence (${score}%) SELL`; priority = 'HIGH'; }
  else if (score >= 55 && trend15Min === 'BULLISH' && !signal.includes('SELL')) { action = 'ACCUMULATE'; reason = 'Bullish trend'; priority = 'MEDIUM'; }
  else if (score >= 55 && trend15Min === 'BEARISH' && !signal.includes('BUY')) { action = 'REDUCE'; reason = 'Bearish trend'; priority = 'MEDIUM'; }
  else if (sessionAdvice?.action === 'ACTIVE') { action = 'MONITOR'; reason = 'Active session'; priority = 'MEDIUM'; }
  else if (sessionAdvice?.action === 'REDUCE' || sessionAdvice?.action === 'EXIT') { action = 'AVOID'; reason = sessionAdvice.advice || 'Exit session'; priority = 'HIGH'; }

  return { action, reason, priority, stopLoss: riskLevels?.stopLoss?.normal, takeProfit: riskLevels?.takeProfit?.tp1, riskReward: riskLevels?.riskReward?.tp1, confidenceScore: score, timestamp: new Date().toISOString() };
}

// ============ PROCESS SINGLE SYMBOL (5-MIN + ENRICHED) ============
async function processSymbolData(sym) {
  const ticks = await fetchSymbolTicks(sym);
  if (!ticks.length) return { symbol: sym, price: null, signal: 'NO_DATA', error: 'No data', confidence: { score: 0, level: 'ERROR', action: 'AVOID' } };

  const candles = buildCandles(ticks, 300);
  let enriched;
  try { enriched = addIndicators(candles); if (!enriched?.length) throw new Error('Empty'); }
  catch (e) { return { symbol: sym, price: null, signal: 'ERROR', error: e.message, confidence: { score: 0, level: 'ERROR', action: 'AVOID' } }; }

  // 15-min trend (reuse ticks)
  const trend15 = await processSymbolData15Min(sym, ticks);

  const latest = enriched[enriched.length - 1];
  const previous = enriched[enriched.length - 2];
  if (!latest) return { symbol: sym, price: null, signal: 'NO_DATA', error: 'No candle', confidence: { score: 0, level: 'ERROR', action: 'AVOID' } };

  const dayHigh = Math.max(...enriched.map(c => c.high || 0));
  const dayLow = Math.min(...enriched.map(c => c.low || Infinity));
  const firstClose = enriched[0]?.close || 0;
  const change = (latest.close || 0) - firstClose;
  const changePercent = firstClose ? (change / firstClose) * 100 : 0;

  const signal5 = generateSignal(latest, previous);
  const combined = getCombinedSignal(signal5, trend15);
  const safe = safeLatest(latest, sym, combined.signal);

  // Safe service calls
  let confidence, riskLevels, fibonacci, supportResistance, session, sessionAdvice;
  try { confidence = confidenceService.calculateConfidence(safe); } catch { confidence = { score: 50, level: 'MEDIUM', action: 'MONITOR' }; }
  try { riskLevels = atrService.calculateRiskLevels(safe.price, latest?.atr || 0); } catch { riskLevels = null; }
  try { fibonacci = enriched.length >= 20 ? fibonacciService.calculateFibonacci(enriched) : null; } catch { fibonacci = null; }
  try { supportResistance = enriched.length >= 20 ? supportResistanceService.calculate(enriched) : null; } catch { supportResistance = null; }
  try { session = sessionService.getCurrentSession(); sessionAdvice = sessionService.getTradingAdvice(); } catch { session = null; sessionAdvice = null; }

  let positionSize = null, trailingStop = null;
  try { positionSize = atrService.calculatePositionSize(1000000, 0.02, safe.price, riskLevels?.stopLoss?.normal || safe.price * 0.98); } catch {}
  try { trailingStop = atrService.calculateTrailingStop(safe.price, Math.max(...enriched.slice(-20).map(c => c.high || 0)), latest?.atr || 0); } catch {}

  return {
    symbol: sym, price: safe.price, open: enriched[0]?.open || null, high: dayHigh, low: dayLow, close: latest?.close || null,
    volume: latest?.volume || 0, change, changePercent,
    ema9: latest?.ema9, ema20: latest?.ema20, ema50: latest?.ema50, pctFromEma9: latest?.pctFromEma9, pctFromEma20: latest?.pctFromEma20, pctFromVWAP: latest?.pctFromVWAP,
    rsi: latest?.rsi, rsiSignal: latest?.rsiSignal, macd: latest?.macd, macdSignal: latest?.macdSignal, macdHistogram: latest?.macdHistogram, macdTrend: latest?.macdTrend,
    bbUpper: latest?.bbUpper, bbMiddle: latest?.bbMiddle, bbLower: latest?.bbLower, bbPosition: latest?.bbPosition, bbWidth: latest?.bbWidth, bbSignal: latest?.bbSignal,
    volumeAvg: latest?.volumeAvg, volumeRatio: latest?.volumeRatio, volumeSignal: latest?.volumeSignal,
    stochK: latest?.stochK, stochD: latest?.stochD, stochSignal: latest?.stochSignal,
    vwap: latest?.vwap, vwapSignal: latest?.vwapSignal, atr: latest?.atr, atrPercent: latest?.atrPercent,
    adx: latest?.adx, adxTrend: latest?.adxTrend, williamsR: latest?.williamsR, wrSignal: latest?.wrSignal, cci: latest?.cci, cciSignal: latest?.cciSignal,
    trend15Min: trend15.trend15Min, trendStrength15Min: trend15.trendStrength15Min, trendReason15Min: trend15.trendReason,
    entrySignal15Min: trend15.entrySignal15Min, exitSignal15Min: trend15.exitSignal15Min,
    higherHighs15Min: trend15.higherHighs, lowerLows15Min: trend15.lowerLows, emaAlignment15Min: trend15.emaAlignment15Min,
    candles: enriched.slice(-50), candles15Min: trend15.candles15Min,
    signal5Min: signal5, signal: combined.signal, signalConfidence: combined.confidence, entrySignal: combined.entrySignal, exitSignal: combined.exitSignal,
    confidence, riskLevels, fibonacci, supportResistance, currentSession: session, sessionAdvice, positionSize, trailingStop,
    tradeRecommendation: generateTradeRecommendation({ confidence, riskLevels, combinedSignal: combined, trend15Min: trend15.trend15Min, sessionAdvice }),
    dataPoints: ticks.length, candleCount: enriched.length
  };
}

// ============ GET ALL STOCKS (PARALLEL BATCHES) ============
async function getAllStocksData() {
  const cached = getCache('all');
  if (cached) { console.log(`✅ Cache hit (${cached.length} stocks)`); return cached; }

  console.log(`🚀 Fetching ${symbols.length} symbols in batches of ${BATCH_SIZE}...`);
  const start = Date.now();
  const results = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map(s => processSymbolData(s)));
    settled.forEach((r, j) => {
      results.push(r.status === 'fulfilled' ? r.value : { symbol: batch[j], price: null, signal: 'ERROR', error: r.reason?.message, confidence: { score: 0, level: 'ERROR', action: 'AVOID' } });
    });
  }

  const valid = results.filter(r => r.price);
  console.log(`✅ ${valid.length}/${symbols.length} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  setCache('all', results);
  return results;
}

// ============ SINGLE STOCK ============
async function getSingleStockData(sym) {
  const upper = sym.toUpperCase();
  if (!symbols.includes(upper)) throw new Error(`Symbol ${upper} not found`);
  const cached = getCache(`stock_${upper}`);
  if (cached) return cached;
  const result = await processSymbolData(upper);
  if (!result.error) setCache(`stock_${upper}`, result);
  return result;
}

// ============ TOP OPPORTUNITIES ============
async function getTopOpportunities(limit = 10) {
  const all = await getAllStocksData();
  return all
    .filter(s => s.price && s.confidence?.score >= 50)
    .map(s => ({ symbol: s.symbol, price: s.price, changePercent: s.changePercent || 0, signal: s.signal || 'NEUTRAL', confidence: s.confidence.score, confidenceLevel: s.confidence.level, action: s.confidence.action, tradeRecommendation: s.tradeRecommendation, riskReward: s.riskLevels?.riskReward?.tp1, sessionAdvice: s.sessionAdvice?.action }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

// ============ MARKET SUMMARY ============
async function getMarketSummary() {
  const all = await getAllStocksData();
  const valid = all.filter(s => s.price);
  return {
    totalStocks: all.length, activeStocks: valid.length,
    gainers: valid.filter(s => s.changePercent > 0).length,
    losers: valid.filter(s => s.changePercent < 0).length,
    averageConfidence: valid.reduce((sum, s) => sum + (s.confidence?.score || 0), 0) / (valid.length || 1),
    topBuys: valid.filter(s => ['BUY', 'STRONG_BUY'].includes(s.confidence?.action)).sort((a, b) => (b.confidence?.score || 0) - (a.confidence?.score || 0)).slice(0, 5).map(s => ({ symbol: s.symbol, price: s.price, confidence: s.confidence?.score, signal: s.signal })),
    topSells: valid.filter(s => ['SELL', 'STRONG_SELL'].includes(s.confidence?.action)).sort((a, b) => (b.confidence?.score || 0) - (a.confidence?.score || 0)).slice(0, 5).map(s => ({ symbol: s.symbol, price: s.price, confidence: s.confidence?.score, signal: s.signal }))
  };
}

module.exports = { getAllStocksData, getSingleStockData, fetchSymbolTicks, clearCache, processSymbolData15Min, getTopOpportunities, getMarketSummary };