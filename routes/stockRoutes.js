const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stockController");

// ============ COMPANIES ============
router.get("/companies", stockController.getAllCompanies);
router.get("/companies/search", stockController.searchCompanies);
router.get("/companies/:symbol", stockController.getSingleCompany);
router.get("/companies/:symbol/fundamentals", stockController.getFundamentalsWithRecommendation);
router.get("/companies/:symbol/ratios", stockController.getFinancialRatios);

// ============ MARKET ============
router.get("/market/summary", stockController.getMarketSummary);

// ============ SECTORS ============
router.get("/sector/:sector", stockController.getCompaniesBySector);
router.get("/sectors/list", stockController.getAllSectors);

// ============ LISTS ============
router.get("/top-gainers", stockController.getTopGainers);
router.get("/top-losers", stockController.getTopLosers);
router.get("/most-active", stockController.getMostActive);
router.get("/52week-high", stockController.getFiftyTwoWeekHigh);
router.get("/52week-low", stockController.getFiftyTwoWeekLow);
router.get("/undervalued", stockController.getUndervaluedStocks);
router.get("/high-dividend", stockController.getHighDividendStocks);

// ============ SCREENER & COMPARE ============
router.get("/screener", stockController.stockScreener);
router.get("/compare/:symbols", stockController.compareStocks);

// ============ RECOMMENDATIONS & INSIGHTS ============
router.get("/recommendations", stockController.getRecommendations);
router.get("/insights/:symbol", stockController.getStockInsights);

// ============ WATCHLIST ============
router.get("/watchlist", stockController.getWatchlist);
router.post("/watchlist", stockController.addToWatchlist);
router.delete("/watchlist/:symbol", stockController.removeFromWatchlist);

// ============ PORTFOLIO ============
router.get("/portfolio/analysis", stockController.portfolioAnalysis);

module.exports = router;