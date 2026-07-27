/**
 * Content Script for Content Safety Lock
 * Detects labels and communicates with background worker
 */

console.error('[CSL] Content script STARTING EXECUTION');

// Import utilities
// Note: utils.js functions are available globally since it's loaded before this script

// ============ Label Detection ============

/**
 * Detect age verification elements in DOM
 */
function detectAgeVerificationElements() {
  const ageVerificationKeywords = ['ageverifier', 'ageverification', 'agegate', 'agecheck', 'ageokay'];
  
  // Helper function to normalize strings: lowercase and remove non-letter characters
  function normalize(str) {
    // Convert to string in case it's a DOMTokenList or other object
    const strValue = String(str || '');
    return strValue.toLowerCase().replace(/[^a-z]/g, '');
  }
  
  // Normalize keywords for comparison
  const normalizedKeywords = ageVerificationKeywords.map(normalize);
  
  // Regex patterns for common age requirement messages
  const ageRequirementPatterns = [
    /you\s+must\s+be\s+(?:at\s+least\s+)?(?:over\s+)?1[68]\s+(?:years?\s+)?(?:old)?/i,
    /must\s+be\s+1[68]\s+or\s+older/i,
    /only\s+(?:for\s+)?(?:users\s+)?(?:ages?\s+)?1[68]\+/i,
    /restricted\s+to\s+(?:ages?\s+)?1[68]\+/i,
    /18\s+(?:and\s+)?(?:over|older|above)/i,
    /21\s+(?:and\s+)?(?:over|older|above)/i,
    /you\s+are\s+21\s+years?\s+of\s+age\s+or\s+older/i,
    /age\s+(?:gate|verification|check)\b/i,
    /confirm\s+you\s+are\s+(?:at\s+least\s+)?1[68]/i,
    /old\s+enough\s+to\s+(?:view|access|use|enter)/i,
    /age\s+restricted\s+content/i
  ];
  
  // Check all elements in the document for ID/class matches
  const allElements = document.querySelectorAll('*');
  for (const element of allElements) {
    const normalizedId = normalize(element.id);
    const normalizedClassName = normalize(element.className);
    
    for (const keyword of normalizedKeywords) {
      if (normalizedId.includes(keyword) || normalizedClassName.includes(keyword)) {
        // Only count the element if it is actually visible to the user.
        // Hidden/collapsed age gate panels (e.g. Amazon's checkout-age-verification-panel
        // when no age-restricted item is in the cart) must not trigger a block.
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const isVisible = style.display !== 'none' &&
                          style.visibility !== 'hidden' &&
                          style.opacity !== '0' &&
                          ( rect.width > 0 && rect.height > 0 );
        if (!isVisible) {
          console.log('[CSL] Skipping hidden age verification element:', element.tagName, 'id:', element.id, 'class:', element.className);
          continue;
        }
        console.log('[CSL] Found age verification element:', element.tagName, 'id:', element.id, 'class:', element.className);
        return true;
      }
    }
  }
  
  // Check page text content for age requirement patterns
  const bodyText = document.body ? document.body.innerText : '';
  console.log('[CSL] Checking body text, length:', bodyText.length, 'first 200 chars:', bodyText.substring(0, 200));
  for (const pattern of ageRequirementPatterns) {
    if (pattern.test(bodyText)) {
      console.log('[CSL] Found age requirement text matching pattern:', pattern);
      return true;
    }
  }
  
  console.log('[CSL] No age verification patterns matched in body text');
  return false;
}

/**
 * Parse meta tags from document head
 */
