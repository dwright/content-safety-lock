/**
 * Options page script for Content Safety Lock
 */

// ============ State Management ============

let currentState = null;
let selectedDuration = null;
let pinLockTimeout = null;
let pinUnlockCheckInterval = null;

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
    
    // Check PIN lock if accessing general tab
    if (tabName === 'general') {
      const pinStatus = await browser.runtime.sendMessage({ type: 'CHECK_PIN_STATUS' });
      if (pinStatus.isLocked) {
        showPINUnlockDialog();
        return;
      }
      // Reset inactivity timer when accessing general tab
      resetPINInactivityTimer();
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
}

/**
 * Save general settings
 */
async function saveGeneralSettings() {
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
        ageVerification: document.getElementById('cat-age-verification').checked
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
    }
  };
  
  await updateState(updates);
  showAlert('general-alerts', 'Settings saved successfully!', 'success');
  resetPINInactivityTimer();
}

document.getElementById('save-settings-btn').addEventListener('click', saveGeneralSettings);

// ============ PIN Management ============

/**
 * Update PIN status display
 */
async function updatePINStatusDisplay() {
  try {
    const pinStatus = await browser.runtime.sendMessage({ type: 'CHECK_PIN_STATUS' });
    const display = document.getElementById('pin-status-display');
    const managementSection = document.getElementById('pin-management-section');
    
    if (!display || !managementSection) {
      console.error('PIN display elements not found');
      return;
    }
  
    if (pinStatus.hasPIN) {
      display.innerHTML = `
        <div class="lock-status" style="border-left-color: #667eea;">
          <div class="lock-status-title">🔐 PIN Protection Enabled</div>
          <p class="help-text">Your settings are protected with a PIN. Click below to change or disable it.</p>
          <button class="btn-secondary" id="manage-pin-btn" style="width: 100%; margin-top: 12px;">Change or Disable PIN</button>
        </div>
      `;
    } else {
      display.innerHTML = `
        <div class="lock-status" style="border-left-color: #999; background: #f0f0f0;">
          <div class="lock-status-title" style="color: #666;">No PIN Set</div>
          <p class="help-text">Set a PIN to protect your settings.</p>
          <button class="btn-secondary" id="set-pin-btn" style="width: 100%; margin-top: 12px;">Set PIN</button>
        </div>
      `;
    }
    
    // Update form based on PIN status
    const currentPinGroup = document.getElementById('current-pin-group');
    const newPinLabel = document.getElementById('new-pin-label');
    const updatePinBtn = document.getElementById('update-pin-btn');
    const newPinInput = document.getElementById('new-pin');
    
    if (pinStatus.hasPIN) {
      currentPinGroup.style.display = 'block';
      newPinLabel.textContent = 'New PIN (leave blank to keep current):';
      newPinInput.placeholder = 'Leave blank to keep unchanged';
      updatePinBtn.textContent = 'Update PIN';
    } else {
      currentPinGroup.style.display = 'none';
      newPinLabel.textContent = 'New PIN:';
      newPinInput.placeholder = 'Enter PIN';
      updatePinBtn.textContent = 'Set PIN';
    }
    
    // Use event delegation for dynamically created buttons
    // Remove old listener if it exists
    const oldListener = display._pinButtonListener;
    if (oldListener) {
      display.removeEventListener('click', oldListener);
    }
    
    const newListener = (e) => {
      if (e.target.id === 'manage-pin-btn' || e.target.id === 'set-pin-btn') {
        managementSection.style.display = 'block';
        if (e.target.id === 'manage-pin-btn') {
          setTimeout(() => document.getElementById('current-pin').focus(), 0);
        } else {
          setTimeout(() => document.getElementById('new-pin').focus(), 0);
        }
      }
    };
    
    display._pinButtonListener = newListener;
    display.addEventListener('click', newListener);
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
        // Show general tab content
        const generalTab = document.getElementById('general');
        if (generalTab) {
          generalTab.style.display = 'block';
        }
        // Switch to general tab
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tab="general"]').classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('general').classList.add('active');
        // Load settings after showing the tab
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
      // Lock the general tab
      const generalTab = document.getElementById('general');
      if (generalTab && generalTab.classList.contains('active')) {
        // Switch to another tab
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tab="self-lock"]').classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('self-lock').classList.add('active');
        showAlert('self-lock-alerts', 'Settings locked due to inactivity', 'info');
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
 * Refresh self-lock status display
 */
async function refreshSelfLockStatus() {
  await loadState();
  
  const panel = document.getElementById('lock-status-panel');
  const activateLockSection = document.getElementById('activate-lock-section');
  
  if (currentState.selfLock.active) {
    const now = Date.now();
    const remaining = Math.max(0, currentState.selfLock.endsAtEpochMs - now);
    
    panel.innerHTML = `
      <div class="lock-status">
        <div class="lock-status-title">🔒 Self-Lock Active</div>
        <div class="lock-status-detail"><strong>Scope:</strong> ${currentState.selfLock.scope}</div>
        <div class="lock-status-detail"><strong>Ends:</strong> ${formatEpochTime(currentState.selfLock.endsAtEpochMs)}</div>
        <div class="lock-status-detail"><strong>Remaining:</strong> ${formatDuration(remaining)}</div>
        <button class="btn-danger" id="disable-lock-btn" style="margin-top: 12px; width: 100%;">Disable Self-Lock</button>
      </div>
    `;
    
    document.getElementById('disable-lock-btn').addEventListener('click', async () => {
      if (confirm('Are you sure you want to disable Self-Lock?')) {
        currentState.selfLock.active = false;
        await updateState({ selfLock: currentState.selfLock });
        refreshSelfLockStatus();
        showAlert('self-lock-alerts', 'Self-Lock disabled', 'info');
      }
    });
    
    // Hide the activate section when self-lock is active
    activateLockSection.style.display = 'none';
  } else {
    panel.innerHTML = `
      <div class="lock-status" style="border-left-color: #999; background: #f0f0f0;">
        <div class="lock-status-title" style="color: #666;">Self-Lock Inactive</div>
        <p class="help-text">No active lock. Configure and activate below.</p>
      </div>
    `;
    
    // Show the activate section when self-lock is inactive
    activateLockSection.style.display = 'block';
  }
  
  // Load lock settings
  document.getElementById('lock-scope').value = currentState.selfLock.scope;
  document.getElementById('lock-ignore-allowlist').checked = currentState.selfLock.ignoreAllowlist;
  document.getElementById('lock-require-password').checked = currentState.selfLock.requiresPassword;
  document.getElementById('lock-cooldown').value = currentState.selfLock.cooldownMinutes * 60 * 1000;
  document.getElementById('lock-increment-on-block').checked = currentState.selfLock.incrementOnBlock;
  document.getElementById('lock-increment-minutes').value = currentState.selfLock.incrementMinutes;
}

/**
 * Setup duration chips
 */
function setupDurationChips() {
  document.querySelectorAll('.duration-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.duration-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedDuration = parseInt(chip.dataset.duration);
      document.getElementById('custom-duration').value = '';
    });
  });
  
  document.getElementById('custom-duration-btn').addEventListener('click', () => {
    const minutes = parseInt(document.getElementById('custom-duration').value);
    if (minutes > 0) {
      selectedDuration = minutes * 60 * 1000;
      document.querySelectorAll('.duration-chips .chip').forEach(c => c.classList.remove('active'));
    }
  });
}

