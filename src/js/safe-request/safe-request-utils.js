/**
 * Safe Request Mode Utilities
 * Helper functions for URL and header manipulation
 */

// ============ URL Parameter Utilities ============

/**
 * Get a URL parameter value
 * @param {string} url - The URL to check
 * @param {string} key - The parameter name
 * @returns {string|null} The parameter value or null if not found
 */
function getParam(url, key) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get(key);
  } catch {
    return null;
  }
}

/**
 * Set URL parameter
 */
function setParam(url, key, value) {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set(key, value);
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Remove URL parameter
 */
function removeParam(url, key) {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(key);
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Check if parameter value is relaxed (unsafe)
 */
function isRelaxedParam(paramValue, relaxedValues) {
  if (!paramValue) return true; // Missing is considered relaxed
  return relaxedValues.includes(paramValue.toLowerCase());
}

/**
 * Enforce safe parameter value
 */
function enforceParam(url, key, strictValue, relaxedValues) {
  try {
    const current = getParam(url, key);
    
    if (!current || isRelaxedParam(current, relaxedValues)) {
      return setParam(url, key, strictValue);
    }
    
    return url;
  } catch {
    return url;
  }
}

/**
 * Redirect hostname
 */
function redirectHost(url, fromHost, toHost) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === fromHost) {
      urlObj.hostname = toHost;
    }
    return urlObj.toString();
  } catch {
    return url;
  }
}

// ============ Header Utilities ============

/**
 * Find header by name (case-insensitive)
 */
function findHeader(headers, name) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase());
}

/**
 * Set or replace header
 */
function setHeader(headers, name, value) {
  // Remove existing header with same name (case-insensitive)
  const filtered = headers.filter(h => h.name.toLowerCase() !== name.toLowerCase());
  
  // Add new header
  filtered.push({ name, value });
  
  return filtered;
}

/**
 * Add header if not present
 */
function addHeaderIfMissing(headers, name, value) {
  if (findHeader(headers, name)) {
    return headers;
  }
  return [...headers, { name, value }];
}

/**
 * Ensure Prefer: safe header
 */
function ensurePreferSafeHeader(headers) {
  return setHeader(headers, 'Prefer', 'safe');
}

/**
 * Ensure YouTube-Restrict header
 */
function ensureYouTubeRestrictHeader(headers, mode) {
  const value = mode === 'strict' ? 'Strict' : 'Moderate';
  return setHeader(headers, 'YouTube-Restrict', value);
}

// ============ URL Enforcement ============

/**
 * Enforce safe parameters on URL based on provider rules
 */
function enforceSafeUrl(url, config) {
  if (!config.enabled) {
    return url;
  }
  
  let originalUrl = url;
  
  // Google
  if (matchesProvider(url, 'google')) {
    url = PROVIDER_RULES.google.enforce(url, config);
  }
  
  // Bing
  if (matchesProvider(url, 'bing')) {
    url = PROVIDER_RULES.bing.enforce(url, config);
  }
  
  // Yahoo
  if (matchesProvider(url, 'yahoo')) {
    url = PROVIDER_RULES.yahoo.enforce(url, config);
  }
  
  // DuckDuckGo
  if (matchesProvider(url, 'ddg')) {
    url = PROVIDER_RULES.ddg.enforce(url, config);
  }
  
  return url;
}

/**
 * Enforce safe headers based on provider rules
 */
function enforceSafeHeaders(headers, url, config) {
  if (!config.enabled) {
    return headers;
  }
  
  // Add global Prefer: safe header
  if (config.addPreferSafeHeader) {
    headers = ensurePreferSafeHeader(headers);
  }
  
  // YouTube-Restrict header
  if (config.providers.youtube.enabled) {
    const providerName = getProviderForUrl(url);
    if (providerName === 'youtube') {
      headers = ensureYouTubeRestrictHeader(headers, config.providers.youtube.headerMode);
    }
  }
  
  console.debug('[CSL] enforceSafeHeaders returning', headers.length, 'headers');
  return headers;
}
