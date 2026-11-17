# Content Safety Lock v1.5.1 — Amazon erotica blocking and iOS stepper fix

## Downloads

| Browser | Asset | How to install |
|---|---|---|
| Firefox | `content-safety-lock-firefox-1.5.1.zip` | Unzip, then `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json` (or install the signed build from AMO) |
| Chrome / Edge / Brave / Opera | `content-safety-lock-chrome-1.5.1.zip` | Unzip, then `chrome://extensions` → Developer mode → Load unpacked → the unzipped folder |
| Safari (macOS) | `content-safety-lock-safari-1.5.1.zip` | Unzip, then `xcrun safari-web-extension-converter <folder>` and run the generated Xcode project |

## Changed

- **Amazon erotica blocking**: a product page is now blocked when any of its
  Best Sellers Rank categories (e.g. "Romantic Erotica (Books)") matches a
  blocked category, not only its primary breadcrumb. Erotica category pages
  (`/<Slug>/b?node=`, `/b?node=`, `/zgbs/`, `/gp/bestsellers/`, `/s?rh=n:`) are
  also blocked by browse node ID (Kindle Erotica `157057011`, Books Erotica
  `10141`, Sexual Wellness, Exotic Apparel) or by the category name in the URL
  slug, `<h1>`, or page title.

## Fixed

- The duration picker's up/down steppers now respond to taps on iOS Safari.
