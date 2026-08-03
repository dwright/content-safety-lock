# Deployment Guide - Content Safety Lock

## Overview

This guide covers how to install, test, and deploy the Content Safety Lock
extension for all supported browsers: Firefox, Chrome/Edge/Brave/Opera, and
Safari (macOS).

The repository root is **not** a loadable extension. Sources live in `src/`,
per-browser manifests in `platform/<browser>/`, and the loadable output is
`build/<browser>/`. See [BUILDING.md](BUILDING.md) for the build architecture.

## Quick Start (Development)

### 1a. Load in Firefox (Temporary)

For testing and development:

1. Build the Firefox target: `npm install && npm run build:firefox`
2. Open Firefox
3. Navigate to `about:debugging`
4. Click "This Firefox" in the sidebar
5. Click "Load Temporary Add-on"
6. Select `build/firefox/manifest.json`
7. The extension is now loaded (until Firefox restarts)

### 1b. Load in Chrome / Edge / Brave / Opera

1. Build the Chrome target: `npm install && npm run build:chrome`
2. Navigate to `chrome://extensions` (`edge://extensions`, `brave://extensions`)
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `build/chrome` directory

### 1c. Load in Safari (macOS only)

1. Build and convert: `npm install && npm run xcode:safari`
2. Open the generated Xcode project in `safari-project/` and run it
3. Enable the extension in Safari → Settings → Extensions (unsigned local builds
   also need Develop → Allow Unsigned Extensions)

### 2. Verify Installation

1. Click the extension icon (🔒) in your toolbar
2. You should see the popup with "Content Safety Lock"
3. Click "Full Options" to access settings

## Testing

### Run Test Suite

1. **Load test pages**:
   - `test-pages/adult-labeled.html` - Should be blocked
   - `test-pages/rta-labeled.html` - Should be blocked
   - `test-pages/clean-page.html` - Should load normally

2. **Test self-lock**:
   - Activate self-lock in the Self-Lock tab
   - Verify the General tab is read-only while the lock is active
   - Test phrase or Mastermind early unlock from the Self-Lock tab
   - Verify parental filtering still blocks labeled pages according to General-tab settings

3. **See TESTING.md** for comprehensive test cases

4. **Run the automated checks**:
   ```bash
   npm test               # Unit tests (safe-request headers, platform layer)
   npm run build:all      # Verifies every manifest reference resolves
   npm run lint:firefox   # web-ext lint against build/firefox
   ```
   The same checks run in CI (`.github/workflows/ci.yml`) on every pull request.

> Safe Request Mode is Firefox-only: it depends on the blocking `webRequest`
> API, which Manifest V3 removed and Safari does not provide. On Chrome and
> Safari it logs a warning and stays inactive.

## Production Deployment

### Option 1: Firefox Add-ons Store (AMO)

#### Prerequisites
- Mozilla Developer Account (free)
- Extension passes automated review
- Privacy policy and terms of service

#### Steps

