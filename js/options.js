/**
 * Options page script for Content Safety Lock
 */

// ============ State Management ============

let currentState = null;
let managedKeys = [];
let managedLocked = false;
let selectedDuration = null;
let pinLockTimeout = null;
let pinUnlockCheckInterval = null;
let isGeneralTabLocked = false;

// Time interval pickers
let selfLockDurationPicker = null;
let cooldownDurationPicker = null;
let incrementDurationPicker = null;
let gameGuessDelayPicker = null;
let gamePerGuessPicker = null;
let gameOnLossPicker = null;
let autoSaveTimeout = null;

// Active Mastermind board instance (when self-lock is active in game mode)
let activeMastermindBoard = null;

/**
 * Load state from background
 */
async function loadState() {
  const response = await browser.runtime.sendMessage({ type: 'GET_STATE' });
  currentState = response.state;
  managedKeys = response.managedKeys || [];
  managedLocked = Boolean(response.managedLocked);
  applyManagedTabVisibility();
  return currentState;
}

/**
 * Show or hide tabs that should be hidden when managed lock is active.
 */
function applyManagedTabVisibility() {
  document.querySelectorAll('.tab-button[data-managed-hide]').forEach(btn => {
    btn.style.display = managedLocked ? 'none' : '';
  });
}

/**
 * Update state in background
 */
async function updateState(updates) {
  await browser.runtime.sendMessage({
    type: 'UPDATE_STATE',
    updates
  });
  await loadState();
}

// ============ Tab Navigation ============

document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', async () => {
    const tabName = button.dataset.tab;
    
    // Check PIN lock and self-lock if accessing general tab
    if (tabName === 'general') {
      await loadState();
      
      // Admin-managed lock takes priority — no unlock possible
      if (managedLocked) {
        isGeneralTabLocked = true;
      } else if (currentState.selfLock.active) {
        // Self-lock is active
        isGeneralTabLocked = true;
      } else {
        // Otherwise check PIN status
        const pinStatus = await browser.runtime.sendMessage({ type: 'CHECK_PIN_STATUS' });
        if (pinStatus.isLocked) {
          isGeneralTabLocked = true;
        } else {
          isGeneralTabLocked = false;
        }
      }
      
      updateGeneralTabView();
      
      // Only reset inactivity timer if not locked
      if (!isGeneralTabLocked) {
        resetPINInactivityTimer();
      }
    }
    
    // Update active button
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    
    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    
    // Refresh tab content
    if (tabName === 'self-lock') {
      refreshSelfLockStatus();
    }
    if (tabName === 'about') {
      loadAboutTab();
    }
  });
});

// ============ General Tab View Management ============

/**
 * Update general tab view based on PIN lock status
 */
async function updateGeneralTabView() {
  const lockedView = document.getElementById('general-locked-view');
  const editableView = document.getElementById('general-editable-view');
  const lockButtonContainer = document.getElementById('lock-button-container');
  
  if (isGeneralTabLocked) {
    // Show locked view with current settings
    displayLockedSettings();
    lockedView.style.display = 'block';
    editableView.style.display = 'none';
    if (lockButtonContainer) lockButtonContainer.style.display = 'none';
  } else {
    // Show editable view
    lockedView.style.display = 'none';
    editableView.style.display = 'block';
    
    // Show lock button only if PIN is set
    try {
      const pinStatus = await browser.runtime.sendMessage({ type: 'CHECK_PIN_STATUS' });
      if (lockButtonContainer) {
        lockButtonContainer.style.display = pinStatus.hasPIN ? 'block' : 'none';
      }
    } catch (err) {
      console.error('Error checking PIN status:', err);
      if (lockButtonContainer) lockButtonContainer.style.display = 'none';
    }
  }
}

/**
 * Lock general settings manually
 */
function lockGeneralSettings() {
  isGeneralTabLocked = true;
  updateGeneralTabView();
  showAlert('general-alerts', 'Settings locked', 'info');
  
  // Clear the inactivity timer since we're manually locking
  if (pinLockTimeout) {
    clearTimeout(pinLockTimeout);
    pinLockTimeout = null;
  }
}

/**
 * Display current settings in locked view
 */
async function displayLockedSettings() {
  const display = document.getElementById('locked-settings-display');
  const lockedViewText = document.querySelector('#general-locked-view .locked-view-text');
  const unlockBtn = document.getElementById('unlock-general-btn');
  
  if (!display || !currentState) return;
  
  // Update message based on why it's locked
  if (managedLocked) {
    if (lockedViewText) {
      lockedViewText.textContent = 'Settings are managed by an administrator and cannot be changed.';
    }
    if (unlockBtn) {
      unlockBtn.style.display = 'none';
    }
  } else if (currentState.selfLock.active) {
    if (lockedViewText) {
      lockedViewText.textContent = 'Settings are locked because Self-Lock is active. View your current configuration below. Self-Lock must expire before you can make changes.';
    }
    if (unlockBtn) {
      unlockBtn.style.display = 'none'; // Hide unlock button during self-lock
    }
  } else {
    if (lockedViewText) {
      lockedViewText.textContent = 'Your settings are protected by a PIN. View your current configuration below. Click "Unlock Settings" to make changes.';
    }
    if (unlockBtn) {
      unlockBtn.style.display = 'block'; // Show unlock button when only PIN locked
    }
  }
  
  const parental = currentState.parental;
  const safeRequest = currentState.safeRequestMode;
  
  // Build categories list
  const enabledCategories = [];
  if (parental.categories.sexual) enabledCategories.push('Sexual/Nudity');
  if (parental.categories.violence) enabledCategories.push('Violence');
  if (parental.categories.profanity) enabledCategories.push('Profanity');
  if (parental.categories.drugs) enabledCategories.push('Drugs/Alcohol');
  if (parental.categories.gambling) enabledCategories.push('Gambling');
  if (parental.categories.ageVerification) enabledCategories.push('Age Verification');
  if (parental.categories.adultProductSales) {
    const vendors = parental.adultProductSalesVendors;
    const enabledVendors = [];
    if (vendors.etsy) enabledVendors.push('Etsy');
    if (vendors.redbubble) enabledVendors.push('Redbubble');
    if (vendors.teepublic) enabledVendors.push('TeePublic');
    if (vendors.zazzle) enabledVendors.push('Zazzle');
    if (vendors.itchIo) enabledVendors.push('itch.io');
    if (vendors.ebay) enabledVendors.push('eBay');
    if (vendors.amazon) enabledVendors.push('Amazon');
    if (vendors.patreon) enabledVendors.push('Patreon');
    if (vendors.shopify) enabledVendors.push('Shopify');
    enabledCategories.push(`Adult Product Sales (${enabledVendors.length} vendors: ${enabledVendors.join(', ')})`);
  }
  
  // Build provider list
  const enabledProviders = [];
  if (safeRequest.providers.google.enabled) enabledProviders.push('Google');
  if (safeRequest.providers.bing.enabled) enabledProviders.push('Bing');
  if (safeRequest.providers.yahoo.enabled) enabledProviders.push('Yahoo');
  if (safeRequest.providers.ddg.enabled) enabledProviders.push('DuckDuckGo');
  if (safeRequest.providers.youtube.enabled) enabledProviders.push('YouTube');
  if (safeRequest.providers.tumblr?.enabled) enabledProviders.push('Tumblr');
  if (safeRequest.providers.reddit?.enabled) enabledProviders.push('Reddit');
  
  const allowListCount = parental.allowList.length;
  const blockListCount = parental.blockList.length;
  
  // Clear display
  display.textContent = '';
  
  // Helper function to create locked view items
  const createItem = (label, value) => {
    const item = document.createElement('div');
    item.className = 'locked-view-item';
    
    const labelDiv = document.createElement('div');
    labelDiv.className = 'locked-view-item-label';
    labelDiv.textContent = label;
    
    const valueDiv = document.createElement('div');
    valueDiv.className = 'locked-view-item-value';
    valueDiv.textContent = value;
    
    item.appendChild(labelDiv);
    item.appendChild(valueDiv);
    return item;
  };
  
  // Content Filtering
  display.appendChild(createItem('Content Filtering', parental.enabled ? '✓ Enabled' : '✗ Disabled'));
  
  // Blocked Categories (only if filtering enabled)
  if (parental.enabled) {
    display.appendChild(createItem(
      `Blocked Categories (${enabledCategories.length})`,
      enabledCategories.length > 0 ? enabledCategories.join(', ') : 'None'
    ));
  }
  
  // Allow-List
  display.appendChild(createItem(
    'Allow-List (bypasses filtering & safe request)',
    `${allowListCount} domain${allowListCount !== 1 ? 's' : ''}`
  ));
  
  // Block-List
  display.appendChild(createItem(
    'Block-List',
    `${blockListCount} domain${blockListCount !== 1 ? 's' : ''}`
  ));
  
  // Safe Request Mode
  display.appendChild(createItem('Safe Request Mode', safeRequest.enabled ? '✓ Enabled' : '✗ Disabled'));
  
  // Active Providers (only if safe request enabled)
  if (safeRequest.enabled) {
    display.appendChild(createItem(
      `Active Providers (${enabledProviders.length})`,
      enabledProviders.length > 0 ? enabledProviders.join(', ') : 'None'
    ));
  }
}