/**
 * Activate self-lock
 */
async function activateSelfLock() {
  if (!selectedDuration) {
    showAlert('self-lock-alerts', 'Please select a duration', 'error');
    return;
  }
  
  if (currentState.selfLock.requiresPassword && !currentState.selfLock.passphraseHash) {
    showAlert('self-lock-alerts', 'Please set a Self-Lock passphrase in the Security tab first', 'error');
    return;
  }
  
  if (confirm(`Activate Self-Lock for ${formatDuration(selectedDuration)}?`)) {
    try {
      await browser.runtime.sendMessage({
        type: 'ACTIVATE_SELF_LOCK',
        durationMs: selectedDuration,
        scope: document.getElementById('lock-scope').value,
        ignoreAllowlist: document.getElementById('lock-ignore-allowlist').checked,
        requiresPassword: document.getElementById('lock-require-password').checked,
        cooldownMinutes: parseInt(document.getElementById('lock-cooldown').value) / (60 * 1000),
        incrementOnBlock: document.getElementById('lock-increment-on-block').checked,
        incrementMinutes: parseInt(document.getElementById('lock-increment-minutes').value)
      });
      
      showAlert('self-lock-alerts', 'Self-Lock activated!', 'success');
      selectedDuration = null;
      document.querySelectorAll('.duration-chips .chip').forEach(c => c.classList.remove('active'));
      document.getElementById('custom-duration').value = '';
      
      setTimeout(() => refreshSelfLockStatus(), 500);
    } catch (err) {
      showAlert('self-lock-alerts', 'Failed to activate Self-Lock', 'error');
      console.error(err);
    }
  }
}

