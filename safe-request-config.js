/**
 * Safe Request Mode Configuration
 * Defines provider rules and matching logic for search engines and video platforms
 */

// ============ Provider Rules ============

const PROVIDER_RULES = {
  google: {
    name: 'Google Search',
    match: (hostname) => /\.google\.[^/]+$/.test(hostname),
    paths: ['/search', '/complete/search'],
    enforce: (url, config) => {
      if (!config.providers.google.enabled) return url;
      if (!config.providers.google.useParam) return url;
      
      const urlObj = new URL(url);
      const currentSafe = urlObj.searchParams.get('safe');
      
      // Only enforce if missing or has relaxed value
      if (!currentSafe || ['off', 'images', 'moderate'].includes(currentSafe)) {
        urlObj.searchParams.set('safe', 'active');
      }
      
      return urlObj.toString();
    }
  },
  
  bing: {
    name: 'Bing Search',
    match: (hostname) => hostname.endsWith('.bing.com'),
    enforce: (url, config) => {
      if (!config.providers.bing.enabled) return url;
      if (!config.providers.bing.useParam) return url;
      
      const urlObj = new URL(url);
      const currentAdlt = urlObj.searchParams.get('adlt');
      
      if (!currentAdlt || ['off', 'moderate'].includes(currentAdlt)) {
        urlObj.searchParams.set('adlt', 'strict');
      }
      
      // Optional redirect
      if (config.providers.bing.useRedirect && urlObj.hostname === 'www.bing.com') {
        urlObj.hostname = 'strict.bing.com';
      }
      
      return urlObj.toString();
    }
  },
  
  yahoo: {
    name: 'Yahoo Search',
    match: (hostname) => /search\.yahoo\./.test(hostname),
    enforce: (url, config) => {
      if (!config.providers.yahoo.enabled) return url;
      if (!config.providers.yahoo.useParam) return url;
      
      const urlObj = new URL(url);
      const currentVm = urlObj.searchParams.get('vm');
      
      if (!currentVm || ['s', 'off'].includes(currentVm)) {
        urlObj.searchParams.set('vm', 'r');
      }
      
      return urlObj.toString();
    }
  },
  
  ddg: {
    name: 'DuckDuckGo',
    match: (hostname) => hostname === 'duckduckgo.com' || hostname === 'www.duckduckgo.com',
    enforce: (url, config) => {
      if (!config.providers.ddg.enabled) return url;
      if (!config.providers.ddg.useParam) return url;
      
      const urlObj = new URL(url);
      const currentKp = urlObj.searchParams.get('kp');
      
      if (!currentKp || ['-2', '-1', '0'].includes(currentKp)) {
        urlObj.searchParams.set('kp', '1');
      }
      
      return urlObj.toString();
    }
  },
  
  youtube: {
    name: 'YouTube',
    match: (hostname) => /(^|\.)((youtube|youtu|ytimg|googlevideo)\.com|youtu\.be)$/.test(hostname),
    isHeaderOnly: true
  },
  
  tumblr: {
    name: 'Tumblr',
    match: (hostname) => /(^|\.)tumblr\.com$/.test(hostname),
    isJsonFilter: true
  }
};

// ============ Default Configuration ============

const DEFAULT_SAFE_REQUEST_CONFIG = {
  enabled: false,
  addPreferSafeHeader: true,
  applyInPrivateWindows: true,
  forceUnderSelfLock: true,
  ignoreAllowlistUnderSelfLock: true,
  blockUserParamDowngrade: true,
  perFrameEnforcement: 'any',
  providers: {
    google: {
      enabled: true,
      useParam: true,
      enforceCookie: false,
      useRedirect: false
    },
    bing: {
      enabled: true,
      useParam: true,
      usePreferSafeHonor: true,
      useRedirect: false
    },
    yahoo: {
      enabled: true,
      useParam: true
    },
    ddg: {
      enabled: true,
      useParam: true,
      useRedirect: false
    },
    youtube: {
      enabled: true,
      headerMode: 'strict',
      useRestrictHostRedirect: false
    },
    tumblr: {
      enabled: true,
      filterMature: true
    }
  }
};

// ============ Utility Functions ============

/**
 * Check if URL matches a provider
 */
function matchesProvider(url, providerName) {
  try {
    const rule = PROVIDER_RULES[providerName];
    if (!rule) {
      console.log('[SafeRequest] No rule found for provider:', providerName);
      return false;
    }
    
    const urlObj = new URL(url);
    const hostMatches = rule.match(urlObj.hostname);
    console.log('[SafeRequest] matchesProvider check - provider:', providerName, 'hostname:', urlObj.hostname, 'hostMatches:', hostMatches);
    
    if (!hostMatches) return false;
    
    // Check path if specified
    if (rule.paths) {
      const pathMatches = rule.paths.some(p => urlObj.pathname.includes(p));
      console.log('[SafeRequest] Path check - paths:', rule.paths, 'pathname:', urlObj.pathname, 'pathMatches:', pathMatches);
      if (!pathMatches) {
        return false;
      }
    }
    
    console.log('[SafeRequest] ✓ URL matches provider:', providerName);
    return true;
  } catch (err) {
    console.error('[SafeRequest] Error in matchesProvider:', err);
    return false;
  }
}

/**
 * Get provider for URL
 */
function getProviderForUrl(url) {
  console.log('[SafeRequest] getProviderForUrl called for:', url);
  for (const [name, rule] of Object.entries(PROVIDER_RULES)) {
    if (matchesProvider(url, name)) {
      console.log('[SafeRequest] Found provider:', name);
      return name;
    }
  }
  console.log('[SafeRequest] No provider matched for URL');
  return null;
}

/**
 * Check if Safe Request Mode should be applied
 */
async function shouldApplySafeRequest(state) {
  console.log('[SafeRequest] Checking shouldApplySafeRequest...');
  console.log('[SafeRequest] state.safeRequestMode:', state.safeRequestMode);
  
  // Check if explicitly enabled
  if (state.safeRequestMode.enabled) {
    console.log('[SafeRequest] Safe Request Mode is explicitly enabled');
    return true;
  }
  
  // Check if forced by Self-Lock
  if (state.selfLock.active && state.safeRequestMode.forceUnderSelfLock) {
    console.log('[SafeRequest] Safe Request Mode forced by Self-Lock');
    return true;
  }
  
  console.log('[SafeRequest] Safe Request Mode is NOT active');
  return false;
}

/**
 * Check if URL should be processed (not internal extension)
 */
function shouldProcessUrl(url) {
  return !url.startsWith('moz-extension://') && !url.startsWith('chrome-extension://');
}
