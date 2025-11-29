/**
 * Tumblr Safe Mode Interceptor
 * Runs in the MAIN world context to intercept window.fetch
 */
(function() {
  console.log('[CSL-Page] Tumblr Safe Mode Interceptor active');
  
  // Prevent multiple injections
  if (window.__cslTumblrActive) return;
  window.__cslTumblrActive = true;
  
  const originalFetch = window.fetch;
  const originalParse = JSON.parse;
  
  // 1. Intercept JSON.parse to catch initial hydration state
  JSON.parse = function(text, reviver) {
    const data = originalParse(text, reviver);
    
    try {
      if (data && (data.response?.posts || data.posts)) {
        // It looks like Tumblr data, try to sanitize
        const sanitized = sanitizeTumblrData(data);
        return sanitized;
      }
    } catch (err) {
      // Ignore errors during sanitization check
    }
    
    return data;
  };

  // 2. Intercept fetch requests
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    
    // Pass through non-Tumblr API requests
    if (!url || 
        (!url.includes('/v2/blog/') && 
         !url.includes('/api/v2/timeline') && 
         !url.includes('/api/v2/search'))) {
      return originalFetch.apply(this, arguments);
    }
    
    // Check if it's a posts request
    if (!url.includes('/posts') && !url.includes('/timeline') && !url.includes('/search')) {
       return originalFetch.apply(this, arguments);
    }
    
    console.log('[CSL-Page] Intercepting Tumblr request:', url);
    
    try {
      // Perform the fetch
      const response = await originalFetch.apply(this, arguments);
      
      // Clone the response to read it
      const clone = response.clone();
      
      // Try to parse as JSON
      try {
        const data = await clone.json();
        
        // Sanitize
        const sanitized = sanitizeTumblrData(data);
        
        // If no changes, return original
        if (sanitized === data) {
          return response;
        }
        
        console.log('[CSL-Page] Sanitized Tumblr response');
        
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
  
  // 3. DOM Observer for pre-rendered content
  const observer = new MutationObserver((mutations) => {
    // We can optimize by only looking at addedNodes
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        scanForMatureContent(mutation.target);
      }
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // Initial scan
  if (document.body) {
    scanForMatureContent(document.body);
  }

  function scanForMatureContent(root) {
    // Look for specific text signatures in the DOM
    // "Potentially mature content" is in a div with class UF4Vo based on user snippet
    // But we search by text to be robust
    
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const text = node.textContent;
          if (text === 'Potentially mature content' || 
              text === 'Adult content' || 
              text === 'Explicit') {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const nodesToRemove = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      // Find the article container to remove
      // Traverse up until we find an <article> or a likely container
      let container = node.parentElement;
      let foundArticle = false;

      // Search up for 10 levels max to avoid removing <body>
      for (let i = 0; i < 10; i++) {
        if (!container) break;
        
        if (container.tagName === 'ARTICLE' || 
            container.getAttribute('role') === 'article' ||
            container.classList.contains('uaaSl') || // From snippet: <div class="eA_DC uaaSl y3qwY">
            container.hasAttribute('data-id')) {      // Often posts have data-id
          foundArticle = true;
          break;
        }
        container = container.parentElement;
      }

      if (foundArticle && container) {
        nodesToRemove.push(container);
      } else {
        // Fallback: if no article tag found, look for the community label cover container
        // In snippet: <div class="EAugG VjDK_" data-testid="community-label-cover">
        let cover = node.parentElement; 
        while (cover && !cover.hasAttribute('data-testid') && cover !== document.body) {
            cover = cover.parentElement;
        }
        if (cover && cover.getAttribute('data-testid') === 'community-label-cover') {
             // We found the cover, now go up to find the post. 
             // In snippet, cover is deep inside.
             // Let's just remove the cover + content if we can't find the article, 
             // or hide the specific content.
             // But user requested replacing the post.
             // Let's try to find the article again with a broader search or just hide this node's distant parent.
             
             // Safe fallback: hide the cover element so it can't be clicked
             nodesToRemove.push(cover);
        }
      }
    }

    // Remove/Replace found nodes
    for (const container of nodesToRemove) {
      if (container.getAttribute('data-csl-processed')) continue;
      container.setAttribute('data-csl-processed', 'true');

      console.log('[CSL-Page] Removing mature content from DOM');
      
      // Create replacement message
      const replacement = document.createElement('div');
      replacement.style.cssText = `
        padding: 20px;
        background: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 8px;
        margin: 10px 0;
        text-align: center;
        color: #666;
        font-family: sans-serif;
        font-size: 14px;
      `;
      replacement.textContent = '🚫 This post was hidden by Content Safety Lock.';

      container.replaceWith(replacement);
    }
  }

  // Sanitization logic
  function sanitizeTumblrData(data) {
    // Determine where the posts array is
    let posts = null;
    let isWrapped = false; // true if data.response.posts, false if data.posts
    
    if (data?.response?.posts && Array.isArray(data.response.posts)) {
      posts = data.response.posts;
      isWrapped = true;
    } else if (data?.posts && Array.isArray(data.posts)) {
      posts = data.posts;
      isWrapped = false;
    } else {
      return data;
    }

    let blockedCount = 0;

    const cleanPosts = posts.filter(post => {
      // 1. Check for specific text labels in headerContext
      const labelText = post.headerContext?.label?.text;
      if (labelText === 'Potentially mature content' || 
          labelText === 'Adult content' || 
          labelText === 'Explicit') {
        blockedCount++;
        return false;
      }

      // 2. Check explicit flags (defensive)
      if (post.isNsfw === true) {
        blockedCount++;
        return false;
      }
      
      if (post.classification === 'adult' || post.classification === 'nsfw') {
        blockedCount++;
        return false;
      }
      
      // 3. Check community labels if present
      if (post.communityLabel?.isNsfw) {
        blockedCount++;
        return false;
      }

      return true;
    });
    
    if (blockedCount > 0) {
      console.log('[CSL-Page] Blocked ' + blockedCount + ' mature posts via ' + (isWrapped ? 'response.posts' : 'posts'));
      
      if (isWrapped) {
        return {
          ...data,
          response: {
            ...data.response,
            posts: cleanPosts
          }
        };
      } else {
        return {
          ...data,
          posts: cleanPosts
        };
      }
    }

    return data;
  }
})();
