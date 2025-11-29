# Time Interval Picker - Integration Guide

## Overview

A reusable, accessible time interval selector component that allows users to select durations using months, weeks, days, hours, and minutes with real-time normalization and validation.

## Files

- `time-interval-picker.js` - Core component logic
- `time-interval-picker.css` - Responsive styles
- `time-interval-picker-demo.html` - Demo and examples

## Features

✅ **Normalization**: Automatic rollover (60 min → 1 hour, etc.)  
✅ **Validation**: Min/max constraints with helpful error messages  
✅ **Accessibility**: ARIA labels, keyboard navigation, screen reader support  
✅ **Responsive**: Mobile-friendly with touch-optimized controls  
✅ **Themeable**: Auto dark mode support  
✅ **Real-time**: Instant updates with debouncing  

## Basic Usage

### 1. Include Files

```html
<link rel="stylesheet" href="time-interval-picker.css">
<script src="time-interval-picker.js"></script>
```

### 2. Create Container

```html
<div id="duration-picker"></div>
```

### 3. Initialize

```javascript
const picker = new TimeIntervalPicker(
  document.getElementById('duration-picker'),
  {
    defaultValue: { months: 0, weeks: 0, days: 1, hours: 4, minutes: 0 },
    config: {
      monthsUnitSize: 30,
      stepBehavior: 'rollover',
      minTotalMinutes: 1,
      maxTotalMonths: 12
    },
    onChange: (change) => {
      console.log('Duration changed:', change);
      // change.normalizedMinutes - total in minutes
      // change.raw - individual field values
      // change.normalizedCompact - formatted string
      // change.validity - validation status
    }
  }
);
```

## Integration Examples

### Self-Lock Duration

```javascript
const selfLockPicker = new TimeIntervalPicker(
  document.getElementById('self-lock-duration'),
  {
    defaultValue: { months: 0, weeks: 0, days: 0, hours: 1, minutes: 0 },
    config: {
      minTotalMinutes: 1,
      maxTotalMonths: 12
    },
    onValidChange: (change) => {
      // Only fires when valid
      selectedDuration = change.normalizedMinutes * 60 * 1000; // Convert to ms
    }
  }
);
```

### Early Unlock Cooldown

```javascript
const cooldownPicker = new TimeIntervalPicker(
  document.getElementById('cooldown-duration'),
  {
    defaultValue: { months: 0, weeks: 0, days: 0, hours: 1, minutes: 0 },
    config: {
      minTotalMinutes: 0,  // Allow 0 for "no cooldown"
      maxTotalMonths: 0    // Use custom max check
    },
    onChange: (change) => {
      // Limit to 4 hours (240 minutes)
      if (change.normalizedMinutes > 240) {
        cooldownPicker.setValue({ months: 0, weeks: 0, days: 0, hours: 4, minutes: 0 });
        return;
      }
      cooldownMinutes = change.normalizedMinutes;
    }
  }
);
```

### Increment Timer

```javascript
const incrementPicker = new TimeIntervalPicker(
  document.getElementById('increment-duration'),
  {
    defaultValue: { months: 0, weeks: 0, days: 0, hours: 0, minutes: 5 },
    config: {
      minTotalMinutes: 1,
      maxTotalMonths: 0  // Use custom max check
    },
    onChange: (change) => {
      // Limit to 24 hours (1440 minutes)
      if (change.normalizedMinutes > 1440) {
        incrementPicker.setValue({ months: 0, weeks: 0, days: 0, hours: 24, minutes: 0 });
        return;
      }
      incrementMinutes = change.normalizedMinutes;
    }
  }
);
```

## API Reference

### Constructor Options

```typescript
{
  defaultValue?: TimeIntervalValue;  // Initial value
  config?: {
    monthsUnitSize?: 28 | 29 | 30 | 31;  // Days per month (default: 30)
    locale?: string;                      // Locale (default: 'en-US')
    stepBehavior?: 'rollover' | 'clamp'; // Overflow behavior (default: 'rollover')
    announceAriaLive?: boolean;           // ARIA live announcements (default: true)
    enableTooltips?: boolean;             // Show tooltips (default: true)
    theme?: 'auto' | 'light' | 'dark';   // Theme (default: 'auto')
    minTotalMinutes?: number;             // Min duration (default: 1)
    maxTotalMonths?: number;              // Max duration (default: 12)
  };
  onChange?: (change: TimeIntervalChange) => void;      // Fires on every change
  onValidChange?: (change: TimeIntervalChange) => void; // Fires only when valid
  ariaLabel?: string;                                   // Custom ARIA label
  ariaDescription?: string;                             // Custom ARIA description
}
```

### Methods

```javascript
picker.getValue()           // Get current value
picker.setValue(newValue)   // Set new value
picker.destroy()            // Clean up
```

### Change Event Object

```javascript
{
  raw: { months, weeks, days, hours, minutes },  // Individual fields
  normalizedMinutes: number,                      // Total in minutes
  normalizedCompact: string,                      // Formatted string
  validity: {
    isValid: boolean,
    reason?: 'BELOW_MIN' | 'ABOVE_MAX' | 'ALL_ZERO' | 'FIELD_BOUNDS'
  }
}
```

## Keyboard Shortcuts

- **Tab**: Move between fields
- **Arrow Up/Down**: Increment/decrement by 1
- **Shift + Arrow Up/Down**: Increment/decrement by 5
- **Home**: Set to minimum
- **End**: Set to maximum

## Accessibility Features

- Full keyboard navigation
- ARIA labels and descriptions
- Live region announcements
- High contrast mode support
- Touch-friendly targets (≥40px)
- Focus indicators

## Responsive Behavior

- **≥992px**: Single row layout
- **768-991px**: Wrapped layout
- **<768px**: Stacked layout (mobile)

## Browser Support

- Firefox 78+
- Chrome 88+
- Safari 14+
- Edge 88+

## Migration from Old Duration Selector

### Before (chips + custom input):
```html
<div class="duration-chips">
  <div class="chip" data-duration="3600000">1 hour</div>
  ...
</div>
<input type="number" id="custom-duration" placeholder="Minutes">
<button id="custom-duration-btn">Custom</button>
```

### After (time interval picker):
```html
<div id="duration-picker"></div>
<script>
  const picker = new TimeIntervalPicker(
    document.getElementById('duration-picker'),
    { /* options */ }
  );
</script>
```

## Styling Customization

Override CSS variables:
```css
.time-interval-picker {
  --tip-primary-color: #667eea;
  --tip-border-color: #ddd;
  --tip-focus-color: rgba(102, 126, 234, 0.1);
}
```

## Testing

Open `time-interval-picker-demo.html` in a browser to see three working examples with different configurations.

## Notes

- All durations are normalized automatically
- Rollover behavior converts excess values (e.g., 60 min → 1 hour)
- Validation is non-blocking with helpful messages
- Component emits changes immediately (no Apply button needed)
- Works standalone or integrated with browser extension messaging