function detectLabels() {
  const head = document.head;
  if (!head) {
    console.log('[CSL] No head element found');
    return { signals: [], details: [] };
  }
  
  const signals = [];
  const details = [];
  const raw = {};
  
  // Check rating meta tag (case-insensitive)
  const allMetas = head.querySelectorAll('meta');
  console.log('[CSL] Found', allMetas.length, 'meta tags');
  console.log('[CSL] Document readyState:', document.readyState);
  console.log('[CSL] Body exists:', !!document.body);
  
  for (const meta of allMetas) {
    const name = (meta.getAttribute('name') || '').toLowerCase();
    const httpEquiv = (meta.getAttribute('http-equiv') || '').toLowerCase();
    const content = (meta.getAttribute('content') || '').toLowerCase();
    
    if (name || httpEquiv) {
      console.log('[CSL] Meta tag - name:', name, 'httpEquiv:', httpEquiv, 'content:', content.substring(0, 50));
    }
    
    // Check for rating meta tag
    if (name === 'rating') {
      raw.rating = content;
      console.log('[CSL] Found rating meta tag:', content);
      
      if (content.includes('adult')) {
        signals.push('GENERIC:adult');
      }
      console.log('[CSL] RTA check - content:', JSON.stringify(content), 'length:', content.length, 'first 3 chars:', JSON.stringify(content.substring(0, 3)), 'startsWith(rta):', content.startsWith('rta'));
      if (content.startsWith('rta')) {
        console.log('[CSL] RTA detected! Adding RTA signal');
        signals.push('RTA');
      } else {
        console.log('[CSL] RTA not detected');
      }
      if (content.includes('mature') || content.includes('restricted') || content.includes('18+')) {
        signals.push('GENERIC:mature');
      }
    }
    
    // Check for PICS-Label meta tag
    if (httpEquiv === 'pics-label') {
      raw.picsLabel = content;
      console.log('[CSL] Found PICS-Label meta tag:', content);
      
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
      console.log('[CSL] Found age verification meta tag:', content);
      if (content.includes('required') || content.includes('true') || content.includes('blockify')) {
        signals.push('ICRA:ageVerification');
      }
    }
  }
  
  // Check meta/OG description vocabulary (proactive detection)
  if (typeof detectMetaVocabulary === 'function') {
    const vocabSignals = detectMetaVocabulary(head, null);
    console.log('[CSL] Meta vocabulary signals:', vocabSignals);
    for (const sig of vocabSignals) {
      if (!signals.includes(sig)) signals.push(sig);
    }
  }

  // Check for age verification DOM elements
  const hasAgeVerification = detectAgeVerificationElements();
  console.log('[CSL] Age verification check result:', hasAgeVerification);
  if (hasAgeVerification) {
    signals.push('ICRA:ageVerification');
  }
  
  // Check for 2257 compliance statements
  if (typeof detect2257Compliance === 'function') {
    const compliance2257Result = detect2257Compliance();
    if (compliance2257Result) {
      signals.push(compliance2257Result.signal);
      details.push(...compliance2257Result.details);
      console.log('[CSL] 2257 compliance signal detected');
    }
  }
  
  // Check for mature content on e-commerce platforms
  // Note: generateMatureContentSignals() is defined in mature-content-detectors.js
  if (typeof generateMatureContentSignals === 'function') {
    const matureSignals = generateMatureContentSignals();
    console.log('[CSL] Mature content signals:', matureSignals);
    
    // If vendor-specific signals are detected, remove generic adult/mature signals
    // to prevent them from bypassing vendor toggles
    if (matureSignals.length > 0) {
      const vendorSignalsDetected = matureSignals.some(s => s.startsWith('VENDOR:'));
      if (vendorSignalsDetected) {
        // Remove generic signals that would bypass vendor toggles
        const filteredSignals = signals.filter(s => s !== 'GENERIC:adult' && s !== 'GENERIC:mature');
        signals.length = 0;
        signals.push(...filteredSignals);
        console.log('[CSL] Vendor signals detected - removed generic adult/mature signals');
      }
    }
    
    signals.push(...matureSignals);
  }
  
  console.log('[CSL] Detected signals (final):', signals, 'Total signals:', signals.length);
  return { signals, details };
}

