# Changelog - Content Safety Lock

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-04-24

### Added

#### Amazon blocked-category tile interceptor

- **New MAIN-world interceptor**: `js/interceptors/amazon-interceptor.js` removes
  product tiles whose server-emitted labels place them in blocked browse nodes
  (Sexual Wellness `3777371`, Exotic Apparel `7586174011`). Two server-authoritative
  rules drive the decision:
  - Rule 1: `href` or `data-*` attributes containing `node=<id>` or `ai_<id>`.
  - Rule 3: `data-acp-tracking` JSON with `ref_=ai_<id>`.
- **Two-pass removal**: carousels containing multiple triggers are removed
  wholesale; otherwise the closest individual product tile is removed. A
  `MutationObserver` plus delayed rescans handle SPA navigation and lazy-loaded
  carousels.
- **Known scope limitation**: keyword search result pages (e.g. `/s?k=vibrator`)
  are not filtered at the tile level because Amazon does not emit browse-node
  or tracking labels on those pages. Documented in the interceptor source.

#### Amazon UI reorganisation

- Amazon moved out of Safe Request Mode and into Parental Controls → Adult
  Product Sales → Amazon vendor checkbox. `js/content.js` now gates interceptor
  injection on both the Adult Product Sales category and the Amazon vendor
  toggle being enabled (`js/options.js`, `options.html`).

#### Expanded Amazon Erotic/Erotica category matching

- `js/detectors/mature-content-detectors.js`: the Amazon breadcrumb and
  JSON-LD matcher now blocks any category whose name matches `/\berotic/i` in
  addition to Sexual Wellness and Exotic Apparel. This catches Erotica
  (Books / Kindle Store), Erotic Gift Sets & Sex Kits, and similar
  subcategories. The leading word boundary protects against `xerotic`
  (medical term for dry skin).

#### 2257 signal routed through Sexual category

- `js/utils.js`: the `ICRA:2257` signal (emitted by the pre-existing 2257
  compliance detector, shipped in 1.2.3) now routes through the sexual
  category in `matchesCategoryPolicy` and `getBlockReason`, so 2257-tagged
  links respect the Adult Product Sales toggle.

#### Tumblr mature-content gate blocking

- **Whole-page block**: When Tumblr serves a logged-out blog-level mature-content cover
  (selector `.community-label-cover__wrapper` or `.content-warning-cover[role="alert"]`
  with no `<article>` ancestor), the page is replaced with the standard CSL block
  overlay ("🛡️ Blocked by Content Filter", reason "Mature content (Tumblr)").
  Implemented in `js/content.js` via new `checkTumblrMaturePage()`, invoked from
  `initTumblrInterception()`.
- **Per-article structural block**: The Tumblr DOM scanner in
  `js/interceptors/tumblr-interceptor.js` now also matches
  `article [data-testid="community-label-cover"]` and replaces the enclosing
  `<article>` with the existing hidden-post placeholder. This catches posts that
  render the community-label cover without any of the previously matched text
  labels (e.g. image-only posts).
- **Reference fixture**: `sample-test-files/Tumblr page block.txt` captures the
  HTML of both the page-level and per-article gates for regression testing.

### Changed

- **Build tooling**: `web-ext-config.js` renamed to `web-ext-config.cjs` so
  Node treats it as CommonJS. `package.json` / `package-lock.json` added so
  `web-ext` is managed as a project-local dev dependency (`npx web-ext build`).
- `documentation/ROADMAP.md`: status updates reflecting the new Amazon and
  Tumblr detectors.
- `documentation/SAFE_REQUEST_MODE_IMPLEMENTATION.md`: Tumblr section (3.7)
  rewritten to cover the structural per-article selector and the page-level
  `checkTumblrMaturePage()` path.

### Notes

- Tumblr detection uses only structural selectors (BEM class names, `role`,
  `data-testid`) so the existing text-based matches (`Potentially mature content`,
  `Adult content`, `Explicit`) and JSON sanitisation remain unchanged.
- Tumblr page-level detection is idempotent via
  `document.documentElement.dataset.cslTumblrPageBlocked` and uses a short-lived
  `MutationObserver` (≤5 s) to handle late hydration.

---

## [1.2.3] - 2026-02-27

### Added

#### 2257 Compliance Detection

