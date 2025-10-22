/**
 * Content Script for Content Safety Lock
 * Detects labels and communicates with background worker
 */

// Import utilities
// Note: utils.js functions are available globally since it's loaded before this script

// ============ Label Detection ============

/**
 * Detect age verification elements in DOM
 */
function detectAgeVerificationElements() {
  const ageVerificationKeywords = ['ageverifier', 'ageverification', 'agegate', 'agecheck'];
  
  // Helper function to normalize strings: lowercase and remove non-letter characters
  function normalize(str) {
    // Convert to string in case it's a DOMTokenList or other object
    const strValue = String(str || '');
    return strValue.toLowerCase().replace(/[^a-z]/g, '');
  }
  
  // Normalize keywords for comparison
  const normalizedKeywords = ageVerificationKeywords.map(normalize);
  
  // Regex patterns for common age requirement messages
  const ageRequirementPatterns = [
    /you\s+must\s+be\s+(?:at\s+least\s+)?(?:over\s+)?1[68]\s+(?:years?\s+)?(?:old)?/i,
    /must\s+be\s+1[68]\s+or\s+older/i,
    /only\s+(?:for\s+)?(?:users\s+)?(?:ages?\s+)?1[68]\+/i,
    /restricted\s+to\s+(?:ages?\s+)?1[68]\+/i,
    /18\s+(?:and\s+)?(?:over|older|above)/i,
    /21\s+(?:and\s+)?(?:over|older|above)/i,
    /age\s+(?:gate|verification|check)\s+required/i,
    /confirm\s+you\s+are\s+(?:at\s+least\s+)?1[68]/i
  ];
  
  // Check all elements in the document for ID/class matches
  const allElements = document.querySelectorAll('*');
  for (const element of allElements) {
    const normalizedId = normalize(element.id);
    const normalizedClassName = normalize(element.className);
    
    for (const keyword of normalizedKeywords) {
      if (normalizedId.includes(keyword) || normalizedClassName.includes(keyword)) {
        console.log('[CSL] Found age verification element:', element.tagName, 'id:', element.id, 'class:', element.className);
        return true;
      }
    }
  }
  
  // Check page text content for age requirement patterns
  const bodyText = document.body ? document.body.innerText : '';
  for (const pattern of ageRequirementPatterns) {
    if (pattern.test(bodyText)) {
      console.log('[CSL] Found age requirement text matching pattern:', pattern);
      return true;
    }
  }
  
  return false;
}

/**
 * Parse meta tags from document head
 */
function detectLabels() {
  const head = document.head;
  if (!head) {
    console.log('[CSL] No head element found');
    return [];
  }
  
  const signals = [];
  const raw = {};
  
  // Check rating meta tag (case-insensitive)
  const allMetas = head.querySelectorAll('meta');
  console.log('[CSL] Found', allMetas.length, 'meta tags');
  
  for (const meta of allMetas) {
    const name = (meta.getAttribute('name') || '').toLowerCase();
    const httpEquiv = (meta.getAttribute('http-equiv') || '').toLowerCase();
    const content = (meta.getAttribute('content') || '').toLowerCase();
    
    if (name || httpEquiv) {
      console.log('[CSL] Meta tag - name:', name, 'httpEquiv:', httpEquiv, 'content:', content.substring(0, 50));
    }
    
    // Check for rating meta tag
    if (name === 'rating') {
      raw.rating = content;
      console.log('[CSL] Found rating meta tag:', content);
      
      if (content.includes('adult')) {
        signals.push('GENERIC:adult');
      }
      console.log('[CSL] RTA check - content:', JSON.stringify(content), 'length:', content.length, 'first 3 chars:', JSON.stringify(content.substring(0, 3)), 'startsWith(rta):', content.startsWith('rta'));
      if (content.startsWith('rta')) {
        console.log('[CSL] RTA detected! Adding RTA signal');
        signals.push('RTA');
      } else {
        console.log('[CSL] RTA not detected');
      }
      if (content.includes('mature') || content.includes('restricted') || content.includes('18+')) {
        signals.push('GENERIC:mature');
      }
    }
    
    // Check for PICS-Label meta tag
    if (httpEquiv === 'pics-label') {
      raw.picsLabel = content;
      console.log('[CSL] Found PICS-Label meta tag:', content);
      
      if (content.includes('sexual') || content.includes('nudity')) {
        signals.push('ICRA:sexual');
      }
      if (content.includes('violence')) {
        signals.push('ICRA:violence');
      }
      if (content.includes('profanity') || content.includes('language')) {
        signals.push('ICRA:profanity');
      }
      if (content.includes('drugs') || content.includes('alcohol')) {
        signals.push('ICRA:drugs');
      }
      if (content.includes('gambling')) {
        signals.push('ICRA:gambling');
      }
    }
    
    // Check for age verification meta tags
    if (name === 'age-verification' || name === 'age-gate' || name === 'age-check') {
      raw.ageVerification = content;
      console.log('[CSL] Found age verification meta tag:', content);
      if (content.includes('required') || content.includes('true') || content.includes('blockify')) {
        signals.push('ICRA:ageVerification');
      }
    }
  }
  
  // Check for age verification DOM elements
  if (detectAgeVerificationElements()) {
    signals.push('ICRA:ageVerification');
  }
  
  console.log('[CSL] Detected signals (final):', signals, 'Total signals:', signals.length);
  return signals;
}

