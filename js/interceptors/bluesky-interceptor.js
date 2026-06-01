/**
 * Bluesky Safe Mode Interceptor
 * Runs in the MAIN world context to intercept window.fetch
 */
(function() {
  console.info('[CSL-Page] Bluesky Safe Mode Interceptor active');

  // Prevent multiple injections
  if (window.__cslBlueskyActive) return;
  window.__cslBlueskyActive = true;

  const originalFetch = window.fetch;
  const originalParse = JSON.parse;

  // Bluesky official content labels
  const BLUESKY_LABELS = [
    'porn', 'sexual', 'nudity', 'sexual-figurative', 'graphic-media',
    'self-harm', 'sensitive', 'extremist', 'intolerant', 'threat',
    'rude', 'illicit', 'security', 'unsafe-link', 'impersonation',
    'misinformation', 'scam', 'engagement-farming', 'spam', 'rumor',
    'misleading', 'inauthentic'
  ];

  // Get blocked labels from config (injected by content script)
  const blockedLabels = window.__cslBlueskyConfig?.blockedLabels || BLUESKY_LABELS;
  const ageSetting = window.__cslBlueskyConfig?.ageSetting || '18+';

  /**
   * Check if a post has any blocked labels
   */
  function hasBlockedLabels(post) {
    if (!post || typeof post !== 'object') return false;

    // Check post labels
    const postLabels = post.labels || [];
    for (const label of postLabels) {
      if (label.val && blockedLabels.includes(label.val)) {
        return true;
      }
    }

    // Check author profile labels
    const authorLabels = post.author?.labels || [];
    for (const label of authorLabels) {
      if (label.val && blockedLabels.includes(label.val)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize getPreferences response - modify label visibility and age settings
   */
  function sanitizePreferences(data) {
    if (!data || !Array.isArray(data.preferences)) return data;

    let modified = false;
    const newPreferences = data.preferences.map(pref => {
      // Handle contentLabelPref - set blocked labels to "hide"
      if (pref.$type === 'app.bsky.actor.defs#contentLabelPref' && pref.label) {
        if (blockedLabels.includes(pref.label)) {
          modified = true;
          return { ...pref, visibility: 'hide' };
        }
      }

      // Handle adultContentPref - disable if age setting is not 18+
      if (pref.$type === 'app.bsky.actor.defs#adultContentPref') {
        const shouldEnable = ageSetting === '18+';
        if (pref.enabled !== shouldEnable) {
          modified = true;
          return { ...pref, enabled: shouldEnable };
        }
      }

      // Handle declaredAgePref - set age declarations based on setting
      if (pref.$type === 'app.bsky.actor.defs#declaredAgePref') {
        const ageConfig = {
          'under13': { isOverAge13: false, isOverAge16: false, isOverAge18: false },
          '13+': { isOverAge13: true, isOverAge16: false, isOverAge18: false },
          '16+': { isOverAge13: true, isOverAge16: true, isOverAge18: false },
          '18+': { isOverAge13: true, isOverAge16: true, isOverAge18: true }
        };
        const targetAge = ageConfig[ageSetting] || ageConfig['18+'];

        if (pref.isOverAge13 !== targetAge.isOverAge13 ||
            pref.isOverAge16 !== targetAge.isOverAge16 ||
            pref.isOverAge18 !== targetAge.isOverAge18) {
          modified = true;
          return { ...pref, ...targetAge };
        }
      }

      return pref;
    });

    if (modified) {
      console.info('[CSL-Page] Modified Bluesky preferences response');
      return { ...data, preferences: newPreferences };
    }

    return data;
  }

  /**
   * Sanitize getAuthorFeed response - remove posts with blocked labels
   */
  function sanitizeAuthorFeed(data) {
    if (!data || !Array.isArray(data.feed)) return data;

    const originalLength = data.feed.length;
    const cleanFeed = data.feed.filter(item => {
      const post = item?.post;
      if (!post) return true;
      return !hasBlockedLabels(post);
    });

    if (cleanFeed.length < originalLength) {
      console.info(`[CSL-Page] Blocked ${originalLength - cleanFeed.length} posts from author feed`);
      return { ...data, feed: cleanFeed };
    }

    return data;
  }

  /**
   * Sanitize searchPosts response - remove posts with blocked labels
   */
  function sanitizeSearchPosts(data) {
    if (!data || !Array.isArray(data.posts)) return data;

    const originalLength = data.posts.length;
    const cleanPosts = data.posts.filter(post => !hasBlockedLabels(post));

    if (cleanPosts.length < originalLength) {
      console.info(`[CSL-Page] Blocked ${originalLength - cleanPosts.length} posts from search results`);
      return { ...data, posts: cleanPosts };
    }

    return data;
  }

  /**
   * Sanitize getPostThreadV2 response - remove posts with blocked labels from thread
   */
  function sanitizePostThread(data) {
    if (!data || !Array.isArray(data.thread)) return data;

    const originalLength = data.thread.length;
    const cleanThread = data.thread.filter(item => {
      const post = item?.value?.post || item?.post;
      if (!post) return true;
      return !hasBlockedLabels(post);
    });

    if (cleanThread.length < originalLength) {
      console.info(`[CSL-Page] Blocked ${originalLength - cleanThread.length} posts from thread`);
      return { ...data, thread: cleanThread };
    }

    return data;
  }

  /**
   * Route data to appropriate sanitizer based on URL pattern
   */
  function sanitizeBlueskyData(data, url) {
    if (!data || typeof data !== 'object') return data;

    // Determine which sanitizer to use based on the endpoint
    if (url.includes('app.bsky.actor.getPreferences')) {
      return sanitizePreferences(data);
    }
    if (url.includes('app.bsky.feed.getAuthorFeed')) {
      return sanitizeAuthorFeed(data);
    }
    if (url.includes('app.bsky.feed.searchPosts')) {
      return sanitizeSearchPosts(data);
    }
    if (url.includes('app.bsky.unspecced.getPostThread')) {
      return sanitizePostThread(data);
    }

    return data;
  }

  // 1. Intercept JSON.parse to catch initial hydration state
  JSON.parse = function(text, reviver) {
    const data = originalParse(text, reviver);

    try {
      // Check if this looks like Bluesky data
      if (data && (data.preferences || data.feed || data.posts || data.thread)) {
        const sanitized = sanitizeBlueskyData(data, window.location.href);
        if (sanitized !== data) {
          console.debug('[CSL-Page] Sanitized embedded Bluesky data via JSON.parse');
          return sanitized;
        }
      }
    } catch (err) {
      // Ignore errors during sanitization check
    }

    return data;
  };

  // 2. Intercept fetch requests
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);

    // Pass through non-Bluesky API requests
    if (!url || (!url.includes('bsky.network') && !url.includes('bsky.app'))) {
      return originalFetch.apply(this, arguments);
    }

    // Only intercept specific Bluesky endpoints
    const isBlueskyEndpoint =
      url.includes('app.bsky.actor.getPreferences') ||
      url.includes('app.bsky.feed.getAuthorFeed') ||
      url.includes('app.bsky.feed.searchPosts') ||
      url.includes('app.bsky.unspecced.getPostThread');

    if (!isBlueskyEndpoint) {
      return originalFetch.apply(this, arguments);
    }

    console.debug('[CSL-Page] Intercepting Bluesky request:', url);

    try {
      // Perform the fetch
      const response = await originalFetch.apply(this, arguments);

      // Clone the response to read it
      const clone = response.clone();

      // Try to parse as JSON
      try {
        const data = await clone.json();

        // Sanitize
        const sanitized = sanitizeBlueskyData(data, url);

        // If no changes, return original
        if (sanitized === data) {
          return response;
        }

        console.debug('[CSL-Page] Sanitized Bluesky response');

        // Return new response with sanitized data
        return new Response(JSON.stringify(sanitized), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });

      } catch (jsonErr) {
        // Not JSON or failed to parse, return original
        return response;
      }

    } catch (err) {
      console.error('[CSL-Page] Error in fetch interceptor:', err);
      return originalFetch.apply(this, arguments);
    }
  };

  console.info('[CSL-Page] Bluesky Safe Mode Interceptor initialized');
})();
