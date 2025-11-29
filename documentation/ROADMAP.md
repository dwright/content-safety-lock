# Content Safety Lock - Long-Term Roadmap

**Last Updated**: November 29, 2024  
**Author**: Dan Wright (dwright@dwright.org)

This document outlines the long-term vision and development roadmap for Content Safety Lock, a voluntary adult content blocker with self-lock mode.

---

## Vision Statement

Content Safety Lock aims to be a cross-platform, privacy-respecting tool that helps adults maintain structured guardrails against adult content. The extension will support multiple browsers and mobile devices, with user-controlled cloud sync and ethical monetization through donations and enterprise licensing.

### Core Principles

1. **Privacy First**: No data collection, no tracking, no external requests for personal use
2. **User Control**: Users own their data and choose their sync provider
3. **Cross-Platform**: Single codebase supporting Firefox, Chrome, and Safari (desktop + mobile)
4. **Open Source**: MIT licensed, available on GitHub
5. **Ethical Monetization**: Free for personal use, donations appreciated, enterprise licensing available

---

## Long-Term Goals

### 1. Multi-Device Sync Without Hosting User Data

**Goal**: Allow users to sync settings across devices using their own cloud storage provider.

**Supported Providers** (via mounted file systems):
- Google Drive (user mounts via Google Drive desktop app)
- Dropbox (user mounts via Dropbox desktop app)
- iCloud Drive (automatically mounted on macOS/iOS)
- OneDrive (user mounts via OneDrive desktop app)
- Any network drive or local path
- Syncthing, Resilio Sync, or other sync solutions

**Architecture**:
- User specifies a file path where config should be saved
- Extension uses File System Access API (Chrome/Edge) or native file picker
- Write config as JSON file to user-specified location
- Cloud provider's desktop app handles actual sync (transparent to extension)
- No OAuth needed - completely provider-agnostic
- No API integration required

**How It Works**:
1. User installs their preferred cloud provider's desktop app (Google Drive, Dropbox, etc.)
2. Cloud provider mounts a local directory (e.g., `~/Google Drive/`, `~/Dropbox/`)
3. In extension settings, user clicks "Choose Sync Location"
4. File picker opens, user navigates to their cloud folder
5. User selects or creates `content-safety-lock-config.json`
6. Extension saves/loads config from this file path
7. Cloud provider automatically syncs file across devices

**Security Approach**:
- Store only hashed secrets in config file (using Argon2id or similar)
- Never store plaintext passwords or passphrases
- Application only validates input against hash, never needs plaintext
- Config file permissions controlled by OS/cloud provider

**Implementation Files**:
```
js/sync/
  sync-manager.js              # Orchestrates file read/write operations
  file-sync-handler.js         # Handles file system access
  conflict-resolver.js         # Detects and resolves conflicts
```

**Browser API Requirements**:
- **Chrome/Edge**: File System Access API (well supported)
- **Firefox**: File picker via `<input type="file">` + manual save (limited but functional)
- **Safari**: File picker via native APIs

**UI Changes**:
- Add "Sync" section to options page (or dedicated tab)
- "Choose Sync Location" button to select config file path
- Display current sync file path
- Sync status indicator (last saved, last loaded)
- "Save Now" and "Load Now" buttons for manual control
- Option to disable sync (use local storage only)

**Automatic Sync Behavior**:
- **Auto-save**: Settings automatically saved to sync file on change (debounced 2-5 seconds)
- **Auto-load**: Periodic monitoring (every 10-30 seconds) checks if remote config has changed
- **Transparent updates**: When remote config is newer, automatically load new settings
- **No user intervention**: Settings propagate across all devices seamlessly
- **Conflict handling**: Last-write-wins (simpler, matches user expectation)
- **Status indicator**: Subtle UI indicator shows "Synced" / "Saving..." / "Loading..." status

**User Story Example**:
1. User has Content Safety Lock running on laptop, desktop, and phone
2. On laptop: User adjusts settings and activates self-lock
3. Settings auto-save to `~/Google Drive/content-safety-lock-config.json`
4. Google Drive syncs file to cloud (happens in background)
5. Desktop and phone's Google Drive apps download updated file
6. Desktop and phone extensions detect file change (within 10-30 seconds)
7. Desktop and phone automatically load new settings
8. **Result**: Self-lock is now active on all devices with identical settings

