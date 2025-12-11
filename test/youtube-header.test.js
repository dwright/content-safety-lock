const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadFileIntoContext(ctx, relativePaths) {
  for (const relPath of relativePaths) {
    const absPath = path.resolve(__dirname, '..', relPath);
    if (fs.existsSync(absPath)) {
      const code = fs.readFileSync(absPath, 'utf8');
      vm.runInContext(code, ctx, { filename: absPath });
      return absPath;
    }
  }
  throw new Error(`Unable to locate any of: ${relativePaths.join(', ')}`);
}

function cloneConfig(defaultConfig) {
  return JSON.parse(JSON.stringify(defaultConfig));
}

function getHeader(headers, name) {
  const lower = name.toLowerCase();
  return headers.find(h => h && typeof h.name === 'string' && h.name.toLowerCase() === lower);
}

(function main() {
  const ctx = { console, URL, require };
  vm.createContext(ctx);

  loadFileIntoContext(ctx, [
    'js/safe-request/safe-request-config.js',
    'safe-request-config.js'
  ]);
  loadFileIntoContext(ctx, [
    'js/safe-request/safe-request-utils.js',
    'safe-request-utils.js'
  ]);

  const defaultConfig = vm.runInContext(
    'typeof DEFAULT_SAFE_REQUEST_CONFIG !== "undefined" ? DEFAULT_SAFE_REQUEST_CONFIG : undefined',
    ctx
  );
  const enforceSafeHeaders = vm.runInContext(
    'typeof enforceSafeHeaders !== "undefined" ? enforceSafeHeaders : undefined',
    ctx
  );

  if (typeof enforceSafeHeaders !== 'function') {
    throw new Error('enforceSafeHeaders is not defined');
  }
  if (!defaultConfig || typeof defaultConfig !== 'object') {
    throw new Error('DEFAULT_SAFE_REQUEST_CONFIG is not defined');
  }

  const cfg = cloneConfig(defaultConfig);
  cfg.enabled = true;
  cfg.addPreferSafeHeader = cfg.addPreferSafeHeader !== false;
  cfg.providers = cfg.providers || {};
  cfg.providers.youtube = cfg.providers.youtube || {};
  cfg.providers.youtube.enabled = true;
  cfg.providers.youtube.headerMode = cfg.providers.youtube.headerMode || 'strict';

  const headers = enforceSafeHeaders([], 'https://www.youtube.com/watch?v=abc', cfg);
  assert(Array.isArray(headers), 'enforceSafeHeaders should return an array');

  const youtubeHeader = getHeader(headers, 'YouTube-Restrict');
  assert(youtubeHeader, 'YouTube-Restrict header is missing');
  assert.strictEqual(youtubeHeader.value, 'Strict', 'YouTube-Restrict header should be Strict');

  const preferHeader = getHeader(headers, 'Prefer');
  assert(preferHeader && preferHeader.value.toLowerCase() === 'safe', 'Prefer: safe header is missing');

  console.log('PASS: YouTube headers are enforced (YouTube-Restrict + Prefer: safe)');
})();
