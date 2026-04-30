const express = require("express");
const router = express.Router();
const psxController = require("../controllers/psxController");

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

module.exports = router;