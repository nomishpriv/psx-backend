require('dotenv').config();
const express = require("express");
const cors = require("cors");
const cron = require('node-cron');

// Import routes
const psxRoutes = require("./routes/psxRoutes");
const stockRoutes = require("./routes/stockRoutes");

// Import new services
const confidenceService = require("./services/confidenceService");
const atrService = require("./services/atrService");
const sessionService = require("./services/sessionService");
const fibonacciService = require("./services/fibonacciService");
const supportResistanceService = require("./services/supportResistanceService");
const marketBreadthService = require("./services/marketBreadthService");
const correlationService = require("./services/correlationService");
const psxService = require("./services/psxService");

const app = express();
const PORT = process.env.PORT || 5000;

// Store latest market data in memory for real-time access
let latestMarketData = {
  stocks: [],
  timestamp: null,
  marketBreadth: null,
  alerts: []
};

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://blaspheme-scrawny-retaliate.ngrok-free.dev',
    'https://cheats-magnitude-max-winston.trycloudflare.com',
    'https://mediumblue-newt-871904.hostingersite.com',
    /^https:\/\/.*\.ngrok-free\.dev$/
  ],
  credentials: true
}));

// ============ FIX: Map non-prefixed routes to /api for Hostinger ============
app.use((req, res, next) => {
  // If request doesn't start with /api, rewrite it
  if (!req.path.startsWith('/api')) {
    req.url = '/api' + req.url
  }
  next()
})

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============ FUNCTION TO REFRESH MARKET DATA ============
async function refreshMarketData() {
  try {
    console.log('🔄 Refreshing market data...');
    const stocksData = await psxService.getAllStocksData();
    if (stocksData && stocksData.length > 0) {
      latestMarketData.stocks = stocksData;
      latestMarketData.timestamp = new Date().toISOString();
      console.log(`✅ Market data refreshed: ${stocksData.length} stocks`);
    }
  } catch (error) {
    console.error('❌ Failed to refresh market data:', error.message);
  }
}

// ============ NEW ENDPOINTS FOR PREDICTABLE TRADING ============

/**
 * GET /api/psx/enriched-stocks
 * Returns stocks with confidence scores, ATR levels, and session analysis
 */
