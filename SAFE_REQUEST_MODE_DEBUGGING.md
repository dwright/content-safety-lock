# Safe Request Mode Debugging Guide

## Overview

This guide helps diagnose why Safe Request Mode is not working as expected. Comprehensive console logging has been added to trace the execution flow.

---

## How to View Console Logs

### Firefox
1. Open the extension's background page:
   - Go to `about:debugging#/runtime/this-firefox`
   - Find "Content Safety Lock"
   - Click "Inspect"
2. Open the Browser Console (F12 or Ctrl+Shift+K)
3. Filter logs by searching for `[SafeRequest]`

### Chromium-based Browsers
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Find "Content Safety Lock"
4. Click "background page" or "service worker"
5. Open DevTools Console (F12)
6. Filter logs by searching for `[SafeRequest]`

---

## Debugging Checklist

### 1. Verify Safe Request Mode is Enabled

**Expected Console Output:**
```
[SafeRequest] loadSafeRequestSettings - config: {enabled: true, ...}
[SafeRequest] saveSafeRequestSettings called - enabled: true
[SafeRequest] Saving Safe Request Mode settings: {enabled: true, ...}
[SafeRequest] Settings saved successfully
```

**What to Check:**
- Navigate to Options → Safe Request Mode tab
- Ensure "Enable Safe Request Mode" checkbox is checked
- Click "Save Settings"
- Check console for the above messages

**If not appearing:**
- The Safe Request Mode tab may not be loading
- Check for JavaScript errors in the console
- Verify options.html and options.js were updated correctly

---

### 2. Verify Handlers are Initialized

**Expected Console Output (on extension startup):**
```
[SafeRequest] safe-request-handler.js loaded
[SafeRequest] safe-request-handler.js: Defining request hooks
[SafeRequest] safe-request-handler.js: Initialization section
[SafeRequest] Initializing Safe Request Mode handlers...
[SafeRequest] ✓ onBeforeSendHeaders listener registered
[SafeRequest] ✓ onBeforeRequest listener registered
[SafeRequest] ✓ Safe Request Mode handlers initialized successfully
```

**What to Check:**
- Reload the extension (go to about:debugging and click reload)
- Check console immediately after reload
- Look for initialization messages

**If not appearing:**
- The safe-request-handler.js file may not be loading
- Check manifest.json to verify script order
- Verify webRequest permission is present in manifest.json

---

### 3. Verify Request Interception

**Expected Console Output (when visiting Google/DDG/etc):**
```
[SafeRequest] onBeforeSendHeaders called for: https://www.google.com/search?q=...
[SafeRequest] Request type: main_frame
[SafeRequest] Checking shouldApplySafeRequest...
[SafeRequest] state.safeRequestMode: {enabled: true, ...}
[SafeRequest] Safe Request Mode is explicitly enabled
[SafeRequest] shouldApplySafeRequest result: true
[SafeRequest] shouldProcessUrl result: true
[SafeRequest] Original headers count: XX
[SafeRequest] addPreferSafeHeader: true
[SafeRequest] ensurePreferSafeHeader called
[SafeRequest] Prefer header set, result headers: [...]
[SafeRequest] Modified headers count: XX
[SafeRequest] Headers after enforcement: [...]
```

**What to Check:**
1. Enable Safe Request Mode in settings
2. Navigate to https://www.google.com/search?q=test
3. Open browser console
4. Look for `onBeforeSendHeaders called` messages
5. Verify `shouldApplySafeRequest result: true`

**If `shouldApplySafeRequest result: false`:**
- Safe Request Mode is not enabled
- Go back to settings and enable it
- Verify the setting was saved (check console for save messages)

**If no `onBeforeSendHeaders called` messages:**
- The webRequest listener may not be registered
- Check initialization messages (step 2 above)
- Verify manifest.json has webRequest permission

---

### 4. Verify Provider Matching

**Expected Console Output (for Google):**
```
[SafeRequest] getProviderForUrl called for: https://www.google.com/search?q=...
[SafeRequest] matchesProvider check - provider: google, hostname: www.google.com, hostMatches: true
[SafeRequest] Path check - paths: ["/search","/complete/search"], pathname: /search, pathMatches: true
[SafeRequest] ✓ URL matches provider: google
[SafeRequest] Found provider: google
```

**Expected Console Output (for DuckDuckGo):**
```
[SafeRequest] getProviderForUrl called for: https://duckduckgo.com/?q=...
[SafeRequest] matchesProvider check - provider: google, hostname: duckduckgo.com, hostMatches: false
[SafeRequest] matchesProvider check - provider: bing, hostname: duckduckgo.com, hostMatches: false
[SafeRequest] matchesProvider check - provider: yahoo, hostname: duckduckgo.com, hostMatches: false
[SafeRequest] matchesProvider check - provider: ddg, hostname: duckduckgo.com, hostMatches: false
[SafeRequest] ✓ URL matches provider: ddg
[SafeRequest] Found provider: ddg
```

**What to Check:**
- Look for `matchesProvider check` messages
- Verify the hostname is being extracted correctly
- Check if `hostMatches` is true for the expected provider

**If hostname is wrong:**
- The URL parsing may be failing
- Check the actual URL being passed
- Verify the provider regex patterns in safe-request-config.js

**If no provider matches:**
- The provider regex may be incorrect
- Check the hostname against the regex pattern
- Verify the path matching (for Google)

---

### 5. Verify Header Enforcement

