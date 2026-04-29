const ti = require("technicalindicators");

/**
 * Add comprehensive technical indicators to candlestick data
 */
function addIndicators(candles) {
  if (!candles || candles.length === 0) return [];
  
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  // === Moving Averages ===
  const ema9 = ti.EMA.calculate({ values: closes, period: 9 });
  const ema20 = ti.EMA.calculate({ values: closes, period: 20 });
  const ema50 = ti.EMA.calculate({ values: closes, period: 50 });
  const sma20 = ti.SMA.calculate({ values: closes, period: 20 });
  const volumeAvg = ti.SMA.calculate({ values: volumes, period: 20 });
  
  // === RSI (7-period for faster signals) ===
  const rsi = ti.RSI.calculate({ values: closes, period: 7 });
  
  // === MACD (12, 26, 9) ===
  const macdData = ti.MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  // === Bollinger Bands (20, 2) ===
  const bb = ti.BollingerBands.calculate({
    values: closes,
    period: 20,
    stdDev: 2
  });

  // === ATR (14) ===
  const atr = ti.ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  });

  // === Stochastic (5, 3, 3) - Fast for intraday ===
  const stoch = ti.Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 5,
    signalPeriod: 3
  });

  // === VWAP ===
  const vwap = calculateVWAP(candles);
  
  // === ADX (14) - Trend Strength ===
  const adx = ti.ADX.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  });

  // === Williams %R (14) ===
  const williamsR = ti.WilliamsR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  });

  // === CCI (20) ===
  const cci = ti.CCI.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 20
  });

  return candles.map((c, i) => {
    const rsiIndex = i - (closes.length - rsi.length);
    const ema9Index = i - (closes.length - ema9.length);
    const ema20Index = i - (closes.length - ema20.length);
    const ema50Index = i - (closes.length - ema50.length);
    const sma20Index = i - (closes.length - sma20.length);
    const volIndex = i - (volumes.length - volumeAvg.length);
    const macdIndex = i - (closes.length - macdData.length);
    const bbIndex = i - (closes.length - bb.length);
    const atrIndex = i - (closes.length - atr.length);
    const stochIndex = i - (closes.length - stoch.length);
    const vwapIndex = i - (closes.length - vwap.length);
    const adxIndex = i - (closes.length - adx.length);
    const wrIndex = i - (closes.length - williamsR.length);
    const cciIndex = i - (closes.length - cci.length);

    const latestClose = c.close;
    const ema9Val = ema9[ema9Index] || latestClose;
    const ema20Val = ema20[ema20Index] || latestClose;
    const ema50Val = ema50[ema50Index] || latestClose;
    const vwapVal = vwap[vwapIndex] || latestClose;

    return {
      ...c,
      // Price & Moving Averages
      price: latestClose,
      ema9: ema9Val,
      ema20: ema20Val,
      ema50: ema50Val,
      sma20: sma20[sma20Index] || latestClose,
      
      // Percentage from MAs
      pctFromEma9: ((latestClose - ema9Val) / ema9Val) * 100,
      pctFromEma20: ((latestClose - ema20Val) / ema20Val) * 100,
      pctFromEma50: ((latestClose - ema50Val) / ema50Val) * 100,
      pctFromVWAP: ((latestClose - vwapVal) / vwapVal) * 100,
      
      // Momentum
      rsi: rsi[rsiIndex] || null,
      rsiSignal: getRSISignal(rsi[rsiIndex]),
      
      // MACD
      macd: macdData[macdIndex]?.MACD || null,
      macdSignal: macdData[macdIndex]?.signal || null,
      macdHistogram: macdData[macdIndex]?.histogram || null,
      macdTrend: macdData[macdIndex]?.MACD > macdData[macdIndex]?.signal ? 'Bullish' : 'Bearish',
      
      // Bollinger Bands
      bbUpper: bb[bbIndex]?.upper || null,
      bbMiddle: bb[bbIndex]?.middle || null,
      bbLower: bb[bbIndex]?.lower || null,
      bbPosition: bb[bbIndex] ? ((latestClose - bb[bbIndex].lower) / (bb[bbIndex].upper - bb[bbIndex].lower)) * 100 : null,
      bbWidth: bb[bbIndex] ? ((bb[bbIndex].upper - bb[bbIndex].lower) / bb[bbIndex].middle) * 100 : null,
      bbSignal: getBBSignal(latestClose, bb[bbIndex]),
      
      // Volume
      volumeAvg: volumeAvg[volIndex] || null,
      volumeRatio: volumeAvg[volIndex] ? (c.volume / volumeAvg[volIndex]) * 100 : 100,
      volumeSignal: volumeAvg[volIndex] ? (c.volume > volumeAvg[volIndex] * 1.2 ? 'High' : c.volume < volumeAvg[volIndex] * 0.8 ? 'Low' : 'Normal') : 'Normal',
      
      // ATR
      atr: atr[atrIndex] || null,
      atrPercent: atr[atrIndex] ? (atr[atrIndex] / latestClose) * 100 : null,
      
      // Stochastic
      stochK: stoch[stochIndex]?.k || null,
      stochD: stoch[stochIndex]?.d || null,
      stochSignal: getStochSignal(stoch[stochIndex]?.k, stoch[stochIndex]?.d),
      
      // VWAP
      vwap: vwapVal,
      vwapSignal: latestClose > vwapVal ? 'Bullish' : 'Bearish',
      
      // ADX
      adx: adx[adxIndex]?.adx || null,
      adxTrend: adx[adxIndex]?.adx > 25 ? 'Trending' : 'Ranging',
      
      // Williams %R
      williamsR: williamsR[wrIndex] || null,
      wrSignal: getWRSignal(williamsR[wrIndex]),
      
      // CCI
      cci: cci[cciIndex] || null,
      cciSignal: getCCISignal(cci[cciIndex]),
    };
  });
}

