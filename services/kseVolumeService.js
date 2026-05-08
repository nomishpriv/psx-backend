const axios = require("axios");

// ============ FETCH KSE-100 TICK DATA ============
async function fetchKSE100Ticks() {
  try {
    const { data } = await axios.get("https://dps.psx.com.pk/timeseries/int/KSE100", {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      }
    });
    return data?.data || [];
  } catch {
    return [];
  }
}

// ============ BUILD KSE-100 VOLUME CANDLES ============
function buildKSEVolumeCandles(ticks, intervalSeconds = 300) {
  if (!ticks.length) return [];
  
  const candles = [];
  let current = null;

  for (const tick of ticks) {
    const time = tick[0];
    const volume = tick[2] || 0;
    const bucket = Math.floor(time / intervalSeconds) * intervalSeconds;

    if (!current || current.time !== bucket) {
      if (current) candles.push(current);
      current = { time: bucket, volume: volume };
    } else {
      current.volume += volume;
    }
  }

  if (current) candles.push(current);
  return candles.sort((a, b) => a.time - b.time);
}

// ============ ANALYZE VOLUME PATTERN ============
function analyzeVolumePattern(candles) {
  if (candles.length < 10) return null;

  const last10 = candles.slice(-10);
  const last5 = candles.slice(-5);
  const current = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  // Average of last 10 completed candles (exclude current)
  const completedVolumes = last10.slice(0, 9).map(c => c.volume);
  const avgVolume = completedVolumes.reduce((a, b) => a + b, 0) / completedVolumes.length;

  // Current volume ratio
  const currentRatio = avgVolume > 0 ? (current.volume / avgVolume) * 100 : 100;
  const prevRatio = avgVolume > 0 ? (prev.volume / avgVolume) * 100 : 100;

  // Volume trend (last 5 completed)
  const trendVolumes = last5.slice(0, 4);
  let volumeTrend = 'FLAT';
  if (trendVolumes.length >= 2) {
    const firstHalf = trendVolumes.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const secondHalf = trendVolumes.slice(-2).reduce((a, b) => a + b, 0) / 2;
    if (secondHalf > firstHalf * 1.2) volumeTrend = 'INCREASING';
    else if (secondHalf < firstHalf * 0.8) volumeTrend = 'DECREASING';
  }

  // Estimate time to reach 100% volume ratio
  const elapsedSeconds = 300; // 5-min candle
  const progressPercent = Math.min(100, currentRatio);
  let estimatedCompletion = null;
  
  if (progressPercent > 0 && progressPercent < 100) {
    const ratePerSecond = current.volume / elapsedSeconds;
    const remaining = (avgVolume - current.volume);
    if (ratePerSecond > 0) {
      const secondsRemaining = remaining / ratePerSecond;
      estimatedCompletion = new Date(Date.now() + secondsRemaining * 1000).toLocaleTimeString('en-PK', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
  }

  // Historical pattern matching (time-based)
  const timePatterns = analyzeTimePatterns(candles);
  
  return {
    currentVolume: current.volume,
    avgVolume: parseFloat(avgVolume.toFixed(0)),
    currentRatio: parseFloat(currentRatio.toFixed(1)),
    previousRatio: parseFloat(prevRatio.toFixed(1)),
    volumeTrend,
    progressPercent: parseFloat(progressPercent.toFixed(1)),
    estimatedCompletion,
    timePatterns,
    signal: getVolumeSignal(currentRatio, volumeTrend)
  };
}

// ============ TIME-BASED VOLUME PATTERNS ============
function analyzeTimePatterns(candles) {
  if (candles.length < 30) return null;

  const patterns = {};
  
  // Group volumes by 30-min buckets across all days
  for (const candle of candles) {
    const date = new Date(candle.time * 1000);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const bucket = `${hour}:${Math.floor(minute / 30) * 30}`;
    
    if (!patterns[bucket]) patterns[bucket] = [];
    patterns[bucket].push(candle.volume);
  }

  // Calculate average volume per time bucket
  const timePatterns = {};
  for (const [bucket, volumes] of Object.entries(patterns)) {
    timePatterns[bucket] = {
      avg: parseFloat((volumes.reduce((a, b) => a + b, 0) / volumes.length).toFixed(0)),
      count: volumes.length
    };
  }

  // Get current time bucket
  const now = new Date();
  const currentBucket = `${now.getHours()}:${Math.floor(now.getMinutes() / 30) * 30}`;
  const currentPattern = timePatterns[currentBucket];
  
  // Find expected volume for current time
  const expectedVolume = currentPattern?.avg || 0;
  
  // Find peak volume time
  let peakBucket = null;
  let peakVolume = 0;
  for (const [bucket, data] of Object.entries(timePatterns)) {
    if (data.avg > peakVolume) {
      peakVolume = data.avg;
      peakBucket = bucket;
    }
  }

  return {
    currentBucket,
    expectedVolume,
    peakBucket,
    peakVolume,
    allBuckets: timePatterns
  };
}

// ============ VOLUME SIGNAL ============
function getVolumeSignal(ratio, trend) {
  if (ratio > 150 && trend === 'INCREASING') return { level: 'STRONG', message: 'Volume surging — market active', color: '#22c55e' };
  if (ratio > 120 && trend === 'INCREASING') return { level: 'BUILDING', message: 'Volume building — good sign', color: '#84cc16' };
  if (ratio > 100) return { level: 'NORMAL', message: 'Volume at average — steady market', color: '#f59e0b' };
  if (ratio > 50 && trend === 'INCREASING') return { level: 'PICKING_UP', message: 'Volume picking up — watch for confirmation', color: '#60a5fa' };
  if (ratio < 50 && trend === 'DECREASING') return { level: 'THIN', message: 'Thin volume — avoid large positions', color: '#ef4444' };
  if (ratio < 30) return { level: 'LOW', message: 'Very low volume — market inactive', color: '#ef4444' };
  return { level: 'NORMAL', message: 'Volume normal', color: '#f59e0b' };
}

// ============ MAIN FUNCTION ============
async function getKSE100VolumeAnalysis() {
  const ticks = await fetchKSE100Ticks();
  if (!ticks.length) return { error: "No KSE-100 data available" };

  const candles = buildKSEVolumeCandles(ticks, 300);
  const analysis = analyzeVolumePattern(candles);

  return {
    totalTicks: ticks.length,
    totalCandles: candles.length,
    lastUpdate: new Date().toISOString(),
    ...analysis
  };
}

module.exports = { getKSE100VolumeAnalysis, fetchKSE100Ticks };