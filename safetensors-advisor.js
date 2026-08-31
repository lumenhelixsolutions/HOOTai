/**
 * safetensors-advisor.js — Group + classify SafeTensors packages for safe management.
 * Never hard-deletes by default: quarantine → recycle path with undo log.
 */

const fs = require('fs');
const path = require('path');

const SHARD_PATTERNS = [
  /^out-(\d+)\.safetensors$/i,
  /^model-(\d+)-of-(\d+)\.safetensors$/i,
  /^pytorch_model-(\d+)-of-(\d+)\.safetensors$/i,
  /^diffusion_pytorch_model(?:-(\d+)-of-(\d+))?\.safetensors$/i,
  /^.*-(\d{5})-of-(\d{5})\.safetensors$/i,
];

function isSafetensorsRow(row) {
  return row?.weight_kind === 'safetensors'
    || row?.backend === 'hf-safetensors'
    || /\.safetensors$/i.test(row?.name || row?.path_or_tag || '');
}

function parseShard(name) {
  const n = String(name || '');
  for (const re of SHARD_PATTERNS) {
    const m = n.match(re);
    if (!m) continue;
    if (re.source.includes('of')) {
      return {
        kind: 'numbered-of',
        index: Number(m[1] || m[2] || 0),
        total: Number(m[2] || m[3] || 0) || null,
      };
    }
    return { kind: 'out-index', index: Number(m[1]), total: null };
  }
  if (/^model\.safetensors$/i.test(n)) return { kind: 'single', index: 0, total: 1 };
  return { kind: 'named', index: null, total: null };
}

function packageHints(dir) {
  const hints = {
    has_config: false,
    has_tokenizer: false,
    has_index_json: false,
    has_readme: false,
    has_gguf_sibling: false,
    hf_hub_style: false,
    labels: [],
  };
  if (!dir || !fs.existsSync(dir)) return hints;
  try {
    const names = fs.readdirSync(dir);
    for (const name of names) {
      const low = name.toLowerCase();
      if (low === 'config.json' || low === 'model_index.json') hints.has_config = true;
      if (low.includes('tokenizer')) hints.has_tokenizer = true;
      if (low.includes('model.safetensors.index') || low.endsWith('.index.json')) hints.has_index_json = true;
      if (low === 'readme.md' || low === 'modelcard.md') hints.has_readme = true;
      if (low.endsWith('.gguf')) hints.has_gguf_sibling = true;
    }
  } catch { /* ignore */ }
  const base = path.basename(dir);
  if (/^models--/.test(base) || dir.includes(`${path.sep}hub${path.sep}`) || dir.includes(`${path.sep}huggingface${path.sep}`)) {
    hints.hf_hub_style = true;
    hints.labels.push('huggingface-hub');
  }
  if (/comfy|diffusers|stable.?diffusion|sdxl|flux/i.test(dir)) hints.labels.push('image-gen');
  if (/glm|llama|qwen|mistral|gemma|phi|deepseek/i.test(dir + base)) hints.labels.push('llm-weights');
  return hints;
}