/**
 * Create and inject block overlay
 */
function injectBlockOverlay(blockData) {
  // Notify background that a block occurred (for increment feature)
  browser.runtime.sendMessage({
    type: 'BLOCK_OCCURRED'
  }).catch(err => {
    console.log('[CSL] Block notification sent (or not needed):', err);
  });
  
  // Remove any existing overlay
  const existing = document.getElementById('csl-block-overlay');
  if (existing) {
    existing.remove();
  }
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'csl-block-overlay';
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 2147483647 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
    pointer-events: auto !important;
  `;
  
  // Create content box
  const box = document.createElement('div');
  box.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 40px;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;
  
  // Title
  const title = document.createElement('h1');
  title.textContent = '🛡️ Blocked by Content Filter';
  title.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 28px;
    color: #333;
  `;
  box.appendChild(title);
  
  // Reason
  const reason = document.createElement('p');
  reason.textContent = `Reason: ${blockData.reasons.join(', ')}`;
  reason.style.cssText = `
    margin: 0 0 8px 0;
    font-size: 16px;
    color: #666;
  `;
  box.appendChild(reason);
  
  // Why (context details from detector, if available)
  if (blockData.details && blockData.details.length > 0) {
    const whyContainer = document.createElement('div');
    whyContainer.style.cssText = `
      margin: 0 0 24px 0;
      font-size: 13px;
      color: #888;
      text-align: left;
      background: #f9f9f9;
      border-radius: 6px;
      padding: 10px 14px;
      word-break: break-all;
    `;
    const whyLabel = document.createElement('span');
    whyLabel.textContent = 'Why:';
    whyLabel.style.cssText = 'font-weight: bold; display: block; margin-bottom: 4px;';
    whyContainer.appendChild(whyLabel);
    for (const detail of blockData.details) {
      const line = document.createElement('span');
      line.textContent = detail;
      line.style.cssText = 'display: block;';
      whyContainer.appendChild(line);
    }
    box.appendChild(whyContainer);
  }
  
  // URL display
  const urlDisplay = document.createElement('p');
  urlDisplay.textContent = `URL: ${blockData.url}`;
  urlDisplay.style.cssText = `
    margin: 24px 0 0 0;
    font-size: 12px;
    color: #999;
    word-break: break-all;
  `;
  box.appendChild(urlDisplay);
  
  overlay.appendChild(box);
  document.documentElement.appendChild(overlay);
  
  // Block all interactions
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  
  // Aggressively prevent removal or hiding of overlay
  const protectOverlay = () => {
    const currentOverlay = document.getElementById('csl-block-overlay');
    if (!currentOverlay || currentOverlay.style.display === 'none' || currentOverlay.style.visibility === 'hidden') {
      console.log('[CSL] Overlay was removed or hidden, re-injecting...');
      injectBlockOverlay(blockData);
    }
  };
  
  // Watch for attempts to remove or hide the overlay
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.removedNodes) {
          if (node.id === 'csl-block-overlay') {
            console.log('[CSL] Overlay removed by site script, re-injecting...');
            setTimeout(() => protectOverlay(), 0);
          }
        }
      }
    }
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Also check periodically
  setInterval(protectOverlay, 500);
  
  // Prevent site from removing overflow hidden
  const styleObserver = new MutationObserver(() => {
    if (document.documentElement.style.overflow !== 'hidden') {
      document.documentElement.style.overflow = 'hidden';
    }
    if (document.body && document.body.style.overflow !== 'hidden') {
      document.body.style.overflow = 'hidden';
    }
  });
  
  styleObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style']
  });
  
  if (document.body) {
    styleObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['style']
    });
  }
}

/**
 * Check if page should be blocked and inject overlay if needed
 */
