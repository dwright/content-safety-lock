/**
 * Options page script for Content Safety Lock
 */

// ============ State Management ============

let currentState = null;
let selectedDuration = null;
let pinLockTimeout = null;
let pinUnlockCheckInterval = null;
let isGeneralTabLocked = false;

// Time interval pickers
let selfLockDurationPicker = null;
let cooldownDurationPicker = null;
let incrementDurationPicker = null;
let autoSaveTimeout = null;

/**
 * Load state from background
 */
async function loadState() {
  const response = await browser.runtime.sendMessage({ type: 'GET_STATE' });
  currentState = response.state;
  return currentState;
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
      
      // If self-lock is active, general tab is always locked
      if (currentState.selfLock.active) {
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
  if (currentState.selfLock.active) {
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
  
  // If early unlock is disabled for this session, do not allow manual disable
  if (!currentState.selfLock.allowEarlyUnlock) {
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
    
    if (currentState.selfLock.allowEarlyUnlock) {
      disableBtn.addEventListener('click', async () => {
        await disableSelfLock();
      });
      statusDiv.appendChild(disableBtn);
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
  
  // Load lock settings into checkboxes
  document.getElementById('allow-early-unlock').checked = currentState.selfLock.allowEarlyUnlock;
  document.getElementById('lock-require-password').checked = currentState.selfLock.allowEarlyUnlock && currentState.selfLock.requiresPassword;
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
}

/**
 * Toggle passphrase section visibility based on require password checkbox
 */
function togglePassphraseSection() {
  const allowEarlyUnlock = document.getElementById('allow-early-unlock')?.checked;
  const requirePassword = document.getElementById('lock-require-password').checked;
  const passphraseSection = document.getElementById('passphrase-section');
  
  if (passphraseSection) {
    passphraseSection.style.display = allowEarlyUnlock && requirePassword ? 'block' : 'none';
  }
}

/**
 * Toggle early unlock settings visibility based on allow early unlock checkbox
 */
function toggleEarlyUnlockSection() {
  const allowEarlyUnlock = document.getElementById('allow-early-unlock')?.checked;
  const earlyUnlockSettings = document.getElementById('early-unlock-settings');
  const requirePasswordCheckbox = document.getElementById('lock-require-password');
  
  if (earlyUnlockSettings) {
    earlyUnlockSettings.style.display = allowEarlyUnlock ? 'block' : 'none';
  }
  
  if (!allowEarlyUnlock && requirePasswordCheckbox) {
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
  
  // Initialize visibility of conditional sections
  toggleEarlyUnlockSection();
  toggleIncrementSection();
}

/**
 * Activate self-lock
 */
async function activateSelfLock() {
  if (!selectedDuration) {
    showAlert('self-lock-alerts', 'Please select a duration', 'error');
    return;
  }
  
  const allowEarlyUnlock = document.getElementById('allow-early-unlock').checked;
  const requirePassword = allowEarlyUnlock && document.getElementById('lock-require-password').checked;
  const passphrase = document.getElementById('self-lock-pass').value;
  
  // If password is required, validate passphrase
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
  
  if (confirm(`Activate Self-Lock for ${formatDuration(selectedDuration)}?\n\nThe General settings tab will be locked until the self-lock expires.`)) {
    try {
      // Hash the passphrase if password is required
      let passphraseHash = null;
      if (requirePassword && passphrase) {
        passphraseHash = await hashPassphrase(passphrase);
      }
      
      // Get values from time interval pickers
      const cooldownValue = cooldownDurationPicker.getValue();
      const cooldownMinutes = allowEarlyUnlock
        ? toTotalMinutes(cooldownValue, cooldownDurationPicker.config)
        : 0;
      
      const incrementValue = incrementDurationPicker.getValue();
      const incrementMinutes = toTotalMinutes(incrementValue, incrementDurationPicker.config);
      
      await browser.runtime.sendMessage({
        type: 'ACTIVATE_SELF_LOCK',
        durationMs: selectedDuration,
        allowEarlyUnlock: allowEarlyUnlock,
        requiresPassword: requirePassword,
        passphraseHash: passphraseHash,
        cooldownMinutes: cooldownMinutes,
        incrementOnBlock: document.getElementById('lock-increment-on-block').checked,
        incrementMinutes: incrementMinutes
      });
      
      showAlert('self-lock-alerts', 'Self-Lock activated! General settings tab is now locked.', 'success');
      selectedDuration = null;
      
      // Reset pickers to defaults
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

// Add listener for allow early unlock checkbox to toggle settings
document.getElementById('allow-early-unlock').addEventListener('change', toggleEarlyUnlockSection);

// Add listener for increment checkbox to toggle increment duration section
document.getElementById('lock-increment-on-block').addEventListener('change', toggleIncrementSection);

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
  
  // Check if self-lock is active or PIN is locked
  if (currentState.selfLock.active) {
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
