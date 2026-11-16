const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadBackground(storedState, alarms) {
  const store = { state: storedState };
  const event = { addListener() {} };
  const browserAPI = {
    storage: {
      local: {
        get: async () => JSON.parse(JSON.stringify(store)),
        set: async (items) => Object.assign(store, JSON.parse(JSON.stringify(items)))
      },
      managed: { get: async () => ({}) }
    },
    runtime: { onMessage: event, onInstalled: event },
    alarms: {
      onAlarm: event,
      get: async (name) => alarms.get(name),
      create: async (name, info) => { alarms.set(name, info); },
      clear: async (name) => alarms.delete(name)
    }
  };
  const context = { browserAPI, console, performance, setTimeout() {} };
  vm.createContext(context);
  for (const file of ['utils.js', 'background.js']) {
    const sourcePath = path.resolve(__dirname, '../src/js', file);
    vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
  }
  return { context, store };
}

function lockedState(endsAtEpochMs) {
  return {
    selfLock: {
      active: true,
      earlyUnlockMode: 'none',
      startedAtEpochMs: endsAtEpochMs - 60 * 60 * 1000,
      endsAtEpochMs,
      elapsedMonotonicMsAtStart: performance.now(),
      cooldownUntilEpochMs: 0
    }
  };
}

async function run() {
  // Expired lock whose alarm never fired (e.g. Safari on iOS) unlocks on read.
  const expiredAlarms = new Map([['selfLockTick', { periodInMinutes: 1 }]]);
  const expired = loadBackground(lockedState(Date.now() - 9 * 24 * 60 * 60 * 1000), expiredAlarms);
  const expiredState = await expired.context.loadState();
  assert.strictEqual(expiredState.selfLock.active, false);
  assert.strictEqual(expired.store.state.selfLock.active, false, 'expiry is persisted');
  assert(!expiredAlarms.has('selfLockTick'), 'alarm is cleared');

  // Lock still running stays active, and a missing alarm is re-created.
  const activeAlarms = new Map();
  const active = loadBackground(lockedState(Date.now() + 60 * 60 * 1000), activeAlarms);
  const activeState = await active.context.loadState();
  assert.strictEqual(activeState.selfLock.active, true);
  await active.context.ensureSelfLockAlarm();
  assert(activeAlarms.has('selfLockTick'), 'alarm is re-created for an active lock');

  console.log('PASS: self-lock expires on read and alarm is restored for active locks');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
