const axios = require("axios");
const NodeCache = require("node-cache");
const { symbols } = require("../config/symbols");
const { buildCandles } = require("../utils/candles");
const { addIndicators, generateSignal, analyzeTrend15Min } = require("../utils/indicators");

// Import new services for predictable trading
const confidenceService = require("./confidenceService");
const atrService = require("./atrService");
const sessionService = require("./sessionService");
const fibonacciService = require("./fibonacciService");
const supportResistanceService = require("./supportResistanceService");

const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache for intraday data
// const cache = new NodeCache({ stdTTL: 1 }); // 1 second for testing

/**
 * Fetch raw tick data for a symbol from PSX
 */
async function fetchSymbolTicks(sym) {
  try {
    const url = `https://dps.psx.com.pk/timeseries/int/${sym}`;
    
    const res = await axios.get(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      },
      timeout: 8000
    });
    
    return res.data.data || [];
  } catch (error) {
    console.error(`❌ Error fetching ${sym}:`, error.message);
    return [];
  }
}

/**
 * Process symbol data with 15-minute candles for trend analysis
 */
async function processSymbolData15Min(sym) {
  const rawData = await fetchSymbolTicks(sym);
  
  if (!rawData || rawData.length === 0) {
    return {
      symbol: sym,
      candles15Min: [],
      trend15Min: 'NEUTRAL',
      trendStrength15Min: 0,
      entrySignal15Min: null,
      exitSignal15Min: null,
      error: "No data available"
    };
  }

  const candles = buildCandles(rawData, 900);
  const enriched = addIndicators(candles);
  const trendAnalysis = analyzeTrend15Min(enriched);
  
  return {
    symbol: sym,
    candles15Min: enriched.slice(-30),
    trend15Min: trendAnalysis.trend,
    trendStrength15Min: trendAnalysis.strength,
    entrySignal15Min: trendAnalysis.entrySignal,
    exitSignal15Min: trendAnalysis.exitSignal,
    trendReason: trendAnalysis.reason,
    higherHighs: trendAnalysis.higherHighs,
    lowerLows: trendAnalysis.lowerLows,
    emaAlignment15Min: trendAnalysis.emaAlignment,
    dataPoints15Min: enriched.length
  };
}

/**
 * Process symbol data with 5-minute indicators and enhanced predictions
 */