async function checkAndBlock() {
  console.log('[CSL] *** checkAndBlock() CALLED ***');
  console.log('[CSL] URL:', window.location.href);
  console.log('[CSL] readyState:', document.readyState);
  console.log('[CSL] head exists:', !!document.head);
  console.log('[CSL] body exists:', !!document.body);
  
  // Don't block the extension's own pages
  if (location.protocol === 'moz-extension:') {
    console.log('[CSL] Skipping extension page');
    return;
  }
  
  console.log('[CSL] *** About to call detectLabels() ***');
  const { signals, details } = detectLabels();
  console.log('[CSL] checkAndBlock - signals:', signals);
  
  if (signals.length > 0) {
    try {
      console.log('[CSL] Sending CHECK_BLOCK message with signals:', signals);
      console.log('[CSL] *** ABOUT TO SEND MESSAGE TO BACKGROUND ***');
      const response = await browser.runtime.sendMessage({
        type: 'CHECK_BLOCK',
        signals,
        details
      });
      
      console.log('[CSL] *** RESPONSE RECEIVED FROM BACKGROUND ***', response);
      console.log('[CSL] Response from background:', response);
      
      if (response.shouldBlock) {
        console.log('[CSL] *** BLOCKING PAGE ***');
        console.log('[CSL] Blocking page - injecting overlay');
        injectBlockOverlay(response.blockData);
      } else {
        console.log('[CSL] *** PAGE ALLOWED ***');
        console.log('[CSL] Page allowed - no block');
      }
    } catch (err) {
      console.error('[CSL] *** BLOCK CHECK FAILED ***', err);
      console.error('[CSL] Block check failed:', err);
    }
  } else {
    console.log('[CSL] No signals detected - page allowed');
  }
}

/**
 * Watch for dynamic meta tag injection
 */
function watchForDynamicLabels() {
  let checkTimeout;
  
  const observer = new MutationObserver(() => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => {
      checkAndBlock();
    }, 100);
  });
  
  // Watch head for 5 seconds
  if (document.head) {
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content']
    });
    
    setTimeout(() => {
      observer.disconnect();
    }, 5000);
  }
}

/**
 * Collect candidate policy-page URLs from links on the current page and
 * ask the background script to fetch + scan them for age-verification
 * language.  Only runs on the top-level frame, once per page load, and only
 * when the page itself produced no signals (to avoid redundant work).
 */
async function checkPolicyPages() {
  if (window !== window.top) return;
  if (location.protocol === 'moz-extension:') return;

  // Gather candidate URLs from anchor text matching POLICY_PAGE_LINK_PATTERNS.
  const patterns = (typeof POLICY_PAGE_LINK_PATTERNS !== 'undefined')
    ? POLICY_PAGE_LINK_PATTERNS
    : ['terms of service', 'terms of use', 'terms and conditions', 'legal', 'about us', 'privacy policy'];

  const seen = new Set();
  const candidates = [];

  const anchors = document.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    const text = (anchor.textContent || anchor.innerText || '').trim().toLowerCase();
    const href = anchor.href;
    if (!href || !href.startsWith('http')) continue;

    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        if (!seen.has(href)) {
          seen.add(href);
          candidates.push(href);
        }
        break;
      }
    }

    if (candidates.length >= 3) break;
  }

  if (candidates.length === 0) {
    console.log('[CSL] checkPolicyPages: no candidate policy links found');
    return;
  }

  console.log('[CSL] checkPolicyPages: candidates:', candidates);

  try {
    const response = await browser.runtime.sendMessage({
      type: 'FETCH_POLICY_PAGES',
      urls: candidates,
      originUrl: window.location.href
    });

    if (response && response.signals && response.signals.length > 0) {
      console.log('[CSL] checkPolicyPages: signals from policy pages:', response.signals);
      const blockResponse = await browser.runtime.sendMessage({
        type: 'CHECK_BLOCK',
        signals: response.signals,
        details: response.details || []
      });
      if (blockResponse && blockResponse.shouldBlock) {
        console.log('[CSL] checkPolicyPages: blocking page based on policy-page signals');
        injectBlockOverlay(blockResponse.blockData);
      }
    } else {
      console.log('[CSL] checkPolicyPages: no signals from policy pages');
    }
  } catch (err) {
    console.log('[CSL] checkPolicyPages: error contacting background:', err);
  }
}

