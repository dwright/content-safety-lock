/**
 * Firefox platform adapter.
 *
 * Firefox implements the promise-based `browser.*` WebExtension API natively,
 * so this adapter is a thin pass-through that only normalizes the shape of the
 * object exposed by `browser-api.js`.
 */

(function (global) {
  'use strict';

  const adapters = global.CSLPlatformAdapters || (global.CSLPlatformAdapters = {});

  adapters.firefox = function createFirefoxAdapter() {
    const api = global.browser;

    return {
      capabilities: {
        manifestVersion: api.runtime.getManifest().manifest_version,
        blockingWebRequest: Boolean(api.webRequest?.onBeforeRequest),
        declarativeNetRequest: Boolean(api.declarativeNetRequest)
      },

      storage: {
        local: {
          get: (keys) => api.storage.local.get(keys),
          set: (items) => api.storage.local.set(items),
          remove: (keys) => api.storage.local.remove(keys)
        },
        managed: {
          get: (keys) => api.storage.managed.get(keys)
        },
        onChanged: api.storage.onChanged
      },

      runtime: {
        sendMessage: (message) => api.runtime.sendMessage(message),
        onMessage: api.runtime.onMessage,
        onInstalled: api.runtime.onInstalled,
        getURL: (path) => api.runtime.getURL(path),
        getManifest: () => api.runtime.getManifest(),
        openOptionsPage: () => api.runtime.openOptionsPage()
      },

      tabs: {
        create: (props) => api.tabs.create(props),
        query: (info) => api.tabs.query(info),
        sendMessage: (tabId, message) => api.tabs.sendMessage(tabId, message)
      },

      alarms: {
        create: (name, info) => api.alarms.create(name, info),
        clear: (name) => api.alarms.clear(name),
        onAlarm: api.alarms.onAlarm
      },

      scripting: {
        executeScript: (injection) => api.scripting.executeScript(injection)
      },

      webRequest: api.webRequest || null,
      declarativeNetRequest: api.declarativeNetRequest || null
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
