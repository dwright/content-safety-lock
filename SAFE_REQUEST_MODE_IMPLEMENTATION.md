# Safe Request Mode Implementation Plan

## Overview

This document outlines the implementation of "Request Safe Content from Server" mode for Content Safety Lock. This feature adds standardized headers and provider-specific URL parameters/redirects to request safer content at the source, complementing the existing parental filtering system.

---

## 1. Architecture & Integration Points

### Current System Structure
- **manifest.json**: MV3 extension with webRequest permissions
- **background.js**: Service worker handling policy engine and state management
- **content.js**: Content script detecting labels and communicating with background
- **utils.js**: Shared utilities for crypto, time, label parsing, and URL handling
- **options.html/options.js**: Settings UI for user configuration

### New Components Required
1. **safe-request-config.js** (new): Configuration schema and provider rules
2. **safe-request-handler.js** (new): webRequest hook implementation
3. **safe-request-utils.js** (new): URL rewriting and header manipulation utilities
4. **options.html/options.js** (modified): UI for Safe Request Mode settings
5. **manifest.json** (modified): Add webRequest permissions and host patterns
6. **background.js** (modified): Store and manage Safe Request Mode state

---

## 2. Storage Schema

### New State Structure in background.js

Add to `DEFAULT_STATE`:

```javascript
safeRequestMode: {
  enabled: false,
  addPreferSafeHeader: true,
  applyInPrivateWindows: true,
  forceUnderSelfLock: true,
  ignoreAllowlistUnderSelfLock: true,
  blockUserParamDowngrade: true,
  perFrameEnforcement: "any",
  providers: {
    google: { enabled: true, useParam: true, enforceCookie: false, useRedirect: false },
    bing: { enabled: true, useParam: true, usePreferSafeHonor: true, useRedirect: false },
    yahoo: { enabled: true, useParam: true },
    ddg: { enabled: true, useParam: true, useRedirect: false },
    youtube: { enabled: true, headerMode: "strict", useRestrictHostRedirect: false },
    tumblr: { enabled: true, filterMature: true }
  }
}
```

---

## 3. Provider Rules Implementation

### 3.1 Global Header (All Hosts)

**Hook**: `webRequest.onBeforeSendHeaders` (blocking)

