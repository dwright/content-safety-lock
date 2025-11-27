# Sample Test Files

This directory contains HTML test files for verifying the Content Safety Lock extension's detection capabilities. Each file simulates a real website's content patterns to test blocking behavior.

## How to Use

1. **Enable the extension** in Firefox
2. **Configure settings** in the extension options:
   - Enable "Content Filtering"
   - Enable the specific categories/vendors you want to test
3. **Open test files** directly in Firefox using `File > Open File` or drag-and-drop
4. **Verify behavior**:
   - **PASS files** should be **BLOCKED** (purple overlay appears)
   - **FAIL files** should **NOT be blocked** (page loads normally)

## Special Meta Tag

All test files use a special `<meta name="test-domain">` tag to simulate the actual domain. This allows the extension to detect the platform even when loaded from `file://` URLs.

Example:
```html
<meta name="test-domain" content="www.etsy.com">
```

## Test File Structure

### Basic Categories
- `sexual-nudity-pass.html` - Should be blocked (contains RTA label)
- `sexual-nudity-fail.html` - Should NOT be blocked (no signals)
- `violence-pass.html` - Should be blocked (ICRA violence signal)
- `violence-fail.html` - Should NOT be blocked
- `profanity-pass.html` - Should be blocked (ICRA profanity signal)
- `profanity-fail.html` - Should NOT be blocked
- `drugs-pass.html` - Should be blocked (ICRA drugs signal)
- `drugs-fail.html` - Should NOT be blocked
- `gambling-pass.html` - Should be blocked (ICRA gambling signal)
- `gambling-fail.html` - Should NOT be blocked
- `age-verification-pass.html` - Should be blocked (age verification required)
- `age-verification-fail.html` - Should NOT be blocked

### Adult Product Sales Vendors
Located in `adult-product-sales/` subdirectory:

- `etsy-pass.html` - Should be blocked (mature tag detected)
- `etsy-fail.html` - Should NOT be blocked
- `redbubble-pass.html` - Should be blocked (mature content status)
- `redbubble-fail.html` - Should NOT be blocked
- `teepublic-pass.html` - Should be blocked (safe search off)
- `teepublic-fail.html` - Should NOT be blocked
- `zazzle-pass.html` - Should be blocked (R rating)
- `zazzle-fail.html` - Should NOT be blocked (G rating)
- `itch-io-pass.html` - Should be blocked (adult warning)
- `itch-io-fail.html` - Should NOT be blocked
- `ebay-pass.html` - Should be blocked (Sexual Wellness breadcrumb)
- `ebay-fail.html` - Should NOT be blocked
- `amazon-pass.html` - Should be blocked (Sexual Wellness breadcrumb)
- `amazon-fail.html` - Should NOT be blocked
- `patreon-pass.html` - Should be blocked (18+ interstitial)
- `patreon-fail.html` - Should NOT be blocked
- `shopify-pass.html` - Should be blocked (age gate)
- `shopify-fail.html` - Should NOT be blocked

## Testing Checklist

### Before Testing
- [ ] Extension is installed and enabled
- [ ] Content Filtering is enabled in options
- [ ] Specific categories/vendors are enabled

### For Each Test File
- [ ] Open the file in Firefox
- [ ] Check browser console (F12) for `[CSL]` messages
- [ ] Verify expected behavior (blocked or not blocked)
- [ ] Check that block reason matches the category/vendor

### Expected Console Output

**For PASS files (should block):**
```
[CSL] Detected signals (final): ["VENDOR:etsy:mature"] Total signals: 1
[BG] Signals match category policy. Blocking.
```

**For FAIL files (should not block):**
```
[CSL] Detected signals (final): [] Total signals: 0
[CSL] No signals detected - page allowed
```

## Troubleshooting

### Test file not blocked when it should be
1. Check that the category/vendor is enabled in settings
2. Verify the file has the correct meta tag
3. Check console for detection messages
4. Ensure Content Filtering is enabled

### Test file blocked when it shouldn't be
1. Check for unintended signals in console
2. Verify the test file doesn't contain blocking patterns
3. Check if domain is in block-list

### No console messages
1. Open Developer Tools (F12) before loading the file
2. Refresh the page after opening console
3. Check that extension is enabled

## Notes

- Test files are excluded from web-ext packaging (see `.web-ext-ignore`)
- Files are safe to commit to repository
- Test files use minimal HTML to isolate specific detection patterns
- Real websites may have additional complexity not reflected in these tests
