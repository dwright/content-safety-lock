module.exports = {
  // Ignore files and directories that shouldn't be packaged
  ignoreFiles: [
    // Directories
    'web-ext-artifacts',
    'web-ext-artifacts/**',
    'Debugging',
    'Debugging/**',
    'documentation',
    'documentation/**',
    'sample-test-files',
    'sample-test-files/**',
    'test-pages',
    'test-pages/**',
    
    // Files
    '*.md',
    '.git',
    '.DS_Store',
    'time-interval-picker-demo.html',
    'time-interval-picker-demo.js',
    'create-github-releases.sh',
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