**Edge Cases**:
- **Simultaneous edits**: Last write wins (rare, acceptable trade-off for simplicity)
- **Sync disabled**: If user disables sync, use local storage only (no monitoring)
- **File unavailable**: If sync file becomes unavailable (drive unmounted), continue using last known config
- **Corrupted file**: If JSON parse fails, keep current settings and log error

---

### 2. Multi-Browser Support

**Goal**: Support Firefox, Chrome/Edge/Brave, and Safari with a single codebase.

**Target Browsers**:
- ✅ **Firefox** (current, primary development platform)
- 🎯 **Chrome/Edge/Brave/Opera** (Chromium-based)
- 🎯 **Safari** (macOS, iOS, iPadOS)

**Build Strategy**:

#### Repository Structure
```
content-safety-lock/
├── src/                          # Shared source code
│   ├── js/
│   │   ├── background.js
│   │   ├── content.js
│   │   ├── options.js
│   │   ├── popup.js
│   │   ├── utils.js
│   │   └── platform/             # Platform-specific code
│   │       ├── browser-api.js    # Abstraction layer
│   │       ├── firefox.js
│   │       ├── chrome.js
│   │       └── safari.js
│   ├── html/
│   │   ├── options.html
│   │   ├── popup.html
│   ├── css/
│   └── icons/
├── platform/                     # Platform-specific configs
│   ├── firefox/
│   │   └── manifest.json
│   ├── chrome/
│   │   └── manifest.json
│   └── safari/
│       ├── manifest.json
│       └── Info.plist
├── build/                        # Build output (gitignored)
│   ├── firefox/
│   ├── chrome/
│   └── safari/
├── build-scripts/
│   ├── build.js                  # Main build orchestrator
│   ├── build-firefox.js
│   ├── build-chrome.js
│   └── build-safari.js
├── safari-project/               # Xcode project (gitignored)
└── package.json                  # Build tooling
```

#### Browser API Abstraction

Create a unified API that works across all browsers:

```javascript
// src/js/platform/browser-api.js
// Auto-detects platform and provides consistent interface
export const browserAPI = {
  storage: { get, set, remove, onChanged },
  tabs: { query, sendMessage, create },
  runtime: { sendMessage, onMessage },
  alarms: { create, clear, onAlarm },
  // ... other APIs
};
```

Each platform implements the interface:
- `firefox.js`: Uses native `browser.*` API
- `chrome.js`: Uses `chrome.*` API with Promise wrappers
- `safari.js`: Uses Safari-specific APIs with polyfills

#### Platform-Specific Challenges

**Chrome/Chromium**:
- ✅ Manifest V3 compatible (already using)
- ⚠️ `webRequestBlocking` deprecated → Refactor to `declarativeNetRequest`
- ✅ Most APIs compatible with Firefox

**Safari**:
- ⚠️ No `webRequest` blocking API → Content script-based approach only
- ⚠️ Requires Xcode project wrapper (Swift boilerplate)
- ⚠️ Different manifest format
- ✅ Supports Manifest V3 (with differences)
- ✅ Personal use: No Apple Developer account needed ($99/year only for App Store)

#### Build System

**Package.json scripts**:
```json
{
  "scripts": {
    "build:firefox": "node build-scripts/build.js firefox",
    "build:chrome": "node build-scripts/build.js chrome",
    "build:safari": "node build-scripts/build.js safari",
    "build:all": "node build-scripts/build.js firefox chrome safari",
    "watch:firefox": "nodemon --watch src --exec 'npm run build:firefox'",
    "package:firefox": "cd build/firefox && web-ext build",
    "package:chrome": "cd build/chrome && zip -r ../chrome.zip ."
  }
}
```

**Build Process**:
1. Clean target build directory
2. Copy shared source files from `src/`
3. Copy platform-specific manifest from `platform/{browser}/`
4. Apply platform-specific transformations
5. For Safari: Generate Xcode project using `safari-web-extension-converter`

