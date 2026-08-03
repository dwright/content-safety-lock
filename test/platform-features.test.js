const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const FEATURES_FILE = path.resolve(__dirname, '..', 'src', 'js', 'platform', 'features.js');

function loadFeatures(capabilities, platform, navigatorRef) {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FEATURES_FILE, 'utf8'), sandbox, { filename: FEATURES_FILE });
  return sandbox.CSLFeaturesFactory({ platform, capabilities }, navigatorRef);
}

const FIREFOX_UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/141.0.7390.65 Safari/537.36';
const EDGE_UA = CHROME_UA + ' Edg/141.0.3537.57';
const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.6 Safari/605.1.15';

function testBrowserDetection() {
  const firefox = loadFeatures({ manifestVersion: 2, blockingWebRequest: true }, 'firefox', {
    userAgent: FIREFOX_UA
  });
  assert.deepStrictEqual(
    { name: firefox.browser.name, version: firefox.browser.version },
    { name: 'Firefox', version: '128.0' }
  );

  const chrome = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'chrome', {
    userAgent: CHROME_UA
  });
  assert.strictEqual(chrome.browser.name, 'Chrome');
  assert.strictEqual(chrome.browser.version, '141.0.7390.65');

  // Edge must not be reported as Chrome even though its UA claims both.
  const edge = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'chrome', {
    userAgent: EDGE_UA
  });
  assert.strictEqual(edge.browser.name, 'Edge');
  assert.strictEqual(edge.browser.version, '141.0.3537.57');

  const safari = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'safari', {
    userAgent: SAFARI_UA
  });
  assert.strictEqual(safari.browser.name, 'Safari');
  assert.strictEqual(safari.browser.version, '17.6');
}

/**
 * Brands disambiguate Chromium forks, but Chromium's randomly punctuated
 * placeholder brand must never be reported as the browser.
 */
function testUserAgentDataBrands() {
  const brave = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'chrome', {
    userAgent: CHROME_UA,
    userAgentData: {
      brands: [
        { brand: 'Not/A)Brand', version: '99' },
        { brand: 'Chromium', version: '141' },
        { brand: 'Brave', version: '141' }
      ]
    }
  });
  assert.strictEqual(brave.browser.name, 'Brave');
  assert.strictEqual(brave.browser.version, '141');

  // Chrome for Testing lists only Chromium plus the placeholder; the user agent
  // is more informative and carries the full version.
  const chromeForTesting = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'chrome', {
    userAgent: CHROME_UA,
    userAgentData: {
      brands: [
        { brand: 'Chromium', version: '141' },
        { brand: 'Not(A:Brand', version: '99' }
      ]
    }
  });
  assert.strictEqual(chromeForTesting.browser.name, 'Chrome');
  assert.strictEqual(chromeForTesting.browser.version, '141.0.7390.65');

  // Real Chrome brands itself "Google Chrome"; report the short name.
  const chrome = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'chrome', {
    userAgent: CHROME_UA,
    userAgentData: {
      brands: [
        { brand: 'Not_A Brand', version: '99' },
        { brand: 'Google Chrome', version: '141' },
        { brand: 'Chromium', version: '141' }
      ]
    }
  });
  assert.strictEqual(chrome.browser.name, 'Chrome');
  assert.strictEqual(chrome.browser.version, '141.0.7390.65');

  const edge = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'chrome', {
    userAgent: EDGE_UA,
    userAgentData: {
      brands: [
        { brand: 'Chromium', version: '141' },
        { brand: 'Microsoft Edge', version: '141' },
        { brand: 'Not=A?Brand', version: '24' }
      ]
    }
  });
  assert.strictEqual(edge.browser.name, 'Edge');
  assert.strictEqual(edge.browser.version, '141.0.3537.57');

  // With nothing but padding, fall back to the user agent string.
  const padded = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'chrome', {
    userAgent: CHROME_UA,
    userAgentData: { brands: [{ brand: ';Not A Brand', version: '99' }] }
  });
  assert.strictEqual(padded.browser.name, 'Chrome');
  assert.strictEqual(padded.browser.version, '141.0.7390.65');
}

function testFeatureAvailability() {
  const firefox = loadFeatures({ manifestVersion: 2, blockingWebRequest: true }, 'firefox', {
    userAgent: FIREFOX_UA
  });
  assert.strictEqual(firefox.isSupported('safeRequestNetworkEnforcement'), true);

  const chrome = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'chrome', {
    userAgent: CHROME_UA
  });
  assert.strictEqual(chrome.isSupported('safeRequestNetworkEnforcement'), false);
  assert.strictEqual(
    chrome.unsupportedMessage('safeRequestNetworkEnforcement'),
    'Safe Request Mode for search and video providers not supported for Chrome yet.'
  );

  // Unknown features are never hidden.
  assert.strictEqual(chrome.isSupported('somethingElse'), true);
}

/** Detection must survive a missing navigator (worker contexts). */
function testMissingNavigator() {
  const features = loadFeatures({ manifestVersion: 3, blockingWebRequest: false }, 'safari', {});
  assert.strictEqual(features.browser.name, 'Safari');
  assert.strictEqual(features.browser.version, null);
}

testBrowserDetection();
testUserAgentDataBrands();
testFeatureAvailability();
testMissingNavigator();
console.log('PASS: browser detection and per-browser feature availability');
