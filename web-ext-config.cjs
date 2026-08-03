module.exports = {
  // Builds are assembled by build-scripts/build.js; web-ext only packages them.
  sourceDir: 'build/firefox',

  build: {
    overwriteDest: true,
  },

  // Run configuration (for testing)
  run: {
    firefox: 'firefoxdeveloperedition',
    startUrl: ['about:debugging#/runtime/this-firefox'],
  },
};
