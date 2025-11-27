# Test File Summary

## Overview

This directory contains **30 HTML test files** (plus index and README) for verifying the Content Safety Lock extension's detection and blocking capabilities.

## File Count by Category

### Basic Categories (12 files)
- **Sexual/Nudity:** 2 files (1 pass, 1 fail)
- **Violence:** 2 files (1 pass, 1 fail)
- **Profanity:** 2 files (1 pass, 1 fail)
- **Drugs/Alcohol:** 2 files (1 pass, 1 fail)
- **Gambling:** 2 files (1 pass, 1 fail)
- **Age Verification:** 2 files (1 pass, 1 fail)

### Adult Product Sales Vendors (18 files)
- **Etsy:** 2 files (1 pass, 1 fail)
- **Redbubble:** 2 files (1 pass, 1 fail)
- **TeePublic:** 2 files (1 pass, 1 fail)
- **Zazzle:** 2 files (1 pass, 1 fail)
- **itch.io:** 2 files (1 pass, 1 fail)
- **eBay:** 2 files (1 pass, 1 fail)
- **Amazon:** 2 files (1 pass, 1 fail)
- **Patreon:** 2 files (1 pass, 1 fail)
- **Shopify:** 2 files (1 pass, 1 fail)

### Documentation (2 files)
- **index.html** - Visual navigation interface
- **README.md** - Detailed testing instructions

## Total: 32 Files

## File Naming Convention

- `{category}-pass.html` - Should be **BLOCKED** when category is enabled
- `{category}-fail.html` - Should **NOT be blocked** even when category is enabled
- `adult-product-sales/{vendor}-pass.html` - Should be **BLOCKED** when vendor is enabled
- `adult-product-sales/{vendor}-fail.html` - Should **NOT be blocked** even when vendor is enabled

## Quick Start

1. **Open the index:** `file:///path/to/sample-test-files/index.html`
2. **Enable extension settings** for the category/vendor you want to test
3. **Click test links** from the index page
4. **Verify behavior:**
   - PASS tests → Should see purple block overlay
   - FAIL tests → Should see the page normally

## Test Domain Override

All vendor test files include a special meta tag:
```html
<meta name="test-domain" content="www.example.com">
```

This allows the extension to detect the platform even when loaded from `file://` URLs. The extension code checks for this tag and uses it to override the URL for detection purposes.

## Implementation Details

### Extension Changes
- **mature-content-detectors.js:** Added `getEffectiveURL()` function that checks for `test-domain` meta tag
- **content.js:** No changes needed - detection runs automatically
- **.web-ext-ignore:** Added `sample-test-files` to exclude from packaging

### Test File Features
- Minimal HTML for fast loading
- Inline CSS for self-contained files
- Clear visual indicators (PASS/FAIL badges)
- Embedded test details and instructions
- Realistic DOM structures matching actual platforms

## Verification Checklist

For each test file, verify:
- [ ] File opens in Firefox without errors
- [ ] Console shows `[CSL]` detection messages
- [ ] PASS files trigger block overlay when category/vendor enabled
- [ ] FAIL files load normally when category/vendor enabled
- [ ] Block reason matches expected signal
- [ ] Test works with category/vendor disabled (no block)

## Console Output Examples

### PASS Test (should block)
```
[CSL] Local file detected - using test domain: https://www.etsy.com/test-page
[CSL] Mature content signals: ["VENDOR:etsy:mature"]
[CSL] Detected signals (final): ["VENDOR:etsy:mature"] Total signals: 1
[BG] Signals match category policy. Blocking.
```

### FAIL Test (should not block)
```
[CSL] Local file detected - using test domain: https://www.etsy.com/test-page
[CSL] Mature content signals: []
[CSL] Detected signals (final): [] Total signals: 0
[CSL] No signals detected - page allowed
```

## Maintenance

When adding new categories or vendors:
1. Create `{name}-pass.html` with detection signals
2. Create `{name}-fail.html` without signals
3. Add links to `index.html`
4. Update this summary
5. Test both files to verify behavior

## Notes

- Files are safe to commit to repository
- Excluded from web-ext packaging via `.web-ext-ignore`
- No external dependencies or network requests
- Works offline
- Compatible with all Firefox versions that support the extension
