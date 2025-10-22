/**
 * Utility functions for Content Safety Lock
 */

// ============ Crypto Utilities ============

/**
 * Hash a passphrase using SHA-256
 */
async function hashPassphrase(passphrase) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passphrase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a passphrase against a hash
 */
async function verifyPassphrase(passphrase, hash) {
  const computed = await hashPassphrase(passphrase);
  return computed === hash;
}

/**
 * Generate a random phrase for unlock confirmation
 */
function generateRandomPhrase() {
  const words = [
    'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
    'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
    'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
    'yankee', 'zulu'
  ];
  const selected = [];
  for (let i = 0; i < 3; i++) {
    selected.push(words[Math.floor(Math.random() * words.length)]);
  }
  return selected.join('-');
}

/**
 * Generate recovery codes (one-time use)
 */
function generateRecoveryCodes(count = 5) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    codes.push(code);
  }
  return codes;
}

// ============ Time Utilities ============

/**
 * Get current epoch time in milliseconds
 */
function getNowEpochMs() {
  return Date.now();
}

/**
 * Get monotonic time (performance.now())
 */
function getMonotonicMs() {
  return performance.now();
}

/**
 * Format milliseconds to HH:MM:SS
 */
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format epoch time to readable date/time
 */
function formatEpochTime(epochMs) {
  const date = new Date(epochMs);
  return date.toLocaleString();
}

/**
 * Check if system clock was rolled back
 * Returns: { rolledBack: boolean, extendedDuration: number }
 */
function checkClockTamper(startedAtEpochMs, elapsedMonotonicMsAtStart) {
  const nowEpoch = Date.now();
  const nowMonotonic = performance.now();
  
  const expectedEpoch = startedAtEpochMs + (nowMonotonic - elapsedMonotonicMsAtStart);
  const rolledBack = nowEpoch < expectedEpoch;
  
  if (rolledBack) {
    // Extend by the monotonic delta to maintain lock duration
    const extendedDuration = expectedEpoch - nowEpoch;
    return { rolledBack: true, extendedDuration };
  }
  
  return { rolledBack: false, extendedDuration: 0 };
}

// ============ Label Detection & Parsing ============

/**
 * Parse meta tags from HTML head
 * Returns normalized signal object
 */
function parseMetaTags(headElement) {
  const signals = [];
  const raw = {};
  
  if (!headElement) return { signals, raw };
  
  // Check all meta tags (case-insensitive)
  const allMetas = headElement.querySelectorAll('meta');
  for (const meta of allMetas) {
    const name = (meta.getAttribute('name') || '').toLowerCase();
    const httpEquiv = (meta.getAttribute('http-equiv') || '').toLowerCase();
    const content = (meta.getAttribute('content') || '').toLowerCase();
    
    // Check for rating meta tag
    if (name === 'rating') {
      raw.rating = content;
      
      if (content.includes('adult')) {
        signals.push('GENERIC:adult');
      }
      if (content.startsWith('rta')) {
        signals.push('RTA');
      }
      
      // Check for mature/restricted
      const matureKeywords = ['mature', 'restricted', '18+'];
      if (matureKeywords.some(kw => content.includes(kw))) {
        signals.push('GENERIC:mature');
      }
    }
    
    // Check for PICS-Label meta tag
    if (httpEquiv === 'pics-label') {
      raw.picsLabel = content;
      
      // Simple ICRA/SafeSurf parsing
      if (content.includes('sexual') || content.includes('nudity')) {
        signals.push('ICRA:sexual');
      }
      if (content.includes('violence')) {
        signals.push('ICRA:violence');
      }
      if (content.includes('profanity') || content.includes('language')) {
        signals.push('ICRA:profanity');
      }
      if (content.includes('drugs') || content.includes('alcohol')) {
        signals.push('ICRA:drugs');
      }
      if (content.includes('gambling')) {
        signals.push('ICRA:gambling');
      }
    }
    
    // Check for age verification meta tags
    if (name === 'age-verification' || name === 'age-gate' || name === 'age-check') {
      raw.ageVerification = content;
      if (content.includes('required') || content.includes('true') || content.includes('blockify')) {
        signals.push('ICRA:ageVerification');
      }
    }
  }
  
  return { signals, raw };
}

