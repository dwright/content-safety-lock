/**
 * Safari platform adapter (macOS, iOS, iPadOS).
 *
 * Safari implements the promise-based `browser.*` namespace, so the surface is
 * close to Firefox. The differences that matter are capability-level: Safari
 * has no blocking `webRequest` API and, on iOS, no `scripting.executeScript`
 * into the main world, so callers must fall back to content-script injection.
 */

(function (global) {
  'use strict';

  const adapters = global.CSLPlatformAdapters || (global.CSLPlatformAdapters = {});

  adapters.safari = function createSafariAdapter() {
    const api = global.browser || global.chrome;

    return {
      capabilities: {
        manifestVersion: api.runtime.getManifest().manifest_version,
        blockingWebRequest: false,
        declarativeNetRequest: Boolean(api.declarativeNetRequest)
      },

      storage: {
        local: {
          get: (keys) => api.storage.local.get(keys),
          set: (items) => api.storage.local.set(items),
          remove: (keys) => api.storage.local.remove(keys)
        },
        managed: {
          get: (keys) => (api.storage.managed
            ? api.storage.managed.get(keys)
            : Promise.resolve({}))
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
        create: (name, info) => Promise.resolve(api.alarms.create(name, info)),
        clear: (name) => api.alarms.clear(name),
        // Resolved lazily: privileged namespaces are absent in content scripts.
        get onAlarm() { return api.alarms?.onAlarm; }
      },

      scripting: {
        executeScript: (injection) => (api.scripting
          ? api.scripting.executeScript(injection)
          : Promise.reject(new Error('[CSL] scripting.executeScript is unavailable on this platform')))
      },

      webRequest: null,
      declarativeNetRequest: api.declarativeNetRequest || null
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
