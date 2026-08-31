/**
 * H00T host bridge for ProviderRide (standalone package).
 * Prefers sibling portfolio path D:\projects\provider-ride; fails soft if missing.
 *
 * Credentials live under HootAi/state/provider-ride/ (AES-GCM + machine master key).
 * Legacy paths/env (provider-reach) accepted as fallback.
 */

const fs = require('fs');
const path = require('path');

const CANDIDATES = [
  process.env.PROVIDER_RIDE_ROOT,
  process.env.PROVIDER_REACH_ROOT, // legacy
  path.join(__dirname, '..', 'provider-ride'),
  path.join(__dirname, '..', 'provider-reach'), // legacy folder name
  path.join(__dirname, 'vendor', 'provider-ride'),
].filter(Boolean);

const CRED_STATE_DIR = process.env.PROVIDER_RIDE_STATE
  || process.env.PROVIDER_REACH_STATE
  || path.join(__dirname, 'state', 'provider-ride');

// If new dir empty but legacy vault exists, prefer legacy so secrets keep working
function resolveCredStateDir() {
  const primary = CRED_STATE_DIR;
  const legacy = path.join(__dirname, 'state', 'provider-reach');
  try {
    const vaultNew = path.join(primary, 'credentials.vault.json');
    const vaultOld = path.join(legacy, 'credentials.vault.json');
    if (!fs.existsSync(vaultNew) && fs.existsSync(vaultOld)) return legacy;
  } catch { /* ignore */ }
  return primary;
}

let _mod = null;
let _root = null;
let _error = null;
let _creds = null;

function resolveRoot() {
  for (const p of CANDIDATES) {
    try {
      const idx = path.join(p, 'index.js');
      if (fs.existsSync(idx)) return p;
    } catch { /* continue */ }
  }
  return null;
}

function loadProviderRide() {
  if (_mod) return { ok: true, mod: _mod, root: _root };
  const root = resolveRoot();
  if (!root) {
    _error = 'ProviderRide package not found (expected sibling ../provider-ride)';
    return { ok: false, error: _error, mod: null, root: null };
  }
  try {
    const resolved = require.resolve(path.join(root, 'index.js'));
    for (const k of Object.keys(require.cache)) {
      if (k.startsWith(root)) delete require.cache[k];
    }
    _mod = require(resolved);
    _root = root;
    _error = null;
    _creds = null;
    return { ok: true, mod: _mod, root };
  } catch (e) {
    _error = e.message || String(e);
    return { ok: false, error: _error, mod: null, root };
  }
}

/** @deprecated alias */
const loadProviderReach = loadProviderRide;

function getCreds() {
  const { ok, mod, error } = loadProviderRide();
  if (!ok || !mod) return { ok: false, error: error || 'unavailable', service: null };
  if (!_creds) {
    _creds = mod.getCredentialService(resolveCredStateDir());
  }
  return { ok: true, service: _creds, error: null };
}

function meta() {
  const { ok, mod, root, error } = loadProviderRide();
  const cred = getCreds();
  return {
    available: ok,
    root,
    error: ok ? null : error,
    id: mod?.META?.id || 'provider-ride',
    name: mod?.META?.name || 'ProviderRide',
    version: mod?.META?.version || null,
    brand: mod?.META?.brand || { name: 'ProviderRide' },
    credentials: ok && cred.ok ? cred.service.status() : null,
    credentials_dir: resolveCredStateDir(),
  };
}

function runHostDoctor({
  registry,
  scan,
  vaultPresence,
  bridge,
  booth,
  live,
  cliPresent,
  credentialPresence,
} = {}) {
  const { ok, mod, error } = loadProviderRide();
  if (!ok || !mod) {
    return {
      version: 0,
      available: false,
      error: error || 'unavailable',
      score: '0/0',
      channels: {},
      fixes: ['Install or restore D:\\projects\\provider-ride (sibling of HootAi).'],
    };
  }

  let credPresence = credentialPresence;
  if (!credPresence) {
    const c = getCreds();
    if (c.ok) credPresence = c.service.presenceMap();
  }

  const report = mod.runDoctor({
    registry,
    scan,
    vaultPresence,
    credentialPresence: credPresence,
    bridge,
    booth,
    live,
    cliPresent,
  });
  return {
    ...report,
    available: true,
    package: mod.META,
    brand: 'ProviderRide',
    host: 'H00T',
    credentials: getCreds().ok ? getCreds().service.status() : null,
  };
}

function listBoothCatalog() {
  const { ok, mod } = loadProviderRide();
  if (!ok) return [];
  return mod.listBoothCatalog();
}

async function openBooth(providerId, target, opts) {
  const { ok, mod, error } = loadProviderRide();
  if (!ok) return { ok: false, error: error || 'ProviderRide unavailable' };
  return mod.openBooth(providerId, target, opts);
}

function policyTable() {
  const { ok, mod } = loadProviderRide();
  if (!ok) return [];
  return mod.listPolicyTable();
}

function requiresHitl(action) {
  const { ok, mod } = loadProviderRide();
  if (!ok) return true;
  return mod.requiresHitl(action);
}

function listCredentials() {
  const c = getCreds();
  if (!c.ok) return [];
  return c.service.listCredentials();
}

function credentialCatalog() {
  const c = getCreds();
  if (!c.ok) return [];
  return c.service.catalog();
}

function putCredential(input, { dualWrite } = {}) {
  const c = getCreds();
  if (!c.ok) return { ok: false, error: c.error };
  const result = c.service.putCredential(input);
  if (!result.ok) return result;

  if (typeof dualWrite === 'function' && result.kind === 'api_key' && result.hoot_env_names?.length) {
    try {
      dualWrite({
        envNames: result.hoot_env_names,
        value: input.value,
        provider: result.provider,
      });
      result.dual_write = true;
    } catch (e) {
      result.dual_write = false;
      result.dual_write_error = e.message;
    }
  }
  const safe = { ...result };
  delete safe.value;
  return safe;
}

function deleteCredential(provider, kind) {
  const c = getCreds();
  if (!c.ok) return { ok: false, error: c.error };
  return c.service.deleteCredential(provider, kind);
}

function credentialStatus() {
  const c = getCreds();
  if (!c.ok) return { ok: false, error: c.error };
  return { ok: true, ...c.service.status(), presence: c.service.presenceMap() };
}

function revealForLaunch(provider, kind = 'api_key') {
  const c = getCreds();
  if (!c.ok) return null;
  const r = c.service.reveal(provider, kind);
  return r.ok ? r.value : null;
}

module.exports = {
  loadProviderRide,
  loadProviderReach, // legacy alias
  meta,
  runHostDoctor,
  listBoothCatalog,
  openBooth,
  policyTable,
  requiresHitl,
  resolveRoot,
  CRED_STATE_DIR: resolveCredStateDir(),
  listCredentials,
  credentialCatalog,
  putCredential,
  deleteCredential,
  credentialStatus,
  revealForLaunch,
  getCreds,
};