// ============ General Tab ============

/**
 * Load general settings
 */
async function loadGeneralSettings() {
  await loadState();
  
  document.getElementById('enable-filter').checked = currentState.parental.enabled;
  document.getElementById('cat-sexual').checked = currentState.parental.categories.sexual;
  document.getElementById('cat-violence').checked = currentState.parental.categories.violence;
  document.getElementById('cat-profanity').checked = currentState.parental.categories.profanity;
  document.getElementById('cat-drugs').checked = currentState.parental.categories.drugs;
  document.getElementById('cat-gambling').checked = currentState.parental.categories.gambling;
  document.getElementById('cat-age-verification').checked = currentState.parental.categories.ageVerification;
  document.getElementById('cat-adult-product-sales').checked = currentState.parental.categories.adultProductSales;
  
  // Load vendor settings
  const vendors = currentState.parental.adultProductSalesVendors;
  document.getElementById('vendor-etsy').checked = vendors.etsy;
  document.getElementById('vendor-redbubble').checked = vendors.redbubble;
  document.getElementById('vendor-teepublic').checked = vendors.teepublic;
  document.getElementById('vendor-zazzle').checked = vendors.zazzle;
  document.getElementById('vendor-itch-io').checked = vendors.itchIo;
  document.getElementById('vendor-ebay').checked = vendors.ebay;
  document.getElementById('vendor-amazon').checked = vendors.amazon;
  document.getElementById('vendor-patreon').checked = vendors.patreon;
  document.getElementById('vendor-shopify').checked = vendors.shopify;
  
  document.getElementById('treat-mature').checked = currentState.parental.treatMatureAsAdult;
  
  // Load lists
  const allowListText = currentState.parental.allowList
    .map(item => item.value)
    .join('\n');
  document.getElementById('allow-list').value = allowListText;
  
  const blockListText = currentState.parental.blockList
    .map(item => item.value)
    .join('\n');
  document.getElementById('block-list').value = blockListText;
  
  // Load Safe Request Mode settings
  const config = currentState.safeRequestMode;
  document.getElementById('safe-request-enabled').checked = config.enabled;
  document.getElementById('safe-request-prefer-header').checked = config.addPreferSafeHeader;
  document.getElementById('safe-request-block-downgrade').checked = config.blockUserParamDowngrade;
  document.getElementById('safe-request-frame-enforcement').value = config.perFrameEnforcement;
  document.getElementById('safe-request-private-windows').checked = config.applyInPrivateWindows;
  
  // Load provider settings
  document.getElementById('provider-google-enabled').checked = config.providers.google.enabled;
  document.getElementById('provider-bing-enabled').checked = config.providers.bing.enabled;
  document.getElementById('provider-bing-redirect').checked = config.providers.bing.useRedirect;
  document.getElementById('provider-yahoo-enabled').checked = config.providers.yahoo.enabled;
  document.getElementById('provider-ddg-enabled').checked = config.providers.ddg.enabled;
  document.getElementById('provider-youtube-enabled').checked = config.providers.youtube.enabled;
  document.getElementById('provider-youtube-mode').value = config.providers.youtube.headerMode;
  if (config.providers.tumblr) {
    document.getElementById('provider-tumblr-enabled').checked = config.providers.tumblr.enabled;
  }
  if (config.providers.reddit) {
    document.getElementById('provider-reddit-enabled').checked = config.providers.reddit.enabled;
  }

  // Update collapsible sections based on checkbox states
  updateCollapsibleSections();

  // Apply managed-policy UI state (disables inputs that are admin-controlled)
  applyManagedUIState();
}

/**
 * Map from dotted managed-policy key paths to the DOM element IDs they
 * control on the General tab.  Where a policy key governs a whole sub-object
 * (e.g. 'parental.categories') every child checkbox is covered by its own
 * leaf entry, so the parent entry in this map is intentionally absent.
 */
const MANAGED_KEY_TO_ELEMENT_IDS = {
  'parental.enabled':                          ['enable-filter'],
  'parental.treatMatureAsAdult':               ['treat-mature'],
  'parental.allowList':                        ['allow-list'],
  'parental.blockList':                        ['block-list'],
  'parental.categories.sexual':                ['cat-sexual'],
  'parental.categories.violence':              ['cat-violence'],
  'parental.categories.profanity':             ['cat-profanity'],
  'parental.categories.drugs':                 ['cat-drugs'],
  'parental.categories.gambling':              ['cat-gambling'],
  'parental.categories.ageVerification':       ['cat-age-verification'],
  'parental.categories.adultProductSales':     ['cat-adult-product-sales'],
  'parental.adultProductSalesVendors.etsy':     ['vendor-etsy'],
  'parental.adultProductSalesVendors.redbubble':['vendor-redbubble'],
  'parental.adultProductSalesVendors.teepublic':['vendor-teepublic'],
  'parental.adultProductSalesVendors.zazzle':   ['vendor-zazzle'],
  'parental.adultProductSalesVendors.itchIo':   ['vendor-itch-io'],
  'parental.adultProductSalesVendors.ebay':     ['vendor-ebay'],
  'parental.adultProductSalesVendors.amazon':   ['vendor-amazon'],
  'parental.adultProductSalesVendors.patreon':  ['vendor-patreon'],
  'parental.adultProductSalesVendors.shopify':  ['vendor-shopify'],
  'safeRequestMode.enabled':                   ['safe-request-enabled'],
  'safeRequestMode.addPreferSafeHeader':        ['safe-request-prefer-header'],
  'safeRequestMode.blockUserParamDowngrade':    ['safe-request-block-downgrade'],
  'safeRequestMode.perFrameEnforcement':        ['safe-request-frame-enforcement'],
  'safeRequestMode.applyInPrivateWindows':      ['safe-request-private-windows'],
  'safeRequestMode.providers.google':           ['provider-google-enabled'],
  'safeRequestMode.providers.bing':             ['provider-bing-enabled'],
  'safeRequestMode.providers.bing.useRedirect': ['provider-bing-redirect'],
  'safeRequestMode.providers.yahoo':            ['provider-yahoo-enabled'],
  'safeRequestMode.providers.ddg':              ['provider-ddg-enabled'],
  'safeRequestMode.providers.youtube':          ['provider-youtube-enabled'],
  'safeRequestMode.providers.youtube.headerMode': ['provider-youtube-mode'],
  'safeRequestMode.providers.tumblr':           ['provider-tumblr-enabled'],
  'safeRequestMode.providers.reddit':           ['provider-reddit-enabled']
};

