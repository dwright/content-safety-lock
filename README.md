# Content Safety Lock - Firefox Extension

A voluntary adult content blocker with self-lock mode for adults seeking structured guardrails against adult content.

## Features

### Core Functionality
- **Voluntary Label Detection**: Blocks pages that self-label as adult content using:
  - RTA (Recreational Software Advisory Board) labels
  - ICRA/SafeSurf ratings
  - Meta tags (rating=adult, mature, restricted)

- **Parental/Admin Mode**:
  - Enable/disable filtering
  - Category toggles (Sexual/Nudity, Violence, Profanity, Drugs/Alcohol, Gambling)
  - Allow-list and block-list management
  - Settings PIN protection
  
### Safe Request Mode (New)
- **Server-Side Filtering**: Requests safer content directly from providers
- **Supported Providers**:
  - **Google**: Enforces SafeSearch
  - **Bing**: Enforces Strict Mode (optional redirect to strict.bing.com)
  - **Yahoo**: Enforces Strict Mode
  - **DuckDuckGo**: Enforces Strict Mode
  - **YouTube**: Enforces Restricted Mode (Strict or Moderate)
  - **Tumblr**: Filters posts labeled as mature/explicit/adult

### Self-Lock Mode (New)
- **Voluntary Commitment**: Adults can activate self-lock to block adult content for a set period
- **Flexible Duration**: 1 hour, 4 hours, 24 hours, 1 week, or custom duration
- **Blocking Scopes**:
  - Sexual/Nudity only
  - Sexual/Nudity + Violence
  - All adult labels
- **Anti-Tamper Features**:
  - Separate passphrase from admin PIN
  - Cool-down delays before early unlock (30m, 1h, 4h, custom)
  - Monotonic time tracking to detect clock rollback
  - Phrase verification for unlock confirmation
- **Private Window Support**: Self-Lock enforced identically in private browsing

## Installation

### For Development/Testing

1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from this directory

### For Production

Package the extension using:
```bash
web-ext build
```

Then submit to [addons.mozilla.org](https://addons.mozilla.org/)

## Usage

### Initial Setup

1. Click the extension icon to open the popup
2. Click "Full Options" to access settings
3. Configure your preferences in the "General" tab
4. (Optional) Set a Settings PIN to protect general settings

### Activating Self-Lock

1. Go to the "Self-Lock" tab in options
2. Choose your blocking scope (Sexual/Nudity, Sexual+Violence, or All)
3. Select a duration or enter a custom duration
4. Configure cool-down and password requirements
5. Click "Activate Self-Lock"

**Important**: Before activating self-lock with password requirement, set a passphrase in the "Security" tab.

### During Self-Lock

- Blocked pages show a clear overlay explaining the block
- If early unlock is available, you can request it by:
  1. Entering your self-lock passphrase
  2. Typing the verification phrase
  3. Waiting for the cool-down period
  4. Confirming the unlock

### Recovery

Generate recovery codes in the "Security" tab to unlock if you forget your passphrase. Each code can be used once.

## Architecture

### Files

- **manifest.json**: Extension configuration and permissions
- **background.js**: Service worker handling policy engine and state management
- **content.js**: Content script for label detection and blocking
- **utils.js**: Shared utilities (crypto, time, parsing)
- **options.html/js**: Settings interface
- **popup.html/js**: Quick status popup
- **README.md**: This file

### Data Flow

1. **Content Script** detects labels in page head
2. **Message to Background**: Sends detected signals
3. **Policy Engine**: Evaluates against self-lock and parental rules
4. **Decision**: Block or allow
5. **Overlay**: If blocked, inject block page overlay

### State Storage

All state is stored in `browser.storage.local`:
- Parental settings (categories, lists, PIN)
- Self-Lock state (active, duration, timestamps, passphrase)
- Recovery codes

## Security Considerations

### What This Extension Can Do
- Block rendering of labeled pages
- Detect clock rollback using monotonic time
- Require passphrases for settings and early unlock
- Generate recovery codes

### What This Extension Cannot Do
- Prevent uninstall or disable by admin user
- Prevent OS-level clock changes (only detects them)
- Survive browser profile deletion
- Prevent access if user has admin privileges

### Best Practices for Stronger Commitment

1. **Use a separate OS user account** without admin privileges for browsing
2. **Enable Firefox policies** (enterprise) to pin the extension
3. **Store recovery codes safely** (not in browser)
4. **Use a strong passphrase** (12+ characters, mixed case, numbers, symbols)
5. **Keep your profile locked** when not in use

## Configuration

### Self-Lock Defaults
- Scope: Sexual/Nudity only
- Ignore allow-list: Yes
- Require password: Yes
- Cool-down: 1 hour

### Parental Mode Defaults
- Enabled: Yes
- Sexual/Nudity: Blocked
- Violence: Not blocked
- Profanity: Not blocked
- Drugs/Alcohol: Not blocked
- Gambling: Not blocked
- Treat mature as adult: Yes

## Troubleshooting

### Self-Lock not activating
- Ensure you've set a passphrase in the Security tab (if password required)
- Check that you have sufficient permissions

### Pages not blocking
- Verify the page has voluntary labels (check page source for meta tags)
- Check that filtering is enabled in General settings
- Ensure the page domain is not in your allow-list

### Can't unlock early
- Verify cool-down period has passed
- Check that you're entering the correct passphrase
- Ensure you're typing the verification phrase correctly

### Clock tamper detection
- If system clock is rolled back, lock duration is extended by the monotonic delta
- This prevents bypassing self-lock via clock manipulation

## Development

### Testing Label Detection

Add meta tags to test pages:
```html
<meta name="rating" content="adult">
<meta name="rating" content="RTA-5042-1996-1400-1577-RTA">
<meta http-equiv="PICS-Label" content="...">
```

### Debugging

1. Open `about:debugging`
2. Find "Content Safety Lock" in the extensions list
3. Click "Inspect" to open the background worker console
4. Check browser console on test pages for content script logs

## Privacy

- **No data collection**: This extension stores all data locally in your Firefox profile
- **No external requests**: All processing happens locally
- **No tracking**: No analytics or telemetry

## License

This extension is provided as-is for voluntary content safety purposes.

## Support

For issues, feature requests, or security concerns, please file an issue in the repository.

## Disclaimer

This extension is a voluntary tool designed to help adults maintain structured guardrails. It is not a substitute for:
- Parental controls for children
- Professional mental health support
- Responsible device management

Users are responsible for their own choices and should use this tool as part of a broader safety strategy.