/**
 * Check if signals match a self-lock scope
 */
function matchesSelfLockScope(signals, scope) {
  if (!signals || signals.length === 0) return false;
  
  const signalSet = new Set(signals);
  
  switch (scope) {
    case 'sexual':
      return signalSet.has('GENERIC:adult') || 
             signalSet.has('RTA') || 
             signalSet.has('ICRA:sexual');
    
    case 'sexual-violence':
      return signalSet.has('GENERIC:adult') || 
             signalSet.has('RTA') || 
             signalSet.has('ICRA:sexual') ||
             signalSet.has('ICRA:violence');
    
    case 'all':
      return signals.length > 0;
    
    default:
      return false;
  }
}

/**
 * Check if signals match parental policy categories
 */
function matchesCategoryPolicy(signals, parentalConfig) {
  if (!signals || signals.length === 0) return false;
  
  const signalSet = new Set(signals);
  
  // Always block generic adult or RTA
  if (signalSet.has('GENERIC:adult') || signalSet.has('RTA')) {
    return true;
  }
  
  // Check category toggles
  if (parentalConfig.categories.sexual && signalSet.has('ICRA:sexual')) {
    return true;
  }
  if (parentalConfig.categories.violence && signalSet.has('ICRA:violence')) {
    return true;
  }
  if (parentalConfig.categories.profanity && signalSet.has('ICRA:profanity')) {
    return true;
  }
  if (parentalConfig.categories.drugs && signalSet.has('ICRA:drugs')) {
    return true;
  }
  if (parentalConfig.categories.gambling && signalSet.has('ICRA:gambling')) {
    return true;
  }
  if (parentalConfig.categories.ageVerification && signalSet.has('ICRA:ageVerification')) {
    return true;
  }
  
  // Handle mature/restricted as adult
  if (parentalConfig.treatMatureAsAdult && signalSet.has('GENERIC:mature')) {
    return true;
  }
  
  return false;
}

/**
 * Get human-readable reason for blocking
 */
function getBlockReason(signals) {
  const reasons = [];
  const signalSet = new Set(signals);
  
  if (signalSet.has('RTA')) reasons.push('RTA Label');
  if (signalSet.has('GENERIC:adult')) reasons.push('Adult Content');
  if (signalSet.has('GENERIC:mature')) reasons.push('Mature Content');
  if (signalSet.has('ICRA:sexual')) reasons.push('Sexual/Nudity');
  if (signalSet.has('ICRA:violence')) reasons.push('Violence');
  if (signalSet.has('ICRA:profanity')) reasons.push('Profanity');
  if (signalSet.has('ICRA:drugs')) reasons.push('Drugs/Alcohol');
  if (signalSet.has('ICRA:gambling')) reasons.push('Gambling');
  if (signalSet.has('ICRA:ageVerification')) reasons.push('Age Verification Required');
  
  return reasons;
}

// ============ URL Utilities ============

/**
 * Extract domain from URL
 */
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if URL is in allow list
 */
function isInAllowList(url, allowList) {
  const domain = getDomain(url);
  if (!domain) return false;
  
  return allowList.some(item => {
    if (item.type === 'domain') {
      return domain === item.value || domain.endsWith('.' + item.value);
    } else if (item.type === 'exact') {
      return url === item.value;
    }
    return false;
  });
}

/**
 * Check if URL is in block list
 */
function isInBlockList(url, blockList) {
  const domain = getDomain(url);
  if (!domain) return false;
  
  return blockList.some(item => {
    if (item.type === 'domain') {
      return domain === item.value || domain.endsWith('.' + item.value);
    } else if (item.type === 'exact') {
      return url === item.value;
    }
    return false;
  });
}

// ============ Export for use in different contexts ============
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    hashPassphrase,
    verifyPassphrase,
    generateRandomPhrase,
    generateRecoveryCodes,
    getNowEpochMs,
    getMonotonicMs,
    formatDuration,
    formatEpochTime,
    checkClockTamper,
    parseMetaTags,
    matchesSelfLockScope,
    matchesCategoryPolicy,
    getBlockReason,
    getDomain,
    isInAllowList,
    isInBlockList
  };
}
