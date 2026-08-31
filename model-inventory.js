/**
 * model-inventory.js — Unified LLM model inventory for HOOT Vitals.
 * Sources: Ollama tags, loaded models, GGUF files, LM Studio cache, settings, bench CSV.
 */

const fs = require('fs');
const path = require('path');
const { resolveOllamaBaseUrl } = require('./ollama-url');
const { loadBenchResults, findBenchRow, benchScoreAdjustment } = require('./bench-results');
const { discoverWeightFiles, listFixedDrives } = require('./model-discovery');
const { analyzeSafetensors } = require('./safetensors-advisor');

const QUANT_RE = /[-_.](Q[2-8](?:_[A-Z0-9_]+)?|q[2-8](?:_[a-z0-9_]+)?|IQ[1-4]_[A-Z0-9]+|f16|f32|fp16|fp32|bf16)(?:[-_.]|$)/i;

function familyKey(name) {
  let s = String(name || '').toLowerCase();
  s = s.replace(/\.gguf$/i, '');
  s = s.split(/[/\\]/).pop() || s;
  s = s.replace(QUANT_RE, '-');
  s = s.replace(/[:@].*$/, '');
  s = s.replace(/[-_.]+/g, '-').replace(/^-|-$/g, '');
  // strip common suffixes (possibly chained), ignoring trailing hyphens
  for (let i = 0; i < 6; i += 1) {
    const next = s
      .replace(/-(instruct|chat|it|abliterated|uncensored|latest|hf)$/i, '')
      .replace(/-+$/g, '');
    if (next === s) break;
    s = next;
  }
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s || String(name || '').toLowerCase();
}

function quantLabel(name) {
  const m = String(name || '').match(QUANT_RE);
  return m ? m[1].toUpperCase() : null;
}

function driveOf(p) {
  if (!p) return null;
  if (/^[A-Za-z]:/.test(p)) return p.slice(0, 2).toUpperCase();
  if (p.startsWith('/')) return '/';
  return null;
}

function safeStat(filePath) {
  try {
    const st = fs.statSync(filePath);
    return { size_bytes: st.size, modified_at: st.mtime.toISOString() };
  } catch {
    return { size_bytes: 0, modified_at: null };
  }
}

function parseOllamaListRaw(raw) {
  const names = [];
  if (!raw) return names;
  for (const line of String(raw).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || /^NAME\s+/i.test(t)) continue;
    const name = t.split(/\s+/)[0];
    if (name) names.push(name);
  }
  return names;
}

async function fetchOllamaTags(baseUrl) {
  const host = resolveOllamaBaseUrl(baseUrl);
  try {
    const res = await fetch(`${host}/api/tags`);
    if (!res.ok) return { ok: false, host, models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      ok: true,
      host,
      models: (data.models || []).map((m) => ({
        name: m.name,
        size: m.size || 0,
        digest: m.digest || null,
        modified_at: m.modified_at || null,
      })),
    };
  } catch (err) {
    return { ok: false, host, models: [], error: err.message };
  }
}

