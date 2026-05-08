/**
 * Volume Analysis Service — Intraday Only
 * Confirms trades based on volume patterns
 */

// ============ STOCK-LEVEL VOLUME CONFIRMATION ============
function analyzeStockVolume(stock) {
  const price = stock.price || stock.close || 0;
  const volume = stock.volume || 0;
  const volumeRatio = stock.volumeRatio || 100;
  const volumeSignal = stock.volumeSignal || 'Normal';
  const changePercent = stock.changePercent || 0;
  const trend15Min = stock.trend15Min || 'NEUTRAL';
  const vwapSignal = stock.vwapSignal || 'Neutral';
  const signal = stock.signal || 'NEUTRAL';

  // ============ VOLUME SURGE DETECTION ============
  let volumeLevel = 'NORMAL';
  if (volumeRatio > 200) volumeLevel = 'EXPLOSIVE';
  else if (volumeRatio > 150) volumeLevel = 'VERY_HIGH';
  else if (volumeRatio > 120) volumeLevel = 'HIGH';
  else if (volumeRatio < 50) volumeLevel = 'VERY_LOW';
  else if (volumeRatio < 80) volumeLevel = 'LOW';

  // ============ VOLUME CONFIRMATION SCORE (0-100) ============
  let confirmationScore = 50;
  let confirmationType = 'NEUTRAL';
  const reasons = [];

  // Volume + Price direction alignment
  if (volumeRatio > 120 && changePercent > 1) {
    confirmationScore += 20;
    reasons.push('High volume confirms uptrend');
  } else if (volumeRatio > 120 && changePercent < -1) {
    confirmationScore += 20;
    reasons.push('High volume confirms downtrend');
  } else if (volumeRatio > 120 && Math.abs(changePercent) < 0.5) {
    confirmationScore -= 15;
    reasons.push('High volume but no price movement — distribution');
  }

  // Volume + VWAP confirmation
  if (volumeRatio > 120 && vwapSignal === 'Bullish' && changePercent > 0) {
    confirmationScore += 15;
    reasons.push('Volume + VWAP bullish alignment');
  } else if (volumeRatio > 120 && vwapSignal === 'Bearish' && changePercent < 0) {
    confirmationScore += 15;
    reasons.push('Volume + VWAP bearish alignment');
  } else if (volumeRatio > 120 && vwapSignal === 'Bullish' && changePercent < 0) {
    confirmationScore -= 10;
    reasons.push('Bullish VWAP but price falling — weakness');
  } else if (volumeRatio > 120 && vwapSignal === 'Bearish' && changePercent > 0) {
    confirmationScore -= 10;
    reasons.push('Bearish VWAP but price rising — fake move');
  }

  // Volume + Trend alignment
  if (volumeRatio > 120 && trend15Min === 'BULLISH' && changePercent > 0) {
    confirmationScore += 10;
    reasons.push('Volume confirms 15-min uptrend');
  } else if (volumeRatio > 120 && trend15Min === 'BEARISH' && changePercent < 0) {
    confirmationScore += 10;
    reasons.push('Volume confirms 15-min downtrend');
  }

  // Volume dry-up (low volume = possible reversal)
  if (volumeRatio < 50 && Math.abs(changePercent) > 2) {
    confirmationScore -= 20;
    reasons.push('Big move on low volume — likely fake, do not chase');
  }

  // Volume climax (potential reversal)
  if (volumeRatio > 200) {
    confirmationScore -= 10;
    reasons.push('Volume climax — possible exhaustion, watch for reversal');
  }

  // Volume + Signal confirmation
  if (volumeRatio > 120 && signal.includes('BUY') && changePercent > 0) {
    confirmationScore += 10;
  } else if (volumeRatio > 120 && signal.includes('SELL') && changePercent < 0) {
    confirmationScore += 10;
  }

  // Clamp score
  confirmationScore = Math.min(100, Math.max(0, confirmationScore));

  // Determine confirmation type
  if (confirmationScore >= 70) confirmationType = 'STRONG_CONFIRM';
  else if (confirmationScore >= 60) confirmationType = 'CONFIRMED';
  else if (confirmationScore >= 40) confirmationType = 'NEUTRAL';
  else if (confirmationScore >= 25) confirmationType = 'WEAK';
  else confirmationType = 'FAKE_MOVE';

  // Trading action based on volume
  let action = 'WAIT';
  if (confirmationType === 'STRONG_CONFIRM' && changePercent > 0 && signal.includes('BUY')) action = 'BUY';
  else if (confirmationType === 'STRONG_CONFIRM' && changePercent < 0 && signal.includes('SELL')) action = 'SELL';
  else if (confirmationType === 'CONFIRMED' && changePercent > 0) action = 'CONSIDER_BUY';
  else if (confirmationType === 'CONFIRMED' && changePercent < 0) action = 'CONSIDER_SELL';
  else if (confirmationType === 'FAKE_MOVE') action = 'AVOID';
  else if (confirmationType === 'WEAK') action = 'WAIT';
  else action = 'MONITOR';

  return {
    volumeLevel,
    volumeRatio,
    confirmationScore,
    confirmationType,
    action,
    reasons: reasons.slice(0, 4),
    entryCondition: confirmationScore >= 60 ? 'Volume confirms — trade with confidence' : 'Volume not confirming — wait or use tight stop',
    isTradeable: confirmationScore >= 60
  };
}

