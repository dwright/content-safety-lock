#!/usr/bin/env node
/**
 * Packaging orchestrator.
 *
 * Builds the requested targets and writes one distributable archive per target
 * into `dist/`, using names that identify the browser and version so a single
 * GitHub release can carry every browser:
 *
 *   dist/content-safety-lock-firefox-<version>.zip
 *   dist/content-safety-lock-chrome-<version>.zip
 *   dist/content-safety-lock-safari-<version>.zip
 *
 *   node build-scripts/package.js firefox chrome safari
 *
 * Archives are produced with `web-ext build` for every target (it only zips a
 * directory), so packaging needs no tooling beyond the existing dependency.
 *
 * The Safari archive is the unpacked web extension: Safari cannot install a zip
 * directly, so it is the input for `xcrun safari-web-extension-converter`
 * (`npm run xcode:safari`), which only runs on macOS.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');
const DIST_DIR = path.join(ROOT, 'dist');

const TARGETS = ['firefox', 'chrome', 'safari'];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
  }
}

function webExt(args) {
  // Resolve the local binary so packaging works without a global install.
  const binary = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'web-ext.cmd' : 'web-ext');
  if (!fs.existsSync(binary)) {
    throw new Error('web-ext is not installed. Run `npm install` first.');
  }
  run(binary, args);
}

function packageTarget(target, version) {
  run(process.execPath, [path.join('build-scripts', 'build.js'), target]);

  const filename = `content-safety-lock-${target}-${version}.zip`;
  webExt([
    'build',
    '--source-dir', path.join('build', target),
    '--artifacts-dir', 'dist',
    '--filename', filename,
    '--overwrite-dest'
  ]);

  const artifact = path.join(DIST_DIR, filename);
  if (!fs.existsSync(artifact)) {
    throw new Error(`Expected artifact was not produced: ${path.relative(ROOT, artifact)}`);
  }
  return artifact;
}

function main() {
  const args = process.argv.slice(2);
  const targets = args.length === 0 || args.includes('all') ? TARGETS : args;

  const unknown = targets.filter((target) => !TARGETS.includes(target));
  if (unknown.length > 0) {
    console.error(`Unknown target(s): ${unknown.join(', ')}`);
    console.error(`Available targets: ${TARGETS.join(', ')}`);
    process.exit(1);
  }

  if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const artifacts = targets.map((target) => packageTarget(target, version));

  console.log(`\nPackaged version ${version}:`);
  for (const artifact of artifacts) {
    const size = (fs.statSync(artifact).size / 1024).toFixed(0);
    console.log(`  ${path.relative(ROOT, artifact)} (${size} KB)`);
  }
}

main();
