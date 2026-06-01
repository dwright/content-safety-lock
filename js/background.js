/**
 * Background Service Worker for Content Safety Lock
 * Handles policy engine, state management, and alarms
 */

// Initialize safe request handlers after a small delay
setTimeout(() => {
  if (typeof initializeSafeRequestHandlers === 'function') {
    try {
      initializeSafeRequestHandlers();
    } catch (err) {
      console.error('[CSL] Failed to initialize Safe Request Mode handlers:', err);
    }
  } else {
    console.error('[CSL] initializeSafeRequestHandlers is not defined');
  }
}, 100);

// ============ Policy Page Cache ============

const POLICY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * In-memory cache for same-session fast lookups.
 * Keyed by hostname; value: { signals: string[], fetchedAtEpochMs: number }
 */
const policyPageMemoryCache = new Map();

/**
 * Persist the cache entry for a hostname to browser.storage.local.
 */
async function savePolicyCacheEntry(hostname, entry) {
  try {
    const stored = await browser.storage.local.get('policyPageCache');
    const cache = stored.policyPageCache || {};
    cache[hostname] = entry;
    await browser.storage.local.set({ policyPageCache: cache });
  } catch (err) {
    console.log('[BG] Failed to save policy cache entry:', err);
  }
}

/**
 * Load the cache entry for a hostname from browser.storage.local.
 * Returns null if absent or expired.
 */
async function loadPolicyCacheEntry(hostname) {
  try {
    const stored = await browser.storage.local.get('policyPageCache');
    const cache = stored.policyPageCache || {};
    const entry = cache[hostname];
    if (!entry) return null;
    if (Date.now() - entry.fetchedAtEpochMs > POLICY_CACHE_TTL_MS) return null;
    return entry;
  } catch (err) {
    return null;
  }
}

/**
 * Prune all expired entries from the persisted policy page cache.
 */
async function pruneStaleCache() {
  try {
    const stored = await browser.storage.local.get('policyPageCache');
    const cache = stored.policyPageCache || {};
    const now = Date.now();
    let pruned = false;
    for (const hostname of Object.keys(cache)) {
      if (now - cache[hostname].fetchedAtEpochMs > POLICY_CACHE_TTL_MS) {
        delete cache[hostname];
        policyPageMemoryCache.delete(hostname);
        pruned = true;
      }
    }
    if (pruned) {
      await browser.storage.local.set({ policyPageCache: cache });
      console.log('[BG] Pruned stale policy page cache entries');
    }
  } catch (err) {
    console.log('[BG] Failed to prune policy cache:', err);
  }
}

/**
 * Fetch a single URL and extract plain text from the HTML response.
 * Returns the lowercased text content, or null on failure.
 */
async function fetchPolicyPageText(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const html = await response.text();
    // Strip tags and decode entities using a simple regex approach safe for
    // background context (no DOM available in MV2 background pages).
    const withoutTags = html.replace(/<[^>]+>/g, ' ');
    return withoutTags.toLowerCase();
  } catch (err) {
    console.log('[BG] fetchPolicyPageText failed for', url, ':', err);
    return null;
  }
}

/**
 * Given a list of candidate policy-page URLs from a single origin, check
 * each one for age-verification language and vocabulary matches.
 * Results are cached by hostname for POLICY_CACHE_TTL_MS.
 *
 * Returns { signals: string[], details: string[] }
 */
async function fetchAndScanPolicyPages(candidateUrls, originUrl) {
  let hostname;
  try {
    hostname = new URL(originUrl).hostname;
  } catch {
    return { signals: [], details: [] };
  }

  // Check in-memory cache first.
  if (policyPageMemoryCache.has(hostname)) {
    const cached = policyPageMemoryCache.get(hostname);
    if (Date.now() - cached.fetchedAtEpochMs <= POLICY_CACHE_TTL_MS) {
      console.log('[BG] Policy cache hit (memory) for', hostname);
      return { signals: cached.signals, details: cached.details };
    }
    policyPageMemoryCache.delete(hostname);
  }

  // Check persistent cache.
  const persisted = await loadPolicyCacheEntry(hostname);
  if (persisted) {
    console.log('[BG] Policy cache hit (storage) for', hostname);
    policyPageMemoryCache.set(hostname, persisted);
    return { signals: persisted.signals, details: persisted.details };
  }

  // Fetch and scan (cache miss).
  const signals = [];
  const details = [];

  for (const url of candidateUrls.slice(0, 3)) {
    console.log('[BG] Fetching policy page:', url);
    const text = await fetchPolicyPageText(url);
    if (!text) continue;

    // Age-verification text patterns.
    if (typeof matchesAgeVerificationText === 'function' && matchesAgeVerificationText(text)) {
      if (!signals.includes('ICRA:ageVerification')) {
        signals.push('ICRA:ageVerification');
        details.push('Age verification language found on: ' + url);
        console.log('[BG] Age-verification language found on', url);
      }
    }

    // Vocabulary matching against lowercased text.
    if (typeof detectMetaVocabulary === 'function') {
      const vocabSignals = detectMetaVocabulary(null, text);
      for (const sig of vocabSignals) {
        if (!signals.includes(sig)) {
          signals.push(sig);
          details.push('Vocabulary match (' + sig + ') found on: ' + url);
          console.log('[BG] Vocabulary signal', sig, 'found on', url);
        }
      }
    }

    if (signals.length > 0) break; // Stop scanning further pages once we have a hit.
  }

  const entry = { signals, details, fetchedAtEpochMs: Date.now() };
  policyPageMemoryCache.set(hostname, entry);
  await savePolicyCacheEntry(hostname, entry);

  return { signals, details };
}