// ============ Initialization ============

// Run check at document_start
console.log('[CSL] Content script loaded for:', window.location.href);
console.log('[CSL] Initial readyState:', document.readyState);

// Always check immediately (for meta tags in head)
if (document.head) {
  console.log('[CSL] Head available immediately, running initial check');
  checkAndBlock();
}

// Also check when DOM is ready (for body text and dynamic content)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[CSL] DOMContentLoaded - checking for labels');
    checkAndBlock();
    watchForDynamicLabels();
    
    // Check again after a short delay to catch dynamically loaded age gates
    setTimeout(() => {
      console.log('[CSL] Delayed check (500ms) - catching dynamic content');
      checkAndBlock();
    }, 500);
    
    setTimeout(() => {
      console.log('[CSL] Delayed check (2000ms) - final catch');
      checkAndBlock();
    }, 2000);

    // Policy-page fetch runs after DOM is fully loaded (needs anchor links)
    setTimeout(() => {
      console.log('[CSL] Policy-page check (3000ms)');
      checkPolicyPages();
    }, 3000);
  });
} else {
  console.log('[CSL] Document already loaded - checking for labels');
  checkAndBlock();
  watchForDynamicLabels();
  
  // Check again after a short delay to catch dynamically loaded age gates
  setTimeout(() => {
    console.log('[CSL] Delayed check (500ms) - catching dynamic content');
    checkAndBlock();
  }, 500);
  
  setTimeout(() => {
    console.log('[CSL] Delayed check (2000ms) - final catch');
    checkAndBlock();
  }, 2000);

  // Policy-page fetch runs after DOM is fully loaded (needs anchor links)
  setTimeout(() => {
    console.log('[CSL] Policy-page check (3000ms)');
    checkPolicyPages();
  }, 3000);
}

// ============ Tumblr Safe Mode Interceptor ============

/**
 * Helper to inject a script with nonce support
 */
function injectScript(filename) {
  try {
    console.error('[CSL] Injecting script:', filename);
    const script = document.createElement('script');
    script.src = browser.runtime.getURL(filename);
    
    // Try to find a nonce from existing scripts
    // Reddit uses nonces for CSP
    const existingScript = document.querySelector('script[nonce]');
    if (existingScript) {
      const nonce = existingScript.nonce || existingScript.getAttribute('nonce');
      if (nonce) {
        script.setAttribute('nonce', nonce);
        console.error('[CSL] Applied nonce to injected script');
      }
    }
    
    (document.head || document.documentElement).appendChild(script);
    console.error('[CSL] Script injection command issued');
  } catch (err) {
    console.error('[CSL] Failed to inject script:', err);
  }
}

/**
 * Initialize Tumblr interception if enabled
 */
async function initTumblrInterception() {
  if (!window.location.hostname.includes('tumblr.com')) {
    return;
  }

  console.error('[CSL] Tumblr detected, checking Safe Request Mode settings...');

  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    const state = response.state;
    
    // Check if Safe Request Mode is active and Tumblr provider is enabled
    const safeRequest = state.safeRequestMode;
    const tumblrConfig = safeRequest.providers.tumblr;
    
    const shouldEnable = safeRequest.enabled &&
                         tumblrConfig && tumblrConfig.enabled;
    if (!shouldEnable) {
      console.error('[CSL] Tumblr Safe Mode not enabled');
      return;
    }
    
    console.error('[CSL] Injecting Tumblr Safe Mode interceptor');
    injectScript('js/interceptors/tumblr-interceptor.js');

    // Also check for a page-level mature-content gate (logged-out blog cover)
    checkTumblrMaturePage();

  } catch (err) {
    console.error('[CSL] Error initializing Tumblr interception:', err);
  }
}

