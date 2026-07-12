const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  buildTokenLedger,
  ingestCodexRoots,
  mergeDayMaps,
  buildScale,
  buildKeyMoments,
  buildEquivalents,
  importTokenBurnData,
  updateConfig,
  ingestClaudeCsv,
} = require('../token-ledger');

const FIXTURES = path.join(__dirname, 'fixtures', 'token-ledger');

describe('token-ledger', () => {
  it('ingests Codex JSONL into daily totals', () => {
    const { byDay, sessions } = ingestCodexRoots([path.join(FIXTURES, 'codex')]);
    const day = byDay.get('2026-06-10');
    assert.ok(day);
    assert.strictEqual(day.total_tokens, 313000);
    assert.strictEqual(day.token_count_events, 2);
    assert.ok(sessions.length >= 1);
  });

  it('builds merged days from fixture ingest paths', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hoot-ledger-'));
    const configFile = path.join(tmp, 'token-ledger-config.json');
    const cacheFile = path.join(tmp, 'token-ledger-cache.json');
    updateConfig(configFile, {
      codex_roots: [path.join(FIXTURES, 'codex')],
      claude_csv: path.join(FIXTURES, 'claude.csv'),
      chatgpt_csv: path.join(FIXTURES, 'chatgpt.csv'),
    });

    const report = buildTokenLedger({
      stateDir: tmp,
      configFile,
      cacheFile,
      refresh: true,
      mode: 'full',
    });

    assert.strictEqual(report.days.length, 2);
    const d0 = report.days.find((d) => d.date === '2026-06-10');
    assert.ok(d0);
    assert.strictEqual(d0.codex.total_tokens, 313000);
    assert.strictEqual(d0.claude.exact_logged_tokens, 128000);
    assert.strictEqual(d0.chatgpt.total_tokens, 5000000);
    assert.ok(d0.total_tokens > 5000000);
    assert.ok(report.metadata.key_moments.length > 0);
    assert.ok(report.metadata.work_breakdown.groups.length > 0);
    assert.ok(report.metadata.equivalents.water.ai_gallons > 0);
    assert.strictEqual(report.metadata.empty, false);
  });

  it('buildScale returns log thresholds', () => {
    const days = mergeDayMaps(
      new Map([['2026-06-10', { date: '2026-06-10', total_tokens: 1000, threads: new Set(), input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, uncached_input_tokens: 0, reasoning_output_tokens: 0, token_count_events: 0, first_event_at: null, last_event_at: null }]]),
      new Map(),
      new Map(),
    ).map((d) => ({ ...d, codex: { total_tokens: 1000 }, claude: { total_tokens: 0 }, chatgpt: { total_tokens: 0 } }));
    const scale = buildScale(days);
    assert.strictEqual(scale.transform, 'log10');
    assert.strictEqual(scale.thresholds.length, 5);
  });

  it('buildKeyMoments sorts by burn', () => {
    const days = [
      { date: '2026-06-10', total_tokens: 100, codex: { total_tokens: 80 }, claude: { total_tokens: 10 }, chatgpt: { total_tokens: 10 } },
      { date: '2026-06-11', total_tokens: 500, codex: { total_tokens: 400 }, claude: { total_tokens: 50 }, chatgpt: { total_tokens: 50 } },
    ];
    const moments = buildKeyMoments(days, 2);
    assert.strictEqual(moments[0].date, '2026-06-11');
  });

  it('importTokenBurnData accepts reference shape', () => {
    const payload = {
      metadata: { today: '2026-06-12' },
      days: [{ date: '2026-06-12', total_tokens: 1, codex: { total_tokens: 1 }, claude: { total_tokens: 0 }, chatgpt: { total_tokens: 0 } }],
    };
    const imported = importTokenBurnData(payload);
    assert.strictEqual(imported.days.length, 1);
  });

  it('serves cache without refresh', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hoot-ledger-cache-'));
    const configFile = path.join(tmp, 'token-ledger-config.json');
    const cacheFile = path.join(tmp, 'token-ledger-cache.json');
    updateConfig(configFile, { codex_roots: [path.join(FIXTURES, 'codex')] });
    buildTokenLedger({ stateDir: tmp, configFile, cacheFile, refresh: true });
    const cached = buildTokenLedger({ stateDir: tmp, configFile, cacheFile, refresh: false });
    assert.strictEqual(cached.metadata.refresh_mode, 'cache');
    assert.ok(cached.days.length > 0);
  });

  it('buildEquivalents scales with token volume', () => {
    const eq = buildEquivalents(1_000_000_000);
    assert.ok(eq.query_equivalents > 0);
    assert.ok(eq.code.gross_loc_equivalent > 0);
  });

  it('buckets timestamps using configured timezone for imported transactions', () => {
    const byDay = ingestClaudeCsv(null, [
      { timestamp: '2026-06-11T06:30:00.000Z', input_tokens: 100, output_tokens: 20 },
    ], 'America/Los_Angeles');
    assert.ok(byDay.has('2026-06-10'));
    assert.strictEqual(byDay.get('2026-06-10').exact_logged_tokens, 120);
  });

  it('fast recent rebuild preserves cached historical session breakdown', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hoot-ledger-fast-'));
    const configFile = path.join(tmp, 'token-ledger-config.json');
    const cacheFile = path.join(tmp, 'token-ledger-cache.json');
    const codexRoot = path.join(FIXTURES, 'codex');
    updateConfig(configFile, { codex_roots: [codexRoot] });

    const full = buildTokenLedger({ stateDir: tmp, configFile, cacheFile, refresh: true, mode: 'full' });
    const fast = buildTokenLedger({ stateDir: tmp, configFile, cacheFile, refresh: true, mode: 'fast_recent' });

    assert.ok(full.metadata.work_breakdown.groups.length > 0);
    assert.deepStrictEqual(fast.metadata.work_breakdown.groups, full.metadata.work_breakdown.groups);
  });
});