**Expected Console Output:**
```
[SafeRequest] enforceSafeHeaders called for URL: https://www.google.com/search?q=...
[SafeRequest] config.enabled: true
[SafeRequest] config.addPreferSafeHeader: true
[SafeRequest] Adding Prefer: safe header
[SafeRequest] ensurePreferSafeHeader called
[SafeRequest] Prefer header set, result headers: ["content-type", "user-agent", "Prefer", ...]
[SafeRequest] Checking if YouTube provider enabled: true
[SafeRequest] enforceSafeHeaders returning 15 headers
```

**What to Check:**
- Verify `config.enabled: true`
- Verify `config.addPreferSafeHeader: true`
- Check that "Prefer" header is in the result headers list

**If header not added:**
- Check if `config.enabled` is false
- Check if `config.addPreferSafeHeader` is false
- Verify the `setHeader` function is working

---

### 6. Verify URL Parameter Enforcement

**Expected Console Output (for DuckDuckGo):**
```
[SafeRequest] onBeforeRequest called for: https://duckduckgo.com/?q=abdl+cuckold
[SafeRequest] Request type: main_frame
[SafeRequest] shouldApplySafeRequest result: true
[SafeRequest] shouldProcessUrl result: true
[SafeRequest] perFrameEnforcement: any
[SafeRequest] Original URL: https://duckduckgo.com/?q=abdl+cuckold
[SafeRequest] enforceSafeUrl called for: https://duckduckgo.com/?q=abdl+cuckold
[SafeRequest] config.enabled: true
[SafeRequest] Enforcing DuckDuckGo safe parameters
[SafeRequest] matchesProvider check - provider: ddg, hostname: duckduckgo.com, hostMatches: true
[SafeRequest] ✓ URL matches provider: ddg
[SafeRequest] enforceSafeUrl result - URL changed: true
[SafeRequest] Modified URL: https://duckduckgo.com/?q=abdl+cuckold&kp=1
[SafeRequest] URL changed: true
[SafeRequest] Redirecting to: https://duckduckgo.com/?q=abdl+cuckold&kp=1
```

**What to Check:**
- Verify `onBeforeRequest called` for the search URL
- Check that the provider is matched
- Verify the URL is modified with safe parameters
- Confirm the redirect is happening

**If URL not modified:**
- Check if provider is matched
- Verify the enforce function is being called
- Check if the parameter already exists

---

## Common Issues and Solutions

### Issue: "Prefer: safe" header not appearing in Network Inspector

**Possible Causes:**
1. Safe Request Mode is not enabled
2. The onBeforeSendHeaders listener is not registered
3. The header is being added but filtered out by browser

**Debugging Steps:**
1. Check console for initialization messages (Step 2)
2. Verify Safe Request Mode is enabled (Step 1)
3. Check console for `onBeforeSendHeaders called` (Step 3)
4. Verify header is in the result headers list (Step 5)

**Solution:**
- If initialization messages missing: reload extension
- If Safe Request Mode disabled: enable it in settings
- If header not in result: check `setHeader` function

---

### Issue: URL parameters not being added (e.g., kp=1 for DDG)

**Possible Causes:**
1. Safe Request Mode is not enabled
2. Provider is not being matched
3. The enforce function is not being called
4. The parameter already exists

**Debugging Steps:**
1. Check console for `onBeforeRequest called` (Step 3)
2. Verify provider is matched (Step 4)
3. Check console for `Enforcing DuckDuckGo safe parameters` (Step 6)
4. Verify URL is modified (Step 6)

**Solution:**
- If provider not matched: check hostname and regex pattern
- If enforce not called: verify provider matching
- If URL not modified: check parameter enforcement logic

---

### Issue: Extension not responding to requests

**Possible Causes:**
1. The webRequest listeners are not registered
2. There's a JavaScript error in the handler code
3. The manifest.json is missing webRequest permission

**Debugging Steps:**
1. Check console for initialization messages (Step 2)
2. Look for any JavaScript errors in console
3. Verify manifest.json has webRequest permission
4. Check browser console for error messages

**Solution:**
- If no initialization messages: reload extension
- If JavaScript errors: check the error message and fix the code
- If webRequest permission missing: add it to manifest.json

---

## Console Log Filtering

### Filter for all Safe Request Mode logs:
```
[SafeRequest]
```

### Filter for specific operations:
```
[SafeRequest] onBeforeSendHeaders
[SafeRequest] onBeforeRequest
[SafeRequest] matchesProvider
[SafeRequest] enforceSafeHeaders
[SafeRequest] enforceSafeUrl
```

### Filter for errors:
```
[SafeRequest] Error
[SafeRequest] ✗
```

---

## Testing URLs

Use these URLs to test Safe Request Mode:

### Google Search
```
https://www.google.com/search?q=test
```
Expected: `safe=active` parameter added

### DuckDuckGo
```
https://duckduckgo.com/?q=test
```
Expected: `kp=1` parameter added

### Bing Search
```
https://www.bing.com/search?q=test
```
Expected: `adlt=strict` parameter added

### Yahoo Search
```
https://search.yahoo.com/search?p=test
```
Expected: `vm=r` parameter added

### YouTube
```
https://www.youtube.com/results?search_query=test
```
Expected: `YouTube-Restrict: Strict` header added

---

## Next Steps

If you've completed all debugging steps and Safe Request Mode still isn't working:

1. **Collect all console logs** - Copy the entire console output
2. **Document the issue** - Note which steps are failing
3. **Check manifest.json** - Verify all permissions are present
4. **Verify file order** - Ensure safe-request-*.js files are loaded before background.js
5. **Test in incognito mode** - Some extensions behave differently in private windows

---

## Performance Notes

- Each request generates multiple console log entries
- Filtering by `[SafeRequest]` helps reduce noise
- Disable console logging in production for better performance
- Consider using `console.debug()` instead of `console.log()` for less critical messages
