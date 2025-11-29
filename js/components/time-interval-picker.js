/**
 * Time Interval Picker Component
 * A reusable duration selector with months, weeks, days, hours, minutes
 * Follows specification v2 with normalization, validation, and accessibility
 */

// ============ Types & Configuration ============

const DEFAULT_CONFIG = {
  monthsUnitSize: 30,
  locale: 'en-US',
  stepBehavior: 'rollover',
  announceAriaLive: true,
  enableTooltips: true,
  theme: 'auto',
  minTotalMinutes: 1,
  maxTotalMonths: 12,
  maxTotalMinutes: null  // If set, overrides maxTotalMonths
};

const FIELD_BOUNDS = {
  months: { min: 0, max: 12 },
  weeks: { min: 0, max: 52 },
  days: { min: 0, max: 31 },
  hours: { min: 0, max: 23 },
  minutes: { min: 0, max: 59 }
};

const UNIT_LABELS = {
  'en-US': {
    months: 'Months',
    weeks: 'Weeks',
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    compact: { mo: 'mo', wk: 'wk', d: 'd', h: 'h', min: 'min' }
  }
};

// ============ Math & Normalization ============

/**
 * Convert TimeIntervalValue to total minutes
 */
function toTotalMinutes(value, config) {
  const ms = config.monthsUnitSize;
  const totalDays = (value.months * ms) + (value.weeks * 7) + value.days;
  const totalHours = (totalDays * 24) + value.hours;
  return (totalHours * 60) + value.minutes;
}

/**
 * Convert total minutes back to TimeIntervalValue
 */
function fromTotalMinutes(totalMinutes, config) {
  const ms = config.monthsUnitSize;
  let remaining = totalMinutes;
  
  const HOUR = 60;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = ms * DAY;
  
  const months = Math.floor(remaining / MONTH);
  remaining %= MONTH;
  
  const weeks = Math.floor(remaining / WEEK);
  remaining %= WEEK;
  
  const days = Math.floor(remaining / DAY);
  remaining %= DAY;
  
  const hours = Math.floor(remaining / HOUR);
  remaining %= HOUR;
  
  const minutes = remaining;
  
  return { months, weeks, days, hours, minutes };
}

/**
 * Coerce field values to their individual bounds
 */
function coerceFieldBounds(value) {
  return {
    months: Math.max(FIELD_BOUNDS.months.min, Math.min(FIELD_BOUNDS.months.max, value.months)),
    weeks: Math.max(FIELD_BOUNDS.weeks.min, Math.min(FIELD_BOUNDS.weeks.max, value.weeks)),
    days: Math.max(FIELD_BOUNDS.days.min, Math.min(FIELD_BOUNDS.days.max, value.days)),
    hours: Math.max(FIELD_BOUNDS.hours.min, Math.min(FIELD_BOUNDS.hours.max, value.hours)),
    minutes: Math.max(FIELD_BOUNDS.minutes.min, Math.min(FIELD_BOUNDS.minutes.max, value.minutes))
  };
}

/**
 * Rollover excess values to larger units
 */
function rollover(value, config) {
  if (config.stepBehavior !== 'rollover') return value;
  
  const ms = config.monthsUnitSize;
  let { minutes, hours, days, weeks, months } = value;
  
  // Minutes → Hours
  hours += Math.floor(minutes / 60);
  minutes = minutes % 60;
  
  // Hours → Days
  days += Math.floor(hours / 24);
  hours = hours % 24;
  
  // Days → Weeks
  weeks += Math.floor(days / 7);
  days = days % 7;
  
  // Weeks → Days (normalize weeks to days first)
  const daysFromWeeks = weeks * 7;
  days += daysFromWeeks;
  weeks = 0;
  
  // Days → Months
  months += Math.floor(days / ms);
  days = days % ms;
  
  return { months, weeks, days, hours, minutes };
}

/**
 * Clamp total duration to global min/max
 */
function clampToGlobal(value, config) {
  const min = config.minTotalMinutes;
  // Use maxTotalMinutes if provided, otherwise calculate from maxTotalMonths
  const max = config.maxTotalMinutes !== null 
    ? config.maxTotalMinutes 
    : config.maxTotalMonths * config.monthsUnitSize * 24 * 60;
  
  let totalMinutes = toTotalMinutes(value, config);
  
  if (totalMinutes < min) totalMinutes = min;
  // Only clamp to max if max is greater than 0
  if (max > 0 && totalMinutes > max) totalMinutes = max;
  
  return fromTotalMinutes(totalMinutes, config);
}

