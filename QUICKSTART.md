# Quick Start Guide - Content Safety Lock

## Installation (Development)

1. **Open Firefox** and navigate to `about:debugging`
2. **Click** "This Firefox" in the left sidebar
3. **Click** "Load Temporary Add-on"
4. **Select** the `manifest.json` file from this directory
5. **Done!** The extension is now loaded

## First Time Setup

1. **Click** the extension icon (🔒) in your toolbar
2. **Click** "Full Options" to open settings
3. **Configure** your preferences:
   - General: Enable/disable filtering, choose categories
   - Self-Lock: Set up your voluntary lock
   - Security: Set passphrase and generate recovery codes

## Quick Test

### Test Page with Adult Label

Create a test HTML file with this content:

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="rating" content="adult">
  <title>Test Page</title>
</head>
<body>
  <h1>This page should be blocked</h1>
</body>
</html>
```

Open this file in Firefox. You should see a block overlay.

### Test Page Without Label

Create another test file without the meta tag. This should load normally.

## Using Self-Lock

### Step 1: Set a Passphrase
1. Go to Options → Security tab
2. Enter a passphrase (6+ characters)
3. Click "Set Passphrase"

### Step 2: Activate Self-Lock
1. Go to Options → Self-Lock tab
2. Choose a blocking scope (e.g., "Sexual/Nudity only")
3. Select a duration (e.g., "4 hours")
4. (Optional) Enable **Allow early unlock** if you want early unlock to be available
5. Click "Activate Self-Lock"

### Step 3: Test It
1. Visit a page with an adult label
2. You should see the block overlay
3. Try to request early unlock (only if **Allow early unlock** was enabled)

### Step 4: Request Early Unlock
1. On the blocked page, click "Request Early Unlock" (only visible if **Allow early unlock** was enabled)
2. Enter your passphrase (when required)
3. Type the verification phrase shown
4. Wait for cool-down to complete
5. Click "Confirm Unlock"

## Troubleshooting

### Extension not loading?
- Check that `manifest.json` exists in the directory
- Try reloading the extension in `about:debugging`
- Check browser console for errors (F12)

### Pages not blocking?
- Verify the page has a meta tag: `<meta name="rating" content="adult">`
- Check that filtering is enabled in General settings
- Check that the domain is not in your allow-list

### Can't set passphrase?
- Ensure passphrase is at least 6 characters
- Check browser console for errors
- Try refreshing the options page

### Self-Lock not activating?
- If password required, ensure passphrase is set first
- Check that you selected a duration
- Try clicking "Activate Self-Lock" again

## File Structure

```
windsurf-project/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (policy engine)
├── content.js             # Content script (label detection)
├── utils.js               # Shared utilities
├── options.html           # Settings page
├── options.js             # Settings script
├── popup.html             # Quick popup
├── popup.js               # Popup script
├── icons/                 # Extension icons
│   ├── icon-16.svg
│   ├── icon-48.svg
│   └── icon-128.svg
├── README.md              # Full documentation
└── QUICKSTART.md          # This file
```

## Key Concepts

### Voluntary Labels
The extension only blocks pages that **self-label** as adult content using:
- **RTA**: Recreational Software Advisory Board labels
- **ICRA/SafeSurf**: Content rating systems
- **Meta tags**: `<meta name="rating" content="adult">`

### Self-Lock
A voluntary commitment tool that:
- Blocks adult content for a set period
- Requires a passphrase to unlock early
- Has a cool-down delay before unlock becomes available
- Uses monotonic time to detect clock manipulation

### Anti-Tamper
Features to prevent bypassing the lock:
- Separate passphrases (admin vs self-lock)
- Cool-down delays
- Phrase verification
- Monotonic time tracking

## Next Steps

1. **Test thoroughly** with different pages
2. **Set a strong passphrase** (12+ characters recommended)
3. **Generate recovery codes** and store safely
4. **Read the full README.md** for advanced features
5. **Consider using a separate OS account** for stronger commitment

## Support

- Check the **README.md** for detailed documentation
- Review **browser console** (F12) for error messages
- Test with the sample HTML files provided above

## Important Notes

⚠️ **This extension:**
- Cannot prevent uninstall by admin users
- Cannot prevent OS-level clock changes
- Cannot survive browser profile deletion
- Is only effective if you choose to use it

✓ **For stronger commitment:**
- Use a separate OS user account
- Enable Firefox policies (enterprise)
- Store recovery codes safely
- Use a strong passphrase

---

**Happy testing!** 🔒
