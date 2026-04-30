const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stockController");

// ============ EXISTING ROUTES ============

// GET /api/stock/companies - Get all companies fundamental data
router.get("/companies", stockController.getAllCompanies);

// GET /api/stock/companies/search - Search companies (must be before /:symbol)
router.get("/companies/search", stockController.searchCompanies);

// GET /api/stock/market/summary - Get market summary
router.get("/market/summary", stockController.getMarketSummary);

// GET /api/stock/companies/:symbol - Get single company data
router.get("/companies/:symbol", stockController.getSingleCompany);

// ============ NEW ROUTES FOR PREDICTABLE TRADING ============

/**
 * GET /api/stock/companies/:symbol/fundamentals
 * Get fundamental data with trading recommendations
 */
router.get("/companies/:symbol/fundamentals", stockController.getFundamentalsWithRecommendation);

/**
 * GET /api/stock/companies/:symbol/ratios
 * Get key financial ratios (PE, PB, ROE, etc.)
 */
router.get("/companies/:symbol/ratios", stockController.getFinancialRatios);

/**
 * GET /api/stock/sector/:sector
 * Get all companies in a specific sector
 */
router.get("/sector/:sector", stockController.getCompaniesBySector);

/**
 * GET /api/stock/sectors/list
 * Get all available sectors with performance
 */
router.get("/sectors/list", stockController.getAllSectors);

/**
 * GET /api/stock/top-gainers
 * Get top gaining stocks (based on daily change)
 */
router.get("/top-gainers", stockController.getTopGainers);

/**
 * GET /api/stock/top-losers
 * Get top losing stocks
 */
router.get("/top-losers", stockController.getTopLosers);

/**
 * GET /api/stock/most-active
 * Get most active stocks by volume
 */
router.get("/most-active", stockController.getMostActive);

/**
 * GET /api/stock/52week-high
 * Get stocks near 52-week high
 */
router.get("/52week-high", stockController.getFiftyTwoWeekHigh);

/**
 * GET /api/stock/52week-low
 * Get stocks near 52-week low
 */
router.get("/52week-low", stockController.getFiftyTwoWeekLow);

/**
 * GET /api/stock/undervalued
 * Get potentially undervalued stocks (low PE, PB)
 */
router.get("/undervalued", stockController.getUndervaluedStocks);

/**
 * GET /api/stock/high-dividend
 * Get stocks with high dividend yield
 */
router.get("/high-dividend", stockController.getHighDividendStocks);

/**
 * GET /api/stock/screener
 * Advanced stock screener with multiple filters
 * Query params: minPrice, maxPrice, minVolume, sector, minPE, maxPE, minROE
 */
router.get("/screener", stockController.stockScreener);

/**
 * GET /api/stock/compare/:symbols
 * Compare multiple stocks (comma-separated symbols)
 * Example: /compare/ENGRO,FFC,LUCK
 */
router.get("/compare/:symbols", stockController.compareStocks);

/**
 * GET /api/stock/recommendations
 * Get AI-based stock recommendations
 */
router.get("/recommendations", stockController.getRecommendations);

/**
 * GET /api/stock/watchlist
 * Get user watchlist (requires auth - implement later)
 */
router.get("/watchlist", stockController.getWatchlist);

/**
 * POST /api/stock/watchlist
 * Add stock to watchlist
 */
router.post("/watchlist", stockController.addToWatchlist);

/**
 * DELETE /api/stock/watchlist/:symbol
 * Remove stock from watchlist
 */
router.delete("/watchlist/:symbol", stockController.removeFromWatchlist);

/**
 * GET /api/stock/portfolio/analysis
 * Portfolio performance analysis
 */
router.get("/portfolio/analysis", stockController.portfolioAnalysis);

/**
 * GET /api/stock/insights/:symbol
 * Get AI-powered insights for a specific stock
 */
router.get("/insights/:symbol", stockController.getStockInsights);

module.exports = router;