---

### 3. Mobile Device Support

**Goal**: Support Safari on iOS and iPadOS (high priority), Firefox on Android (medium priority).

**Target Platforms**:
- 🎯 **Safari on iOS/iPadOS** (high priority - personal use)
- 🎯 **Firefox for Android** (medium priority - likely works with minimal changes)
- ❌ **Chrome on Android** (not supported by Chrome)

#### Safari Mobile (iOS/iPadOS)

**Personal Use Setup** (No App Store, No $99 fee):
1. Create Xcode project with Safari Extension target
2. Build unsigned for personal devices
3. Enable Developer mode on iOS/iPadOS
4. Install via Xcode or TestFlight (personal)
5. Enable in Settings → Safari → Extensions

**App Store Distribution** (Future, requires $99/year):
- Apple Developer account required
- App Store review process
- Notarization and signing
- Only pursue if there's user demand

**Mobile UI Considerations**:
- Responsive design for small screens
- Touch-friendly controls (already implemented in time-interval-picker: 40px targets)
- Simplified navigation (consider accordion vs. tabs)
- Test on iPad first (larger screen), then iPhone
- Optimize block overlay for mobile viewports

#### Firefox for Android

**Status**: Should work with minimal changes (Firefox Android supports WebExtensions since v79)

**Testing Plan**:
1. Load current extension on Firefox Android
2. Test core functionality (label detection, blocking)
3. Fix UI issues (responsive design)
4. Test options page on mobile
5. Verify Safe Request Mode works

**Limitations**:
- Smaller user base (fewer people browse AMO on mobile)
- Some APIs may be unavailable (check MDN compatibility)
- Performance considerations (battery drain from content scripts)

---

### 4. Safe Request Mode Refactoring

**Challenge**: Current implementation uses `webRequestBlocking`, which is:
- ✅ Fully supported in Firefox
- ⚠️ Deprecated in Chrome Manifest V3
- ❌ Not available in Safari

**Solution**: Platform-specific implementations

#### Firefox (Keep Current Approach)
- Continue using `webRequest` with blocking
- Most powerful and reliable implementation
- No changes needed

#### Chrome (Refactor to declarativeNetRequest)
- Use `declarativeNetRequest` API for URL rewrites
- Supports parameter injection (SafeSearch, etc.)
- Less flexible but functional
- Cannot intercept/modify response bodies (Tumblr filtering may need content script approach)

**Example**:
```javascript
// declarativeNetRequest rule for SafeSearch
{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "redirect",
    "redirect": {
      "transform": {
        "queryTransform": {
          "addOrReplaceParams": [
            { "key": "safe", "value": "active" }
          ]
        }
      }
    }
  },
  "condition": {
    "urlFilter": "*://www.google.com/search*",
    "resourceTypes": ["main_frame"]
  }
}
```

#### Safari (Content Script Approach)
- Inject content scripts at `document_start`
- Intercept `fetch()` and `XMLHttpRequest` before page code runs
- Use `MutationObserver` for DOM-based filtering
- Less reliable but functional

**Example**:
```javascript
// Inject early to override fetch
const originalFetch = window.fetch;
window.fetch = function(...args) {
  let [url, options] = args;
  
  // Modify URL to add SafeSearch
  if (url.includes('google.com/search')) {
    const urlObj = new URL(url);
    urlObj.searchParams.set('safe', 'active');
    url = urlObj.toString();
  }
  
  return originalFetch(url, options);
};
```

**Implementation Plan**:
1. Create platform-specific Safe Request handlers
2. Firefox: Keep current `safe-request-handler.js`
3. Chrome: New `safe-request-handler-chrome.js` using declarativeNetRequest
4. Safari: New `safe-request-handler-safari.js` using content script injection
5. Platform abstraction layer selects appropriate handler

---

### 5. Monetization Strategy

**Goal**: Sustainable development funding without compromising ethics or privacy.

#### Personal Use: Donations Appreciated

**Approach**: 100% free, all features available, donations optional

