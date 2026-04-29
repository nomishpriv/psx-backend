const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");
const { symbols, stockNames, sectors } = require("../config/symbols");

const cache = new NodeCache({ stdTTL: 900 }); // 15 minutes cache
const intradayCache = new NodeCache({ stdTTL: 60 }); // 1 minute cache for intraday

/**
 * Fetch company details from PSX page for a single symbol
 */
async function fetchCompanyDetails(symbol) {
  try {
    const url = `https://dps.psx.com.pk/company/${symbol}`;
    console.log(`Fetching company data for ${symbol}...`);
    
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
      },
      timeout: 10000
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // ===== PRICE INFORMATION =====
    const price = $(".quote__close").first().text().trim() || 
                  $(".stats_value").first().text().trim();
                  
    const change = $(".change__value").first().text().trim() ||
                   $(".stats_value .change__text--pos, .stats_value .change__text--neg").first().text().trim();
                   
    const changePercent = $(".change__percent").first().text().trim();
    
    // ===== OHLC DATA =====
    let open = null;
    let high = null;
    let low = null;
    let volume = null;
    
    $(".tabs__panel[data-name='REG'] .stats_item").each((i, el) => {
      const label = $(el).find(".stats_label").text().trim();
      const value = $(el).find(".stats_value").text().trim();
      
      if (label === "Open") open = value;
      if (label === "High") high = value;
      if (label === "Low") low = value;
      if (label === "Volume") volume = value;
    });
    
    if (!open) {
      $(".stats_item").each((i, el) => {
        const label = $(el).find(".stats_label").text().trim();
        const value = $(el).find(".stats_value").text().trim();
        
        if (label === "Open" && !open) open = value;
        if (label === "High" && !high) high = value;
        if (label === "Low" && !low) low = value;
        if (label === "Volume" && !volume) volume = value;
      });
    }
    
    // ===== COMPANY INFO =====
    const companyName = $(".company__name").first().text().trim() || 
                        stockNames[symbol] || symbol;
                        
    const sectorName = $(".company__sector").first().text().trim() || 
                       sectors[symbol] || "N/A";
    
    // ===== EQUITY PROFILE =====
    const equity = {};
    $("#equity .stats_item").each((i, el) => {
      const label = $(el).find(".stats_label").text().trim();
      let value = $(el).find(".stats_value").text().trim();
      
      if (label && value) {
        let key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
        key = key.replace(/__+/g, '_');
        
        if (equity[key]) {
          key = key + "_percent";
        }
        
        equity[key] = value.replace(/,/g, "");
      }
    });
    
    // ===== RATIOS =====
    const ratios = {};
    $("#ratios tbody tr, .company__ratios tbody tr").each((i, row) => {
      const cols = $(row).find("td");
      
      if (cols.length > 0) {
        const label = $(cols[0]).text().trim();
        const values = [];
        
        for (let i = 1; i < cols.length; i++) {
          values.push($(cols[i]).text().trim());
        }
        
        if (label) {
          const key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
          ratios[key] = values;
        }
      }
    });
    
    // ===== PAYOUTS =====
    const payouts = [];
    $(".company__payouts tbody tr").each((i, row) => {
      const cols = $(row).find("td");
      
      if (cols.length >= 4) {
        payouts.push({
          date: $(cols[0]).text().trim(),
          result: $(cols[1]).text().trim(),
          details: $(cols[2]).text().trim(),
          book_closure: $(cols[3]).text().trim(),
        });
      }
    });
    
    // ===== FINANCIALS =====
    const financials = {
      annual: {},
      quarterly: {}
    };
    
    $(".tabs__panel[data-name='Annual'] tbody tr").each((i, row) => {
      const cols = $(row).find("td");
      
      if (cols.length > 0) {
        const label = $(cols[0]).text().trim();
        const values = [];
        
        for (let i = 1; i < cols.length; i++) {
          values.push($(cols[i]).text().trim().replace(/,/g, ""));
        }
        
        if (label) {
          const key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
          financials.annual[key] = values;
        }
      }
    });
    
    $(".tabs__panel[data-name='Quarterly'] tbody tr").each((i, row) => {
      const cols = $(row).find("td");
      
      if (cols.length > 0) {
        const label = $(cols[0]).text().trim();
        const values = [];
        
        for (let i = 1; i < cols.length; i++) {
          values.push($(cols[i]).text().trim().replace(/,/g, ""));
        }
        
        if (label) {
          const key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
          financials.quarterly[key] = values;
        }
      }
    });
    
    // ===== ADDITIONAL STATS =====
    const stats = {};
    $(".stats_item").each((i, el) => {
      const label = $(el).find(".stats_label").text().trim();
      const value = $(el).find(".stats_value").text().trim();
      
      if (label && value) {
        const key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
        if (!stats[key]) {
          stats[key] = value;
        }
      }
    });
    
    const parseNumber = (str) => {
      if (!str) return null;
      
      const strValue = String(str).trim();
      let cleaned = strValue.replace(/,/g, '');
      
      const match = cleaned.match(/^-?\d+\.?\d*$/);
      if (match) {
        const num = parseFloat(match[0]);
        return isNaN(num) ? null : num;
      }
      
      const fallbackMatch = cleaned.match(/-?\d+\.?\d*/);
      if (fallbackMatch) {
        return parseFloat(fallbackMatch[0]);
      }
      
      return null;
    };
    
    return {
      symbol,
      companyName,
      sector: sectorName,
      price: parseNumber(price),
      change: parseNumber(change),
      changePercent: parseNumber(changePercent),
      ohlc: {
        open: parseNumber(open),
        high: parseNumber(high),
        low: parseNumber(low),
        close: parseNumber(price),
        volume: parseNumber(volume),
      },
      equity,
      ratios,
      payouts,
      financials,
      stats,
      lastUpdated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error fetching company details for ${symbol}:`, error.message);
    return {
      symbol,
      companyName: stockNames[symbol] || symbol,
      sector: sectors[symbol] || "Unknown",
      price: null,
      change: null,
      changePercent: null,
      ohlc: {
        open: null,
        high: null,
        low: null,
        close: null,
        volume: null,
      },
      equity: {},
      ratios: {},
      payouts: [],
      financials: { annual: {}, quarterly: {} },
      stats: {},
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Get all companies data - PARALLEL BATCH FETCHING
 */
async function getAllCompaniesData() {
  const cacheKey = "psx_companies_all";
  const cached = cache.get(cacheKey);
  
  if (cached) {
    console.log(`✅ Returning cached companies data (${cached.length} symbols)`);
    return cached;
  }
  
  console.log(`🚀 Fetching data for ${symbols.length} symbols in parallel batches...`);
  const startTime = Date.now();
  
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(symbols.length / batchSize);
    
    console.log(`📦 Batch ${batchNumber}/${totalBatches}: ${batch.join(', ')}`);
    
    const batchResults = await Promise.allSettled(
      batch.map(symbol => fetchCompanyDetails(symbol))
    );
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`❌ Failed to fetch ${batch[index]}:`, result.reason?.message);
        results.push({
          symbol: batch[index],
          companyName: stockNames[batch[index]] || batch[index],
          sector: sectors[batch[index]] || "Unknown",
          error: result.reason?.message || 'Failed to fetch'
        });
      }
    });
    
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  const validResults = results.filter(r => !r.error);
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`✅ Successfully fetched ${validResults.length}/${symbols.length} companies in ${elapsedTime}s`);
  
  cache.set(cacheKey, results, 900);
  
  return results;
}

/**
 * Get single company data
 */
async function getSingleCompanyData(symbol) {
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `psx_company_${upperSymbol}`;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    console.log(`✅ Returning cached data for ${upperSymbol}`);
    return cached;
  }
  
  console.log(`🔄 Fetching fresh data for ${upperSymbol}`);
  const result = await fetchCompanyDetails(upperSymbol);
  
  if (!result.error) {
    cache.set(cacheKey, result, 900);
  }
  
  return result;
}

// ============ NEW: INTRADAY CANDLE FUNCTIONS ============

/**
 * Generate synthetic intraday candles for testing
 * (Replace with real API when available)
 */
function generateSyntheticCandles(symbol, basePrice, volatility = 0.002, count = 74) {
  const candles = [];
  let currentPrice = basePrice;
  
  for (let i = 0; i < count; i++) {
    const changePercent = (Math.random() - 0.5) * volatility;
    const change = currentPrice * changePercent;
    
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + (Math.random() * Math.abs(change) * 0.5);
    const low = Math.min(open, close) - (Math.random() * Math.abs(change) * 0.5);
    
    candles.push({
      time: Date.now() - (count - i) * 30000, // 30-second intervals
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(5000 + Math.random() * 50000)
    });
    
    currentPrice = close;
  }
  
  return candles;
}

/**
 * Get intraday candlestick data for a symbol
 * Currently using synthetic data - Replace with real PSX API
 */
async function getIntradayCandles(symbol, interval = 30) {
  const cacheKey = `intraday_${symbol}_${interval}`;
  const cached = intradayCache.get(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  // First get the current price from company data
  const companyData = await getSingleCompanyData(symbol);
  const basePrice = companyData.price || 100;
  
  // Generate synthetic candles (replace with real API call)
  const candles = generateSyntheticCandles(symbol, basePrice, 0.002, 74);
  
  intradayCache.set(cacheKey, candles, 60); // Cache for 1 minute
  
  return candles;
}

/**
 * Get all stocks with intraday candles
 */
async function getAllStocks() {
  const companies = await getAllCompaniesData();
  
  const stocksWithCandles = await Promise.all(
    companies.map(async (company) => {
      if (company.price && !company.error) {
        const candles = await getIntradayCandles(company.symbol);
        return {
          ...company,
          candles
        };
      }
      return {
        ...company,
        candles: []
      };
    })
  );
  
  return stocksWithCandles;
}

/**
 * Get single stock with intraday candles
 */
async function getSingleStock(symbol) {
  const company = await getSingleCompanyData(symbol);
  
  if (company.price && !company.error) {
    const candles = await getIntradayCandles(symbol);
    return {
      ...company,
      candles
    };
  }
  
  return {
    ...company,
    candles: []
  };
}

/**
 * Clear cache
 */
function clearCache() {
  cache.flushAll();
  intradayCache.flushAll();
  console.log('🧹 All cache cleared');
}

module.exports = {
  getAllCompaniesData,
  getSingleCompanyData,
  getIntradayCandles,
  getAllStocks,
  getSingleStock,
  clearCache
};