1. **Create Mozilla Account**:
   - Visit [addons.mozilla.org](https://addons.mozilla.org/)
   - Click "Sign In" → "Create Account"
   - Complete registration

2. **Prepare Extension**:
   ```bash
   npm install

   # Assemble build/firefox and package it into dist/
   npm run package:firefox
   # -> dist/content-safety-lock-firefox-<version>.zip
   ```

3. **Submit to AMO**:
   - Go to [Developer Hub](https://addons.mozilla.org/developers/)
   - Click "Submit a New Add-on"
   - Upload the built `.zip` file
   - Fill in metadata:
     - Name: Content Safety Lock
     - Category: Safety Tools
     - Description: (from manifest.json)
     - Privacy Policy: (required)
     - License: (choose appropriate license)

4. **Review Process**:
   - Automated checks run first
   - Manual review by Mozilla team (1-5 days)
   - You'll receive feedback if issues found
   - Once approved, extension is published

5. **Updates**:
   - Increment version in `package.json`
   - Submit new version through Developer Hub
   - Review process repeats

### Option 2: Chrome Web Store

#### Prerequisites
- Chrome Web Store developer account (one-time registration fee)
- Store listing assets (icon, screenshots, description, privacy disclosures)

#### Steps

1. **Prepare the archive**:
   ```bash
   npm install
   npm run package:chrome
   # -> dist/content-safety-lock-chrome-<version>.zip
   ```

2. **Upload**: [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   → Add new item → upload the archive.

3. **Declare permissions**: the Manifest V3 build requests `storage`, `tabs`,
   `alarms`, `scripting`, and `host_permissions` for all URLs (needed to scan
   page metadata). Explain the content-scanning purpose in the justification
   fields, or review is rejected.

4. **Review**: automated plus manual review; broad host permissions typically
   extend it to several days.

5. **Same archive for Edge/Opera**: submit the identical `-chrome-` archive to
   [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge)
   and the Opera add-ons portal. Brave uses the Chrome Web Store listing.

### Option 3: Safari (App Store / local)

Safari extensions ship inside a signed macOS app, so this step requires macOS
with Xcode:

1. **Convert**:
   ```bash
   npm run xcode:safari
   # -> safari-project/
   ```
2. **Sign and archive** in Xcode (Product → Archive) with an Apple Developer
   account.
3. **Distribute** through App Store Connect, or notarize and distribute the app
   directly.

For local use only, run the project from Xcode and enable the extension in
Safari → Settings → Extensions.

### Option 4: Self-Hosted Distribution

For distributing outside the official store:

1. **Build the extension**:
   ```bash
   npm run package:firefox
   ```

2. **Sign the extension** (optional but recommended):
   - Get API credentials from AMO
   - Use `web-ext sign` command
   - This allows installation on any Firefox profile

3. **Host the .xpi file**:
   - Upload to your server
   - Users download and open with Firefox
   - Firefox will prompt to install

4. **Create installation page**:
   ```html
   <a href="https://yoursite.com/extension.xpi">
     Install Content Safety Lock
   </a>
   ```

Chrome and Edge only install unpacked or store-hosted extensions for regular
users, so self-hosting outside the store is practical for Firefox (signed
`.xpi`) and for Chromium via enterprise policy (below).

### Option 5: Enterprise Deployment

For organizations:

1. **Use Firefox Policies**:
   - Deploy via Group Policy (Windows)
   - Deploy via Configuration Profile (macOS)
   - Deploy via package manager (Linux)

2. **Example Windows GPO**:
   ```json
   {
     "policies": {
       "Extensions": {
         "Install": [
           "https://yourserver.com/extension.xpi"
         ]
       }
     }
   }
   ```

3. **Chromium equivalents**: use `ExtensionInstallForcelist` (Group Policy /
   macOS configuration profile) with a self-hosted update manifest, or the
   Chrome Web Store item ID.

4. **Lock extension settings**:
   - Use policies to prevent uninstall
   - Pre-configure settings via managed storage (see MANAGED_POLICY.md;
     Firefox and Chrome only — Safari has no managed storage equivalent)
   - Restrict user modifications

## Building for Distribution

### All three browsers at once

```bash
npm install
npm run package:all
```

This builds each target and writes one archive per browser into `dist/`, named
from the `package.json` version:

```
dist/content-safety-lock-firefox-1.5.0.zip
dist/content-safety-lock-chrome-1.5.0.zip
dist/content-safety-lock-safari-1.5.0.zip
```

### One browser at a time

```bash
# Firefox (Manifest V2) - upload this archive to AMO
npm run package:firefox

# Chrome / Edge / Brave / Opera (Manifest V3) - upload to the Chrome Web Store,
# Edge Add-ons, or the Opera add-ons portal
npm run package:chrome

# Safari (Manifest V3) - unpacked extension archive, input for the converter
npm run package:safari
```

### Safari: from archive to app (macOS only)

Safari cannot install an extension archive directly; it must be wrapped in a
macOS app and signed with Xcode:

```bash
npm run xcode:safari
# -> safari-project/  (open in Xcode, then Product > Archive to distribute)
```

Requires Xcode command line tools (`xcrun safari-web-extension-converter`), so
it cannot run on Linux or in the Linux release workflow. The published Safari
asset is therefore the unpacked extension, which users or maintainers convert
locally.

### What each archive contains

| Archive | Manifest | Icons | Notes |
|---|---|---|---|
| `-firefox-` | V2, `background.scripts`, blocking `webRequest` | SVG | Safe Request Mode active |
| `-chrome-` | V3, generated service worker entry point | PNG | Safe Request Mode inactive |
| `-safari-` | V3, non-persistent background scripts | PNG | Safe Request Mode inactive; needs Xcode conversion |

See [BUILDING.md](BUILDING.md) for the full multi-browser build documentation.

### Manual Build

```bash
# Zip a build directory produced by `npm run build:<target>`
cd build/chrome && zip -r ../../content-safety-lock-chrome.zip .
```

## Version Management

### Semantic Versioning

Format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (e.g., new required passphrase)
- **MINOR**: New features (e.g., new blocking scope)
- **PATCH**: Bug fixes (e.g., UI improvements)

### Release Process

When releasing a new version (e.g., v1.2.2):

1. **Update version in `package.json`** (the build stamps it into every platform manifest):
   ```json
   {
     "version": "1.2.2",
     ...
   }
   ```

2. **Update CHANGELOG.md**:
   - Add new version section at the top
   - Document all changes (Added, Changed, Fixed, etc.)
   - Follow Keep a Changelog format

3. **Run full test suite**:
   - `npm test && npm run build:all && npm run lint:firefox`
   - See TESTING.md for comprehensive test cases
   - Test on a clean Firefox profile and a clean Chrome profile
   - Test on multiple platforms if possible

4. **Create release notes**:
   - Create `release-notes/RELEASE_NOTES_v1.2.2.md` (tracked in git)
   - Extract relevant sections from CHANGELOG.md
   - Add per-browser installation instructions and upgrade notes
   - If this file is missing, the release workflow falls back to the matching
     `CHANGELOG.md` section

5. **Commit and push changes**:
   ```bash
   git add package.json package-lock.json CHANGELOG.md release-notes/
   git commit -m "chore: Release v1.2.2"
   git push
   ```

6. **Publish the release** (see the two options below)

7. **Submit to the stores** using the archives from the release:
   - Firefox: AMO Developer Hub (`-firefox-` archive)
   - Chrome: Chrome Web Store Developer Dashboard (`-chrome-` archive)
   - Edge: Partner Center (`-chrome-` archive)
   - Safari: App Store Connect, after `npm run xcode:safari` and signing

### GitHub Releases

Every release carries **one archive per browser** (previously Firefox only):

```
content-safety-lock-firefox-<version>.zip   Firefox (MV2)
content-safety-lock-chrome-<version>.zip    Chrome / Edge / Brave / Opera (MV3)
content-safety-lock-safari-<version>.zip    Safari unpacked extension (MV3)
```

Artifacts are never committed to git; they are built at release time.

- **View releases**: https://github.com/dwright/content-safety-lock/releases

#### Option A: Automated (recommended)

Pushing a version tag runs `.github/workflows/release.yml`, which installs
dependencies, runs the tests, lints the Firefox build, packages all three
browsers, and creates the GitHub release with every archive attached:

```bash
git tag v1.2.2
git push origin v1.2.2
```

The workflow fails if the tag does not match `package.json`'s version, so the
archives can never disagree with the release tag. It can also be run manually
from the Actions tab ("Release" → "Run workflow") with an explicit version.

Release notes come from `release-notes/RELEASE_NOTES_v<version>.md`, falling back
to the matching `CHANGELOG.md` section.

#### Option B: Manual, from a workstation

```bash
# Runs the tests, packages all three browsers, then creates the release
./create-github-releases.sh 1.2.2 "Bug Fixes" --latest

# Reuse archives already in dist/ instead of rebuilding
./create-github-releases.sh 1.2.2 "Bug Fixes" --skip-build
```

**Prerequisites**:
- GitHub CLI installed: `brew install gh`
- Authenticated: `gh auth login`
- `package.json` version matches the version argument
- Release notes exist: `release-notes/RELEASE_NOTES_v<version>.md`

### Update Checklist

Before releasing a new version:

1. ✓ Update version in `package.json` (stamped into every manifest at build time)
2. ✓ Update CHANGELOG.md with changes
3. ✓ Run `npm test`, `npm run build:all`, `npm run lint:firefox`
4. ✓ Run full manual test suite (TESTING.md)
5. ✓ Test on clean Firefox and Chrome profiles
6. ✓ Test on Windows, macOS, Linux (if possible)
7. ✓ Review all code changes
8. ✓ Update documentation if needed
9. ✓ Verify `npm run package:all` produces all three archives in `dist/`
10. ✓ Create `release-notes/RELEASE_NOTES_v<version>.md`
11. ✓ Commit and push changes
12. ✓ Push the `v<version>` tag (or run `create-github-releases.sh`)

## Privacy & Security Checklist

Before deployment:

- ✓ No external API calls (all local processing)
- ✓ No data collection or analytics
- ✓ No tracking or telemetry
- ✓ Passphrases hashed with SHA-256
- ✓ No sensitive data in logs
- ✓ Storage uses the profile-scoped local storage of each browser (via `browserAPI.storage`)
- ✓ Privacy policy included
- ✓ Terms of service included

## Monitoring & Support

### Post-Deployment

1. **Monitor user feedback**:
   - Review ratings and comments on every store the extension is listed in
     (AMO, Chrome Web Store, Edge Add-ons, App Store) — each has its own queue
   - Respond to user questions
   - Track bug reports

2. **Performance monitoring**:
   - Monitor extension memory usage
   - Track CPU impact
   - Collect performance metrics

3. **Security monitoring**:
   - Watch for security vulnerabilities
   - Monitor Firefox security updates
   - Update extension as needed

### Support Channels

- **GitHub Issues**: For bug reports and feature requests
- **AMO Comments**: Direct user feedback
- **Email Support**: For security issues
- **Documentation**: README.md and QUICKSTART.md

## Rollback Plan

If critical issues are discovered:

1. **Immediate actions**:
   - Disable extension on AMO (if needed)
   - Post warning in comments
   - Prepare hotfix

2. **Hotfix process**:
   - Fix the issue
   - Increment patch version
   - Test thoroughly
   - Submit new version
   - Notify users

3. **Communication**:
   - Post update on AMO
   - Email users (if possible)
   - Document issue and fix

## Troubleshooting Deployment

### Extension won't load in Firefox

**Issue**: "This add-on could not be installed because it appears to be corrupt"

**Solutions**:
- Load `build/firefox/manifest.json`, not the repository root
- Rebuild with `npm run build:firefox` (the build fails on missing files)
- Check `platform/firefox/manifest.json` syntax

### Extension won't load in Chrome

**Issue**: "Service worker registration failed" or "Manifest is not valid JSON"

**Solutions**:
- Load the `build/chrome` directory, not `src/` or the repository root
- Rebuild with `npm run build:chrome` to regenerate
  `js/background-service-worker.js`
- Inspect the service worker from `chrome://extensions` → "service worker" to see
  its console
- Chrome 111+ is required (`minimum_chrome_version` in the Chrome manifest)

### Safari conversion fails

**Issue**: `xcrun: error: unable to find utility "safari-web-extension-converter"`

**Solutions**:
- Install Xcode (not just the command line tools) and run
  `sudo xcode-select -s /Applications/Xcode.app`
- Conversion is macOS-only; it cannot run on Linux or in CI

### AMO review rejection

**Common reasons**:
- Missing privacy policy
- Unclear description
- Potential security issues
- Violates AMO policies

**Resolution**:
- Read rejection reason carefully
- Address all issues
- Resubmit with explanation

### Users can't install

**Issue**: "This add-on is not compatible with your version of Firefox"

**Solutions**:
- Check minimum Firefox version requirement
- Update manifest.json if needed
- Test on target Firefox versions

## Maintenance Schedule

### Weekly
- Monitor user feedback
- Check for Firefox, Chromium and Safari updates
- Review error logs

### Monthly
- Security audit
- Performance review
- Update dependencies (if any)

### Quarterly
- Major feature planning
- User survey
- Competitive analysis

## Documentation

### For Users
- **README.md**: Full feature documentation
- **QUICKSTART.md**: Getting started guide
- **TESTING.md**: How to test features

### For Developers
- **DEPLOYMENT.md**: This file
- **Code comments**: Inline documentation
- **Architecture**: Described in README.md

## License & Legal

### Before Deployment

1. **Choose a license**:
   - MIT: Permissive, widely used
   - GPL: Copyleft, requires source sharing
   - Apache 2.0: Patent protection included

2. **Create privacy policy**:
   - Explain data collection (none in this case)
   - Explain storage usage
   - Explain user rights

3. **Create terms of service**:
   - Disclaimer of liability
   - Acceptable use policy
   - Support limitations

## Success Metrics

Track these metrics post-deployment:

- **Installation rate**: Downloads per week
- **Retention rate**: Active users over time
- **Rating**: Average user rating on AMO
- **Engagement**: Settings changes per user
- **Support load**: Support requests per week
- **Performance**: Crash rate, memory usage

## Next Steps

1. **Immediate**:
   - Test on clean Firefox profile
   - Run full test suite
   - Prepare for submission

2. **Short-term**:
   - Submit to AMO
   - Gather user feedback
   - Monitor performance

3. **Long-term**:
   - Plan feature updates
   - Build user community
   - Maintain security

---

For questions or issues, refer to README.md or TESTING.md.

Happy deploying! 🚀