async function processSymbolData(sym) {
  const rawData = await fetchSymbolTicks(sym);
  
  if (!rawData || rawData.length === 0) {
    return {
      symbol: sym,
      price: null,
      volume: null,
      rsi: null,
      ema9: null,
      ema20: null,
      ema50: null,
      volumeAvg: null,
      vwap: null,
      candles: [],
      signal: "NO_DATA",
      error: "No data available"
    };
  }

  // Build 5-MINUTE candles (300 seconds)
  const candles = buildCandles(rawData, 300);
  
  // Add technical indicators
  let enriched = [];
  try {
    enriched = addIndicators(candles);
    if (!enriched || enriched.length === 0) {
      throw new Error("No indicators generated");
    }
  } catch (indicatorError) {
    console.error(`❌ Indicator error for ${sym}:`, indicatorError.message);
    return {
      symbol: sym,
      price: null,
      volume: null,
      signal: "ERROR",
      error: `Indicator error: ${indicatorError.message}`
    };
  }
  
  // Get 15-minute trend analysis
  const trend15Min = await processSymbolData15Min(sym);
  
  // Get latest candle and previous for signal generation
  const latest = enriched[enriched.length - 1];
  const previous = enriched[enriched.length - 2];
  
  if (!latest) {
    return {
      symbol: sym,
      price: null,
      volume: null,
      signal: "NO_DATA",
      error: "No candle data available"
    };
  }
  
  // Get day's high/low from all candles
  const dayHigh = Math.max(...enriched.map(c => c.high || 0));
  const dayLow = Math.min(...enriched.map(c => c.low || Infinity));
  const firstCandle = enriched[0];
  
  // Calculate change
  const change = (latest?.close || 0) - (firstCandle?.close || 0);
  const changePercent = firstCandle?.close ? (change / firstCandle.close) * 100 : 0;
  
  // Generate combined signal using 5-min and 15-min data
  const signal5Min = generateSignal(latest, previous);
  const combinedSignal = getCombinedSignal(signal5Min, trend15Min);
  
  // ============ ENHANCED PREDICTABLE TRADING FEATURES with Error Handling ============
  
  // Prepare safe values for confidence service
  const safeLatest = {
    symbol: sym,
    price: typeof latest?.close === 'number' ? latest.close : 0,
    signal: combinedSignal.signal || 'NEUTRAL',
    rsi: typeof latest?.rsi === 'number' ? latest.rsi : 50,
    macdTrend: latest?.macdTrend || 'NEUTRAL',
    volumeRatio: typeof latest?.volumeRatio === 'number' ? latest.volumeRatio : 100,
    bbPosition: typeof latest?.bbPosition === 'number' ? latest.bbPosition : 50,
    bbSignal: latest?.bbSignal || 'Neutral',
    stochSignal: latest?.stochSignal || 'Neutral',
    vwapSignal: latest?.vwapSignal || 'Neutral',
    adx: typeof latest?.adx === 'number' ? latest.adx : 20,
    ema9: typeof latest?.ema9 === 'number' ? latest.ema9 : (latest?.close || 0),
    ema20: typeof latest?.ema20 === 'number' ? latest.ema20 : (latest?.close || 0),
    vwap: typeof latest?.vwap === 'number' ? latest.vwap : (latest?.close || 0),
    pctFromEma9: typeof latest?.pctFromEma9 === 'number' ? latest.pctFromEma9 : 0,
    pctFromEma20: typeof latest?.pctFromEma20 === 'number' ? latest.pctFromEma20 : 0,
    pctFromVWAP: typeof latest?.pctFromVWAP === 'number' ? latest.pctFromVWAP : 0
  };
  
  // Calculate Confidence Score (0-100)
  let confidence = null;
  try {
    confidence = confidenceService.calculateConfidence(safeLatest);
  } catch (confError) {
    console.warn(`Confidence calculation failed for ${sym}:`, confError.message);
    confidence = { score: 50, level: 'MEDIUM', action: 'MONITOR' };
  }
  
  // Calculate ATR-based Risk Levels
  let riskLevels = null;
  try {
    const safeClose = typeof latest?.close === 'number' ? latest.close : 0;
    const safeAtr = typeof latest?.atr === 'number' ? latest.atr : 0;
    riskLevels = atrService.calculateRiskLevels(safeClose, safeAtr);
  } catch (riskError) {
    console.warn(`Risk calculation failed for ${sym}:`, riskError.message);
    riskLevels = null;
  }
  
  // Calculate Fibonacci Retracement Levels
  let fibonacci = null;
  try {
    if (enriched && enriched.length >= 20) {
      fibonacci = fibonacciService.calculateFibonacci(enriched);
    }
  } catch (fibError) {
    console.warn(`Fibonacci calculation failed for ${sym}:`, fibError.message);
    fibonacci = null;
  }
  
  // Calculate Support & Resistance Levels
  let supportResistance = null;
  try {
    if (enriched && enriched.length >= 20) {
      supportResistance = supportResistanceService.calculate(enriched);
    }
  } catch (srError) {
    console.warn(`Support/Resistance calculation failed for ${sym}:`, srError.message);
    supportResistance = null;
  }
  
  // Get Current Trading Session Advice
  let currentSession = null;
  let sessionAdvice = null;
  try {
    currentSession = sessionService.getCurrentSession();
    sessionAdvice = sessionService.getTradingAdvice();
  } catch (sessionError) {
    console.warn(`Session service failed:`, sessionError.message);
    currentSession = { label: 'Unknown', isMarketHours: false };
    sessionAdvice = { action: 'UNKNOWN', advice: 'Session service unavailable' };
  }
  
  // Calculate dynamic position size
  let positionSize = null;
  try {
    const safeClose = typeof latest?.close === 'number' ? latest.close : 0;
    const safeStopLoss = riskLevels?.stopLoss?.normal ? parseFloat(riskLevels.stopLoss.normal) : (safeClose * 0.98);
    positionSize = atrService.calculatePositionSize(1000000, 0.02, safeClose, safeStopLoss);
  } catch (psError) {
    positionSize = null;
  }
  
  // Calculate trailing stop levels
  let trailingStop = null;
  try {
    const safeClose = typeof latest?.close === 'number' ? latest.close : 0;
    const safeAtr = typeof latest?.atr === 'number' ? latest.atr : 0;
    const highestPrice = Math.max(...enriched.slice(-20).map(c => c.high || 0));
    trailingStop = atrService.calculateTrailingStop(safeClose, highestPrice, safeAtr);
  } catch (tsError) {
    trailingStop = null;
  }
  
  return {
    symbol: sym,
    price: latest?.close || null,
    open: firstCandle?.open || latest?.open || null,
    high: dayHigh || latest?.high || null,
    low: dayLow || latest?.low || null,
    close: latest?.close || null,
    volume: latest?.volume || 0,
    change: change,
    changePercent: changePercent,
    
    // Moving Averages
    ema9: latest?.ema9 || null,
    ema20: latest?.ema20 || null,
    ema50: latest?.ema50 || null,
    pctFromEma9: latest?.pctFromEma9 || null,
    pctFromEma20: latest?.pctFromEma20 || null,
    pctFromVWAP: latest?.pctFromVWAP || null,
    
    // Momentum Indicators
    rsi: latest?.rsi || null,
    rsiSignal: latest?.rsiSignal || null,
    macd: latest?.macd || null,
    macdSignal: latest?.macdSignal || null,
    macdHistogram: latest?.macdHistogram || null,
    macdTrend: latest?.macdTrend || null,
    
    // Bollinger Bands
    bbUpper: latest?.bbUpper || null,
    bbMiddle: latest?.bbMiddle || null,
    bbLower: latest?.bbLower || null,
    bbPosition: latest?.bbPosition || null,
    bbWidth: latest?.bbWidth || null,
    bbSignal: latest?.bbSignal || null,
    
    // Volume
    volumeAvg: latest?.volumeAvg || null,
    volumeRatio: latest?.volumeRatio || 100,
    volumeSignal: latest?.volumeSignal || 'Normal',
    
    // Stochastic
    stochK: latest?.stochK || null,
    stochD: latest?.stochD || null,
    stochSignal: latest?.stochSignal || null,
    
    // VWAP
    vwap: latest?.vwap || null,
    vwapSignal: latest?.vwapSignal || null,
    
    // ATR
    atr: latest?.atr || null,
    atrPercent: latest?.atrPercent || null,
    
    // ADX
    adx: latest?.adx || null,
    adxTrend: latest?.adxTrend || null,
    
    // Williams %R & CCI
    williamsR: latest?.williamsR || null,
    wrSignal: latest?.wrSignal || null,
    cci: latest?.cci || null,
    cciSignal: latest?.cciSignal || null,
    
    // 15-Minute Trend Analysis
    trend15Min: trend15Min.trend15Min,
    trendStrength15Min: trend15Min.trendStrength15Min,
    trendReason15Min: trend15Min.trendReason,
    entrySignal15Min: trend15Min.entrySignal15Min,
    exitSignal15Min: trend15Min.exitSignal15Min,
    higherHighs15Min: trend15Min.higherHighs,
    lowerLows15Min: trend15Min.lowerLows,
    emaAlignment15Min: trend15Min.emaAlignment15Min,
    
    // Candles
    candles: enriched.slice(-50),
    candles15Min: trend15Min.candles15Min,
    
    // Combined Signal
    signal5Min: signal5Min,
    signal: combinedSignal.signal,
    signalConfidence: combinedSignal.confidence,
    entrySignal: combinedSignal.entrySignal,
    exitSignal: combinedSignal.exitSignal,
    
    // Predictable Trading Fields
    confidence: confidence,
    riskLevels: riskLevels,
    fibonacci: fibonacci,
    supportResistance: supportResistance,
    currentSession: currentSession,
    sessionAdvice: sessionAdvice,
    positionSize: positionSize,
    trailingStop: trailingStop,
    tradeRecommendation: generateTradeRecommendation({
      confidence,
      riskLevels,
      combinedSignal,
      trend15Min: trend15Min.trend15Min,
      sessionAdvice
    }),
    
    dataPoints: rawData.length,
    candleCount: enriched.length
  };
}

