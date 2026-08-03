/**
 * Mastermind Board component for the Self-Lock early-unlock game.
 *
 * Renders an interactive guessing-game board into a container. Calls the
 * provided async submit callback to score guesses (the secret never leaves
 * the background script). Refreshes itself on submit responses or by
 * polling state at a low rate to update the inter-guess countdown.
 *
 * Uses inline styles so it works in both the options page and content
 * script overlays without separate stylesheets.
 *
 * Public constructor:
 *
 *   new MastermindBoard(container, {
 *     getState:    async () => GAME_STATE,
 *     submitGuess: async (guess) => SUBMIT_RESPONSE,
 *     onWin:       () => void   // called once when the user wins
 *   });
 *
 * GAME_STATE shape (returned from background):
 *   {
 *     active:                 boolean,
 *     slots:                  number,
 *     colors:                 number,
 *     maxGuesses:             number,
 *     guessDelayMs:           number,
 *     guesses: [
 *       { colors:[N], correctColor:N, correctPosition:N, atEpochMs:N }
 *     ],
 *     nextGuessAllowedAtEpochMs: number,
 *     puzzleNumber:           number,
 *     guessesRemaining:       number
 *   }
 *
 * SUBMIT_RESPONSE shape:
 *   {
 *     success:               boolean,
 *     error?:                string,
 *     state?:                GAME_STATE,
 *     won?:                  boolean,
 *     reset?:                boolean,
 *     incrementAddedMs?:     number
 *   }
 */

class MastermindBoard {
  constructor(container, options) {
    this.container = container;
    this.getState = options.getState;
    this.submitGuess = options.submitGuess;
    this.onWin = options.onWin || (() => {});
    this.onReset = options.onReset || (() => {});
    this.state = null;
    this.currentGuess = [];
    this.tickInterval = null;
    this.busy = false;
    this.colors = (typeof MASTERMIND_COLORS !== 'undefined') ? MASTERMIND_COLORS : [];
    this.refresh();
  }

  destroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.container) this.container.textContent = '';
  }

  async refresh() {
    try {
      this.state = await this.getState();
    } catch (err) {
      console.error('[Mastermind] Failed to load state:', err);
      return;
    }
    if (!this.state || !this.state.active) {
      this.destroy();
      return;
    }
    if (this.currentGuess.length !== this.state.slots) {
      this.currentGuess = new Array(this.state.slots).fill(null);
    }
    this.render();
    if (!this.tickInterval) {
      this.tickInterval = setInterval(() => this.tick(), 500);
    }
  }

  tick() {
    // Update countdown / submit button state without re-rendering history.
    const submitBtn = this.container.querySelector('[data-mm-submit]');
    const countdown = this.container.querySelector('[data-mm-countdown]');
    if (!submitBtn || !countdown) return;

    const now = Date.now();
    const wait = Math.max(0, (this.state.nextGuessAllowedAtEpochMs || 0) - now);
    const filled = this.currentGuess.every(c => c !== null && c !== undefined);
    const ready = wait === 0 && filled && !this.busy;

    submitBtn.disabled = !ready;
    submitBtn.style.opacity = ready ? '1' : '0.5';
    submitBtn.style.cursor = ready ? 'pointer' : 'not-allowed';

    if (wait > 0) {
      countdown.textContent = `Next guess available in ${formatShortDuration(wait)}`;
      countdown.style.display = 'block';
    } else {
      countdown.style.display = 'none';
    }
  }

  render() {
    const c = this.container;
    c.textContent = '';
    c.style.cssText += ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'margin:0 0 12px 0;font-size:14px;color:#555;';
    const guessesRemaining = Math.max(0, this.state.maxGuesses - this.state.guesses.length);
    header.textContent = `Puzzle #${this.state.puzzleNumber} · ${guessesRemaining} of ${this.state.maxGuesses} guesses remaining`;
    c.appendChild(header);

    // History
    if (this.state.guesses.length > 0) {
      const historyTitle = document.createElement('div');
      historyTitle.style.cssText = 'font-weight:600;margin:0 0 8px 0;font-size:13px;color:#333;';
      historyTitle.textContent = 'History';
      c.appendChild(historyTitle);

      const history = document.createElement('div');
      history.style.cssText = 'background:#f5f5f5;border-radius:6px;padding:10px;margin-bottom:14px;max-height:240px;overflow-y:auto;';
      this.state.guesses.forEach((g, idx) => {
        history.appendChild(this.renderHistoryRow(g, idx + 1));
      });
      c.appendChild(history);
    }

    // Current guess row
    const guessRowLabel = document.createElement('div');
    guessRowLabel.style.cssText = 'font-weight:600;margin:0 0 8px 0;font-size:13px;color:#333;';
    guessRowLabel.textContent = 'Your guess';
    c.appendChild(guessRowLabel);

    const guessRow = document.createElement('div');
    guessRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;';
    for (let i = 0; i < this.state.slots; i++) {
      guessRow.appendChild(this.renderSlot(i));
    }
    c.appendChild(guessRow);

    // Color palette
    const paletteLabel = document.createElement('div');
    paletteLabel.style.cssText = 'font-weight:600;margin:0 0 8px 0;font-size:13px;color:#333;';
    paletteLabel.textContent = 'Color palette';
    c.appendChild(paletteLabel);

    const palette = document.createElement('div');
    palette.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;';
    for (let i = 0; i < this.state.colors; i++) {
      palette.appendChild(this.renderPaletteButton(i));
    }
    c.appendChild(palette);

    // Countdown
    const countdown = document.createElement('div');
    countdown.dataset.mmCountdown = '1';
    countdown.style.cssText = 'font-size:13px;color:#e67e22;font-weight:600;margin-bottom:8px;display:none;';
    c.appendChild(countdown);

    // Status / errors
    const status = document.createElement('div');
    status.dataset.mmStatus = '1';
    status.style.cssText = 'font-size:13px;margin-bottom:8px;min-height:18px;';
    c.appendChild(status);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'padding:10px 16px;border:none;border-radius:6px;background:#f0f0f0;color:#333;font-size:14px;font-weight:600;cursor:pointer;';
    clearBtn.addEventListener('click', () => {
      this.currentGuess = new Array(this.state.slots).fill(null);
      this.updateSlots();
      this.tick();
    });
    btnRow.appendChild(clearBtn);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.dataset.mmSubmit = '1';
    submitBtn.textContent = 'Submit guess';
    submitBtn.style.cssText = 'flex:1;padding:10px 16px;border:none;border-radius:6px;background:#667eea;color:white;font-size:14px;font-weight:600;cursor:pointer;';
    submitBtn.addEventListener('click', () => this.handleSubmit());
    btnRow.appendChild(submitBtn);

    c.appendChild(btnRow);

    this.tick();
  }

  renderHistoryRow(guess, number) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #e6e6e6;';

    const num = document.createElement('div');
    num.textContent = `${number}.`;
    num.style.cssText = 'font-size:12px;color:#888;width:24px;flex-shrink:0;';
    row.appendChild(num);

    const pegs = document.createElement('div');
    pegs.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
    guess.colors.forEach(idx => pegs.appendChild(this.renderPeg(idx, 22)));
    row.appendChild(pegs);

    const feedback = document.createElement('div');
    feedback.style.cssText = 'margin-left:auto;font-size:13px;color:#333;text-align:right;';
    feedback.innerHTML = `<strong>${guess.correctPosition}</strong> in correct position<br><strong>${guess.correctColor}</strong> correct color`;
    row.appendChild(feedback);

    return row;
  }

  renderPeg(colorIdx, size) {
    const peg = document.createElement('div');
    const color = this.colors[colorIdx];
    peg.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color ? color.hex : '#ddd'};display:flex;align-items:center;justify-content:center;color:white;font-size:${Math.max(10, Math.floor(size * 0.5))}px;font-weight:700;text-shadow:0 0 2px rgba(0,0,0,0.6);box-shadow:inset 0 -2px 3px rgba(0,0,0,0.2);`;
    if (color) {
      peg.textContent = color.label;
      peg.title = color.name;
      peg.setAttribute('aria-label', color.name);
    }
    return peg;
  }

  renderSlot(slotIdx) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.dataset.mmSlot = String(slotIdx);
    const colorIdx = this.currentGuess[slotIdx];
    const filled = colorIdx !== null && colorIdx !== undefined;
    const color = filled ? this.colors[colorIdx] : null;
    slot.style.cssText = `width:36px;height:36px;border-radius:50%;border:2px dashed ${filled ? 'transparent' : '#bbb'};background:${color ? color.hex : '#fff'};display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;cursor:pointer;text-shadow:0 0 2px rgba(0,0,0,0.6);padding:0;`;
    slot.setAttribute('aria-label', `Slot ${slotIdx + 1}${color ? ': ' + color.name : ' (empty)'}`);
    if (color) slot.textContent = color.label;
    slot.addEventListener('click', () => {
      this.currentGuess[slotIdx] = null;
      this.updateSlots();
      this.tick();
    });
    return slot;
  }

  renderPaletteButton(colorIdx) {
    const color = this.colors[colorIdx];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = `width:34px;height:34px;border-radius:50%;border:2px solid #fff;background:${color.hex};color:white;font-size:13px;font-weight:700;cursor:pointer;text-shadow:0 0 2px rgba(0,0,0,0.6);box-shadow:0 0 0 1px #ccc;padding:0;`;
    btn.textContent = color.label;
    btn.title = color.name;
    btn.setAttribute('aria-label', `Place ${color.name}`);
    btn.addEventListener('click', () => this.placeColor(colorIdx));
    return btn;
  }

  placeColor(colorIdx) {
    if (!this.state) return;
    const next = this.currentGuess.findIndex(v => v === null || v === undefined);
    if (next === -1) return;
    this.currentGuess[next] = colorIdx;
    this.updateSlots();
    this.tick();
  }

  updateSlots() {
    const slots = this.container.querySelectorAll('[data-mm-slot]');
    slots.forEach((el, idx) => {
      const colorIdx = this.currentGuess[idx];
      const filled = colorIdx !== null && colorIdx !== undefined;
      const color = filled ? this.colors[colorIdx] : null;
      el.style.background = color ? color.hex : '#fff';
      el.style.borderColor = filled ? 'transparent' : '#bbb';
      el.style.borderStyle = filled ? 'solid' : 'dashed';
      el.textContent = color ? color.label : '';
      el.setAttribute('aria-label', `Slot ${idx + 1}${color ? ': ' + color.name : ' (empty)'}`);
    });
  }

  setStatus(text, kind) {
    const status = this.container.querySelector('[data-mm-status]');
    if (!status) return;
    status.textContent = text || '';
    status.style.color = kind === 'error' ? '#e74c3c'
                       : kind === 'success' ? '#27ae60'
                       : '#666';
  }

  async handleSubmit() {
    if (this.busy) return;
    if (!this.state) return;
    if (this.currentGuess.some(v => v === null || v === undefined)) {
      this.setStatus('Fill all slots before submitting.', 'error');
      return;
    }
    if (Date.now() < (this.state.nextGuessAllowedAtEpochMs || 0)) {
      this.setStatus('Wait for the cool-down to finish.', 'error');
      return;
    }
    this.busy = true;
    this.setStatus('Submitting…', 'info');
    let resp;
    try {
      resp = await this.submitGuess(this.currentGuess.slice());
    } catch (err) {
      console.error('[Mastermind] Submit failed:', err);
      this.busy = false;
      this.setStatus('Failed to submit guess.', 'error');
      return;
    }
    this.busy = false;

    if (!resp || !resp.success) {
      this.setStatus(resp && resp.error ? resp.error : 'Guess rejected.', 'error');
      return;
    }

    if (resp.won) {
      this.state = resp.state || this.state;
      this.setStatus('Correct! Self-Lock is being released…', 'success');
      try { this.onWin(); } catch (err) { console.error(err); }
      return;
    }

    this.state = resp.state || this.state;
    this.currentGuess = new Array(this.state.slots).fill(null);

    if (resp.reset) {
      const addedNote = resp.incrementAddedMs > 0
        ? ` ${formatShortDuration(resp.incrementAddedMs)} added to the timer.`
        : '';
      this.setStatus(`Out of guesses — new sequence generated.${addedNote}`, 'error');
      try { this.onReset(); } catch (err) { console.error(err); }
    } else if (resp.incrementAddedMs > 0) {
      this.setStatus(`${formatShortDuration(resp.incrementAddedMs)} added to the timer.`, 'info');
    } else {
      this.setStatus('Try again.', 'info');
    }

    this.render();
  }
}

/**
 * Short duration formatter for countdowns (e.g., "2m 5s", "45s", "3h 12m").
 */
function formatShortDuration(ms) {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

if (typeof window !== 'undefined') {
  window.MastermindBoard = MastermindBoard;
}
