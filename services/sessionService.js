/**
 * Session Service - Trading session analysis and advice
 * Based on Pakistan Standard Time (PKT)
 */

const SESSIONS = {
  PRE_OPEN: { name: 'PRE_OPEN', start: 9, end: 9.5, label: 'Pre-Open (9:15-9:30)' },
  OPENING: { name: 'OPENING', start: 9.5, end: 10, label: 'Opening (9:30-10:00)' },
  MORNING: { name: 'MORNING', start: 10, end: 12, label: 'Morning (10:00-12:00)' },
  LUNCH: { name: 'LUNCH', start: 12, end: 13, label: 'Lunch Break (12:00-13:00)' },
  AFTERNOON: { name: 'AFTERNOON', start: 13, end: 15, label: 'Afternoon (13:00-15:00)' },
  CLOSING: { name: 'CLOSING', start: 15, end: 15.5, label: 'Closing (15:00-15:30)' },
  POST_CLOSE: { name: 'POST_CLOSE', start: 15.5, end: 16, label: 'Post-Close (15:30-16:00)' }
};

/**
 * Get current session based on time
 * @returns {object} Current session details
 */
function getCurrentSession() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours + (minutes / 60);
  
  // Check if market is open (Monday to Friday, 9:30 AM to 3:30 PM PKT)
  const day = now.getDay();
  const isWeekday = day >= 1 && day <= 5;
  const isMarketHours = currentTime >= 9.5 && currentTime <= 15.5;
  
  // Find current session
  let currentSession = null;
  for (const [key, session] of Object.entries(SESSIONS)) {
    if (currentTime >= session.start && currentTime < session.end) {
      currentSession = { key, ...session };
      break;
    }
  }
  
  // If no session found (outside trading hours)
  if (!currentSession) {
    if (currentTime < 9.5) {
      currentSession = { key: 'PRE_MARKET', label: 'Pre-Market', start: 0, end: 9.5 };
    } else if (currentTime >= 15.5) {
      currentSession = { key: 'POST_MARKET', label: 'Post-Market', start: 15.5, end: 24 };
    } else {
      currentSession = { key: 'CLOSED', label: 'Market Closed', start: 0, end: 24 };
    }
  }
  
  return {
    ...currentSession,
    isWeekday,
    isMarketHours: isWeekday && isMarketHours,
    currentTime: currentTime.toFixed(2),
    formattedTime: now.toLocaleTimeString('en-PK', { hour12: false })
  };
}

/**
 * Get trading advice based on current session
 * @returns {object} Trading advice
 */
function getTradingAdvice() {
  const session = getCurrentSession();
  
  const adviceMap = {
    PRE_OPEN: {
      action: 'PREPARE',
      advice: 'Review overnight news, prepare watchlist, set alerts',
      strategy: 'Do not trade - Wait for opening',
      riskLevel: 'LOW',
      suggestedActions: ['Review news', 'Check global markets', 'Prepare entry levels']
    },
    OPENING: {
      action: 'CAUTION',
      advice: 'High volatility - Wait for first 15 minutes to settle',
      strategy: 'Observe only - Enter after 10:00 AM',
      riskLevel: 'VERY_HIGH',
      suggestedActions: ['Watch price action', 'Note support/resistance', 'Wait for trend']
    },
    MORNING: {
      action: 'ACTIVE',
      advice: 'Best time for trend following - Look for established moves',
      strategy: 'Follow trend with volume confirmation',
      riskLevel: 'MODERATE',
      suggestedActions: ['Enter confirmed trends', 'Use normal position size', 'Set stops at ATR']
    },
    LUNCH: {
      action: 'REDUCE',
      advice: 'Low liquidity - Avoid new positions',
      strategy: 'Close weak positions, reduce exposure',
      riskLevel: 'LOW',
      suggestedActions: ['Take partial profits', 'Move stops to breakeven', 'Avoid new entries']
    },
    AFTERNOON: {
      action: 'SELECTIVE',
      advice: 'Reversal possible - Look for session reversals',
      strategy: 'Watch for morning trend continuation or reversal',
      riskLevel: 'MODERATE',
      suggestedActions: ['Monitor for reversals', 'Reduce position size', 'Watch volume']
    },
    CLOSING: {
      action: 'EXIT',
      advice: 'Exit all intraday positions by 3:20 PM',
      strategy: 'Close positions, avoid new entries',
      riskLevel: 'HIGH',
      suggestedActions: ['Close all positions', 'Take profits', 'No new trades']
    }
  };
  
  const advice = adviceMap[session.key] || {
    action: 'CLOSED',
    advice: 'Market is closed. Prepare for next session.',
    strategy: 'Review today\'s trades, plan for tomorrow',
    riskLevel: 'NONE',
    suggestedActions: ['Review performance', 'Plan tomorrow', 'Rest']
  };
  
  return {
    session: session.label,
    action: advice.action,
    advice: advice.advice,
    strategy: advice.strategy,
    riskLevel: advice.riskLevel,
    suggestedActions: advice.suggestedActions,
    timeRemaining: getTimeRemaining(session),
    sessionCharacteristic: getSessionCharacteristic(session.key)
  };
}