**Implementation**:
- Add "Support Development" section in options page
- Link to Buy Me a Coffee: `https://buymeacoffee.com/dwright`
- Subtle link in popup footer
- GitHub Sponsors as alternative
- Add `.github/FUNDING.yml` to repository

**UI Copy**:
```
☕ Support Development

This extension is free and open source. If you find it helpful, 
consider buying me a coffee!

[Buy Me a Coffee Button]

100% optional. All features remain free.
```

**Ethical Guidelines**:
- No feature gating
- No manipulation or dark patterns
- No nagging or interruptions
- No tracking of who donates
- Mention once in options, subtle link in popup

#### Enterprise/Educational: Licensing + Support

**Target Customers**:
- Religious organizations
- Recovery centers and counseling practices
- Treatment facilities
- Libraries
- Educational institutions (for staff, not students)

**Offering**:
- Bulk deployment assistance
- Custom configuration templates
- Priority support (email/phone)
- Training materials and documentation
- On-site or virtual training sessions
- License: $500-1000/year per institution (not per-user)

**No Technical Restrictions**:
- Don't build license validation into code
- Honor system for enterprise use
- Focus on support and service value
- Open source remains fully functional

**Landing Page**: `https://dwright.org/content-safety-lock/enterprise`

**Why This Works**:
- Personal users get everything free
- Enterprises pay for support/service, not software
- Aligns with open source values
- Sustainable without compromising mission
- No monthly billing complexity

---

## Development Phases

### Phase 1: Multi-Browser Foundation (2-3 months)

**Goals**:
- Reorganize codebase for multi-platform support
- Create build system
- Support Firefox, Chrome, and Safari desktop

**Tasks**:
1. ✅ Create `src/` directory structure
2. ✅ Implement platform abstraction layer (`browser-api.js`)
3. ✅ Create platform-specific adapters (firefox.js, chrome.js, safari.js)
4. ✅ Move current code to `src/`
5. ✅ Create platform-specific manifests
6. ✅ Build Node.js build scripts
7. ✅ Test on Firefox (verify no regression)
8. ✅ Test on Chrome desktop
9. ✅ Test on Safari desktop
10. ✅ Fix browser-specific issues
11. ✅ Update documentation

**Deliverables**:
- Working builds for Firefox, Chrome, Safari
- Build system with npm scripts
- Platform abstraction layer
- Updated README with build instructions

---

### Phase 2: File-Based Sync Implementation (2-4 weeks)

**Goals**:
- Enable user-controlled file-based sync
- Support any cloud provider via mounted file systems
- Automatic, transparent sync across devices

**Tasks**:
1. ✅ Design file-based sync architecture and data model
2. ✅ Implement file system access for each browser:
   - Chrome/Edge: File System Access API with persistent handle
   - Firefox: File picker + download/upload pattern
   - Safari: Native file picker APIs
3. ✅ Create `sync-manager.js` for orchestration
4. ✅ Create `file-sync-handler.js` for file I/O operations
5. ✅ Implement periodic monitoring (10-30 second polling)
6. ✅ Implement auto-save on settings change (debounced)
7. ✅ Implement auto-load when remote file changes
8. ✅ Add "Sync" section to options page
9. ✅ Implement sync UI:
   - "Choose Sync Location" file picker button
   - Display current sync file path
   - Sync status indicator (Synced/Saving/Loading)
   - "Disable Sync" option
10. ✅ Test sync across multiple devices
11. ✅ Test with different cloud providers (Google Drive, Dropbox, iCloud)
12. ✅ Test edge cases (file unavailable, corrupted, simultaneous edits)
13. ✅ Document sync setup for users

**Deliverables**:
- Working file-based sync (provider-agnostic)
- Automatic monitoring and loading
- Sync UI in options page
- User documentation with setup instructions for popular cloud providers

**Security Considerations**:
- Only sync hashed secrets (never plaintext)
- Config file permissions controlled by OS
- No credentials or tokens needed (no OAuth)
- File path stored in local storage only

---

### Phase 3: Safari Mobile Support (1 month)

**Goals**:
- Support Safari on iOS and iPadOS
- Optimize UI for mobile devices

