const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  parseBenchCsv,
  findBenchRow,
  benchScoreAdjustment,
  applyBenchToProfile,
  validateBenchCsv,
  mergeBenchRows,
  formatBenchCsv,
} = require('../bench-results');

const SAMPLE = `model,status,latency_ms,tokens_per_sec,note
phi3:mini,pass,1200,24.5,"OK"
qwen2.5:1.5b,missing,0,0,"not pulled"`;

describe('bench-results', () => {
  it('parses CSV rows', () => {
    const rows = parseBenchCsv(SAMPLE);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].model, 'phi3:mini');
    assert.strictEqual(rows[0].tokens_per_sec, 24.5);
  });

  it('finds model by variant', () => {
    const rows = parseBenchCsv(SAMPLE);
    assert.ok(findBenchRow(rows, 'phi3:mini'));
    assert.ok(findBenchRow(rows, 'phi3'));
  });

  it('scores pass tier', () => {
    const adj = benchScoreAdjustment({ status: 'pass', tokens_per_sec: 25, model: 'phi3:mini' });
    assert.strictEqual(adj.delta, 12);
    assert.strictEqual(adj.tier, 'fast');
  });

  it('applies bench delta to ollama profile eval', () => {
    const rows = parseBenchCsv(SAMPLE);
    const base = { state: 'READY', score: 75, reasons: ['Ollama detected'] };
    const profile = { meta: { backend: 'ollama', model: 'phi3:mini' } };
    const out = applyBenchToProfile(base, profile, { rows });
    assert.strictEqual(out.score, 87);
    assert.ok(out.bench);
    assert.ok(out.reasons.some((r) => r.includes('Bench pass')));
  });

  it('validates fixture CSV tiers', () => {
    const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'bench-results.valid.csv'), 'utf8');
    const report = validateBenchCsv(fixture);
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.row_count, 2);
    assert.strictEqual(report.tiers.fast, 1);
    assert.strictEqual(report.tiers.ok, 1);
  });

  it('rejects invalid bench status', () => {
    const bad = `model,status,latency_ms,tokens_per_sec,note
x,bogus,0,0,""`;
    const report = validateBenchCsv(bad);
    assert.strictEqual(report.ok, false);
    assert.ok(report.errors.length > 0);
  });

  it('applies bench delta to llamacpp profile eval', () => {
    const rows = parseBenchCsv(`model,status,latency_ms,tokens_per_sec,note,backend
llamacpp:demo.gguf,pass,800,12.1,"llama-bench",llamacpp`);
    const base = { state: 'READY', score: 70, reasons: [] };
    const profile = { meta: { backend: 'llamacpp', model: 'llamacpp:demo.gguf' } };
    const out = applyBenchToProfile(base, profile, { rows });
    assert.strictEqual(out.score, 78);
    assert.strictEqual(out.bench.tier, 'ok');
  });

  it('skips non-ollama backends without model', () => {
    const rows = parseBenchCsv(SAMPLE);
    const base = { state: 'READY', score: 75, reasons: [] };
    const profile = { meta: { backend: 'gemini', model: 'gemini-2.5-flash' } };
    const out = applyBenchToProfile(base, profile, { rows });
    assert.strictEqual(out.score, 75);
    assert.strictEqual(out.bench, undefined);
  });

  it('merges ollama and llamacpp rows without wiping', () => {
    const existing = parseBenchCsv(SAMPLE);
    const incoming = parseBenchCsv(`model,status,latency_ms,tokens_per_sec,note,backend
llamacpp:gguf,missing,0,0,"no model",llamacpp
phi3:mini,pass,900,30.0,"OK",ollama`);
    const merged = mergeBenchRows(existing, incoming);
    assert.strictEqual(merged.length, 3);
    const phi = findBenchRow(merged, 'phi3:mini');
    assert.strictEqual(phi.tokens_per_sec, 30);
    assert.ok(findBenchRow(merged, 'llamacpp:gguf'));
    assert.ok(findBenchRow(merged, 'qwen2.5:1.5b'));
    const csv = formatBenchCsv(merged);
    assert.ok(csv.includes('backend'));
    assert.ok(csv.includes('llamacpp:gguf'));
  });
});