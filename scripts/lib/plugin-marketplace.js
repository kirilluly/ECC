'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGINS_DIR = path.join(os.homedir(), '.claude', 'plugins');
const MARKETPLACES_FILE = path.join(PLUGINS_DIR, 'known_marketplaces.json');
const INSTALLED_FILE = path.join(PLUGINS_DIR, 'installed_plugins.json');

function ensurePluginsDir() {
  for (const dir of [
    PLUGINS_DIR,
    path.join(PLUGINS_DIR, 'cache'),
    path.join(PLUGINS_DIR, 'marketplaces'),
  ]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function parseGitHubUrl(rawUrl) {
  const cleaned = rawUrl.replace(/\.git$/, '').trim();
  const httpsMatch = cleaned.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  const sshMatch = cleaned.match(/^git@github\.com:([^/]+)\/(.+)$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }
  return null;
}

function canonicalUrl(owner, repo) {
  return `https://github.com/${owner}/${repo}`;
}

function addMarketplace(url, type) {
  ensurePluginsDir();
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error(`Not a valid GitHub URL: ${url}`);
  }
  const { owner, repo } = parsed;
  const marketplaces = readJson(MARKETPLACES_FILE);
  const key = `${owner}/${repo}`;
  marketplaces[key] = {
    name: repo,
    owner,
    url: canonicalUrl(owner, repo),
    type: type || 'unknown',
    added_at: new Date().toISOString(),
  };
  writeJson(MARKETPLACES_FILE, marketplaces);
  return { key, ...marketplaces[key] };
}

function listMarketplaces() {
  return readJson(MARKETPLACES_FILE);
}

function removeMarketplace(name) {
  const marketplaces = readJson(MARKETPLACES_FILE);
  const key = Object.keys(marketplaces).find(
    (k) => k === name || k.endsWith(`/${name}`)
  );
  if (!key) return false;
  delete marketplaces[key];
  writeJson(MARKETPLACES_FILE, marketplaces);
  return key;
}

function recordInstall(pluginKey, record) {
  ensurePluginsDir();
  const installed = readJson(INSTALLED_FILE);
  installed[pluginKey] = { ...record, installed_at: new Date().toISOString() };
  writeJson(INSTALLED_FILE, installed);
}

function listInstalled() {
  return readJson(INSTALLED_FILE);
}

function removeInstalled(name) {
  const installed = readJson(INSTALLED_FILE);
  const key = Object.keys(installed).find(
    (k) => k === name || k.startsWith(`${name}@`) || k.endsWith(`@${name}`)
  );
  if (!key) return false;
  delete installed[key];
  writeJson(INSTALLED_FILE, installed);
  return key;
}

module.exports = {
  PLUGINS_DIR,
  MARKETPLACES_FILE,
  INSTALLED_FILE,
  ensurePluginsDir,
  readJson,
  writeJson,
  parseGitHubUrl,
  canonicalUrl,
  addMarketplace,
  listMarketplaces,
  removeMarketplace,
  recordInstall,
  listInstalled,
  removeInstalled,
};
