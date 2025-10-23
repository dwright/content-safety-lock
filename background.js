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
      ageVerification: false
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
    requiresPassword: true,
    cooldownMinutes: 60,
    startedAtEpochMs: 0,
    endsAtEpochMs: 0,
    elapsedMonotonicMsAtStart: 0,
    cooldownUntilEpochMs: 0,
    passphraseHash: null,
    pendingUnlockPhrase: null,
    pendingUnlockPhraseExpiry: 0,
    incrementOnBlock: false,
    incrementMinutes: 5
  },
  recoveryCodesHash: [], // Array of hashed recovery codes
  pinLock: {
    locked: false,
    unlockedUntilEpochMs: 0
  },
  safeRequestMode: {
    enabled: false,
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
      youtube: { enabled: true, headerMode: 'strict', useRestrictHostRedirect: false }
    }
  }
};

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
    parental: { ...DEFAULT_STATE.parental, ...stored.parental },
    selfLock: { ...DEFAULT_STATE.selfLock, ...stored.selfLock },
    pinLock: { ...DEFAULT_STATE.pinLock, ...stored.pinLock },
    safeRequestMode: { ...DEFAULT_STATE.safeRequestMode, ...stored.safeRequestMode }
  };
  
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
async function getBlockPageData(signals, url) {
  const state = await loadState();
  const reasons = getBlockReason(signals);
  
  let blockType = 'parental';
  let lockInfo = null;
  
  if (state.selfLock.active) {
    blockType = 'self-lock';
    const now = Date.now();
    const remaining = Math.max(0, state.selfLock.endsAtEpochMs - now);
    const cooldownRemaining = Math.max(0, state.selfLock.cooldownUntilEpochMs - now);
    
    lockInfo = {
      endsAt: formatEpochTime(state.selfLock.endsAtEpochMs),
      remainingMs: remaining,
      remainingFormatted: formatDuration(remaining),
      scope: state.selfLock.scope,
      canRequestUnlock: state.selfLock.requiresPassword && cooldownRemaining === 0,
      cooldownRemaining: cooldownRemaining,
      cooldownRemainingFormatted: formatDuration(cooldownRemaining)
    };
  }
  
  return {
    blockType,
    url,
    reasons,
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
      const blockData = await getBlockPageData(message.signals, sender.url);
      console.log('[BG] Blocking page with data:', blockData);
      return { shouldBlock: true, blockData };
    }
    
    console.log('[BG] Page allowed');
    return { shouldBlock: false };
  }
  
  if (message.type === 'GET_STATE') {
    const state = await loadState();
    return { state };
  }
  
  if (message.type === 'UPDATE_STATE') {
    const state = await loadState();
    console.log('[BG] UPDATE_STATE received, updates:', message.updates);
    
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
    
    console.log('[BG] State after merge:', state);
    await saveState(state);
    console.log('[BG] State saved successfully');
    return { success: true };
  }
  
  if (message.type === 'ACTIVATE_SELF_LOCK') {
    const { durationMs, requiresPassword, passphraseHash, cooldownMinutes, incrementOnBlock, incrementMinutes } = message;
    const now = Date.now();
    const mono = performance.now();
    
    const state = await loadState();
    state.selfLock = {
      ...state.selfLock,
      active: true,
      requiresPassword,
      passphraseHash: passphraseHash || null,
      cooldownMinutes,
      startedAtEpochMs: now,
      endsAtEpochMs: now + durationMs,
      elapsedMonotonicMsAtStart: mono,
      cooldownUntilEpochMs: 0,
      pendingUnlockPhrase: null,
      pendingUnlockPhraseExpiry: 0,
      incrementOnBlock: incrementOnBlock || false,
      incrementMinutes: incrementMinutes || 5
    };
    await saveState(state);
    
    // Set alarm to check lock status
    await browser.alarms.create('selfLockTick', { periodInMinutes: 1 });
    
    return { success: true };
  }
  
  if (message.type === 'REQUEST_EARLY_UNLOCK') {
    const { passphrase } = message;
    const state = await loadState();
    
    if (!state.selfLock.active) {
      return { success: false, error: 'Self-lock not active' };
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
});

// Initialize state on startup
initializeState();