**Tasks**:
1. ✅ Create Xcode project using `safari-web-extension-converter`
2. ✅ Configure for personal use (no App Store)
3. ✅ Build and install on iPad
4. ✅ Test core functionality on iPad
5. ✅ Optimize options page for tablet
6. ✅ Test on iPhone
7. ✅ Optimize UI for phone screen
8. ✅ Test block overlay on mobile
9. ✅ Test unlock flows on touch screen
10. ✅ Document personal installation process
11. ✅ Create troubleshooting guide for mobile

**Deliverables**:
- Working Safari extension on iOS/iPadOS
- Mobile-optimized UI
- Personal installation documentation
- Xcode project in repository

**Testing Devices**:
- iPad (landscape and portrait)
- iPhone (various sizes)
- Test in Safari private browsing

---

### Phase 4: Safe Request Mode Refactor (1-2 months)

**Goals**:
- Refactor Safe Request Mode for Chrome and Safari
- Maintain Firefox's powerful implementation

**Tasks**:
1. ✅ Audit current Safe Request Mode implementation
2. ✅ Design platform-specific architecture
3. ✅ Keep Firefox implementation as-is
4. ✅ Implement Chrome version using `declarativeNetRequest`
5. ✅ Implement Safari version using content script injection
6. ✅ Create platform selector in build system
7. ✅ Test Google SafeSearch on all platforms
8. ✅ Test Bing Strict Mode on all platforms
9. ✅ Test YouTube Restricted Mode on all platforms
10. ✅ Test Tumblr filtering (may need content script on Chrome/Safari)
11. ✅ Document platform differences
12. ✅ Update user documentation

**Deliverables**:
- Platform-specific Safe Request Mode implementations
- All providers working on all platforms (or documented limitations)
- Updated documentation

**Known Limitations**:
- Chrome: Response body modification not possible (affects Tumblr filtering)
- Safari: Less reliable than Firefox, requires early injection
- Document these limitations clearly for users

---

### Phase 5: Polish & Monetization (1 month)

**Goals**:
- Add donation links
- Create enterprise offering
- Comprehensive documentation
- Automated testing

**Tasks**:
1. ✅ Add Buy Me a Coffee integration to options page
2. ✅ Add subtle support link to popup
3. ✅ Set up GitHub Sponsors (optional)
4. ✅ Create `.github/FUNDING.yml`
5. ✅ Create enterprise landing page
6. ✅ Write enterprise documentation
7. ✅ Create deployment guides for institutions
8. ✅ Write comprehensive user documentation
9. ✅ Add automated tests (unit tests for crypto, time, policy engine)
10. ✅ Set up CI/CD for builds
11. ✅ Publish to Firefox AMO
12. ✅ Publish to Chrome Web Store
13. ✅ Create release notes and changelog

**Deliverables**:
- Donation integration
- Enterprise landing page and materials
- Comprehensive documentation
- Automated test suite
- Published extensions on AMO and Chrome Web Store

---

### Phase 6: Firefox for Android (Optional, 2-4 weeks)

**Goals**:
- Support Firefox for Android
- Validate mobile viability on Android

**Tasks**:
1. ✅ Load current build on Firefox Android
2. ✅ Test core functionality
3. ✅ Identify UI issues
4. ✅ Fix responsive design problems
5. ✅ Test options page on mobile
6. ✅ Test popup on mobile
7. ✅ Verify Safe Request Mode works
8. ✅ Document Android-specific issues
9. ✅ Update user documentation

**Deliverables**:
- Working extension on Firefox Android
- Mobile UI fixes
- Android documentation

**Priority**: Lower priority than Safari mobile (personal need)

---

## Technical Debt to Address

Before or during the phases above, address these technical debt items:

### 1. Automated Testing
**Current State**: No automated tests  
**Goal**: Unit tests for critical functionality

**Test Coverage**:
- Crypto functions (hashing, validation)
- Time calculations (monotonic time, duration parsing)
- Policy engine (block/allow decisions)
- Label detection (RTA, ICRA, meta tags)
- Sync conflict resolution

**Tools**: Jest or Mocha for unit tests