/**
 * Generate comprehensive trade recommendation
 */
function generateTradeRecommendation({ confidence, riskLevels, combinedSignal, trend15Min, sessionAdvice }) {
  let action = "HOLD";
  let reason = "";
  let priority = "LOW";
  
  const confidenceScore = confidence?.score || 50;
  const signal = combinedSignal?.signal || 'NEUTRAL';
  
  // High confidence buy signal
  if (confidenceScore >= 65 && signal.includes('BUY')) {
    action = "BUY";
    reason = `High confidence (${confidenceScore}%) with ${signal} signal`;
    priority = "HIGH";
  }
  // High confidence sell signal
  else if (confidenceScore >= 65 && signal.includes('SELL')) {
    action = "SELL";
    reason = `High confidence (${confidenceScore}%) with ${signal} signal`;
    priority = "HIGH";
  }
  // Medium confidence with strong trend
  else if (confidenceScore >= 55 && trend15Min === 'BULLISH' && !signal.includes('SELL')) {
    action = "ACCUMULATE";
    reason = `Moderate confidence (${confidenceScore}%) with bullish 15-min trend`;
    priority = "MEDIUM";
  }
  else if (confidenceScore >= 55 && trend15Min === 'BEARISH' && !signal.includes('BUY')) {
    action = "REDUCE";
    reason = `Moderate confidence (${confidenceScore}%) with bearish 15-min trend`;
    priority = "MEDIUM";
  }
  // Session-based advice
  else if (sessionAdvice?.action === 'ACTIVE' && confidenceScore >= 50) {
    action = "MONITOR";
    reason = `Active trading session - Monitor for entry signals`;
    priority = "MEDIUM";
  }
  else if (sessionAdvice?.action === 'REDUCE' || sessionAdvice?.action === 'EXIT') {
    action = "AVOID";
    reason = `${sessionAdvice.advice || 'Session advice'} - Avoid new positions`;
    priority = "HIGH";
  }
  else {
    reason = "No clear signal - Wait for confirmation";
    priority = "LOW";
  }
  
  return {
    action,
    reason,
    priority,
    stopLoss: riskLevels?.stopLoss?.normal,
    takeProfit: riskLevels?.takeProfit?.tp1,
    riskReward: riskLevels?.riskReward?.tp1,
    confidenceScore: confidenceScore,
    timestamp: new Date().toISOString()
  };
}

