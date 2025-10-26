// Example 1: Self-Lock Duration (1 min to 12 months)
const picker1 = new TimeIntervalPicker(
  document.getElementById('picker-1'),
  {
    defaultValue: { months: 0, weeks: 0, days: 1, hours: 4, minutes: 0 },
    config: {
      monthsUnitSize: 30,
      stepBehavior: 'rollover',
      minTotalMinutes: 1,
      maxTotalMonths: 12
    },
    onChange: (change) => {
      document.getElementById('output-1').textContent = JSON.stringify(change, null, 2);
      
      // Simulate sending to background script
      console.log('Self-Lock Duration:', {
        type: 'TIME_INTERVAL_UPDATED',
        payload: {
          normalizedMinutes: change.normalizedMinutes,
          raw: change.raw
        }
      });
    }
  }
);

// Example 2: Cooldown Duration (0 min to 4 hours)
const picker2 = new TimeIntervalPicker(
  document.getElementById('picker-2'),
  {
    defaultValue: { months: 0, weeks: 0, days: 0, hours: 1, minutes: 0 },
    config: {
      monthsUnitSize: 30,
      stepBehavior: 'rollover',
      minTotalMinutes: 0,        // Allow 0 for "no cooldown"
      maxTotalMinutes: 240       // Max 4 hours (240 minutes)
    },
    onChange: (change) => {
      document.getElementById('output-2').textContent = JSON.stringify(change, null, 2);
      console.log('Cooldown Duration:', change.normalizedMinutes, 'minutes');
    }
  }
);

// Example 3: Increment Timer (1 min to 24 hours)
const picker3 = new TimeIntervalPicker(
  document.getElementById('picker-3'),
  {
    defaultValue: { months: 0, weeks: 0, days: 0, hours: 0, minutes: 5 },
    config: {
      monthsUnitSize: 30,
      stepBehavior: 'rollover',
      minTotalMinutes: 1,
      maxTotalMinutes: 1440  // Max 24 hours (1440 minutes)
    },
    onChange: (change) => {
      document.getElementById('output-3').textContent = JSON.stringify(change, null, 2);
      console.log('Increment Duration:', change.normalizedMinutes, 'minutes');
    }
  }
);