// ============ Default State ============

const DEFAULT_STATE = {
  parental: {
    enabled: true,
    categories: {
      sexual: true,
      violence: false,
      profanity: false,
      drugs: false,
      gambling: false,
      ageVerification: false,
      adultProductSales: false
    },
    adultProductSalesVendors: {
      etsy: false,
      redbubble: false,
      teepublic: false,
      zazzle: false,
      itchIo: false,
      ebay: false,
      amazon: false,
      patreon: false,
      shopify: false
    },
    treatMatureAsAdult: true,
    allowList: [],
    blockList: [],
    settingsPINHash: null
  },
  selfLock: {
    active: false,
    scope: 'sexual', // 'sexual', 'sexual-violence', 'all'
    ignoreAllowlist: true,
    earlyUnlockMode: 'none', // 'none' | 'phrase' | 'game'
    allowEarlyUnlock: false,
    requiresPassword: false,
    cooldownMinutes: 60,
    startedAtEpochMs: 0,
    endsAtEpochMs: 0,
    elapsedMonotonicMsAtStart: 0,
    cooldownUntilEpochMs: 0,
    passphraseHash: null,
    pendingUnlockPhrase: null,
    pendingUnlockPhraseExpiry: 0,
    incrementOnBlock: false,
    incrementMinutes: 5,
    game: null // populated when earlyUnlockMode === 'game'
  },
  recoveryCodesHash: [], // Array of hashed recovery codes
  pinLock: {
    locked: false,
    unlockedUntilEpochMs: 0
  },
  safeRequestMode: {
    enabled: true,
    addPreferSafeHeader: true,
    applyInPrivateWindows: true,
    forceUnderSelfLock: true,
    ignoreAllowlistUnderSelfLock: true,
    blockUserParamDowngrade: true,
    perFrameEnforcement: 'any',
    providers: {
      google: { enabled: true, useParam: true, enforceCookie: false, useRedirect: false },
      bing: { enabled: true, useParam: true, usePreferSafeHonor: true, useRedirect: false },
      yahoo: { enabled: true, useParam: true },
      ddg: { enabled: true, useParam: true, useRedirect: false },
      youtube: { enabled: true, headerMode: 'strict', useRestrictHostRedirect: false },
      tumblr: { enabled: true },
      reddit: { enabled: true }
    }
  }
};

// ============ Managed Policy ============

/**
 * Load values from browser.storage.managed, restricted to the General-tab
 * sections (parental and safeRequestMode) plus the top-level locked flag.
 * Returns an object containing only those keys (or an empty object when
 * managed storage is not provisioned or is inaccessible).
 */
async function loadManagedPolicy() {
  try {
    const managed = await browser.storage.managed.get(null);
    const policy = {};
    if (managed && typeof managed === 'object') {
      if (managed.locked) {
        policy.locked = true;
      }
      if (managed.parental && typeof managed.parental === 'object') {
        policy.parental = managed.parental;
      }
      if (managed.safeRequestMode && typeof managed.safeRequestMode === 'object') {
        policy.safeRequestMode = managed.safeRequestMode;
      }
    }
    return policy;
  } catch (err) {
    // storage.managed throws when no managed storage manifest is installed.
    return {};
  }
}

/**
 * Expand wildcard '*' entries in a policy object to all default keys.
 * If the policy contains a '*' key, its value is copied to all default
 * keys that are not explicitly specified in the policy.
 *
 * @param {Object} policySection - The policy section (e.g., categories, vendors)
 * @param {Array<string>} defaultKeys - Array of valid keys from DEFAULT_STATE
 * @returns {Object} - The expanded policy section
 */
function expandWildcardEntries(policySection, defaultKeys) {
  if (!policySection || typeof policySection !== 'object') {
    return policySection;
  }

  const hasWildcard = Object.prototype.hasOwnProperty.call(policySection, '*');
  if (!hasWildcard) {
    return policySection;
  }

  const wildcardValue = policySection['*'];
  const expanded = {};

  // Copy all non-wildcard entries first
  for (const [key, val] of Object.entries(policySection)) {
    if (key !== '*') {
      expanded[key] = val;
    }
  }

  // Apply wildcard to all default keys not explicitly specified
  for (const key of defaultKeys) {
    if (!Object.prototype.hasOwnProperty.call(expanded, key)) {
      expanded[key] = wildcardValue;
    }
  }

  return expanded;
}

/**
 * Resolve a managed scalar field (non-boolean, e.g. a string) using the
 * object form { value?: any, locked?: boolean }.  Unlike resolveEnabledField,
 * the value is returned as-is without Boolean coercion.
 *
 * Returns { resolvedValue, isLocked } where resolvedValue is null when absent.
 */
