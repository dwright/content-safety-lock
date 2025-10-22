# Changelog - Content Safety Lock

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-21

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
