# Content Safety Lock v1.5.0 — Multi-browser support

Content Safety Lock now runs on Chrome, Edge, Brave, Opera and Safari in addition
to Firefox, built from a single shared source tree.

## Downloads

| Browser | Asset | How to install |
|---|---|---|
| Firefox | `content-safety-lock-firefox-1.5.0.zip` | Unzip, then `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json` (or install the signed build from AMO) |
| Chrome / Edge / Brave / Opera | `content-safety-lock-chrome-1.5.0.zip` | Unzip, then `chrome://extensions` → Developer mode → Load unpacked → the unzipped folder |
| Safari (macOS) | `content-safety-lock-safari-1.5.0.zip` | Unzip, then `xcrun safari-web-extension-converter <folder>` and run the generated Xcode project |

## Added

- **Multi-browser builds**: Firefox (Manifest V2), Chrome/Chromium (Manifest V3
  service worker) and Safari (Manifest V3) from one `src/` tree plus a
  per-browser manifest in `platform/<browser>/`.
- **Platform abstraction layer** (`src/js/platform/`): the host browser is
  detected at runtime and application code talks to a promise-based `browserAPI`
  instead of `browser.*`/`chrome.*`.
- **Build and packaging system**: `npm run build:all` and `npm run package:all`
  produce `build/<browser>/` and one release archive per browser in `dist/`.
- **Automated releases**: pushing a `v<version>` tag builds, tests and publishes
  all three archives (`.github/workflows/release.yml`).
- `documentation/BUILDING.md` for the build/packaging workflow.

## Changed

- The repository root is no longer a loadable extension; load
  `build/<browser>/` instead.
- The version lives only in `package.json` and is stamped into every manifest at
  build time.

## Fixed

- The popup's active-lock countdown no longer fails with
  `formatDuration is not defined`.

## Known limitations

- **Safe Request Mode's SafeSearch enforcement is Firefox-only.** It depends on
  the blocking `webRequest` API, which Manifest V3 removed and Safari does not
  provide, so the Google/Bing/Yahoo/DuckDuckGo/YouTube settings are hidden on
  Chrome and Safari with a "not supported for <browser> yet" notice; the
  `declarativeNetRequest` port is planned. In-page site filtering (Tumblr,
  Reddit, Bluesky) and label-based blocking work on every browser.
- Safari builds must be converted and signed locally with Xcode; there is no
  prebuilt Safari app yet.