/**
 * Calculate VWAP
 */
function calculateVWAP(candles) {
  const vwap = [];
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const pv = typicalPrice * c.volume;
    
    cumulativePV += pv;
    cumulativeVolume += c.volume;
    
    vwap.push(cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : typicalPrice);
  }
  
  return vwap;
}

/**
 * Analyze 15-minute trend for entry/exit signals
 */
function analyzeTrend15Min(candles) {
  if (!candles || candles.length < 5) {
    return {
      trend: 'NEUTRAL',
      strength: 0,
      entrySignal: null,
      exitSignal: null,
      reason: 'Insufficient data',
      higherHighs: false,
      lowerLows: false,
      emaAlignment: 'NEUTRAL'
    };
  }
  
  const last5 = candles.slice(-5);
  const last3 = candles.slice(-3);
  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];
  
  let trendScore = 0;
  const reasons = [];
  
  // === 1. Higher Highs / Higher Lows (Uptrend) ===
  let higherHighs = true;
  let higherLows = true;
  let lowerHighs = true;
  let lowerLows = true;
  
  for (let i = 1; i < last5.length; i++) {
    if (last5[i].high <= last5[i-1].high) higherHighs = false;
    if (last5[i].low <= last5[i-1].low) higherLows = false;
    if (last5[i].high >= last5[i-1].high) lowerHighs = false;
    if (last5[i].low >= last5[i-1].low) lowerLows = false;
  }
  
  if (higherHighs && higherLows) {
    trendScore += 30;
    reasons.push('Higher Highs & Higher Lows');
  } else if (higherHighs || higherLows) {
    trendScore += 15;
    reasons.push(higherHighs ? 'Higher Highs' : 'Higher Lows');
  }
  
  if (lowerHighs && lowerLows) {
    trendScore -= 30;
    reasons.push('Lower Highs & Lower Lows');
  } else if (lowerHighs || lowerLows) {
    trendScore -= 15;
    reasons.push(lowerHighs ? 'Lower Highs' : 'Lower Lows');
  }
  
  // === 2. EMA Alignment ===
  const ema9 = latest.ema9;
  const ema20 = latest.ema20;
  const ema50 = latest.ema50;
  
  let emaAlignment = 'NEUTRAL';
  if (ema9 > ema20 && ema20 > ema50) {
    trendScore += 25;
    emaAlignment = 'BULLISH';
    reasons.push('EMA9 > EMA20 > EMA50');
  } else if (ema9 < ema20 && ema20 < ema50) {
    trendScore -= 25;
    emaAlignment = 'BEARISH';
    reasons.push('EMA9 < EMA20 < EMA50');
  } else if (ema9 > ema20) {
    trendScore += 10;
    emaAlignment = 'SLIGHTLY_BULLISH';
    reasons.push('EMA9 > EMA20');
  } else if (ema9 < ema20) {
    trendScore -= 10;
    emaAlignment = 'SLIGHTLY_BEARISH';
    reasons.push('EMA9 < EMA20');
  }
  
  // === 3. Price vs EMAs ===
  if (latest.close > ema9 && latest.close > ema20) {
    trendScore += 15;
    reasons.push('Price above key EMAs');
  } else if (latest.close < ema9 && latest.close < ema20) {
    trendScore -= 15;
    reasons.push('Price below key EMAs');
  }
  
  // === 4. MACD Trend ===
  if (latest.macd > latest.macdSignal) {
    trendScore += 10;
    if (latest.macd > prev.macd) {
      trendScore += 5;
      reasons.push('MACD bullish & rising');
    } else {
      reasons.push('MACD bullish');
    }
  } else if (latest.macd < latest.macdSignal) {
    trendScore -= 10;
    if (latest.macd < prev.macd) {
      trendScore -= 5;
      reasons.push('MACD bearish & falling');
    } else {
      reasons.push('MACD bearish');
    }
  }
  
  // === 5. ADX Trend Strength ===
  if (latest.adx > 25) {
    if (trendScore > 0) {
      trendScore += 10;
      reasons.push('Strong trend (ADX > 25)');
    } else if (trendScore < 0) {
      trendScore -= 10;
      reasons.push('Strong trend (ADX > 25)');
    }
  }
  
  // === 6. Volume Confirmation ===
  const avgVolume = last5.reduce((sum, c) => sum + c.volume, 0) / last5.length;
  if (latest.volume > avgVolume * 1.2) {
    if (latest.close > prev.close) {
      trendScore += 10;
      reasons.push('High volume confirms up move');
    } else if (latest.close < prev.close) {
      trendScore -= 10;
      reasons.push('High volume confirms down move');
    }
  }
  
  // === 7. VWAP Position ===
  if (latest.close > latest.vwap) {
    trendScore += 10;
    reasons.push('Above VWAP');
  } else {
    trendScore -= 10;
    reasons.push('Below VWAP');
  }
  
  // === Determine Final Trend ===
  let trend = 'NEUTRAL';
  if (trendScore >= 40) trend = 'BULLISH';
  else if (trendScore >= 15) trend = 'SLIGHTLY_BULLISH';
  else if (trendScore <= -40) trend = 'BEARISH';
  else if (trendScore <= -15) trend = 'SLIGHTLY_BEARISH';
  
  const strength = Math.min(100, Math.abs(trendScore));
  
  // === Entry/Exit Signals ===
  let entrySignal = null;
  let exitSignal = null;
  
  // Entry Signals
  if (trend === 'BULLISH' || trend === 'SLIGHTLY_BULLISH') {
    // Pullback to EMA20 in uptrend
    if (latest.close <= ema20 * 1.01 && latest.close >= ema20 * 0.99) {
      entrySignal = '✅ Pullback to EMA20 - Good entry zone';
    } else if (latest.close <= latest.vwap * 1.01 && latest.close >= latest.vwap * 0.99) {
      entrySignal = '✅ At VWAP support - Consider entry';
    } else if (latest.bbPosition < 20) {
      entrySignal = '✅ Near lower Bollinger Band in uptrend - Buy dip';
    } else if (latest.rsi < 40) {
      entrySignal = '✅ RSI < 40 in uptrend - Oversold bounce opportunity';
    }
  }
  
  // Exit Signals
  if (trend === 'BEARISH' || trend === 'SLIGHTLY_BEARISH') {
    if (latest.close <= ema20 * 1.01 && latest.close >= ema20 * 0.99) {
      exitSignal = '❌ At EMA20 resistance - Consider exit';
    } else if (latest.close <= latest.vwap * 1.01 && latest.close >= latest.vwap * 0.99) {
      exitSignal = '❌ At VWAP resistance - Exit zone';
    } else if (latest.bbPosition > 80) {
      exitSignal = '❌ Near upper Bollinger Band in downtrend - Sell rally';
    } else if (latest.rsi > 60) {
      exitSignal = '❌ RSI > 60 in downtrend - Overbought exit';
    }
  }
  
  // Trend reversal signals
  if (prev2.macd < prev2.macdSignal && prev.macd > prev.macdSignal) {
    entrySignal = '🔄 MACD bullish crossover on 15-min - Strong buy signal';
  } else if (prev2.macd > prev2.macdSignal && prev.macd < prev.macdSignal) {
    exitSignal = '🔄 MACD bearish crossover on 15-min - Strong sell signal';
  }
  
  // Breakout signals
  const last10High = Math.max(...candles.slice(-10).map(c => c.high));
  const last10Low = Math.min(...candles.slice(-10).map(c => c.low));
  
  if (latest.close > last10High * 1.001) {
    entrySignal = '🚀 Breakout above 10-period high - Momentum entry';
  } else if (latest.close < last10Low * 0.999) {
    exitSignal = '💥 Breakdown below 10-period low - Exit immediately';
  }
  
  return {
    trend,
    strength,
    entrySignal,
    exitSignal,
    reason: reasons.join('; '),
    higherHighs: higherHighs || false,
    lowerLows: lowerLows || false,
    emaAlignment,
    trendScore
  };
}