- **New detector module**: `js/detectors/2257-compliance-detector.js`
  - Detects 18 U.S.C. § 2257 compliance statements in anchor tags to identify adult content sites
  - Rule-based matching with 6 detection patterns:
    - `compliance_statement`: 2257 + compliance + statement
    - `custodian_records`: 2257 + custodian + records
    - `exempt_exemption`: 2257 + exempt/exemption (union)
    - `usc_reference`: 18 + USC/U.S.C. (union) + 2257
    - `record_keeping`: 2257 + record-keeping/record keeping (union)
    - `cfr_reference`: 28 + CFR/C.F.R. (union) + 75
  - Only evaluates same-domain links (link href hostname must match current page hostname) to eliminate cross-domain false positives
  - Page-level whitelist skips scanning entirely on known safe domains: `.gov`, `.edu`, `.law`, `wikipedia.org`, `justia.com`, `aclu.org`, `oyez.org`, `eff.org`, `duckduckgo.com`, `google.com`, `bing.com`, `yahoo.com`, `chanrobles.com`, `laws-info.com`, `law.com`
  - Regex-based skip for US state government domains matching `*.XX.us` pattern (e.g. `courts.state.ny.us`)
  - Skips `file:` protocol pages
  - MutationObserver with 250ms debounce for dynamic content detection (SPAs, infinite scroll)
  - Runs indefinitely — never disconnects the observer
  - Safety gate using `data-2257-checked` attribute to prevent re-checking links
  - Logging via `console.debug()` for verbose browser output
- **Signal integration**: New `ICRA:2257` signal maps to the Sexual/Nudity category
- **Block reason**: "Sexual/Nudity (2257 Compliance)" displayed in block overlay
- **Block overlay "Why:" section**: When a block is triggered by the 2257 detector, the overlay now shows the matching link text and URL below the Reason line to aid in diagnosis

### Changed

- `manifest.json`: Added `js/detectors/2257-compliance-detector.js` to `content_scripts`
- `js/content.js`: `detectLabels()` now returns `{ signals, details }`; 2257 detector result extracted into signal + details; `checkAndBlock()` passes `details` in `CHECK_BLOCK` message
- `js/background.js`: `getBlockPageData()` accepts and passes `details` through into `blockData`
- `js/utils.js`: `matchesCategoryPolicy()` checks `ICRA:2257` under sexual category; `getBlockReason()` returns "Sexual/Nudity (2257 Compliance)" for `ICRA:2257`

---

## [1.2.2] - 2025-12-11

### Fixed
- Early unlock gating now fully enforced: when “Allow early unlock” is unchecked, all early unlock UI and flows are suppressed in options, block overlay, and background state.
- Self-lock disable button respects allowEarlyUnlock flag and refuses manual disable when disallowed.

### Changed
- Version bump to 1.2.2.

---

## [1.2.1] - 2025-11-28

### Added

#### Safe Request Mode - Reddit Enhancements

- **Reddit Safe Mode Integration**:
  - Intercepts network requests to Reddit API/JSON endpoints
  - Filters JSON responses to remove posts flagged as "over_18" (NSFW)
  - DOM-level backup to hide/remove `shreddit-post[nsfw]` and `.thing.over18` elements
  - **Search Results Filtering**: Filters NSFW content across all search tabs:
    - Posts tab
    - Communities tab
    - Comments tab
    - Media tab
    - People tab
  - **Page-Level Blocking**:
    - Blocks entire NSFW user profile pages
    - Blocks entire NSFW subreddit pages
    - Uses `reddit-page-data` element to detect NSFW status
  - Configurable via "Safe Request Mode" settings

#### Documentation

- **Reorganized documentation structure**:
  - Created `documentation/` directory for technical docs
  - Moved 11 technical documents to `documentation/` folder
  - Kept README, QUICKSTART, CHANGELOG, and INDEX in root
- **New Provider Integration Guide**:
  - Created `documentation/ADDING_NEW_PROVIDER.md`
  - Complete step-by-step guide for adding new content providers
  - Includes Reddit implementation as detailed example
  - Covers interceptor scripts, Safe Request configuration, content script integration, and page-level blocking
- **Updated INDEX.md**:
  - Updated all documentation links to reflect new structure
  - Added reference to new provider guide
  - Updated version and last modified date

### Changed

- **Improved logging levels**:
  - `console.info()` for important events (activation, blocking)
  - `console.debug()` for verbose diagnostics (element counts, checks)
  - `console.warn()` for potential issues
  - `console.error()` for actual errors

## [1.2.0] - 2025-11-27

### Added

#### Safe Request Mode
- **Tumblr Safe Mode Integration**:
  - Intercepts network requests to Tumblr API endpoints
  - Filters JSON responses to remove posts labeled as "Potentially mature content", "Adult content", or "Explicit"
  - Filters posts flagged as NSFW or classified as "adult"/"nsfw"
  - Seamless integration with no visual gaps in the feed
  - Configurable via "Safe Request Mode" settings

### Changed
- Updated Safe Request Mode configuration UI to include Tumblr specific controls

## [1.1.0] - 2025-10-24

### Added

