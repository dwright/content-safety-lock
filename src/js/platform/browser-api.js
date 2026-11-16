/**
 * Cross-browser API abstraction layer.
 *
 * Detects the host browser at runtime and exposes a single promise-based
 * `browserAPI` global that behaves identically on Firefox, Chromium-based
 * browsers and Safari. Platform adapters register themselves on
 * `globalThis.CSLPlatformAdapters` before this file runs.
 */

(function (global) {
  'use strict';

  const adapters = global.CSLPlatformAdapters || {};

  function detectPlatform() {
    const runtime = global.browser?.runtime || global.chrome?.runtime;
    const url = runtime?.getURL ? runtime.getURL('') : '';

    if (url.startsWith('safari-web-extension://')) return 'safari';
    if (url.startsWith('moz-extension://')) return 'firefox';
    if (url.startsWith('chrome-extension://')) return 'chrome';

    // Fall back to feature detection when the URL scheme is unavailable.
    if (typeof global.browser !== 'undefined' && global.browser?.runtime) return 'firefox';
    return 'chrome';
  }

  const platform = detectPlatform();
  const createAdapter = adapters[platform] || adapters.chrome;

  if (typeof createAdapter !== 'function') {
    throw new Error(`[CSL] No platform adapter available for "${platform}"`);
  }

  const api = createAdapter();
  api.platform = platform;

  global.browserAPI = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
