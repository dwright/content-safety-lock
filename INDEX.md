# Content Safety Lock - Documentation Index

Welcome! This is your guide to all documentation and resources for the Content Safety Lock browser extension (Firefox, Chrome/Edge/Brave/Opera, and Safari).

## 🚀 Quick Navigation

### I Want To...

**Get started quickly**
→ Read [QUICKSTART.md](QUICKSTART.md) (5 minutes)

**Understand what this extension does**
→ Read [README.md](README.md) (15 minutes)

**See the full project overview**
→ Read [documentation/PROJECT_SUMMARY.md](documentation/PROJECT_SUMMARY.md) (10 minutes)

**Add a new content provider (Reddit, Tumblr, etc.)**
→ Follow [documentation/ADDING_NEW_PROVIDER.md](documentation/ADDING_NEW_PROVIDER.md) (30 minutes)

**Test the extension**
→ Follow [documentation/TESTING.md](documentation/TESTING.md) (30 minutes)

**Build the extension for a specific browser**
→ Follow [documentation/BUILDING.md](documentation/BUILDING.md) (5 minutes)

**Deploy to production or cut a release**
→ Follow [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md) (20 minutes)

**Check version history**
→ Read [CHANGELOG.md](CHANGELOG.md)

## 📚 Documentation Files

### Core Documentation

| File | Purpose | Read Time | Audience |
|------|---------|-----------|----------|
| [README.md](README.md) | Complete feature documentation | 15 min | Everyone |
| [documentation/PROJECT_SUMMARY.md](documentation/PROJECT_SUMMARY.md) | Project overview & architecture | 10 min | Developers |
| [QUICKSTART.md](QUICKSTART.md) | Getting started guide | 5 min | New users |

### Technical Documentation

| File | Purpose | Read Time | Audience |
|------|---------|-----------|----------|
| [documentation/TESTING.md](documentation/TESTING.md) | Comprehensive test cases | 30 min | QA/Developers |
| [documentation/BUILDING.md](documentation/BUILDING.md) | Multi-browser build & packaging | 5 min | Developers |
| [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md) | Installation, deployment & releases | 20 min | Developers |
| [documentation/ADDING_NEW_PROVIDER.md](documentation/ADDING_NEW_PROVIDER.md) | Guide to adding new providers | 30 min | Developers |
| [CHANGELOG.md](CHANGELOG.md) | Version history & roadmap | 10 min | Everyone |

## 📁 Project Structure

```
content-safety-lock/
│
├── 📄 Documentation
│   ├── INDEX.md                    ← You are here
│   ├── README.md                   ← Start here
│   ├── QUICKSTART.md               ← Getting started
│   ├── CHANGELOG.md                ← Version history
│   └── documentation/
│       ├── PROJECT_SUMMARY.md      ← Overview
│       ├── TESTING.md              ← Test guide
│       ├── DEPLOYMENT.md           ← Deployment guide
│       ├── ADDING_NEW_PROVIDER.md  ← Provider integration
│       └── [other technical docs]
│
├── 🔧 Shared Source (src/)
│   ├── html/                       ← options.html, popup.html
│   ├── css/                        ← Stylesheets
│   ├── icons/                      ← SVG (Firefox) + PNG (Chrome/Safari)
│   └── js/                         ← JavaScript files
│       ├── background.js           ← Background script / service worker
│       ├── content.js              ← Content script
│       ├── popup.js                ← Popup logic
│       ├── options.js              ← Settings logic
│       ├── utils.js                ← Shared utilities
│       ├── platform/               ← browserAPI abstraction
│       │   ├── browser-api.js      ← Runtime platform detection
│       │   ├── firefox.js
│       │   ├── chrome.js
│       │   └── safari.js
│       ├── components/             ← UI components
│       ├── detectors/              ← Content detection
│       ├── interceptors/           ← Provider interceptors
│       └── safe-request/           ← Safe request mode (Firefox only)
│
├── 🌐 Per-browser Config & Build
│   ├── platform/firefox/manifest.json   ← Manifest V2
│   ├── platform/chrome/manifest.json    ← Manifest V3
│   ├── platform/safari/manifest.json    ← Manifest V3
│   ├── build-scripts/build.js           ← Builds build/<browser>/
│   ├── build-scripts/package.js         ← Builds dist/*.zip archives
│   └── .github/workflows/              ← CI + tag-triggered releases
│
└── 🧪 Test Resources
    └── test-pages/
        ├── adult-labeled.html      ← Test: Adult label
        ├── rta-labeled.html        ← Test: RTA label
        └── clean-page.html         ← Test: No labels
```