/**
 * Get detailed session advice
 */
function getDetailedAdvice() {
  const session = getCurrentSession();
  const tradingAdvice = getTradingAdvice();
  
  // Session-specific performance statistics
  const sessionStats = {
    PRE_OPEN: { avgVolume: 'Low', volatility: 'Low', bestFor: 'Preparation' },
    OPENING: { avgVolume: 'Very High', volatility: 'Very High', bestFor: 'Momentum scalping' },
    MORNING: { avgVolume: 'High', volatility: 'Medium', bestFor: 'Trend following' },
    LUNCH: { avgVolume: 'Low', volatility: 'Low', bestFor: 'Range trading' },
    AFTERNOON: { avgVolume: 'Medium', volatility: 'Medium', bestFor: 'Reversal trading' },
    CLOSING: { avgVolume: 'High', volatility: 'High', bestFor: 'Position squaring' }
  };
  
  const stats = sessionStats[session.key] || { avgVolume: 'N/A', volatility: 'N/A', bestFor: 'No trading' };
  
  return {
    ...tradingAdvice,
    statistics: stats,
    recommendations: generateSessionRecommendations(session.key),
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate session-specific recommendations
 */
function generateSessionRecommendations(sessionKey) {
  const recommendations = {
    PRE_OPEN: [
      'Check PSX pre-open auction rates',
      'Review global market performance',
      'Set price alerts on key levels'
    ],
    OPENING: [
      'Wait 15 minutes for volatility to settle',
      'Do not chase opening gaps',
      'Look for confirmed breakouts after 9:50 AM'
    ],
    MORNING: [
      'Follow the established trend',
      'Enter with volume confirmation',
      'Set stops at 1.5x ATR'
    ],
    LUNCH: [
      'Avoid opening new positions',
      'Take partial profits on existing trades',
      'Move stops to breakeven'
    ],
    AFTERNOON: [
      'Watch for reversal patterns',
      'Reduce position size by 50%',
      'Focus on high volume stocks'
    ],
    CLOSING: [
      'Exit all positions by 3:20 PM',
      'Do not enter new trades after 3:00 PM',
      'Square off options positions'
    ]
  };
  
  return recommendations[sessionKey] || ['Market closed - Prepare for next day'];
}

/**
 * Get time remaining in current session
 */
function getTimeRemaining(session) {
  if (!session.end) return 'N/A';
  
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours + (minutes / 60);
  
  const remaining = session.end - currentTime;
  
  if (remaining <= 0) return 'Session ended';
  
  const remainingHours = Math.floor(remaining);
  const remainingMinutes = Math.round((remaining - remainingHours) * 60);
  
  if (remainingHours > 0) {
    return `${remainingHours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
}

/**
 * Get session characteristics for display
 */
function getSessionCharacteristic(sessionKey) {
  const characteristics = {
    PRE_OPEN: '🔵 Preparation - Low activity, ideal for planning',
    OPENING: '🔴 High volatility - Wait for stability',
    MORNING: '🟢 Trend develops - Best for entries',
    LUNCH: '🟡 Low liquidity - Reduce activity',
    AFTERNOON: '🟠 Reversal possible - Watch for signals',
    CLOSING: '🔴 Exit window - Close positions'
  };
  
  return characteristics[sessionKey] || '⚪ Market closed';
}

/**
 * Check if service is available
 */
function isAvailable() {
  return true;
}

module.exports = {
  getCurrentSession,
  getTradingAdvice,
  getDetailedAdvice,
  getSessionCharacteristic,
  isAvailable
};