function resolveScalarField(field, defaultValue, parentLocked) {
  if (field !== null && typeof field === 'object') {
    const hasValue  = Object.prototype.hasOwnProperty.call(field, 'value');
    const hasLocked = Object.prototype.hasOwnProperty.call(field, 'locked');
    const resolvedValue = hasValue ? field.value : (defaultValue !== undefined ? defaultValue : null);
    const isLocked = hasLocked ? Boolean(field.locked) : Boolean(parentLocked);
    return { resolvedValue, isLocked };
  }
  // Plain scalar value (legacy) — treat as locked.
  if (field !== undefined && field !== null) {
    return { resolvedValue: field, isLocked: true };
  }
  return { resolvedValue: defaultValue !== undefined ? defaultValue : null, isLocked: Boolean(parentLocked) };
}

/**
 * Resolve a managed "enabled-style" field that may be either a plain boolean
 * (legacy) or the new object form { value?: boolean, locked?: boolean }.
 *
 * Returns { resolvedValue, isLocked } where:
 *   resolvedValue  — the boolean to write into state, or null to leave
 *                    the existing state value unchanged.
 *   isLocked       — whether the UI control should be disabled.
 *
 * The parentLocked argument is true when an ancestor node is locked, which
 * propagates a default lock downward unless the field explicitly opts out
 * with locked: false.
 */
function resolveEnabledField(field, defaultValue, parentLocked) {
  // Legacy: plain boolean → locked on/off (old behaviour unchanged).
  if (typeof field === 'boolean') {
    return { resolvedValue: field, isLocked: true };
  }

  // New object form.
  if (field !== null && typeof field === 'object') {
    const hasValue  = Object.prototype.hasOwnProperty.call(field, 'value');
    const hasLocked = Object.prototype.hasOwnProperty.call(field, 'locked');

    const resolvedValue = hasValue ? Boolean(field.value) : (defaultValue !== undefined ? defaultValue : null);
    // Explicit locked:false overrides parent; otherwise inherit parent lock.
    const isLocked = hasLocked ? Boolean(field.locked) : Boolean(parentLocked);

    return { resolvedValue, isLocked };
  }

  // Absent / null: follow DEFAULT_STATE, not locked (unless parent is locked).
  return { resolvedValue: defaultValue !== undefined ? defaultValue : null, isLocked: Boolean(parentLocked) };
}

/**
 * Deep-merge managed policy values on top of state in-place, for the
 * parental and safeRequestMode sections only.
 *
 * Also populates state.managedKeys (dotted paths that are locked) and
 * state.managedLocked (top-level UI lock flag).
 */
