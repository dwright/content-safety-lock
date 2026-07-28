const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const PLATFORM_DIR = path.resolve(__dirname, '..', 'src', 'js', 'platform');
const ADAPTER_FILES = ['firefox.js', 'chrome.js', 'safari.js', 'browser-api.js'];

function loadPlatformLayer(globals) {
  const sandbox = { console, ...globals };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ADAPTER_FILES) {
    const absPath = path.join(PLATFORM_DIR, file);
    vm.runInContext(fs.readFileSync(absPath, 'utf8'), sandbox, { filename: absPath });
  }
  return sandbox.browserAPI;
}

function firefoxNamespace() {
  return {
    runtime: {
      getManifest: () => ({ manifest_version: 2 }),
      getURL: (p) => `moz-extension://abc/${p}`,
      sendMessage: async (message) => ({ echo: message }),
      onMessage: { addListener() {} },
      onInstalled: { addListener() {} },
      openOptionsPage: async () => {}
    },
    storage: {
      local: { get: async () => ({}), set: async () => {}, remove: async () => {} },
      managed: { get: async () => ({}) },
      onChanged: { addListener() {} }
    },
    tabs: { create: async () => {}, query: async () => [], sendMessage: async () => {} },
    alarms: { create: async () => {}, clear: async () => {}, onAlarm: { addListener() {} } },
    scripting: { executeScript: async () => [] },
    webRequest: { onBeforeRequest: { addListener() {} }, onBeforeSendHeaders: { addListener() {} } }
  };
}

/** Callback-only Chromium namespace: nothing here returns a promise. */
function chromeNamespace(overrides = {}) {
  const created = [];
  const listeners = [];
  return {
    created,
    listeners,
    namespace: {
      runtime: {
        lastError: null,
        getManifest: () => ({ manifest_version: 3 }),
        getURL: (p) => `chrome-extension://abc/${p}`,
        sendMessage: (message, cb) => cb({ echo: message }),
        onMessage: { addListener: (listener) => listeners.push(listener), removeListener() {} },
        onInstalled: { addListener() {} },
        openOptionsPage: (cb) => cb()
      },
      storage: {
        local: {
          get: (keys, cb) => cb({ keys }),
          set: (items, cb) => cb(),
          remove: (keys, cb) => cb()
        },
        managed: { get: (keys, cb) => cb({}) },
        onChanged: { addListener() {} }
      },
      tabs: {
        create: (props, cb) => { created.push(props); cb(props); },
        query: (info, cb) => cb([]),
        sendMessage: (tabId, message, cb) => cb()
      },
      alarms: {
        create: (name, info) => undefined,
        clear: (name, cb) => cb(true),
        onAlarm: { addListener() {} }
      },
      scripting: { executeScript: (injection, cb) => cb([]) },
      ...overrides
    }
  };
}

async function testFirefoxAdapter() {
  const api = loadPlatformLayer({ browser: firefoxNamespace() });
  assert.strictEqual(api.platform, 'firefox', 'Firefox namespace should select the Firefox adapter');
  assert.strictEqual(api.capabilities.manifestVersion, 2);
  assert.strictEqual(api.capabilities.blockingWebRequest, true, 'Firefox supports blocking webRequest');
  assert.deepStrictEqual(await api.runtime.sendMessage({ type: 'GET_STATE' }), {
    echo: { type: 'GET_STATE' }
  });
}

async function testChromeAdapter() {
  const chrome = chromeNamespace();
  const api = loadPlatformLayer({ chrome: chrome.namespace });

  assert.strictEqual(api.platform, 'chrome', 'chrome-extension:// URLs should select the Chrome adapter');
  assert.strictEqual(
    api.capabilities.blockingWebRequest,
    false,
    'Manifest V3 has no blocking webRequest'
  );

  // Callback-style APIs must be surfaced as promises.
  assert.deepStrictEqual(await api.storage.local.get('state'), { keys: 'state' });
  assert.deepStrictEqual(await api.runtime.sendMessage({ type: 'GET_STATE' }), {
    echo: { type: 'GET_STATE' }
  });
  await api.alarms.create('selfLockTick', { periodInMinutes: 1 });
  await api.tabs.create({ url: 'html/options.html' });
  assert.deepStrictEqual(chrome.created, [{ url: 'html/options.html' }]);

  // An async onMessage listener must be adapted to Chromium's sendResponse contract.
  api.runtime.onMessage.addListener(async (message) => ({ handled: message.type }));
  const [listener] = chrome.listeners;
  const response = await new Promise((resolve) => {
    const keepAlive = listener({ type: 'GET_STATE' }, {}, resolve);
    assert.strictEqual(keepAlive, true, 'listener must return true to keep the channel open');
  });
  assert.deepStrictEqual(response, { handled: 'GET_STATE' });
}

async function testChromeLastError() {
  const chrome = chromeNamespace();
  chrome.namespace.storage.local.get = (keys, cb) => {
    chrome.namespace.runtime.lastError = { message: 'storage unavailable' };
    cb(undefined);
    chrome.namespace.runtime.lastError = null;
  };
  const api = loadPlatformLayer({ chrome: chrome.namespace });
  await assert.rejects(() => api.storage.local.get('state'), /storage unavailable/);
}

async function testSafariAdapter() {
  const namespace = firefoxNamespace();
  namespace.runtime.getManifest = () => ({ manifest_version: 3 });
  namespace.runtime.getURL = (p) => `safari-web-extension://abc/${p}`;
  const api = loadPlatformLayer({ browser: namespace });

  assert.strictEqual(api.platform, 'safari');
  assert.strictEqual(
    api.capabilities.blockingWebRequest,
    false,
    'Safari never exposes blocking webRequest'
  );
  assert.strictEqual(api.webRequest, null);
}

(async function main() {
  await testFirefoxAdapter();
  await testChromeAdapter();
  await testChromeLastError();
  await testSafariAdapter();
  console.log('PASS: platform abstraction selects the right adapter on each browser');
})();