## 🎯 Learning Paths

### Path 1: User (5-15 minutes)

1. [QUICKSTART.md](QUICKSTART.md) - Installation & basic usage
2. [README.md](README.md) - Features & configuration
3. Try the test pages in `test-pages/`

### Path 2: Developer (30-60 minutes)

1. [documentation/PROJECT_SUMMARY.md](documentation/PROJECT_SUMMARY.md) - Architecture overview
2. [README.md](README.md) - Full feature documentation
3. Review source code:
   - `platform/<browser>/manifest.json` - Per-browser configuration
   - `src/js/platform/` - Browser API abstraction
   - `src/js/background.js` - Policy engine
   - `src/js/content.js` - Label detection
   - `src/js/utils.js` - Shared utilities
   - `src/js/interceptors/` - Provider interceptors
   - `src/js/safe-request/` - Safe request mode
4. [documentation/TESTING.md](documentation/TESTING.md) - Test cases
5. [documentation/ADDING_NEW_PROVIDER.md](documentation/ADDING_NEW_PROVIDER.md) - Adding providers

### Path 3: QA/Tester (45-90 minutes)

1. [QUICKSTART.md](QUICKSTART.md) - Installation
2. [documentation/TESTING.md](documentation/TESTING.md) - All 20 test cases
3. Use test pages in `test-pages/`
4. Document results

### Path 4: DevOps/Deployment (30-45 minutes)

1. [documentation/PROJECT_SUMMARY.md](documentation/PROJECT_SUMMARY.md) - Overview
2. [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md) - Deployment options
3. [documentation/TESTING.md](documentation/TESTING.md) - Verification tests
4. Deploy to target environment

## 🔑 Key Concepts

### Voluntary Labels
The extension only blocks pages that **self-label** as adult content using:
- **RTA**: Recreational Software Advisory Board
- **ICRA/SafeSurf**: Content rating systems
- **Meta tags**: `<meta name="rating" content="adult">`

### Self-Lock Mode
A voluntary commitment tool that:
- Blocks adult content for a set period
- Requires a passphrase to unlock early
- Has a cool-down delay before unlock
- Uses monotonic time to detect clock manipulation

### Anti-Tamper Features
- Separate passphrases (admin vs self-lock)
- Cool-down delays
- Phrase verification
- Monotonic time tracking

## 📋 Feature Checklist

### ✅ Implemented Features

- [x] Voluntary label detection (RTA, ICRA, meta tags)
- [x] Parental/Admin mode with category toggles
- [x] Allow-list and block-list management
- [x] Settings PIN protection
- [x] Self-Lock mode with flexible durations
- [x] Multiple blocking scopes
- [x] Passphrase protection
- [x] Cool-down delays
- [x] Phrase verification for unlock
- [x] Monotonic time tracking
- [x] Private window support
- [x] Recovery codes
- [x] Beautiful UI with modern design
- [x] Comprehensive documentation
- [x] 20+ test cases
- [x] Multi-browser support (Firefox, Chrome/Edge/Brave/Opera, Safari)
- [x] Automated multi-browser builds and releases

### 🔮 Future Enhancements

