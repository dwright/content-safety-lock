# Adding a New Provider to Content Safety Lock

This guide walks through the process of adding a new content provider (like Reddit, Tumblr, etc.) to Content Safety Lock.

## Overview

Adding a new provider involves several components:
1. **Interceptor Script** - Runs in the page context to filter content
2. **Safe Request Configuration** - Defines URL patterns and request filtering rules
3. **Content Script Integration** - Detects the provider and injects the interceptor
4. **Page-Level Blocking** - Optionally blocks entire pages marked as NSFW

## Step-by-Step Guide

### 1. Create the Interceptor Script

Create a new file: `{provider}-interceptor.js`

**Example: `reddit-interceptor.js`**

```javascript
/**
 * {Provider} Safe Mode Interceptor
 * Runs in the MAIN world context to intercept window.fetch
 */
(function() {
  console.info('[CSL-Page] {Provider} Safe Mode Interceptor active');
  
  // Prevent multiple injections
  if (window.__csl{Provider}Active) return;
  window.__csl{Provider}Active = true;
  
  const originalFetch = window.fetch;
  const originalParse = JSON.parse;
  
  // Sanitization function - filters NSFW content from API responses
  function sanitize{Provider}Data(data) {
    // Implement provider-specific filtering logic
    // Return sanitized data
  }
  
  // Intercept JSON.parse for initial page hydration
  JSON.parse = function(text, reviver) {
    const data = originalParse(text, reviver);
    // Check if this is provider data and sanitize
    return data;
  };
  
  // Intercept fetch requests
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    
    // Filter only provider API requests
    if (!isProviderRequest(url)) {
      return originalFetch.apply(this, arguments);
    }
    
    const response = await originalFetch.apply(this, arguments);
    // Clone, sanitize, and return modified response
    return response;
  };
  
  // DOM Observer for pre-rendered content
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            checkAndRemoveNode(node);
          }
        }
      }
    }
  });
  
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Check nodes for NSFW markers
  function checkAndRemoveNode(node) {
    // Implement provider-specific DOM filtering
  }
  
  // Initial scan
  function performInitialScan() {
    // Query and remove NSFW elements
  }
  
  performInitialScan();
  setTimeout(performInitialScan, 100);
  setTimeout(performInitialScan, 500);
})();
```

**Key Implementation Points:**

- **Intercept `fetch`**: Modify API responses before they reach the page
- **Intercept `JSON.parse`**: Catch initial page hydration data
- **DOM Observer**: Remove NSFW elements that appear in the DOM
- **Initial Scan**: Clean up server-side rendered content
- **Logging Levels**: Use `console.info()` for important events, `console.debug()` for verbose diagnostics

### 2. Update Safe Request Configuration

Edit `safe-request-config.js` to add the provider.

**Add Provider Rule:**

```javascript
const PROVIDER_RULES = {
  // ... existing providers ...
  
  '{provider}': {
    domains: ['{provider}.com', 'www.{provider}.com'],
    urlPatterns: [
      '*://*.{provider}.com/*'
    ],
    requiredHeaders: {
      // Headers to enforce (e.g., safe mode)
    },
    requiredParams: {
      // URL parameters to enforce
    }
  }
};
```

**Add to Default Config:**

```javascript
const DEFAULT_CONFIG = {
  enabled: true,
  providers: {
    // ... existing providers ...
    '{provider}': {
      enabled: true,
      // Provider-specific settings
    }
  }
};
```

### 3. Update Content Script

Edit `content.js` to detect and initialize the provider.

**Add Detection Function:**

```javascript
async function init{Provider}Interception() {
  try {
    // Check if Safe Request Mode is enabled for this provider
    const result = await browser.storage.sync.get('safeRequestConfig');
    const config = result.safeRequestConfig || DEFAULT_CONFIG;
    const {provider}Config = config.providers?.['{provider}'];
    const shouldEnable = config.enabled && 
                         {provider}Config && 
                         {provider}Config.enabled;
                         
    if (!shouldEnable) {
      console.info('[CSL] {Provider} Safe Mode not enabled');
      return;
    }
    
    console.info('[CSL] Injecting {Provider} Safe Mode interceptor');
    injectScript('{provider}-interceptor.js');
    
    // Check if this is an NSFW page that should be blocked entirely
    check{Provider}NsfwPages();
    
  } catch (err) {
    console.error('[CSL] Error initializing {Provider} interception:', err);
  }
}
```

**Add Domain Detection:**

```javascript
// In the main initialization section
if (window.location.hostname.includes('{provider}.com')) {
  init{Provider}Interception();
}
```

**Add Page-Level Blocking (Optional):**

