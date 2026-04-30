const axios = require("axios");
const { symbols } = require("../config/symbols");
const { buildCandles } = require("../utils/candles");
const { addIndicators, generateSignal, analyzeTrend15Min } = require("../utils/indicators");
const confidenceService = require("./confidenceService");
const atrService = require("./atrService");
const sessionService = require("./sessionService");
const fibonacciService = require("./fibonacciService");
const supportResistanceService = require("./supportResistanceService");
const newsAnalysisService = require("./newsAnalysisService");

// ============ IN-MEMORY CACHE ============
const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes
const NEWS_CACHE_TTL = 600000; // 10 minutes for news

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, t: Date.now(), ttl });
}
function clearCache() { cache.clear(); console.log('🧹 Cache cleared'); }

// ============ HTTP CLIENT ============
const http = axios.create({
  timeout: 8000,
  headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
});

const BATCH_SIZE = 5;

// ============ NEWS FETCHING ============
async function fetchNewsForSymbol(symbol) {
  const cacheKey = `news_${symbol}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await http.get(
      `https://news.google.com/rss/search?q=PSX+${symbol}+stock&hl=en-PK&gl=PK&ceid=PK:en`,
      { timeout: 5000 }
    );
    
    // Extract headlines from RSS
    const headlines = [];
    const matches = response.data.matchAll(/<title>(.*?)<\/title>/g);
    for (const match of matches) {
      const title = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      if (!title.includes('Google News') && title.trim()) {
        headlines.push(title);
      }
    }
    
    const unique = [...new Set(headlines)].slice(0, 5);
    setCache(cacheKey, unique, NEWS_CACHE_TTL);
    return unique;
  } catch (error) {
    return [];
  }
}

async function fetchGeneralNews() {
  const cacheKey = 'news_general';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await http.get(
      'https://news.google.com/rss/search?q=PSX+Pakistan+Stock+Exchange&hl=en-PK&gl=PK&ceid=PK:en',
      { timeout: 5000 }
    );
    
    const headlines = [];
    const matches = response.data.matchAll(/<title>(.*?)<\/title>/g);
    for (const match of matches) {
      const title = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      if (!title.includes('Google News') && title.trim()) {
        headlines.push(title);
      }
    }
    
    const unique = [...new Set(headlines)].slice(0, 10);
    setCache(cacheKey, unique, NEWS_CACHE_TTL);
    return unique;
  } catch (error) {
    return [];
  }
}

// ============ ANALYZE NEWS IMPACT ============
async function analyzeNewsImpact(symbol) {
  try {
    const headlines = await fetchNewsForSymbol(symbol);
    if (!headlines.length) return null;
    
    const analysis = await newsAnalysisService.analyzeNewsForStock(symbol, headlines);
    return analysis;
  } catch (error) {
    return null;
  }
}

async function analyzeGeneralNewsImpact() {
  try {
    const headlines = await fetchGeneralNews();
    if (!headlines.length) return [];
    
    const analysis = await newsAnalysisService.analyzeMultipleNews(headlines);
    return analysis;
  } catch (error) {
    return [];
  }
}

// ============ FETCH TICKS ============
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
    symbol: sym, candles15Min: enriched.slice(-30),
    trend15Min: trend.trend, trendStrength15Min: trend.strength,
    entrySignal15Min: trend.entrySignal, exitSignal15Min: trend.exitSignal,
    trendReason: trend.reason, higherHighs: trend.higherHighs,
    lowerLows: trend.lowerLows, emaAlignment15Min: trend.emaAlignment,
    dataPoints15Min: enriched.length
  };
}