/**
 * Detect Tumblr's logged-out / blog-level mature-content cover and block the
 * whole page via the standard CSL overlay. Uses only structural selectors
 * (BEM class + role attribute) to avoid breaking when copy changes.
 */
function checkTumblrMaturePage() {
  const SELECTOR = '.community-label-cover__wrapper, .content-warning-cover[role="alert"]';

  function tryBlock() {
    if (document.documentElement.dataset.cslTumblrPageBlocked) {
      return true;
    }
    const cover = document.querySelector(SELECTOR);
    if (!cover) return false;
    // Disambiguate from per-post community-label covers, which live inside <article>
    if (cover.closest('article')) return false;

    document.documentElement.dataset.cslTumblrPageBlocked = 'true';
    console.info('[CSL] Tumblr page-level mature gate detected, blocking page');
    injectBlockOverlay({
      blockType: 'content',
      reasons: ['Mature content (Tumblr)'],
      signals: ['tumblr_mature_blog_cover'],
      details: ['Tumblr served a logged-out mature-content gate for this blog.'],
      url: window.location.href
    });
    return true;
  }

  // Most cases are server-rendered, so an immediate check will succeed.
  if (tryBlock()) return;

  // Fallback: observe briefly in case the cover is hydrated after DOMContentLoaded.
  const observer = new MutationObserver(() => {
    if (tryBlock()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 5000);
}

// ============ Reddit Safe Mode Interceptor ============

/**
 * Initialize Reddit interception if enabled
 */
async function initRedditInterception() {
  if (!window.location.hostname.includes('reddit.com')) {
    return;
  }

  console.error('[CSL] Reddit detected, checking Safe Request Mode settings...');

  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    const state = response.state;

    // Check if Safe Request Mode is active and Reddit provider is enabled
    const safeRequest = state.safeRequestMode;
    // Handle case where reddit config doesn't exist yet in old state
    const redditConfig = safeRequest.providers.reddit;

    const shouldEnable = safeRequest.enabled &&
                         redditConfig && redditConfig.enabled;

    if (!shouldEnable) {
      console.error('[CSL] Reddit Safe Mode not enabled');
      return;
    }

    console.error('[CSL] Injecting Reddit Safe Mode interceptor');
    injectScript('js/interceptors/reddit-interceptor.js');

    // Check if this is an NSFW user profile or subreddit page
    checkRedditNsfwPages();

  } catch (err) {
    console.error('[CSL] Error initializing Reddit interception:', err);
  }
}

// ============ Bluesky Safe Mode Interceptor ============

/**
 * Initialize Bluesky interception if enabled
 */
async function initBlueskyInterception() {
  const hostname = window.location.hostname;
  if (!hostname.includes('bsky.app') && !hostname.includes('bsky.network')) {
    return;
  }

  console.error('[CSL] Bluesky detected, checking Safe Request Mode settings...');

  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    const state = response.state;

    // Check if Safe Request Mode is active and Bluesky provider is enabled
    const safeRequest = state.safeRequestMode;
    const blueskyConfig = safeRequest.providers.bluesky;

    const shouldEnable = safeRequest.enabled &&
                         blueskyConfig && blueskyConfig.enabled;

    if (!shouldEnable) {
      console.error('[CSL] Bluesky Safe Mode not enabled');
      return;
    }

    console.error('[CSL] Injecting Bluesky Safe Mode interceptor');

    // Inject config before the interceptor so it can read it
    const configScript = document.createElement('script');
    configScript.textContent = `
      window.__cslBlueskyConfig = {
        blockedLabels: ${JSON.stringify(blueskyConfig.blockedLabels || [])},
        ageSetting: ${JSON.stringify(blueskyConfig.ageSetting || '18+')}
      };
    `;
    (document.head || document.documentElement).appendChild(configScript);

    injectScript('js/interceptors/bluesky-interceptor.js');

  } catch (err) {
    console.error('[CSL] Error initializing Bluesky interception:', err);
  }
}

