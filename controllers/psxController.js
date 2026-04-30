const psxService = require("../services/psxService");
const newsAnalysisService = require("../services/newsAnalysisService");

// ============ GET ALL STOCKS ============
async function getAllStocks(req, res) {
  try {
    const data = await psxService.getAllStocksData();
    const valid = data.filter(s => s.price !== null);
    const avgChange = valid.length ? valid.reduce((sum, s) => sum + (s.changePercent || 0), 0) / valid.length : 0;

    res.json({
      success: true, timestamp: new Date().toISOString(),
      marketSummary: { totalStocks: data.length, activeStocks: valid.length, averageChange: avgChange },
      data
    });
  } catch (error) {
    console.error("getAllStocks:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ GET SINGLE STOCK ============
async function getSingleStock(req, res) {
  try {
    const data = await psxService.getSingleStockData(req.params.symbol.toUpperCase());
    res.json({ success: true, timestamp: new Date().toISOString(), data });
  } catch (error) {
    console.error("getSingleStock:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ MARKET OVERVIEW ============
async function getMarketOverview(req, res) {
  try {
    const all = await psxService.getAllStocksData();
    const valid = all.filter(s => s.price);
    res.json({
      success: true, timestamp: new Date().toISOString(),
      data: {
        totalVolume: valid.reduce((sum, s) => sum + (s.volume || 0), 0),
        gainers: valid.filter(s => s.change > 0).length,
        losers: valid.filter(s => s.change < 0).length,
        unchanged: valid.filter(s => s.change === 0).length,
        topGainers: valid.sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0)).slice(0, 5).map(s => ({ symbol: s.symbol, change: s.changePercent })),
        topLosers: valid.sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0)).slice(0, 5).map(s => ({ symbol: s.symbol, change: s.changePercent })),
        mostActive: valid.sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 5).map(s => ({ symbol: s.symbol, volume: s.volume }))
      }
    });
  } catch (error) {
    console.error("getMarketOverview:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ ENRICHED STOCKS ============
async function getEnrichedStocks(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    if (!stocks?.length) return res.status(404).json({ success: false, error: "No data" });

    const enriched = stocks.filter(s => s.price).map(s => ({
      symbol: s.symbol, price: s.price, changePercent: s.changePercent || 0,
      volume: s.volume || 0, signal: s.signal || 'NEUTRAL', signalConfidence: s.signalConfidence || 'Medium',
      confidence: s.confidence || { score: 50, level: 'MEDIUM', action: 'MONITOR' },
      riskLevels: s.riskLevels, tradeRecommendation: s.tradeRecommendation,
      currentSession: s.currentSession, sessionAdvice: s.sessionAdvice,
      rsi: s.rsi, macdTrend: s.macdTrend, volumeRatio: s.volumeRatio,
      bbPosition: s.bbPosition, vwapSignal: s.vwapSignal,
      trend15Min: s.trend15Min, trendStrength15Min: s.trendStrength15Min,
      entrySignal15Min: s.entrySignal15Min, exitSignal15Min: s.exitSignal15Min,
      entrySignal: s.entrySignal, exitSignal: s.exitSignal,
      positionSize: s.positionSize, trailingStop: s.trailingStop,
      newsImpact: s.newsImpact || null
    })).sort((a, b) => (b.confidence?.score || 0) - (a.confidence?.score || 0));

    res.json({ success: true, timestamp: new Date().toISOString(), totalStocks: enriched.length, data: enriched });
  } catch (error) {
    console.error("getEnrichedStocks:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ TOP OPPORTUNITIES ============
async function getTopOpportunities(req, res) {
  try {
    const opportunities = await psxService.getTopOpportunities(parseInt(req.query.limit) || 10);
    res.json({ success: true, timestamp: new Date().toISOString(), count: opportunities.length, data: opportunities });
  } catch (error) {
    console.error("getTopOpportunities:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ MARKET SUMMARY ENHANCED ============
async function getMarketSummaryEnhanced(req, res) {
  try {
    const summary = await psxService.getMarketSummary();
    res.json({ success: true, timestamp: new Date().toISOString(), data: summary });
  } catch (error) {
    console.error("getMarketSummaryEnhanced:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ STOCK RISK LEVELS ============
async function getStockRiskLevels(req, res) {
  try {
    const stock = await psxService.getSingleStockData(req.params.symbol.toUpperCase());
    if (stock.error || !stock.price) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, symbol: stock.symbol, price: stock.price, riskLevels: stock.riskLevels, positionSize: stock.positionSize, trailingStop: stock.trailingStop, tradeRecommendation: stock.tradeRecommendation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ STOCK FIBONACCI ============
async function getStockFibonacci(req, res) {
  try {
    const stock = await psxService.getSingleStockData(req.params.symbol.toUpperCase());
    if (stock.error || !stock.price) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, symbol: stock.symbol, price: stock.price, fibonacci: stock.fibonacci });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ STOCK SUPPORT/RESISTANCE ============
async function getStockSupportResistance(req, res) {
  try {
    const stock = await psxService.getSingleStockData(req.params.symbol.toUpperCase());
    if (stock.error || !stock.price) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, symbol: stock.symbol, price: stock.price, supportResistance: stock.supportResistance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ STOCK SESSION ============
async function getStockSessionAdvice(req, res) {
  try {
    const stock = await psxService.getSingleStockData(req.params.symbol.toUpperCase());
    if (stock.error || !stock.price) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, symbol: stock.symbol, currentSession: stock.currentSession, sessionAdvice: stock.sessionAdvice, tradeRecommendation: stock.tradeRecommendation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ NEWS ============
async function getStockNews(req, res) {
  try {
    const { symbol } = req.params;
    const headlines = await psxService.fetchNewsForSymbol(symbol.toUpperCase());
    let analysis = null;
    if (headlines.length) {
      analysis = await newsAnalysisService.analyzeNewsForStock(symbol.toUpperCase(), headlines);
    }
    res.json({ success: true, symbol: symbol.toUpperCase(), headlines, analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getGeneralNews(req, res) {
  try {
    const news = await psxService.analyzeGeneralNewsImpact();
    res.json({ success: true, count: news.length, data: news });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ SCAN BULLISH ============
async function scanBullish(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    const bullish = stocks.filter(s => {
      if (s.error || !s.price) return false;
      const c = {
        aboveEMA20: s.pctFromEma20 > 0, aboveVWAP: s.vwapSignal === 'Bullish',
        rsiOk: s.rsi > 40 && s.rsi < 70, macdBullish: s.macdTrend === 'Bullish',
        volumeOk: s.volumeRatio > 120, trendOk: s.trend15Min === 'BULLISH' || s.trend15Min === 'SLIGHTLY_BULLISH',
        confidenceOk: s.confidence?.score >= 60
      };
      return Object.values(c).filter(Boolean).length >= 4;
    }).map(s => ({
      symbol: s.symbol, price: s.price, changePercent: s.changePercent,
      confidence: s.confidence?.score, signal: s.signal, trend15Min: s.trend15Min,
      entrySignal: s.entrySignal, newsImpact: s.newsImpact?.sentiment,
      conditions: { aboveEMA20: s.pctFromEma20 > 0, aboveVWAP: s.vwapSignal === 'Bullish', rsiOk: s.rsi > 40 && s.rsi < 70, macdBullish: s.macdTrend === 'Bullish', volumeOk: s.volumeRatio > 120, trendOk: s.trend15Min === 'BULLISH' || s.trend15Min === 'SLIGHTLY_BULLISH' }
    })).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    res.json({ success: true, timestamp: new Date().toISOString(), count: bullish.length, data: bullish });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ SCAN BEARISH ============
async function scanBearish(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    const bearish = stocks.filter(s => {
      if (s.error || !s.price) return false;
      const c = {
        belowEMA20: s.pctFromEma20 < 0, belowVWAP: s.vwapSignal === 'Bearish',
        rsiOk: s.rsi > 30 && s.rsi < 60, macdBearish: s.macdTrend === 'Bearish',
        volumeOk: s.volumeRatio > 120, trendOk: s.trend15Min === 'BEARISH' || s.trend15Min === 'SLIGHTLY_BEARISH',
        confidenceOk: s.confidence?.score >= 60
      };
      return Object.values(c).filter(Boolean).length >= 4;
    }).map(s => ({
      symbol: s.symbol, price: s.price, changePercent: s.changePercent,
      confidence: s.confidence?.score, signal: s.signal, trend15Min: s.trend15Min,
      exitSignal: s.exitSignal, newsImpact: s.newsImpact?.sentiment,
      conditions: { belowEMA20: s.pctFromEma20 < 0, belowVWAP: s.vwapSignal === 'Bearish', rsiOk: s.rsi > 30 && s.rsi < 60, macdBearish: s.macdTrend === 'Bearish', volumeOk: s.volumeRatio > 120, trendOk: s.trend15Min === 'BEARISH' || s.trend15Min === 'SLIGHTLY_BEARISH' }
    })).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    res.json({ success: true, timestamp: new Date().toISOString(), count: bearish.length, data: bearish });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ SCAN OVERSOLD ============
async function scanOversold(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    const oversold = stocks.filter(s => !s.error && s.price && (s.rsi < 35 || s.bbPosition < 25) && s.volumeRatio > 120 && s.trend15Min !== 'BEARISH')
      .map(s => ({ symbol: s.symbol, price: s.price, changePercent: s.changePercent, rsi: s.rsi, bbPosition: s.bbPosition, volumeRatio: s.volumeRatio, confidence: s.confidence?.score, entrySignal: s.entrySignal15Min || "Oversold bounce", newsImpact: s.newsImpact?.sentiment }))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    res.json({ success: true, timestamp: new Date().toISOString(), count: oversold.length, data: oversold });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ SCAN OVERBOUGHT ============
async function scanOverbought(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    const overbought = stocks.filter(s => !s.error && s.price && (s.rsi > 65 || s.bbPosition > 75) && s.volumeRatio > 120 && s.trend15Min !== 'BULLISH')
      .map(s => ({ symbol: s.symbol, price: s.price, changePercent: s.changePercent, rsi: s.rsi, bbPosition: s.bbPosition, volumeRatio: s.volumeRatio, confidence: s.confidence?.score, exitSignal: s.exitSignal15Min || "Overbought pullback", newsImpact: s.newsImpact?.sentiment }))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    res.json({ success: true, timestamp: new Date().toISOString(), count: overbought.length, data: overbought });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============ CLEAR CACHE ============
async function clearCache(req, res) {
  try {
    psxService.clearCache();
    res.json({ success: true, message: "Cache cleared", timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAllStocks, getSingleStock, getMarketOverview,
  getEnrichedStocks, getTopOpportunities, getMarketSummaryEnhanced,
  getStockRiskLevels, getStockFibonacci, getStockSupportResistance, getStockSessionAdvice,
  getStockNews, getGeneralNews,
  scanBullish, scanBearish, scanOversold, scanOverbought,
  clearCache
};