/**
 * Safe Request Mode Handler
 * Implements webRequest hooks for header and URL parameter enforcement
 */

// ============ Request Hooks ============

console.debug('[CSL] Safe Request Mode handler loaded');

/**
 * Handle onBeforeSendHeaders - add global headers and YouTube-Restrict
 */
async function handleBeforeSendHeaders(details) {
  try {
    const state = await loadState();
    
    const shouldApply = await shouldApplySafeRequest(state);
    
    if (!shouldApply) {
      return;
    }
    
    const isProcessable = shouldProcessUrl(details.url);
    
    if (!isProcessable) {
      return;
    }
    
    const config = state.safeRequestMode;
    let headers = details.requestHeaders || [];
    
    // Apply header enforcement
    headers = enforceSafeHeaders(headers, details.url, config);
    
    return { requestHeaders: headers };
  } catch (err) {
    console.error('[CSL] Error in onBeforeSendHeaders:', err);
    return;
  }
}

/**
 * Handle onBeforeRequest - enforce URL parameters
 */
async function handleBeforeRequest(details) {
  try {
    const state = await loadState();
    
    const shouldApply = await shouldApplySafeRequest(state);
    
    if (!shouldApply) {
      return;
    }
    
    const isProcessable = shouldProcessUrl(details.url);
    
    if (!isProcessable) {
      return;
    }
    
    const config = state.safeRequestMode;
    
    if (config.perFrameEnforcement === 'top') {
      if (details.type !== 'main_frame' && details.type !== 'sub_frame') {
        return;
      }
    }
    
    let newUrl = details.url;
    
    // Enforce safe parameters
    newUrl = enforceSafeUrl(newUrl, config);
    
    if (newUrl !== details.url) {
      console.debug('[CSL] Safe Request Mode: URL parameter enforcement applied');
      return { redirectUrl: newUrl };
    }
  } catch (err) {
    console.error('[CSL] Error in onBeforeRequest:', err);
    return;
  }
}

// ============ Initialization ============

/**
 * Initialize Safe Request Mode handlers
 */
function initializeSafeRequestHandlers() {
  if (!browser?.webRequest) {
    console.error('[CSL] ERROR: browser.webRequest API is not available');
    return;
  }
  
  try {
    browser.webRequest.onBeforeSendHeaders.addListener(
      handleBeforeSendHeaders,
      { urls: ['<all_urls>'] },
      ['blocking', 'requestHeaders']
    );
    
    browser.webRequest.onBeforeRequest.addListener(
      handleBeforeRequest,
      { urls: ['<all_urls>'] },
      ['blocking']
    );
    
    console.debug('[CSL] Safe Request Mode handlers initialized');
  } catch (error) {
    console.error('[CSL] Error initializing Safe Request Mode handlers:', error);
  }
}