/**
 * Normalize value through all transformations
 */
function normalize(value, config) {
  let result = { ...value };
  result = coerceFieldBounds(result);
  result = rollover(result, config);
  result = clampToGlobal(result, config);
  return result;
}

/**
 * Generate compact summary string
 */
function summarize(value, locale = 'en-US') {
  const tokens = UNIT_LABELS[locale]?.compact || UNIT_LABELS['en-US'].compact;
  return `${value.months}${tokens.mo} ${value.weeks}${tokens.wk} ${value.days}${tokens.d} ${value.hours}${tokens.h} ${value.minutes}${tokens.min}`;
}

/**
 * Generate verbose summary with proper singular/plural
 */
function summarizeVerbose(value, locale = 'en-US') {
  const parts = [];
  
  if (value.months > 0) {
    parts.push(`${value.months} month${value.months !== 1 ? 's' : ''}`);
  }
  if (value.weeks > 0) {
    parts.push(`${value.weeks} week${value.weeks !== 1 ? 's' : ''}`);
  }
  if (value.days > 0) {
    parts.push(`${value.days} day${value.days !== 1 ? 's' : ''}`);
  }
  if (value.hours > 0) {
    parts.push(`${value.hours} hour${value.hours !== 1 ? 's' : ''}`);
  }
  if (value.minutes > 0) {
    parts.push(`${value.minutes} minute${value.minutes !== 1 ? 's' : ''}`);
  }
  
  return parts.length > 0 ? parts.join(' ') : '0 minutes';
}

/**
 * Validate value and return validity info
 */
function validate(value, config) {
  const totalMinutes = toTotalMinutes(value, config);
  const min = config.minTotalMinutes;
  // Use maxTotalMinutes if provided, otherwise calculate from maxTotalMonths
  const max = config.maxTotalMinutes !== null 
    ? config.maxTotalMinutes 
    : config.maxTotalMonths * config.monthsUnitSize * 24 * 60;
  
  // Only check ALL_ZERO if min is greater than 0
  if (totalMinutes === 0 && min > 0) {
    return { isValid: false, reason: 'ALL_ZERO' };
  }
  if (totalMinutes < min) {
    return { isValid: false, reason: 'BELOW_MIN' };
  }
  if (max > 0 && totalMinutes > max) {
    return { isValid: false, reason: 'ABOVE_MAX' };
  }
  
  // Check field bounds
  for (const field in FIELD_BOUNDS) {
    const bounds = FIELD_BOUNDS[field];
    if (value[field] < bounds.min || value[field] > bounds.max) {
      return { isValid: false, reason: 'FIELD_BOUNDS' };
    }
  }
  
  return { isValid: true };
}

// ============ TimeIntervalPicker Class ============

class TimeIntervalPicker {
  constructor(container, options = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    
    // Use provided defaultValue or fall back to minimum allowed
    if (options.defaultValue) {
      this.value = { ...options.defaultValue };
    } else {
      // Default to minimum allowed duration
      const minMinutes = this.config.minTotalMinutes;
      this.value = fromTotalMinutes(minMinutes, this.config);
    }
    
    this.onChange = options.onChange;
    this.onValidChange = options.onValidChange;
    this.ariaLabel = options.ariaLabel || 'Time interval picker';
    this.ariaDescription = options.ariaDescription || 'Select duration using months, weeks, days, hours, and minutes';
    
    this.debounceTimer = null;
    this.longPressTimer = null;
    this.longPressInterval = null;
    
    this.render();
    this.attachEventListeners();
  }
  