/**
 * Disable all General-tab controls that are governed by managed policy and
 * attach a "Managed" badge next to their label.  Controls not covered by
 * managed policy are left untouched (re-enabled if they were previously
 * disabled by a stale managed state).
 */
function applyManagedUIState() {
  const managedSet = new Set(managedKeys);

  for (const [policyKey, elementIds] of Object.entries(MANAGED_KEY_TO_ELEMENT_IDS)) {
    const isManaged = managedSet.has(policyKey);

    for (const elementId of elementIds) {
      const el = document.getElementById(elementId);
      if (!el) continue;

      if (isManaged) {
        el.disabled = true;
        el.setAttribute('data-managed', 'true');

        // Add badge to the associated label, if not already present.
        const label = el.closest('.checkbox-group, .form-group')
          ?.querySelector(`label[for="${elementId}"], label.checkbox-label`);
        if (label && !label.querySelector('.managed-badge')) {
          const badge = document.createElement('span');
          badge.className = 'managed-badge';
          badge.textContent = 'Managed';
          label.appendChild(badge);
        }
      } else {
        el.disabled = false;
        el.removeAttribute('data-managed');

        // Remove any badge that was previously added.
        const label = el.closest('.checkbox-group, .form-group')
          ?.querySelector(`label[for="${elementId}"], label.checkbox-label`);
        if (label) {
          label.querySelector('.managed-badge')?.remove();
        }
      }
    }
  }
}

/**
 * Save general settings (includes Safe Request settings)
 */
async function saveGeneralSettings(showSuccessMessage = false) {
  // Ensure state is loaded
  if (!currentState) {
    await loadState();
  }
  
  const updates = {
    parental: {
      ...currentState.parental,
      enabled: document.getElementById('enable-filter').checked,
      categories: {
        sexual: document.getElementById('cat-sexual').checked,
        violence: document.getElementById('cat-violence').checked,
        profanity: document.getElementById('cat-profanity').checked,
        drugs: document.getElementById('cat-drugs').checked,
        gambling: document.getElementById('cat-gambling').checked,
        ageVerification: document.getElementById('cat-age-verification').checked,
        adultProductSales: document.getElementById('cat-adult-product-sales').checked
      },
      adultProductSalesVendors: {
        etsy: document.getElementById('vendor-etsy').checked,
        redbubble: document.getElementById('vendor-redbubble').checked,
        teepublic: document.getElementById('vendor-teepublic').checked,
        zazzle: document.getElementById('vendor-zazzle').checked,
        itchIo: document.getElementById('vendor-itch-io').checked,
        ebay: document.getElementById('vendor-ebay').checked,
        amazon: document.getElementById('vendor-amazon').checked,
        patreon: document.getElementById('vendor-patreon').checked,
        shopify: document.getElementById('vendor-shopify').checked
      },
      treatMatureAsAdult: document.getElementById('treat-mature').checked,
      allowList: document.getElementById('allow-list').value
        .split('\n')
        .filter(line => line.trim())
        .map(domain => ({ type: 'domain', value: domain.trim() })),
      blockList: document.getElementById('block-list').value
        .split('\n')
        .filter(line => line.trim())
        .map(domain => ({ type: 'domain', value: domain.trim() }))
    },
    safeRequestMode: {
      ...currentState.safeRequestMode,
      enabled: document.getElementById('safe-request-enabled').checked,
      addPreferSafeHeader: document.getElementById('safe-request-prefer-header').checked,
      blockUserParamDowngrade: document.getElementById('safe-request-block-downgrade').checked,
      perFrameEnforcement: document.getElementById('safe-request-frame-enforcement').value,
      applyInPrivateWindows: document.getElementById('safe-request-private-windows').checked,
      providers: {
        google: {
          ...currentState.safeRequestMode.providers.google,
          enabled: document.getElementById('provider-google-enabled').checked
        },
        bing: {
          ...currentState.safeRequestMode.providers.bing,
          enabled: document.getElementById('provider-bing-enabled').checked,
          useRedirect: document.getElementById('provider-bing-redirect').checked
        },
        yahoo: {
          ...currentState.safeRequestMode.providers.yahoo,
          enabled: document.getElementById('provider-yahoo-enabled').checked
        },
        ddg: {
          ...currentState.safeRequestMode.providers.ddg,
          enabled: document.getElementById('provider-ddg-enabled').checked
        },
        youtube: {
          ...currentState.safeRequestMode.providers.youtube,
          enabled: document.getElementById('provider-youtube-enabled').checked,
          headerMode: document.getElementById('provider-youtube-mode').value
        },
        tumblr: {
          ...(currentState.safeRequestMode.providers.tumblr || {}),
          enabled: document.getElementById('provider-tumblr-enabled').checked
        },
        reddit: {
          ...(currentState.safeRequestMode.providers.reddit || {}),
          enabled: document.getElementById('provider-reddit-enabled').checked
        }
      }
    }
  };
  
  await updateState(updates);
  if (showSuccessMessage) {
    showAlert('general-alerts', 'Settings saved successfully!', 'success');
  }
  resetPINInactivityTimer();
}

/**
 * Auto-save general settings with debounce
 */
function autoSaveGeneralSettings() {
  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  // Set new timeout to save after 500ms of inactivity
  autoSaveTimeout = setTimeout(async () => {
    try {
      await saveGeneralSettings(false);
    } catch (err) {
      console.error('[CSL] Error auto-saving settings:', err);
    }
  }, 500);
}

/**
 * Setup collapsible sections
 */
function setupCollapsibleSections() {
  // Content Categories collapsible
  const contentCategoriesHeader = document.getElementById('content-categories-header');
  if (contentCategoriesHeader) {
    contentCategoriesHeader.addEventListener('click', () => {
      toggleCollapsible('content-categories');
    });
  }
}

/**
 * Toggle collapsible section
 */
function toggleCollapsible(sectionId) {
  const content = document.getElementById(`${sectionId}-content`);
  const toggle = document.querySelector(`#${sectionId}-header .collapsible-toggle`);
  
  if (content && toggle) {
    content.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
  }
}

/**
 * Update collapsible sections based on checkbox states
 */
function updateCollapsibleSections(sourceId) {
  // Content Categories - expand only when filtering is enabled
  // Only adjust this section when called without a specific source (initial load)
  // or when the Enable Content Filtering checkbox itself changes.
  if (!sourceId || sourceId === 'enable-filter') {
    const contentFilterEnabled = document.getElementById('enable-filter').checked;
    const contentCategoriesContent = document.getElementById('content-categories-content');
    const contentCategoriesToggle = document.querySelector('#content-categories-header .collapsible-toggle');
    
    if (contentCategoriesContent && contentCategoriesToggle) {
      if (contentFilterEnabled) {
        contentCategoriesContent.classList.remove('collapsed');
        contentCategoriesToggle.classList.remove('collapsed');
      } else {
        contentCategoriesContent.classList.add('collapsed');
        contentCategoriesToggle.classList.add('collapsed');
      }
    }
  }
  
  // Safe Request Mode details - show only when enabled
  const safeRequestEnabled = document.getElementById('safe-request-enabled').checked;
  const safeRequestDetails = document.getElementById('safe-request-details');
  
  if (safeRequestDetails) {
    safeRequestDetails.style.display = safeRequestEnabled ? 'block' : 'none';
  }
  
  // Adult Product Sales Vendors - show only when category is enabled
  const adultProductSalesEnabled = document.getElementById('cat-adult-product-sales').checked;
  const adultProductSalesVendors = document.getElementById('adult-product-sales-vendors');
  
  if (adultProductSalesVendors) {
    adultProductSalesVendors.style.display = adultProductSalesEnabled ? 'block' : 'none';
  }
}

/**
 * Setup auto-save listeners on all form inputs
 */
