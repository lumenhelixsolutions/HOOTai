#!/usr/bin/env node
/**
 * bench-llamacpp.mjs — llama-bench subprocess for GGUF models (M18).
 * Usage: node scripts/bench-llamacpp.mjs [--model path/to/model.gguf] [--out state/bench-results.csv] [--merge]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseBenchCsv, mergeBenchRows, formatBenchCsv } = require('../bench-results.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const outPath = outFlag >= 0 ? args[outFlag + 1] : null;
const merge = args.includes('--merge') || Boolean(outPath);
const modelFlag = args.indexOf('--model');
let modelPath = modelFlag >= 0 ? args[modelFlag + 1] : null;

function loadSettingsModel() {
  try {
    const raw = readFileSync(join(root, 'state', 'user-settings.json'), 'utf8');
    const settings = JSON.parse(raw);
    return settings?.localInference?.llamacpp?.modelPath || null;
  } catch {
    return null;
  }
}

function findLlamaBench() {
  const candidates = process.platform === 'win32' ? ['llama-bench.exe', 'llama-bench'] : ['llama-bench'];
  for (const name of candidates) {
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (probe.status === 0 && probe.stdout?.trim()) {
      return probe.stdout.trim().split(/\r?\n/)[0];
    }
  }
  const winPaths = [
    'C:\\llama.cpp\\build\\bin\\Release\\llama-bench.exe',
    join(process.env.USERPROFILE || '', 'llama.cpp', 'build', 'bin', 'Release', 'llama-bench.exe'),
    // winget package layout
    join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages'),
  ];
  for (const p of winPaths) {
    if (!p) continue;
    if (p.endsWith('Packages') && existsSync(p)) {
      try {
        // Shallow search for llama-bench.exe under winget packages
        const { readdirSync, statSync } = require('node:fs');
        for (const entry of readdirSync(p)) {
          if (!/llamacpp|llama\.cpp|ggml/i.test(entry)) continue;
          const candidate = join(p, entry, 'llama-bench.exe');
          if (existsSync(candidate)) return candidate;
        }
      } catch { /* ignore */ }
    } else if (existsSync(p)) {
      return p;
    }
  }
  return null;
}

modelPath = modelPath || loadSettingsModel();
const benchBin = findLlamaBench();

function emit(rows) {
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
}

if (!benchBin) {
  emit([{
    model: 'llamacpp:gguf',
    status: 'missing',
    latency_ms: 0,
    tokens_per_sec: 0,
    note: 'llama-bench not found on PATH',
    backend: 'llamacpp',
  }]);
  process.exit(0);
}

if (!modelPath || !existsSync(modelPath)) {
  emit([{
    model: 'llamacpp:gguf',
    status: 'missing',
    latency_ms: 0,
    tokens_per_sec: 0,
    note: 'GGUF modelPath not set or file missing in user-settings',
    backend: 'llamacpp',
  }]);
  process.exit(0);
}

const start = performance.now();
const result = spawnSync(benchBin, ['-m', modelPath, '-n', '16', '-p', '128'], {
  encoding: 'utf8',
  timeout: 120000,
  windowsHide: true,
});
const elapsed = Math.round(performance.now() - start);

if (result.error || result.status !== 0) {
  emit([{
    model: `llamacpp:${basename(modelPath)}`,
    status: 'error',
    latency_ms: elapsed,
    tokens_per_sec: 0,
    note: (result.stderr || result.stdout || result.error?.message || 'llama-bench failed').trim().slice(0, 120),
    backend: 'llamacpp',
  }]);
  process.exit(0);
}

const output = `${result.stdout || ''}\n${result.stderr || ''}`;
const tpsMatch = output.match(/([\d.]+)\s*t\/s/i) || output.match(/tg\s+([\d.]+)/i);
const tps = tpsMatch ? Math.round(parseFloat(tpsMatch[1]) * 10) / 10 : 0;
emit([{
  model: `llamacpp:${basename(modelPath)}`,
  status: tps > 0 ? 'pass' : 'weak',
  latency_ms: elapsed,
  tokens_per_sec: tps,
  note: tps > 0 ? 'llama-bench' : 'could not parse tokens/s',
  backend: 'llamacpp',
}]);