/**
 * Create and inject block overlay
 */
function injectBlockOverlay(blockData) {
  // Notify background that a block occurred (for increment feature)
  browser.runtime.sendMessage({
    type: 'BLOCK_OCCURRED'
  }).catch(err => {
    console.log('[CSL] Block notification sent (or not needed):', err);
  });
  
  // Remove any existing overlay
  const existing = document.getElementById('csl-block-overlay');
  if (existing) {
    existing.remove();
  }
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'csl-block-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  `;
  
  // Create content box
  const box = document.createElement('div');
  box.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 40px;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;
  
  // Title
  const title = document.createElement('h1');
  title.textContent = blockData.blockType === 'self-lock' 
    ? '🔒 Blocked by Self-Lock' 
    : '🛡️ Blocked by Content Filter';
  title.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 28px;
    color: #333;
  `;
  box.appendChild(title);
  
  // Reason
  const reason = document.createElement('p');
  reason.textContent = `Reason: ${blockData.reasons.join(', ')}`;
  reason.style.cssText = `
    margin: 0 0 24px 0;
    font-size: 16px;
    color: #666;
  `;
  box.appendChild(reason);
  
  // Lock info (if self-lock)
  if (blockData.lockInfo) {
    const lockInfo = document.createElement('div');
    lockInfo.style.cssText = `
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      margin: 0 0 24px 0;
      text-align: left;
    `;
    
    const lockTitle = document.createElement('p');
    lockTitle.textContent = 'Self-Lock Status';
    lockTitle.style.cssText = `
      margin: 0 0 8px 0;
      font-weight: 600;
      color: #333;
    `;
    lockInfo.appendChild(lockTitle);
    
    const lockDetails = document.createElement('p');
    lockDetails.innerHTML = `
      <strong>Ends:</strong> ${blockData.lockInfo.endsAt}<br>
      <strong>Remaining:</strong> ${blockData.lockInfo.remainingFormatted}
    `;
    lockDetails.style.cssText = `
      margin: 0;
      font-size: 14px;
      color: #666;
      line-height: 1.6;
    `;
    lockInfo.appendChild(lockDetails);
    
    box.appendChild(lockInfo);
    
    // Unlock button (if available)
    if (blockData.lockInfo.canRequestUnlock) {
      const unlockBtn = document.createElement('button');
      unlockBtn.textContent = 'Request Early Unlock';
      unlockBtn.style.cssText = `
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 12px 24px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin: 0 8px 0 0;
        transition: background 0.2s;
      `;
      unlockBtn.onmouseover = () => unlockBtn.style.background = '#5568d3';
      unlockBtn.onmouseout = () => unlockBtn.style.background = '#667eea';
      unlockBtn.onclick = () => showUnlockFlow(blockData);
      box.appendChild(unlockBtn);
    } else if (blockData.lockInfo.cooldownRemaining > 0) {
      const cooldownMsg = document.createElement('p');
      cooldownMsg.textContent = `Cool-down active. Try again in ${blockData.lockInfo.cooldownRemainingFormatted}`;
      cooldownMsg.style.cssText = `
        margin: 0;
        font-size: 14px;
        color: #e74c3c;
        font-weight: 600;
      `;
      box.appendChild(cooldownMsg);
    }
  }
  
  // URL display
  const urlDisplay = document.createElement('p');
  urlDisplay.textContent = `URL: ${blockData.url}`;
  urlDisplay.style.cssText = `
    margin: 24px 0 0 0;
    font-size: 12px;
    color: #999;
    word-break: break-all;
  `;
  box.appendChild(urlDisplay);
  
  overlay.appendChild(box);
  document.documentElement.appendChild(overlay);
  
  // Block all interactions
  document.documentElement.style.overflow = 'hidden';
}

/**
 * Show unlock flow with passphrase and phrase verification
 */
function showUnlockFlow(blockData) {
  const overlay = document.getElementById('csl-block-overlay');
  if (!overlay) return;
  
  const box = overlay.querySelector('div');
  box.innerHTML = '';
  
  // Title
  const title = document.createElement('h2');
  title.textContent = 'Request Early Unlock';
  title.style.cssText = `
    margin: 0 0 24px 0;
    font-size: 24px;
    color: #333;
  `;
  box.appendChild(title);
  
  // Step 1: Passphrase
  const step1 = document.createElement('div');
  step1.id = 'unlock-step-1';
  step1.style.cssText = 'margin-bottom: 24px;';
  
  const passLabel = document.createElement('label');
  passLabel.textContent = 'Enter Self-Lock Passphrase:';
  passLabel.style.cssText = `
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
    text-align: left;
  `;
  step1.appendChild(passLabel);
  
  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.placeholder = 'Passphrase';
  passInput.style.cssText = `
    width: 100%;
    padding: 10px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    box-sizing: border-box;
    margin-bottom: 12px;
  `;
  step1.appendChild(passInput);
  
  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Next';
  submitBtn.style.cssText = `
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
  `;
  step1.appendChild(submitBtn);
  
  box.appendChild(step1);
  
  submitBtn.onclick = async () => {
    const passphrase = passInput.value;
    if (!passphrase) {
      passInput.style.borderColor = '#e74c3c';
      return;
    }
    
    try {
      const response = await browser.runtime.sendMessage({
        type: 'REQUEST_EARLY_UNLOCK',
        passphrase
      });
      
      if (response.success) {
        showPhraseVerification(box, response.unlockPhrase, response.cooldownMs, blockData);
      } else {
        passInput.style.borderColor = '#e74c3c';
        const error = document.createElement('p');
        error.textContent = response.error || 'Invalid passphrase';
        error.style.cssText = 'color: #e74c3c; font-size: 14px; margin-top: 8px;';
        step1.appendChild(error);
      }
    } catch (err) {
      console.error('Unlock request failed:', err);
    }
  };
}

/**
 * Show phrase verification step
 */
function showPhraseVerification(box, unlockPhrase, cooldownMs, blockData) {
  box.innerHTML = '';
  
  // Title
  const title = document.createElement('h2');
  title.textContent = 'Verify Unlock Phrase';
  title.style.cssText = `
    margin: 0 0 24px 0;
    font-size: 24px;
    color: #333;
  `;
  box.appendChild(title);
  
  // Instructions
  const instructions = document.createElement('p');
  instructions.textContent = `Type the phrase below to confirm. Cool-down will begin for ${Math.round(cooldownMs / 60000)} minutes.`;
  instructions.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 14px;
    color: #666;
  `;
  box.appendChild(instructions);
  
  // Phrase display
  const phraseDisplay = document.createElement('div');
  phraseDisplay.style.cssText = `
    background: #f5f5f5;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;
    font-family: monospace;
    font-size: 16px;
    font-weight: 600;
    color: #333;
    letter-spacing: 2px;
  `;
  phraseDisplay.textContent = unlockPhrase;
  box.appendChild(phraseDisplay);
  
  // Input
  const phraseInput = document.createElement('input');
  phraseInput.type = 'text';
  phraseInput.placeholder = 'Type the phrase here';
  phraseInput.style.cssText = `
    width: 100%;
    padding: 10px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    box-sizing: border-box;
    margin-bottom: 12px;
    font-family: monospace;
  `;
  box.appendChild(phraseInput);
  
  // Confirm button
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirm Unlock';
  confirmBtn.style.cssText = `
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
  `;
  box.appendChild(confirmBtn);
  
  confirmBtn.onclick = async () => {
    const phrase = phraseInput.value;
    if (phrase !== unlockPhrase) {
      phraseInput.style.borderColor = '#e74c3c';
      return;
    }
    
    try {
      const response = await browser.runtime.sendMessage({
        type: 'CONFIRM_UNLOCK',
        phrase
      });
      
      if (response.success) {
        // Reload page
        location.reload();
      } else {
        phraseInput.style.borderColor = '#e74c3c';
        const error = document.createElement('p');
        error.textContent = response.error || 'Unlock failed';
        error.style.cssText = 'color: #e74c3c; font-size: 14px; margin-top: 8px;';
        box.appendChild(error);
      }
    } catch (err) {
      console.error('Unlock confirmation failed:', err);
    }
  };
}

