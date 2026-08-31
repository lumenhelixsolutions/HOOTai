const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { discoverLedgerSources } = require('../token-ledger');

describe('token-ledger discover', () => {
  it('returns schema and source ids', () => {
    const d = discoverLedgerSources({ homeDir: os.homedir(), hootRoot: path.join(__dirname, '..') });
    assert.strictEqual(d.schema, 'hoot.ledger_discover.v1');
    const ids = d.sources.map((s) => s.id);
    assert.ok(ids.includes('codex'));
    assert.ok(ids.includes('claude'));
    assert.ok(ids.includes('gemini'));
    assert.ok(ids.includes('grok'));
    assert.ok(ids.includes('hoot'));
  });

  it('detects synthetic jsonl under a temp home', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hoot-ledger-'));
    const sessions = path.join(home, '.codex', 'sessions');
    fs.mkdirSync(sessions, { recursive: true });
    fs.writeFileSync(
      path.join(sessions, 't.jsonl'),
      `${JSON.stringify({ usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }, timestamp: '2026-01-01T00:00:00Z' })}\n`,
    );
    const d = discoverLedgerSources({ homeDir: home, hootRoot: path.join(__dirname, '..') });
    const codex = d.sources.find((s) => s.id === 'codex');
    assert.ok(codex.present);
    assert.ok(codex.files >= 1);
  });
});