**Logic**:
- Add `Prefer: safe` header to all requests when Safe Request Mode is enabled
- Add `YouTube-Restrict: {strict|moderate}` for YouTube hosts
- Skip internal extension URLs (moz-extension://)

---

### 3.2 Google Search

**Hosts**: `*.google.*` with paths `/search`, `/complete/search`

**Parameter**: `safe=active`

**Override relaxed values**: `off`, `images`, `moderate`

**Optional Cookie**: Set SafeSearch cookie flags as backstop (non-authoritative)

---

### 3.3 Bing Search

**Hosts**: `*.bing.com`

**Parameter**: `adlt=strict`

**Override relaxed values**: `off`, `moderate`

**Optional Redirect**: `www.bing.com` → `strict.bing.com` (default OFF)

---

### 3.4 Yahoo Search

**Hosts**: `search.yahoo.com` and regional variants

**Parameter**: `vm=r` (strict mode)

**Override relaxed values**: `s`, `off`

---

### 3.5 DuckDuckGo

**Hosts**: `duckduckgo.com`

**Parameter**: `kp=1` (strict)

**Override relaxed values**: `-2`, `-1`, `0`

---

### 3.6 YouTube

**Hosts**: `*.youtube.com`, `*.youtu.be`, `*.ytimg.com`, `*.googlevideo.com`

**Header**: `YouTube-Restrict: Strict` or `Moderate`

**Apply to**: All requests to YouTube hosts

---

### 3.7 Tumblr (Hybrid Interception)

**Hosts**: `*.tumblr.com`

**Triggers**:
- **Network**: Intercepts `window.fetch` for API requests (`/v2/blog/*/posts`, `/api/v2/timeline`, `/api/v2/search`)
- **Hydration**: Intercepts `JSON.parse` to catch initial state hydration
- **DOM**: MutationObserver scans for pre-rendered mature content

**Logic**:
1. **Network/JSON**: Filters JSON responses/objects to remove posts with:
   - `headerContext.label.text` IN ["Potentially mature content", "Adult content", "Explicit"]
   - `isNsfw` is true
   - `classification` IN ["adult", "nsfw"]
   - `communityLabel.isNsfw` is true
2. **DOM**: Scans for elements containing specific warning text and replaces their parent container with a block message.

**Implementation**: Main World script injection via `browser.scripting` (bypasses CSP).

---

## 4. Request Modification Flow

### 4.1 onBeforeSendHeaders Hook

**Trigger**: All HTTP(S) requests

**Logic**:
```
IF safeRequestMode.enabled OR (selfLock.active AND forceUnderSelfLock):
  IF addPreferSafeHeader:
    ADD "Prefer: safe" header
  IF youtube provider enabled AND hostname matches youtube pattern:
    ADD "YouTube-Restrict: {strict|moderate}" header
```

---

### 4.2 onBeforeRequest Hook

**Trigger**: main_frame and sub_frame requests (or all if perFrameEnforcement="any")

**Logic**:
```
IF safeRequestMode.enabled OR (selfLock.active AND forceUnderSelfLock):
  FOR EACH provider rule:
    IF provider.enabled AND hostname matches provider pattern:
      IF blockUserParamDowngrade:
        APPLY parameter enforcement (add/replace relaxed params)
      IF provider.useRedirect:
        APPLY hostname redirect
```

---

## 5. Implementation Files

### 5.1 safe-request-config.js (NEW)

**Purpose**: Define provider rules and matching logic

**Key Functions**:
- `PROVIDER_RULES` object with match/enforce functions
- `DEFAULT_SAFE_REQUEST_CONFIG` with default settings
- `matchesProvider(url, providerName)` - check if URL matches provider

---

### 5.2 safe-request-handler.js (NEW)

**Purpose**: Implement webRequest hooks

**Key Functions**:
- `shouldApplySafeRequest()` - check if mode should be active
- `onBeforeSendHeaders` listener - add headers
- `onBeforeRequest` listener - modify URL parameters
- `initializeSafeRequestHandlers()` - register listeners

---

### 5.3 safe-request-utils.js (NEW)

**Purpose**: URL rewriting and parameter manipulation

**Key Functions**:
- `setParam(url, key, value)` - set URL parameter
- `getParam(url, key)` - get URL parameter
- `enforceParam(url, key, strictValue, relaxedValues)` - enforce safe parameter
- `redirectHost(url, fromHost, toHost)` - redirect hostname

---

### 5.4 manifest.json (MODIFIED)

**Changes**:

1. Add webRequest permission:
```json
"permissions": ["storage", "tabs", "alarms", "webRequest"]
```

2. Add host permissions:
```json
"host_permissions": [
  "<all_urls>",
  "*://*.google.*/*",
  "*://*.bing.com/*",
  "*://search.yahoo.com/*",
  "*://duckduckgo.com/*",
  "*://*.youtube.com/*",
  "*://*.youtu.be/*",
  "*://*.ytimg.com/*",
  "*://*.googlevideo.com/*"
]
```

3. Update background scripts:
```json
"background": {
  "scripts": [
    "utils.js",
    "safe-request-config.js",
    "safe-request-utils.js",
    "safe-request-handler.js",
    "background.js"
  ]
}
```

---

### 5.5 background.js (MODIFIED)

**Changes**:

1. Add `safeRequestMode` to `DEFAULT_STATE` (see Section 2)
2. Ensure Safe Request Mode state persists during Self-Lock
3. Add message handler for Safe Request Mode updates (if needed)

---

### 5.6 options.html (MODIFIED)

**New Tab**: "Safe Request Mode"

**Sections**:
- Master toggle for Safe Request Mode
- Global header option
- Per-provider toggles (Google, Bing, Yahoo, DDG, YouTube)
- Advanced options (parameter downgrade blocking, frame enforcement, private windows)
- Save button

---

### 5.7 options.js (MODIFIED)

**New Functions**:
- `loadSafeRequestSettings()` - load Safe Request Mode config
- `saveSafeRequestSettings()` - save Safe Request Mode config
- Event listeners for Safe Request Mode tab

---

## 6. QA Test Matrix

| Case | Input URL | Expected Behavior |
|------|-----------|-------------------|
| Google basic | `https://www.google.com/search?q=cats` | URL becomes `...&safe=active` |
| Google off→strict | `https://www.google.com/search?q=cats&safe=off` | URL becomes `...&safe=active` |
| Bing basic | `https://www.bing.com/search?q=cats` | URL becomes `...&adlt=strict` |
| Yahoo basic | `https://search.yahoo.com/search?p=cats` | URL becomes `...&vm=r` |
| DDG basic | `https://duckduckgo.com/?q=cats` | URL becomes `...&kp=1` |
| YouTube header | `https://www.youtube.com/results?search_query=cats` | Header `YouTube-Restrict: Strict` added |
| Subframe search | iframe loads `duckduckgo.com/?q=...` | `kp=1` enforced (if perFrameEnforcement=any) |
| Self-Lock on | Any of above | Feature forcibly ON, UI read-only |
| Private window | All above | Same enforcement if applyInPrivateWindows=true |
| Feature disabled | Any of above | No modification; original URL/headers used |

---

## 7. Implementation Phases

### Phase 1: Foundation
- [ ] Create `safe-request-config.js` with provider rules
- [ ] Create `safe-request-utils.js` with URL manipulation helpers
- [ ] Update `manifest.json` with permissions and host patterns
- [ ] Update `background.js` with `safeRequestMode` state

### Phase 2: Request Handlers
- [ ] Create `safe-request-handler.js` with webRequest hooks
- [ ] Implement `onBeforeSendHeaders` for global header + YouTube
- [ ] Implement `onBeforeRequest` for URL parameter enforcement
- [ ] Test with manual URL inspection

### Phase 3: UI & Integration
- [ ] Add "Safe Request Mode" tab to `options.html`
- [ ] Implement load/save functions in `options.js`
- [ ] Add Self-Lock integration (force enable when active)
- [ ] Test UI state persistence

### Phase 4: Testing & Refinement
- [ ] Create Playwright E2E tests for each provider
- [ ] Test parameter override scenarios
- [ ] Test Self-Lock forced activation
- [ ] Test private window behavior
- [ ] Performance profiling

---

## 8. Security & Privacy

### Headers Visibility
- `Prefer: safe` and `YouTube-Restrict` are visible to servers
- Document in privacy notes that these reveal a "safety preference"

### Cookie Enforcement (Optional)
- Only set provider-specific SafeSearch cookies
- Never read unrelated cookies
- Default OFF to minimize privacy impact

### Scope & Permissions
- Granular host permissions for covered providers
- No telemetry by default
- Optional debug logging toggle

### Self-Lock Interaction
- When Self-Lock is active and `forceUnderSelfLock: true`, Safe Request Mode cannot be disabled
- If `ignoreAllowlistUnderSelfLock: true`, provider rules apply even to allow-listed sites

---

## 9. Error Handling & Edge Cases

### Signed-in Preferences Conflict
- Users may set provider SafeSearch off in their account
- Our URL/headers override for the current session
- We do NOT modify accounts or persistent user settings

### Localized Domains
- Current implementation covers `*.google.*` pattern
- Future: Support regional domain maps (google.co.uk, bing.co.jp, etc.)

### Mobile User Agents
- Include `m.youtube.com`, `m.bing.com` in host patterns
- Test with mobile user agents

### Performance Optimization
- Use precompiled hostname tries for O(1) lookups
- Avoid regex on hot paths (onBeforeSendHeaders)
- Cache provider config in memory

---

## 10. Future Extensions (Backlog)

- [ ] Per-region host maps via remote JSON
- [ ] Additional providers (Reddit, Pinterest, Tumblr)
- [ ] DOM-level content filtering (separate module)
- [ ] Request logging dashboard
- [ ] Chromium/Chrome support (MV3 declarativeNetRequest)

---

## 11. Documentation & Rollout

### User-Facing Documentation
- Feature title: "Request Safe Content from Servers"
- Subtitle: "Send standardized safety headers and SafeSearch/Restricted-Mode controls to supported providers"
- Help text: "This does not analyze pages. It asks providers to filter results (e.g., Google SafeSearch, Bing Strict, YouTube Restricted Mode). Some services may ignore these signals."

### Changelog Entry
- Version: X.Y.0 (minor release)
- Include list of supported providers
- Note: Feature disabled by default; enabled automatically under Self-Lock if configured

---

## 12. Integration Checklist

- [ ] All new files created and linted
- [ ] manifest.json updated with permissions
- [ ] background.js state schema updated
- [ ] options.html tab added
- [ ] options.js load/save functions implemented
- [ ] webRequest hooks registered and tested
- [ ] Self-Lock integration verified
- [ ] E2E tests passing for all providers
- [ ] Documentation updated
- [ ] Privacy/security review completed
- [ ] Performance benchmarked
- [ ] Version bumped and changelog updated