#### Core Features
- Voluntary label detection for adult content (RTA, ICRA/SafeSurf, meta tags)
- Parental/Admin mode with:
  - Enable/disable filtering
  - Category toggles (Sexual/Nudity, Violence, Profanity, Drugs/Alcohol, Gambling)
  - Allow-list and block-list management
  - Settings PIN protection
- Self-Lock mode for adults with:
  - Flexible durations (1h, 4h, 24h, 1w, custom)
  - Multiple blocking scopes (sexual only, sexual+violence, all)
  - Passphrase protection
  - Cool-down delays (30m, 1h, 4h, custom)
  - Phrase verification for unlock
  - Monotonic time tracking for clock tamper detection
  - Private window support

#### User Interface
- Settings page with 3 tabs (General, Self-Lock, Security)
- Quick status popup
- Block overlay with clear messaging
- Recovery codes generation and management
- Real-time lock status display

#### Security Features
- SHA-256 passphrase hashing
- Separate passphrases for admin and self-lock modes
- Clock rollback detection and mitigation
- One-time recovery codes
- Phrase verification for early unlock
- Cool-down delays to prevent impulsive disabling

#### Documentation
- Comprehensive README.md
- Quick Start guide (QUICKSTART.md)
- Testing guide (TESTING.md)
- Deployment guide (DEPLOYMENT.md)
- This changelog

#### Testing
- Test pages for label detection
- 20 comprehensive test cases
- Edge case coverage
- Performance testing guidelines

### Technical Details

- **Architecture**: Manifest V3 (MV3)
- **Storage**: browser.storage.local (profile-scoped)
- **Content Detection**: document_start content scripts
- **State Management**: Background service worker
- **Crypto**: Web Crypto API (SHA-256)
- **Time Tracking**: Monotonic time (performance.now()) + wall clock

### Browser Support

- Firefox 109+ (MV3 support)
- Desktop and mobile Firefox
- Private browsing windows

### Known Limitations

- Cannot prevent uninstall by admin users
- Cannot prevent OS-level clock changes (only detects them)
- Cannot survive browser profile deletion
- Settings PIN enforced on save, not on every change (design choice)
- Recovery codes stored in browser storage (not encrypted separately)

### Future Enhancements

Potential features for future versions:

- [ ] Sync self-lock state across devices (opt-in)
- [ ] Custom unlock phrases instead of random
- [ ] Email notifications for lock expiry
- [ ] Detailed activity logs
- [ ] Integration with password managers
- [ ] Custom block page styling
- [ ] Scheduled self-lock windows (e.g., weekday evenings)
- [ ] Two-factor unlock (email/SMS verification)
- [ ] Parental controls for child accounts
- [ ] Statistics and usage tracking

---

## Version History

### Planned Releases

#### [1.1.0] - Planned

**Focus**: Enhanced user experience and customization

- [ ] Custom unlock phrases
- [ ] Scheduled self-lock windows
- [ ] Enhanced block page customization
- [ ] Activity statistics dashboard
- [ ] Improved onboarding flow

#### [1.2.0] - Planned

**Focus**: Advanced security features

- [ ] Two-factor unlock
- [ ] Email notifications
- [ ] Encrypted recovery codes
- [ ] Device fingerprinting
- [ ] Anomaly detection

#### [2.0.0] - Planned

**Focus**: Major feature expansion

- [ ] Cross-device sync (opt-in)
- [ ] Parental controls
- [ ] Advanced reporting
- [ ] API for third-party integrations
- [ ] Accessibility improvements

---

## Release Notes Template

For future releases, use this template:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New feature 1
- New feature 2

### Changed
- Modified behavior 1
- Improved performance 2

### Fixed
- Bug fix 1
- Bug fix 2

### Deprecated
- Deprecated feature 1

### Removed
- Removed feature 1

### Security
- Security fix 1
```

---

## Versioning Policy

### Version Numbering

- **MAJOR** (X.0.0): Breaking changes, major features
- **MINOR** (0.Y.0): New features, backward compatible
- **PATCH** (0.0.Z): Bug fixes, security patches

### Release Cycle

- **Patch releases**: As needed (security/critical bugs)
- **Minor releases**: Quarterly (new features)
- **Major releases**: Annually (major changes)

### Support Policy

- **Current version**: Full support
- **Previous version**: Security patches only
- **Older versions**: No support

---

## Contributing

When contributing, please:

1. Update CHANGELOG.md with your changes
2. Use the format above
3. Add your changes under "Unreleased" section
4. Include issue/PR references
5. Be descriptive but concise

---

## Security

For security issues:

1. **Do not** open a public issue
2. Email security concerns to: [security contact]
3. Include detailed description and reproduction steps
4. Allow 48 hours for initial response

---

## Acknowledgments

- Firefox WebExtensions documentation
- Mozilla Developer Network (MDN)
- Community feedback and contributions

---

Last updated: 2025-10-21
