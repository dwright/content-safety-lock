/**
 * Chromium platform adapter (Chrome, Edge, Brave, Opera).
 *
 * Chromium exposes the `chrome.*` namespace. Most Manifest V3 APIs already
 * return promises when the callback is omitted, but older builds only support
 * callbacks, so every call goes through `promisify`. Message listeners are
 * wrapped because Chromium ignores a promise returned from an `onMessage`
 * listener and requires the `sendResponse` + `return true` pattern instead.
 */

(function (global) {
  'use strict';

  const adapters = global.CSLPlatformAdapters || (global.CSLPlatformAdapters = {});

  function promisify(fn, thisArg, args) {
    return new Promise((resolve, reject) => {
      const callback = (value) => {
        const error = global.chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(value);
      };
      // Chromium APIs accept a callback and, since Manifest V3, also return a
      // promise. Whichever settles first wins; later settles are ignored.
      const result = fn.apply(thisArg, [...args, callback]);
      if (result && typeof result.then === 'function') {
        result.then(resolve, reject);
      }
    });
  }

  function wrapAsyncMessageListener(listener) {
    return (message, sender, sendResponse) => {
      Promise.resolve(listener(message, sender))
        .then(sendResponse)
        .catch((err) => {
          console.error('[CSL] Message handler failed:', err);
          sendResponse(undefined);
        });
      return true;
    };
  }

  adapters.chrome = function createChromeAdapter() {
    const api = global.chrome;
    const manifestVersion = api.runtime.getManifest().manifest_version;

    return {
      capabilities: {
        manifestVersion,
        // webRequestBlocking is unavailable to Manifest V3 extensions.
        blockingWebRequest: manifestVersion < 3 && Boolean(api.webRequest),
        declarativeNetRequest: Boolean(api.declarativeNetRequest)
      },

      storage: {
        local: {
          get: (keys) => promisify(api.storage.local.get, api.storage.local, [keys]),
          set: (items) => promisify(api.storage.local.set, api.storage.local, [items]),
          remove: (keys) => promisify(api.storage.local.remove, api.storage.local, [keys])
        },
        managed: {
          get: (keys) => promisify(api.storage.managed.get, api.storage.managed, [keys])
        },
        onChanged: api.storage.onChanged
      },

      runtime: {
        sendMessage: (message) => promisify(api.runtime.sendMessage, api.runtime, [message]),
        onMessage: {
          addListener: (listener) => api.runtime.onMessage.addListener(wrapAsyncMessageListener(listener)),
          removeListener: (listener) => api.runtime.onMessage.removeListener(listener)
        },
        onInstalled: api.runtime.onInstalled,
        getURL: (path) => api.runtime.getURL(path),
        getManifest: () => api.runtime.getManifest(),
        openOptionsPage: () => promisify(api.runtime.openOptionsPage, api.runtime, [])
      },

      tabs: {
        create: (props) => promisify(api.tabs.create, api.tabs, [props]),
        query: (info) => promisify(api.tabs.query, api.tabs, [info]),
        sendMessage: (tabId, message) => promisify(api.tabs.sendMessage, api.tabs, [tabId, message])
      },

      alarms: {
        // alarms.create only gained promise support in Chrome 111 and never
        // accepted a callback, so it is normalized rather than promisified.
        create: (name, info) => Promise.resolve(api.alarms.create(name, info)),
        clear: (name) => promisify(api.alarms.clear, api.alarms, [name]),
        onAlarm: api.alarms.onAlarm
      },

      scripting: {
        executeScript: (injection) => promisify(api.scripting.executeScript, api.scripting, [injection])
      },

      webRequest: api.webRequest || null,
      declarativeNetRequest: api.declarativeNetRequest || null
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