// ============ SAFE LATEST ============
function safeLatest(latest, sym, signal) {
  const c = (v, fallback) => (typeof v === 'number' && !isNaN(v)) ? v : fallback;
  return {
    symbol: sym, price: c(latest?.close, 0), signal,
    rsi: c(latest?.rsi, 50), macdTrend: latest?.macdTrend || 'NEUTRAL',
    volumeRatio: c(latest?.volumeRatio, 100), bbPosition: c(latest?.bbPosition, 50),
    bbSignal: latest?.bbSignal || 'Neutral', stochSignal: latest?.stochSignal || 'Neutral',
    vwapSignal: latest?.vwapSignal || 'Neutral', adx: c(latest?.adx, 20),
    ema9: c(latest?.ema9, latest?.close || 0), ema20: c(latest?.ema20, latest?.close || 0),
    vwap: c(latest?.vwap, latest?.close || 0), pctFromEma9: c(latest?.pctFromEma9, 0),
    pctFromEma20: c(latest?.pctFromEma20, 0), pctFromVWAP: c(latest?.pctFromVWAP, 0)
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

// ============ TRADE RECOMMENDATION (WITH NEWS) ============
function generateTradeRecommendation({ confidence, riskLevels, combinedSignal, trend15Min, sessionAdvice, newsImpact }) {
  const score = confidence?.score || 50;
  const signal = combinedSignal?.signal || 'NEUTRAL';
  let action = 'HOLD', reason = 'No clear signal', priority = 'LOW';

  // Adjust confidence with news impact
  const adjustedScore = newsImpact ? score + (newsImpact.impactScore * 2) : score;
  const finalScore = Math.min(100, Math.max(0, adjustedScore));

  if (finalScore >= 70 && signal.includes('BUY')) { action = 'BUY'; reason = `Strong buy (${finalScore}%)`; priority = 'HIGH'; }
  else if (finalScore >= 65 && signal.includes('BUY')) { action = 'BUY'; reason = `Buy signal (${finalScore}%)`; priority = 'HIGH'; }
  else if (finalScore >= 65 && signal.includes('SELL')) { action = 'SELL'; reason = `Sell signal (${finalScore}%)`; priority = 'HIGH'; }
  else if (finalScore >= 55 && trend15Min === 'BULLISH' && !signal.includes('SELL')) { action = 'ACCUMULATE'; reason = 'Bullish trend'; priority = 'MEDIUM'; }
  else if (finalScore >= 55 && trend15Min === 'BEARISH' && !signal.includes('BUY')) { action = 'REDUCE'; reason = 'Bearish trend'; priority = 'MEDIUM'; }
  else if (sessionAdvice?.action === 'ACTIVE') { action = 'MONITOR'; reason = 'Active session'; priority = 'MEDIUM'; }
  else if (sessionAdvice?.action === 'REDUCE' || sessionAdvice?.action === 'EXIT') { action = 'AVOID'; reason = sessionAdvice.advice || 'Exit session'; priority = 'HIGH'; }

  // Add news reason
  if (newsImpact?.summary) {
    reason += ` | News: ${newsImpact.summary}`;
  }

  return {
    action, reason, priority,
    stopLoss: riskLevels?.stopLoss?.normal,
    takeProfit: riskLevels?.takeProfit?.tp1,
    riskReward: riskLevels?.riskReward?.tp1,
    confidenceScore: finalScore,
    originalScore: score,
    newsAdjusted: !!newsImpact,
    timestamp: new Date().toISOString()
  };
}

// ============ PROCESS SINGLE SYMBOL ============
async function processSymbolData(sym) {
  const ticks = await fetchSymbolTicks(sym);
  if (!ticks.length) return { symbol: sym, price: null, signal: 'NO_DATA', error: 'No data', confidence: { score: 0, level: 'ERROR', action: 'AVOID' } };

  const candles = buildCandles(ticks, 300);
  let enriched;
  try { enriched = addIndicators(candles); if (!enriched?.length) throw new Error('Empty'); }
  catch (e) { return { symbol: sym, price: null, signal: 'ERROR', error: e.message, confidence: { score: 0, level: 'ERROR', action: 'AVOID' } }; }

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

  // Fetch news and analyze impact
  let newsImpact = null;
  try {
    newsImpact = await analyzeNewsImpact(sym);
  } catch (e) { /* silent */ }

  // Safe service calls
  let confidence, riskLevels, fibonacci, supportResistance, session, sessionAdvice;
  try { confidence = confidenceService.calculateConfidence(safe); } catch { confidence = { score: 50, level: 'MEDIUM', action: 'MONITOR' }; }
  
  // Adjust confidence with news
  if (newsImpact && confidence?.score) {
    const adjustment = newsImpact.impactScore * 1.5;
    confidence.score = Math.round(Math.min(100, Math.max(0, confidence.score + adjustment)));
    // Adjust level based on new score
    if (confidence.score >= 75) { confidence.level = 'VERY_HIGH'; confidence.action = 'STRONG_BUY'; }
    else if (confidence.score >= 65) { confidence.level = 'HIGH'; confidence.action = 'BUY'; }
    else if (confidence.score >= 55) { confidence.level = 'MEDIUM_HIGH'; confidence.action = 'CONSIDER'; }
    else if (confidence.score >= 45) { confidence.level = 'MEDIUM'; confidence.action = 'MONITOR'; }
    else if (confidence.score >= 35) { confidence.level = 'MEDIUM_LOW'; confidence.action = 'CAUTION'; }
    else { confidence.level = 'LOW'; confidence.action = 'AVOID'; }
  }

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
    ema9: latest?.ema9, ema20: latest?.ema20, ema50: latest?.ema50,
    pctFromEma9: latest?.pctFromEma9, pctFromEma20: latest?.pctFromEma20, pctFromVWAP: latest?.pctFromVWAP,
    rsi: latest?.rsi, rsiSignal: latest?.rsiSignal, macd: latest?.macd, macdSignal: latest?.macdSignal,
    macdHistogram: latest?.macdHistogram, macdTrend: latest?.macdTrend,
    bbUpper: latest?.bbUpper, bbMiddle: latest?.bbMiddle, bbLower: latest?.bbLower,
    bbPosition: latest?.bbPosition, bbWidth: latest?.bbWidth, bbSignal: latest?.bbSignal,
    volumeAvg: latest?.volumeAvg, volumeRatio: latest?.volumeRatio, volumeSignal: latest?.volumeSignal,
    stochK: latest?.stochK, stochD: latest?.stochD, stochSignal: latest?.stochSignal,
    vwap: latest?.vwap, vwapSignal: latest?.vwapSignal, atr: latest?.atr, atrPercent: latest?.atrPercent,
    adx: latest?.adx, adxTrend: latest?.adxTrend, williamsR: latest?.williamsR, wrSignal: latest?.wrSignal,
    cci: latest?.cci, cciSignal: latest?.cciSignal,
    trend15Min: trend15.trend15Min, trendStrength15Min: trend15.trendStrength15Min,
    trendReason15Min: trend15.trendReason, entrySignal15Min: trend15.entrySignal15Min,
    exitSignal15Min: trend15.exitSignal15Min, higherHighs15Min: trend15.higherHighs,
    lowerLows15Min: trend15.lowerLows, emaAlignment15Min: trend15.emaAlignment15Min,
    candles: enriched.slice(-50), candles15Min: trend15.candles15Min,
    signal5Min: signal5, signal: combined.signal, signalConfidence: combined.confidence,
    entrySignal: combined.entrySignal, exitSignal: combined.exitSignal,
    confidence, riskLevels, fibonacci, supportResistance,
    currentSession: session, sessionAdvice, positionSize, trailingStop,
    newsImpact,
    tradeRecommendation: generateTradeRecommendation({
      confidence, riskLevels, combinedSignal: combined,
      trend15Min: trend15.trend15Min, sessionAdvice, newsImpact
    }),
    dataPoints: ticks.length, candleCount: enriched.length
  };
}

// ============ GET ALL STOCKS ============
async function getAllStocksData() {
  const cached = getCache('all');
  if (cached) { console.log(`✅ Cache hit (${cached.length} stocks)`); return cached; }

  console.log(`🚀 Fetching ${symbols.length} symbols in batches of ${BATCH_SIZE}...`);
  const start = Date.now();
  const results = [];

  // Fetch general news first (once for all stocks)
  let generalNews = [];
  try { generalNews = await analyzeGeneralNewsImpact(); } catch {}

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map(s => processSymbolData(s)));
    settled.forEach((r, j) => {
      const stock = r.status === 'fulfilled' ? r.value : { symbol: batch[j], price: null, signal: 'ERROR', error: r.reason?.message, confidence: { score: 0, level: 'ERROR', action: 'AVOID' } };
      // Attach general news impact if relevant
      if (generalNews.length) {
        const relevantNews = generalNews.filter(n => n.symbols?.includes(stock.symbol) || n.sectors?.some(s => newsAnalysisService.sectorMap[stock.symbol] === s));
        if (relevantNews.length && !stock.newsImpact) {
          stock.newsImpact = {
            sentiment: relevantNews[0].sentiment,
            impactScore: relevantNews[0].impactScore,
            summary: relevantNews[0].headline
          };
        }
      }
      results.push(stock);
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
    .map(s => ({
      symbol: s.symbol, price: s.price, changePercent: s.changePercent || 0,
      signal: s.signal || 'NEUTRAL', confidence: s.confidence.score,
      confidenceLevel: s.confidence.level, action: s.confidence.action,
      tradeRecommendation: s.tradeRecommendation,
      riskReward: s.riskLevels?.riskReward?.tp1,
      sessionAdvice: s.sessionAdvice?.action,
      newsImpact: s.newsImpact?.summary || null
    }))
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
    totalNewsImpacts: valid.filter(s => s.newsImpact).length,
    topBuys: valid.filter(s => ['BUY', 'STRONG_BUY'].includes(s.confidence?.action))
      .sort((a, b) => (b.confidence?.score || 0) - (a.confidence?.score || 0))
      .slice(0, 5).map(s => ({
        symbol: s.symbol, price: s.price, confidence: s.confidence?.score,
        signal: s.signal, newsImpact: s.newsImpact?.sentiment
      })),
    topSells: valid.filter(s => ['SELL', 'STRONG_SELL'].includes(s.confidence?.action))
      .sort((a, b) => (b.confidence?.score || 0) - (a.confidence?.score || 0))
      .slice(0, 5).map(s => ({
        symbol: s.symbol, price: s.price, confidence: s.confidence?.score,
        signal: s.signal, newsImpact: s.newsImpact?.sentiment
      }))
  };
}

module.exports = {
  getAllStocksData, getSingleStockData, fetchSymbolTicks,
  clearCache, processSymbolData15Min, getTopOpportunities,
  getMarketSummary, analyzeGeneralNewsImpact, fetchNewsForSymbol
};