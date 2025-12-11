/**
 * Safe Request Mode Handler
 * Implements webRequest hooks for header and URL parameter enforcement
 */

// ============ Request Hooks ============

console.debug('[CSL] Safe Request Mode handler loaded');

/**
 * Handle onBeforeSendHeaders - add global headers and YouTube-Restrict
 * NOTE: Must be async because we need to load state from storage
 */
function handleBeforeSendHeaders(details) {
  // Return a Promise that Firefox MV3 can handle
  return (async () => {
    try {
      console.debug('[CSL] onBeforeSendHeaders called for:', details.url);
      const state = await loadState();
      
      const shouldApply = await shouldApplySafeRequest(state);
      console.debug('[CSL] shouldApply:', shouldApply);
      
      if (!shouldApply) {
        console.debug('[CSL] Skipping - Safe Request Mode not active');
        return {};
      }
      
      const isProcessable = shouldProcessUrl(details.url);
      console.debug('[CSL] isProcessable:', isProcessable);
      
      if (!isProcessable) {
        console.debug('[CSL] Skipping - URL not processable');
        return {};
      }
      
      const config = state.safeRequestMode;
      let headers = details.requestHeaders || [];
      
      console.debug('[CSL] onBeforeSendHeaders - original headers:', headers.length);
      
      // Apply header enforcement
      headers = enforceSafeHeaders(headers, details.url, config);
      
      console.debug('[CSL] onBeforeSendHeaders - modified headers:', headers.length);
      
      // Log the actual headers being returned
      const preferHeader = headers.find(h => h.name.toLowerCase() === 'prefer');
      const youtubeHeader = headers.find(h => h.name.toLowerCase() === 'youtube-restrict');
      console.debug('[CSL] Prefer header:', preferHeader);
      console.debug('[CSL] YouTube-Restrict header:', youtubeHeader);
      
      const result = { requestHeaders: headers };
      console.debug('[CSL] onBeforeSendHeaders - returning:', JSON.stringify(result, null, 2));
      
      return result;
    } catch (err) {
      console.error('[CSL] Error in onBeforeSendHeaders:', err);
      return {};
    }
  })();
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