/**
 * Combine 5-minute and 15-minute signals for better accuracy
 */
function getCombinedSignal(signal5Min, trend15Min) {
  const trend = trend15Min?.trend15Min || 'NEUTRAL';
  const trendStrength = trend15Min?.trendStrength15Min || 0;
  const entry15 = trend15Min?.entrySignal15Min || null;
  const exit15 = trend15Min?.exitSignal15Min || null;
  
  let signal = signal5Min || 'NEUTRAL';
  let confidence = 'Medium';
  let entrySignal = null;
  let exitSignal = null;
  
  // Strong trend confirmation
  if (trend === 'BULLISH' && trendStrength >= 60) {
    if (signal5Min?.includes('BUY')) {
      signal = 'STRONG_BUY';
      confidence = 'High';
      entrySignal = '✅ 15-min uptrend confirms 5-min buy signal';
    } else if (signal5Min === 'NEUTRAL') {
      signal = 'WEAK_BUY';
      confidence = 'Medium';
      entrySignal = '↗️ 15-min uptrend suggests buying on dips';
    } else if (signal5Min?.includes('SELL')) {
      signal = 'NEUTRAL';
      confidence = 'Low';
      exitSignal = '⚠️ 5-min sell conflicts with 15-min uptrend - wait';
    }
  } else if (trend === 'BEARISH' && trendStrength >= 60) {
    if (signal5Min?.includes('SELL')) {
      signal = 'STRONG_SELL';
      confidence = 'High';
      exitSignal = '✅ 15-min downtrend confirms 5-min sell signal';
    } else if (signal5Min === 'NEUTRAL') {
      signal = 'WEAK_SELL';
      confidence = 'Medium';
      exitSignal = '↘️ 15-min downtrend suggests selling on bounces';
    } else if (signal5Min?.includes('BUY')) {
      signal = 'NEUTRAL';
      confidence = 'Low';
      entrySignal = '⚠️ 5-min buy conflicts with 15-min downtrend - wait';
    }
  }
  
  // Add entry/exit from 15-min analysis
  if (entry15 && !entrySignal) entrySignal = entry15;
  if (exit15 && !exitSignal) exitSignal = exit15;
  
  // Strong trend overrides
  if (trendStrength >= 80) {
    if (trend === 'BULLISH') {
      signal = signal?.includes('SELL') ? 'NEUTRAL' : signal;
      confidence = 'Very High';
    } else if (trend === 'BEARISH') {
      signal = signal?.includes('BUY') ? 'NEUTRAL' : signal;
      confidence = 'Very High';
    }
  }
  
  return { signal, confidence, entrySignal, exitSignal };
}