  render() {
    const labels = UNIT_LABELS[this.config.locale] || UNIT_LABELS['en-US'];
    
    // Determine which fields to show based on max constraint
    const visibleFields = this.getVisibleFields();
    
    // Calculate max display text using verbose format
    let maxText = '';
    if (this.config.maxTotalMinutes !== null) {
      const maxValue = fromTotalMinutes(this.config.maxTotalMinutes, this.config);
      maxText = summarizeVerbose(maxValue, this.config.locale);
    } else {
      maxText = `${this.config.maxTotalMonths} month${this.config.maxTotalMonths !== 1 ? 's' : ''}`;
    }
    
    // Clear container
    this.container.textContent = '';
    
    // Create main picker container
    const picker = document.createElement('div');
    picker.className = 'time-interval-picker';
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', this.ariaLabel);
    picker.setAttribute('aria-describedby', 'tip-description');
    
    // Create fields container
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'tip-fields';
    visibleFields.forEach(field => {
      fieldsContainer.appendChild(this.renderFieldElement(field, labels[field]));
    });
    picker.appendChild(fieldsContainer);
    
    // Create summary container
    const summary = document.createElement('div');
    summary.className = 'tip-summary';
    summary.setAttribute('role', 'status');
    summary.setAttribute('aria-live', this.config.announceAriaLive ? 'polite' : 'off');
    
    const summaryLabel = document.createElement('div');
    summaryLabel.className = 'tip-summary-label';
    summaryLabel.textContent = 'Total:';
    summary.appendChild(summaryLabel);
    
    const summaryValue = document.createElement('div');
    summaryValue.className = 'tip-summary-value';
    summaryValue.id = 'tip-summary-value';
    summary.appendChild(summaryValue);
    
    picker.appendChild(summary);
    
    // Create helper container
    const helper = document.createElement('div');
    helper.className = 'tip-helper';
    helper.id = 'tip-helper';
    helper.setAttribute('aria-live', 'polite');
    picker.appendChild(helper);
    
    // Create description container
    const description = document.createElement('div');
    description.className = 'tip-description';
    description.id = 'tip-description';
    description.textContent = `Min: ${this.config.minTotalMinutes} minute${this.config.minTotalMinutes !== 1 ? 's' : ''} • Max: ${maxText}`;
    picker.appendChild(description);
    
    this.container.appendChild(picker);
    this.updateDisplay();
  }
  
  getVisibleFields() {
    // Determine which fields are possible given the max constraint
    const max = this.config.maxTotalMinutes !== null 
      ? this.config.maxTotalMinutes 
      : this.config.maxTotalMonths * this.config.monthsUnitSize * 24 * 60;
    
    const fields = [];
    
    // Always show minutes
    fields.push('minutes');
    
    // Show hours if max >= 60 minutes (1 hour)
    if (max >= 60) {
      fields.unshift('hours');
    }
    
    // Show days if max >= 1440 minutes (24 hours = 1 day)
    if (max >= 1440) {
      fields.unshift('days');
    }
    
    // Show weeks if max >= 10080 minutes (7 days = 1 week)
    if (max >= 10080) {
      fields.unshift('weeks');
    }
    
    // Show months if max >= monthsUnitSize * 1440 (1 month in minutes)
    const monthInMinutes = this.config.monthsUnitSize * 1440;
    if (max >= monthInMinutes) {
      fields.unshift('months');
    }
    
    return fields;
  }
  
  renderFieldElement(field, label) {
    const bounds = this.getEffectiveBounds(field);
    const value = this.value[field];
    
    // Determine if buttons should be disabled
    const isAtMin = value <= bounds.min;
    const isAtMax = value >= bounds.max;
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'tip-field';
    
    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', `tip-${field}`);
    labelEl.className = 'tip-label';
    labelEl.textContent = label;
    fieldDiv.appendChild(labelEl);
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'tip-input-group';
    
    // Up button
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = `tip-stepper tip-stepper-up${isAtMax ? ' tip-stepper-disabled' : ''}`;
    upBtn.setAttribute('data-field', field);
    upBtn.setAttribute('data-action', 'inc');
    upBtn.setAttribute('aria-label', `Increase ${label.toLowerCase()}`);
    upBtn.setAttribute('tabindex', '-1');
    if (isAtMax) upBtn.disabled = true;
    const upIcon = document.createElement('span');
    upIcon.className = 'tip-stepper-icon';
    upIcon.textContent = '▲';
    upBtn.appendChild(upIcon);
    inputGroup.appendChild(upBtn);
    
    // Input
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `tip-${field}`;
    input.className = 'tip-input';
    input.setAttribute('data-field', field);
    input.value = value;
    input.min = bounds.min;
    input.max = bounds.max;
    input.setAttribute('aria-describedby', `tip-bounds-${field}`);
    input.setAttribute('inputmode', 'numeric');
    inputGroup.appendChild(input);
    
    // Down button
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = `tip-stepper tip-stepper-down${isAtMin ? ' tip-stepper-disabled' : ''}`;
    downBtn.setAttribute('data-field', field);
    downBtn.setAttribute('data-action', 'dec');
    downBtn.setAttribute('aria-label', `Decrease ${label.toLowerCase()}`);
    downBtn.setAttribute('tabindex', '-1');
    if (isAtMin) downBtn.disabled = true;
    const downIcon = document.createElement('span');
    downIcon.className = 'tip-stepper-icon';
    downIcon.textContent = '▼';
    downBtn.appendChild(downIcon);
    inputGroup.appendChild(downBtn);
    
    fieldDiv.appendChild(inputGroup);
    
    // Bounds display
    const boundsDiv = document.createElement('div');
    boundsDiv.className = 'tip-bounds';
    boundsDiv.id = `tip-bounds-${field}`;
    boundsDiv.textContent = `${bounds.min}–${bounds.max}`;
    fieldDiv.appendChild(boundsDiv);
    
    return fieldDiv;
  }
  