- [ ] Safe Request Mode on Chrome (`declarativeNetRequest`) and Safari
- [ ] Mobile support (iOS Safari, Firefox Android)
- [ ] File-based sync across devices (user-controlled cloud storage)
- [ ] Scheduled self-lock windows (with US Holidays support)
- [ ] Accountability partner features
- [ ] Custom block pages with configurable information disclosure
- [ ] Anti-cheat/tamper resistance improvements
- [ ] iOS Screen Time integration

See [documentation/ROADMAP.md](documentation/ROADMAP.md) for comprehensive long-term vision.

## 🆘 Troubleshooting

### Extension won't load?
→ See [QUICKSTART.md](QUICKSTART.md) - Installation section

### Pages not blocking?
→ See [documentation/TESTING.md](documentation/TESTING.md) - Test 1 & 3

### Can't set passphrase?
→ See [documentation/TESTING.md](documentation/TESTING.md) - Test 13

### Deployment issues?
→ See [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md) - Troubleshooting section

## 📞 Support

### For Users
- Read [README.md](README.md) for features
- Read [QUICKSTART.md](QUICKSTART.md) for setup
- Check [documentation/TESTING.md](documentation/TESTING.md) for common issues

### For Developers
- Review [documentation/PROJECT_SUMMARY.md](documentation/PROJECT_SUMMARY.md) for architecture
- Check [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md) for deployment
- See [documentation/ADDING_NEW_PROVIDER.md](documentation/ADDING_NEW_PROVIDER.md) for adding providers
- See code comments in source files

### For Issues
1. Check relevant documentation
2. Review [documentation/TESTING.md](documentation/TESTING.md) for similar issues
3. Check browser console (F12) for errors
4. Review source code comments

## 🎓 Learning Resources

### Understanding Browser Extensions
- [Mozilla WebExtensions Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/)
- [Chrome Manifest V3 Guide](https://developer.chrome.com/docs/extensions/develop/migrate)
- [Safari Web Extensions](https://developer.apple.com/documentation/safariservices/safari_web_extensions)

### Understanding Content Labels
- [RTA Label](https://www.rtalabel.org/)
- [ICRA/SafeSurf](https://en.wikipedia.org/wiki/ICRA_label)

### Web Security
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## ✅ Pre-Deployment Checklist

Before deploying, verify:

- [ ] Read [documentation/PROJECT_SUMMARY.md](documentation/PROJECT_SUMMARY.md)
- [ ] Run `npm test`, `npm run build:all`, `npm run lint:firefox`
- [ ] Run all tests in [documentation/TESTING.md](documentation/TESTING.md)
- [ ] Review [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md)
- [ ] Test on clean Firefox and Chrome profiles
- [ ] Test on Windows, macOS, Linux
- [ ] Review all code changes
- [ ] Update [CHANGELOG.md](CHANGELOG.md)
- [ ] Create privacy policy
- [ ] Create terms of service

## 🚀 Getting Started (30 seconds)

1. **Read**: [QUICKSTART.md](QUICKSTART.md)
2. **Build & install**: `npm install && npm run build:all`, then load
   `build/<browser>/` (see [BUILDING.md](documentation/BUILDING.md))
3. **Test**: Load `test-pages/adult-labeled.html`
4. **Explore**: Click extension icon and open Full Options

## 📝 Notes

- All documentation is in Markdown format
- Code examples are provided where relevant
- Test cases are comprehensive and easy to follow
- Architecture is well-documented in source code

## 🎉 Ready?

**Choose your path:**

- 👤 **I'm a user** → [QUICKSTART.md](QUICKSTART.md)
- 👨‍💻 **I'm a developer** → [documentation/PROJECT_SUMMARY.md](documentation/PROJECT_SUMMARY.md)
- 🧪 **I'm a tester** → [documentation/TESTING.md](documentation/TESTING.md)
- 🚀 **I'm deploying** → [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md)
- 🔧 **I'm adding a provider** → [documentation/ADDING_NEW_PROVIDER.md](documentation/ADDING_NEW_PROVIDER.md)

---

**Last Updated**: 2026-07-29
**Version**: 1.5.0
**Status**: ✅ Complete & Ready

*Happy exploring! 🔒*