/**
 * Get all stocks data with caching - PARALLEL FETCHING
 */
async function getAllStocksData() {
  const cacheKey = "psx_intraday_all";
  const cached = cache.get(cacheKey);
  
  if (cached) {
    console.log(`✅ Returning cached intraday data (${cached.length} symbols)`);
    // Debug: Check if confidence exists in cached data
    const sampleWithConfidence = cached.find(s => s.confidence && s.confidence.score);
    console.log(`📊 Sample confidence in cache: ${sampleWithConfidence ? 'YES' : 'NO'}`);
    return cached;
  }

  console.log(`🚀 Fetching intraday data for ${symbols.length} symbols in parallel...`);
  const startTime = Date.now();
  
  // Fetch all symbols in parallel with individual error handling
  const results = await Promise.allSettled(
    symbols.map(sym => processSymbolData(sym))
  );
  
  const processedResults = results.map((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      return result.value;
    } else {
      const errorMsg = result.reason?.message || 'Processing failed';
      console.error(`❌ Failed to process ${symbols[index]}:`, errorMsg);
      return {
        symbol: symbols[index],
        price: null,
        volume: null,
        signal: "ERROR",
        error: errorMsg,
        confidence: { score: 0, level: 'ERROR', action: 'AVOID' }
      };
    }
  });
  
  const validResults = processedResults.filter(r => !r.error && r.price);
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`✅ Successfully processed ${validResults.length}/${symbols.length} symbols in ${elapsedTime}s`);
  
  // Debug: Check if confidence was calculated
  const sampleWithConfidence = processedResults.find(s => s.confidence && s.confidence.score);
  console.log(`📊 Confidence calculated: ${sampleWithConfidence ? 'YES' : 'NO'}`);
  if (sampleWithConfidence) {
    console.log(`📊 Sample confidence score: ${sampleWithConfidence.confidence.score}`);
  }
  
  // Cache for 5 minutes (300 seconds)
  cache.set(cacheKey, processedResults, 300);
  return processedResults;
}

