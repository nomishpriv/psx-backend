const express = require("express");
const router = express.Router();
const psxController = require("../controllers/psxController");

// ============ STOCKS ============
router.get("/stocks", psxController.getAllStocks);
router.get("/stocks/:symbol", psxController.getSingleStock);

// ============ MARKET ============
router.get("/market/overview", psxController.getMarketOverview);
router.get("/market-summary-enhanced", psxController.getMarketSummaryEnhanced);

// ============ ENRICHED & OPPORTUNITIES ============
router.get("/enriched-stocks", psxController.getEnrichedStocks);
router.get("/top-opportunities", psxController.getTopOpportunities);

// ============ STOCK-SPECIFIC ============
router.get("/stock/:symbol/risk", psxController.getStockRiskLevels);
router.get("/stock/:symbol/fibonacci", psxController.getStockFibonacci);
router.get("/stock/:symbol/support-resistance", psxController.getStockSupportResistance);
router.get("/stock/:symbol/session", psxController.getStockSessionAdvice);

// ============ SCANS ============
router.get("/scan/bullish", psxController.scanBullish);
router.get("/scan/bearish", psxController.scanBearish);
router.get("/scan/oversold", psxController.scanOversold);
router.get("/scan/overbought", psxController.scanOverbought);

// ============ CACHE ============
router.post("/cache/clear", psxController.clearCache);

module.exports = router;