```javascript
function check{Provider}NsfwPages() {
  const pathname = window.location.pathname;
  
  // Detect specific page types (e.g., /r/subreddit/, /user/username/)
  const isTargetPage = pathname.match(/pattern/);
  
  if (!isTargetPage) {
    return;
  }
  
  function checkPageData() {
    // Query for page metadata element
    const pageDataElement = document.querySelector('page-data-element');
    if (!pageDataElement) {
      return false;
    }
    
    const dataAttr = pageDataElement.getAttribute('data');
    if (!dataAttr) {
      return false;
    }
    
    try {
      const data = JSON.parse(dataAttr);
      
      // Check for NSFW flag
      if (data.someProperty && data.someProperty.isNsfw === true) {
        console.info('[CSL] NSFW page detected, blocking');
        const blockData = {
          blockType: 'content',
          reasons: ['Page is marked as NSFW (18+)'],
          signals: ['{provider}_nsfw_page']
        };
        injectBlockOverlay(blockData);
        return true;
      }
    } catch (err) {
      console.error('[CSL] Error checking page data:', err);
    }
    
    return false;
  }
  
  // Check immediately and with delays
  if (checkPageData()) {
    return;
  }
  
  setTimeout(checkPageData, 100);
  setTimeout(checkPageData, 500);
}
```

### 4. Update Manifest

Edit `manifest.json` to include the new interceptor script.

```json
{
  "web_accessible_resources": [
    {
      "resources": [
        "reddit-interceptor.js",
        "tumblr-interceptor.js",
        "{provider}-interceptor.js"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}
```

## Reddit Implementation Example

Here's what we implemented for Reddit:

### Files Modified:

1. **`reddit-interceptor.js`** (new file)
   - Intercepts `fetch` and `JSON.parse`
   - Filters NSFW posts from API responses (checks `over_18` flag)
   - DOM observer removes elements with `nsfw` attribute
   - Filters search results across all tabs (Posts, Communities, Comments, Media, People)
   - Uses `data-faceplate-tracking-context` JSON for search result filtering

2. **`safe-request-config.js`**
   - Added Reddit provider rule with domain patterns
   - No required headers/params (filtering done via interceptor)

3. **`content.js`**
   - Added `initRedditInterception()` function
   - Added `checkRedditNsfwPages()` function
   - Blocks NSFW user profiles (checks `profile.isNsfw`)
   - Blocks NSFW subreddits (checks `subreddit.isNsfw`)
   - Uses `reddit-page-data` element for page-level metadata

4. **`manifest.json`**
   - Added `reddit-interceptor.js` to `web_accessible_resources`

### Key Reddit-Specific Details:

- **NSFW Attribute**: Posts use `nsfw=""` or just presence of `nsfw` attribute
- **Search Results**: Use `search-telemetry-tracker` elements with JSON in `data-faceplate-tracking-context`
- **Page Metadata**: `reddit-page-data` element contains `profile` or `subreddit` objects with `isNsfw` flag
- **Multiple Selectors**: Different tabs use different `view-events` attributes

## Testing Checklist

- [ ] Interceptor activates on provider pages (check console logs)
- [ ] API responses are filtered (NSFW content removed)
- [ ] DOM elements are removed (both initial and dynamic)
- [ ] Search results are filtered (if applicable)
- [ ] Page-level blocking works (if applicable)
- [ ] No console errors
- [ ] Extension doesn't break normal functionality
- [ ] Safe Request Mode settings work correctly

## Debugging Tips

1. **Use appropriate log levels:**
   - `console.info()` - Important events (activation, blocking)
   - `console.debug()` - Verbose diagnostics (element counts, checks)
   - `console.warn()` - Potential issues
   - `console.error()` - Actual errors

2. **Check CSP compliance:**
   - Interceptor must run in MAIN world context
   - Use nonce-based injection from content script

3. **Verify selectors:**
   - Use browser DevTools to inspect actual HTML structure
   - Test with multiple page types (feeds, search, profiles)

4. **Test timing:**
   - Some content loads dynamically
   - Use delayed scans (100ms, 500ms, 1000ms)
   - MutationObserver catches later additions

## Common Patterns

### NSFW Detection Methods:

1. **API Response Flags**: `over_18`, `nsfw`, `is_nsfw`, `mature`, `adult`
2. **DOM Attributes**: `nsfw`, `data-nsfw`, `mature-content`
3. **CSS Classes**: `.nsfw`, `.mature`, `.adult-content`
4. **JSON Metadata**: Embedded in `data-*` attributes or `<script>` tags
5. **Warning Badges**: Visible NSFW indicators in the UI

### Content Filtering Strategies:

1. **API Interception**: Modify responses before they reach the page
2. **DOM Removal**: Remove elements after they appear
3. **Page Blocking**: Block entire pages with overlay
4. **Hybrid**: Combine multiple strategies for comprehensive coverage

## Additional Resources

- See `reddit-interceptor.js` for a complete implementation example
- See `tumblr-interceptor.js` for another reference
- Check `documentation/SAFE_REQUEST_MODE_IMPLEMENTATION.md` for Safe Request Mode details
- Review `documentation/TESTING.md` for testing procedures
