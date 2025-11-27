# Mature Content Detection Testing Guide

This document provides guidance for testing the Adult Product Sales detection feature across different e-commerce platforms.

## Overview

The extension now detects mature/adult product pages on major shopping and creator platforms using platform-provided labels, categories, breadcrumbs, and toggles. It does NOT attempt to bypass access controls or view hidden content.

## Supported Platforms

### 1. Etsy
**Detection Method:** Looks for `/market/` links in "Explore more related searches" section
- Checks for tags exactly matching "mature" or starting with "mature_"
- Tags are extracted from href paths like `/market/mature` or `/market/mature_content`

**Test URLs:**
- Mature content listing: `https://www.etsy.com/listing/862413007/key-locking-abdl-harness-heavy-duty`
- Look for "Explore more related searches" section with /market/ links

**Expected Signals:** `VENDOR:etsy:mature`
**Score Threshold:** 0.7

**Note:** Tag detection only works on pages that display the "Explore more related searches" section. Not all listings show this section consistently.

### 2. Redbubble
**Detection Method:** Detects "Mature content: Hidden/Show" status text
**Test URLs:**
- Browse with mature content visible: Check footer/status area
- Look for "Mature content:" text in page

**Expected Signals:** `VENDOR:redbubble:mature`
**Score Threshold:** 0.6

### 3. TeePublic
**Detection Method:** Detects "Safe Search: On/Off" filter text
**Test URLs:**
- Browse search results and check filter sidebar
- Look for "Safe Search" toggle

**Expected Signals:** `VENDOR:teepublic:mature`
**Score Threshold:** 0.55

### 4. Zazzle
**Detection Method:** Detects "Rating: G/PG-13/R" on product pages
**Test URLs:**
- Browse product pages and look for "Rating:" label
- R-rated products will trigger blocking

**Expected Signals:** `VENDOR:zazzle:mature`, `VENDOR:zazzle:rating:R`
**Score Threshold:** 0.9 (highest confidence)

### 5. itch.io
**Detection Method:** Detects adult content interstitials and warnings
**Test URLs:**
- Navigate to adult-tagged games/content
- Look for "Are you 18?" or "This page contains adult content" text

**Expected Signals:** `VENDOR:itch.io:mature`
**Score Threshold:** 0.7

### 6. eBay
**Detection Method:** Detects "Sexual Wellness" in breadcrumbs
**Test URLs:**
- Browse to Health & Beauty > Sexual Wellness category
- Check breadcrumb navigation

**Expected Signals:** `VENDOR:ebay:mature`
**Score Threshold:** 0.65

### 7. Amazon
**Detection Method:** Detects "Sexual Wellness" in breadcrumbs and JSON-LD
**Test URLs:**
- Navigate to Sexual Wellness category
- Check breadcrumbs: `#wayfinding-breadcrumbs_feature_div`
- Also checks JSON-LD structured data

**Expected Signals:** `VENDOR:amazon:mature`
**Score Threshold:** 0.75

### 8. Patreon
**Detection Method:** Detects 18+ interstitials and settings text
**Test URLs:**
- Visit 18+ creator pages
- Look for "You can change your 18+ preferences" or "I am 18+" button

**Expected Signals:** `VENDOR:patreon:mature`
**Score Threshold:** 0.85

### 9. Shopify Stores
**Detection Method:** Detects age-gate overlays and text
**Test URLs:**
- Visit stores with age verification
- Look for "Age verification", "Are you 18", "Are you 21" text
- Check for age-gate DOM elements

**Expected Signals:** `VENDOR:shopify:mature`
**Score Threshold:** 0.6

## Testing Procedure

### 1. Enable the Feature
1. Open extension options
2. Navigate to General tab
3. Enable "Content Filtering"
4. Check "Adult Product Sales (e-commerce platforms)"
5. Select specific vendors to monitor

### 2. Test Detection
1. Visit test URLs for each platform
2. Open browser console (F12)
3. Look for `[CSL]` log messages:
   - `[CSL] Mature content signals:` - Shows detected signals
   - `[CSL] Detected signals (final):` - Shows all signals including vendor signals

### 3. Verify Blocking
1. If vendor is enabled and mature content detected:
   - Page should be blocked with purple overlay
   - Block reason should show vendor-specific message (e.g., "Etsy Mature Content")
2. If vendor is disabled:
   - Page should load normally even if mature content detected

### 4. Test Vendor Toggles
1. Enable/disable individual vendors in settings
2. Verify that only enabled vendors trigger blocks
3. Check that vendor section appears/disappears when main category is toggled

## Console Debugging

Key console messages to look for:

```javascript
// Detection running
[CSL] Mature content signals: ["VENDOR:etsy:mature"]

// Final signal list
[CSL] Detected signals (final): ["VENDOR:etsy:mature"] Total signals: 1

// Blocking decision
[BG] Parental mode enabled. Checking policies...
[BG] Signals match category policy. Blocking.
```

## Known Limitations

1. **Etsy:** Not all sellers comply with tagging requirements; detection depends on proper tagging
2. **Redbubble:** Status text indicates global setting, not that specific product is mature
3. **TeePublic:** Safe Search toggle appears on search/listing pages, not individual products
4. **itch.io:** Policy changes in 2025 may cause inconsistency in tagging
5. **Shopify:** Highly variable due to diverse themes and age-gate apps; detection is best-effort

## Troubleshooting

### No signals detected
- Check if page has loaded completely (detection runs at document_start and on load)
- Verify platform URL matches detection regex
- Check console for detection function errors

### Signals detected but no block
- Verify "Content Filtering" is enabled
- Check that "Adult Product Sales" category is enabled
- Confirm specific vendor toggle is enabled
- Check allow-list (vendor pages may be allow-listed)

### False positives
- Some platforms show mature content settings even on non-mature pages
- Adjust score thresholds in `mature-content-detectors.js` if needed
- Consider adding specific URL patterns to allow-list

## Score Thresholds

Signals are only generated if detection score >= 0.6:

- **High confidence (0.85-0.9):** Patreon, Zazzle
- **Medium confidence (0.65-0.75):** Etsy, itch.io, eBay, Amazon
- **Lower confidence (0.55-0.6):** Redbubble, TeePublic, Shopify

Scores below 0.6 are considered too uncertain and won't generate signals.

## Development Notes

### Adding New Vendors

1. Add vendor to `DEFAULT_STATE.parental.adultProductSalesVendors` in `background.js`
2. Add checkbox to `options.html` in vendor section
3. Add load/save logic in `options.js`
4. Create detector function in `mature-content-detectors.js`
5. Add signal check in `utils.js` `matchesCategoryPolicy()`
6. Add reason text in `utils.js` `getBlockReason()`
7. Update locked view display in `options.js`

### Adjusting Detection Logic

Edit detector functions in `mature-content-detectors.js`:
- Modify selectors for DOM elements
- Adjust text matching patterns
- Change score thresholds
- Add additional signals

### Signal Format

Vendor signals follow the pattern: `VENDOR:<platform>:mature`

Special signals:
- `VENDOR:zazzle:rating:R` - Specific rating detected on Zazzle