function classifyPackage(pkg) {
  const { files, hints, shards } = pkg;
  const totalBytes = files.reduce((s, f) => s + (Number(f.size_bytes) || 0), 0);
  const shardCount = shards.filter((s) => s.kind === 'out-index' || s.kind === 'numbered-of').length;
  const declaredTotal = shards.map((s) => s.total).find((t) => t && t > 0) || null;

  let usefulness = 'unknown';
  let verdict = 'review';
  let confidence = 'medium';
  const reasons = [];

  if (shardCount >= 2) {
    usefulness = 'sharded_model_package';
    reasons.push(`${shardCount} shard files in one folder (~${(totalBytes / 1e9).toFixed(1)} GB)`);
    if (declaredTotal && shardCount < declaredTotal) {
      usefulness = 'incomplete_shards';
      verdict = 'quarantine_candidate';
      confidence = 'high';
      reasons.push(`incomplete: found ${shardCount} of declared ${declaredTotal}`);
    } else if (hints.has_config || hints.has_index_json || hints.has_tokenizer) {
      verdict = 'keep';
      confidence = 'high';
      reasons.push('sidecar config/tokenizer/index present — likely a full weight pack');
    } else if (shardCount >= 8) {
      verdict = 'keep';
      confidence = 'medium';
      reasons.push('large contiguous shard set — treat as one model (e.g. GLM/Qwen export), not junk');
    } else {
      verdict = 'review';
      reasons.push('sharded pack without config.json — keep until you know the runtime that loads it');
    }
  } else if (files.length === 1 && shards[0]?.kind === 'single') {
    usefulness = 'single_file_model';
    if (hints.has_config) {
      verdict = 'keep';
      confidence = 'high';
      reasons.push('model.safetensors + config — standard HF layout');
    } else {
      verdict = 'review';
      reasons.push('lone model.safetensors — useful if a tool points at this path');
    }
  } else if (files.length === 1) {
    usefulness = 'loose_weight';
    verdict = 'review';
    reasons.push('single named safetensors — may be LoRA, VAE, or partial export');
  } else {
    usefulness = 'mixed_package';
    verdict = 'review';
    reasons.push(`${files.length} safetensors without clear shard pattern`);
  }

  if (hints.hf_hub_style) {
    reasons.push('Hugging Face hub cache path');
    if (verdict === 'quarantine_candidate') {
      /* keep quarantine if incomplete */
    } else {
      verdict = 'keep';
      confidence = 'high';
    }
  }
  if (hints.labels.includes('image-gen')) {
    reasons.push('image-generation stack (Comfy/diffusers-style path)');
  }
  if (hints.has_gguf_sibling) {
    reasons.push('GGUF sibling in same folder — prefer GGUF for HOOT llama.cpp; safetensors may be source only');
  }

  // Never mark multi-GB complete shards as junk just because HOOT doesn't load them
  if (verdict === 'quarantine_candidate' && totalBytes > 20e9 && !declaredTotal) {
    verdict = 'keep';
    reasons.push('very large package — default to keep (not HOOT-native, still valuable)');
  }

  return {
    usefulness,
    verdict, // keep | review | quarantine_candidate
    confidence,
    reasons,
    total_bytes: totalBytes,
    shard_count: shardCount,
    declared_total: declaredTotal,
  };
}

/**
 * Build safetensors package report from inventory model rows.
 */
function analyzeSafetensors(models = []) {
  const rows = (models || []).filter(isSafetensorsRow);
  const byDir = new Map();

  for (const row of rows) {
    const filePath = row.path_or_tag || row.path;
    if (!filePath) continue;
    // Windows is case-insensitive — normalize so D:\models and D:\Models merge
    let dir = path.dirname(path.normalize(filePath));
    if (process.platform === 'win32') dir = dir.replace(/^([A-Za-z]):/, (_, d) => `${d.toUpperCase()}:`);
    // Prefer realpath when available to collapse aliases
    try {
      if (fs.existsSync(dir)) dir = fs.realpathSync.native ? fs.realpathSync.native(dir) : fs.realpathSync(dir);
    } catch { /* keep normalized */ }
    if (process.platform === 'win32') dir = dir.replace(/\\/g, '\\');
    const key = process.platform === 'win32' ? dir.toLowerCase() : dir;
    if (!byDir.has(key)) byDir.set(key, { dir, files: [] });
    byDir.get(key).files.push(row);
  }

  const packages = [];
  for (const { dir, files: fileRows } of byDir.values()) {
    // Dedupe files by lowercase path (Windows)
    const seen = new Set();
    const files = [];
    for (const f of fileRows) {
      const p = String(f.path_or_tag || f.path || '').toLowerCase();
      if (seen.has(p)) continue;
      seen.add(p);
      files.push(f);
    }
    const shards = files.map((f) => ({ name: f.name, ...parseShard(f.name) }));
    const hints = packageHints(dir);
    const pkg = {
      id: `stpkg:${dir}`,
      path: dir,
      drive: /^[A-Za-z]:/.test(dir) ? dir.slice(0, 2).toUpperCase() : null,
      file_count: files.length,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path_or_tag || f.path,
        size_bytes: f.size_bytes || 0,
        modified_at: f.modified_at || null,
      })),
      shards,
      hints,
    };
    const classification = classifyPackage(pkg);
    packages.push({
      ...pkg,
      ...classification,
      advise: buildPackageAdvise({ ...pkg, ...classification }),
    });
  }

  packages.sort((a, b) => (b.total_bytes || 0) - (a.total_bytes || 0));

  const summary = {
    packages: packages.length,
    files: rows.length,
    keep: packages.filter((p) => p.verdict === 'keep').length,
    review: packages.filter((p) => p.verdict === 'review').length,
    quarantine_candidates: packages.filter((p) => p.verdict === 'quarantine_candidate').length,
    total_bytes: packages.reduce((s, p) => s + (p.total_bytes || 0), 0),
  };

  return {
    schema: 'hoot.safetensors_advise.v1',
    generated_at: new Date().toISOString(),
    summary,
    packages,
    policy: {
      default: 'advise-only',
      delete: 'never auto — quarantine with confirm + undo log only',
      note: 'Sharded packs (out-000xx / model-00001-of-N) are ONE model. Do not delete individual shards.',
    },
  };
}