// Check if the current page is an NSFW user profile or subreddit and block it
function checkRedditNsfwPages() {
  const pathname = window.location.pathname;
  
  // Check if we're on a user profile or subreddit page
  const isUserProfile = pathname.match(/^\/user\/[^\/]+\/?$/);
  const isSubreddit = pathname.match(/^\/r\/[^\/]+\/?$/);
  
  if (!isUserProfile && !isSubreddit) {
    return;
  }
  
  // Function to check the reddit-page-data element
  function checkPageData() {
    const pageDataElement = document.querySelector('reddit-page-data');
    if (!pageDataElement) {
      return false;
    }
    
    const dataAttr = pageDataElement.getAttribute('data');
    if (!dataAttr) {
      return false;
    }
    
    try {
      const data = JSON.parse(dataAttr);
      
      // Check for NSFW user profile
      if (data.profile && data.profile.isNsfw === true) {
        console.info('[CSL] NSFW user profile detected, blocking page');
        const blockData = {
          blockType: 'content',
          reasons: ['User profile is marked as NSFW (18+)'],
          signals: ['reddit_nsfw_profile']
        };
        injectBlockOverlay(blockData);
        return true;
      }
      
      // Check for NSFW subreddit
      if (data.subreddit && data.subreddit.isNsfw === true) {
        console.info('[CSL] NSFW subreddit detected, blocking page');
        const blockData = {
          blockType: 'content',
          reasons: [`Subreddit ${data.subreddit.prefixedName || 'r/' + data.subreddit.name} is marked as NSFW (18+)`],
          signals: ['reddit_nsfw_subreddit']
        };
        injectBlockOverlay(blockData);
        return true;
      }
    } catch (err) {
      console.error('[CSL] Error checking reddit-page-data:', err);
    }
    
    return false;
  }
  
  // Check immediately
  if (checkPageData()) {
    return;
  }
  
  // Also check after a short delay in case the element loads later
  setTimeout(checkPageData, 100);
  setTimeout(checkPageData, 500);
}

// ============ Amazon Blocked-Category Interceptor ============

/**
 * Initialize Amazon interception if enabled
 *
 * Tied to the unified Parental Controls -> Adult Product Sales -> Amazon
 * vendor checkbox. When enabled, filters individual listings from blocked
 * Amazon browse-node categories (e.g. Sexual Wellness, Exotic Apparel);
 * complements the page-level breadcrumb blocker in
 * mature-content-detectors.js.
 */
async function initAmazonInterception() {
    if (!window.location.hostname.includes('amazon.')) {
        return;
    }

    console.log('[CSL] Amazon detected, checking parental controls settings...');

    try {
        const response = await browser.runtime.sendMessage({ type: 'GET_STATE' });
        const state = response.state;

        // Check if the Adult Product Sales category AND Amazon vendor are enabled
        const parental = state.parental || {};
        const categoryEnabled = parental.categories && parental.categories.adultProductSales;
        const amazonEnabled = parental.adultProductSalesVendors && parental.adultProductSalesVendors.amazon;

        if (!categoryEnabled || !amazonEnabled) {
            console.log('[CSL] Amazon blocked-category filtering not enabled (category:', categoryEnabled, 'amazon:', amazonEnabled, ')');
            return;
        }

        console.log('[CSL] Injecting Amazon blocked-category interceptor');
        injectScript('js/interceptors/amazon-interceptor.js');

    }
    catch (err) {
        console.error('[CSL] Error initializing Amazon interception:', err);
    }
}

// Run initialization
initTumblrInterception();
initRedditInterception();
initBlueskyInterception();
initAmazonInterception();
