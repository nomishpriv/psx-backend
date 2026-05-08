const express = require("express");
const router = express.Router();
const psxController = require("../controllers/psxController");
const psxService = require("../services/psxService");
const newsService = require("../services/newsService");
const geopoliticalService = require("../services/geopoliticalService");
const volumeAnalysisService = require("../services/volumeAnalysisService");
const kseVolumeService = require("../services/kseVolumeService");

// GET /api/psx/analysis/:symbol — Full analysis for one stock
router.get("/analysis/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    
    // Fetch all data in parallel
    const [stockData, newsData, volumeData] = await Promise.all([
      psxService.getSingleStockData(symbol),
      newsService.getNewsForStock(symbol, require("../config/symbols").sectors[symbol] || "General"),
      (async () => {
        try {
          const stock = await psxService.getSingleStockData(symbol);
          return volumeAnalysisService.analyzeStockVolume(stock);
        } catch { return null; }
      })()
    ]);

    if (!stockData || stockData.error) {
      return res.status(404).json({ success: false, error: "Stock not found" });
    }

    res.json({
      success: true,
      symbol,
      stock: stockData,
      news: newsData,
      volume: volumeData,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/psx/kse100/volume — KSE-100 volume analysis
router.get("/kse100/volume", async (req, res) => {
  try {
    const analysis = await kseVolumeService.getKSE100VolumeAnalysis();
    res.json({ success: true, ...analysis });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/psx/volume/stock/:symbol — Volume analysis for a stock
router.get("/volume/stock/:symbol", async (req, res) => {
  try {
    const stock = await psxService.getSingleStockData(req.params.symbol.toUpperCase());
    if (!stock || stock.error) return res.status(404).json({ success: false, error: "Stock not found" });
    const analysis = volumeAnalysisService.analyzeStockVolume(stock);
    res.json({ success: true, symbol: req.params.symbol.toUpperCase(), ...analysis });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/psx/volume/market — KSE-100 market volume analysis
router.get("/volume/market", async (req, res) => {
  try {
    const stocks = await psxService.getAllStocksData();
    const analysis = volumeAnalysisService.analyzeMarketVolume(stocks);
    res.json({ success: true, ...analysis });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// GET /api/psx/geopolitical — Geopolitical & market sentiment
router.get("/geopolitical", async (req, res) => {
  try {
    const result = await geopoliticalService.getGeopoliticalSentiment();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// GET /api/psx/news/:symbol - Get news for a stock
router.get("/news/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const sector = require("../config/symbols").sectors[symbol] || "General";
    const result = await newsService.getNewsForStock(symbol.toUpperCase(), sector);
    res.json({ success: true, symbol, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/psx/news - Get market news
router.get("/news", async (req, res) => {
  try {
    const result = await newsService.getMarketNews();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/psx/scan/confirmed-buys — Multi-confirmation buy signals
router.get("/scan/confirmed-buys", async (req, res) => {
  try {
    const stocks = await psxService.getAllStocksData();
    
    const confirmed = stocks.filter(s => {
      if (!s.price) return false;
      
      // ALL conditions must be true
      const volumeOk = s.volumeRatio > 120;
      const trendOk = s.trend15Min === 'BULLISH' || s.trend15Min === 'SLIGHTLY_BULLISH';
      const signalOk = s.signal?.includes('BUY');
      const vwapOk = s.vwapSignal === 'Bullish';
      const confidenceOk = s.confidence?.score >= 55;
      const rsiOk = s.rsi > 40 && s.rsi < 70; // Not overbought
      
      const confirmations = [volumeOk, trendOk, signalOk, vwapOk, confidenceOk, rsiOk];
      const count = confirmations.filter(Boolean).length;
      
      return count >= 4; // At least 4 out of 6 confirm
    }).map(s => ({
      symbol: s.symbol,
      price: s.price,
      changePercent: s.changePercent,
      volumeRatio: s.volumeRatio,
      trend15Min: s.trend15Min,
      signal: s.signal,
      confidence: s.confidence?.score,
      confirmations: {
        volume: s.volumeRatio > 120,
        trend: s.trend15Min === 'BULLISH' || s.trend15Min === 'SLIGHTLY_BULLISH',
        signal: s.signal?.includes('BUY'),
        vwap: s.vwapSignal === 'Bullish',
        confidence: s.confidence?.score >= 55,
        rsi: s.rsi > 40 && s.rsi < 70
      }
    })).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    res.json({
      success: true,
      count: confirmed.length,
      message: confirmed.length > 0 ? 'Confirmed buy setups found' : 'No confirmed setups — wait',
      data: confirmed
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============ EXISTING ROUTES ============



// GET /api/psx/stocks - Get all stocks with intraday data
router.get("/stocks", psxController.getAllStocks);

// GET /api/psx/stocks/:symbol - Get single stock intraday data
router.get("/stocks/:symbol", psxController.getSingleStock);

// GET /api/psx/market/overview - Get market overview
router.get("/market/overview", psxController.getMarketOverview);

// ============ NEW PREDICTABLE TRADING ROUTES ============

// GET /api/psx/enriched-stocks - Get stocks with confidence scores, risk levels, session analysis
router.get("/enriched-stocks", psxController.getEnrichedStocks);

// GET /api/psx/top-opportunities - Get top 10 trading opportunities based on confidence
router.get("/top-opportunities", psxController.getTopOpportunities);

// GET /api/psx/market-summary-enhanced - Get enhanced market summary with confidence metrics
router.get("/market-summary-enhanced", psxController.getMarketSummaryEnhanced);

// GET /api/psx/stock/:symbol/risk - Get risk levels (SL/TP) for a specific stock
router.get("/stock/:symbol/risk", psxController.getStockRiskLevels);

// GET /api/psx/stock/:symbol/fibonacci - Get Fibonacci levels for a specific stock
router.get("/stock/:symbol/fibonacci", psxController.getStockFibonacci);

// GET /api/psx/stock/:symbol/support-resistance - Get support/resistance levels
router.get("/stock/:symbol/support-resistance", psxController.getStockSupportResistance);

// GET /api/psx/stock/:symbol/session - Get session advice for a specific stock
router.get("/stock/:symbol/session", psxController.getStockSessionAdvice);

// ============ SCAN ROUTES ============

// GET /api/psx/scan/bullish - Scan for bullish setups
router.get("/scan/bullish", psxController.scanBullish);

// GET /api/psx/scan/bearish - Scan for bearish setups
router.get("/scan/bearish", psxController.scanBearish);

// GET /api/psx/scan/oversold - Scan for oversold bounce candidates
router.get("/scan/oversold", psxController.scanOversold);

// GET /api/psx/scan/overbought - Scan for overbought pullback candidates
router.get("/scan/overbought", psxController.scanOverbought);

// ============ CACHE MANAGEMENT ============

// POST /api/psx/cache/clear - Clear all cached data
router.post("/cache/clear", psxController.clearCache);

// GET /api/psx/debug/volume/:symbol — Raw volume data from PSX
router.get("/debug/volume/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    
    // Get raw tick data
    const rawTicks = await psxService.fetchSymbolTicks(symbol);
    
    // Get processed stock data
    const processedStock = await psxService.getSingleStockData(symbol);
    
    const volumeData = {
      symbol,
      totalTicks: rawTicks.length,
      rawTickSample: {
        first: rawTicks.slice(0, 3),
        last: rawTicks.slice(-3),
      },
      processed: {
        volume: processedStock.volume,
        volumeAvg: processedStock.volumeAvg,
        volumeRatio: processedStock.volumeRatio,
        volumeSignal: processedStock.volumeSignal,
        dayVolume: processedStock.dayVolume || null,
      },
      availableFields: {
        volume: processedStock.volume != null,
        volumeAvg: processedStock.volumeAvg != null,
        volumeRatio: processedStock.volumeRatio != null,
        volumeSignal: processedStock.volumeSignal != null,
        dayVolume: processedStock.dayVolume != null,
      }
    };
    
    res.json({ success: true, ...volumeData });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;