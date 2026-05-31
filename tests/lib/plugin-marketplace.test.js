'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Redirect PLUGINS_DIR to a temp directory so tests don't touch ~/.claude
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-plugin-test-'));
const origHome = process.env.HOME;
process.env.HOME = tmpDir;

const pm = require('../../scripts/lib/plugin-marketplace');

// Re-derive paths after patching HOME (the module cached them at require time,
// so we override the exported constants for path-dependent assertions)
const PLUGINS_DIR = path.join(tmpDir, '.claude', 'plugins');
const MARKETPLACES_FILE = path.join(PLUGINS_DIR, 'known_marketplaces.json');
const INSTALLED_FILE = path.join(PLUGINS_DIR, 'installed_plugins.json');

// Patch the module's paths to the temp dir
pm.PLUGINS_DIR = PLUGINS_DIR;
pm.MARKETPLACES_FILE = MARKETPLACES_FILE;
pm.INSTALLED_FILE = INSTALLED_FILE;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('plugin-marketplace');

// parseGitHubUrl
test('parses https URL', () => {
  const r = pm.parseGitHubUrl('https://github.com/affaan-m/ECC');
  assert.strictEqual(r.owner, 'affaan-m');
  assert.strictEqual(r.repo, 'ECC');
});

test('parses https URL with .git suffix', () => {
  const r = pm.parseGitHubUrl('https://github.com/affaan-m/ECC.git');
  assert.strictEqual(r.owner, 'affaan-m');
  assert.strictEqual(r.repo, 'ECC');
});

test('parses ssh URL', () => {
  const r = pm.parseGitHubUrl('git@github.com:affaan-m/ECC.git');
  assert.strictEqual(r.owner, 'affaan-m');
  assert.strictEqual(r.repo, 'ECC');
});

test('returns null for non-GitHub URL', () => {
  const r = pm.parseGitHubUrl('https://gitlab.com/foo/bar');
  assert.strictEqual(r, null);
});

// canonicalUrl
test('builds canonical URL', () => {
  assert.strictEqual(
    pm.canonicalUrl('affaan-m', 'ECC'),
    'https://github.com/affaan-m/ECC'
  );
});

// addMarketplace / listMarketplaces / removeMarketplace
test('addMarketplace creates entry', () => {
  const entry = pm.addMarketplace('https://github.com/affaan-m/ECC', 'ecc');
  assert.strictEqual(entry.owner, 'affaan-m');
  assert.strictEqual(entry.type, 'ecc');
  assert.ok(fs.existsSync(MARKETPLACES_FILE));
});

test('listMarketplaces returns saved entries', () => {
  const list = pm.listMarketplaces();
  assert.ok(list['affaan-m/ECC']);
  assert.strictEqual(list['affaan-m/ECC'].type, 'ecc');
});

test('removeMarketplace deletes by short name', () => {
  pm.addMarketplace('https://github.com/foo/bar', 'plugin-index');
  const removed = pm.removeMarketplace('bar');
  assert.strictEqual(removed, 'foo/bar');
  const list = pm.listMarketplaces();
  assert.strictEqual(list['foo/bar'], undefined);
});

test('removeMarketplace returns false for unknown name', () => {
  assert.strictEqual(pm.removeMarketplace('nonexistent'), false);
});

// recordInstall / listInstalled / removeInstalled
test('recordInstall saves a record', () => {
  pm.recordInstall('ecc@affaan-m/ECC', { marketplace: 'affaan-m/ECC', profile: 'full' });
  const installed = pm.listInstalled();
  assert.ok(installed['ecc@affaan-m/ECC']);
  assert.strictEqual(installed['ecc@affaan-m/ECC'].profile, 'full');
  assert.ok(installed['ecc@affaan-m/ECC'].installed_at);
});

test('removeInstalled deletes by key prefix', () => {
  const removed = pm.removeInstalled('ecc');
  assert.ok(removed);
  assert.strictEqual(pm.listInstalled()['ecc@affaan-m/ECC'], undefined);
});

test('removeInstalled returns false for unknown', () => {
  assert.strictEqual(pm.removeInstalled('nope'), false);
});

// addMarketplace rejects non-GitHub URL
test('addMarketplace throws on invalid URL', () => {
  assert.throws(
    () => pm.addMarketplace('https://example.com/foo/bar'),
    /Not a valid GitHub URL/
  );
});

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });
process.env.HOME = origHome;

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