---

### 2. Code Organization
**Current State**: Some files in root, some in `js/`  
**Goal**: Consistent structure in `src/`

**Reorganization**:
```
src/
├── js/
│   ├── background.js
│   ├── content.js
│   ├── options.js
│   ├── popup.js
│   ├── utils.js
│   ├── detectors/
│   │   └── mature-content-detectors.js
│   ├── interceptors/
│   │   ├── reddit-interceptor.js
│   │   └── tumblr-interceptor.js
│   ├── safe-request/
│   │   ├── safe-request-config.js
│   │   ├── safe-request-handler.js
│   │   └── safe-request-utils.js
│   ├── sync/
│   │   ├── sync-manager.js
│   │   └── providers/
│   ├── platform/
│   │   ├── browser-api.js
│   │   ├── firefox.js
│   │   ├── chrome.js
│   │   └── safari.js
│   └── ui/
│       ├── time-interval-picker.js
│       └── time-interval-picker.css
├── html/
│   ├── options.html
│   └── popup.html
├── css/
└── icons/
```

---

### 3. Localization (i18n)
**Current State**: English only  
**Goal**: Support multiple languages

**Implementation**:
- Use `browser.i18n` API
- Create `_locales/` directory structure
- Extract all user-facing strings to `messages.json`
- Support at least: English, Spanish, French, German

**Priority**: Medium (after core features)

---

### 4. Build System Improvements
**Current State**: Manual `web-ext build`  
**Goal**: Automated builds with CI/CD

**Improvements**:
- GitHub Actions for automated builds
- Automatic version bumping
- Changelog generation
- Release artifact creation
- Automated testing before build

---

### 5. Documentation
**Current State**: Good but scattered  
**Goal**: Comprehensive, organized documentation

**Documentation Structure**:
```
documentation/
├── USER_GUIDE.md              # End-user documentation
├── INSTALLATION.md            # Installation instructions
├── SYNC_SETUP.md              # Cloud sync setup
├── MOBILE_SETUP.md            # Mobile installation
├── ENTERPRISE.md              # Enterprise deployment
├── DEVELOPER_GUIDE.md         # Contributing guide
├── ARCHITECTURE.md            # Technical architecture
├── API_REFERENCE.md           # Internal API docs
├── BUILDING.md                # Build instructions
├── TESTING.md                 # Testing guide
└── ROADMAP.md                 # This file
```

---

## Success Metrics

### User Adoption
- Firefox AMO: 1,000+ users in first year
- Chrome Web Store: 500+ users in first year
- Safari: Personal use + 10+ GitHub stars

### Sustainability
- 5-10 regular donors via Buy Me a Coffee
- 2-3 enterprise customers in first year
- Active GitHub community (issues, PRs, discussions)

### Quality
- 4.5+ star rating on AMO and Chrome Web Store
- <5% bug report rate
- 80%+ test coverage for critical code

### Platform Coverage
- ✅ Firefox desktop
- ✅ Chrome/Edge desktop
- ✅ Safari desktop
- ✅ Safari iOS/iPadOS
- ✅ Firefox Android (optional)

---

## Open Questions

### 1. File Sync Conflict Resolution
**Question**: How to handle conflicts when settings are edited on multiple devices simultaneously?

**Options**:
- A) Last-write-wins (simple, predictable)
- B) Per-setting timestamps (granular, more complex)
- C) Merge UI (complex, interrupts workflow)

**Decision**: 
- **Short-term**: Last-write-wins (option A)
- **Long-term**: Per-setting timestamps if user demand exists (option B)
- **Never**: Merge UI - frequent conflicts indicate a design flaw, not a feature opportunity

**Rationale**: In practice, simultaneous edits should be rare. Most users configure settings once, then activate self-lock. If conflicts become common, it suggests the sync timing or UX needs improvement, not conflict resolution UI.

---

### 2. Safari Safe Request Mode Reliability
**Question**: Can content script injection be reliable enough for Safe Request Mode on Safari?

**Status**: Open question requiring research and deliberation during Safari implementation phase.

