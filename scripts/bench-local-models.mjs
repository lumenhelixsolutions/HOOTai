#!/usr/bin/env node
/**
 * bench-local-models.mjs — Ollama model smoke benchmark for HOOT profile scoring.
 * Usage: node scripts/bench-local-models.mjs [model...]
 * Output: CSV rows to stdout; optional --out state/bench-results.csv
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { resolveOllamaBaseUrl } = require('../ollama-url.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ollamaHost = resolveOllamaBaseUrl(process.env.OLLAMA_HOST);
const models = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const outFlag = process.argv.indexOf('--out');
const outPath = outFlag >= 0 ? process.argv[outFlag + 1] : null;
const defaultModels = ['phi3:mini', 'qwen2.5:1.5b', 'smollm2:360m'];
const targets = models.length ? models : defaultModels;

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
    return { model: name, status: 'error', latency_ms: elapsed, tokens_per_sec: 0, note: await res.text() };
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
  };
}

const installed = await listModels();
const rows = [];
for (const model of targets) {
  if (!installed.has(model)) {
    rows.push({ model, status: 'missing', latency_ms: 0, tokens_per_sec: 0, note: 'not pulled' });
    continue;
  }
  rows.push(await benchModel(model));
}

const header = 'model,status,latency_ms,tokens_per_sec,note';
const csv = [header, ...rows.map((r) =>
  [r.model, r.status, r.latency_ms, r.tokens_per_sec, `"${String(r.note).replace(/"/g, '""')}"`].join(','),
)].join('\n');

console.log(csv);
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, csv + '\n', 'utf8');
  console.error(`Wrote ${outPath}`);
}