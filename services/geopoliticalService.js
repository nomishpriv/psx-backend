require('dotenv').config();
const axios = require("axios");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

console.log('🔑 Groq API Key exists:', process.env.GROQ_API_KEY ? 'YES' : 'NO');

// ============ PAKISTAN NEWS SOURCES ============
const GEO_SOURCES = {
  geoNews: "https://www.geo.tv/rss/1-1",
  dawnTop: "https://www.dawn.com/feeds/home",
  tribuneBusiness: "https://tribune.com.pk/feed/business",
  tribunePakistan: "https://tribune.com.pk/feed/pakistan",
  aryNews: "https://arynews.tv/feed/",
  samaaNews: "https://www.samaa.tv/feed",
  mettisGlobal: "https://mettisglobal.news/feed/",
};

// ============ OIL PRICE APIS (FREE) ============
const OIL_API = "https://api.api-ninjas.com/v1/oilprice"; // Free tier: 10k/month
const OIL_BACKUP_API = "https://www.bangladeshbank.org.bd/api/oilprice.php"; // Free backup

// ============ PANIC / OPPORTUNITY KEYWORDS ============
const PANIC_KEYWORDS = [
  "war", "attack", "missile", "bomb", "tension", "conflict", "border",
  "terror", "blast", "military", "navy", "air strike", "nuclear",
  "sanctions", "embargo", "blockade", "invasion",
  "coup", "martial law", "emergency", "curfew", "protest violent",
  "default", "bankrupt", "crash", "meltdown",
  "capital controls", "freeze", "seize"
];

const OPPORTUNITY_KEYWORDS = [
  "IMF deal", "IMF approved", "bailout", "loan approved",
  "ceasefire", "peace deal", "treaty", "diplomatic",
  "privatization", "reform", "investment", "FDI", "CPEC",
  "oil price fall", "commodity drop", "dollar weak", "rupee strong",
  "exports up", "remittances record", "reserves increase",
  "EU trade", "GSP+", "US aid", "alliance"
];

// ============ FETCH RSS WITH TIMESTAMP ============
async function fetchRSSWithTime(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });
    
    const items = [];
    const itemRegex = /<item>(.*?)<\/item>/gs;
    const titleRegex = /<title>(.*?)<\/title>/;
    const dateRegex = /<pubDate>(.*?)<\/pubDate>/;
    
    let itemMatch;
    while ((itemMatch = itemRegex.exec(data)) !== null) {
      const itemContent = itemMatch[1];
      const titleMatch = titleRegex.exec(itemContent);
      const dateMatch = dateRegex.exec(itemContent);
      
      if (titleMatch) {
        const title = titleMatch[1]
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'").replace(/<![^>]*>/g, '').trim();
        
        const pubDate = dateMatch ? new Date(dateMatch[1]) : null;
        
        if (title && title.length > 10) {
          items.push({ headline: title, pubDate });
        }
      }
    }
    
    // If no <item> tags found, fallback to basic title extraction
    if (items.length === 0) {
      const titleRegex = /<title>(.*?)<\/title>/g;
      let match;
      while ((match = titleRegex.exec(data)) !== null) {
        const title = match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
        if (title && title.length > 10 && !title.includes("RSS")) {
          items.push({ headline: title, pubDate: new Date() });
        }
      }
    }
    
    return items.slice(0, 10);
  } catch {
    return [];
  }
}

// ============ FETCH ALL GEO NEWS ============
async function fetchGeopoliticalNews() {
  const all = [];
  for (const [name, url] of Object.entries(GEO_SOURCES)) {
    const items = await fetchRSSWithTime(url);
    console.log(`🌍 ${name}: ${items.length} headlines`);
    all.push(...items);
  }
  return all;
}

// ============ FILTER LAST 1 HOUR ============
function filterRecentNews(items, hoursAgo = 1) {
  const cutoff = Date.now() - (hoursAgo * 60 * 60 * 1000);
  return items.filter(item => {
    if (!item.pubDate) return true; // Keep if no date available
    return item.pubDate.getTime() > cutoff;
  });
}