  getEffectiveBounds(field) {
    // Start with default bounds
    const defaultBounds = FIELD_BOUNDS[field];
    
    // Calculate max based on constraint
    const max = this.config.maxTotalMinutes !== null 
      ? this.config.maxTotalMinutes 
      : this.config.maxTotalMonths * this.config.monthsUnitSize * 24 * 60;
    
    // Determine effective max for this field
    let effectiveMax = defaultBounds.max;
    
    switch(field) {
      case 'minutes':
        effectiveMax = Math.min(59, max);
        break;
      case 'hours':
        effectiveMax = Math.min(23, Math.floor(max / 60));
        break;
      case 'days':
        effectiveMax = Math.min(31, Math.floor(max / 1440));
        break;
      case 'weeks':
        effectiveMax = Math.min(52, Math.floor(max / 10080));
        break;
      case 'months':
        const monthInMinutes = this.config.monthsUnitSize * 1440;
        effectiveMax = Math.min(12, Math.floor(max / monthInMinutes));
        break;
    }
    
    return {
      min: defaultBounds.min,
      max: effectiveMax
    };
  }
  
  attachEventListeners() {
    // Input changes
    this.container.querySelectorAll('.tip-input').forEach(input => {
      input.addEventListener('input', (e) => this.handleInput(e));
      input.addEventListener('blur', (e) => this.handleBlur(e));
      input.addEventListener('keydown', (e) => this.handleKeydown(e));
    });
    
    // Stepper buttons
    this.container.querySelectorAll('.tip-stepper').forEach(button => {
      button.addEventListener('click', (e) => this.handleStepperClick(e));
      button.addEventListener('mousedown', (e) => this.handleStepperMouseDown(e));
      button.addEventListener('mouseup', () => this.handleStepperMouseUp());
      button.addEventListener('mouseleave', () => this.handleStepperMouseUp());
      button.addEventListener('touchstart', (e) => this.handleStepperMouseDown(e));
      button.addEventListener('touchend', () => this.handleStepperMouseUp());
    });
  }
  
  handleInput(e) {
    const field = e.target.dataset.field;
    let value = parseInt(e.target.value) || 0;
    
    // Strip non-digits
    e.target.value = value;
    
    this.value[field] = value;
    this.updateWithDebounce();
  }
  
  handleBlur(e) {
    const field = e.target.dataset.field;
    let value = parseInt(e.target.value) || 0;
    
    // Coerce to bounds
    const bounds = FIELD_BOUNDS[field];
    value = Math.max(bounds.min, Math.min(bounds.max, value));
    
    this.value[field] = value;
    e.target.value = value;
    
    this.update();
  }
  
