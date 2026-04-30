const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Sector mapping for PSX
const sectorMap = {
  'OGDC': 'Oil & Gas Exploration',
  'PPL': 'Oil & Gas Exploration',
  'MARI': 'Oil & Gas Exploration',
  'POL': 'Oil & Gas Exploration',
  'FFC': 'Fertilizer',
  'EFERT': 'Fertilizer',
  'FATIMA': 'Fertilizer',
  'LUCK': 'Cement',
  'DGKC': 'Cement',
  'MLCF': 'Cement',
  'CHCC': 'Cement',
  'PIOC': 'Cement',
  'HUBC': 'Power Generation',
  'KAPCO': 'Power Generation',
  'NESTLE': 'Food & Beverages',
  'COLG': 'Consumer Goods',
  'SYS': 'Technology',
  'TRG': 'Technology',
  'AVN': 'Technology',
  'ISL': 'Steel',
  'ASTL': 'Steel',
  'MUGHAL': 'Steel',
  'GATM': 'Textile',
  'NCL': 'Textile',
  'NML': 'Textile',
  'HBL': 'Banking',
  'UBL': 'Banking',
  'MCB': 'Banking',
  'ABL': 'Banking',
  'BAFL': 'Banking',
  'SEARL': 'Pharmaceuticals',
  'GLAXO': 'Pharmaceuticals',
  'ABOT': 'Pharmaceuticals',
  'ICI': 'Chemicals',
  'LOTCHEM': 'Chemicals',
  'EPCL': 'Chemicals',
  'ATLH': 'Automotive',
  'HCAR': 'Automotive',
  'SAZEW': 'Automotive',
  'INDU': 'Automotive',
  'PSO': 'Oil Marketing',
  'SHEL': 'Oil Marketing',
  'APL': 'Oil Marketing',
  'PKGS': 'Packaging',
  'GHGL': 'Glass',
  'TGL': 'Glass',
  'PAEL': 'Electrical',
  'PICT': 'Insurance',
  'AGL': 'Insurance',
  'NATF': 'Food',
  'FCEPL': 'Food'
};

async function analyzeNewsForStock(symbol, newsHeadlines) {
  const sector = sectorMap[symbol] || 'General';
  
  const prompt = `
You are a Pakistan Stock Exchange (PSX) analyst. Analyze these news headlines for ${symbol} (${sector} sector).

News:
${newsHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Return ONLY a JSON object (no markdown, no explanation):
{
  "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "impactScore": number between -10 and +10,
  "confidence": number between 0 and 100,
  "sectorImpact": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "summary": "One-line analysis in Urdu/English mix"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // Clean any markdown formatting
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error(`News analysis failed for ${symbol}:`, error.message);
    return {
      sentiment: 'NEUTRAL',
      impactScore: 0,
      confidence: 0,
      sectorImpact: 'NEUTRAL',
      summary: 'Analysis unavailable'
    };
  }
}

async function analyzeMultipleNews(newsItems) {
  const prompt = `
Analyze these PSX news headlines. Return ONLY JSON array (no markdown):
[
  {
    "headline": "original headline",
    "sectors": ["affected sectors"],
    "symbols": ["affected symbols"],
    "sentiment": "POSITIVE/NEGATIVE/NEUTRAL",
    "impactScore": -10 to +10,
    "priority": "HIGH/MEDIUM/LOW"
  }
]

News:
${newsItems.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Batch news analysis failed:', error.message);
    return [];
  }
}

module.exports = { analyzeNewsForStock, analyzeMultipleNews, sectorMap };