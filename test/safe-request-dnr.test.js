const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'src/js/safe-request/safe-request-config.js');
const DNR_FILE = path.join(ROOT, 'src/js/safe-request/safe-request-dnr.js');

function loadDnr() {
  const context = { console, Promise };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(CONFIG_FILE, 'utf8'), context, { filename: CONFIG_FILE });
  vm.runInContext(fs.readFileSync(DNR_FILE, 'utf8'), context, { filename: DNR_FILE });
  return context;
}

function localValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneConfig(context) {
  return localValue(vm.runInContext('DEFAULT_SAFE_REQUEST_CONFIG', context));
}

function build(context, config) {
  return localValue(vm.runInContext('buildSafeRequestRules', context)(config));
}

function testDisabledConfig(context) {
  const config = cloneConfig(context);
  config.enabled = false;
  assert.deepStrictEqual(build(context, config), []);
}

function testDefaultRules(context) {
  const rules = build(context, cloneConfig(context));
  assert.strictEqual(rules.length, 10);
  assert.deepStrictEqual(
    rules.map((rule) => rule.action.type),
    ['redirect', 'allow', 'redirect', 'allow', 'redirect', 'allow', 'redirect', 'allow',
      'modifyHeaders', 'modifyHeaders']
  );
  assert.strictEqual(
    rules.filter((rule) => rule.condition.regexFilter).length,
    8
  );
  assert.strictEqual(rules.some((rule) => rule.action.redirect?.transform?.host), false);

  const ids = rules.map((rule) => rule.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert(ids.every((id) => id >= 1000 && id <= 1999));
  assert(rules.every((rule) => Array.isArray(rule.condition.resourceTypes) &&
    rule.condition.resourceTypes.length > 0));

  for (const rule of rules.filter((item) => item.condition.regexFilter)) {
    assert.doesNotThrow(() => new RegExp(rule.condition.regexFilter, 'i'));
    assert(!rule.condition.regexFilter.includes('(?='));
    assert(!rule.condition.regexFilter.includes('(?!'));
    assert(!rule.condition.regexFilter.includes('(?<'));
    assert.strictEqual(rule.condition.isUrlFilterCaseSensitive, false);
  }
}

function testRegexCoverage(context) {
  const rules = build(context, cloneConfig(context));
  const pairs = [];
  for (let index = 0; index < rules.length; index += 2) {
    if (rules[index].action.type === 'redirect' && rules[index + 1].action.type === 'allow') {
      pairs.push({
        provider: new RegExp(rules[index].condition.regexFilter, 'i'),
        safe: new RegExp(rules[index + 1].condition.regexFilter, 'i')
      });
    }
  }

  const cases = [
    ['https://www.google.com/search?q=cats', true, false],
    ['https://www.google.com/search?q=cats&safe=active', true, true],
    ['https://www.google.co.uk/search?safe=off&q=x', true, false],
    ['https://www.google.com/complete/search?q=x', true, false],
    ['https://www.google.com/maps', false, false],
    ['https://www.google.com/search?notsafe=active', true, false]
  ];
  const google = pairs[0];
  for (const [url, providerMatches, safeMatches] of cases) {
    assert.strictEqual(google.provider.test(url), providerMatches, url);
    assert.strictEqual(google.safe.test(url), safeMatches, url);
  }

  const providerSamples = [
    ['https://www.bing.com/search?q=x', 1],
    ['https://search.yahoo.com/search?p=x', 2],
    ['https://duckduckgo.com/?q=x', 3]
  ];
  for (const [url, index] of providerSamples) {
    assert.strictEqual(pairs[index].provider.test(url), true, url);
    assert.strictEqual(pairs[index].safe.test(url), false, url);
  }

  const rulesByProvider = [
    {
      pair: pairs[0],
      urls: [
        'https://www.google.com/search?q=cats',
        'https://www.google.co.uk/search?safe=off&q=x',
        'https://www.google.com/complete/search?q=x'
      ]
    },
    { pair: pairs[1], urls: ['https://www.bing.com/search?q=x'] },
    { pair: pairs[2], urls: ['https://search.yahoo.com/search?p=x'] },
    { pair: pairs[3], urls: ['https://duckduckgo.com/?q=x'] }
  ];
  const redirectRules = rules.filter((rule) => rule.priority === 1);
  for (let index = 0; index < rulesByProvider.length; index += 1) {
    const transform = redirectRules[index].action.redirect.transform.queryTransform;
    const { pair, urls } = rulesByProvider[index];
    for (const url of urls) {
      const transformed = new URL(url);
      for (const { key, value } of transform.addOrReplaceParams) {
        transformed.searchParams.set(key, value);
      }
      assert(pair.safe.test(transformed.href), `${transformed.href} must match its allow rule`);
    }
  }
}

function testToggles(context) {
  const config = cloneConfig(context);
  config.providers.google.enabled = false;
  config.providers.bing.useParam = false;
  let rules = build(context, config);
  assert.strictEqual(rules.some((rule) =>
    rule.condition.regexFilter?.includes('google\\.')), false);
  assert.strictEqual(rules.some((rule) =>
    rule.condition.regexFilter?.includes('bing\\.')), false);

  const staleBingRedirectConfig = cloneConfig(context);
  staleBingRedirectConfig.providers.bing.useRedirect = true;
  rules = build(context, staleBingRedirectConfig);
  assert.deepStrictEqual({
    hasHostRedirect: rules.some((rule) => rule.action.redirect?.transform?.host),
    bingActions: rules
      .filter((rule) => rule.condition.regexFilter?.includes('bing\\.'))
      .map((rule) => rule.action.type)
  }, {
    hasHostRedirect: false,
    bingActions: ['redirect', 'allow']
  });

  const moderateConfig = cloneConfig(context);
  moderateConfig.providers.youtube.headerMode = 'moderate';
  rules = build(context, moderateConfig);
  const youtubeRule = rules.find((rule) => rule.action.requestHeaders?.some(
    (header) => header.header === 'YouTube-Restrict'
  ));
  assert(youtubeRule);
  assert.strictEqual(youtubeRule.action.requestHeaders[0].value, 'Moderate');

  const noYoutubeConfig = cloneConfig(context);
  noYoutubeConfig.providers.youtube.enabled = false;
  rules = build(context, noYoutubeConfig);
  assert.strictEqual(rules.some((rule) =>
    rule.action.requestHeaders?.some((header) => header.header === 'YouTube-Restrict')), false);

  const noPreferConfig = cloneConfig(context);
  noPreferConfig.addPreferSafeHeader = false;
  rules = build(context, noPreferConfig);
  assert.strictEqual(rules.some((rule) =>
    rule.action.requestHeaders?.some((header) => header.header === 'Prefer')), false);

  const topConfig = cloneConfig(context);
  topConfig.perFrameEnforcement = 'top';
  rules = build(context, topConfig);
  const topTypes = localValue(vm.runInContext('TOP_TYPES', context));
  assert(rules.filter((rule) => rule.priority === 1 || rule.priority === 2)
    .every((rule) => JSON.stringify(rule.condition.resourceTypes) === JSON.stringify(topTypes)));
}

async function testSync(context) {
  const config = cloneConfig(context);
  const built = build(context, config);
  const updates = [];
  const dnr = {
    async getDynamicRules() {
      return [{ id: 5 }, { id: 1001 }, { id: 1002 }];
    },
    async updateDynamicRules(update) {
      updates.push(localValue(update));
    }
  };

  await vm.runInContext('syncSafeRequestRules', context)(dnr, config);
  assert.strictEqual(updates.length, 1);
  assert.deepStrictEqual(updates[0].removeRuleIds, [1001, 1002]);
  assert.deepStrictEqual(updates[0].addRules, built);

  const disabled = cloneConfig(context);
  disabled.enabled = false;
  await vm.runInContext('syncSafeRequestRules', context)(dnr, disabled);
  assert.deepStrictEqual(updates[1].addRules, []);

  let resolveFirstUpdate;
  let signalFirstUpdateStarted;
  const firstUpdateStarted = new Promise((resolve) => {
    signalFirstUpdateStarted = resolve;
  });
  let getCalls = 0;
  let updateCalls = 0;
  const ordered = {
    getDynamicRules() {
      getCalls += 1;
      return Promise.resolve([]);
    },
    updateDynamicRules() {
      updateCalls += 1;
      if (updateCalls === 1) {
        signalFirstUpdateStarted();
        return new Promise((resolve) => {
          resolveFirstUpdate = resolve;
        });
      }
      return Promise.resolve();
    }
  };

  const first = vm.runInContext('syncSafeRequestRules', context)(ordered, config);
  const second = vm.runInContext('syncSafeRequestRules', context)(ordered, disabled);
  await firstUpdateStarted;
  assert.strictEqual(getCalls, 1);
  resolveFirstUpdate();
  await Promise.all([first, second]);
  assert.strictEqual(getCalls, 2);
}

async function main() {
  const context = loadDnr();
  testDisabledConfig(context);
  testDefaultRules(context);
  testRegexCoverage(context);
  testToggles(context);
  await testSync(context);
  console.log('PASS: DNR rules, provider matching, toggles, and serialized synchronization');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
