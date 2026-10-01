const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadBackground() {
  const event = { addListener() {} };
  const browserAPI = {
    storage: {
      local: { get: async () => ({}), set: async () => {} },
      managed: { get: async () => ({}) }
    },
    runtime: { onMessage: event, onInstalled: event },
    alarms: { onAlarm: event }
  };
  const context = { browserAPI, console, setTimeout() {} };
  vm.createContext(context);
  const sourcePath = path.resolve(__dirname, '../src/js/background.js');
  vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
  return context;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const context = loadBackground();
const defaultState = clone(vm.runInContext('DEFAULT_STATE', context));
const defaultLabels = defaultState.safeRequestMode.providers.bluesky.blockedLabels;

function applyPolicy(state, policy) {
  context.state = state;
  context.policy = policy;
  vm.runInContext('applyManagedPolicy(state, policy)', context);
  return clone(state);
}

function blueskyPolicy(fields) {
  return {
    safeRequestMode: {
      providers: {
        bluesky: {
          enabled: { value: true, locked: false },
          ...fields
        }
      }
    }
  };
}

assert.strictEqual(defaultState.safeRequestMode.providers.bluesky.enabled, true);
assert.strictEqual(defaultState.safeRequestMode.providers.bluesky.ageSetting, '13+');
assert.strictEqual(defaultLabels.length, 22);
assert.strictEqual(new Set(defaultLabels).size, 22);

const wildcardLocked = applyPolicy(clone(defaultState), {
  locked: true,
  safeRequestMode: {
    enabled: { value: true, locked: true },
    providers: { '*': { enabled: { value: true } } }
  }
});
assert.strictEqual(wildcardLocked.safeRequestMode.providers.bluesky.enabled, true);
assert.strictEqual(wildcardLocked.safeRequestMode.providers.bluesky.ageSetting, '13+');
assert.deepStrictEqual(wildcardLocked.safeRequestMode.providers.bluesky.blockedLabels, defaultLabels);
for (const key of [
  'safeRequestMode.providers.bluesky',
  'safeRequestMode.providers.bluesky.ageSetting',
  'safeRequestMode.providers.bluesky.blockedLabels'
]) {
  assert(wildcardLocked.managedKeys.includes(key), `${key} should be locked`);
}

const modeLocked = applyPolicy(clone(defaultState), {
  safeRequestMode: { enabled: { value: true, locked: true } }
});
for (const key of [
  'safeRequestMode.providers.bluesky',
  'safeRequestMode.providers.bluesky.ageSetting',
  'safeRequestMode.providers.bluesky.blockedLabels'
]) {
  assert(modeLocked.managedKeys.includes(key), `${key} should inherit the Safe Request Mode lock`);
}

const disabledState = clone(defaultState);
disabledState.safeRequestMode.providers.bluesky.enabled = false;
const explicitlyEnabled = applyPolicy(disabledState, {
  safeRequestMode: {
    providers: { '*': { enabled: { value: true, locked: true } } }
  }
});
assert.strictEqual(explicitlyEnabled.safeRequestMode.providers.bluesky.enabled, true);

for (const blockedLabels of ['*', ['*'], { value: '*', locked: true }, ['porn', '*']]) {
  const result = applyPolicy(clone(defaultState), blueskyPolicy({ blockedLabels }));
  const labels = result.safeRequestMode.providers.bluesky.blockedLabels;
  assert.deepStrictEqual(labels, defaultLabels);
  assert.strictEqual(new Set(labels).size, 22);
}

const customLabels = applyPolicy(clone(defaultState), blueskyPolicy({
  blockedLabels: { value: ['porn', 'spam'], locked: false }
}));
assert.deepStrictEqual(customLabels.safeRequestMode.providers.bluesky.blockedLabels, ['porn', 'spam']);
assert(!customLabels.managedKeys.includes('safeRequestMode.providers.bluesky.blockedLabels'));

const filteredLabels = applyPolicy(clone(defaultState), blueskyPolicy({
  blockedLabels: { value: ['porn', 123, 'spam', 'porn'], locked: false }
}));
assert.deepStrictEqual(filteredLabels.safeRequestMode.providers.bluesky.blockedLabels, ['porn', 'spam']);

const invalidLabels = applyPolicy(clone(defaultState), blueskyPolicy({
  blockedLabels: { value: 123, locked: false }
}));
assert.deepStrictEqual(invalidLabels.safeRequestMode.providers.bluesky.blockedLabels, defaultLabels);

const customAge = applyPolicy(clone(defaultState), blueskyPolicy({
  ageSetting: { value: '18+', locked: false }
}));
assert.strictEqual(customAge.safeRequestMode.providers.bluesky.ageSetting, '18+');
assert(!customAge.managedKeys.includes('safeRequestMode.providers.bluesky.ageSetting'));

const invalidAge = applyPolicy(clone(defaultState), blueskyPolicy({ ageSetting: 'adult' }));
assert.strictEqual(invalidAge.safeRequestMode.providers.bluesky.ageSetting, '13+');

const explicitOverride = applyPolicy(clone(defaultState), {
  safeRequestMode: {
    providers: {
      '*': { enabled: { value: true, locked: true } },
      bluesky: { enabled: { value: false } }
    }
  }
});
assert.strictEqual(explicitOverride.safeRequestMode.providers.bluesky.enabled, false);

console.log('PASS: Bluesky defaults, wildcard expansion, managed locks, and explicit policy overrides');