  handleKeydown(e) {
    const field = e.target.dataset.field;
    const bounds = FIELD_BOUNDS[field];
    let amount = 1;
    
    if (e.shiftKey) amount = 5;
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.increment(field, amount);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.decrement(field, amount);
        break;
      case 'Home':
        e.preventDefault();
        this.setValue(field, bounds.min);
        break;
      case 'End':
        e.preventDefault();
        this.setValue(field, bounds.max);
        break;
    }
  }
  
  handleStepperClick(e) {
    const button = e.currentTarget;
    const field = button.dataset.field;
    const action = button.dataset.action;
    
    // Remove focus from any input fields
    const focusedInput = document.activeElement;
    if (focusedInput && focusedInput.classList.contains('tip-input')) {
      focusedInput.blur();
    }
    
    if (action === 'inc') {
      this.increment(field, 1);
    } else {
      this.decrement(field, 1);
    }
  }
  
  handleStepperMouseDown(e) {
    e.preventDefault();
    const button = e.currentTarget;
    const field = button.dataset.field;
    const action = button.dataset.action;
    
    // Start long-press repeat
    this.longPressTimer = setTimeout(() => {
      let delay = 200;
      this.longPressInterval = setInterval(() => {
        if (action === 'inc') {
          this.increment(field, 1);
        } else {
          this.decrement(field, 1);
        }
        
        // Accelerate
        if (delay > 70) {
          clearInterval(this.longPressInterval);
          delay = Math.max(70, delay - 50);
          this.longPressInterval = setInterval(() => {
            if (action === 'inc') {
              this.increment(field, 1);
            } else {
              this.decrement(field, 1);
            }
          }, delay);
        }
      }, delay);
    }, 500);
  }
  
  handleStepperMouseUp() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.longPressInterval) {
      clearInterval(this.longPressInterval);
      this.longPressInterval = null;
    }
  }
  
  increment(field, amount = 1) {
    this.value[field] += amount;
    this.update();
  }
  
  decrement(field, amount = 1) {
    this.value[field] -= amount;
    this.update();
  }
  
  setValue(field, value) {
    this.value[field] = value;
    this.update();
  }
  
  update() {
    // Normalize value
    this.value = normalize(this.value, this.config);
    
    // Update inputs
    for (const field in this.value) {
      const input = this.container.querySelector(`input.tip-input[data-field="${field}"]`);
      if (input) input.value = this.value[field];
    }
    
    this.updateDisplay();
    this.emitChange();
  }
  
  updateWithDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.update();
    }, 100);
  }
  
  updateDisplay() {
    const summaryEl = this.container.querySelector('#tip-summary-value');
    const helperEl = this.container.querySelector('#tip-helper');
    
    // Update summary with verbose format
    const summary = summarizeVerbose(this.value, this.config.locale);
    summaryEl.textContent = summary;
    
    // Update helper text based on validation
    const validity = validate(this.value, this.config);
    
    if (!validity.isValid) {
      let message = '';
      switch (validity.reason) {
        case 'BELOW_MIN':
          if (this.config.minTotalMinutes === 0) {
            message = 'Minimum is 0 minutes';
          } else {
            message = `Minimum is ${this.config.minTotalMinutes} minute${this.config.minTotalMinutes !== 1 ? 's' : ''}`;
          }
          break;
        case 'ABOVE_MAX':
          message = `Maximum is ${this.config.maxTotalMonths} month${this.config.maxTotalMonths !== 1 ? 's' : ''}`;
          break;
        case 'ALL_ZERO':
          message = `Duration must be at least ${this.config.minTotalMinutes} minute${this.config.minTotalMinutes !== 1 ? 's' : ''}`;
          break;
        case 'FIELD_BOUNDS':
          message = 'Value out of range';
          break;
      }
      
      helperEl.textContent = message;
      helperEl.style.display = 'block';
      
      // Clear after 5 seconds
      setTimeout(() => {
        helperEl.style.display = 'none';
      }, 5000);
    } else {
      helperEl.style.display = 'none';
    }
  }
  
  emitChange() {
    const totalMinutes = toTotalMinutes(this.value, this.config);
    const summary = summarize(this.value, this.config.locale);
    const validity = validate(this.value, this.config);
    
    const change = {
      raw: { ...this.value },
      normalizedMinutes: totalMinutes,
      normalizedCompact: summary,
      validity
    };
    
    if (this.onChange) {
      this.onChange(change);
    }
    
    if (this.onValidChange && validity.isValid) {
      this.onValidChange(change);
    }
  }
  
  getValue() {
    return { ...this.value };
  }
  
  setValue(newValue) {
    this.value = { ...newValue };
    this.update();
  }
  
  destroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    if (this.longPressInterval) clearInterval(this.longPressInterval);
    this.container.innerHTML = '';
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TimeIntervalPicker, toTotalMinutes, fromTotalMinutes };
}
