const { describe, it } = require('node:test');
const assert = require('node:assert');
const { hashToken, verifyToken, isLoopbackAddress, checkAuth } = require('../h00t-auth');

describe('hoot-auth', () => {
  it('hashes and verifies tokens', () => {
    const token = 'test-secret-token';
    const hash = hashToken(token);
    assert.ok(verifyToken(token, hash));
    assert.strictEqual(verifyToken('wrong', hash), false);
  });

  it('detects loopback addresses', () => {
    assert.strictEqual(isLoopbackAddress('127.0.0.1'), true);
    assert.strictEqual(isLoopbackAddress('::ffff:127.0.0.1'), true);
    assert.strictEqual(isLoopbackAddress('192.168.1.5'), false);
  });

  it('allows loopback when auth enabled', () => {
    const req = { socket: { remoteAddress: '127.0.0.1' }, headers: {} };
    const settings = { auth: { enabled: true, token_hash: hashToken('abc') } };
    assert.strictEqual(checkAuth(req, settings).ok, true);
  });

  it('requires token for remote when auth enabled', () => {
    const req = { socket: { remoteAddress: '192.168.1.10' }, headers: {} };
    const settings = { auth: { enabled: true, token_hash: hashToken('abc') } };
    assert.strictEqual(checkAuth(req, settings).ok, false);
    req.headers['x-hoot-token'] = 'abc';
    assert.strictEqual(checkAuth(req, settings).ok, true);
  });
});