function applyManagedPolicy(state, policy) {
  const lockedKeys = new Set();
  const topLevelLocked = Boolean(policy.locked);
  state.managedLocked = topLevelLocked;

  // ---- parental section ----
  if (policy.parental && typeof policy.parental === 'object') {
    const p = policy.parental;

    // parental.enabled
    if (p.enabled !== undefined) {
      const def = resolveEnabledField(p.enabled, DEFAULT_STATE.parental.enabled, false);
      if (def.resolvedValue !== null) state.parental.enabled = def.resolvedValue;
      if (def.isLocked) lockedKeys.add('parental.enabled');
    }
    const parentalLocked = lockedKeys.has('parental.enabled');

    // parental scalar fields
    const PARENTAL_SCALARS = ['treatMatureAsAdult', 'allowList', 'blockList'];
    for (const key of PARENTAL_SCALARS) {
      if (p[key] !== undefined) {
        const def = resolveEnabledField(p[key], DEFAULT_STATE.parental[key], parentalLocked);
        if (def.resolvedValue !== null) state.parental[key] = def.resolvedValue;
        if (def.isLocked) lockedKeys.add(`parental.${key}`);
      } else if (parentalLocked) {
        lockedKeys.add(`parental.${key}`);
      }
    }

    // parental.categories (with wildcard expansion)
    if (p.categories && typeof p.categories === 'object') {
      p.categories = expandWildcardEntries(
        p.categories,
        Object.keys(DEFAULT_STATE.parental.categories)
      );
      for (const [cat, val] of Object.entries(p.categories)) {
        const def = resolveEnabledField(val, DEFAULT_STATE.parental.categories[cat], parentalLocked);
        if (def.resolvedValue !== null) state.parental.categories[cat] = def.resolvedValue;
        if (def.isLocked) lockedKeys.add(`parental.categories.${cat}`);
      }
    } else if (parentalLocked) {
      for (const cat of Object.keys(DEFAULT_STATE.parental.categories)) {
        lockedKeys.add(`parental.categories.${cat}`);
      }
    }

    // parental.adultProductSalesVendors (with wildcard expansion)
    if (p.adultProductSalesVendors && typeof p.adultProductSalesVendors === 'object') {
      p.adultProductSalesVendors = expandWildcardEntries(
        p.adultProductSalesVendors,
        Object.keys(DEFAULT_STATE.parental.adultProductSalesVendors)
      );
      for (const [vendor, val] of Object.entries(p.adultProductSalesVendors)) {
        const def = resolveEnabledField(val, DEFAULT_STATE.parental.adultProductSalesVendors[vendor], parentalLocked);
        if (def.resolvedValue !== null) state.parental.adultProductSalesVendors[vendor] = def.resolvedValue;
        if (def.isLocked) lockedKeys.add(`parental.adultProductSalesVendors.${vendor}`);
      }
    } else if (parentalLocked) {
      for (const vendor of Object.keys(DEFAULT_STATE.parental.adultProductSalesVendors)) {
        lockedKeys.add(`parental.adultProductSalesVendors.${vendor}`);
      }
    }
  }

  // ---- safeRequestMode section ----
  if (policy.safeRequestMode && typeof policy.safeRequestMode === 'object') {
    const s = policy.safeRequestMode;

    // safeRequestMode.enabled
    if (s.enabled !== undefined) {
      const def = resolveEnabledField(s.enabled, DEFAULT_STATE.safeRequestMode.enabled, false);
      if (def.resolvedValue !== null) state.safeRequestMode.enabled = def.resolvedValue;
      if (def.isLocked) lockedKeys.add('safeRequestMode.enabled');
    }
    const srmLocked = lockedKeys.has('safeRequestMode.enabled');

    // safeRequestMode scalar fields
    const SRM_SCALARS = ['addPreferSafeHeader', 'applyInPrivateWindows', 'blockUserParamDowngrade', 'perFrameEnforcement'];
    for (const key of SRM_SCALARS) {
      if (s[key] !== undefined) {
        const def = resolveEnabledField(s[key], DEFAULT_STATE.safeRequestMode[key], srmLocked);
        if (def.resolvedValue !== null) state.safeRequestMode[key] = def.resolvedValue;
        if (def.isLocked) lockedKeys.add(`safeRequestMode.${key}`);
      } else if (srmLocked) {
        lockedKeys.add(`safeRequestMode.${key}`);
      }
    }

    // safeRequestMode.providers (with wildcard expansion)
    // Process all known providers. For each, check if the policy mentions it;
    // if not, inherit the srmLocked flag.
    if (s.providers && typeof s.providers === 'object') {
      s.providers = expandWildcardEntries(
        s.providers,
        Object.keys(DEFAULT_STATE.safeRequestMode.providers)
      );
    }
    const allProviders = Object.keys(DEFAULT_STATE.safeRequestMode.providers);
    for (const providerName of allProviders) {
      const providerPolicy = s.providers?.[providerName];
      const providerDefault = DEFAULT_STATE.safeRequestMode.providers[providerName] || {};

      if (providerPolicy && typeof providerPolicy === 'object' && providerPolicy.enabled !== undefined) {
        const def = resolveEnabledField(providerPolicy.enabled, providerDefault.enabled, srmLocked);
        if (def.resolvedValue !== null) {
          state.safeRequestMode.providers[providerName] = {
            ...providerDefault,
            ...state.safeRequestMode.providers[providerName],
            enabled: def.resolvedValue
          };
        }
        if (def.isLocked) lockedKeys.add(`safeRequestMode.providers.${providerName}`);

        // Provider sub-fields (provider-level lock is the parent).
        const providerLocked = def.isLocked;
        if (providerName === 'bing' && providerPolicy.useRedirect !== undefined) {
          const subDef = resolveEnabledField(providerPolicy.useRedirect, providerDefault.useRedirect, providerLocked);
          if (subDef.resolvedValue !== null) {
            state.safeRequestMode.providers.bing = {
              ...providerDefault,
              ...state.safeRequestMode.providers.bing,
              useRedirect: subDef.resolvedValue
            };
          }
          if (subDef.isLocked) lockedKeys.add('safeRequestMode.providers.bing.useRedirect');
        }
        if (providerName === 'youtube' && providerPolicy.headerMode !== undefined) {
          const subDef = resolveScalarField(providerPolicy.headerMode, providerDefault.headerMode, providerLocked);
          if (subDef.resolvedValue !== null) {
            state.safeRequestMode.providers.youtube = {
              ...providerDefault,
              ...state.safeRequestMode.providers.youtube,
              headerMode: subDef.resolvedValue
            };
          }
          if (subDef.isLocked) lockedKeys.add('safeRequestMode.providers.youtube.headerMode');
        }
      } else if (srmLocked) {
        // Not mentioned in policy but parent is locked — inherit lock.
        lockedKeys.add(`safeRequestMode.providers.${providerName}`);
      }
    }
  }

  state.managedKeys = Array.from(lockedKeys);
}

/**
 * computeManagedKeys is no longer called directly — applyManagedPolicy now
 * populates state.managedKeys itself.  This stub is kept for compatibility.
 */
function computeManagedKeys(policy) {
  return [];
}

// ============ State Management ============

/**
 * Load state from storage
 */
async function loadState() {
  const result = await browser.storage.local.get('state');
  const stored = result.state || {};
  
  // Deep merge with defaults to ensure all properties exist
  const state = {
    ...DEFAULT_STATE,
    ...stored,
    parental: { 
      ...DEFAULT_STATE.parental, 
      ...stored.parental,
      categories: { ...DEFAULT_STATE.parental.categories, ...stored.parental?.categories },
      adultProductSalesVendors: { ...DEFAULT_STATE.parental.adultProductSalesVendors, ...stored.parental?.adultProductSalesVendors }
    },
    selfLock: { ...DEFAULT_STATE.selfLock, ...stored.selfLock },
    pinLock: { ...DEFAULT_STATE.pinLock, ...stored.pinLock },
    safeRequestMode: { 
      ...DEFAULT_STATE.safeRequestMode, 
      ...stored.safeRequestMode,
      providers: {
        ...DEFAULT_STATE.safeRequestMode.providers,
        ...stored.safeRequestMode?.providers
      }
    }
  };

  // Backward compat: derive earlyUnlockMode from older flags if missing.
  if (!state.selfLock.earlyUnlockMode) {
    state.selfLock.earlyUnlockMode = state.selfLock.allowEarlyUnlock ? 'phrase' : 'none';
  }

  // Managed policy overrides user values (read-only from the user's perspective).
  // applyManagedPolicy sets state.managedKeys and state.managedLocked.
  const policy = await loadManagedPolicy();
  applyManagedPolicy(state, policy);

  return state;
}

