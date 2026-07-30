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
dist/                      # Release archives (gitignored)
build-scripts/build.js     # Build orchestrator
build-scripts/package.js   # Packaging orchestrator (one archive per browser)
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

Packaging (writes `dist/content-safety-lock-<browser>-<version>.zip`):

```bash
npm run package:firefox    # AMO upload / signing input
npm run package:chrome     # Chrome Web Store, Edge Add-ons, Opera
npm run package:safari     # unpacked extension, input for the Safari converter
npm run package:all        # all three

npm run xcode:safari       # macOS only: safari-project/ via
                           # xcrun safari-web-extension-converter
```

Archives are produced with `web-ext build` for every target (it only zips a
directory), so packaging needs no tooling beyond the existing dependency, and
the version in each filename comes from `package.json`.

Releases attach all three archives; see
[DEPLOYMENT.md](DEPLOYMENT.md#github-releases) for the tag-triggered release
workflow.

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
- **Safari**: run `npm run xcode:safari` on macOS, then open the generated
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

- **Safe Request Mode's search/video enforcement is Firefox-only for now.** It
  relies on blocking `webRequest`, which Manifest V3 removed and Safari never
  had. On Chrome and Safari the handler logs a warning and stays inactive;
  porting it to `declarativeNetRequest` (Chrome) and early content-script
  injection (Safari) is Phase 4 of the roadmap. The in-page site filtering
  (Tumblr, Reddit, Bluesky) is content-script based and works on every target.

  Unavailable features are declared in `src/js/platform/features.js` with the
  `browserAPI.capabilities` flag each one needs, and the options page hides
  their controls behind a "<feature> not supported for <browser> yet" notice:

  ```js
  safeRequestNetworkEnforcement: {
    label: 'Safe Request Mode for search and video providers',
    requires: 'blockingWebRequest'
  }
  ```

  Add an entry there (and a `{ feature, group, notice }` row in
  `applyPlatformFeatureGating()`) when a new feature is browser-dependent, so
  users never see settings that cannot take effect. The About tab's debug
  report lists the browser, its version and the features it lacks.
- **Chrome runs the background as a service worker**, which is terminated when
  idle. Self-lock timing already relies on `alarms` plus persisted state, so it
  survives restarts, but any new background state must be persisted.
- **Managed policy** (`storage.managed`) is delivered through enterprise policy
  on Firefox and Chrome; Safari has no equivalent and the adapter resolves to an
  empty object there.
