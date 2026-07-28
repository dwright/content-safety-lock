# Building Content Safety Lock

The extension is built from a single shared source tree into one loadable
directory per browser.

## Layout

```
src/                       # Shared source (never loaded directly by a browser)
├── js/
│   └── platform/          # Browser API abstraction + per-browser adapters
├── html/                  # options.html, popup.html
├── css/
└── icons/                 # SVG (Firefox) and PNG (Chrome/Safari)
platform/
├── firefox/manifest.json  # Manifest V2
├── chrome/manifest.json   # Manifest V3 (service worker)
└── safari/manifest.json   # Manifest V3 (non-persistent background scripts)
build/                     # Build output (gitignored)
build-scripts/build.js     # Build orchestrator
```

## Commands

```bash
npm install

npm run build:firefox      # -> build/firefox
npm run build:chrome       # -> build/chrome
npm run build:safari       # -> build/safari
npm run build:all

npm test                   # Unit tests (safe-request headers, platform layer)
npm run lint:firefox       # web-ext lint against the Firefox build
```

Packaging:

```bash
npm run package:firefox    # web-ext build -> web-ext-artifacts/*.zip
npm run package:chrome     # build/chrome.zip for the Chrome Web Store
npm run package:safari     # Xcode project via safari-web-extension-converter (macOS only)
```

## What the build does

1. Removes `build/<target>` and copies `src/`, keeping only the icon format the
   target supports (SVG for Firefox, PNG for Chrome and Safari).
2. Copies `platform/<target>/manifest.json` and stamps it with the `version`
   from `package.json`, so the version is bumped in exactly one place.
3. For Manifest V3 service worker targets, generates
   `js/background-service-worker.js`, which `importScripts()` the background
   scripts in the order declared by the Firefox manifest (the single source of
   truth for that list — a service worker can only name one entry point).
4. Verifies that every path referenced by the manifest exists in the output,
   so a rename fails the build rather than the browser.

## Loading a build

- **Firefox**: `about:debugging` → This Firefox → Load Temporary Add-on →
  select `build/firefox/manifest.json`.
- **Chrome / Edge / Brave**: `chrome://extensions` → enable Developer mode →
  Load unpacked → select `build/chrome`.
- **Safari**: run `npm run package:safari` on macOS, then open the generated
  Xcode project in `safari-project/` and run it. Enable the extension in
  Safari → Settings → Extensions (Develop → Allow Unsigned Extensions is
  required for unsigned local builds).

## Platform abstraction

Application code never touches `browser.*` or `chrome.*` directly; it uses the
`browserAPI` global built by `src/js/platform/browser-api.js`. All three
adapters ship in every build and the correct one is chosen at runtime from the
extension URL scheme, so the same files work regardless of target.

The adapters normalize three real differences:

| | Firefox | Chrome | Safari |
|---|---|---|---|
| Namespace | promise-based `browser.*` | callback/promise `chrome.*` | promise-based `browser.*` |
| Async `onMessage` handler | returns a promise | wrapped into `sendResponse` + `return true` | returns a promise |
| `capabilities.blockingWebRequest` | `true` | `false` (Manifest V3) | `false` |

## Known platform limitations

- **Safe Request Mode is Firefox-only for now.** It relies on blocking
  `webRequest`, which Manifest V3 removed and Safari never had. On Chrome and
  Safari the handler logs a warning and stays inactive; porting it to
  `declarativeNetRequest` (Chrome) and early content-script injection (Safari)
  is Phase 4 of the roadmap.
- **Chrome runs the background as a service worker**, which is terminated when
  idle. Self-lock timing already relies on `alarms` plus persisted state, so it
  survives restarts, but any new background state must be persisted.
- **Managed policy** (`storage.managed`) is delivered through enterprise policy
  on Firefox and Chrome; Safari has no equivalent and the adapter resolves to an
  empty object there.
