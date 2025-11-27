module.exports = {
  // Ignore files and directories that shouldn't be packaged
  ignoreFiles: [
    'sample-test-files',
    'sample-test-files/**',
    '*.md',
    '.git',
    '.DS_Store',
    'web-ext-artifacts',
    'time-interval-picker-demo.html',
    'time-interval-picker-demo.js',
  ],
  
  // Build configuration
  build: {
    overwriteDest: true,
  },
  
  // Run configuration (for testing)
  run: {
    firefox: 'firefoxdeveloperedition',
    startUrl: ['about:debugging#/runtime/this-firefox'],
  },
};