function setupAutoSave() {
  const editableView = document.getElementById('general-editable-view');
  if (!editableView) return;
  
  // Attach change listeners to all inputs in the editable view
  const inputs = editableView.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    // Use 'input' event for real-time changes, 'change' for select/checkboxes
    const eventType = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input';
    
    input.addEventListener(eventType, () => {
      // Update collapsible sections if relevant checkboxes changed
      if (input.id === 'enable-filter' || input.id === 'safe-request-enabled' || input.id === 'cat-adult-product-sales') {
        updateCollapsibleSections(input.id);
        
        // When Adult Product Sales is enabled, check all vendor checkboxes by default
        if (input.id === 'cat-adult-product-sales' && input.checked) {
          const vendorCheckboxes = [
            'vendor-etsy', 'vendor-redbubble', 'vendor-teepublic', 'vendor-zazzle',
            'vendor-itch-io', 'vendor-ebay', 'vendor-amazon', 'vendor-patreon', 'vendor-shopify'
          ];
          vendorCheckboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) checkbox.checked = true;
          });
        }
      }
      
      // Auto-save settings
      autoSaveGeneralSettings();
    });
  });
}


// ============ PIN Management ============

/**
 * Update PIN status display
 */
async function updatePINStatusDisplay() {
  try {
    const pinStatus = await browser.runtime.sendMessage({ type: 'CHECK_PIN_STATUS' });
    const display = document.getElementById('pin-status-display');
    const currentPinGroup = document.getElementById('current-pin-group');
    const newPinLabel = document.getElementById('new-pin-label');
    const newPinInput = document.getElementById('new-pin');
    const updatePinBtn = document.getElementById('update-pin-btn');
    const lockButtonContainer = document.getElementById('lock-button-container');
    
    if (pinStatus.hasPIN) {
      display.innerHTML = `
        <div class="pin-status">
          <div class="pin-status-icon">🔒</div>
          <div class="pin-status-text">PIN Protection Enabled</div>
        </div>
        <button class="btn-secondary" id="manage-pin-btn" style="margin-top: 12px;">Change or Remove PIN</button>
      `;
      
      // Show current PIN field when PIN exists
      if (currentPinGroup) currentPinGroup.style.display = 'block';
      if (newPinLabel) newPinLabel.textContent = 'New PIN (leave blank to remove):';
      if (newPinInput) newPinInput.placeholder = 'Leave blank to remove PIN';
      if (updatePinBtn) updatePinBtn.textContent = 'Update PIN';
      
      // Show lock button if general tab is unlocked
      if (lockButtonContainer && !isGeneralTabLocked) {
        lockButtonContainer.style.display = 'block';
      }
    } else {
      display.innerHTML = `
        <div class="pin-status">
          <div class="pin-status-icon">🔓</div>
          <div class="pin-status-text">No PIN Set</div>
        </div>
        <button class="btn-primary" id="manage-pin-btn" style="margin-top: 12px;">Set PIN</button>
      `;
      
      // Hide current PIN field when no PIN exists
      if (currentPinGroup) currentPinGroup.style.display = 'none';
      if (newPinLabel) newPinLabel.textContent = 'New PIN:';
      if (newPinInput) newPinInput.placeholder = 'Enter PIN';
      if (updatePinBtn) updatePinBtn.textContent = 'Set PIN';
      
      // Hide lock button if no PIN is set
      if (lockButtonContainer) {
        lockButtonContainer.style.display = 'none';
      }
    }
    
    // Attach event listener to manage button
    const manageBtn = document.getElementById('manage-pin-btn');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => {
        document.getElementById('pin-management-section').style.display = 'block';
      });
    }
  } catch (err) {
    console.error('Error updating PIN status display:', err);
  }
}

/**
 * Show PIN unlock dialog
 */