/**
 * Save state to storage
 */
async function saveState(state) {
  await browser.storage.local.set({ state });
}

/**
 * Initialize state if not present
 */
async function initializeState() {
  const result = await browser.storage.local.get('state');
  if (!result.state) {
    await saveState(DEFAULT_STATE);
  }
}

// ============ Policy Engine ============

/**
 * Determine if a page should be blocked
 */
async function shouldBlock(signals, url) {
  const state = await loadState();
  
  // If no signals, don't block
  if (!signals || signals.length === 0) {
    return false;
  }
  
  // Check Self-Lock first (if active and not expired)
  if (state.selfLock.active) {
    const now = Date.now();
    if (now >= state.selfLock.endsAtEpochMs) {
      state.selfLock.active = false;
      await saveState(state);
    } else {
      // Check for clock tamper
      const tamperCheck = checkClockTamper(
        state.selfLock.startedAtEpochMs,
        state.selfLock.elapsedMonotonicMsAtStart
      );
      if (tamperCheck.rolledBack) {
        state.selfLock.endsAtEpochMs += tamperCheck.extendedDuration;
        await saveState(state);
      }
      
      // Check if allow-list should be ignored during self-lock
      if (!state.selfLock.ignoreAllowlist && isInAllowList(url, state.parental.allowList)) {
        return false;
      }
      
      // Check if signals match self-lock scope
      if (matchesSelfLockScope(signals, state.selfLock.scope)) {
        return true;
      }
    }
  }
  
  // Parental mode - ALWAYS CHECK if enabled (regardless of self-lock)
  if (state.parental.enabled) {
    console.log('[BG] Parental mode enabled. Checking policies...');
    // Check allow-list first
    if (isInAllowList(url, state.parental.allowList)) {
      console.log('[BG] URL is in allow-list');
      return false;
    }
    
    // Check block-list
    if (isInBlockList(url, state.parental.blockList)) {
      console.log('[BG] URL is in block-list');
      return true;
    }
    
    // Check category policy
    console.log('[BG] Checking category policy. Signals:', signals, 'Categories:', state.parental.categories);
    if (matchesCategoryPolicy(signals, state.parental)) {
      console.log('[BG] Signals match category policy - BLOCKING');
      return true;
    }
    console.log('[BG] Signals do not match category policy');
  }
  
  return false;
}

/**
 * Get block page data
 */
async function getBlockPageData(signals, url, details) {
  const state = await loadState();
  const reasons = getBlockReason(signals);
  
  let blockType = 'parental';
  let lockInfo = null;
  
  if (state.selfLock.active) {
    blockType = 'self-lock';
    const now = Date.now();
    const remaining = Math.max(0, state.selfLock.endsAtEpochMs - now);
    const cooldownRemaining = Math.max(0, state.selfLock.cooldownUntilEpochMs - now);
    
    const earlyUnlockMode = state.selfLock.earlyUnlockMode || 'none';
    lockInfo = {
      endsAt: formatEpochTime(state.selfLock.endsAtEpochMs),
      remainingMs: remaining,
      remainingFormatted: formatDuration(remaining),
      scope: state.selfLock.scope,
      earlyUnlockMode: earlyUnlockMode,
      allowEarlyUnlock: state.selfLock.allowEarlyUnlock,
      canRequestUnlock: earlyUnlockMode === 'phrase' && cooldownRemaining === 0,
      requiresPassword: state.selfLock.requiresPassword,
      cooldownRemaining: cooldownRemaining,
      cooldownRemainingFormatted: formatDuration(cooldownRemaining)
    };
  }
  
  return {
    blockType,
    url,
    reasons,
    details: details || [],
    lockInfo
  };
}

// ============ Content Script Communication ============

/**
 * Handle messages from content scripts
 */