**Risk**: Page scripts may run before our content script  
**Mitigation**: Test extensively, document limitations  
**Fallback**: Disable Safe Request Mode on Safari if unreliable

**Decision**: Defer until Phase 3 (Safari Mobile Support) when we can test and evaluate reliability

---

### 3. Enterprise Licensing Approach
**Question**: Should we add any technical validation for enterprise licenses?

**Decision**: Honor system only. No technical validation.

**Rationale**: 
- Technical validation makes no sense in an open-source project (code is visible, can be forked)
- Adds complexity without real benefit
- Violates privacy principles (no phone-home, no tracking)
- Enterprise licensing will only be developed if there's actual demand
- Wait for organizations to reach out with sufficient interest before building licensing infrastructure

**Implementation**: If enterprise interest materializes, create simple landing page with contact form. Handle licensing as a service/support contract, not a technical restriction.

---

### 4. Mobile UI Approach
**Question**: Should mobile use the same options page or a simplified version?

**Options**:
- A) Same page, responsive CSS (code reuse)
- B) Separate mobile-optimized page (better UX)

**Decision**: Start with A, create B if user feedback indicates need

---

## Future Considerations (Beyond Initial Roadmap)

### Advanced Features (Priority: Low, but interesting)

**Scheduled Self-Lock**:
- Activate automatically at certain times/days
- Different schedules for different days of week
- Special schedule for US Holidays (differentiation from competitors)
- Example: Stricter settings during work hours, relaxed on weekends
- Priority: Low, but worthy of roadmap

**Accountability Partner** (High Interest):
- Alert trusted person when settings are unlocked/changed
- Advanced: Allow partner to remotely modify settings
- Advanced: Allow partner to remotely lock another user's browser
- **Consent & Control**:
  - Requires explicit consent with clear communication of what's shared
  - User can revoke consent at any time and regain full control
  - **Caveat**: Accountability partner is notified when consent is revoked
  - This notification is essential - prevents silent bypass of accountability
- **Implementation Options**:
  - Human partner: Use sync file + notification system, or direct messaging
  - **AI/Automation partner** (Future exploration):
    - Not a person, but an automated system or AI
    - Could integrate with existing accountability apps/services
    - Examples: Covenant Eyes API, accountability platforms, wellness apps
    - Very low priority, but interesting for future consideration
- Priority: Medium-High interest, requires careful design

**Custom Block Page** (Good idea, low priority):
- User-customizable block message
- Configurable information disclosure levels:
  - Minimal: Generic "Content blocked" message only
  - Basic: Show domain that was blocked
  - Detailed: Show which label/category triggered block
  - Full: Show exact meta tags/code that triggered block
- Useful for different contexts (personal vs. shared computer)
- Priority: Low

**Usage Statistics**:
- Track blocked attempts (local only, privacy-preserving)
- Help users understand their browsing patterns
- Priority: Low

**Import/Export Settings**:
- Backup and restore configuration
- Share configurations between users
- Priority: Medium (useful for multi-device setup)

### Additional Platforms

**Desktop Browsers**:
- **Priority**: Firefox, Chrome, Safari only
- **Zero Priority** (not planned):
  - Brave Browser (should work with Chrome build if user wants to try)
  - Vivaldi (may work, but not testing)
  - Opera (should work with Chrome build if user wants to try)
  - Edge (should work with Chrome build)
- **Note**: Focus remains on the three core browsers. Other Chromium-based browsers may work but are not supported.

**Mobile Browsers** (Requires Investigation):
- **Chrome on Android**: Currently doesn't support extensions (except Kiwi Browser)
- **Firefox on Android**: Already on roadmap (Phase 6)
- **Google Chrome iOS**: Investigate extension support capabilities
- **Firefox iOS**: Investigate extension support capabilities
- **Note**: Mobile browser extension support is limited. Research needed to determine what's possible on each platform.

### Integration Possibilities

**Browser Profiles**:
- Recommend separate profiles for stronger commitment
- Document best practices for profile isolation

