/**
 * Reddit Safe Mode Interceptor
 * Runs in the MAIN world context to intercept window.fetch
 */
(function() {
  console.info('[CSL-Page] Reddit Safe Mode Interceptor active');
  
  // Prevent multiple injections
  if (window.__cslRedditActive) return;
  window.__cslRedditActive = true;
  
  const originalFetch = window.fetch;
  const originalParse = JSON.parse;
  
  // ============ Sanitization Functions ============
  // These must be defined before they're used
  
  // Sanitization logic
  function sanitizeRedditData(data) {
    // Recursively search for "data.children" arrays
    // This handles nested replies, search results, main feeds, etc.
    
    if (!data || typeof data !== 'object') return data;
    
    // If this object is a Listing with children, filter them
    if (data.kind === 'Listing' && data.data && Array.isArray(data.data.children)) {
      const originalLength = data.data.children.length;
      
      const cleanChildren = data.data.children.filter(child => {
        // Check if it's a post (t3) and is over_18
        if (child.kind === 't3' && child.data && child.data.over_18 === true) {
          return false;
        }
        return true;
      });
      
      if (cleanChildren.length < originalLength) {
        console.info(`[CSL-Page] Blocked ${originalLength - cleanChildren.length} NSFW items from Listing`);
        
        // Return a new object with filtered children
        // We also need to recurse into the remaining children (e.g. for nested comments/replies if needed, though over_18 is usually on posts)
        const sanitizedChildren = cleanChildren.map(sanitizeRedditData);
        
        return {
          ...data,
          data: {
            ...data.data,
            children: sanitizedChildren
          }
        };
      } else {
        // Even if we didn't filter any at this level, we should recurse
        // just in case there are nested Listings
         const sanitizedChildren = data.data.children.map(sanitizeRedditData);
         if (sanitizedChildren !== data.data.children) { // Arrays are reference types, this check is tricky if map returns new arrays
            // map always returns a new array. We need to see if any child actually changed.
            // For simplicity, let's just check if we filtered any above. 
            // If we are here, we didn't filter any. 
            // So let's rely on the fact that sanitizeRedditData returns the same object if no changes.
            
            const hasChanges = sanitizedChildren.some((child, index) => child !== data.data.children[index]);
            if (hasChanges) {
              return {
                ...data,
                data: {
                  ...data.data,
                  children: sanitizedChildren
                }
              };
            }
         }
      }
    }
    
    // Handle other structures or recursion
    // Reddit sometimes returns an array of Listings (e.g. /comments/ endpoint: [PostListing, CommentListing])
    if (Array.isArray(data)) {
      const sanitizedArray = data.map(sanitizeRedditData);
      const hasChanges = sanitizedArray.some((item, index) => item !== data[index]);
      if (hasChanges) {
        return sanitizedArray;
      }
    }
    
    // If it's a generic object, we might need to traverse values if we suspect hidden Listings
    // But deep traversal on every object is expensive. 
    // Reddit's structure is usually predictable: Listing -> children -> t3/t1 -> data -> replies (which is another Listing or empty string)
    
    if (data.kind === 't1' || data.kind === 't3') {
        if (data.data && data.data.replies) {
            const sanitizedReplies = sanitizeRedditData(data.data.replies);
            if (sanitizedReplies !== data.data.replies) {
                return {
                    ...data,
                    data: {
                        ...data.data,
                        replies: sanitizedReplies
                    }
                };
            }
        }
    }

    return data;
  }
  
  // Helper to recursively find and sanitize Reddit data structures
  function deepSanitizeRedditStructures(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Check if this is a Reddit Listing
    if (obj.kind === 'Listing' && obj.data && Array.isArray(obj.data.children)) {
      return sanitizeRedditData(obj);
    }
    
    // Check if this is an array of Listings (common in comments)
    if (Array.isArray(obj)) {
      const sanitized = obj.map(deepSanitizeRedditStructures);
      const hasChanges = sanitized.some((item, idx) => item !== obj[idx]);
      return hasChanges ? sanitized : obj;
    }
    
    // Recursively check object properties for nested Reddit data
    // This catches cases where Reddit data is nested in other structures
    let hasChanges = false;
    const result = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const sanitized = deepSanitizeRedditStructures(obj[key]);
        result[key] = sanitized;
        if (sanitized !== obj[key]) {
          hasChanges = true;
        }
      }
    }
    
    return hasChanges ? result : obj;
  }
  
  // ============ Interception Setup ============
  
  // 1. Intercept JSON.parse to catch initial hydration state
  // Reddit often embeds initial state in script tags that get parsed
  JSON.parse = function(text, reviver) {
    const data = originalParse(text, reviver);
    
    try {
      // Recursively search for Reddit data structures and sanitize them
      const sanitized = deepSanitizeRedditStructures(data);
      if (sanitized !== data) {
        console.debug('[CSL-Page] Sanitized embedded Reddit data via JSON.parse');
        return sanitized;
      }
    } catch (err) {
      // Ignore errors during sanitization check
      console.error('[CSL-Page] Error in JSON.parse sanitization:', err);
    }
    
    return data;
  };

  // 2. Intercept fetch requests
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    
    // Pass through non-Reddit API requests
    // Reddit uses .json extensions heavily, and gateway.reddit.com for GQL/API
    const isJsonRequest = url && (url.includes('.json') || url.includes('gateway.reddit.com'));
    
    if (!isJsonRequest) {
      return originalFetch.apply(this, arguments);
    }
    
    try {
      // Perform the fetch
      const response = await originalFetch.apply(this, arguments);
      
      // Clone the response to read it
      const clone = response.clone();
      
      // Try to parse as JSON
      try {
        const data = await clone.json();
        
        // Sanitize
        const sanitized = sanitizeRedditData(data);
        
        // If no changes, return original
        if (sanitized === data) {
          return response;
        }
        
        console.debug('[CSL-Page] Sanitized Reddit response');
        
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
  
  // 3. DOM Observer for pre-rendered content and fallback
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element node
            checkAndRemoveNode(node);
            // Also check descendants if it's a container
            if (node.querySelectorAll) {
              const descendants = node.querySelectorAll('shreddit-post[nsfw], .thing.over18, search-telemetry-tracker[data-testid="search-sdui-post"], search-telemetry-tracker[view-events="search/view/subreddit"], search-telemetry-tracker[view-events="search/view/comment"], search-telemetry-tracker[view-events="search/view/post"], search-telemetry-tracker[view-events="search/view/people"]');
              descendants.forEach(checkAndRemoveNode);
            }
          }
        }
      }
    }
  });

  // Start observing as early as possible
  const observeTarget = document.body || document.documentElement;
  observer.observe(observeTarget, {
    childList: true,
    subtree: true
  });

  // Initial scan - run immediately
  function performInitialScan() {
    console.debug('[CSL-Page] Running initial scan...');
    
    // Check for modern Reddit (Shreddit) posts
    const shredditPosts = document.querySelectorAll('shreddit-post');
    console.debug('[CSL-Page] Found', shredditPosts.length, 'shreddit-post elements');
    
    if (shredditPosts.length > 0) {
      // Log first post's attributes for debugging
      const firstPost = shredditPosts[0];
      console.debug('[CSL-Page] First post attributes:', {
        nsfw: firstPost.getAttribute('nsfw'),
        'content-category': firstPost.getAttribute('content-category'),
        'is-nsfw': firstPost.getAttribute('is-nsfw'),
        allAttributes: Array.from(firstPost.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', ')
      });
    }
    
    // Reddit uses nsfw="" (empty string) or just nsfw attribute presence to indicate NSFW
    const existingPosts = document.querySelectorAll('shreddit-post[nsfw], .thing.over18');
    console.debug('[CSL-Page] Found', existingPosts.length, 'NSFW posts matching selector');
    if (existingPosts.length > 0) {
      console.info('[CSL-Page] Initial scan found', existingPosts.length, 'NSFW posts');
      existingPosts.forEach(checkAndRemoveNode);
    }
    
    // Check search results (different structure)
    // Posts tab
    const searchPosts = document.querySelectorAll('search-telemetry-tracker[data-testid="search-sdui-post"]');
    console.debug('[CSL-Page] Found', searchPosts.length, 'search post results');
    if (searchPosts.length > 0) {
      searchPosts.forEach(checkAndRemoveNode);
    }
    
    // Communities tab (outer container has view-events)
    const searchCommunities = document.querySelectorAll('search-telemetry-tracker[view-events="search/view/subreddit"]');
    console.debug('[CSL-Page] Found', searchCommunities.length, 'search community results');
    if (searchCommunities.length > 0) {
      searchCommunities.forEach(checkAndRemoveNode);
    }
    
    // Comments tab (outer container has view-events)
    const searchComments = document.querySelectorAll('search-telemetry-tracker[view-events="search/view/comment"]');
    console.debug('[CSL-Page] Found', searchComments.length, 'search comment results');
    if (searchComments.length > 0) {
      searchComments.forEach(checkAndRemoveNode);
    }
    
    // Media tab
    const searchMedia = document.querySelectorAll('search-telemetry-tracker[view-events="search/view/post"]');
    console.debug('[CSL-Page] Found', searchMedia.length, 'search media results');
    if (searchMedia.length > 0) {
      searchMedia.forEach(checkAndRemoveNode);
    }
    
    // People tab
    const searchPeople = document.querySelectorAll('search-telemetry-tracker[view-events="search/view/people"]');
    console.debug('[CSL-Page] Found', searchPeople.length, 'search people results');
    if (searchPeople.length > 0) {
      searchPeople.forEach(checkAndRemoveNode);
    }
  }

  // Run initial scan immediately
  performInitialScan();

  // Also scan after a short delay to catch SSR content that renders slightly later
  setTimeout(performInitialScan, 100);
  setTimeout(performInitialScan, 500);
  setTimeout(performInitialScan, 1000);

  function checkAndRemoveNode(node) {
    // Modern Reddit (Shreddit)
    // Reddit uses nsfw="" or just the presence of the nsfw attribute to indicate NSFW
    if (node.tagName && node.tagName.toLowerCase() === 'shreddit-post') {
      if (node.hasAttribute('nsfw')) {
        removeNode(node);
        return;
      }
    }
    
    // Search results (all tabs)
    if (node.tagName && node.tagName.toLowerCase() === 'search-telemetry-tracker') {
      const trackingData = node.getAttribute('data-faceplate-tracking-context');
      if (trackingData) {
        try {
          const data = JSON.parse(trackingData);
          console.debug('[CSL-Page] Checking search result:', {
            hasPost: !!data.post,
            postNsfw: data.post?.nsfw,
            hasSubreddit: !!data.subreddit,
            subredditNsfw: data.subreddit?.nsfw,
            hasProfile: !!data.profile,
            profileNsfwAccount: data.profile?.nsfw_account
          });
          
          // Check if post.nsfw, subreddit.nsfw, or profile.nsfw_account is true
          if ((data.post && data.post.nsfw === true) || 
              (data.subreddit && data.subreddit.nsfw === true) ||
              (data.profile && data.profile.nsfw_account === true)) {
            console.info('[CSL-Page] Removing NSFW search result via tracking data');
            removeNode(node);
            return;
          }
          
          // For People tab: check if there's an NSFW warning badge
          // (profile.nsfw_account isn't always in tracking data, but the badge is visible)
          if (data.profile) {
            const nsfwWarning = node.querySelector('[data-testid="search-warnings"] .text-category-nsfw');
            if (nsfwWarning) {
              console.info('[CSL-Page] Removing NSFW profile via warning badge');
              removeNode(node);
              return;
            }
          }
        } catch (err) {
          console.warn('[CSL-Page] Error parsing search result tracking data:', err);
        }
      }
    }
    
    // Old Reddit
    if (node.classList && node.classList.contains('thing') && node.classList.contains('over18')) {
      removeNode(node);
      return;
    }
  }

  function removeNode(node) {
    if (node.getAttribute('data-csl-processed')) return;
    node.setAttribute('data-csl-processed', 'true');
    
    console.info('[CSL-Page] Removing NSFW content from DOM', node);
    
    // We can either remove it entirely or replace it with a message
    // For feeds, removal is usually cleaner.
    node.style.display = 'none !important';
    node.remove();
  }
})();
