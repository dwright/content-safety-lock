# Testing Guide - Content Safety Lock

## Test Environment Setup

### Prerequisites
- Firefox (latest version)
- This extension loaded in `about:debugging`
- Test pages (included in `test-pages/` directory)

### Loading Test Pages
1. Open Firefox
2. Press `Ctrl+L` (or `Cmd+L` on Mac)
3. Type: `file:///path/to/test-pages/adult-labeled.html`
4. Press Enter

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

### Test 7: Self-Lock Activation

**Objective**: Verify self-lock can be activated

**Steps**:
1. Go to Options → Security tab
2. Set a passphrase (e.g., "test123")
3. Go to Options → Self-Lock tab
4. Select "Sexual/Nudity only" scope
5. Select "1 hour" duration
6. Ensure "Require password for early unlock" is checked
7. Click "Activate Self-Lock"
8. Verify the status shows "Self-Lock Active"

**Expected Result**: ✓ Self-Lock activates and status updates

---

### Test 8: Self-Lock Blocking

**Objective**: Verify self-lock blocks pages

**Steps**:
1. Activate self-lock (see Test 7)
2. Load `test-pages/adult-labeled.html`
3. Verify the block overlay appears
4. Check that it says "Blocked by Self-Lock"
5. Verify the countdown timer is visible

**Expected Result**: ✓ Block overlay shows self-lock status with countdown

---

### Test 9: Early Unlock Flow

**Objective**: Verify early unlock process works

**Prerequisites**:
- Self-lock must be active (see Test 7)
- Cool-down should be set to "None" for this test

**Steps**:
1. Load `test-pages/adult-labeled.html` (should be blocked)
2. Click "Request Early Unlock" button
3. Enter your passphrase (e.g., "test123")
4. Click "Next"
5. Copy the verification phrase shown
6. Paste it into the input field
7. Click "Confirm Unlock"
8. Verify the page reloads and loads normally

**Expected Result**: ✓ Page unlocks and reloads after verification

**Troubleshooting**:
- If unlock fails, verify you entered the correct passphrase
- Ensure you typed the phrase exactly as shown
- Check that cool-down is set to "None" for this test

---

### Test 10: Cool-Down Delay

**Objective**: Verify cool-down prevents immediate unlock

**Prerequisites**:
- Self-lock must be active with cool-down set to "30 minutes"

**Steps**:
1. Load `test-pages/adult-labeled.html` (should be blocked)
2. Click "Request Early Unlock"
3. Enter your passphrase
4. Click "Next"
5. Type the verification phrase
6. Click "Confirm Unlock"
7. Verify it shows "Cool-down active. Try again in..."
8. Wait a few seconds and reload the page
9. Verify the cool-down countdown is still showing

**Expected Result**: ✓ Cool-down prevents immediate unlock

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

### Test 12: Private Window

**Objective**: Verify self-lock works in private windows

**Prerequisites**:
- Self-lock must be active

**Steps**:
1. Open a private window (Ctrl+Shift+P or Cmd+Shift+P)
2. Load `test-pages/adult-labeled.html`
3. Verify the page is blocked with self-lock status
4. Verify the unlock flow works the same way

**Expected Result**: ✓ Self-lock enforced identically in private windows

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

### Test 15: Disable Self-Lock

**Objective**: Verify self-lock can be disabled

**Prerequisites**:
- Self-lock must be active

**Steps**:
1. Go to Options → Self-Lock tab
2. Click "Disable Self-Lock" button
3. Confirm the action
4. Verify status changes to "Self-Lock Inactive"
5. Load `test-pages/adult-labeled.html`
6. Verify the page is NOT blocked (only parental rules apply)

**Expected Result**: ✓ Self-lock can be disabled and parental mode takes over

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
1. Open `about:memory` in Firefox
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
4. ✓ Self-lock activation (Test 7)
5. ✓ Early unlock (Test 9)
6. ✓ Private windows (Test 12)

---

## Bug Reporting

If you find issues during testing:

1. **Document the issue**:
   - What test failed?
   - What was expected?
   - What actually happened?

2. **Gather information**:
   - Browser console errors (F12)
   - Extension console (about:debugging → Inspect)
   - State dump: `browser.runtime.sendMessage({type: 'GET_STATE'})`

3. **Create a minimal reproduction**:
   - Simplest test case that reproduces the issue
   - Steps to reproduce

4. **File a bug report** with this information

---

## Test Results Template

```
Test Date: [DATE]
Firefox Version: [VERSION]
Extension Version: 1.0.0

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
