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

/**
 * Amazon browse nodes that are blocked outright, so category pages are
 * caught even when they are reached by node ID alone (e.g. /b?node=...).
 */
const AMAZON_BLOCKED_NODES = [
  '3777371',    // Health & Household > Sexual Wellness
  '7586174011', // Clothing, Shoes & Jewelry > Novelty & More > Exotic Apparel
  '157057011',  // Kindle Store > Kindle eBooks > Literature & Fiction > Erotica
  '10141'       // Books > Literature & Fiction > Erotica
];

/**
 * Detect whether the current Amazon page is a browse/category listing for
 * a blocked category. Covers browse pages (/<Slug>/b/?node=<id>, /b?node=),
 * best-seller / new-release lists (/zgbs/, /gp/bestsellers/, /gp/new-releases/)
 * and node-scoped search (/s?rh=n:<id>).
 */
function isBlockedAmazonCategoryPage(url, matchesBlocked) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const path = parsed.pathname;
  const params = parsed.searchParams;
  const rh = params.get('rh') || '';

  const isBrowsePage = /(^|\/)b(\/|$)/.test(path) || params.has('node');
  const isRankList = /\/(zgbs|gp\/bestsellers|gp\/new-releases|gp\/movers-and-shakers|gp\/most-wished-for|gp\/most-gifted)(\/|$)/.test(path);
  const isNodeSearch = /^\/s(\/|$)/.test(path) && /(^|,)n:\d+/.test(rh);
  if (!isBrowsePage && !isRankList && !isNodeSearch) return false;

  const nodes = new Set();
  if (params.get('node')) nodes.add(params.get('node'));
  for (const m of rh.matchAll(/(?:^|,)n:(\d+)/g)) nodes.add(m[1]);
  if (isRankList) {
    const last = path.split('/').filter(Boolean).pop();
    if (/^\d+$/.test(last || '')) nodes.add(last);
  }
  if ([...nodes].some(n => AMAZON_BLOCKED_NODES.includes(n))) return true;

  // Category name in the URL slug, e.g. /Erotica-Fiction-eBooks/b/...
  // or /Best-Sellers-Erotica/zgbs/...
  const slug = path.split('/').filter(Boolean)[0] || '';
  if (!['b', 's', 'gp', 'zgbs'].includes(slug) && matchesBlocked(slug.replace(/[-_]+/g, ' '))) {
    return true;
  }

  // Category heading, e.g. <h1>Erotica</h1> or "Best Sellers in Erotica"
  const headings = [...document.querySelectorAll('h1')].map(h => h.textContent || '');
  if (headings.some(matchesBlocked)) return true;

  // Page title leads with the category: "Amazon.com: Erotica - Literature &
  // Fiction: Kindle Store: ..." or "Amazon Best Sellers: Best Erotica".
  // Only the leading category segment is checked: browse page titles go on
  // to list sub-categories, which would flag parent categories.
  const title = (document.title || '')
    .replace(/^\s*amazon(\.[a-z.]+)?\s*(best sellers|new releases)?\s*:\s*/i, '');
  const leadingCategory = title.split(':')[0];
  return matchesBlocked(leadingCategory);
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
   * Amazon - Detects blocked browse categories on product and category pages
   * Currently blocks:
   *   - Sexual Wellness
   *   - Clothing, Shoes & Jewelry > Novelty & More > Exotic Apparel
   *   - Any category containing the word "Erotic" / "Erotica"
   *     (e.g. Books > Literature & Fiction > Erotica,
   *      Kindle Store > ... > Erotica, Erotic Gift Sets & Sex Kits, etc.).
   *     The \berotic prefix pattern intentionally matches "erotic" and
   *     "erotica" while the leading \b word boundary protects against
   *     the medical term "xerotic" (dry skin).
   *
   * Product pages: blocked if the breadcrumb, the JSON-LD category, or any
   * Best Sellers Rank category (Amazon's list of the other categories and
   * sub-categories the item is ranked in) matches.
   *
   * Category pages (/b?node=, /zgbs/, /gp/bestsellers/, /s?rh=n:...):
   * blocked if the browse node is a known blocked node, or the category
   * name in the URL slug, page heading, or page title matches.
   */
  amazon(url) {
    if (!/\/\/(www\.)?amazon\./i.test(url)) return null;

    const BLOCKED_CATEGORY_PATTERNS = [
      /\bsexual\s+wellness\b/i,
      /\bexotic\s+apparel\b/i,
      /\berotic/i
    ];
    const matchesBlocked = (text) =>
      typeof text === 'string' && BLOCKED_CATEGORY_PATTERNS.some(p => p.test(text));

    const bc = findBreadcrumbText();
    const inBlockedBreadcrumb = matchesBlocked(bc);

    // Also scan JSON-LD for category
    let inBlockedJson = false;
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const category = JSON.parse(s.textContent || '{}')?.category;
        if (matchesBlocked(category)) {
          inBlockedJson = true;
        }
      } catch {}
    });

    // Best Sellers Rank lists the item's other categories / sub-categories
    // (e.g. "#8 in Erotica (Kindle Store)") as links to /gp/bestsellers/.
    const rankLinks = document.querySelectorAll(
      '.zg_hrsr a, ' +
      '#detailBulletsWrapper_feature_div a[href*="/gp/bestsellers/"], ' +
      '#detailBullets_feature_div a[href*="/gp/bestsellers/"], ' +
      '#prodDetails a[href*="/gp/bestsellers/"], ' +
      '#productDetails_feature_div a[href*="/gp/bestsellers/"]'
    );
    const inBlockedRank = [...rankLinks].some(a => matchesBlocked(a.textContent));

    const inBlockedCategoryPage = isBlockedAmazonCategoryPage(url, matchesBlocked);

    return (inBlockedBreadcrumb || inBlockedJson || inBlockedRank || inBlockedCategoryPage)
      ? {
          platform: 'amazon',
          score: 0.75,
          signals: { inBlockedBreadcrumb, inBlockedJson, inBlockedRank, inBlockedCategoryPage }
        }
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
        // Construct a fake https URL for testing; an optional test-path
        // meta tag (e.g. "/b?node=157057011") exercises URL-based detection
        const testPathMeta = document.querySelector('meta[name="test-path"]');
        const testPath = (testPathMeta && testPathMeta.getAttribute('content')) || '/test-page';
        url = `https://${testDomain}${testPath}`;
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
