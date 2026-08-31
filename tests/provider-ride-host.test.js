const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('ProviderRide host bridge', () => {
  it('resolves sibling package and runs doctor', () => {
    const host = require('../provider-ride-host');
    const meta = host.meta();
    assert.strictEqual(meta.available, true, meta.error || 'package missing');
    assert.ok(meta.root && meta.root.includes('provider-ride'));
    assert.ok((meta.name || meta.brand?.name || '').toLowerCase().includes('ride') || meta.id === 'provider-ride');

    const report = host.runHostDoctor({
      registry: {
        providers: {
          claude: { status: 'cooldown', effective_status: 'cooldown', eta: '1h' },
          ollama: { status: 'local', effective_status: 'active' },
        },
        current_session_provider: 'claude',
      },
      live: { ollama: { ok: true } },
    });
    assert.strictEqual(report.available, true);
    assert.strictEqual(report.brand, 'ProviderRide');
    assert.strictEqual(report.channels.claude.status, 'cooldown');
    assert.strictEqual(report.channels.ollama.status, 'active');
    assert.ok(Array.isArray(report.fixes));
  });

  it('booth resolve is allowlist-only', async () => {
    const host = require('../provider-ride-host');
    const dry = await host.openBooth('claude', 'usage', { dryRun: true });
    assert.strictEqual(dry.ok, true);
    assert.ok(dry.url.startsWith('https://'));
    const bad = await host.openBooth('nope', 'account', { dryRun: true });
    assert.strictEqual(bad.ok, false);
  });
});