// Signal helper functions
function getRSISignal(rsi) {
  if (rsi === null) return 'N/A';
  if (rsi < 30) return 'Oversold';
  if (rsi > 70) return 'Overbought';
  return 'Neutral';
}

function getBBSignal(price, bb) {
  if (!bb) return 'N/A';
  if (price <= bb.lower) return 'Buy';
  if (price >= bb.upper) return 'Sell';
  return 'Neutral';
}

function getStochSignal(k, d) {
  if (k === null || d === null) return 'N/A';
  if (k < 20 && d < 20) return 'Oversold';
  if (k > 80 && d > 80) return 'Overbought';
  if (k > d) return 'Bullish';
  return 'Bearish';
}

function getWRSignal(wr) {
  if (wr === null) return 'N/A';
  if (wr < -80) return 'Oversold';
  if (wr > -20) return 'Overbought';
  return 'Neutral';
}

function getCCISignal(cci) {
  if (cci === null) return 'N/A';
  if (cci < -100) return 'Oversold';
  if (cci > 100) return 'Overbought';
  return 'Neutral';
}

/**
 * Generate comprehensive trading signal
 */
function generateSignal(latest, prev) {
  if (!latest) return "NEUTRAL";
  
  let buyScore = 0;
  let sellScore = 0;
  
  // Price vs EMAs
  if (latest.price > latest.ema9 && latest.price > latest.ema20) buyScore += 2;
  if (latest.price < latest.ema9 && latest.price < latest.ema20) sellScore += 2;
  if (latest.ema9 > latest.ema20) buyScore += 2; else sellScore += 2;
  
  // RSI (7-period)
  if (latest.rsi < 30) buyScore += 2;
  if (latest.rsi > 70) sellScore += 2;
  
  // MACD
  if (latest.macd > latest.macdSignal) buyScore += 2; else sellScore += 1;
  
  // Volume confirmation
  if (latest.volumeRatio > 120) {
    if (latest.price > latest.ema20) buyScore += 2;
    else sellScore += 2;
  }
  
  // VWAP
  if (latest.price > latest.vwap) buyScore += 2; else sellScore += 2;
  
  // Bollinger
  if (latest.bbSignal === 'Buy') buyScore += 2;
  if (latest.bbSignal === 'Sell') sellScore += 2;
  
  // Stochastic
  if (latest.stochSignal === 'Oversold') buyScore += 2;
  if (latest.stochSignal === 'Overbought') sellScore += 2;
  
  // ADX confirmation
  if (latest.adx > 25) {
    if (buyScore > sellScore) buyScore += 1;
    else sellScore += 1;
  }
  
  const netScore = buyScore - sellScore;
  
  if (netScore >= 8) return "STRONG_BUY";
  if (netScore >= 5) return "BUY";
  if (netScore >= 2) return "WEAK_BUY";
  if (netScore <= -8) return "STRONG_SELL";
  if (netScore <= -5) return "SELL";
  if (netScore <= -2) return "WEAK_SELL";
  
  if (latest.rsi < 30) return "BUY_OVERSOLD";
  if (latest.rsi > 70) return "SELL_OVERBOUGHT";
  
  return "NEUTRAL";
}

module.exports = {
  addIndicators,
  generateSignal,
  analyzeTrend15Min
};