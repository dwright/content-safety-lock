# Content Safety Lock v1.5.3 — Chrome permission cleanup for Web Store review

## Downloads

| Browser | Asset | How to install |
|---|---|---|
| Firefox | `content-safety-lock-firefox-1.5.3.zip` | Unzip, then `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json` (or install the signed build from AMO) |
| Chrome / Edge / Brave / Opera | `content-safety-lock-chrome-1.5.3.zip` | Unzip, then `chrome://extensions` → Developer mode → Load unpacked → the unzipped folder |
| Safari (macOS) | `content-safety-lock-safari-1.5.3.zip` | Unzip, then `xcrun safari-web-extension-converter <folder>` and run the generated Xcode project |

## Changed

- **Chrome**: removed the unused `tabs` permission from the Chrome MV3
  manifest to satisfy Chrome Web Store review. The extension only calls
  `tabs.create`, which requires no permission. No functional change.