// ============ KSE-100 MARKET VOLUME ANALYSIS ============
function analyzeMarketVolume(allStocks) {
  const valid = allStocks.filter(s => s.price && s.volume);
  if (!valid.length) return null;

  // Aggregate volume data
  const totalVolume = valid.reduce((sum, s) => sum + (s.volume || 0), 0);
  const avgVolumeRatio = valid.reduce((sum, s) => sum + (s.volumeRatio || 100), 0) / valid.length;
  const highVolumeStocks = valid.filter(s => s.volumeRatio > 120).length;
  const lowVolumeStocks = valid.filter(s => s.volumeRatio < 80).length;
  const normalVolumeStocks = valid.filter(s => s.volumeRatio >= 80 && s.volumeRatio <= 120).length;

  // Volume breadth
  const volumeBreadth = (highVolumeStocks / valid.length) * 100;

  // Stocks with volume confirming uptrend
  const volumeConfirmedBuy = valid.filter(s => {
    const v = analyzeStockVolume(s);
    return v.confirmationType === 'STRONG_CONFIRM' && s.changePercent > 0;
  });

  // Stocks with volume confirming downtrend
  const volumeConfirmedSell = valid.filter(s => {
    const v = analyzeStockVolume(s);
    return v.confirmationType === 'STRONG_CONFIRM' && s.changePercent < 0;
  });

  // Market volume sentiment
  let marketVolumeSentiment = 'NEUTRAL';
  if (volumeBreadth > 60 && volumeConfirmedBuy.length > volumeConfirmedSell.length) {
    marketVolumeSentiment = 'BULLISH';
  } else if (volumeBreadth > 60 && volumeConfirmedSell.length > volumeConfirmedBuy.length) {
    marketVolumeSentiment = 'BEARISH';
  } else if (volumeBreadth < 30) {
    marketVolumeSentiment = 'LOW_ACTIVITY';
  }

  // Trading advice
  let advice = 'Market volume normal — trade setups with volume confirmation';
  if (marketVolumeSentiment === 'BULLISH') advice = 'Market-wide volume confirms uptrend — favor long trades';
  else if (marketVolumeSentiment === 'BEARISH') advice = 'Market-wide volume confirms downtrend — favor shorts or stay cash';
  else if (marketVolumeSentiment === 'LOW_ACTIVITY') advice = 'Low volume across market — avoid trading, wait for volume';

  return {
    totalVolume,
    avgVolumeRatio: parseFloat(avgVolumeRatio.toFixed(1)),
    highVolumeStocks,
    lowVolumeStocks,
    normalVolumeStocks,
    volumeBreadth: parseFloat(volumeBreadth.toFixed(1)),
    volumeConfirmedBuy: volumeConfirmedBuy.map(s => ({ symbol: s.symbol, price: s.price, volumeRatio: s.volumeRatio })),
    volumeConfirmedSell: volumeConfirmedSell.map(s => ({ symbol: s.symbol, price: s.price, volumeRatio: s.volumeRatio })),
    marketVolumeSentiment,
    advice
  };
}

// ============ DELIVERY VS SPECULATIVE VOLUME ============
function classifyVolumeType(stock) {
  // Higher price + high volume = delivery buying (strong)
  // Big price swing + high volume = speculative
  const changePercent = Math.abs(stock.changePercent || 0);
  const volumeRatio = stock.volumeRatio || 100;

  if (volumeRatio > 150 && changePercent < 1) return 'DELIVERY'; // Steady accumulation
  if (volumeRatio > 150 && changePercent > 3) return 'SPECULATIVE'; // Big move, could reverse
  if (volumeRatio > 120 && changePercent < 1.5) return 'DELIVERY_LEANING';
  if (volumeRatio < 80 && changePercent > 2) return 'LOW_VOLUME_RALLY'; // Suspect move
  return 'NORMAL';
}

module.exports = { analyzeStockVolume, analyzeMarketVolume, classifyVolumeType };