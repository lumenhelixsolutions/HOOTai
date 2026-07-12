const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  resolveCanonicalHootRoot,
  isLegacyAgentdockPath,
  CANONICAL_HOOT_PATH,
} = require('../canonical-root');

describe('canonical-root', () => {
  it('treats HootAi as canonical', () => {
    const root = path.join('D:', 'projects', 'HootAi');
    assert.strictEqual(isLegacyAgentdockPath(root), false);
    assert.strictEqual(resolveCanonicalHootRoot(root), path.resolve(root));
  });

  it('still accepts Hoot as canonical alias', () => {
    const root = path.join('D:', 'projects', 'Hoot');
    assert.strictEqual(isLegacyAgentdockPath(root), false);
    assert.strictEqual(resolveCanonicalHootRoot(root), path.resolve(root));
  });

  it('detects legacy agentdock path', () => {
    const legacy = path.join('D:', 'projects', 'agentdock');
    assert.strictEqual(isLegacyAgentdockPath(legacy), true);
  });

  it('resolves legacy agentdock to sibling HootAi when present', () => {
    const legacy = path.join('D:', 'projects', 'agentdock');
    const hoot = path.join('D:', 'projects', 'HootAi');
    assert.strictEqual(resolveCanonicalHootRoot(legacy), path.resolve(hoot));
  });

  it('documents canonical portfolio path', () => {
    assert.match(CANONICAL_HOOT_PATH, /HootAi/i);
  });
});