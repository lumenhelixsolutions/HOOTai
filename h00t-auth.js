/**
 * HOOT LAN token auth — optional shared secret for non-loopback clients.
 */

const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function verifyToken(provided, storedHash) {
  if (!provided || !storedHash) return false;
  return hashToken(provided) === storedHash;
}

function normalizeRemoteAddress(addr) {
  const a = String(addr || '');
  if (a.startsWith('::ffff:')) return a.slice(7);
  return a;
}

function isLoopbackAddress(addr) {
  const a = normalizeRemoteAddress(addr);
  return a === '127.0.0.1' || a === '::1';
}

function isLoopbackRequest(req) {
  return isLoopbackAddress(req.socket?.remoteAddress);
}

function extractToken(req) {
  const header = req.headers['x-hoot-token'] || req.headers['x-hoot-token'.toUpperCase()];
  if (header) return String(header).trim();
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

function getAuthSettings(settings) {
  const auth = settings?.auth || {};
  return {
    enabled: Boolean(auth.enabled),
    token_hash: auth.token_hash || null,
    created_at: auth.created_at || null,
  };
}

function checkAuth(req, settings) {
  const auth = getAuthSettings(settings);
  if (!auth.enabled) return { ok: true, reason: 'disabled' };
  if (isLoopbackRequest(req)) return { ok: true, reason: 'loopback' };
  const token = extractToken(req);
  if (verifyToken(token, auth.token_hash)) return { ok: true, reason: 'token' };
  return { ok: false, reason: 'missing_or_invalid' };
}

const AUTH_PUBLIC_PATHS = new Set(['/api/status', '/api/auth/status']);

function isAuthPublicPath(pathName) {
  return AUTH_PUBLIC_PATHS.has(pathName);
}

module.exports = {
  hashToken,
  generateToken,
  verifyToken,
  isLoopbackAddress,
  isLoopbackRequest,
  extractToken,
  getAuthSettings,
  checkAuth,
  isAuthPublicPath,
};