// ============ FETCH OIL PRICES ============
// ============ FETCH OIL PRICES (WTI + BRENT SPOT) ============
async function fetchOilPrices() {
  const results = { wti: null, brent: null, source: '', timestamp: null };

  // Option 1: Free demo endpoint (no key needed, 20 req/hour)
  try {
    const { data } = await axios.get('https://api.oilpriceapi.com/v1/demo/prices', {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    if (data?.data) {
      results.wti = { price: data.data.wti || data.data.WTI_USD, change: data.data.wti_change || 0 };
      results.brent = { price: data.data.brent || data.data.BRENT_USD, change: data.data.brent_change || 0 };
      results.source = 'oilpriceapi.com (demo)';
      results.timestamp = new Date().toISOString();
      console.log(`🛢️ WTI: $${results.wti.price} | Brent: $${results.brent.price}`);
      return results;
    }
  } catch {}

  // Option 2: Omkar Cloud free API (5000 req/month, no key needed)
  try {
    const [wtiRes, brentRes] = await Promise.all([
      axios.get('https://api.omkar.cloud/commodity-price?name=crude_oil', { timeout: 5000 }),
      axios.get('https://api.omkar.cloud/commodity-price?name=brent_crude_oil', { timeout: 5000 })
    ]);
    
    if (wtiRes.data?.price && brentRes.data?.price) {
      results.wti = { price: parseFloat(wtiRes.data.price), change: parseFloat(wtiRes.data.change_percent || 0) };
      results.brent = { price: parseFloat(brentRes.data.price), change: parseFloat(brentRes.data.change_percent || 0) };
      results.source = 'omkar.cloud (free)';
      results.timestamp = new Date().toISOString();
      console.log(`🛢️ WTI: $${results.wti.price} | Brent: $${results.brent.price}`);
      return results;
    }
  } catch {}

  // Option 3: Free EIA data (requires key but free)
  if (process.env.EIA_API_KEY) {
    try {
      const [wtiRes, brentRes] = await Promise.all([
        axios.get(`https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${process.env.EIA_API_KEY}&data[]=value&facets[product][]=EPCWTIM&sort[0][column]=period&sort[0][direction]=desc&length=1`, { timeout: 5000 }),
        axios.get(`https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${process.env.EIA_API_KEY}&data[]=value&facets[product][]=EPCBRENT&sort[0][column]=period&sort[0][direction]=desc&length=1`, { timeout: 5000 })
      ]);
      
      if (wtiRes.data?.response?.data?.[0] && brentRes.data?.response?.data?.[0]) {
        results.wti = { price: parseFloat(wtiRes.data.response.data[0].value), change: 0 };
        results.brent = { price: parseFloat(brentRes.data.response.data[0].value), change: 0 };
        results.source = 'EIA.gov (free)';
        results.timestamp = new Date().toISOString();
        console.log(`🛢️ WTI: $${results.wti.price} | Brent: $${results.brent.price}`);
        return results;
      }
    } catch {}
  }

  // Option 4: Oilprice.com free scraper (last resort)
  try {
    const [wtiData, brentData] = await Promise.all([
      axios.get('https://oilprice.com/ajax/get_chart_prices/WTI_USD', { timeout: 5000 }),
      axios.get('https://oilprice.com/ajax/get_chart_prices/BRENT_CRUDE_USD', { timeout: 5000 })
    ]);
    
    const getLastPrice = (arr) => {
      if (!arr?.data?.length) return null;
      const last = arr.data[arr.data.length - 1];
      const prev = arr.data[arr.data.length - 2];
      return {
        price: parseFloat(last[1]),
        change: prev ? parseFloat(((last[1] - prev[1]) / prev[1] * 100).toFixed(2)) : 0
      };
    };
    
    results.wti = getLastPrice(wtiData);
    results.brent = getLastPrice(brentData);
    
    if (results.wti?.price && results.brent?.price) {
      results.source = 'oilprice.com';
      results.timestamp = new Date().toISOString();
      console.log(`🛢️ WTI: $${results.wti.price} | Brent: $${results.brent.price}`);
      return results;
    }
  } catch {}

  console.log('🛢️ All oil data sources unavailable');
  return null;
}

// ============ ANALYZE OIL IMPACT ON PSX ============
// ============ ANALYZE OIL IMPACT ON PSX ============
function analyzeOilImpact(oilData) {
  if (!oilData || !oilData.wti?.price) return null;

  const wtiChange = oilData.wti.change || 0;
  const brentChange = oilData.brent?.change || 0;
  const avgChange = (wtiChange + brentChange) / 2;
  const wtiPrice = oilData.wti.price;
  const brentPrice = oilData.brent?.price || 0;

  // Pakistan is oil-importing — rising oil = bad for economy
  if (avgChange > 3) {
    return {
      sentiment: 'NEGATIVE',
      impact: -Math.round(avgChange * 2),
      affectedSectors: ['Oil Marketing', 'Power Generation', 'Transport', 'Cement', 'Fertilizer', 'Chemicals'],
      reason: `Oil surging: WTI $${wtiPrice} (${wtiChange > 0 ? '+' : ''}${wtiChange}%), Brent $${brentPrice} (${brentChange > 0 ? '+' : ''}${brentChange}%) — import bill pressure, inflation risk`
    };
  } else if (avgChange > 1) {
    return {
      sentiment: 'CAUTIOUS',
      impact: -Math.round(avgChange),
      affectedSectors: ['Oil Marketing', 'Transport', 'Power Generation'],
      reason: `Oil rising: WTI $${wtiPrice}, Brent $${brentPrice} — watch energy costs`
    };
  } else if (avgChange < -3) {
    return {
      sentiment: 'POSITIVE',
      impact: Math.round(Math.abs(avgChange) * 2),
      affectedSectors: ['Oil Marketing', 'Power Generation', 'Cement', 'Fertilizer', 'Textile', 'Chemicals'],
      reason: `Oil dropping: WTI $${wtiPrice} (${wtiChange}%), Brent $${brentPrice} (${brentChange}%) — lower costs, margin boost for manufacturing`
    };
  } else if (avgChange < -1) {
    return {
      sentiment: 'SLIGHTLY_POSITIVE',
      impact: Math.round(Math.abs(avgChange)),
      affectedSectors: ['Oil Marketing', 'Power Generation', 'Cement'],
      reason: `Oil easing: WTI $${wtiPrice}, Brent $${brentPrice} — mild relief for import bill`
    };
  }

  return {
    sentiment: 'NEUTRAL',
    impact: 0,
    affectedSectors: [],
    reason: `Oil stable: WTI $${wtiPrice}/bbl, Brent $${brentPrice}/bbl`
  };
}

// ============ KEYWORD SCAN ============
function scanForPanic(items) {
  const matches = [];
  let panicLevel = 0;

  for (const item of items) {
    const lower = item.headline.toLowerCase();
    
    for (const keyword of PANIC_KEYWORDS) {
      if (lower.includes(keyword)) {
        matches.push({ headline: item.headline, keyword, type: 'PANIC', time: item.pubDate });
        panicLevel += keyword.includes("war") || keyword.includes("attack") || keyword.includes("nuclear") ? 20 :
                      keyword.includes("default") || keyword.includes("crash") ? 15 : 10;
      }
    }
    
    for (const keyword of OPPORTUNITY_KEYWORDS) {
      if (lower.includes(keyword.toLowerCase())) {
        matches.push({ headline: item.headline, keyword, type: 'OPPORTUNITY', time: item.pubDate });
        panicLevel -= 10;
      }
    }
  }

  return {
    matches: matches.slice(0, 10),
    panicLevel: Math.max(-100, Math.min(100, panicLevel)),
    sentiment: panicLevel >= 30 ? 'PANIC' : panicLevel <= -20 ? 'OPTIMISTIC' : 'NEUTRAL'
  };
}

// ============ GROQ DEEP ANALYSIS (ONLY RECENT NEWS) ============
async function analyzeWithGroq(recentHeadlines, oilData) {
  if (!process.env.GROQ_API_KEY || recentHeadlines.length === 0) return null;

  const oilContext = oilData 
    ? `Oil (WTI): $${oilData.price}/barrel (${oilData.change > 0 ? '+' : ''}${oilData.change}% today)`
    : 'Oil data unavailable';

  const prompt = `PSX intraday trader alert. Analyze news from LAST HOUR ONLY & oil price.

${oilContext}

Recent Headlines (last 1 hour):
${recentHeadlines.map((h, i) => `${i+1}. [${h.pubDate ? new Date(h.pubDate).toLocaleTimeString('en-PK') : 'recent'}] ${h.headline}`).join('\n')}

Return ONLY JSON:
{
  "alertLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "marketDirection": "UP" | "DOWN" | "SIDEWAYS",
  "impactScore": -10 to +10,
  "topAffectedSectors": ["sector1"],
  "topAffectedStocks": ["SYM1"],
  "summary": "one-line for traders",
  "action": "what intraday traders should do RIGHT NOW",
  "oilComment": "effect of oil price on PSX today"
}`;

  try {
    const chat = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 400
    });
    return JSON.parse(chat.choices[0].message.content.replace(/```json|```/g, '').trim());
  } catch (e) {
    console.error('❌ Groq analysis failed:', e.message);
    return null;
  }
}

