const { describe, it } = require('node:test');
const assert = require('node:assert');
const { isLocalMappedProvider, mapProvider, ensureFreshPricing } = require('../core/mediated');

describe('mediated local OOTBIJS', () => {
  it('maps ollama family as local', () => {
    assert.strictEqual(isLocalMappedProvider('ollama'), true);
    assert.strictEqual(isLocalMappedProvider('llamacpp'), true);
    assert.strictEqual(isLocalMappedProvider('lmstudio'), true);
    assert.strictEqual(isLocalMappedProvider('gemini'), false);
    assert.strictEqual(mapProvider('ollama'), 'ollama');
  });

  it('ensureFreshPricing skipNetwork returns without throwing', async () => {
    const client = { coreDir: require('path').join(__dirname, '..', 'state', 'core'), gateway: {} };
    const pricing = await ensureFreshPricing(client, { skipNetwork: true });
    assert.ok(pricing === null || typeof pricing === 'object');
  });
});
