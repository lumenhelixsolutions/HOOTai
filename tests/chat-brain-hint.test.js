const { describe, it } = require('node:test');
const assert = require('node:assert');
const { localBrainOfflineHint, brainPublicMeta, withTimeout } = require('../chat');

describe('chat brain OOTBIJS helpers', () => {
  it('offline hint lists recovery steps', () => {
    const hint = localBrainOfflineHint({ model: 'gemma4:latest', suggestions: [{ tag: 'gemma4:latest' }] });
    assert.match(hint, /ollama serve/);
    assert.match(hint, /gemma4:latest/);
    assert.match(hint, /start-hoot/);
  });

  it('brainPublicMeta exposes live fields', () => {
    const meta = brainPublicMeta(
      { available: true, source: 'settings', live_ollama: { ok: true } },
      'ollama',
      'gemma4:latest',
      'http://127.0.0.1:11434/v1/chat/completions',
    );
    assert.strictEqual(meta.provider, 'ollama');
    assert.strictEqual(meta.model, 'gemma4:latest');
    assert.strictEqual(meta.available, true);
    assert.strictEqual(meta.live_ollama.ok, true);
  });

  it('withTimeout rejects when slow', async () => {
    await assert.rejects(
      () => withTimeout(new Promise((r) => setTimeout(r, 200)), 30, 'test-op'),
      /timed out/,
    );
  });
});
