/**
 * bench-results.js — Parse Ollama bench CSV and feed profile scoring.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_CSV = path.join(__dirname, 'state', 'bench-results.csv');
const BENCH_SCRIPT = path.join(__dirname, 'scripts', 'bench-local-models.mjs');
const LLAMACPP_BENCH_SCRIPT = path.join(__dirname, 'scripts', 'bench-llamacpp.mjs');

const BENCH_CSV_COLUMNS = ['model', 'status', 'latency_ms', 'tokens_per_sec'];
const BENCH_VALID_STATUSES = new Set(['pass', 'weak', 'missing', 'error', 'unknown']);
const BENCH_TIER_THRESHOLDS = { fast: 20, ok: 8 };

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseBenchCsv(content) {
  const lines = String(content || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const row = {};
    header.forEach((key, idx) => { row[key] = (cols[idx] || '').trim(); });
    if (row.model) rows.push(normalizeBenchRow(row));
  }
  return rows;
}

function normalizeBenchRow(row) {
  return {
    model: row.model,
    status: row.status || 'unknown',
    latency_ms: Number(row.latency_ms) || 0,
    tokens_per_sec: Number(row.tokens_per_sec) || 0,
    note: row.note || '',
    backend: row.backend || 'ollama',
    updated_at: row.updated_at || null,
  };
}

function validateBenchCsv(content) {
  const errors = [];
  const warnings = [];
  const lines = String(content || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return { ok: false, errors: ['CSV must include header and at least one data row'], warnings, row_count: 0 };
  }
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  for (const col of BENCH_CSV_COLUMNS) {
    if (!header.includes(col)) errors.push(`Missing required column: ${col}`);
  }
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((key, idx) => { row[key] = (cols[idx] || '').trim(); });
    if (!row.model) {
      errors.push(`Row ${i + 1}: model is required`);
      continue;
    }
    if (!BENCH_VALID_STATUSES.has(row.status || '')) {
      errors.push(`Row ${i + 1}: invalid status "${row.status}"`);
    }
    if (Number.isNaN(Number(row.latency_ms))) errors.push(`Row ${i + 1}: latency_ms must be numeric`);
    if (Number.isNaN(Number(row.tokens_per_sec))) errors.push(`Row ${i + 1}: tokens_per_sec must be numeric`);
    const normalized = normalizeBenchRow(row);
    rows.push(normalized);
    if (normalized.status === 'pass') {
      const tier = benchScoreAdjustment(normalized).tier;
      if (!['fast', 'ok', 'slow'].includes(tier)) warnings.push(`Row ${i + 1}: pass row has unexpected tier ${tier}`);
    }
  }
  const tiers = rows.reduce((acc, row) => {
    const tier = benchScoreAdjustment(row).tier;
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    row_count: rows.length,
    tiers,
    thresholds: BENCH_TIER_THRESHOLDS,
    rows,
  };
}

function loadBenchResults(csvPath = DEFAULT_CSV) {
  if (!fs.existsSync(csvPath)) {
    return { path: csvPath, rows: [], updated_at: null, validation: { ok: false, errors: ['CSV file missing'], warnings: [], row_count: 0 } };
  }
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseBenchCsv(raw);
  const validation = validateBenchCsv(raw);
  let updated_at = null;
  try { updated_at = fs.statSync(csvPath).mtime.toISOString(); } catch { /* ignore */ }
  return { path: csvPath, rows, updated_at, validation };
}

function modelVariants(name) {
  const base = String(name || '').trim().toLowerCase();
  if (!base) return [];
  const noTag = base.split(':')[0];
  return [...new Set([base, `${noTag}:latest`, noTag])];
}

function findBenchRow(rows, modelName) {
  if (!modelName || !rows?.length) return null;
  const variants = modelVariants(modelName);
  return rows.find((r) => variants.includes(String(r.model).toLowerCase())
    || variants.some((v) => String(r.model).toLowerCase().startsWith(v.replace(':latest', ''))));
}

function benchScoreAdjustment(row) {
  if (!row) return { delta: 0, reason: null, tier: 'unknown' };
  if (row.status === 'pass') {
    if (row.tokens_per_sec >= 20) return { delta: 12, reason: `Bench pass ${row.tokens_per_sec} tok/s`, tier: 'fast' };
    if (row.tokens_per_sec >= 8) return { delta: 8, reason: `Bench pass ${row.tokens_per_sec} tok/s`, tier: 'ok' };
    return { delta: 4, reason: `Bench pass (slow ${row.tokens_per_sec} tok/s)`, tier: 'slow' };
  }
  if (row.status === 'weak') return { delta: -5, reason: 'Bench weak response quality', tier: 'weak' };
  if (row.status === 'missing') return { delta: -10, reason: `Model not pulled (${row.model})`, tier: 'missing' };
  if (row.status === 'error') return { delta: -15, reason: `Bench error: ${row.note || 'failed'}`, tier: 'error' };
  return { delta: 0, reason: null, tier: row.status };
}

function applyBenchToProfile(evalResult, profile, benchData) {
  const model = profile?.meta?.model;
  const backend = String(profile?.meta?.backend || '').toLowerCase();
  if (!model || (backend !== 'ollama' && backend !== 'llamacpp' && backend !== 'llama.cpp')) {
    return evalResult;
  }
  const row = findBenchRow(benchData?.rows || [], model);
  if (!row) return evalResult;
  const adj = benchScoreAdjustment(row);
  if (!adj.reason) return evalResult;
  const reasons = [...(evalResult.reasons || []), adj.reason];
  let score = Math.max(0, Math.min(100, (evalResult.score || 0) + adj.delta));
  let state = evalResult.state;
  if (adj.tier === 'error' || adj.tier === 'missing') state = state === 'BLOCKED' ? state : 'DEGRADED';
  return {
    ...evalResult,
    score,
    state,
    reasons,
    bench: { model: row.model, status: row.status, tokens_per_sec: row.tokens_per_sec, tier: adj.tier },
  };
}

function runBenchScript(models = [], csvPath = DEFAULT_CSV) {
  return new Promise((resolve, reject) => {
    const args = [BENCH_SCRIPT, ...models, '--out', csvPath];
    const child = spawn(process.execPath, args, { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || stdout || `bench exit ${code}`));
      resolve(loadBenchResults(csvPath));
    });
  });
}

function runLlamaCppBenchScript(csvPath = DEFAULT_CSV, modelPath = null) {
  return new Promise((resolve, reject) => {
    const args = [LLAMACPP_BENCH_SCRIPT, '--out', csvPath];
    if (modelPath) args.push('--model', modelPath);
    const child = spawn(process.execPath, args, { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || stdout || `llamacpp bench exit ${code}`));
      resolve(loadBenchResults(csvPath));
    });
  });
}

module.exports = {
  DEFAULT_CSV,
  BENCH_CSV_COLUMNS,
  BENCH_TIER_THRESHOLDS,
  parseBenchCsv,
  validateBenchCsv,
  loadBenchResults,
  findBenchRow,
  benchScoreAdjustment,
  applyBenchToProfile,
  runBenchScript,
  runLlamaCppBenchScript,
};