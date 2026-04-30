const psxService = require("../services/psxService");

/**
 * Get all stocks with intraday data and indicators
 */
async function getAllStocks(req, res) {
  try {
    const data = await psxService.getAllStocksData();
    
    // Calculate market summary
    const validStocks = data.filter(s => s.price !== null);
    const avgChange = validStocks.length > 0
      ? validStocks.reduce((sum, s) => sum + (s.changePercent || 0), 0) / validStocks.length
      : 0;
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      marketSummary: {
        totalStocks: data.length,
        activeStocks: validStocks.length,
        averageChange: avgChange,
      },
      data: data
    });
  } catch (error) {
    console.error("Error in getAllStocks:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch stocks data",
      message: error.message
    });
  }
}

/**
 * Get single stock intraday data
 */
async function getSingleStock(req, res) {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: "Symbol parameter is required"
      });
    }
    
    const data = await psxService.getSingleStockData(symbol.toUpperCase());
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: data
    });
  } catch (error) {
    console.error(`Error in getSingleStock for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch stock data",
      message: error.message
    });
  }
}

/**
 * Get market overview
 */
async function getMarketOverview(req, res) {
  try {
    const allData = await psxService.getAllStocksData();
    
    const validStocks = allData.filter(s => s.price !== null);
    
    const overview = {
      totalVolume: validStocks.reduce((sum, s) => sum + (s.volume || 0), 0),
      gainers: validStocks.filter(s => s.change > 0).length,
      losers: validStocks.filter(s => s.change < 0).length,
      unchanged: validStocks.filter(s => s.change === 0).length,
      topGainers: validStocks
        .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
        .slice(0, 5)
        .map(s => ({ symbol: s.symbol, change: s.changePercent })),
      topLosers: validStocks
        .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
        .slice(0, 5)
        .map(s => ({ symbol: s.symbol, change: s.changePercent })),
      mostActive: validStocks
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 5)
        .map(s => ({ symbol: s.symbol, volume: s.volume })),
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: overview
    });
  } catch (error) {
    console.error("Error in getMarketOverview:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch market overview"
    });
  }
}

// ============ NEW ENDPOINTS FOR PREDICTABLE TRADING ============

/**
 * GET /api/psx/enriched-stocks
 * Get stocks with confidence scores, risk levels, and session analysis
 */
/**
 * GET /api/psx/enriched-stocks
 * Get stocks with confidence scores, risk levels, and session analysis
 */
async function getEnrichedStocks(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    
    // Check if stocks data is valid
    if (!stocks || stocks.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No stock data available"
      });
    }
    
    const enrichedStocks = stocks
      .filter(stock => !stock.error && stock.price)
      .map(stock => ({
        symbol: stock.symbol,
        price: stock.price,
        changePercent: stock.changePercent || 0,
        volume: stock.volume || 0,
        signal: stock.signal || 'NEUTRAL',
        signalConfidence: stock.signalConfidence || 'Medium',
        
        // Confidence Score
        confidence: stock.confidence || { score: 50, level: 'MEDIUM', action: 'MONITOR' },
        
        // Risk Management
        riskLevels: stock.riskLevels || null,
        
        // Trade Recommendation
        tradeRecommendation: stock.tradeRecommendation || null,
        
        // Current Session
        currentSession: stock.currentSession || null,
        sessionAdvice: stock.sessionAdvice || null,
        
        // Key Indicators
        rsi: stock.rsi || null,
        macdTrend: stock.macdTrend || null,
        volumeRatio: stock.volumeRatio || 100,
        bbPosition: stock.bbPosition || null,
        vwapSignal: stock.vwapSignal || null,
        
        // 15-Min Trend
        trend15Min: stock.trend15Min || 'NEUTRAL',
        trendStrength15Min: stock.trendStrength15Min || 0,
        entrySignal15Min: stock.entrySignal15Min || null,
        exitSignal15Min: stock.exitSignal15Min || null,
        
        // Combined Signal
        entrySignal: stock.entrySignal || null,
        exitSignal: stock.exitSignal || null,
        
        // Position Sizing
        positionSize: stock.positionSize || null,
        
        // Trailing Stop
        trailingStop: stock.trailingStop || null
      }));
    
    // Sort by confidence score (highest first)
    const sortedStocks = enrichedStocks.sort((a, b) => 
      (b.confidence?.score || 0) - (a.confidence?.score || 0)
    );
    
    // Get current session info
    const session = {
      label: "Trading Session",
      isMarketHours: true,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: session,
      totalStocks: sortedStocks.length,
      data: sortedStocks
    });
  } catch (error) {
    console.error("Error in getEnrichedStocks:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/top-opportunities
 * Get top 10 trading opportunities based on confidence
 */
async function getTopOpportunities(req, res) {
  try {
    const { limit = 10 } = req.query;
    const opportunities = await psxService.getTopOpportunities(parseInt(limit));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: opportunities.length,
      data: opportunities
    });
  } catch (error) {
    console.error("Error in getTopOpportunities:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/market-summary-enhanced
 * Get enhanced market summary with confidence metrics
 */
async function getMarketSummaryEnhanced(req, res) {
  try {
    const summary = await psxService.getMarketSummary();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: summary
    });
  } catch (error) {
    console.error("Error in getMarketSummaryEnhanced:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/stock/:symbol/risk
 * Get risk levels for a specific stock
 */
async function getStockRiskLevels(req, res) {
  try {
    const { symbol } = req.params;
    const stock = await psxService.getSingleStockData(symbol.toUpperCase());
    
    if (stock.error || !stock.price) {
      return res.status(404).json({
        success: false,
        error: "Stock not found or no data available"
      });
    }
    
    res.json({
      success: true,
      symbol: stock.symbol,
      price: stock.price,
      riskLevels: stock.riskLevels,
      positionSize: stock.positionSize,
      trailingStop: stock.trailingStop,
      tradeRecommendation: stock.tradeRecommendation
    });
  } catch (error) {
    console.error(`Error in getStockRiskLevels for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/stock/:symbol/fibonacci
 * Get Fibonacci levels for a specific stock
 */
async function getStockFibonacci(req, res) {
  try {
    const { symbol } = req.params;
    const stock = await psxService.getSingleStockData(symbol.toUpperCase());
    
    if (stock.error || !stock.price) {
      return res.status(404).json({
        success: false,
        error: "Stock not found or no data available"
      });
    }
    
    res.json({
      success: true,
      symbol: stock.symbol,
      price: stock.price,
      fibonacci: stock.fibonacci
    });
  } catch (error) {
    console.error(`Error in getStockFibonacci for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/stock/:symbol/support-resistance
 * Get support and resistance levels for a specific stock
 */
async function getStockSupportResistance(req, res) {
  try {
    const { symbol } = req.params;
    const stock = await psxService.getSingleStockData(symbol.toUpperCase());
    
    if (stock.error || !stock.price) {
      return res.status(404).json({
        success: false,
        error: "Stock not found or no data available"
      });
    }
    
    res.json({
      success: true,
      symbol: stock.symbol,
      price: stock.price,
      supportResistance: stock.supportResistance
    });
  } catch (error) {
    console.error(`Error in getStockSupportResistance for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/stock/:symbol/session
 * Get session advice for a specific stock
 */
async function getStockSessionAdvice(req, res) {
  try {
    const { symbol } = req.params;
    const stock = await psxService.getSingleStockData(symbol.toUpperCase());
    
    if (stock.error || !stock.price) {
      return res.status(404).json({
        success: false,
        error: "Stock not found or no data available"
      });
    }
    
    res.json({
      success: true,
      symbol: stock.symbol,
      currentSession: stock.currentSession,
      sessionAdvice: stock.sessionAdvice,
      tradeRecommendation: stock.tradeRecommendation
    });
  } catch (error) {
    console.error(`Error in getStockSessionAdvice for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/scan/bullish
 * Scan for bullish setups
 */
async function scanBullish(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    
    const bullishSetups = stocks.filter(stock => {
      if (stock.error || !stock.price) return false;
      
      const conditions = {
        priceAboveEMA20: stock.pctFromEma20 > 0,
        priceAboveVWAP: stock.vwapSignal === 'Bullish',
        rsiBullish: stock.rsi > 40 && stock.rsi < 70,
        macdBullish: stock.macdTrend === 'Bullish',
        volumeConfirmed: stock.volumeRatio > 120,
        trendBullish: stock.trend15Min === 'BULLISH' || stock.trend15Min === 'SLIGHTLY_BULLISH',
        confidenceHigh: stock.confidence?.score >= 60
      };
      
      const bullishScore = Object.values(conditions).filter(Boolean).length;
      
      return bullishScore >= 4;
    }).map(stock => ({
      symbol: stock.symbol,
      price: stock.price,
      changePercent: stock.changePercent,
      confidence: stock.confidence?.score,
      signal: stock.signal,
      trend15Min: stock.trend15Min,
      entrySignal: stock.entrySignal,
      conditions: {
        priceAboveEMA20: stock.pctFromEma20 > 0,
        priceAboveVWAP: stock.vwapSignal === 'Bullish',
        rsiBullish: stock.rsi > 40 && stock.rsi < 70,
        macdBullish: stock.macdTrend === 'Bullish',
        volumeConfirmed: stock.volumeRatio > 120,
        trendBullish: stock.trend15Min === 'BULLISH' || stock.trend15Min === 'SLIGHTLY_BULLISH'
      }
    }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: bullishSetups.length,
      data: bullishSetups.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    });
  } catch (error) {
    console.error("Error in scanBullish:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/scan/bearish
 * Scan for bearish setups
 */
async function scanBearish(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    
    const bearishSetups = stocks.filter(stock => {
      if (stock.error || !stock.price) return false;
      
      const conditions = {
        priceBelowEMA20: stock.pctFromEma20 < 0,
        priceBelowVWAP: stock.vwapSignal === 'Bearish',
        rsiBearish: stock.rsi > 30 && stock.rsi < 60,
        macdBearish: stock.macdTrend === 'Bearish',
        volumeConfirmed: stock.volumeRatio > 120,
        trendBearish: stock.trend15Min === 'BEARISH' || stock.trend15Min === 'SLIGHTLY_BEARISH',
        confidenceHigh: stock.confidence?.score >= 60
      };
      
      const bearishScore = Object.values(conditions).filter(Boolean).length;
      
      return bearishScore >= 4;
    }).map(stock => ({
      symbol: stock.symbol,
      price: stock.price,
      changePercent: stock.changePercent,
      confidence: stock.confidence?.score,
      signal: stock.signal,
      trend15Min: stock.trend15Min,
      exitSignal: stock.exitSignal,
      conditions: {
        priceBelowEMA20: stock.pctFromEma20 < 0,
        priceBelowVWAP: stock.vwapSignal === 'Bearish',
        rsiBearish: stock.rsi > 30 && stock.rsi < 60,
        macdBearish: stock.macdTrend === 'Bearish',
        volumeConfirmed: stock.volumeRatio > 120,
        trendBearish: stock.trend15Min === 'BEARISH' || stock.trend15Min === 'SLIGHTLY_BEARISH'
      }
    }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: bearishSetups.length,
      data: bearishSetups.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    });
  } catch (error) {
    console.error("Error in scanBearish:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/scan/oversold
 * Scan for oversold bounce candidates
 */
async function scanOversold(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    
    const oversoldSetups = stocks.filter(stock => {
      if (stock.error || !stock.price) return false;
      
      return (stock.rsi < 35 || stock.bbPosition < 25) && 
             stock.volumeRatio > 120 &&
             stock.trend15Min !== 'BEARISH';
    }).map(stock => ({
      symbol: stock.symbol,
      price: stock.price,
      changePercent: stock.changePercent,
      rsi: stock.rsi,
      bbPosition: stock.bbPosition,
      volumeRatio: stock.volumeRatio,
      confidence: stock.confidence?.score,
      entrySignal: stock.entrySignal15Min || "Oversold bounce potential"
    }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: oversoldSetups.length,
      data: oversoldSetups.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    });
  } catch (error) {
    console.error("Error in scanOversold:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/psx/scan/overbought
 * Scan for overbought pullback candidates
 */
async function scanOverbought(req, res) {
  try {
    const stocks = await psxService.getAllStocksData();
    
    const overboughtSetups = stocks.filter(stock => {
      if (stock.error || !stock.price) return false;
      
      return (stock.rsi > 65 || stock.bbPosition > 75) && 
             stock.volumeRatio > 120 &&
             stock.trend15Min !== 'BULLISH';
    }).map(stock => ({
      symbol: stock.symbol,
      price: stock.price,
      changePercent: stock.changePercent,
      rsi: stock.rsi,
      bbPosition: stock.bbPosition,
      volumeRatio: stock.volumeRatio,
      confidence: stock.confidence?.score,
      exitSignal: stock.exitSignal15Min || "Overbought - pullback expected"
    }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: overboughtSetups.length,
      data: overboughtSetups.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    });
  } catch (error) {
    console.error("Error in scanOverbought:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/psx/cache/clear
 * Clear all cached data
 */
async function clearCache(req, res) {
  try {
    psxService.clearCache();
    res.json({
      success: true,
      message: "Cache cleared successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in clearCache:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  // Existing
  getAllStocks,
  getSingleStock,
  getMarketOverview,
  
  // New endpoints
  getEnrichedStocks,
  getTopOpportunities,
  getMarketSummaryEnhanced,
  getStockRiskLevels,
  getStockFibonacci,
  getStockSupportResistance,
  getStockSessionAdvice,
  scanBullish,
  scanBearish,
  scanOversold,
  scanOverbought,
  clearCache
};