// ============ MAIN FUNCTION ============
async function getGeopoliticalSentiment() {
  console.log('🌍 Scanning geopolitical news + oil prices...');
  
  // Fetch news
  const allItems = await fetchGeopoliticalNews();
  console.log(`📰 Total headlines: ${allItems.length}`);
  
  // Filter last 1 hour
  const recentItems = filterRecentNews(allItems, 1);
  console.log(`⏰ Recent (1hr): ${recentItems.length} headlines`);
  
  // If no recent news, expand to 3 hours
  const useItems = recentItems.length >= 3 ? recentItems : filterRecentNews(allItems, 3);
  console.log(`📋 Using: ${useItems.length} headlines`);
  
  // Fetch oil prices
  const oilData = await fetchOilPrices();
  if (oilData) {
    console.log(`🛢️ Oil: $${oilData.price} (${oilData.change > 0 ? '+' : ''}${oilData.change}%)`);
  } else {
    console.log('🛢️ Oil data unavailable');
  }
  
  // Keyword scan (always works)
  const panicScan = scanForPanic(useItems);
  
  // Oil impact analysis
  const oilImpact = analyzeOilImpact(oilData);
  
  // Combine keyword + oil for final sentiment
  let combinedSentiment = panicScan.sentiment;
  let combinedScore = panicScan.panicLevel;
  
  if (oilImpact && oilImpact.sentiment !== 'NEUTRAL') {
    combinedScore += oilImpact.impact;
    if (oilImpact.sentiment === 'NEGATIVE' && combinedScore < 30) combinedSentiment = 'PANIC';
    else if (oilImpact.sentiment === 'POSITIVE' && combinedScore > -20) combinedSentiment = 'OPTIMISTIC';
  }
  
  console.log(`⚠️ Combined sentiment: ${combinedSentiment} (score: ${combinedScore})`);
  
  // AI deep analysis
  const aiAnalysis = await analyzeWithGroq(useItems, oilData);
  
  return {
    headlines: useItems.map(i => i.headline).slice(0, 15),
    recentCount: useItems.length,
    totalCount: allItems.length,
    timeFilter: recentItems.length >= 3 ? '1 hour' : '3 hours',
    oilData,
    oilImpact,
    panicScan: { ...panicScan, sentiment: combinedSentiment, panicLevel: combinedScore },
    aiAnalysis,
    timestamp: new Date().toISOString()
  };
}

module.exports = { getGeopoliticalSentiment };