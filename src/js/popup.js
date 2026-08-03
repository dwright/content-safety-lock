/**
 * Popup script for Content Safety Lock
 */

/**
 * Update lock status display
 */
async function updateLockStatus() {
  try {
    const response = await browserAPI.runtime.sendMessage({ type: 'GET_STATE' });
    const state = response.state;
    
    const statusEl = document.getElementById('lock-status');
    
    if (state.selfLock.active) {
      const now = Date.now();
      const remaining = Math.max(0, state.selfLock.endsAtEpochMs - now);
      
      if (remaining > 0) {
        statusEl.textContent = `🔒 Active (${formatDuration(remaining)} remaining)`;
        statusEl.className = 'status-value active';
      } else {
        statusEl.textContent = '✓ Expired (will auto-disable)';
        statusEl.className = 'status-value';
      }
    } else {
      statusEl.textContent = '○ Inactive';
      statusEl.className = 'status-value inactive';
    }
  } catch (err) {
    console.error('Failed to update lock status:', err);
  }
}

/**
 * Open settings page
 */
document.getElementById('open-settings-btn').addEventListener('click', () => {
  browserAPI.runtime.openOptionsPage();
});

/**
 * Open full options in new tab
 */
document.getElementById('open-options-btn').addEventListener('click', () => {
  browserAPI.tabs.create({ url: browserAPI.runtime.getURL('html/options.html') });
});

// Update status on load and every second
document.addEventListener('DOMContentLoaded', () => {
  updateLockStatus();
  setInterval(updateLockStatus, 1000);
});