browser.runtime.onMessage.addListener(async (message, sender) => {
  console.log('[BG] *** MESSAGE RECEIVED ***', message.type);
  if (message.type === 'CHECK_BLOCK') {
    console.log('[BG] CHECK_BLOCK received. Signals:', message.signals, 'URL:', sender.url);
    const shouldBlockPage = await shouldBlock(message.signals, sender.url);
    console.log('[BG] shouldBlock result:', shouldBlockPage);
    
    if (shouldBlockPage) {
      const blockData = await getBlockPageData(message.signals, sender.url, message.details);
      console.log('[BG] Blocking page with data:', blockData);
      return { shouldBlock: true, blockData };
    }
    
    console.log('[BG] Page allowed');
    return { shouldBlock: false };
  }
  
  if (message.type === 'GET_STATE') {
    const state = await loadState();
    return { state, managedKeys: state.managedKeys || [], managedLocked: Boolean(state.managedLocked) };
  }

  if (message.type === 'GET_DEBUG_INFO') {
    const manifest = browser.runtime.getManifest();
    const extensionUrl = browser.runtime.getURL('');

    let managedStorage = null;
    let managedError = null;
    try {
      managedStorage = await browser.storage.managed.get(null);
    } catch (err) {
      managedError = err.message || String(err);
    }

    const localResult = await browser.storage.local.get('state');
    const localStorage = localResult.state || null;

    const effectiveState = await loadState();

    return {
      version: manifest.version,
      extensionUrl,
      managedStorage,
      managedError,
      localStorageState: localStorage,
      effectiveState
    };
  }
  
  if (message.type === 'UPDATE_STATE') {
    const state = await loadState();
    console.log('[BG] UPDATE_STATE received, updates:', message.updates);

    // Load current managed policy so we can reapply it after the merge.
    const policy = await loadManagedPolicy();

    // Deep merge for nested objects
    for (const key in message.updates) {
      if (typeof message.updates[key] === 'object' && message.updates[key] !== null && !Array.isArray(message.updates[key])) {
        // Merge nested objects
        state[key] = { ...state[key], ...message.updates[key] };
      } else {
        // Replace primitive values and arrays
        state[key] = message.updates[key];
      }
    }

    // Re-apply managed policy so user-submitted values cannot override it.
    applyManagedPolicy(state, policy);

    console.log('[BG] State after merge:', state);
    await saveState(state);
    console.log('[BG] State saved successfully');
    return { success: true };
  }
  
  if (message.type === 'ACTIVATE_SELF_LOCK') {
    const {
      durationMs,
      earlyUnlockMode,
      requiresPassword,
      passphraseHash,
      cooldownMinutes,
      incrementOnBlock,
      incrementMinutes,
      gameConfig
    } = message;
    const now = Date.now();
    const mono = performance.now();
    const mode = (earlyUnlockMode === 'phrase' || earlyUnlockMode === 'game') ? earlyUnlockMode : 'none';
    
    const state = await loadState();
    
    // Build game state if game mode requested.
    let game = null;
    if (mode === 'game' && gameConfig) {
      const slots = clampInt(gameConfig.slots, 2, 8, 4);
      const colors = clampInt(gameConfig.colors, 3, 10, 6);
      game = {
        slots: slots,
        colors: colors,
        guessDelayMs: Math.max(0, Number(gameConfig.guessDelayMs) || 0),
        maxGuesses: Math.max(1, Math.floor(Number(gameConfig.maxGuesses) || 1)),
        incrementPerGuessMs: Math.max(0, Number(gameConfig.incrementPerGuessMs) || 0),
        incrementOnLossMs: Math.max(0, Number(gameConfig.incrementOnLossMs) || 0),
        secret: generateMastermindSecret(slots, colors),
        guesses: [],
        nextGuessAllowedAtEpochMs: 0,
        puzzleNumber: 1
      };
    }
    
    state.selfLock = {
      ...state.selfLock,
      active: true,
      earlyUnlockMode: mode,
      allowEarlyUnlock: mode !== 'none',
      requiresPassword: mode === 'phrase' ? !!requiresPassword : false,
      passphraseHash: mode === 'phrase' ? (passphraseHash || null) : null,
      cooldownMinutes: cooldownMinutes,
      startedAtEpochMs: now,
      endsAtEpochMs: now + durationMs,
      elapsedMonotonicMsAtStart: mono,
      cooldownUntilEpochMs: 0,
      pendingUnlockPhrase: null,
      pendingUnlockPhraseExpiry: 0,
      incrementOnBlock: incrementOnBlock || false,
      incrementMinutes: incrementMinutes || 5,
      game: game
    };
    await saveState(state);
    
    // Set alarm to check lock status
    await browser.alarms.create('selfLockTick', { periodInMinutes: 1 });
    
    return { success: true };
  }
  
  if (message.type === 'GET_GAME_STATE') {
    const state = await loadState();
    if (!state.selfLock.active || state.selfLock.earlyUnlockMode !== 'game' || !state.selfLock.game) {
      return { active: false };
    }
    const g = state.selfLock.game;
    return {
      active: true,
      slots: g.slots,
      colors: g.colors,
      maxGuesses: g.maxGuesses,
      guessDelayMs: g.guessDelayMs,
      guesses: g.guesses.map(({ colors, correctColor, correctPosition, atEpochMs }) =>
        ({ colors, correctColor, correctPosition, atEpochMs })),
      nextGuessAllowedAtEpochMs: g.nextGuessAllowedAtEpochMs,
      puzzleNumber: g.puzzleNumber,
      guessesRemaining: Math.max(0, g.maxGuesses - g.guesses.length)
    };
  }
  
  if (message.type === 'SUBMIT_GAME_GUESS') {
    const state = await loadState();
    if (!state.selfLock.active) {
      return { success: false, error: 'Self-lock not active' };
    }
    if (state.selfLock.earlyUnlockMode !== 'game' || !state.selfLock.game) {
      return { success: false, error: 'Game mode is not active' };
    }
    const g = state.selfLock.game;
    const guess = Array.isArray(message.guess) ? message.guess.map(n => Math.floor(Number(n))) : null;
    if (!guess || guess.length !== g.slots || guess.some(v => !Number.isInteger(v) || v < 0 || v >= g.colors)) {
      return { success: false, error: 'Invalid guess' };
    }
    const now = Date.now();
    if (now < g.nextGuessAllowedAtEpochMs) {
      return { success: false, error: 'Cool-down between guesses has not elapsed' };
    }
    
    const score = scoreMastermindGuess(g.secret, guess);
    g.guesses.push({
      colors: guess,
      correctColor: score.correctColor,
      correctPosition: score.correctPosition,
      atEpochMs: now
    });
    
    // Apply per-guess increment.
    let incrementAddedMs = 0;
    if (g.incrementPerGuessMs > 0) {
      state.selfLock.endsAtEpochMs += g.incrementPerGuessMs;
      incrementAddedMs += g.incrementPerGuessMs;
    }
    
    // Win: deactivate self-lock.
    if (score.correctPosition === g.slots) {
      state.selfLock.active = false;
      state.selfLock.game = null;
      state.selfLock.cooldownUntilEpochMs = 0;
      await saveState(state);
      await browser.alarms.clear('selfLockTick');
      return { success: true, won: true, incrementAddedMs };
    }
    
    // Set next-guess delay.
    g.nextGuessAllowedAtEpochMs = now + g.guessDelayMs;
    
    // Reset puzzle if max guesses reached.
    let didReset = false;
    if (g.guesses.length >= g.maxGuesses) {
      didReset = true;
      if (g.incrementOnLossMs > 0) {
        state.selfLock.endsAtEpochMs += g.incrementOnLossMs;
        incrementAddedMs += g.incrementOnLossMs;
      }
      g.secret = generateMastermindSecret(g.slots, g.colors);
      g.guesses = [];
      g.puzzleNumber += 1;
      g.nextGuessAllowedAtEpochMs = now + g.guessDelayMs;
    }
    
    await saveState(state);
    
    return {
      success: true,
      won: false,
      reset: didReset,
      incrementAddedMs,
      state: {
        active: true,
        slots: g.slots,
        colors: g.colors,
        maxGuesses: g.maxGuesses,
        guessDelayMs: g.guessDelayMs,
        guesses: g.guesses.map(({ colors, correctColor, correctPosition, atEpochMs }) =>
          ({ colors, correctColor, correctPosition, atEpochMs })),
        nextGuessAllowedAtEpochMs: g.nextGuessAllowedAtEpochMs,
        puzzleNumber: g.puzzleNumber,
        guessesRemaining: Math.max(0, g.maxGuesses - g.guesses.length)
      }
    };
  }
  
  if (message.type === 'REQUEST_EARLY_UNLOCK') {
    const { passphrase } = message;
    const state = await loadState();
    
    if (!state.selfLock.active) {
      return { success: false, error: 'Self-lock not active' };
    }
    
    if (!state.selfLock.allowEarlyUnlock || state.selfLock.earlyUnlockMode !== 'phrase') {
      return { success: false, error: 'Phrase-based early unlock is not enabled for this session' };
    }
    
    if (state.selfLock.requiresPassword) {
      const isValid = await verifyPassphrase(passphrase, state.selfLock.passphraseHash);
      if (!isValid) {
        return { success: false, error: 'Invalid passphrase' };
      }
    }
    
    // Generate unlock phrase and set cool-down
    const unlockPhrase = generateRandomPhrase();
    const now = Date.now();
    const cooldownMs = state.selfLock.cooldownMinutes * 60 * 1000;
    
    state.selfLock.pendingUnlockPhrase = unlockPhrase;
    state.selfLock.pendingUnlockPhraseExpiry = now + (5 * 60 * 1000); // 5 min to type
    state.selfLock.cooldownUntilEpochMs = now + cooldownMs;
    
    await saveState(state);
    
    return { success: true, unlockPhrase, cooldownMs };
  }
  
  if (message.type === 'CONFIRM_UNLOCK') {
    const { phrase } = message;
    const state = await loadState();
    
    if (!state.selfLock.active) {
      return { success: false, error: 'Self-lock not active' };
    }
    
    const now = Date.now();
    
    // Check if phrase is still valid
    if (now > state.selfLock.pendingUnlockPhraseExpiry) {
      return { success: false, error: 'Unlock phrase expired' };
    }
    
    // Check if cool-down has passed
    if (now < state.selfLock.cooldownUntilEpochMs) {
      return { success: false, error: 'Cool-down period not complete' };
    }
    
    // Verify phrase
    if (phrase !== state.selfLock.pendingUnlockPhrase) {
      return { success: false, error: 'Incorrect phrase' };
    }
    
    // Unlock
    state.selfLock.active = false;
    state.selfLock.pendingUnlockPhrase = null;
    state.selfLock.pendingUnlockPhraseExpiry = 0;
    state.selfLock.cooldownUntilEpochMs = 0;
    
    await saveState(state);
    
    return { success: true };
  }
  
  if (message.type === 'SET_SELF_LOCK_PASSPHRASE') {
    const { passphrase } = message;
    const hash = await hashPassphrase(passphrase);
    
    const state = await loadState();
    state.selfLock.passphraseHash = hash;
    await saveState(state);
    
    return { success: true };
  }
  
  if (message.type === 'SET_SETTINGS_PIN') {
    const { pin } = message;
    const hash = await hashPassphrase(pin);
    
    const state = await loadState();
    state.parental.settingsPINHash = hash;
    // Unlock for 5 minutes after setting PIN so user can continue working
    const now = Date.now();
    const unlockDurationMs = 5 * 60 * 1000; // 5 minutes
    state.pinLock.locked = false;
    state.pinLock.unlockedUntilEpochMs = now + unlockDurationMs;
    await saveState(state);
    
    return { success: true, unlockedUntilEpochMs: state.pinLock.unlockedUntilEpochMs };
  }
  
  if (message.type === 'PIN_UNLOCK') {
    const { pin } = message;
    const state = await loadState();
    
    if (!state.parental.settingsPINHash) {
      return { success: false, error: 'No PIN set' };
    }
    
    const isValid = await verifyPassphrase(pin, state.parental.settingsPINHash);
    if (!isValid) {
      return { success: false, error: 'Invalid PIN' };
    }
    
    const now = Date.now();
    const unlockDurationMs = 5 * 60 * 1000; // 5 minutes
    state.pinLock.locked = false;
    state.pinLock.unlockedUntilEpochMs = now + unlockDurationMs;
    await saveState(state);
    
    return { success: true, unlockedUntilEpochMs: state.pinLock.unlockedUntilEpochMs };
  }
  
  if (message.type === 'CHECK_PIN_STATUS') {
    const state = await loadState();
    const now = Date.now();
    
    // Check if unlock has expired
    if (state.pinLock.unlockedUntilEpochMs > 0 && now >= state.pinLock.unlockedUntilEpochMs) {
      state.pinLock.locked = true;
      state.pinLock.unlockedUntilEpochMs = 0;
      await saveState(state);
    }
    
    const hasPIN = !!state.parental.settingsPINHash;
    const isLocked = hasPIN && state.pinLock.locked;
    const remainingMs = Math.max(0, state.pinLock.unlockedUntilEpochMs - now);
    
    return { hasPIN, isLocked, remainingMs };
  }
  
  if (message.type === 'VERIFY_PASSPHRASE') {
    const { passphrase, passType } = message; // passType: 'settings' or 'self-lock'
    const state = await loadState();
    
    const hash = passType === 'settings' 
      ? state.parental.settingsPINHash 
      : state.selfLock.passphraseHash;
    
    if (!hash) {
      return { valid: false };
    }
    
    const valid = await verifyPassphrase(passphrase, hash);
    return { valid };
  }
  
  if (message.type === 'FETCH_POLICY_PAGES') {
    const { urls, originUrl } = message;
    if (!Array.isArray(urls) || urls.length === 0) {
      return { signals: [], details: [] };
    }
    const result = await fetchAndScanPolicyPages(urls, originUrl || sender.url);
    console.log('[BG] FETCH_POLICY_PAGES result:', result);
    return result;
  }

  if (message.type === 'BLOCK_OCCURRED') {
    const state = await loadState();
    
    if (state.selfLock.active && state.selfLock.incrementOnBlock) {
      const incrementMs = state.selfLock.incrementMinutes * 60 * 1000;
      state.selfLock.endsAtEpochMs += incrementMs;
      await saveState(state);
      return { success: true, newEndTime: state.selfLock.endsAtEpochMs };
    }
    
    return { success: false };
  }
  
  if (message.type === 'INJECT_TUMBLR_INTERCEPTOR') {
    console.log('[BG] Injecting Tumblr interceptor into tab', sender.tab.id);
    try {
      await browser.scripting.executeScript({
        target: { tabId: sender.tab.id },
        files: ['tumblr-interceptor.js'],
        world: 'MAIN'
      });
      return { success: true };
    } catch (err) {
      console.error('[BG] Failed to inject Tumblr interceptor:', err);
      return { success: false, error: err.message };
    }
  }

  if (message.type === 'INJECT_REDDIT_INTERCEPTOR') {
    console.log('[BG] Injecting Reddit interceptor into tab', sender.tab.id);
    try {
      await browser.scripting.executeScript({
        target: { tabId: sender.tab.id },
        files: ['reddit-interceptor.js'],
        world: 'MAIN'
      });
      return { success: true };
    } catch (err) {
      console.error('[BG] Failed to inject Reddit interceptor:', err);
      return { success: false, error: err.message };
    }
  }
});

// ============ Alarms ============

/**
 * Handle alarm ticks
 */
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'selfLockTick') {
    const state = await loadState();
    
    if (!state.selfLock.active) {
      await browser.alarms.clear('selfLockTick');
      return;
    }
    
    const now = Date.now();
    
    // Check for clock tamper
    const tamperCheck = checkClockTamper(
      state.selfLock.startedAtEpochMs,
      state.selfLock.elapsedMonotonicMsAtStart
    );
    if (tamperCheck.rolledBack) {
      state.selfLock.endsAtEpochMs += tamperCheck.extendedDuration;
    }
    
    // Check if lock has expired
    if (now >= state.selfLock.endsAtEpochMs) {
      state.selfLock.active = false;
      state.selfLock.pendingUnlockPhrase = null;
      state.selfLock.cooldownUntilEpochMs = 0;
      await browser.alarms.clear('selfLockTick');
    }
    
    await saveState(state);
  }
});

// ============ Initialization ============

/**
 * Initialize extension on install/update
 */
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await initializeState();
    browser.tabs.create({ url: 'options.html' });
  }
  await pruneStaleCache();
});

// Initialize state on startup and prune stale cache entries.
initializeState();
pruneStaleCache();