/**
 * Check if page should be blocked and inject overlay if needed
 */
async function checkAndBlock() {
  console.log('[CSL] *** checkAndBlock() CALLED ***');
  // Don't block the extension's own pages
  if (location.protocol === 'moz-extension:') {
    console.log('[CSL] Skipping extension page');
    return;
  }
  
  console.log('[CSL] *** About to call detectLabels() ***');
  const signals = detectLabels();
  console.log('[CSL] checkAndBlock - signals:', signals);
  
  if (signals.length > 0) {
    try {
      console.log('[CSL] Sending CHECK_BLOCK message with signals:', signals);
      console.log('[CSL] *** ABOUT TO SEND MESSAGE TO BACKGROUND ***');
      const response = await browser.runtime.sendMessage({
        type: 'CHECK_BLOCK',
        signals
      });
      
      console.log('[CSL] *** RESPONSE RECEIVED FROM BACKGROUND ***', response);
      console.log('[CSL] Response from background:', response);
      
      if (response.shouldBlock) {
        console.log('[CSL] *** BLOCKING PAGE ***');
        console.log('[CSL] Blocking page - injecting overlay');
        injectBlockOverlay(response.blockData);
      } else {
        console.log('[CSL] *** PAGE ALLOWED ***');
        console.log('[CSL] Page allowed - no block');
      }
    } catch (err) {
      console.error('[CSL] *** BLOCK CHECK FAILED ***', err);
      console.error('[CSL] Block check failed:', err);
    }
  } else {
    console.log('[CSL] No signals detected - page allowed');
  }
}

/**
 * Watch for dynamic meta tag injection
 */
function watchForDynamicLabels() {
  let checkTimeout;
  
  const observer = new MutationObserver(() => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => {
      checkAndBlock();
    }, 100);
  });
  
  // Watch head for 5 seconds
  if (document.head) {
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content']
    });
    
    setTimeout(() => {
      observer.disconnect();
    }, 5000);
  }
}

// ============ Initialization ============

// Run check at document_start
console.log('[CSL] Content script loaded for:', window.location.href);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[CSL] DOMContentLoaded - checking for labels');
    checkAndBlock();
    watchForDynamicLabels();
  });
} else {
  console.log('[CSL] Document already loaded - checking for labels');
  checkAndBlock();
  watchForDynamicLabels();
}