function showPINUnlockDialog() {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  dialog.innerHTML = `
    <div style="background: white; border-radius: 12px; padding: 30px; max-width: 400px; width: 90%;">
      <h2 style="margin-bottom: 16px; color: #333;">🔒 Settings Locked</h2>
      <p style="color: #666; margin-bottom: 20px;">Enter your PIN to access settings:</p>
      <input type="password" id="unlock-pin-input" placeholder="Enter PIN" style="width: 100%; padding: 10px 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 16px;">
      <div style="display: flex; gap: 12px;">
        <button id="cancel-unlock-btn" style="flex: 1; padding: 12px 24px; border: none; border-radius: 6px; background: #f0f0f0; color: #333; font-weight: 600; cursor: pointer;">Cancel</button>
        <button id="submit-unlock-btn" style="flex: 1; padding: 12px 24px; border: none; border-radius: 6px; background: #667eea; color: white; font-weight: 600; cursor: pointer;">Unlock</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  const pinInput = document.getElementById('unlock-pin-input');
  const cancelBtn = document.getElementById('cancel-unlock-btn');
  const submitBtn = document.getElementById('submit-unlock-btn');
  
  pinInput.focus();
  
  cancelBtn.addEventListener('click', () => {
    dialog.remove();
  });
  
  submitBtn.addEventListener('click', async () => {
    const pin = pinInput.value;
    if (!pin) {
      alert('Please enter your PIN');
      return;
    }
    
    try {
      const response = await browser.runtime.sendMessage({
        type: 'PIN_UNLOCK',
        pin
      });
      
      if (response.success) {
        dialog.remove();
        // Unlock the general tab
        isGeneralTabLocked = false;
        updateGeneralTabView();
        // Switch to general tab
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tab="general"]').classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('general').classList.add('active');
        // Load settings after unlocking
        await loadGeneralSettings();
        await updatePINStatusDisplay();
        resetPINInactivityTimer();
      } else {
        alert('Invalid PIN');
        pinInput.value = '';
        pinInput.focus();
      }
    } catch (err) {
      alert('Error unlocking settings');
      console.error(err);
    }
  });
  
  pinInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitBtn.click();
    }
  });
}

/**
 * Reset PIN inactivity timer
 */
function resetPINInactivityTimer() {
  if (pinLockTimeout) {
    clearTimeout(pinLockTimeout);
  }
  
  pinLockTimeout = setTimeout(async () => {
    const pinStatus = await browser.runtime.sendMessage({ type: 'CHECK_PIN_STATUS' });
    if (pinStatus.hasPIN) {
      // Lock the general tab view
      const generalTab = document.getElementById('general');
      if (generalTab && generalTab.classList.contains('active')) {
        isGeneralTabLocked = true;
        updateGeneralTabView();
        showAlert('general-alerts', 'Settings locked due to inactivity', 'info');
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Update PIN
 */
async function updatePIN() {
  const currentPinInput = document.getElementById('current-pin');
  const newPin = document.getElementById('new-pin').value;
  const pinStatus = await browser.runtime.sendMessage({ type: 'CHECK_PIN_STATUS' });
  
  // If PIN is already set, verify the current PIN
  if (pinStatus.hasPIN) {
    const currentPin = currentPinInput.value;
    
    if (!currentPin) {
      alert('Please enter your current PIN');
      return;
    }
    
    try {
      // Verify current PIN
      const response = await browser.runtime.sendMessage({
        type: 'VERIFY_PASSPHRASE',
        passphrase: currentPin,
        passType: 'settings'
      });
      
      if (!response.valid) {
        alert('Current PIN is incorrect');
        currentPinInput.value = '';
        currentPinInput.focus();
        return;
      }
    } catch (err) {
      alert('Error verifying PIN');
      console.error(err);
      return;
    }
  }
  
  // Validate new PIN
  if (!newPin) {
    if (pinStatus.hasPIN) {
      // If changing, new PIN is optional (leave blank to keep)
      // Disable PIN
      try {
        await updateState({
          parental: {
            ...currentState.parental,
            settingsPINHash: null
          },
          pinLock: {
            locked: false,
            unlockedUntilEpochMs: 0
          }
        });
        
        showAlert('general-alerts', 'PIN disabled successfully!', 'success');
      } catch (err) {
        alert('Error disabling PIN');
        console.error(err);
        return;
      }
    } else {
      // If setting new PIN, it's required
      alert('Please enter a PIN');
      return;
    }
  } else {
    // Set new PIN
    if (newPin.length < 4) {
      alert('PIN must be at least 4 characters');
      return;
    }
    
    try {
      await browser.runtime.sendMessage({
        type: 'SET_SETTINGS_PIN',
        pin: newPin
      });
      
      const message = pinStatus.hasPIN ? 'PIN changed successfully!' : 'PIN set successfully!';
      showAlert('general-alerts', message, 'success');
    } catch (err) {
      alert('Error setting PIN');
      console.error(err);
      return;
    }
  }
  
  // Clear form and hide management section
  currentPinInput.value = '';
  document.getElementById('new-pin').value = '';
  document.getElementById('pin-management-section').style.display = 'none';
  
  // Update display
  await updatePINStatusDisplay();
}

/**
 * Cancel PIN management
 */
function cancelPINManagement() {
  document.getElementById('current-pin').value = '';
  document.getElementById('new-pin').value = '';
  document.getElementById('pin-management-section').style.display = 'none';
}

document.getElementById('update-pin-btn').addEventListener('click', updatePIN);
document.getElementById('cancel-pin-btn').addEventListener('click', cancelPINManagement);

// ============ Self-Lock Tab ============

/**
 * Disable self-lock with passphrase verification if required
 */
async function disableSelfLock() {
  await loadState();
  
  // Only the phrase-based mode supports manual disable here; game-mode unlocks
  // happen via the Mastermind board, and 'none' has no early unlock at all.
  if (currentState.selfLock.earlyUnlockMode === 'game') {
    showAlert('self-lock-alerts', 'Early unlock requires winning the guessing game.', 'error');
    return;
  }
  if (currentState.selfLock.earlyUnlockMode !== 'phrase') {
    showAlert('self-lock-alerts', 'Early unlock is disabled for this self-lock session.', 'error');
    return;
  }
  
  // Check if password is required
  if (currentState.selfLock.requiresPassword && currentState.selfLock.passphraseHash) {
    // Show passphrase dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    dialog.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-width: 400px; width: 90%;">
        <h3 style="margin: 0 0 20px 0; color: #333;">Unlock Self-Lock Early</h3>
        <p style="margin: 0 0 20px 0; color: #666;">Enter your self-lock passphrase to disable early:</p>
        <input type="password" id="unlock-passphrase" placeholder="Enter passphrase" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 20px;">
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancel-unlock-btn" style="padding: 10px 20px; border: none; background: #999; color: white; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
          <button id="confirm-unlock-btn" style="padding: 10px 20px; border: none; background: #dc3545; color: white; border-radius: 6px; cursor: pointer; font-size: 14px;">Unlock</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const passphraseInput = document.getElementById('unlock-passphrase');
    passphraseInput.focus();
    
    // Handle cancel
    document.getElementById('cancel-unlock-btn').addEventListener('click', () => {
      dialog.remove();
    });
    
    // Handle unlock
    const handleUnlock = async () => {
      const passphrase = passphraseInput.value;
      
      if (!passphrase) {
        alert('Please enter your passphrase');
        passphraseInput.focus();
        return;
      }
      
      try {
        // Verify passphrase
        const hash = await hashPassphrase(passphrase);
        
        if (hash === currentState.selfLock.passphraseHash) {
          // Passphrase correct - disable self-lock
          dialog.remove();
          currentState.selfLock.active = false;
          await updateState({ selfLock: currentState.selfLock });
          await refreshSelfLockStatus();
          showAlert('self-lock-alerts', 'Self-Lock disabled', 'success');
          
          // Unlock general tab if we're on it
          if (document.getElementById('general').classList.contains('active')) {
            isGeneralTabLocked = false;
            await updateGeneralTabView();
          }
        } else {
          alert('Incorrect passphrase');
          passphraseInput.value = '';
          passphraseInput.focus();
        }
      } catch (err) {
        console.error('Error verifying passphrase:', err);
        alert('Error verifying passphrase');
      }
    };
    
    document.getElementById('confirm-unlock-btn').addEventListener('click', handleUnlock);
    
    // Allow Enter key to submit
    passphraseInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleUnlock();
      }
    });
  } else {
    // No password required - just confirm
    if (confirm('Are you sure you want to disable Self-Lock?')) {
      currentState.selfLock.active = false;
      await updateState({ selfLock: currentState.selfLock });
      await refreshSelfLockStatus();
      showAlert('self-lock-alerts', 'Self-Lock disabled', 'info');
      
      // Unlock general tab if we're on it
      if (document.getElementById('general').classList.contains('active')) {
        isGeneralTabLocked = false;
        await updateGeneralTabView();
      }
    }
  }
}

/**
 * Refresh self-lock status display
 */
async function refreshSelfLockStatus() {
  await loadState();
  
  const panel = document.getElementById('lock-status-panel');
  const activateLockSection = document.getElementById('activate-lock-section');
  
  if (currentState.selfLock.active) {
    const now = Date.now();
    const remaining = Math.max(0, currentState.selfLock.endsAtEpochMs - now);
    
    // Clear and build active status
    panel.textContent = '';
    
    const statusDiv = document.createElement('div');
    statusDiv.className = 'lock-status';
    
    const title = document.createElement('div');
    title.className = 'lock-status-title';
    title.textContent = '🔒 Self-Lock Active';
    statusDiv.appendChild(title);
    
    const endsDetail = document.createElement('div');
    endsDetail.className = 'lock-status-detail';
    const endsStrong = document.createElement('strong');
    endsStrong.textContent = 'Ends:';
    endsDetail.appendChild(endsStrong);
    endsDetail.appendChild(document.createTextNode(' ' + formatEpochTime(currentState.selfLock.endsAtEpochMs)));
    statusDiv.appendChild(endsDetail);
    
    const remainingDetail = document.createElement('div');
    remainingDetail.className = 'lock-status-detail';
    const remainingStrong = document.createElement('strong');
    remainingStrong.textContent = 'Remaining:';
    remainingDetail.appendChild(remainingStrong);
    remainingDetail.appendChild(document.createTextNode(' ' + formatDuration(remaining)));
    statusDiv.appendChild(remainingDetail);
    
    const noteDetail = document.createElement('div');
    noteDetail.className = 'lock-status-detail';
    noteDetail.style.marginTop = '8px';
    noteDetail.style.fontStyle = 'italic';
    noteDetail.textContent = 'General settings tab is locked until self-lock expires';
    statusDiv.appendChild(noteDetail);
    
    const disableBtn = document.createElement('button');
    disableBtn.className = 'btn-danger';
    disableBtn.id = 'disable-lock-btn';
    disableBtn.style.marginTop = '12px';
    disableBtn.style.width = '100%';
    disableBtn.textContent = 'Disable Self-Lock';
    
    if (currentState.selfLock.earlyUnlockMode === 'phrase') {
      disableBtn.addEventListener('click', async () => {
        await disableSelfLock();
      });
      statusDiv.appendChild(disableBtn);
    } else if (currentState.selfLock.earlyUnlockMode === 'game') {
      const gameMsg = document.createElement('div');
      gameMsg.style.marginTop = '12px';
      gameMsg.className = 'lock-status-detail';
      gameMsg.textContent = 'Early unlock requires winning the guessing game below.';
      statusDiv.appendChild(gameMsg);
    } else {
      const disabledMsg = document.createElement('div');
      disabledMsg.style.marginTop = '12px';
      disabledMsg.className = 'lock-status-detail';
      disabledMsg.textContent = 'Early unlock is disabled for this session.';
      statusDiv.appendChild(disabledMsg);
    }
    
    panel.appendChild(statusDiv);
    
    // Hide the activate section when self-lock is active
    activateLockSection.style.display = 'none';
  } else {
    // Clear and build inactive status
    panel.textContent = '';
    
    const statusDiv = document.createElement('div');
    statusDiv.className = 'lock-status';
    statusDiv.style.borderLeftColor = '#999';
    statusDiv.style.background = '#f0f0f0';
    
    const title = document.createElement('div');
    title.className = 'lock-status-title';
    title.style.color = '#666';
    title.textContent = 'Self-Lock Inactive';
    statusDiv.appendChild(title);
    
    const helpText = document.createElement('p');
    helpText.className = 'help-text';
    helpText.textContent = 'No active lock. Configure and activate below.';
    statusDiv.appendChild(helpText);
    
    panel.appendChild(statusDiv);
    
    // Show the activate section when self-lock is inactive
    activateLockSection.style.display = 'block';
  }
  
  // Load lock settings into checkboxes / mode selector
  const modeSelect = document.getElementById('early-unlock-mode');
  if (modeSelect) {
    modeSelect.value = currentState.selfLock.earlyUnlockMode || 'none';
  }
  document.getElementById('lock-require-password').checked =
    currentState.selfLock.earlyUnlockMode === 'phrase' && currentState.selfLock.requiresPassword;
  document.getElementById('lock-increment-on-block').checked = currentState.selfLock.incrementOnBlock;
  
  // Load settings into time interval pickers if they exist
  if (cooldownDurationPicker && currentState.selfLock.cooldownMinutes !== undefined) {
    const cooldownValue = fromTotalMinutes(currentState.selfLock.cooldownMinutes, cooldownDurationPicker.config);
    cooldownDurationPicker.setValue(cooldownValue);
  }
  
  if (incrementDurationPicker && currentState.selfLock.incrementMinutes !== undefined) {
    const incrementValue = fromTotalMinutes(currentState.selfLock.incrementMinutes, incrementDurationPicker.config);
    incrementDurationPicker.setValue(incrementValue);
  }
  
  // Toggle conditional sections visibility
  toggleEarlyUnlockSection();
  toggleIncrementSection();
  
  // Render Mastermind board if game mode is active.
  renderActiveGameBoard();
}

/**
 * Render the Mastermind board into the lock-status-panel when self-lock is
 * active in game mode. Tears down any prior instance first.
 */
function renderActiveGameBoard() {
  if (activeMastermindBoard) {
    activeMastermindBoard.destroy();
    activeMastermindBoard = null;
  }
  
  if (!currentState || !currentState.selfLock.active || currentState.selfLock.earlyUnlockMode !== 'game') {
    return;
  }
  
  const panel = document.getElementById('lock-status-panel');
  if (!panel) return;
  
  // Wrapper card for the board
  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-top:12px;';
  
  const heading = document.createElement('div');
  heading.style.cssText = 'font-weight:700;color:#667eea;margin-bottom:8px;';
  heading.textContent = '🎯 Early Unlock — Guessing Game';
  wrap.appendChild(heading);
  
  const help = document.createElement('p');
  help.className = 'help-text';
  help.style.marginBottom = '12px';
  help.textContent = 'Crack the secret color sequence to release the lock early.';
  wrap.appendChild(help);
  
  const boardContainer = document.createElement('div');
  wrap.appendChild(boardContainer);
  
  panel.appendChild(wrap);
  
  activeMastermindBoard = new MastermindBoard(boardContainer, {
    getState: async () => browser.runtime.sendMessage({ type: 'GET_GAME_STATE' }),
    submitGuess: async (guess) => browser.runtime.sendMessage({ type: 'SUBMIT_GAME_GUESS', guess }),
    onWin: async () => {
      showAlert('self-lock-alerts', 'Correct sequence! Self-Lock released.', 'success');
      setTimeout(() => refreshSelfLockStatus(), 800);
    }
  });
}

/**
 * Tier color palette for the difficulty feedback box.
 */
const GAME_DIFFICULTY_STYLES = {
  impossible:  { bg: '#fdecea', border: '#e74c3c', color: '#a93226' },
  grandmaster: { bg: '#fdebd0', border: '#e67e22', color: '#9c640c' },
  expert:      { bg: '#fef9e7', border: '#f1c40f', color: '#7d6608' },
  challenging: { bg: '#eaf6fb', border: '#3498db', color: '#1f618d' },
  casual:      { bg: '#eafaf1', border: '#27ae60', color: '#196f3d' }
};

/**
 * Recompute and display Mastermind difficulty feedback, and update the
 * `max` attribute on the max-guesses input to cap at T + 10.
 */
function updateGameDifficultyFeedback() {
  const slotsEl = document.getElementById('game-slots');
  const colorsEl = document.getElementById('game-colors');
  const maxGuessesEl = document.getElementById('game-max-guesses');
  const feedbackEl = document.getElementById('game-difficulty-feedback');
  if (!slotsEl || !colorsEl || !maxGuessesEl || !feedbackEl) return;
  
  const slots = parseInt(slotsEl.value, 10);
  const colors = parseInt(colorsEl.value, 10);
  const guesses = parseInt(maxGuessesEl.value, 10);
  
  const baseline = calcMastermindDifficulty(slots, colors, null);
  if (baseline.T == null) {
    feedbackEl.style.display = 'none';
    maxGuessesEl.removeAttribute('max');
    return;
  }
  
  // Enforce the T + 10 cap via the input's `max` attribute so the number
  // spinner and native validation honour it as well.
  maxGuessesEl.max = String(baseline.maxRecommended);
  if (Number.isFinite(guesses) && guesses > baseline.maxRecommended) {
    maxGuessesEl.value = String(baseline.maxRecommended);
  }
  
  // Re-read in case we just clamped.
  const effectiveGuesses = parseInt(maxGuessesEl.value, 10);
  const result = calcMastermindDifficulty(slots, colors, effectiveGuesses);
  if (!result.tier) {
    feedbackEl.style.display = 'none';
    return;
  }
  
  const style = GAME_DIFFICULTY_STYLES[result.tier] || GAME_DIFFICULTY_STYLES.challenging;
  feedbackEl.style.display = 'block';
  feedbackEl.style.background = style.bg;
  feedbackEl.style.border = `1px solid ${style.border}`;
  feedbackEl.style.color = style.color;
  feedbackEl.textContent = '';
  
  const title = document.createElement('strong');
  title.textContent = `Difficulty: ${result.label}`;
  feedbackEl.appendChild(title);
  
  const detail = document.createElement('div');
  detail.style.marginTop = '4px';
  detail.textContent =
    `Theoretical minimum guesses for ${slots} slots / ${colors} colors: ${result.T}. ` +
    `Maximum allowed: ${result.maxRecommended} (T + 10). ${result.description}`;
  feedbackEl.appendChild(detail);
}

/**
 * Toggle passphrase section visibility based on mode + require-password checkbox
 */
function togglePassphraseSection() {
  const mode = document.getElementById('early-unlock-mode')?.value || 'none';
  const requirePassword = document.getElementById('lock-require-password').checked;
  const passphraseSection = document.getElementById('passphrase-section');
  
  if (passphraseSection) {
    passphraseSection.style.display = mode === 'phrase' && requirePassword ? 'block' : 'none';
  }
}

/**
 * Toggle early unlock settings visibility based on the chosen mode
 */
function toggleEarlyUnlockSection() {
  const mode = document.getElementById('early-unlock-mode')?.value || 'none';
  const phraseSettings = document.getElementById('phrase-mode-settings');
  const gameSettings = document.getElementById('game-mode-settings');
  const requirePasswordCheckbox = document.getElementById('lock-require-password');
  
  if (phraseSettings) {
    phraseSettings.style.display = mode === 'phrase' ? 'block' : 'none';
  }
  if (gameSettings) {
    gameSettings.style.display = mode === 'game' ? 'block' : 'none';
    if (mode === 'game') {
      updateGameDifficultyFeedback();
    }
  }
  
  if (mode !== 'phrase' && requirePasswordCheckbox) {
    requirePasswordCheckbox.checked = false;
  }
  
  togglePassphraseSection();
}

/**
 * Toggle increment duration picker visibility based on increment checkbox
 */
function toggleIncrementSection() {
  const incrementEnabled = document.getElementById('lock-increment-on-block').checked;
  const incrementSection = document.getElementById('increment-duration-section');
  
  if (incrementSection) {
    incrementSection.style.display = incrementEnabled ? 'block' : 'none';
  }
}

/**
 * Setup time interval pickers
 */
function setupTimeIntervalPickers() {
  // Self-Lock Duration Picker (1 minute to 12 months)
  selfLockDurationPicker = new TimeIntervalPicker(
    document.getElementById('self-lock-duration-picker'),
    {
      defaultValue: { months: 0, weeks: 0, days: 0, hours: 1, minutes: 0 },
      config: {
        minTotalMinutes: 1,
        maxTotalMonths: 12,
        stepBehavior: 'rollover'
      },
      onValidChange: (change) => {
        selectedDuration = change.normalizedMinutes * 60 * 1000; // Convert to milliseconds
      }
    }
  );
  
  // Cooldown Duration Picker (0 minutes to 4 hours)
  cooldownDurationPicker = new TimeIntervalPicker(
    document.getElementById('cooldown-duration-picker'),
    {
      defaultValue: { months: 0, weeks: 0, days: 0, hours: 1, minutes: 0 },
      config: {
        minTotalMinutes: 0,
        maxTotalMinutes: 240, // 4 hours
        stepBehavior: 'rollover'
      }
    }
  );
  
  // Increment Duration Picker (1 minute to 24 hours)
  incrementDurationPicker = new TimeIntervalPicker(
    document.getElementById('increment-duration-picker'),
    {
      defaultValue: { months: 0, weeks: 0, days: 0, hours: 0, minutes: 5 },
      config: {
        minTotalMinutes: 1,
        maxTotalMinutes: 1440, // 24 hours
        stepBehavior: 'rollover'
      }
    }
  );
  
  // Game-mode pickers (only present when game mode is selected, but always
  // initialized so we can read values without null guards).
  const guessDelayContainer = document.getElementById('game-guess-delay-picker');
  if (guessDelayContainer) {
    gameGuessDelayPicker = new TimeIntervalPicker(guessDelayContainer, {
      defaultValue: { months: 0, weeks: 0, days: 0, hours: 0, minutes: 5 },
      config: {
        minTotalMinutes: 0,
        maxTotalMinutes: 1440, // 24 hours
        stepBehavior: 'rollover'
      }
    });
  }
  
  const perGuessContainer = document.getElementById('game-per-guess-picker');
  if (perGuessContainer) {
    gamePerGuessPicker = new TimeIntervalPicker(perGuessContainer, {
      defaultValue: { months: 0, weeks: 0, days: 0, hours: 0, minutes: 0 },
      config: {
        minTotalMinutes: 0,
        maxTotalMinutes: 1440, // 24 hours
        stepBehavior: 'rollover'
      }
    });
  }
  
  const onLossContainer = document.getElementById('game-on-loss-picker');
  if (onLossContainer) {
    gameOnLossPicker = new TimeIntervalPicker(onLossContainer, {
      defaultValue: { months: 0, weeks: 0, days: 0, hours: 1, minutes: 0 },
      config: {
        minTotalMinutes: 0,
        maxTotalMinutes: 60 * 24 * 7, // 1 week
        stepBehavior: 'rollover'
      }
    });
  }
  
  // Initialize visibility of conditional sections and difficulty readout.
  toggleEarlyUnlockSection();
  toggleIncrementSection();
  updateGameDifficultyFeedback();
}

/**
 * Activate self-lock
 */
async function activateSelfLock() {
  // Resolve the duration from the picker directly, falling back to the
  // value last reported via onValidChange. Reading the picker here ensures
  // the default value works even when the user never edits it.
  if (selfLockDurationPicker) {
    const totalMinutes = toTotalMinutes(selfLockDurationPicker.getValue(), selfLockDurationPicker.config);
    if (Number.isFinite(totalMinutes) && totalMinutes > 0) {
      selectedDuration = totalMinutes * 60 * 1000;
    }
  }
  if (!selectedDuration) {
    showAlert('self-lock-alerts', 'Please select a duration', 'error');
    return;
  }
  
  const mode = document.getElementById('early-unlock-mode').value || 'none';
  const requirePassword = mode === 'phrase' && document.getElementById('lock-require-password').checked;
  const passphrase = document.getElementById('self-lock-pass').value;
  
  // If password is required, validate passphrase.
  if (requirePassword) {
    if (!passphrase || passphrase.trim().length === 0) {
      showAlert('self-lock-alerts', 'Please enter a passphrase for early unlock', 'error');
      return;
    }
    if (passphrase.length < 4) {
      showAlert('self-lock-alerts', 'Passphrase must be at least 4 characters', 'error');
      return;
    }
  }
  
  // Validate game-mode config.
  let gameConfig = null;
  if (mode === 'game') {
    const slots = parseInt(document.getElementById('game-slots').value, 10);
    const colors = parseInt(document.getElementById('game-colors').value, 10);
    const maxGuesses = parseInt(document.getElementById('game-max-guesses').value, 10);
    
    if (!Number.isInteger(slots) || slots < 2 || slots > 8) {
      showAlert('self-lock-alerts', 'Number of slots must be between 2 and 8', 'error');
      return;
    }
    if (!Number.isInteger(colors) || colors < 3 || colors > 10) {
      showAlert('self-lock-alerts', 'Number of colors must be between 3 and 10', 'error');
      return;
    }
    if (!Number.isInteger(maxGuesses) || maxGuesses < 1) {
      showAlert('self-lock-alerts', 'Maximum guesses must be at least 1', 'error');
      return;
    }
    const difficulty = calcMastermindDifficulty(slots, colors, maxGuesses);
    if (difficulty.maxRecommended != null && maxGuesses > difficulty.maxRecommended) {
      showAlert('self-lock-alerts',
        `Maximum guesses cannot exceed T + 10 (${difficulty.maxRecommended}) for this configuration.`,
        'error');
      return;
    }
    
    const guessDelayMins = gameGuessDelayPicker
      ? toTotalMinutes(gameGuessDelayPicker.getValue(), gameGuessDelayPicker.config)
      : 5;
    const perGuessMins = gamePerGuessPicker
      ? toTotalMinutes(gamePerGuessPicker.getValue(), gamePerGuessPicker.config)
      : 0;
    const onLossMins = gameOnLossPicker
      ? toTotalMinutes(gameOnLossPicker.getValue(), gameOnLossPicker.config)
      : 0;
    
    gameConfig = {
      slots,
      colors,
      maxGuesses,
      guessDelayMs: guessDelayMins * 60 * 1000,
      incrementPerGuessMs: perGuessMins * 60 * 1000,
      incrementOnLossMs: onLossMins * 60 * 1000
    };
  }
  
  if (confirm(`Activate Self-Lock for ${formatDuration(selectedDuration)}?\n\nThe General settings tab will be locked until the self-lock expires.`)) {
    try {
      // Hash the passphrase if password is required.
      let passphraseHash = null;
      if (requirePassword && passphrase) {
        passphraseHash = await hashPassphrase(passphrase);
      }
      
      // Get values from time interval pickers.
      const cooldownValue = cooldownDurationPicker.getValue();
      const cooldownMinutes = mode === 'phrase'
        ? toTotalMinutes(cooldownValue, cooldownDurationPicker.config)
        : 0;
      
      const incrementValue = incrementDurationPicker.getValue();
      const incrementMinutes = toTotalMinutes(incrementValue, incrementDurationPicker.config);
      
      await browser.runtime.sendMessage({
        type: 'ACTIVATE_SELF_LOCK',
        durationMs: selectedDuration,
        earlyUnlockMode: mode,
        requiresPassword: requirePassword,
        passphraseHash: passphraseHash,
        cooldownMinutes: cooldownMinutes,
        incrementOnBlock: document.getElementById('lock-increment-on-block').checked,
        incrementMinutes: incrementMinutes,
        gameConfig: gameConfig
      });
      
      showAlert('self-lock-alerts', 'Self-Lock activated! General settings tab is now locked.', 'success');
      selectedDuration = null;
      
      // Reset pickers to defaults.
      selfLockDurationPicker.setValue({ months: 0, weeks: 0, days: 0, hours: 1, minutes: 0 });
      document.getElementById('self-lock-pass').value = '';
      
      setTimeout(() => refreshSelfLockStatus(), 500);
    } catch (err) {
      showAlert('self-lock-alerts', 'Failed to activate Self-Lock', 'error');
      console.error(err);
    }
  }
}

document.getElementById('activate-lock-btn').addEventListener('click', activateSelfLock);

// Add listener for require password checkbox to toggle passphrase section
document.getElementById('lock-require-password').addEventListener('change', togglePassphraseSection);

// Add listener for early unlock mode selector to toggle visible config sections
document.getElementById('early-unlock-mode').addEventListener('change', toggleEarlyUnlockSection);

// Add listener for increment checkbox to toggle increment duration section
document.getElementById('lock-increment-on-block').addEventListener('change', toggleIncrementSection);

// Recompute Mastermind difficulty feedback whenever game config changes.
['game-slots', 'game-colors', 'game-max-guesses'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateGameDifficultyFeedback);
});

// ============ About Tab ============

/**
 * Load and display debug information on the About tab.
 */
async function loadAboutTab() {
  const info = await browser.runtime.sendMessage({ type: 'GET_DEBUG_INFO' });

  document.getElementById('about-version-value').textContent = info.version;
  document.getElementById('about-location-value').textContent = info.extensionUrl;

  const managedDump = document.getElementById('about-managed-dump');
  const managedError = document.getElementById('about-managed-error');
  let managedText;

  if (info.managedError) {
    managedError.textContent = 'Error reading managed storage: ' + info.managedError;
    managedError.style.display = 'block';
    managedText = '(error: ' + info.managedError + ')';
    managedDump.textContent = managedText;
  } else if (info.managedStorage === null || Object.keys(info.managedStorage).length === 0) {
    managedError.style.display = 'none';
    managedText = '(no managed policy installed)';
    managedDump.textContent = managedText;
  } else {
    managedError.style.display = 'none';
    managedText = JSON.stringify(info.managedStorage, null, 2);
    managedDump.textContent = managedText;
  }

  const localDump = document.getElementById('about-local-dump');
  const localText = info.localStorageState
    ? JSON.stringify(info.localStorageState, null, 2)
    : '(no local state saved yet)';
  localDump.textContent = localText;

  const effectiveDump = document.getElementById('about-effective-dump');
  const effectiveText = info.effectiveState
    ? JSON.stringify(info.effectiveState, null, 2)
    : '(unavailable)';
  effectiveDump.textContent = effectiveText;

  // Wire toggle (only attach listener once)
  const toggle = document.getElementById('debug-toggle');
  const debugSection = document.getElementById('debug-section');
  if (toggle && !toggle.dataset.wired) {
    toggle.dataset.wired = '1';
    toggle.addEventListener('click', (evt) => {
      evt.preventDefault();
      const visible = debugSection.style.display !== 'none';
      debugSection.style.display = visible ? 'none' : 'block';
      toggle.textContent = (visible ? '\u25b6' : '\u25bc') + (visible ? ' Show debugging information' : ' Hide debugging information');
    });
  }

  // Wire copy button (only attach listener once)
  const copyBtn = document.getElementById('debug-copy-btn');
  if (copyBtn && !copyBtn.dataset.wired) {
    copyBtn.dataset.wired = '1';
    copyBtn.addEventListener('click', async () => {
      const text = [
        'Content Safety Lock — Debug Report',
        '===================================',
        '',
        'Version:        ' + info.version,
        'Install URL:    ' + info.extensionUrl,
        'Extension ID:   content-safety-lock@dwright.org',
        '',
        '--- Managed Storage ---',
        managedText,
        '',
        '--- Local Storage State ---',
        localText,
        '',
        '--- Effective State ---',
        effectiveText,
      ].join('\n');

      try {
        await navigator.clipboard.writeText(text);
        const orig = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = orig; }, 2000);
      } catch (err) {
        copyBtn.textContent = 'Copy failed';
        setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 2000);
      }
    });
  }
}

// ============ Security Tab ============

/**
 * Generate recovery codes
 */
async function generateRecoveryCodes() {
  const codes = generateRecoveryCodes(5);
  
  const display = document.getElementById('recovery-codes-display');
  display.textContent = '';
  
  const container = document.createElement('div');
  container.className = 'recovery-codes';
  
  const helpText = document.createElement('p');
  helpText.className = 'help-text';
  helpText.style.marginBottom = '12px';
  helpText.textContent = 'Save these codes in a safe place. Each can be used once to unlock:';
  container.appendChild(helpText);
  
  codes.forEach(code => {
    const codeDiv = document.createElement('div');
    codeDiv.className = 'recovery-code';
    codeDiv.textContent = code;
    container.appendChild(codeDiv);
  });
  
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-secondary';
  copyBtn.id = 'copy-codes-btn';
  copyBtn.style.width = '100%';
  copyBtn.style.marginTop = '12px';
  copyBtn.textContent = 'Copy All';
  copyBtn.addEventListener('click', () => {
    const text = codes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      showAlert('security-alerts', 'Recovery codes copied to clipboard', 'success');
    });
  });
  container.appendChild(copyBtn);
  
  display.appendChild(container);
  
  // Store hashed codes
  const hashedCodes = await Promise.all(codes.map(code => hashPassphrase(code)));
  currentState.recoveryCodesHash = hashedCodes;
  await updateState({ recoveryCodesHash: hashedCodes });
}

document.getElementById('generate-recovery-btn').addEventListener('click', generateRecoveryCodes);

// ============ Utilities ============

/**
 * Show alert message
 */
function showAlert(containerId, message, type) {
  const container = document.getElementById(containerId);
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  container.innerHTML = '';
  container.appendChild(alert);
  
  setTimeout(() => {
    alert.remove();
  }, 5000);
}

// ============ Initialization ============

document.addEventListener('DOMContentLoaded', async () => {
  // Load state first
  await loadState();
  
  // Check if admin-managed lock, self-lock, or PIN lock applies
  if (managedLocked) {
    // Administrator policy lock — no unlock possible
    isGeneralTabLocked = true;
  } else if (currentState.selfLock.active) {
    // Self-lock is active - general tab is locked
    isGeneralTabLocked = true;
  } else {
    // Check PIN status
    const pinStatus = await browser.runtime.sendMessage({ type: 'CHECK_PIN_STATUS' });
    if (pinStatus.isLocked) {
      // PIN is set and locked - show locked view
      isGeneralTabLocked = true;
    } else {
      // PIN is not locked
      isGeneralTabLocked = false;
    }
  }
  
  // Load general settings (includes Safe Request settings)
  await loadGeneralSettings();
  
  // Update the view based on lock status
  await updateGeneralTabView();
  
  // Setup collapsible sections
  setupCollapsibleSections();
  
  // Setup auto-save listeners
  setupAutoSave();
  
  // Setup other tabs
  setupTimeIntervalPickers();
  refreshSelfLockStatus();
  await updatePINStatusDisplay();
  
  if (!isGeneralTabLocked) {
    resetPINInactivityTimer();
  }
  
  // Attach unlock button listener
  const unlockBtn = document.getElementById('unlock-general-btn');
  if (unlockBtn) {
    unlockBtn.addEventListener('click', () => {
      showPINUnlockDialog();
    });
  }
  
  // Attach lock button listener
  const lockBtn = document.getElementById('lock-general-btn');
  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      lockGeneralSettings();
    });
  }
});
