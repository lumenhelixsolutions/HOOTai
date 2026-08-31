#!/usr/bin/env node
/**
 * bench-local-models.mjs — Ollama model smoke benchmark for HOOT profile scoring.
 * Usage: node scripts/bench-local-models.mjs [model...]
 * Output: CSV rows to stdout; optional --out state/bench-results.csv
 * Flags: --out <path>  --merge (default when --out set: merge with existing CSV)
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { resolveOllamaBaseUrl } = require('../ollama-url.js');
const { parseBenchCsv, mergeBenchRows, formatBenchCsv } = require('../bench-results.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ollamaHost = resolveOllamaBaseUrl(process.env.OLLAMA_HOST);
const argv = process.argv.slice(2);
const outFlag = argv.indexOf('--out');
const outPath = outFlag >= 0 ? argv[outFlag + 1] : null;
const merge = argv.includes('--merge') || Boolean(outPath);
const models = argv.filter((a, i) => {
  if (a.startsWith('--')) return false;
  if (outFlag >= 0 && i === outFlag + 1) return false;
  return true;
});
const defaultModels = ['phi3:mini', 'qwen2.5:1.5b', 'smollm2:360m'];
const targets = models.length ? models : defaultModels;

function modelInstalled(installed, name) {
  if (installed.has(name)) return true;
  const lower = name.toLowerCase();
  if (installed.has(lower)) return true;
  // Accept tag-less match against :latest / any tag
  const base = lower.split(':')[0];
  for (const m of installed) {
    const ml = m.toLowerCase();
    if (ml === base || ml.startsWith(`${base}:`)) return true;
  }
  return false;
}

function resolveInstalledName(installed, name) {
  if (installed.has(name)) return name;
  const lower = name.toLowerCase();
  for (const m of installed) {
    if (m.toLowerCase() === lower) return m;
  }
  const base = lower.split(':')[0];
  for (const m of installed) {
    const ml = m.toLowerCase();
    if (ml === base || ml.startsWith(`${base}:`)) return m;
  }
  return name;
}

async function listModels() {
  const res = await fetch(`${ollamaHost}/api/tags`);
  if (!res.ok) throw new Error(`Ollama unreachable at ${ollamaHost}`);
  const data = await res.json();
  return new Set((data.models || []).map((m) => m.name));
}

async function benchModel(name) {
  const prompt = 'Reply with exactly: OK';
  const start = performance.now();
  const res = await fetch(`${ollamaHost}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name, prompt, stream: false, options: { num_predict: 8 } }),
  });
  const elapsed = Math.round(performance.now() - start);
  if (!res.ok) {
    return {
      model: name,
      status: 'error',
      latency_ms: elapsed,
      tokens_per_sec: 0,
      note: await res.text(),
      backend: 'ollama',
    };
  }
  const body = await res.json();
  const evalCount = body.eval_count || 0;
  const evalDurationNs = body.eval_duration || 0;
  const tps = evalDurationNs > 0 ? Math.round((evalCount / evalDurationNs) * 1e9 * 10) / 10 : 0;
  return {
    model: name,
    status: String(body.response || '').includes('OK') ? 'pass' : 'weak',
    latency_ms: elapsed,
    tokens_per_sec: tps,
    note: (body.response || '').trim().slice(0, 40),
    backend: 'ollama',
  };
}

const installed = await listModels();
const rows = [];
for (const model of targets) {
  if (!modelInstalled(installed, model)) {
    rows.push({
      model,
      status: 'missing',
      latency_ms: 0,
      tokens_per_sec: 0,
      note: 'not pulled',
      backend: 'ollama',
    });
    continue;
  }
  const resolved = resolveInstalledName(installed, model);
  rows.push(await benchModel(resolved));
}

const existing = merge && outPath && existsSync(outPath)
  ? parseBenchCsv(readFileSync(outPath, 'utf8'))
  : [];
const merged = merge ? mergeBenchRows(existing, rows) : rows;
const csv = formatBenchCsv(merged);

console.log(csv);
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, csv, 'utf8');
  console.error(`Wrote ${outPath} (${merged.length} rows, merge=${merge})`);
}
