/**
 * Mature Content Detection for E-commerce Platforms
 * Detects mature/adult product signals on various shopping and creator platforms
 * Based on platform-provided labels, categories, and toggles
 */

// ============ Helper Functions ============

/**
 * Normalize text for comparison (lowercase)
 */
function TXT(s) {
  return (s || '').toLowerCase();
}

/**
 * Check if text contains any of the given needles
 */
function hasText(root, needles) {
  const body = TXT(root.innerText || '');
  return needles.some(n => body.includes(n));
}

/**
 * Find breadcrumb text from common breadcrumb selectors
 */
function findBreadcrumbText() {
  const bc = document.querySelector('#wayfinding-breadcrumbs_feature_div, nav[aria-label*="breadcrumb"], .breadcrumb, [data-testid*="breadcrumb"]');
  return TXT(bc ? bc.innerText : '');
}

// ============ Platform Detectors ============

const detectors = {
  /**
   * Etsy - Detects mature-tagged listings
   * Looks for tags in "Explore more related searches" section via /market/ links
   */
  etsy(url) {
    if (!/\/\/(www\.)?etsy\.com\//i.test(url)) return null;
    
    // Find all /market/ links (these are product tags)
    const marketLinks = [...document.querySelectorAll('a[href*="/market/"]')];
    
    let hasMatureTag = false;
    const detectedTags = [];
    
    for (const link of marketLinks) {
      try {
        const href = link.getAttribute('href');
        if (!href) continue;
        
        // Extract tag from URL path: /market/TAG_NAME?params or /market/TAG_NAME
        const match = href.match(/\/market\/([^?#]+)/);
        if (match) {
          const tag = match[1].toLowerCase().trim();
          detectedTags.push(tag);
          
          // Check if tag is exactly "mature" or starts with "mature_"
          if (tag === 'mature' || tag.startsWith('mature_')) {
            hasMatureTag = true;
            console.log('[CSL] Etsy mature tag detected:', tag);
          }
        }
      } catch (e) {
        // Skip malformed URLs
      }
    }
    
    console.log('[CSL] Etsy tags detected:', detectedTags);
    
    return hasMatureTag 
      ? { platform: 'etsy', score: 0.7, signals: { hasMatureTag, detectedTags } } 
      : { platform: 'etsy', score: 0.15, signals: { detectedTags } };
  },

  /**
   * Redbubble - Detects mature content visibility setting
   * Site has a "Mature content visibility" preference (Hidden/Show)
   */
  redbubble(url) {
    if (!/\/\/(www\.)?redbubble\.com\//i.test(url)) return null;
    
    // Footer/status text "Mature content: Hidden/Show"
    const hasStatus = hasText(document.body, ['mature content: hidden', 'mature content: show']);
    
    return hasStatus 
      ? { platform: 'redbubble', score: 0.6, signals: { hasStatus } } 
      : { platform: 'redbubble', score: 0.1, signals: {} };
  },

  /**
   * TeePublic - Detects Safe Search setting
   * Safe Search hides explicit content in results
   */
  teepublic(url) {
    if (!/\/\/(www\.)?teepublic\.com\//i.test(url)) return null;
    
    const filterEl = document.querySelector('aside, [aria-label*="Filter"], [id*="filter"]');
    const hasSafeSearch = filterEl && /safe\s*search\s*:\s*(on|off)/i.test(filterEl.innerText);
    
    return hasSafeSearch 
      ? { platform: 'teepublic', score: 0.55, signals: { hasSafeSearch } } 
      : { platform: 'teepublic', score: 0.1, signals: {} };
  },

  /**
   * Zazzle - Detects content rating (G, PG-13, R)
   * Product pages display "Rating:" with a letter
   */
  zazzle(url) {
    if (!/\/\/(www\.)?zazzle\.com\//i.test(url)) return null;
    
    // Look for "Rating: G/PG-13/R" near product meta
    const meta = document.querySelector('#product-details, [data-product-details], .product-details, [id*="ProductPage"]') || document.body;
    const m = TXT(meta.innerText).match(/rating:\s*(g|pg-13|r)\b/);
    
    return m 
      ? { platform: 'zazzle', score: 0.9, rating: m[1].toUpperCase(), signals: { hasRating: true } } 
      : { platform: 'zazzle', score: 0.1, signals: {} };
  },

  /**
   * itch.io - Detects adult content warnings and interstitials
   * Creators must mark "adult" content; users have global setting
   */
  itch(url) {
    if (!/\/\/(www\.)?itch\.io\//i.test(url)) return null;
    
    // Interstitials and adult warnings appear as textual overlays/buttons
    const adultStrings = ['are you 18', 'this page contains adult content', 'show content marked as adult'];
    const hasAdultUI = hasText(document.body, adultStrings);
    
    return hasAdultUI 
      ? { platform: 'itch.io', score: 0.7, signals: { hasAdultUI } } 
      : { platform: 'itch.io', score: 0.1, signals: {} };
  },

  /**
   * eBay - Detects Sexual Wellness category
   * Adult imagery prohibited; Sexual Wellness category is the indicator
   */
  ebay(url) {
    if (!/\/\/(www\.)?ebay\./i.test(url)) return null;
    
    const bc = findBreadcrumbText();
    const sexual = /\bsexual\s+wellness\b/.test(bc);
    
    return sexual 
      ? { platform: 'ebay', score: 0.65, signals: { breadcrumb: bc } } 
      : { platform: 'ebay', score: 0.1, signals: {} };
  },

  /**
   * Amazon - Detects Sexual Wellness category
   * Adult items restricted to Sexual Wellness; not searchable outside that category
   */
  amazon(url) {
    if (!/\/\/(www\.)?amazon\./i.test(url)) return null;
    
    const bc = findBreadcrumbText();
    const inSW = /\bsexual\s+wellness\b/.test(bc);
    
    // Also scan JSON-LD for category
    let inSWJson = false;
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try { 
        if (JSON.parse(s.textContent || '{}')?.category?.toLowerCase?.().includes('sexual wellness')) {
          inSWJson = true;
        }
      } catch {}
    });
    
    return (inSW || inSWJson) 
      ? { platform: 'amazon', score: 0.75, signals: { inSW, inSWJson } } 
      : { platform: 'amazon', score: 0.1, signals: {} };
  },

  /**
   * Patreon - Detects 18+ creator pages and interstitials
   * Creators/pages can be classified Adult/18+; members can toggle "See 18+ creators"
   */
  patreon(url) {
    if (!/\/\/(www\.)?patreon\.com\//i.test(url)) return null;
    
    const hasInterstitial = hasText(document.body, ['you can change your 18+ preferences', 'i am 18+', 'adult creators']);
    
    return hasInterstitial 
      ? { platform: 'patreon', score: 0.85, signals: { hasInterstitial } } 
      : { platform: 'patreon', score: 0.1, signals: {} };
  },

  /**
   * Shopify - Detects age-gate overlays
   * No platform-wide field; many stores use Age-Gate apps
   */
  shopify(url) {
    // Heuristic: a lot of Shopify stores share /cart.js and window.Shopify
    const isShopify = !!window.Shopify || /\/cart\.js$/.test(url) || /myshopify\.com/.test(url);
    if (!isShopify) return null;
    
    // Look for common age-gate overlays by text and generic ids/classes
    const gateText = ['age verification', 'are you 18', 'are you 21', 'enter your birth', 'date of birth'];
    const hasGate = hasText(document.body, gateText) ||
      document.querySelector('#age-gate, #age_verification, .age-gate, .age_verification, [data-age-gate]');

    return hasGate 
      ? { platform: 'shopify', score: 0.6, signals: { hasGate: true } } 
      : { platform: 'shopify', score: 0.15, signals: {} };
  }
};

// ============ Main Detection Function ============

/**
 * Get effective URL for detection (supports local file testing)
 * Checks for special meta tag to override URL for local files
 */
function getEffectiveURL() {
  let url = location.href;
  
  // For local file:// URLs, check for test-domain meta tag
  if (url.startsWith('file://')) {
    const testDomainMeta = document.querySelector('meta[name="test-domain"]');
    if (testDomainMeta) {
      const testDomain = testDomainMeta.getAttribute('content');
      if (testDomain) {
        // Construct a fake https URL for testing
        url = `https://${testDomain}/test-page`;
        console.log('[CSL] Local file detected - using test domain:', url);
      }
    }
  }
  
  return url;
}

/**
 * Detect mature content signals on the current page
 * Returns verdict with platform, score, and signals
 */
function detectMatureSignals() {
  const url = getEffectiveURL();
  const results = Object.values(detectors)
    .map(fn => fn(url))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  
  // Highest score per hostname (in case iframes exist)
  const best = results[0] || null;
  return { verdict: best, all: results };
}

/**
 * Generate signal strings for detected mature content
 * Returns array of signal strings like "VENDOR:etsy:mature"
 */
function generateMatureContentSignals() {
  const detection = detectMatureSignals();
  const signals = [];
  
  if (detection.verdict && detection.verdict.score >= 0.6) {
    const platform = detection.verdict.platform;
    signals.push(`VENDOR:${platform}:mature`);
    
    // Add specific rating for Zazzle
    if (platform === 'zazzle' && detection.verdict.rating) {
      signals.push(`VENDOR:zazzle:rating:${detection.verdict.rating}`);
    }
  }
  
  return signals;
}