/**
 * Get single stock data with enhanced predictions
 */
async function getSingleStockData(sym) {
  const upperSymbol = sym.toUpperCase();
  
  if (!symbols.includes(upperSymbol)) {
    throw new Error(`Symbol ${upperSymbol} not found in configured symbols`);
  }
  
  const cacheKey = `psx_intraday_${upperSymbol}`;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    console.log(`✅ Returning cached intraday data for ${upperSymbol}`);
    return cached;
  }
  
  console.log(`🔄 Fetching fresh intraday data for ${upperSymbol}`);
  const result = await processSymbolData(upperSymbol);
  
  if (!result.error) {
    cache.set(cacheKey, result, 300);
  }
  
  return result;
}

/**
 * Get top opportunities based on confidence score
 */
/**
 * Get top opportunities based on confidence score
 */
async function getTopOpportunities(limit = 10) {
  const allStocks = await getAllStocksData();
  
  const opportunities = allStocks
    .filter(stock => {
      // Check if stock has valid data
      if (stock.error || !stock.price) return false;
      // Check if confidence exists and has a score
      if (!stock.confidence || typeof stock.confidence.score !== 'number') return false;
      return true;
    })
    .map(stock => ({
      symbol: stock.symbol,
      price: stock.price,
      changePercent: stock.changePercent || 0,
      signal: stock.signal || 'NEUTRAL',
      confidence: stock.confidence?.score || 0,
      confidenceLevel: stock.confidence?.level || 'MEDIUM',
      action: stock.confidence?.action || 'MONITOR',
      tradeRecommendation: stock.tradeRecommendation,
      riskReward: stock.riskLevels?.riskReward?.tp1,
      sessionAdvice: stock.sessionAdvice?.action
    }))
    .filter(opp => opp.confidence >= 50)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
  
  return opportunities;
}

/**
 * Get market summary with enhanced metrics
 */
async function getMarketSummary() {
  const allStocks = await getAllStocksData();
  const validStocks = allStocks.filter(s => !s.error && s.price);
  
  const summary = {
    totalStocks: allStocks.length,
    activeStocks: validStocks.length,
    gainers: validStocks.filter(s => s.changePercent > 0).length,
    losers: validStocks.filter(s => s.changePercent < 0).length,
    averageConfidence: validStocks.reduce((sum, s) => sum + (s.confidence?.score || 0), 0) / (validStocks.length || 1),
    
    topBuys: validStocks
      .filter(s => s.confidence?.action === 'BUY' || s.confidence?.action === 'STRONG_BUY')
      .sort((a, b) => (b.confidence?.score || 0) - (a.confidence?.score || 0))
      .slice(0, 5)
      .map(s => ({
        symbol: s.symbol,
        price: s.price,
        confidence: s.confidence?.score,
        signal: s.signal
      })),
      
    topSells: validStocks
      .filter(s => s.confidence?.action === 'SELL' || s.confidence?.action === 'STRONG_SELL')
      .sort((a, b) => (a.confidence?.score || 0) - (b.confidence?.score || 0))
      .slice(0, 5)
      .map(s => ({
        symbol: s.symbol,
        price: s.price,
        confidence: s.confidence?.score,
        signal: s.signal
      }))
  };
  
  return summary;
}

/**
 * Clear cache
 */
function clearCache() {
  cache.flushAll();
  console.log('🧹 Intraday cache cleared');
}

module.exports = {
  getAllStocksData,
  getSingleStockData,
  fetchSymbolTicks,
  clearCache,
  processSymbolData15Min,
  getTopOpportunities,
  getMarketSummary
};

