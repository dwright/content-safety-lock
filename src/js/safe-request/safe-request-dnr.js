const SAFE_REQUEST_RULE_ID_BASE = 1000;

const PARAM_REDIRECT = 1;
const ALREADY_SAFE_ALLOW = 2;
const HEADERS = 3;

const TOP_TYPES = ['main_frame', 'sub_frame'];
const REDIRECT_TYPES_ANY = ['main_frame', 'sub_frame', 'xmlhttprequest'];
const HEADER_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font',
  'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
];

const SAFE_REQUEST_PARAM_PROVIDERS = {
  google: {
    key: 'safe',
    value: 'active',
    regex: String.raw`^https?://([a-z0-9-]+\.)*google\.[a-z]{2,3}(\.[a-z]{2})?/(complete/)?search([/?#]|$)`,
    alreadySafeRegex: String.raw`^https?://([a-z0-9-]+\.)*google\.[a-z]{2,3}(\.[a-z]{2})?/(complete/)?search\?([^#]*&)?safe=active(&|#|$)`
  },
  bing: {
    key: 'adlt',
    value: 'strict',
    regex: String.raw`^https?://([a-z0-9-]+\.)*bing\.com/`,
    alreadySafeRegex: String.raw`^https?://([a-z0-9-]+\.)*bing\.com/[^?#]*\?([^#]*&)?adlt=strict(&|#|$)`
  },
  yahoo: {
    key: 'vm',
    value: 'r',
    regex: String.raw`^https?://([a-z0-9-]+\.)*search\.yahoo\.[a-z]{2,3}(\.[a-z]{2})?/`,
    alreadySafeRegex: String.raw`^https?://([a-z0-9-]+\.)*search\.yahoo\.[a-z]{2,3}(\.[a-z]{2})?/[^?#]*\?([^#]*&)?vm=r(&|#|$)`
  },
  ddg: {
    key: 'kp',
    value: '1',
    regex: String.raw`^https?://(www\.)?duckduckgo\.com/`,
    alreadySafeRegex: String.raw`^https?://(www\.)?duckduckgo\.com/[^?#]*\?([^#]*&)?kp=1(&|#|$)`
  }
};

function buildSafeRequestRules(config) {
  if (!config.enabled) return [];

  const rules = [];
  const resourceTypes = config.perFrameEnforcement === 'top'
    ? TOP_TYPES
    : REDIRECT_TYPES_ANY;
  let nextId = SAFE_REQUEST_RULE_ID_BASE;

  for (const [providerName, providerRule] of Object.entries(SAFE_REQUEST_PARAM_PROVIDERS)) {
    const provider = config.providers[providerName];
    if (!provider.enabled || !provider.useParam) continue;

    const condition = (regexFilter) => ({
      regexFilter,
      isUrlFilterCaseSensitive: false,
      resourceTypes
    });

    rules.push({
      id: nextId++,
      priority: PARAM_REDIRECT,
      action: {
        type: 'redirect',
        redirect: {
          transform: {
            queryTransform: {
              addOrReplaceParams: [{ key: providerRule.key, value: providerRule.value }]
            }
          }
        }
      },
      condition: condition(providerRule.regex)
    });
    rules.push({
      id: nextId++,
      priority: ALREADY_SAFE_ALLOW,
      action: { type: 'allow' },
      condition: condition(providerRule.alreadySafeRegex)
    });

  }

  if (config.providers.youtube.enabled) {
    rules.push({
      id: nextId++,
      priority: HEADERS,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{
          header: 'YouTube-Restrict',
          operation: 'set',
          value: config.providers.youtube.headerMode === 'strict' ? 'Strict' : 'Moderate'
        }]
      },
      condition: {
        requestDomains: ['youtube.com', 'youtu.com', 'ytimg.com', 'googlevideo.com', 'youtu.be'],
        resourceTypes: HEADER_TYPES
      }
    });
  }

  if (config.addPreferSafeHeader) {
    rules.push({
      id: nextId++,
      priority: HEADERS,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'Prefer', operation: 'set', value: 'safe' }]
      },
      condition: { resourceTypes: HEADER_TYPES }
    });
  }

  return rules;
}

let safeRequestRuleSyncChain = Promise.resolve();

function syncSafeRequestRules(dnr, config) {
  const syncPromise = safeRequestRuleSyncChain.then(async () => {
    const existingRules = await dnr.getDynamicRules();
    const removeRuleIds = existingRules
      .map((rule) => rule.id)
      .filter((id) => id >= SAFE_REQUEST_RULE_ID_BASE && id <= 1999);
    await dnr.updateDynamicRules({
      removeRuleIds,
      addRules: buildSafeRequestRules(config)
    });
  });
  safeRequestRuleSyncChain = syncPromise.catch(() => {});
  return syncPromise;
}
