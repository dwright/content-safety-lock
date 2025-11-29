# Deployment Guide - Content Safety Lock

## Overview

This guide covers how to install, test, and deploy the Content Safety Lock Firefox extension.

## Quick Start (Development)

### 1. Load in Firefox (Temporary)

For testing and development:

1. Open Firefox
2. Navigate to `about:debugging`
3. Click "This Firefox" in the sidebar
4. Click "Load Temporary Add-on"
5. Select `manifest.json` from the project directory
6. The extension is now loaded (until Firefox restarts)

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
   - Set a passphrase in Security tab
   - Activate self-lock in Self-Lock tab
   - Try to access blocked pages
   - Test early unlock flow

3. **See TESTING.md** for comprehensive test cases

## Production Deployment

### Option 1: Firefox Add-ons Store (Recommended)

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
   # Install web-ext tool
   npm install --global web-ext
   
   # Build the extension
   web-ext build --source-dir=/path/to/extension
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
   - Increment version in `manifest.json`
   - Submit new version through Developer Hub
   - Review process repeats

### Option 2: Self-Hosted Distribution

For distributing outside the official store:

1. **Build the extension**:
   ```bash
   web-ext build --source-dir=/path/to/extension
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

### Option 3: Enterprise Deployment

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

3. **Lock extension settings**:
   - Use policies to prevent uninstall
   - Pre-configure settings
   - Restrict user modifications

## Building for Distribution

### Using web-ext

```bash
# Install web-ext
npm install --global web-ext

# Build the extension
cd /Users/dan/CascadeProjects/windsurf-project
web-ext build

# Output: web-ext-artifacts/content_safety_lock-1.0.0.zip
```

### Manual Build

```bash
# Create zip file with all necessary files
zip -r content-safety-lock.zip \
  manifest.json \
  background.js \
  content.js \
  utils.js \
  options.html \
  options.js \
  popup.html \
  popup.js \
  icons/
```

## Version Management

### Semantic Versioning

Format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (e.g., new required passphrase)
- **MINOR**: New features (e.g., new blocking scope)
- **PATCH**: Bug fixes (e.g., UI improvements)

### Update Checklist

Before releasing a new version:

1. ✓ Update version in `manifest.json`
2. ✓ Update CHANGELOG.md with changes
3. ✓ Run full test suite (TESTING.md)
4. ✓ Test on clean Firefox profile
5. ✓ Test on Windows, macOS, Linux
6. ✓ Review all code changes
7. ✓ Update documentation if needed
8. ✓ Create git tag: `git tag v1.0.0`

## Privacy & Security Checklist

Before deployment:

- ✓ No external API calls (all local processing)
- ✓ No data collection or analytics
- ✓ No tracking or telemetry
- ✓ Passphrases hashed with SHA-256
- ✓ No sensitive data in logs
- ✓ Storage uses `browser.storage.local` (profile-scoped)
- ✓ Privacy policy included
- ✓ Terms of service included

## Monitoring & Support

### Post-Deployment

1. **Monitor user feedback**:
   - Review AMO ratings and comments
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
- Verify all files are present
- Check manifest.json syntax
- Ensure no circular dependencies
- Try rebuilding with web-ext

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
- Check for Firefox updates
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