document.getElementById('activate-lock-btn').addEventListener('click', activateSelfLock);

// ============ Security Tab ============

/**
 * Set self-lock passphrase
 */
async function setSelfLockPassphrase() {
  const passphrase = document.getElementById('self-lock-pass').value;
  
  if (!passphrase) {
    showAlert('security-alerts', 'Please enter a passphrase', 'error');
    return;
  }
  
  if (passphrase.length < 6) {
    showAlert('security-alerts', 'Passphrase must be at least 6 characters', 'error');
    return;
  }
  
  try {
    await browser.runtime.sendMessage({
      type: 'SET_SELF_LOCK_PASSPHRASE',
      passphrase
    });
    
    document.getElementById('self-lock-pass').value = '';
    showAlert('security-alerts', 'Self-Lock passphrase set successfully!', 'success');
  } catch (err) {
    showAlert('security-alerts', 'Failed to set passphrase', 'error');
    console.error(err);
  }
}

document.getElementById('set-self-lock-pass-btn').addEventListener('click', setSelfLockPassphrase);

/**
 * Generate recovery codes
 */
async function generateRecoveryCodes() {
  const codes = generateRecoveryCodes(5);
  
  const display = document.getElementById('recovery-codes-display');
  display.innerHTML = `
    <div class="recovery-codes">
      <p class="help-text" style="margin-bottom: 12px;">Save these codes in a safe place. Each can be used once to unlock:</p>
      ${codes.map(code => `<div class="recovery-code">${code}</div>`).join('')}
      <button class="btn-secondary" id="copy-codes-btn" style="width: 100%; margin-top: 12px;">Copy All</button>
    </div>
  `;
  
  document.getElementById('copy-codes-btn').addEventListener('click', () => {
    const text = codes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      showAlert('security-alerts', 'Recovery codes copied to clipboard', 'success');
    });
  });
  
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
  // Check if PIN is set and locked on page load
  const pinStatus = await browser.runtime.sendMessage({ type: 'CHECK_PIN_STATUS' });
  
  if (pinStatus.isLocked) {
    // PIN is set and locked - show unlock dialog and disable general tab access
    showPINUnlockDialog();
    // Hide the general tab content
    const generalTab = document.getElementById('general');
    if (generalTab) {
      generalTab.style.display = 'none';
    }
    // Switch to self-lock tab
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="self-lock"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('self-lock').classList.add('active');
  } else {
    // PIN is not locked, proceed normally
    await loadGeneralSettings();
    setupDurationChips();
    refreshSelfLockStatus();
    await updatePINStatusDisplay();
    resetPINInactivityTimer();
  }
});
