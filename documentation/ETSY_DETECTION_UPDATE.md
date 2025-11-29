# Etsy Detection Method Update

## Summary

Updated the Etsy mature content detection to use the current `/market/` link structure instead of the outdated search link method.

## Problem

The original detection method (from ChatGPT spec) was looking for:
- Links with `/search?q=` or `/shop/` in href
- Link text exactly matching "mature"

This method was **outdated** and no longer matches how Etsy displays product tags.

## Solution

Updated to use Etsy's current "Explore more related searches" section:
- Looks for all links with `/market/` in href
- Extracts tag name from URL path: `/market/TAG_NAME`
- Checks if tag is exactly "mature" or starts with "mature_"

## Detection Logic

```javascript
// Find all /market/ links (these are product tags)
const marketLinks = [...document.querySelectorAll('a[href*="/market/"]')];

for (const link of marketLinks) {
  const href = link.getAttribute('href');
  // Extract tag from URL path: /market/TAG_NAME?params or /market/TAG_NAME
  const match = href.match(/\/market\/([^?#]+)/);
  if (match) {
    const tag = match[1].toLowerCase().trim();
    
    // Check if tag is exactly "mature" or starts with "mature_"
    if (tag === 'mature' || tag.startsWith('mature_')) {
      hasMatureTag = true;
    }
  }
}
```

## Examples

**Triggers detection:**
- `/market/mature` → ✅ Blocks
- `/market/mature_content` → ✅ Blocks
- `/market/mature_art` → ✅ Blocks

**Does NOT trigger:**
- `/market/art` → ❌ No block
- `/market/pottery` → ❌ No block
- `/market/mature_woman` → ✅ Blocks (starts with "mature_")

## Important Notes

### Limitation: Inconsistent Tag Display

The "Explore more related searches" section **does not appear on all Etsy listing pages**. This means:

- ✅ **Detection works** when the section is present
- ❌ **Detection fails** when the section is absent (even if listing has mature tag)
- 🤷 **Inconsistent** - Etsy controls when/where this section appears

### Why This Limitation Exists

Etsy does not consistently display product tags in the DOM. The `/market/` links only appear in the "Explore more related searches" section, which Etsy shows algorithmically based on:
- User behavior
- Search context
- Page layout
- A/B testing

### Alternative Approaches Considered

1. **Search for tag elements by class** - Etsy doesn't use consistent tag container classes
2. **Check page metadata** - Tags not included in meta tags or JSON-LD
3. **Parse product JSON** - Would require fetching additional resources (violates non-invasive principle)
4. **Use Etsy API** - Not available in content script context

### Recommendation

This is the **best available method** given:
- ✅ Non-invasive (only reads visible DOM)
- ✅ No additional requests
- ✅ Uses Etsy's official tag links
- ⚠️ Limited by Etsy's inconsistent tag display

## Test URLs

**Mature content (should block when Etsy vendor enabled):**
- https://www.etsy.com/listing/862413007/key-locking-abdl-harness-heavy-duty
  - Has "Explore more related searches" section
  - Contains `/market/mature` and other mature-related tags

**Clean content (should NOT block):**
- Most regular Etsy listings without mature tags
- Look for pages with `/market/` links but no "mature" or "mature_*" tags

## Files Modified

1. **mature-content-detectors.js**
   - Updated `etsy()` function to use `/market/` link detection
   - Added console logging for detected tags
   - Improved error handling for malformed URLs

2. **sample-test-files/adult-product-sales/etsy-pass.html**
   - Updated to include `/market/mature` and `/market/mature_content` links
   - Reflects actual Etsy HTML structure

3. **sample-test-files/adult-product-sales/etsy-fail.html**
   - Updated to include clean `/market/` links (pottery, handmade, etc.)
   - Shows what a non-mature listing looks like

4. **MATURE_CONTENT_TESTING.md**
   - Updated Etsy section with new detection method
   - Added note about inconsistent tag display
   - Updated test URL to working example

## Testing

To test the updated detection:

1. **Enable settings:**
   - Content Filtering: ON
   - Adult Product Sales: ON
   - Etsy vendor: ON

2. **Test mature content:**
   - Visit: https://www.etsy.com/listing/862413007/key-locking-abdl-harness-heavy-duty
   - Expected: Page should be BLOCKED
   - Console should show: `[CSL] Etsy mature tag detected: mature`

3. **Test clean content:**
   - Visit any regular Etsy listing (pottery, jewelry, etc.)
   - Expected: Page should NOT be blocked
   - Console should show detected tags (none matching "mature")

4. **Test local files:**
   - Open `sample-test-files/adult-product-sales/etsy-pass.html`
   - Expected: BLOCKED
   - Open `sample-test-files/adult-product-sales/etsy-fail.html`
   - Expected: NOT blocked

## Console Output

**When mature tag detected:**
```
[CSL] Etsy tags detected: ["art", "mature", "poster", "mature_content"]
[CSL] Etsy mature tag detected: mature
[CSL] Mature content signals: ["VENDOR:etsy:mature"]
[CSL] Detected signals (final): ["VENDOR:etsy:mature"]
```

**When no mature tag:**
```
[CSL] Etsy tags detected: ["pottery", "handmade", "ceramic", "home_decor"]
[CSL] Mature content signals: []
[CSL] Detected signals (final): []
```