**OS-Level Controls**:
- Documentation for parental controls, screen time
- **iOS Screen Time Integration** (Research needed):
  - Apps like "Brick" hook directly into iOS Screen Time
  - Create custom Screen Time profile to control access
  - Makes app difficult to remove without Screen Time passcode
  - **Research during Phase 3** (Safari Mobile Support):
    - Investigate Screen Time APIs for Safari extensions
    - Determine if extension can create/manage Screen Time profiles
    - Explore making extension difficult to remove via Screen Time
    - Document findings and implementation approach
  - **Potential benefit**: Significantly stronger tamper resistance on iOS

**Third-Party Tools**:
- Integration with accountability software
- Potential API integrations (future consideration)

### Community Features

**Template Library**:
- Pre-configured settings for common use cases
- Example: "Work hours", "Family computer", "Recovery mode"
- Priority: Low-Medium

**~~Community Block Lists~~** (Rejected):
- Not aligned with project philosophy
- This extension relies on voluntary publisher metadata (RTA labels, meta tags)
- Block lists are already covered by other plugins and DNS solutions
- Would compromise the "voluntary" nature of the approach

**Plugin System**:
- Allow community extensions (careful with security)
- Priority: Very Low (security concerns)

### Anti-Cheat / Tamper Resistance (Important for committed users)

**Goal**: Make it difficult (but not impossible) for users to disable or bypass the extension.

**Firefox Enterprise Policies**:
- Firefox allows sysadmins to install extensions to system directories
- Extensions in system directories cannot be disabled by users
- Research: Can this be automated for end users?
- Documentation: Provide clear instructions for manual setup

**Chrome/Safari Equivalent**:
- Research Chrome's enterprise policies for extension pinning
- Research Safari's extension management capabilities
- Document platform-specific approaches

**Block Access to Extension Management**:
- Some extensions (e.g., LeechBlock) block access to:
  - `about:addons` (Firefox)
  - `about:debugging` (Firefox)
  - `chrome://extensions` (Chrome)
  - `about:config` (Firefox)
- Consider implementing similar blocking
- Trade-off: May frustrate legitimate use cases

**Reality Check**:
- A determined user with root/admin access can always bypass browser extensions
- Goal: Make it difficult enough that casual bypass attempts fail
- Goal: Support non-admin user accounts that cannot disable extensions

**Implementation Priority**: Medium-High (important for self-lock effectiveness)

**Tasks**:
1. Research Firefox enterprise policies and system directory installation
2. Research Chrome/Safari equivalents
3. Implement blocking of extension management pages (optional, configurable)
4. Create comprehensive documentation for manual setup
5. Investigate automation possibilities (installer script?)
6. Test on non-admin user accounts

---

### Multi-User System Administration (Very Low Priority)

**Goal**: Allow system administrator to manage/lock settings for other users.

**Use Cases**:
- Family computer with parent as admin
- Shared workstation in institutional setting
- Accountability partner with admin access

**Approach**:
- Admin could configure settings in system-wide location
- Non-admin users inherit settings and cannot modify
- Requires OS-level permissions and file system access

**Challenges**:
- Complex to implement across different OSes
- Browser security models may prevent this
- May conflict with browser's multi-profile architecture

**Priority**: Very Low (explore in future if demand exists)

**Alternative**: Document how to use OS-level parental controls + browser profiles instead

---

## Contributing

This is an open source project. Contributions are welcome!

**How to Contribute**:
1. Check GitHub Issues for open tasks
2. Comment on issue to claim it
3. Fork repository and create feature branch
4. Follow code style guidelines (see DEVELOPER_GUIDE.md)
5. Add tests for new functionality
6. Submit pull request

**Priority Areas for Contributors**:
- Additional Safe Request Mode providers
- Localization (translations)
- Mobile UI improvements
- Documentation improvements
- Bug fixes

---

## License

MIT License - See LICENSE file for details

---

## Contact

**Author**: Dan Wright  
**Email**: dwright@dwright.org  
**GitHub**: @dwright  
**Issues**: Use GitHub Issues for bug reports and feature requests

---

## Changelog

### 2024-11-29
- Initial roadmap created
- Defined long-term vision and goals
- Outlined 6 development phases
- Documented technical architecture decisions
- Established monetization strategy
