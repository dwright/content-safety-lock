/**
 * Browser identification and per-browser feature availability.
 *
 * Some capabilities the extension relies on simply do not exist on every
 * browser (Manifest V3 removed blocking `webRequest`, Safari has no managed
 * storage, ...). Rather than sprinkling browser checks through the UI, features
 * are declared once here with the capability they require, so the options page
 * can hide unavailable controls and explain why.
 *
 * Loaded after `browser-api.js`; publishes `globalThis.CSLFeatures`.
 */

(function (global) {
  'use strict';

  const PLATFORM_NAMES = {
    firefox: 'Firefox',
    chrome: 'Chrome',
    safari: 'Safari'
  };

  // Ordered most-specific first: Edge/Opera/Brave all also claim "Chrome".
  const UA_BRANDS = [
    { name: 'Firefox', pattern: /(?:Firefox|FxiOS)\/([\d.]+)/ },
    { name: 'Edge', pattern: /Edg(?:e|A|iOS)?\/([\d.]+)/ },
    { name: 'Opera', pattern: /OPR\/([\d.]+)/ },
    { name: 'Chrome', pattern: /(?:Chrome|CriOS)\/([\d.]+)/ },
    { name: 'Safari', pattern: /Version\/([\d.]+).*Safari/ }
  ];

  // Brands worth reporting, most specific first. Chromium deliberately pads its
  // brand list with a randomly punctuated placeholder ("Not(A:Brand",
  // ";Not A Brand", ...), so brands are matched against this allow list rather
  // than filtered against a placeholder pattern.
  const KNOWN_BRANDS = [
    { brand: 'Brave', name: 'Brave' },
    { brand: 'Microsoft Edge', name: 'Edge' },
    { brand: 'Opera', name: 'Opera' },
    { brand: 'Vivaldi', name: 'Vivaldi' },
    { brand: 'Yandex', name: 'Yandex' },
    { brand: 'Google Chrome', name: 'Chrome' },
    { brand: 'Chromium', name: 'Chromium' }
  ];

  function matchUserAgent(userAgent) {
    for (const { name, pattern } of UA_BRANDS) {
      const match = pattern.exec(userAgent || '');
      if (match) return { name, version: match[1] };
    }
    return null;
  }

  function matchBrands(brands) {
    if (!Array.isArray(brands)) return null;

    for (const known of KNOWN_BRANDS) {
      const entry = brands.find((b) => b.brand === known.brand);
      if (entry) return { name: known.name, version: entry.version };
    }
    return null;
  }

  function detectBrand(userAgent, userAgentData) {
    const fromUserAgent = matchUserAgent(userAgent);
    // Brave and Edge announce themselves here even though their user agent
    // strings claim to be Chrome.
    const fromBrands = matchBrands(userAgentData?.brands);
    // A bare "Chromium" brand says nothing the user agent does not say better:
    // Chrome for Testing, for instance, lists only Chromium and the placeholder.
    if (!fromBrands || (fromBrands.name === 'Chromium' && fromUserAgent)) {
      return fromUserAgent || { name: null, version: null };
    }

    // Brand lists carry only the major version; the user agent has the full one.
    const version = fromUserAgent?.name === fromBrands.name
      ? fromUserAgent.version
      : fromBrands.version;

    return { name: fromBrands.name, version };
  }

  /**
   * Identify the running browser.
   *
   * `platform` is the build target the extension was compiled for; `name` and
   * `version` describe the actual browser, which is more specific (a `chrome`
   * build also runs on Edge, Brave and Opera).
   */
  function detectBrowser(api, navigatorRef) {
    const nav = navigatorRef || global.navigator || {};
    const platform = api?.platform || 'chrome';
    const brand = detectBrand(nav.userAgent, nav.userAgentData);

    return {
      platform,
      name: brand.name || PLATFORM_NAMES[platform] || platform,
      version: brand.version || null,
      manifestVersion: api?.capabilities?.manifestVersion ?? null,
      userAgent: nav.userAgent || null
    };
  }

  /**
   * Features that are not available on every browser. `requires` names the
   * `browserAPI.capabilities` flag that must be truthy.
   */
  const FEATURES = {
    safeRequestNetworkEnforcement: {
      label: 'Safe Request Mode for search and video providers',
      requires: 'blockingWebRequest',
      // Shown in place of the hidden controls, after the generic message.
      detail:
        'Rewriting SafeSearch parameters and adding safety headers needs the ' +
        'blocking webRequest API, which Manifest V3 removed. Label-based ' +
        'blocking and in-page site filtering are unaffected.'
    }
  };

  function createFeatures(api, navigatorRef) {
    const browser = detectBrowser(api, navigatorRef);

    function isSupported(feature) {
      const spec = FEATURES[feature];
      if (!spec) return true;
      return Boolean(api?.capabilities?.[spec.requires]);
    }

    function label(feature) {
      return FEATURES[feature]?.label || feature;
    }

    function unsupportedMessage(feature) {
      return `${label(feature)} not supported for ${browser.name} yet.`;
    }

    function unsupportedDetail(feature) {
      return FEATURES[feature]?.detail || null;
    }

    return {
      browser,
      isSupported,
      unsupportedMessage,
      unsupportedDetail,
      label,
      names: Object.keys(FEATURES)
    };
  }

  global.CSLFeaturesFactory = createFeatures;

  if (global.browserAPI) {
    global.CSLFeatures = createFeatures(global.browserAPI);
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