async function fetchOllamaPs(baseUrl) {
  const host = resolveOllamaBaseUrl(baseUrl);
  try {
    const res = await fetch(`${host}/api/ps`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => m.name || m.model).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Discover on-disk weight files (GGUF + large HF/ONNX/etc).
 * mode: 'quick' | 'exhaustive'
 */
function discoverOnDiskWeights(hootRoot, settings, scan, mode = 'quick') {
  return discoverWeightFiles({ hootRoot, settings, scan, mode });
}

function lmStudioModels(scan) {
  const backends = Array.isArray(scan?.local_models?.backends) ? scan.local_models.backends : [];
  const lm = backends.find((b) => b.id === 'lm-studio');
  if (!lm) return { present: false, models: [] };
  const models = Array.isArray(lm.models) ? lm.models : [];
  return {
    present: Boolean(lm.present),
    models: models.map((m) => ({
      name: m.name,
      path: m.path,
      size_bytes: m.size_mb ? Math.round(m.size_mb * 1e6) : 0,
    })),
  };
}

function profileModelRefs(listProfilesFn) {
  if (typeof listProfilesFn !== 'function') return [];
  const refs = [];
  try {
    for (const p of listProfilesFn() || []) {
      const model = p.meta?.model || p.model;
      const backend = p.meta?.backend || p.backend;
      if (model) refs.push({ profileId: p.id || p.meta?.id, model, backend });
    }
  } catch { /* ignore */ }
  return refs;
}

function attachBench(row, benchData) {
  const hit = findBenchRow(benchData?.rows || [], row.name)
    || findBenchRow(benchData?.rows || [], row.path_or_tag);
  if (!hit) return row;
  const adj = benchScoreAdjustment(hit);
  return {
    ...row,
    bench: {
      status: hit.status,
      tokens_per_sec: hit.tokens_per_sec,
      latency_ms: hit.latency_ms,
      tier: adj.tier,
    },
  };
}

function buildAdviseForRow(row, ctx) {
  const advise = [];
  if (row.backend === 'ollama') {
    const base = String(row.name || '').split(':')[0];
    advise.push({
      kind: 'update',
      title: 'Check Ollama library / pull latest tag',
      url: `https://ollama.com/library/${encodeURIComponent(base)}`,
      detail: `ollama pull ${row.name}`,
      command: `ollama pull ${row.name}`,
    });
  }
  if (row.backend === 'gguf-file' || row.backend === 'llamacpp') {
    advise.push({
      kind: 'configure',
      title: 'Use as HOOT llama.cpp model',
      detail: 'Set localInference.llamacpp.modelPath to this GGUF',
      action: 'set_llamacpp_model',
    });
    if (row.flags?.includes('duplicate')) {
      advise.push({
        kind: 'prune',
        title: 'Duplicate GGUF family — keep one quant for your VRAM',
        detail: 'Prefer a single quant matching free VRAM; remove extras after confirm.',
      });
    }
  }
  if (row.flags?.includes('orphan')) {
    advise.push({
      kind: 'bind',
      title: 'Not referenced by any HOOT profile',
      detail: 'Bind via Settings preferred model or a profile meta.model',
    });
  }
  if (row.flags?.includes('outdated_unknown')) {
    advise.push({
      kind: 'info',
      title: 'Freshness unknown',
      detail: 'No registry digest comparison available — use update link if you need newer weights.',
    });
  }
  if (ctx.rtk && !ctx.rtk.present) {
    // never "install separately" — HOOT provisions
    advise.push({
      kind: 'rtk',
      title: 'HOOT RTK will auto-provision',
      detail: 'Token compression ships with HOOT (bin/). No second product install.',
    });
  }
  return advise;
}

function flagDuplicates(rows) {
  const byFamily = new Map();
  const byBaseSize = new Map();
  for (const r of rows) {
    const fam = r.family || familyKey(r.name);
    if (!byFamily.has(fam)) byFamily.set(fam, []);
    byFamily.get(fam).push(r);
    if (r.size_bytes > 0) {
      const k = `${(r.name || '').toLowerCase().replace(/\.gguf$/i, '')}|${r.size_bytes}`;
      if (!byBaseSize.has(k)) byBaseSize.set(k, []);
      byBaseSize.get(k).push(r);
    }
  }
  const clusters = [];
  for (const [fam, group] of byFamily) {
    if (group.length < 2) continue;
    const backends = new Set(group.map((g) => g.backend));
    const paths = new Set(group.map((g) => g.path_or_tag));
    if (paths.size < 2 && backends.size < 2) continue;
    const id = `dup:${fam}`;
    for (const g of group) {
      g.flags = [...new Set([...(g.flags || []), 'duplicate'])];
      g.duplicate_cluster = id;
    }
    clusters.push({
      id,
      family: fam,
      count: group.length,
      model_ids: group.map((g) => g.id),
      reason: backends.size > 1 ? 'cross-backend family' : 'multi-path / multi-quant',
    });
  }
  return clusters;
}

function markOrphans(rows, profileRefs) {
  const used = new Set();
  for (const ref of profileRefs) {
    used.add(String(ref.model).toLowerCase());
    used.add(familyKey(ref.model));
  }
  for (const r of rows) {
    const hit = used.has(String(r.name).toLowerCase())
      || used.has(r.family)
      || (r.configured === true);
    if (!hit) r.flags = [...new Set([...(r.flags || []), 'orphan'])];
  }
}

function backendForWeightKind(kind, configured) {
  if (configured) return 'llamacpp';
  if (kind === 'gguf' || kind === 'ggml') return 'gguf-file';
  if (kind === 'safetensors') return 'hf-safetensors';
  if (kind === 'onnx') return 'onnx';
  if (kind === 'pytorch' || kind === 'checkpoint' || kind === 'bin-weights') return 'weight-file';
  return 'weight-file';
}

/**
 * Build full inventory.
 * @param {object} opts
 * @param {'quick'|'exhaustive'} [opts.mode]
 */
async function buildModelInventory(opts = {}) {
  const {
    hootRoot,
    settings = {},
    scan = null,
    listProfiles = null,
    ollamaHost = null,
    mode = 'quick',
  } = opts;

  const host = ollamaHost || settings?.localInference?.ollama?.host;
  const [tags, loaded] = await Promise.all([
    fetchOllamaTags(host),
    fetchOllamaPs(host),
  ]);
  const loadedSet = new Set(loaded.map((n) => String(n).toLowerCase()));
  // also from scan list if API empty
  if (!tags.models.length && scan?.ollama?.list_raw) {
    for (const name of parseOllamaListRaw(scan.ollama.list_raw)) {
      tags.models.push({ name, size: 0, digest: null, modified_at: null });
    }
    tags.ok = tags.models.length > 0;
  }

  const rows = [];
  for (const m of tags.models) {
    rows.push({
      id: `ollama:${m.name}`,
      backend: 'ollama',
      name: m.name,
      path_or_tag: m.name,
      drive: null,
      size_bytes: m.size || 0,
      digest_or_id: m.digest || null,
      modified_at: m.modified_at || null,
      loaded: loadedSet.has(String(m.name).toLowerCase()),
      family: familyKey(m.name),
      quant: quantLabel(m.name),
      configured: false,
      flags: [],
      used_by_profiles: [],
      used_by_projects: [],
      advise: [],
      weight_kind: 'ollama-tag',
    });
  }

  const disk = discoverOnDiskWeights(hootRoot, settings, scan, mode);
  const llamaPath = settings?.localInference?.llamacpp?.modelPath
    ? path.normalize(settings.localInference.llamacpp.modelPath)
    : null;
  for (const g of disk.files) {
    const configured = llamaPath && path.normalize(g.path) === llamaPath;
    const backend = backendForWeightKind(g.kind, configured);
    rows.push({
      id: `${g.kind}:${g.path}`,
      backend,
      name: g.name,
      path_or_tag: g.path,
      drive: driveOf(g.path),
      size_bytes: g.size_bytes || 0,
      digest_or_id: null,
      modified_at: g.modified_at,
      loaded: false,
      family: familyKey(g.name),
      quant: quantLabel(g.name),
      configured: Boolean(configured),
      flags: configured ? ['configured'] : [],
      used_by_profiles: [],
      used_by_projects: [],
      advise: [],
      weight_kind: g.kind,
      source_root: g.source_root || null,
    });
  }

  const lm = lmStudioModels(scan);
  for (const m of lm.models) {
    if (!m.path && !m.name) continue;
    const idPath = m.path || m.name;
    if (rows.some((r) => r.path_or_tag === m.path)) continue;
    rows.push({
      id: `lmstudio:${idPath}`,
      backend: 'lmstudio',
      name: m.name || path.basename(String(m.path || '')),
      path_or_tag: m.path || m.name,
      drive: driveOf(m.path),
      size_bytes: m.size_bytes || 0,
      digest_or_id: null,
      modified_at: null,
      loaded: false,
      family: familyKey(m.name || m.path),
      quant: quantLabel(m.name || m.path),
      configured: false,
      flags: lm.present ? [] : ['backend_offline'],
      used_by_profiles: [],
      used_by_projects: [],
      advise: [],
      weight_kind: 'lmstudio',
    });
  }

  const profileRefs = profileModelRefs(listProfiles);
  for (const r of rows) {
    r.used_by_profiles = profileRefs
      .filter((ref) => {
        const a = String(ref.model).toLowerCase();
        const b = String(r.name).toLowerCase();
        return a === b || familyKey(ref.model) === r.family || a.includes(b) || b.includes(a.split(':')[0]);
      })
      .map((ref) => ref.profileId)
      .filter(Boolean);
  }
  markOrphans(rows, profileRefs);
  const clusters = flagDuplicates(rows);

  // freshness: only mark unknown, never false outdated
  for (const r of rows) {
    if (r.backend === 'ollama' && !r.digest_or_id) {
      r.flags = [...new Set([...(r.flags || []), 'outdated_unknown'])];
    }
    if ((r.backend === 'gguf-file' || r.backend === 'llamacpp') && r.modified_at) {
      const ageDays = (Date.now() - new Date(r.modified_at).getTime()) / 86400000;
      if (ageDays > 180) r.flags = [...new Set([...(r.flags || []), 'stale_file'])];
    }
  }

  let benchData = { rows: [] };
  try {
    benchData = loadBenchResults();
  } catch { /* ignore */ }

  const rtk = opts.rtkStatus || null;
  const enriched = rows.map((r) => {
    let row = attachBench(r, benchData);
    row.advise = buildAdviseForRow(row, { rtk });
    return row;
  });

  const findings = buildAdviseFindings(enriched, clusters, { tags, rtk, lm });
  const safetensors = analyzeSafetensors(enriched);
  if (safetensors.summary.packages > 0) {
    findings.push({
      id: 'safetensors_packages',
      severity: safetensors.summary.quarantine_candidates > 0 ? 'medium' : 'info',
      title: `${safetensors.summary.packages} SafeTensors package(s) · ${safetensors.summary.files} files · ~${(safetensors.summary.total_bytes / 1e9).toFixed(1)} GB`,
      detail: `keep ${safetensors.summary.keep} · review ${safetensors.summary.review} · quarantine candidates ${safetensors.summary.quarantine_candidates}. Shards in one folder = one model — manage as a unit.`,
    });
  }

  const byBackend = enriched.reduce((acc, r) => {
    acc[r.backend] = (acc[r.backend] || 0) + 1;
    return acc;
  }, {});

  return {
    schema: 'hoot.model_inventory.v1',
    generated_at: new Date().toISOString(),
    mode,
    ollama: { ok: tags.ok, host: tags.host, error: tags.error || null, count: tags.models.length, loaded: loaded.length },
    coverage: {
      ...(disk.coverage || {}),
      drives_detected: listFixedDrives(),
    },
    counts: {
      total: enriched.length,
      ollama: enriched.filter((r) => r.backend === 'ollama').length,
      gguf: enriched.filter((r) => r.backend === 'gguf-file' || r.backend === 'llamacpp' || r.weight_kind === 'gguf').length,
      lmstudio: enriched.filter((r) => r.backend === 'lmstudio').length,
      safetensors: enriched.filter((r) => r.weight_kind === 'safetensors').length,
      other_weights: enriched.filter((r) => ['onnx', 'pytorch', 'checkpoint', 'bin-weights', 'weight-file', 'hf-safetensors'].includes(r.backend) || ['onnx', 'pytorch', 'checkpoint', 'bin-weights'].includes(r.weight_kind)).length,
      duplicates: clusters.length,
      orphans: enriched.filter((r) => r.flags?.includes('orphan')).length,
      by_backend: byBackend,
      safetensors_packages: safetensors.summary.packages,
    },
    models: enriched,
    duplicate_clusters: clusters,
    findings,
    safetensors,
  };
}

function buildAdviseFindings(rows, clusters, ctx = {}) {
  const findings = [];
  if (clusters.length) {
    findings.push({
      id: 'duplicates',
      severity: 'medium',
      title: `${clusters.length} duplicate model family cluster(s)`,
      detail: 'Same family across paths/backends burns disk and confuses defaults. Keep one quant per role.',
      model_ids: clusters.flatMap((c) => c.model_ids),
    });
  }
  const orphans = rows.filter((r) => r.flags?.includes('orphan'));
  if (orphans.length >= 3) {
    findings.push({
      id: 'orphans',
      severity: 'low',
      title: `${orphans.length} models not bound to HOOT profiles`,
      detail: 'Bind or prune to reduce footprint.',
      model_ids: orphans.map((o) => o.id),
    });
  }
  if (ctx.tags && !ctx.tags.ok) {
    findings.push({
      id: 'ollama_unreachable',
      severity: 'high',
      title: 'Ollama API unreachable',
      detail: ctx.tags.error || 'Start Ollama or fix host in Settings → Local Inference',
    });
  }
  if (ctx.rtk && !ctx.rtk.present) {
    findings.push({
      id: 'rtk_pending',
      severity: 'low',
      title: 'HOOT RTK binary not in bin/ yet',
      detail: 'Token compression is preinstalled with HOOT — open Vitals and use Refresh, or restart HOOT to auto-provision into HootAi/bin. Not a separate install.',
    });
  } else if (ctx.rtk?.present) {
    findings.push({
      id: 'rtk_ready',
      severity: 'info',
      title: 'HOOT RTK ready (bundled token compression)',
      detail: ctx.rtk.path || 'present',
    });
  }
  const stale = rows.filter((r) => r.flags?.includes('stale_file'));
  if (stale.length) {
    findings.push({
      id: 'stale_gguf',
      severity: 'low',
      title: `${stale.length} GGUF file(s) older than ~6 months`,
      detail: 'Consider refreshing weights if a newer quant exists for the same family.',
      model_ids: stale.map((s) => s.id),
    });
  }
  return findings;
}

function buildVitalsAdvise(inventory) {
  return {
    schema: 'hoot.vitals_advise.v1',
    generated_at: new Date().toISOString(),
    findings: inventory.findings || [],
    duplicate_clusters: inventory.duplicate_clusters || [],
    counts: inventory.counts || {},
  };
}

module.exports = {
  familyKey,
  quantLabel,
  buildModelInventory,
  buildVitalsAdvise,
  discoverOnDiskWeights,
  flagDuplicates,
  fetchOllamaTags,
};
