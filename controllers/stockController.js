const stockService = require("../services/stockService");
const confidenceService = require("../services/confidenceService");
const atrService = require("../services/atrService");
const sessionService = require("../services/sessionService");

// In-memory watchlist (replace with database in production)
let userWatchlist = [];

/**
 * Get all companies fundamental data
 */
async function getAllCompanies(req, res) {
  try {
    const data = await stockService.getAllCompaniesData();
    
    // Filter out failed requests for summary
    const successful = data.filter(d => !d.error);
    const failed = data.filter(d => d.error);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total: data.length,
        successful: successful.length,
        failed: failed.length
      },
      data: data
    });
  } catch (error) {
    console.error("Error in getAllCompanies:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch companies data",
      message: error.message
    });
  }
}

/**
 * Get single company fundamental data
 */
async function getSingleCompany(req, res) {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: "Symbol parameter is required"
      });
    }
    
    const data = await stockService.getSingleCompanyData(symbol);
    
    if (data.error) {
      return res.status(404).json({
        success: false,
        error: "Company not found or failed to fetch",
        data: data
      });
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: data
    });
  } catch (error) {
    console.error(`Error in getSingleCompany for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch company data",
      message: error.message
    });
  }
}

/**
 * Search companies
 */
async function searchCompanies(req, res) {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: "Search query parameter 'q' is required"
      });
    }
    
    const allData = await stockService.getAllCompaniesData();
    
    const searchTerm = q.toLowerCase();
    const results = allData.filter(company => 
      company.symbol.toLowerCase().includes(searchTerm) ||
      (company.companyName && company.companyName.toLowerCase().includes(searchTerm))
    );
    
    res.json({
      success: true,
      query: q,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error("Error in searchCompanies:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search companies"
    });
  }
}

/**
 * Get market summary from fundamental data
 */
async function getMarketSummary(req, res) {
  try {
    const allData = await stockService.getAllCompaniesData();
    
    const validStocks = allData.filter(d => d.price !== null && !d.error);
    
    const summary = {
      totalStocks: allData.length,
      activeStocks: validStocks.length,
      gainers: validStocks.filter(s => s.change > 0).length,
      losers: validStocks.filter(s => s.change < 0).length,
      unchanged: validStocks.filter(s => s.change === 0).length,
      
      topGainers: validStocks
        .filter(s => s.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 5)
        .map(s => ({
          symbol: s.symbol,
          price: s.price,
          change: s.changePercent
        })),
        
      topLosers: validStocks
        .filter(s => s.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 5)
        .map(s => ({
          symbol: s.symbol,
          price: s.price,
          change: s.changePercent
        })),
        
      mostActive: validStocks
        .filter(s => s.ohlc?.volume)
        .sort((a, b) => (b.ohlc?.volume || 0) - (a.ohlc?.volume || 0))
        .slice(0, 5)
        .map(s => ({
          symbol: s.symbol,
          price: s.price,
          volume: s.ohlc?.volume
        }))
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: summary
    });
  } catch (error) {
    console.error("Error in getMarketSummary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch market summary"
    });
  }
}

// ============ NEW METHODS FOR PREDICTABLE TRADING ============

/**
 * Get fundamentals with trading recommendation
 */
async function getFundamentalsWithRecommendation(req, res) {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: "Symbol parameter is required"
      });
    }
    
    const companyData = await stockService.getSingleCompanyData(symbol);
    
    if (companyData.error) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }
    
    // Calculate recommendation based on fundamentals
    let recommendation = {
      score: 50,
      action: "HOLD",
      reasons: []
    };
    
    // PE Ratio analysis
    if (companyData.peRatio) {
      if (companyData.peRatio < 10) {
        recommendation.score += 15;
        recommendation.reasons.push("Attractive PE ratio (< 10)");
      } else if (companyData.peRatio > 25) {
        recommendation.score -= 10;
        recommendation.reasons.push("Expensive PE ratio (> 25)");
      } else {
        recommendation.score += 5;
        recommendation.reasons.push("Fair PE ratio");
      }
    }
    
    // PB Ratio analysis
    if (companyData.pbRatio) {
      if (companyData.pbRatio < 1.5) {
        recommendation.score += 10;
        recommendation.reasons.push("Undervalued PB ratio (< 1.5)");
      } else if (companyData.pbRatio > 3) {
        recommendation.score -= 5;
        recommendation.reasons.push("Expensive PB ratio (> 3)");
      }
    }
    
    // ROE analysis
    if (companyData.roe) {
      if (companyData.roe > 20) {
        recommendation.score += 15;
        recommendation.reasons.push("Excellent ROE (> 20%)");
      } else if (companyData.roe > 15) {
        recommendation.score += 10;
        recommendation.reasons.push("Good ROE (> 15%)");
      } else if (companyData.roe < 10) {
        recommendation.score -= 5;
        recommendation.reasons.push("Low ROE (< 10%)");
      }
    }
    
    // Dividend yield analysis
    if (companyData.dividendYield) {
      if (companyData.dividendYield > 5) {
        recommendation.score += 10;
        recommendation.reasons.push("High dividend yield (> 5%)");
      } else if (companyData.dividendYield > 3) {
        recommendation.score += 5;
        recommendation.reasons.push("Decent dividend yield (> 3%)");
      }
    }
    
    // Determine action
    if (recommendation.score >= 70) {
      recommendation.action = "BUY";
    } else if (recommendation.score >= 60) {
      recommendation.action = "ACCUMULATE";
    } else if (recommendation.score <= 40) {
      recommendation.action = "SELL";
    } else if (recommendation.score <= 30) {
      recommendation.action = "AVOID";
    } else {
      recommendation.action = "HOLD";
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        company: companyData,
        recommendation: recommendation,
        sessionAdvice: sessionService.getTradingAdvice()
      }
    });
  } catch (error) {
    console.error("Error in getFundamentalsWithRecommendation:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get key financial ratios
 */
async function getFinancialRatios(req, res) {
  try {
    const { symbol } = req.params;
    
    const companyData = await stockService.getSingleCompanyData(symbol);
    
    if (companyData.error) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }
    
    const ratios = {
      symbol: companyData.symbol,
      companyName: companyData.companyName,
      valuation: {
        peRatio: companyData.peRatio || null,
        pbRatio: companyData.pbRatio || null,
        psRatio: companyData.psRatio || null,
        pegRatio: companyData.pegRatio || null
      },
      profitability: {
        roe: companyData.roe || null,
        roa: companyData.roa || null,
        profitMargin: companyData.profitMargin || null,
        operatingMargin: companyData.operatingMargin || null
      },
      financialHealth: {
        debtToEquity: companyData.debtToEquity || null,
        currentRatio: companyData.currentRatio || null,
        quickRatio: companyData.quickRatio || null
      },
      dividends: {
        dividendYield: companyData.dividendYield || null,
        payoutRatio: companyData.payoutRatio || null
      }
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: ratios
    });
  } catch (error) {
    console.error("Error in getFinancialRatios:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get companies by sector
 */
async function getCompaniesBySector(req, res) {
  try {
    const { sector } = req.params;
    
    const allData = await stockService.getAllCompaniesData();
    
    const filtered = allData.filter(company => 
      company.sector && company.sector.toLowerCase() === sector.toLowerCase()
    );
    
    res.json({
      success: true,
      sector: sector,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    console.error("Error in getCompaniesBySector:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get all sectors with performance
 */
async function getAllSectors(req, res) {
  try {
    const allData = await stockService.getAllCompaniesData();
    
    const sectorMap = new Map();
    
    allData.forEach(company => {
      if (company.sector && !company.error) {
        if (!sectorMap.has(company.sector)) {
          sectorMap.set(company.sector, {
            sector: company.sector,
            stocks: [],
            totalChange: 0,
            totalVolume: 0
          });
        }
        
        const sectorData = sectorMap.get(company.sector);
        sectorData.stocks.push(company.symbol);
        sectorData.totalChange += (company.changePercent || 0);
        sectorData.totalVolume += (company.ohlc?.volume || 0);
      }
    });
    
    const sectors = Array.from(sectorMap.values()).map(sector => ({
      ...sector,
      averageChange: sector.stocks.length > 0 ? sector.totalChange / sector.stocks.length : 0,
      performance: sector.totalChange > 0 ? "UP" : sector.totalChange < 0 ? "DOWN" : "FLAT"
    }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalSectors: sectors.length,
      data: sectors
    });
  } catch (error) {
    console.error("Error in getAllSectors:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get top gainers
 */
async function getTopGainers(req, res) {
  try {
    const { limit = 10 } = req.query;
    const allData = await stockService.getAllCompaniesData();
    
    const validStocks = allData.filter(d => !d.error && d.changePercent !== undefined);
    
    const gainers = validStocks
      .filter(s => s.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, parseInt(limit))
      .map(s => ({
        symbol: s.symbol,
        companyName: s.companyName,
        price: s.price,
        change: s.changePercent,
        volume: s.ohlc?.volume
      }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: gainers.length,
      data: gainers
    });
  } catch (error) {
    console.error("Error in getTopGainers:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get top losers
 */
async function getTopLosers(req, res) {
  try {
    const { limit = 10 } = req.query;
    const allData = await stockService.getAllCompaniesData();
    
    const validStocks = allData.filter(d => !d.error && d.changePercent !== undefined);
    
    const losers = validStocks
      .filter(s => s.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, parseInt(limit))
      .map(s => ({
        symbol: s.symbol,
        companyName: s.companyName,
        price: s.price,
        change: s.changePercent,
        volume: s.ohlc?.volume
      }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: losers.length,
      data: losers
    });
  } catch (error) {
    console.error("Error in getTopLosers:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get most active stocks
 */
async function getMostActive(req, res) {
  try {
    const { limit = 10 } = req.query;
    const allData = await stockService.getAllCompaniesData();
    
    const validStocks = allData.filter(d => !d.error && d.ohlc?.volume);
    
    const active = validStocks
      .sort((a, b) => (b.ohlc?.volume || 0) - (a.ohlc?.volume || 0))
      .slice(0, parseInt(limit))
      .map(s => ({
        symbol: s.symbol,
        companyName: s.companyName,
        price: s.price,
        change: s.changePercent,
        volume: s.ohlc?.volume,
        turnover: s.ohlc?.turnover
      }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: active.length,
      data: active
    });
  } catch (error) {
    console.error("Error in getMostActive:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get stocks near 52-week high
 */
async function getFiftyTwoWeekHigh(req, res) {
  try {
    const allData = await stockService.getAllCompaniesData();
    
    const nearHigh = allData
      .filter(d => !d.error && d.fiftyTwoWeekHigh && d.price)
      .map(s => ({
        symbol: s.symbol,
        companyName: s.companyName,
        price: s.price,
        high52Week: s.fiftyTwoWeekHigh,
        percentFromHigh: ((s.price - s.fiftyTwoWeekHigh) / s.fiftyTwoWeekHigh * 100).toFixed(2)
      }))
      .filter(s => parseFloat(s.percentFromHigh) > -5) // Within 5% of 52-week high
      .sort((a, b) => parseFloat(b.percentFromHigh) - parseFloat(a.percentFromHigh));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: nearHigh.length,
      data: nearHigh
    });
  } catch (error) {
    console.error("Error in getFiftyTwoWeekHigh:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get stocks near 52-week low
 */
async function getFiftyTwoWeekLow(req, res) {
  try {
    const allData = await stockService.getAllCompaniesData();
    
    const nearLow = allData
      .filter(d => !d.error && d.fiftyTwoWeekLow && d.price)
      .map(s => ({
        symbol: s.symbol,
        companyName: s.companyName,
        price: s.price,
        low52Week: s.fiftyTwoWeekLow,
        percentFromLow: ((s.price - s.fiftyTwoWeekLow) / s.fiftyTwoWeekLow * 100).toFixed(2)
      }))
      .filter(s => parseFloat(s.percentFromLow) < 10) // Within 10% of 52-week low
      .sort((a, b) => parseFloat(a.percentFromLow) - parseFloat(b.percentFromLow));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: nearLow.length,
      data: nearLow
    });
  } catch (error) {
    console.error("Error in getFiftyTwoWeekLow:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get undervalued stocks
 */
async function getUndervaluedStocks(req, res) {
  try {
    const allData = await stockService.getAllCompaniesData();
    
    const undervalued = allData
      .filter(d => !d.error && d.peRatio && d.pbRatio && d.roe)
      .filter(s => s.peRatio < 10 && s.pbRatio < 1.5 && s.roe > 15)
      .map(s => ({
        symbol: s.symbol,
        companyName: s.companyName,
        price: s.price,
        peRatio: s.peRatio,
        pbRatio: s.pbRatio,
        roe: s.roe,
        dividendYield: s.dividendYield
      }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      criteria: {
        peRatio: "< 10",
        pbRatio: "< 1.5",
        roe: "> 15%"
      },
      count: undervalued.length,
      data: undervalued
    });
  } catch (error) {
    console.error("Error in getUndervaluedStocks:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get high dividend stocks
 */
async function getHighDividendStocks(req, res) {
  try {
    const allData = await stockService.getAllCompaniesData();
    
    const highDividend = allData
      .filter(d => !d.error && d.dividendYield)
      .filter(s => s.dividendYield > 5)
      .sort((a, b) => b.dividendYield - a.dividendYield)
      .map(s => ({
        symbol: s.symbol,
        companyName: s.companyName,
        price: s.price,
        dividendYield: s.dividendYield,
        payoutRatio: s.payoutRatio
      }));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      criteria: "Dividend Yield > 5%",
      count: highDividend.length,
      data: highDividend
    });
  } catch (error) {
    console.error("Error in getHighDividendStocks:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Advanced stock screener
 */
async function stockScreener(req, res) {
  try {
    const {
      minPrice,
      maxPrice,
      minVolume,
      sector,
      minPE,
      maxPE,
      minROE,
      minDividend
    } = req.query;
    
    const allData = await stockService.getAllCompaniesData();
    
    let results = allData.filter(d => !d.error);
    
    // Apply filters
    if (minPrice) results = results.filter(s => s.price >= parseFloat(minPrice));
    if (maxPrice) results = results.filter(s => s.price <= parseFloat(maxPrice));
    if (minVolume) results = results.filter(s => (s.ohlc?.volume || 0) >= parseFloat(minVolume));
    if (sector) results = results.filter(s => s.sector?.toLowerCase() === sector.toLowerCase());
    if (minPE) results = results.filter(s => s.peRatio >= parseFloat(minPE));
    if (maxPE) results = results.filter(s => s.peRatio <= parseFloat(maxPE));
    if (minROE) results = results.filter(s => s.roe >= parseFloat(minROE));
    if (minDividend) results = results.filter(s => s.dividendYield >= parseFloat(minDividend));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      filters: { minPrice, maxPrice, minVolume, sector, minPE, maxPE, minROE, minDividend },
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error("Error in stockScreener:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Compare multiple stocks
 */
async function compareStocks(req, res) {
  try {
    const { symbols } = req.params;
    const symbolList = symbols.split(',');
    
    const comparison = [];
    
    for (const symbol of symbolList) {
      const companyData = await stockService.getSingleCompanyData(symbol);
      if (!companyData.error) {
        comparison.push({
          symbol: companyData.symbol,
          companyName: companyData.companyName,
          price: companyData.price,
          change: companyData.changePercent,
          volume: companyData.ohlc?.volume,
          peRatio: companyData.peRatio,
          pbRatio: companyData.pbRatio,
          roe: companyData.roe,
          dividendYield: companyData.dividendYield,
          marketCap: companyData.marketCap
        });
      }
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      symbols: symbolList,
      data: comparison
    });
  } catch (error) {
    console.error("Error in compareStocks:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get AI-based recommendations
 */
async function getRecommendations(req, res) {
  try {
    const allData = await stockService.getAllCompaniesData();
    
    const validStocks = allData.filter(d => !d.error && d.price && d.peRatio);
    
    const recommendations = validStocks.map(stock => {
      let score = 50;
      let reasons = [];
      
      // Value score (30 points)
      if (stock.peRatio < 12) {
        score += 15;
        reasons.push("Attractive valuation (PE < 12)");
      } else if (stock.peRatio < 18) {
        score += 5;
        reasons.push("Fair valuation (PE < 18)");
      } else if (stock.peRatio > 25) {
        score -= 10;
        reasons.push("Expensive valuation (PE > 25)");
      }
      
      // Growth score (25 points)
      if (stock.roe && stock.roe > 20) {
        score += 15;
        reasons.push("Strong profitability (ROE > 20%)");
      } else if (stock.roe && stock.roe > 15) {
        score += 8;
        reasons.push("Good profitability (ROE > 15%)");
      }
      
      // Income score (20 points)
      if (stock.dividendYield && stock.dividendYield > 4) {
        score += 12;
        reasons.push("Attractive dividend yield");
      } else if (stock.dividendYield && stock.dividendYield > 2) {
        score += 5;
        reasons.push("Decent dividend yield");
      }
      
      // Momentum score (25 points)
      if (stock.changePercent && stock.changePercent > 2) {
        score += 15;
        reasons.push("Strong upward momentum");
      } else if (stock.changePercent && stock.changePercent > 0) {
        score += 5;
        reasons.push("Positive momentum");
      } else if (stock.changePercent && stock.changePercent < -2) {
        score -= 10;
        reasons.push("Negative momentum");
      }
      
      let action = "HOLD";
      if (score >= 70) action = "STRONG BUY";
      else if (score >= 60) action = "BUY";
      else if (score <= 35) action = "SELL";
      else if (score <= 25) action = "STRONG SELL";
      
      return {
        symbol: stock.symbol,
        companyName: stock.companyName,
        price: stock.price,
        score: Math.min(100, Math.max(0, score)),
        action: action,
        reasons: reasons.slice(0, 3)
      };
    });
    
    const sorted = recommendations.sort((a, b) => b.score - a.score);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      total: sorted.length,
      topBuys: sorted.slice(0, 5),
      topSells: sorted.slice(-5).reverse(),
      all: sorted
    });
  } catch (error) {
    console.error("Error in getRecommendations:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get watchlist
 */
async function getWatchlist(req, res) {
  try {
    const watchlistData = [];
    
    for (const symbol of userWatchlist) {
      const companyData = await stockService.getSingleCompanyData(symbol);
      if (!companyData.error) {
        watchlistData.push(companyData);
      }
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: watchlistData.length,
      data: watchlistData
    });
  } catch (error) {
    console.error("Error in getWatchlist:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Add to watchlist
 */
async function addToWatchlist(req, res) {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: "Symbol is required"
      });
    }
    
    if (!userWatchlist.includes(symbol)) {
      userWatchlist.push(symbol);
    }
    
    res.json({
      success: true,
      message: `${symbol} added to watchlist`,
      watchlist: userWatchlist
    });
  } catch (error) {
    console.error("Error in addToWatchlist:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Remove from watchlist
 */
async function removeFromWatchlist(req, res) {
  try {
    const { symbol } = req.params;
    
    userWatchlist = userWatchlist.filter(s => s !== symbol);
    
    res.json({
      success: true,
      message: `${symbol} removed from watchlist`,
      watchlist: userWatchlist
    });
  } catch (error) {
    console.error("Error in removeFromWatchlist:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Portfolio analysis
 */
async function portfolioAnalysis(req, res) {
  try {
    // This would typically use user's portfolio data
    // For now, returning sample analysis structure
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        totalValue: 0,
        dailyPnL: 0,
        totalPnL: 0,
        topPerformers: [],
        worstPerformers: [],
        sectorAllocation: {},
        recommendations: []
      }
    });
  } catch (error) {
    console.error("Error in portfolioAnalysis:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get stock insights
 */
async function getStockInsights(req, res) {
  try {
    const { symbol } = req.params;
    
    const companyData = await stockService.getSingleCompanyData(symbol);
    
    if (companyData.error) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }
    
    const insights = {
      symbol: companyData.symbol,
      companyName: companyData.companyName,
      summary: `${companyData.companyName} is currently trading at PKR ${companyData.price}.`,
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
      technicalView: "",
      fundamentalView: ""
    };
    
    // Technical insights
    if (companyData.changePercent > 0) {
      insights.strengths.push("Positive momentum in today's trading");
    } else {
      insights.weaknesses.push("Negative momentum in today's trading");
    }
    
    // Fundamental insights
    if (companyData.peRatio && companyData.peRatio < 12) {
      insights.strengths.push(`Attractive PE ratio of ${companyData.peRatio}`);
    } else if (companyData.peRatio && companyData.peRatio > 25) {
      insights.weaknesses.push(`Expensive PE ratio of ${companyData.peRatio}`);
    }
    
    if (companyData.roe && companyData.roe > 20) {
      insights.strengths.push(`Excellent ROE of ${companyData.roe}%`);
    }
    
    if (companyData.dividendYield && companyData.dividendYield > 4) {
      insights.strengths.push(`Attractive dividend yield of ${companyData.dividendYield}%`);
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: insights
    });
  } catch (error) {
    console.error("Error in getStockInsights:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  getAllCompanies,
  getSingleCompany,
  searchCompanies,
  getMarketSummary,
  getFundamentalsWithRecommendation,
  getFinancialRatios,
  getCompaniesBySector,
  getAllSectors,
  getTopGainers,
  getTopLosers,
  getMostActive,
  getFiftyTwoWeekHigh,
  getFiftyTwoWeekLow,
  getUndervaluedStocks,
  getHighDividendStocks,
  stockScreener,
  compareStocks,
  getRecommendations,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  portfolioAnalysis,
  getStockInsights
};