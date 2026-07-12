'use strict';

const fs = require('fs');
const path = require('path');

const CANONICAL_DIR_NAMES = new Set(['hoot', 'hootai']);
const LEGACY_DIR_NAMES = new Set(['agentdock']);

const CANONICAL_CANDIDATE_NAMES = ['HootAi', 'Hoot'];

const CANONICAL_HOOT_PATH = process.platform === 'win32'
  ? 'D:\\projects\\HootAi'
  : path.join(path.dirname(__dirname), 'HootAi');

function findCanonicalSibling(parent) {
  for (const name of CANONICAL_CANDIDATE_NAMES) {
    const candidate = path.join(parent, name);
    if (fs.existsSync(path.join(candidate, 'server.js'))) {
      return path.resolve(candidate);
    }
  }
  return null;
}

function resolveCanonicalHootRoot(startDir = __dirname) {
  const resolved = path.resolve(startDir);
  const base = path.basename(resolved).toLowerCase();
  if (CANONICAL_DIR_NAMES.has(base)) return resolved;

  const parent = path.dirname(resolved);
  const canonicalSibling = findCanonicalSibling(parent);
  if (LEGACY_DIR_NAMES.has(base) && canonicalSibling) {
    return canonicalSibling;
  }
  return resolved;
}

function isLegacyAgentdockPath(dirPath) {
  return LEGACY_DIR_NAMES.has(path.basename(path.resolve(dirPath)).toLowerCase());
}

function assertCanonicalHootRoot(opts = {}) {
  const { exitOnLegacy = true, log = console.error } = opts;
  const cwd = path.resolve(process.cwd());
  const root = path.resolve(__dirname);
  const legacy = isLegacyAgentdockPath(cwd) || isLegacyAgentdockPath(root);

  if (!legacy) {
    return { legacy: false, canonical: root };
  }

  const canonical = resolveCanonicalHootRoot(root);
  log('');
  log('LEGACY PATH: D:\\projects\\agentdock is a stale mirror.');
  log(`Canonical HOOT root: ${canonical}`);
  log('Start with: pwsh D:\\projects\\scripts\\start-hoot.ps1');
  log('         or: cd D:\\projects\\HootAi && node server.js');
  log('');

  if (exitOnLegacy) process.exit(1);
  return { legacy: true, canonical };
}

module.exports = {
  assertCanonicalHootRoot,
  resolveCanonicalHootRoot,
  isLegacyAgentdockPath,
  CANONICAL_HOOT_PATH,
  LEGACY_DIR_NAMES,
};