app.get("/api/psx/enriched-stocks", async (req, res) => {
  try {
    // If no data in memory, fetch fresh data
    let stocks = latestMarketData.stocks;
    if (!stocks || stocks.length === 0) {
      console.log('No cached data, fetching fresh...');
      stocks = await psxService.getAllStocksData();
      if (stocks && stocks.length > 0) {
        latestMarketData.stocks = stocks;
      }
    }
    
    if (!stocks || stocks.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No stock data available"
      });
    }

    const enrichedStocks = stocks
      .filter(stock => !stock.error && stock.price)
      .map(stock => {
        const latestCandle = stock.candles?.[stock.candles.length - 1] || {};
        const currentPrice = stock.price;
        const atr = latestCandle.atr || 0;
        
        return {
          symbol: stock.symbol,
          price: currentPrice,
          changePercent: stock.changePercent || 0,
          signal: stock.signal || 'NEUTRAL',
          // Confidence score
          confidence: stock.confidence || confidenceService.calculateConfidence({
            symbol: stock.symbol,
            price: currentPrice,
            signal: stock.signal,
            rsi: latestCandle.rsi,
            macdTrend: latestCandle.macdTrend,
            volumeRatio: latestCandle.volumeRatio,
            bbPosition: latestCandle.bbPosition,
            bbSignal: latestCandle.bbSignal,
            stochSignal: latestCandle.stochSignal,
            vwapSignal: latestCandle.vwapSignal,
            adx: latestCandle.adx,
            ema9: latestCandle.ema9,
            ema20: latestCandle.ema20,
            vwap: latestCandle.vwap,
            pctFromEma9: latestCandle.pctFromEma9,
            pctFromEma20: latestCandle.pctFromEma20,
            pctFromVWAP: latestCandle.pctFromVWAP
          }),
          // ATR-based SL/TP
          riskLevels: atrService.calculateRiskLevels(currentPrice, atr),
          // Current session
          currentSession: sessionService.getCurrentSession(),
          sessionAdvice: sessionService.getTradingAdvice(),
          // Key indicators
          rsi: latestCandle.rsi,
          macdTrend: latestCandle.macdTrend,
          volumeRatio: latestCandle.volumeRatio,
          bbPosition: latestCandle.bbPosition,
          vwapSignal: latestCandle.vwapSignal,
          trend15Min: stock.trend15Min || 'NEUTRAL',
          trendStrength15Min: stock.trendStrength15Min || 0,
          entrySignal15Min: stock.entrySignal15Min,
          exitSignal15Min: stock.exitSignal15Min
        };
      });

    // Sort by confidence score (highest first)
    const sortedStocks = enrichedStocks.sort((a, b) => 
      (b.confidence?.score || 0) - (a.confidence?.score || 0)
    );

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: sessionService.getCurrentSession(),
      sessionAdvice: sessionService.getTradingAdvice(),
      totalStocks: sortedStocks.length,
      data: sortedStocks
    });
  } catch (error) {
    console.error("Error in /enriched-stocks:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/psx/top-opportunities
 * Returns top 10 trading opportunities based on confidence
 */
app.get("/api/psx/top-opportunities", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // If no data in memory, fetch fresh data
    let stocks = latestMarketData.stocks;
    if (!stocks || stocks.length === 0) {
      stocks = await psxService.getAllStocksData();
      if (stocks && stocks.length > 0) {
        latestMarketData.stocks = stocks;
      }
    }
    
    if (!stocks || stocks.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No stock data available"
      });
    }

    const opportunities = stocks
      .filter(stock => !stock.error && stock.price && stock.confidence)
      .map(stock => {
        const confidence = stock.confidence || { score: 0 };
        
        return {
          symbol: stock.symbol,
          price: stock.price,
          changePercent: stock.changePercent || 0,
          signal: stock.signal || 'NEUTRAL',
          confidence: confidence.score || 0,
          confidenceLevel: confidence.level || 'MEDIUM',
          action: confidence.action || 'MONITOR',
          tradeRecommendation: stock.tradeRecommendation,
          riskReward: stock.riskLevels?.riskReward?.tp1,
          sessionAdvice: stock.sessionAdvice?.action
        };
      })
      .filter(opp => opp.confidence >= 50)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: sessionService.getCurrentSession(),
      sessionAdvice: sessionService.getTradingAdvice(),
      count: opportunities.length,
      data: opportunities
    });
  } catch (error) {
    console.error("Error in /top-opportunities:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/psx/market-summary-enhanced
 * Returns enhanced market summary with confidence metrics
 */
app.get("/api/psx/market-summary-enhanced", async (req, res) => {
  try {
    const summary = await psxService.getMarketSummary();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: summary
    });
  } catch (error) {
    console.error("Error in /market-summary-enhanced:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/psx/market-breadth
 * Returns market breadth analysis
 */
app.get("/api/psx/market-breadth", async (req, res) => {
  try {
    let stocks = latestMarketData.stocks;
    if (!stocks || stocks.length === 0) {
      stocks = await psxService.getAllStocksData();
    }
    
    if (!stocks || stocks.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No stock data available"
      });
    }

    const breadth = marketBreadthService.calculate(stocks);
    latestMarketData.marketBreadth = breadth;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...breadth
    });
  } catch (error) {
    console.error("Error in /market-breadth:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/psx/alerts
 * Returns real-time trading alerts
 */
app.get("/api/psx/alerts", async (req, res) => {
  try {
    let stocks = latestMarketData.stocks;
    if (!stocks || stocks.length === 0) {
      stocks = await psxService.getAllStocksData();
    }
    
    if (!stocks || stocks.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No stock data available"
      });
    }

    const enrichedStocks = stocks.map(stock => {
      const latestCandle = stock.candles?.[stock.candles.length - 1] || {};
      return {
        symbol: stock.symbol,
        price: stock.price,
        ...latestCandle
      };
    });

    const alerts = confidenceService.generateAlerts(enrichedStocks);
    latestMarketData.alerts = alerts;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalAlerts: alerts.length,
      alerts
    });
  } catch (error) {
    console.error("Error in /alerts:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/psx/session-advice
 * Returns trading advice based on current session
 */
app.get("/api/psx/session-advice", async (req, res) => {
  try {
    const advice = sessionService.getDetailedAdvice();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...advice
    });
  } catch (error) {
    console.error("Error in /session-advice:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/psx/scan/bullish
 * Scan for bullish setups
 */
app.get("/api/psx/scan/bullish", async (req, res) => {
  try {
    let stocks = latestMarketData.stocks;
    if (!stocks || stocks.length === 0) {
      stocks = await psxService.getAllStocksData();
    }
    
    if (!stocks || stocks.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No stock data available"
      });
    }

    const bullishSetups = stocks
      .filter(stock => {
        if (stock.error || !stock.price) return false;
        const conditions = {
          priceAboveEMA20: stock.pctFromEma20 > 0,
          priceAboveVWAP: stock.vwapSignal === 'Bullish',
          rsiBullish: stock.rsi > 40 && stock.rsi < 70,
          macdBullish: stock.macdTrend === 'Bullish',
          volumeConfirmed: stock.volumeRatio > 120,
          trendBullish: stock.trend15Min === 'BULLISH' || stock.trend15Min === 'SLIGHTLY_BULLISH'
        };
        const bullishScore = Object.values(conditions).filter(Boolean).length;
        return bullishScore >= 3;
      })
      .map(stock => ({
        symbol: stock.symbol,
        price: stock.price,
        changePercent: stock.changePercent,
        confidence: stock.confidence?.score,
        signal: stock.signal,
        setup: 'BULLISH'
      }));

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: bullishSetups.length,
      data: bullishSetups
    });
  } catch (error) {
    console.error("Error in /scan/bullish:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ============ EXISTING ROUTES ============

// Routes
app.use("/api/psx", psxRoutes);
app.use("/api/stock", stockRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      confidence: confidenceService.isAvailable(),
      atr: atrService.isAvailable(),
      session: sessionService.isAvailable(),
      fibonacci: fibonacciService.isAvailable(),
      supportResistance: supportResistanceService.isAvailable(),
      marketBreadth: marketBreadthService.isAvailable(),
      correlation: correlationService.isAvailable()
    }
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "PSX Stock Data API",
    version: "2.0.0",
    endpoints: {
      intraday: "/api/psx/stocks",
      enriched: "/api/psx/enriched-stocks",
      topOpportunities: "/api/psx/top-opportunities",
      marketSummaryEnhanced: "/api/psx/market-summary-enhanced",
      marketBreadth: "/api/psx/market-breadth",
      alerts: "/api/psx/alerts",
      sessionAdvice: "/api/psx/session-advice",
      scanBullish: "/api/psx/scan/bullish",
      companies: "/api/stock/companies",
      health: "/api/health"
    }
  });
});

// Refresh market data on startup
refreshMarketData();

// Refresh market data every 5 minutes
setInterval(refreshMarketData, 5 * 60 * 1000);

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.path
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    PSX Stock Data API Server v2.0            ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                      ║
║  Health check: http://localhost:${PORT}/api/health                ║
║                                                                ║
║  🚀 New Features:                                              ║
║  - Confidence Scores (0-100)                                  ║
║  - ATR-based Stop Loss & Take Profit                          ║
║  - Session-based Trading Advice                               ║
║  - Fibonacci Retracement Levels                               ║
║  - Support/Resistance Detection                               ║
║  - Market Breadth Analysis                                    ║
║  - Stock Correlation Matrix                                   ║
║  - Real-time Trading Alerts                                   ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;