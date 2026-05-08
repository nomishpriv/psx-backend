require('dotenv').config();
const axios = require("axios");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

console.log('🔑 Groq API Key exists:', process.env.GROQ_API_KEY ? 'YES' : 'NO');

// ============ NEWS SOURCES ============
const NEWS_SOURCES = {
  businessRecorder: "https://www.brecorder.com/feeds/latest-news",
  dawnBusiness: "https://www.dawn.com/feeds/business",
  tribuneBusiness: "https://tribune.com.pk/feed/business",
  profitPakistan: "https://profit.pakistantoday.com.pk/feed",
  mettisGlobal: "https://mettisglobal.news/feed/",
};

// ============ ROLLING CONSENSUS CACHE ============
let sentimentHistory = [];
const MAX_HISTORY = 3; // Last 3 analyses

function addToHistory(analysis) {
  if (!analysis) return;
  sentimentHistory.push({
    sentiment: analysis.marketSentiment || analysis.stockSentiment,
    impact: analysis.marketImpact || analysis.stockImpact || 0,
    timestamp: Date.now()
  });
  // Keep only last 3
  if (sentimentHistory.length > MAX_HISTORY) sentimentHistory.shift();
}

function getConsensus() {
  if (sentimentHistory.length === 0) return null;
  
  const totalImpact = sentimentHistory.reduce((sum, h) => sum + h.impact, 0);
  const avgImpact = totalImpact / sentimentHistory.length;
  
  // Count sentiments
  const sentiments = sentimentHistory.map(h => h.sentiment);
  const positiveCount = sentiments.filter(s => s === 'POSITIVE' || s === 'OPTIMISTIC').length;
  const negativeCount = sentiments.filter(s => s === 'NEGATIVE' || s === 'PANIC').length;
  const neutralCount = sentiments.filter(s => s === 'NEUTRAL').length;
  
  // Determine consensus
  let consensus;
  if (positiveCount >= 2) consensus = 'BULLISH';
  else if (negativeCount >= 2) consensus = 'BEARISH';
  else if (neutralCount >= 2) consensus = 'NEUTRAL';
  else consensus = 'MIXED';
  
  // Confidence: how many agree
  const agreement = Math.max(positiveCount, negativeCount, neutralCount) / MAX_HISTORY * 100;
  
  return {
    consensus,
    avgImpact: parseFloat(avgImpact.toFixed(1)),
    agreement: parseFloat(agreement.toFixed(0)),
    history: [...sentimentHistory],
    stable: agreement >= 66, // 2 out of 3 agree = stable signal
    advice: consensus === 'BULLISH' ? 'Market stable bullish — intraday buy opportunities' :
            consensus === 'BEARISH' ? 'Market bearish pressure — avoid long positions, consider shorts' :
            consensus === 'NEUTRAL' ? 'No clear direction — wait for confirmation' :
            'Mixed signals — trade with caution, use tight stops'
  };
}

// ============ FETCH NEWS ============
async function fetchRSSFeed(url) {
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
    const headlines = [];
    const regex = /<title>(.*?)<\/title>/g;
    let match;
    while ((match = regex.exec(data)) !== null) {
      const title = match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
      if (title && !title.includes("RSS") && !title.includes("Feed")) headlines.push(title);
    }
    return [...new Set(headlines)].slice(0, 15);
  } catch { return []; }
}

async function fetchAllNews() {
  const all = [];
  for (const [source, url] of Object.entries(NEWS_SOURCES)) {
    const h = await fetchRSSFeed(url);
    console.log(`📰 ${source}: ${h.length} headlines`);
    all.push(...h);
  }
  return [...new Set(all)];
}

// ============ GROQ ANALYSIS ============
async function analyzeWithGroq(prompt) {
  try {
    const chat = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 300
    });
    const text = chat.choices[0].message.content.replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (e) {
    console.error('❌ Groq failed:', e.message);
    return null;
  }
}

// ============ NEWS FOR STOCK ============
async function getNewsForStock(symbol, sector = "General") {
  const headlines = await fetchAllNews();
  if (!headlines.length) return { headlines: [], analysis: null, consensus: null };

  const relevant = headlines.filter(h =>
    h.toUpperCase().includes(symbol) || h.toUpperCase().includes(sector.toUpperCase()) ||
    h.toUpperCase().includes("PSX") || h.toUpperCase().includes("KSE")
  );

  const useHeadlines = (relevant.length >= 3 ? relevant : headlines).slice(0, 10);
  
  const prompt = `PSX intraday stock analyst. Return ONLY JSON:
{
  "stockSentiment": "POSITIVE/NEGATIVE/NEUTRAL",
  "stockImpact": -10 to +10,
  "sectorSentiment": "POSITIVE/NEGATIVE/NEUTRAL",
  "sectorImpact": -10 to +10,
  "keyNews": "summary",
  "tradeRecommendation": "BUY/HOLD/SELL/AVOID",
  "confidence": 0-100,
  "reason": "brief reason for intraday trade"
}
Stock: ${symbol} (${sector})
News (newest first): ${useHeadlines.slice(0, 8).join(' | ')}`;

  const analysis = process.env.GROQ_API_KEY ? await analyzeWithGroq(prompt) : null;

  // Get market consensus to combine with stock analysis
  const marketConsensus = getConsensus();

  return { 
    headlines: useHeadlines.slice(0, 10), 
    relevantHeadlines: relevant.slice(0, 5), 
    analysis,
    marketConsensus
  };
}

// ============ MARKET NEWS ============
async function getMarketNews() {
  const headlines = await fetchAllNews();
  if (!headlines.length) {
    const consensus = getConsensus();
    return { headlines: [], analysis: null, consensus };
  }

  const prompt = `PSX intraday market news analysis. Return ONLY JSON:
{
  "marketSentiment": "POSITIVE/NEGATIVE/NEUTRAL",
  "marketImpact": -10 to +10,
  "topSectors": ["sector"],
  "topStocks": ["SYM"],
  "summary": "one line",
  "advice": "specific intraday action"
}
News (newest first): ${headlines.slice(0, 12).join(' | ')}`;

  const analysis = process.env.GROQ_API_KEY ? await analyzeWithGroq(prompt) : null;
  
  // Add to rolling consensus
  if (analysis) addToHistory(analysis);
  
  // Get stable consensus
  const consensus = getConsensus();

  return { 
    headlines: headlines.slice(0, 15), 
    analysis, 
    consensus 
  };
}

module.exports = { getNewsForStock, getMarketNews, fetchAllNews, getConsensus, addToHistory };