function buildPackageAdvise(pkg) {
  const items = [];
  if (pkg.verdict === 'keep') {
    items.push({
      kind: 'keep',
      title: 'Keep this package',
      detail: pkg.reasons.join(' · '),
    });
  }
  if (pkg.verdict === 'review') {
    items.push({
      kind: 'review',
      title: 'Review before removing',
      detail: 'Not used by HOOT Ollama path, but may power ComfyUI, transformers, or future GGUF conversion.',
    });
  }
  if (pkg.verdict === 'quarantine_candidate') {
    items.push({
      kind: 'quarantine',
      title: 'Safe to quarantine (incomplete or broken)',
      detail: 'Moves whole folder to HOOT quarantine — not permanent delete. Requires confirm.',
      action: 'quarantine_package',
      risk: 'high',
    });
  }
  if (pkg.shard_count >= 2) {
    items.push({
      kind: 'info',
      title: 'Treat shards as a unit',
      detail: `Deleting one of ${pkg.shard_count} shards will break the model. Always manage the folder.`,
    });
  }
  if (pkg.hints?.has_gguf_sibling) {
    items.push({
      kind: 'info',
      title: 'GGUF also present',
      detail: 'For HOOT local chat prefer GGUF/Ollama; safetensors can stay for conversion/export.',
    });
  }
  return items;
}

function quarantineDir(hootRoot) {
  return path.join(hootRoot, 'state', 'quarantine-weights');
}

function loadQuarantineLog(hootRoot) {
  const file = path.join(hootRoot, 'state', 'quarantine-weights-log.json');
  try {
    if (!fs.existsSync(file)) return { version: 1, entries: [] };
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { version: 1, entries: [] };
  }
}

function saveQuarantineLog(hootRoot, log) {
  const file = path.join(hootRoot, 'state', 'quarantine-weights-log.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
}

/**
 * Move an entire package directory into quarantine (safe).
 */
function quarantinePackage(hootRoot, packagePath, { confirm = false, reason = '' } = {}) {
  if (!confirm) {
    return { ok: false, error: 'confirm:true required', risk: 'high' };
  }
  const src = path.normalize(packagePath);
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    return { ok: false, error: 'package path not found or not a directory' };
  }
  // Safety: only allow quarantine of dirs that contain safetensors
  let hasSt = false;
  try {
    for (const name of fs.readdirSync(src)) {
      if (/\.safetensors$/i.test(name)) { hasSt = true; break; }
    }
  } catch {
    return { ok: false, error: 'cannot read package directory' };
  }
  if (!hasSt) {
    return { ok: false, error: 'refusing: directory has no .safetensors files' };
  }

  const qRoot = quarantineDir(hootRoot);
  fs.mkdirSync(qRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destName = `${path.basename(src)}__${stamp}`;
  const dest = path.join(qRoot, destName);

  fs.renameSync(src, dest);

  const entry = {
    id: `q-${Date.now()}`,
    at: new Date().toISOString(),
    from: src,
    to: dest,
    reason: reason || 'operator quarantine',
    restored: false,
  };
  const log = loadQuarantineLog(hootRoot);
  log.entries.unshift(entry);
  log.entries = log.entries.slice(0, 100);
  saveQuarantineLog(hootRoot, log);

  return { ok: true, action: 'quarantine_package', entry };
}

function restoreQuarantine(hootRoot, entryId, { confirm = false } = {}) {
  if (!confirm) return { ok: false, error: 'confirm:true required' };
  const log = loadQuarantineLog(hootRoot);
  const entry = (log.entries || []).find((e) => e.id === entryId);
  if (!entry || entry.restored) return { ok: false, error: 'entry not found or already restored' };
  if (!fs.existsSync(entry.to)) return { ok: false, error: 'quarantine path missing' };
  if (fs.existsSync(entry.from)) return { ok: false, error: 'original path already exists — move manually' };
  fs.mkdirSync(path.dirname(entry.from), { recursive: true });
  fs.renameSync(entry.to, entry.from);
  entry.restored = true;
  entry.restored_at = new Date().toISOString();
  saveQuarantineLog(hootRoot, log);
  return { ok: true, action: 'restore_quarantine', entry };
}

module.exports = {
  analyzeSafetensors,
  quarantinePackage,
  restoreQuarantine,
  loadQuarantineLog,
  parseShard,
  classifyPackage,
  isSafetensorsRow,
};
