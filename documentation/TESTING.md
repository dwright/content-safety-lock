# Testing Guide - Content Safety Lock

## Test Environment Setup

### Prerequisites
- A supported browser: Firefox (latest), Chrome/Edge/Brave/Opera 111+, or Safari
  16.4+ on macOS
- A build of the extension: `npm install && npm run build:all`
- The extension loaded from `build/<browser>/` (see
  [BUILDING.md](BUILDING.md#loading-a-build))
- Test pages (included in `test-pages/` directory)

### Automated Checks

Run these before the manual cases below:

```bash
npm test               # Unit tests (safe-request headers, platform layer)
npm run build:all      # Fails if any manifest reference is missing
npm run lint:firefox   # web-ext lint against build/firefox
```

### Loading Test Pages
1. Open the browser
2. Press `Ctrl+L` (or `Cmd+L` on Mac)
3. Type: `file:///path/to/test-pages/adult-labeled.html`
4. Press Enter

In Chrome, file URLs require enabling "Allow access to file URLs" for the
extension on `chrome://extensions`.

### Per-browser differences to expect

| Area | Firefox | Chrome | Safari |
|---|---|---|---|
| Label-based blocking | ✅ | ✅ | ✅ |
| Self-Lock, options, popup | ✅ | ✅ | ✅ |
| Safe Request Mode search/video enforcement (safe search tests) | ✅ | ❌ options hidden, logs "unavailable" warning | ❌ options hidden, logs "unavailable" warning |
| Safe Request Mode site filtering (Tumblr, Reddit, Bluesky) | ✅ | ✅ | ✅ |
| Background inspection | `about:debugging` → Inspect | `chrome://extensions` → service worker | Safari → Develop menu |

## Test Cases

### Test 1: Basic Label Detection

**Objective**: Verify that pages with adult labels are detected and blocked

**Steps**:
1. Load `test-pages/adult-labeled.html`
2. Verify a block overlay appears
3. Check that the reason shows "Adult Content"

**Expected Result**: ✓ Block overlay appears with correct reason

**Troubleshooting**:
- If no overlay appears, check that filtering is enabled in General settings
- Verify the meta tag is present in page source (F12)
- Check browser console for errors

---

### Test 2: RTA Label Detection

**Objective**: Verify RTA labels are detected

**Steps**:
1. Load `test-pages/rta-labeled.html`
2. Verify a block overlay appears
3. Check that the reason shows "RTA Label"

**Expected Result**: ✓ Block overlay appears with "RTA Label" reason

---

### Test 3: Clean Page (No Block)

**Objective**: Verify pages without labels load normally

**Steps**:
1. Load `test-pages/clean-page.html`
2. Verify the page loads normally without any overlay

**Expected Result**: ✓ Page loads normally, no block overlay

**Troubleshooting**:
- If a block overlay appears, there may be a false positive
- Check page source for unexpected meta tags
- Review browser console for errors

---

### Test 4: Allow-List

**Objective**: Verify allow-list prevents blocking

**Steps**:
1. Go to Options → General tab
2. Add `file` to the Allow-List (or the domain of your test page)
3. Load `test-pages/adult-labeled.html`
4. Verify the page loads without blocking

**Expected Result**: ✓ Page loads normally despite adult label

**Cleanup**:
- Remove the domain from Allow-List after testing

---

### Test 5: Block-List

**Objective**: Verify block-list forces blocking

**Steps**:
1. Go to Options → General tab
2. Add `file` to the Block-List
3. Load `test-pages/clean-page.html` (no labels)
4. Verify the page is blocked

**Expected Result**: ✓ Page is blocked even without labels

**Cleanup**:
- Remove the domain from Block-List after testing

---

### Test 6: Category Toggles

**Objective**: Verify category toggles work correctly

**Steps**:
1. Go to Options → General tab
2. Disable "Sexual/Nudity" category
3. Load `test-pages/adult-labeled.html`
4. Verify the page is NOT blocked (since it only has "adult" label, not specific category)
5. Re-enable "Sexual/Nudity"
6. Reload the page
7. Verify the page IS blocked

**Expected Result**: ✓ Category toggles control blocking behavior

---

### Test 7: Self-Lock Activation and General Tab Lock

**Objective**: Verify Self-Lock activates and makes the General settings tab read-only

**Steps**:
1. Go to Options → Self-Lock tab
2. Select a duration and an early-unlock mode
3. Configure a passphrase or game options when applicable
4. Click "Activate Self-Lock"
5. Verify the status shows "Self-Lock Active"
6. Open the General tab
7. Verify the General settings are read-only and cannot be unlocked until Self-Lock ends or is disabled through its configured early-unlock flow

**Expected Result**: ✓ Self-Lock activates, status updates, and the General tab is locked

---

### Test 8: Allow-Listed Content During Self-Lock

**Objective**: Verify Self-Lock does not independently block allow-listed content

**Steps**:
1. Add an adult-labeled test domain to the General-tab Allow-List
2. Activate Self-Lock
3. Load the adult-labeled page on that allow-listed domain
4. Verify the page loads without a block overlay

**Expected Result**: ✓ The allow-list remains effective while Self-Lock is active

---

### Test 9: Options-Page Early Unlock

**Objective**: Verify the configured early-unlock flow works from the Self-Lock tab

**Prerequisites**:
- Self-Lock must be active (see Test 7)

**Steps**:
1. Go to Options → Self-Lock tab
2. Use the phrase or Mastermind early-unlock control configured at activation
3. Complete the required passphrase verification or puzzle
4. Verify the status changes to "Self-Lock Inactive"
5. Open the General tab and verify settings are editable

**Expected Result**: ✓ The configured options-page early-unlock flow disables Self-Lock

---

### Test 10: Phrase Unlock Cool-Down

**Objective**: Verify the phrase-based early-unlock cool-down is enforced in the Self-Lock tab

**Prerequisites**:
- Self-Lock must be active in phrase mode with a nonzero cool-down

**Steps**:
1. Go to Options → Self-Lock tab
2. Start the phrase-based early-unlock flow and enter the configured passphrase
3. Verify the cool-down status is shown before Self-Lock can be disabled
4. Verify the General tab remains read-only during the cool-down
5. Complete the flow after the cool-down ends

**Expected Result**: ✓ The cool-down prevents immediate phrase-based unlock

---

### Test 11: Clock Tamper Detection

**Objective**: Verify monotonic time tracking detects clock changes

**Steps**:
1. Activate self-lock for 1 hour
2. Note the end time
3. Open browser console (F12)
4. Run: `browser.runtime.sendMessage({type: 'GET_STATE'}).then(r => console.log(r.state.selfLock))`
5. Note the `endsAtEpochMs` value
6. Change system clock backward by 30 minutes
7. Run the same command again
8. Verify `endsAtEpochMs` has been extended by the monotonic delta

**Expected Result**: ✓ Lock duration extended when clock is rolled back

**Note**: This test requires system-level clock manipulation. Alternatively, you can verify the logic by reviewing the code in `background.js` and `utils.js`.

---

### Test 12: Private Window Parental Filtering

**Objective**: Verify parental filtering remains active in private windows independently of Self-Lock

**Prerequisites**:
- Parental filtering is enabled

**Steps**:
1. Open a private window (Ctrl+Shift+P or Cmd+Shift+P)
2. Load `test-pages/adult-labeled.html`
3. Verify the content-filter block overlay appears
4. Repeat while Self-Lock is active
5. Verify the same parental block behavior remains in effect

**Expected Result**: ✓ Parental filtering is enforced identically in private windows

---

### Test 13: Recovery Codes

**Objective**: Verify recovery codes can be generated

**Steps**:
1. Go to Options → Security tab
2. Click "Generate Recovery Codes"
3. Verify 5 codes are displayed
4. Click "Copy All"
5. Paste into a text editor to verify they copied correctly

**Expected Result**: ✓ Recovery codes generated and can be copied

---

### Test 14: Settings PIN

**Objective**: Verify settings PIN protects general settings

**Steps**:
1. Go to Options → General tab
2. Enter a PIN (e.g., "1234") in Settings PIN field
3. Click "Save Settings"
4. Reload the options page
5. Try to change a setting (e.g., toggle a category)
6. Verify you're prompted for the PIN

**Expected Result**: ✓ Settings are protected by PIN

**Note**: Current implementation saves PIN but doesn't enforce it on every change. This is a design choice that could be enhanced.

---

### Test 15: Auto-Increment on Blocked Access

**Objective**: Verify a parental content block extends an active Self-Lock when Auto-Increment is enabled

**Prerequisites**:
- Parental filtering and Self-Lock are active
- Auto-Increment on Blocked Access is enabled in the Self-Lock tab

**Steps**:
1. Note the active Self-Lock end time
2. Load `test-pages/adult-labeled.html`
3. Verify the content-filter block overlay appears
4. Return to the Self-Lock tab
5. Verify the end time has increased by the configured increment

**Expected Result**: ✓ A parental content block extends the active Self-Lock

---

## Performance Tests

### Test 16: Page Load Performance

**Objective**: Verify extension doesn't significantly slow down page loads

**Steps**:
1. Open browser console (F12)
2. Go to Network tab
3. Load `test-pages/clean-page.html`
4. Note the load time
5. Load the same page multiple times
6. Verify load times are consistent (< 100ms overhead)

**Expected Result**: ✓ Minimal performance impact

---

### Test 17: Memory Usage

**Objective**: Verify extension doesn't leak memory

**Steps**:
1. Open `about:memory` in Firefox (or Chrome's Task Manager: Window → Task Manager)
2. Note the extension's memory usage
3. Load and unload test pages 10 times
4. Check memory usage again
5. Verify it hasn't significantly increased

**Expected Result**: ✓ No memory leaks detected

---

## Edge Cases

### Test 18: Dynamic Meta Tag Injection

**Objective**: Verify extension detects dynamically added labels

**Steps**:
1. Load `test-pages/clean-page.html`
2. Open browser console (F12)
3. Run: `document.head.innerHTML += '<meta name="rating" content="adult">'`
4. Verify a block overlay appears within 5 seconds

**Expected Result**: ✓ Dynamically added labels are detected

---

### Test 19: Multiple Meta Tags

**Objective**: Verify extension handles multiple labels correctly

**Steps**:
1. Create a test page with multiple labels:
```html
<meta name="rating" content="adult">
<meta http-equiv="PICS-Label" content="sexual">
```
2. Load the page
3. Verify the block overlay shows all reasons

**Expected Result**: ✓ All labels are detected and displayed

---

### Test 20: Iframe Blocking

**Objective**: Verify extension blocks iframes with labels

**Steps**:
1. Create a test page with an iframe:
```html
<iframe src="test-pages/adult-labeled.html"></iframe>
```
2. Load the page
3. Verify the iframe is blocked

**Expected Result**: ✓ Iframes with labels are blocked

---

## Regression Tests

Run these tests after any code changes:

1. ✓ Basic label detection (Test 1)
2. ✓ RTA detection (Test 2)
3. ✓ Clean pages load (Test 3)
4. ✓ Self-Lock activation and General tab lock (Test 7)
5. ✓ Options-page early unlock (Test 9)
6. ✓ Private-window parental filtering (Test 12)
7. ✓ Auto-increment on blocked access (Test 15)

---

## Bug Reporting

If you find issues during testing:

1. **Document the issue**:
   - What test failed?
   - What was expected?
   - What actually happened?

2. **Gather information**:
   - Browser console errors (F12)
   - Extension console (Firefox: `about:debugging` → Inspect; Chrome:
     `chrome://extensions` → service worker)
   - State dump: `browserAPI.runtime.sendMessage({type: 'GET_STATE'})`

3. **Create a minimal reproduction**:
   - Simplest test case that reproduces the issue
   - Steps to reproduce

4. **File a bug report** with this information

---

## Test Results Template

```
Test Date: [DATE]
Browser & Version: [e.g. Firefox 139 / Chrome 138 / Safari 18]
Build tested: build/[firefox|chrome|safari]
Extension Version: 1.5.0

Test Results:
- Test 1 (Basic Label Detection): [PASS/FAIL]
- Test 2 (RTA Detection): [PASS/FAIL]
- Test 3 (Clean Page): [PASS/FAIL]
- ... (continue for all tests)

Issues Found:
- [Issue 1]
- [Issue 2]

Notes:
- [Any additional observations]
```

---

## Continuous Testing

For ongoing development:

1. **Unit Tests**: Consider adding Jest tests for utils.js
2. **Integration Tests**: Automate test page loading
3. **Performance Monitoring**: Track memory and CPU usage
4. **User Testing**: Get feedback from real users

---

Happy testing! 🧪
