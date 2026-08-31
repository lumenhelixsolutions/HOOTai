/**
 * HOOT local brain resolver — Ollama / LM Studio / llama.cpp auto-selection for coach/mascot.
 * Prefers installed operator models (gemma4 first on this studio); live Ollama tags over stale scan.
 */

const { spawn } = require('child_process');
const { resolveOllamaBaseUrl } = require('./ollama-url');

/** Preferred pull when nothing is installed (8GB-class default). */
const DEFAULT_OLLAMA_MODEL = 'gemma4:latest';
const FALLBACK_PULL_MODELS = ['gemma4:latest', 'qwen2.5:1.5b', 'llama3.2:3b'];

/**
 * Ranked preference for local operator chat (higher = better).
 * gemma* first — matches studio inventory (gemma4:latest on Ollama).
 */
const OPERATOR_MODEL_PATTERNS = [
  /gemma4/i,
  /gemma3/i,
  /gemma/i,
  /qwen2\.5.*:(1\.5b|3b|7b)/i,
  /qwen2\.5/i,
  /qwen/i,
  /llama3\.2/i,
  /llama3\.1.*:8b/i,
  /llama3\.1/i,
  /llama3/i,
  /^phi/i,
  /smollm/i,
  /hermes/i,
];

// Back-compat export name used in tests/docs
const OPERATOR_MODEL_PATTERNS_LEGACY = OPERATOR_MODEL_PATTERNS;

let pullState = { model: null, startedAt: null, status: 'idle' };

function parseOllamaListRaw(raw) {
  if (!raw) return [];
  const models = [];
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^NAME\s+/i.test(trimmed)) continue;
    const name = trimmed.split(/\s+/)[0];
    if (name) models.push(name);
  }
  return models;
}

function installedOllamaModels(scan) {
  return parseOllamaListRaw(scan?.ollama?.list_raw);
}

function rankScore(name) {
  const n = String(name || '');
  for (let i = 0; i < OPERATOR_MODEL_PATTERNS.length; i += 1) {
    if (OPERATOR_MODEL_PATTERNS[i].test(n)) return OPERATOR_MODEL_PATTERNS.length - i;
  }
  // Prefer smaller tags for unknown models (heuristic: shorter name / smaller digit)
  if (/32b|70b|72b|405b/i.test(n)) return -10;
  return 1;
}

function bestOperatorModelFromList(models) {
  const list = [...new Set((models || []).filter(Boolean))];
  if (!list.length) return null;
  list.sort((a, b) => rankScore(b) - rankScore(a) || String(a).localeCompare(String(b)));
  return list[0];
}

function bestLoadedOperatorModel(scan) {
  return bestOperatorModelFromList(installedOllamaModels(scan));
}

function modelStillInstalled(name, installed) {
  if (!name) return false;
  const n = String(name).toLowerCase();
  return installed.some((m) => {
    const ml = String(m).toLowerCase();
    return ml === n || ml.startsWith(`${n.split(':')[0]}:`);
  });
}

function suggestLocalModels(installed = []) {
  const have = new Set(installed.map((m) => String(m).toLowerCase()));
  const suggestions = [];
  for (const tag of FALLBACK_PULL_MODELS) {
    const base = tag.split(':')[0].toLowerCase();
    const already = [...have].some((h) => h === tag.toLowerCase() || h.startsWith(`${base}:`));
    suggestions.push({
      tag,
      installed: already,
      reason: tag.startsWith('gemma')
        ? 'Best default operator brain for 8GB-class GPUs (studio pick)'
        : tag.includes('1.5b')
          ? 'Lightweight fallback if gemma is too heavy'
          : 'General small instruct fallback',
      recommended: !already && suggestions.filter((s) => !s.installed).length === 0,
    });
  }
  // Mark first not-installed as recommended
  const firstMissing = suggestions.find((s) => !s.installed);
  if (firstMissing) firstMissing.recommended = true;
  return suggestions;
}

function startOllamaPull(model = DEFAULT_OLLAMA_MODEL) {
  if (pullState.status === 'pulling' && pullState.model === model) return pullState;
  pullState = { model, startedAt: new Date().toISOString(), status: 'pulling' };
  const child = spawn('ollama', ['pull', model], { windowsHide: true, stdio: 'ignore' });
  child.on('close', (code) => {
    pullState.status = code === 0 ? 'done' : 'failed';
  });
  child.on('error', () => {
    pullState.status = 'failed';
  });
  return pullState;
}

function getPullState() {
  return { ...pullState };
}

function ollamaEndpoint(settings) {
  const host = settings?.localInference?.ollama?.host || 'http://127.0.0.1:11434';
  const base = resolveOllamaBaseUrl(host);
  return `${base}/v1/chat/completions`;
}

async function fetchLiveOllamaModels(settings) {
  const base = resolveOllamaBaseUrl(settings?.localInference?.ollama?.host);
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}`, host: base };
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name).filter(Boolean);
    return { ok: true, models, host: base };
  } catch (err) {
    return { ok: false, models: [], error: err.message, host: base };
  }
}

function lmstudioEndpoint(settings, scan) {
  const ls = settings?.localInference?.lmstudio || {};
  const backend = (scan?.local_models?.backends || []).find((b) => b.id === 'lm-studio');
  const protocol = ls.protocol || 'http';
  const host = ls.host || backend?.server?.host || '127.0.0.1';
  const port = ls.port || backend?.server?.port || 1234;
  const basePath = `/${String(ls.basePath || '/v1').replace(/^\/+/, '').replace(/\/$/, '')}`;
  return `${protocol}://${host}:${port}${basePath}/chat/completions`;
}

function llamacppEndpoint(settings, scan) {
  const lc = settings?.localInference?.llamacpp || {};
  const backend = (scan?.local_models?.backends || []).find((b) => b.id === 'llamacpp');
  const port = lc.port || backend?.server?.port || 8081;
  const host = lc.host || '127.0.0.1';
  return `http://${host}:${port}/v1/chat/completions`;
}

function lmstudioReachable(settings, scan) {
  const backend = (scan?.local_models?.backends || []).find((b) => b.id === 'lm-studio');
  return Boolean(backend?.server?.reachable || settings?.localInference?.lmstudio?.enabled);
}

function bestLmStudioModel(settings, scan) {
  const configured = String(settings?.localInference?.lmstudio?.defaultModel || '').trim();
  if (configured) return configured;
  const backend = (scan?.local_models?.backends || []).find((b) => b.id === 'lm-studio');
  const models = Array.isArray(backend?.models) ? backend.models : [];
  return models[0]?.name || null;
}

/**
 * Select best local brain given installed model list.
 */
function selectBestLocalBrain({ scan, settings, installedModels = null, autoPull = true } = {}) {
  const s = settings || {};
  const brainCfg = s.hoot_brain || {};
  const ollamaPresent = Boolean(scan?.tools?.ollama?.present) || (installedModels && installedModels.length > 0);
  const installed = installedModels || installedOllamaModels(scan);
  const configured = String(brainCfg.ollama_model || s.localInference?.ollama?.model || '').trim();
  const preferred = s.localInference?.preferredBackend || 'ollama';

  if (preferred === 'ollama' || !preferred) {
    if (configured && modelStillInstalled(configured, installed)) {
      return {
        provider: 'ollama',
        model: configured,
        endpoint: ollamaEndpoint(s),
        available: true,
        source: 'settings',
        ollamaPresent: true,
        installed,
        suggestions: suggestLocalModels(installed),
      };
    }
    const best = bestOperatorModelFromList(installed);
    if (best) {
      return {
        provider: 'ollama',
        model: best,
        endpoint: ollamaEndpoint(s),
        available: true,
        source: 'ranked-live',
        ollamaPresent: true,
        installed,
        suggestions: suggestLocalModels(installed),
      };
    }
    if (ollamaPresent && autoPull) {
      const pullTag = DEFAULT_OLLAMA_MODEL;
      const pull = startOllamaPull(pullTag);
      return {
        provider: 'ollama',
        model: pullTag,
        endpoint: ollamaEndpoint(s),
        available: false,
        source: 'auto-pull',
        pulling: true,
        pull,
        ollamaPresent: true,
        installed,
        suggestions: suggestLocalModels(installed),
      };
    }
  }
  return null;
}

function resolveHootBrain({ scan, settings, providerOverride, installedModels = null, autoPull = true } = {}) {
  const s = settings || {};
  const brainCfg = s.hoot_brain || {};
  let mode = String(providerOverride || brainCfg.mode || 'auto').toLowerCase();

  const ollamaPresent = Boolean(scan?.tools?.ollama?.present) || Boolean(installedModels?.length);
  const lmStudioBackend = (scan?.local_models?.backends || []).find((b) => b.id === 'lm-studio');
  const lmStudioPresent = Boolean(lmStudioBackend?.present);
  const lmStudioAvailable = lmstudioReachable(s, scan);
  const llamaBackend = (scan?.local_models?.backends || []).find((b) => b.id === 'llamacpp');
  const llamacppReachable = Boolean(llamaBackend?.server?.reachable || s.localInference?.llamacpp?.enabled);

  // Local-first: cloud mode only if explicitly forced; chat layer may still fallback
  if (mode === 'cloud') {
    const cloud = brainCfg.cloud_provider || 'gemini';
    // If Ollama has models, surface local as preferred alternative for migration
    const localAlt = selectBestLocalBrain({ scan, settings, installedModels, autoPull: false });
    return {
      provider: cloud,
      model: null,
      endpoint: null,
      available: false,
      source: 'cloud-settings',
      local_alternative: localAlt,
      suggestions: suggestLocalModels(installedModels || installedOllamaModels(scan)),
    };
  }

  if (mode === 'lmstudio' || mode === 'lm-studio' || (mode === 'auto' && !ollamaPresent && lmStudioPresent)) {
    return {
      provider: 'lmstudio',
      model: bestLmStudioModel(s, scan) || 'local-model',
      endpoint: lmstudioEndpoint(s, scan),
      available: lmStudioAvailable,
      source: lmStudioAvailable ? 'lm-studio' : 'lm-studio-config',
      lmStudioPresent,
      suggestions: suggestLocalModels(installedModels || installedOllamaModels(scan)),
    };
  }

  if (mode === 'ollama' || (mode === 'auto' && ollamaPresent) || mode === 'auto') {
    const local = selectBestLocalBrain({ scan, settings, installedModels, autoPull });
    if (local) return local;
    if (mode === 'ollama') {
      return {
        provider: 'ollama',
        model: DEFAULT_OLLAMA_MODEL,
        endpoint: ollamaEndpoint(s),
        available: false,
        source: 'missing-ollama',
        suggestions: suggestLocalModels([]),
      };
    }
  }

  if (mode === 'llamacpp' || (mode === 'auto' && llamacppReachable)) {
    return {
      provider: 'llamacpp',
      model: s.localInference?.llamacpp?.modelPath ? 'local-gguf' : 'default',
      endpoint: llamacppEndpoint(s, scan),
      available: llamacppReachable,
      source: 'llamacpp',
    };
  }

  return {
    provider: 'coach-local',
    model: null,
    endpoint: null,
    available: false,
    source: 'rules',
    suggestions: suggestLocalModels(installedModels || installedOllamaModels(scan)),
  };
}

/**
 * Async brain resolve with live Ollama /api/tags (preferred for coach + chat).
 */
async function resolveHootBrainAsync({ scan, settings, providerOverride, autoPull = true } = {}) {
  const live = await fetchLiveOllamaModels(settings);
  const installed = live.ok && live.models.length
    ? live.models
    : installedOllamaModels(scan);
  // Patch scan tools.ollama present if live tags work
  const scan2 = scan
    ? {
        ...scan,
        tools: {
          ...(scan.tools || {}),
          ollama: {
            ...(scan.tools?.ollama || {}),
            present: Boolean(scan.tools?.ollama?.present || live.ok),
          },
        },
      }
    : scan;
  const brain = resolveHootBrain({
    scan: scan2,
    settings,
    providerOverride,
    installedModels: installed,
    autoPull,
  });
  return {
    ...brain,
    live_ollama: { ok: live.ok, host: live.host, count: installed.length, error: live.error || null },
    installed_models: installed,
  };
}

/**
 * One-time / soft migration: if cloud mode blocks local while Ollama is healthy, flip to auto + best model.
 * Returns { settings, migrated, reason } — caller persists settings if migrated.
 */
function migrateBrainSettingsIfNeeded(settings, { scan, installedModels } = {}) {
  const s = settings || {};
  const brain = { ...(s.hoot_brain || {}) };
  const mode = String(brain.mode || 'auto').toLowerCase();
  const installed = installedModels || installedOllamaModels(scan);
  const ollamaPresent = Boolean(scan?.tools?.ollama?.present) || installed.length > 0;
  if (!ollamaPresent || !installed.length) {
    return { settings: s, migrated: false };
  }
  const best = bestOperatorModelFromList(installed);
  let migrated = false;
  const reasons = [];

  if (mode === 'cloud') {
    brain.mode = 'auto';
    migrated = true;
    reasons.push('cloud→auto: local Ollama models available for mascot');
  }
  if (!brain.ollama_model || !modelStillInstalled(brain.ollama_model, installed)) {
    if (best) {
      brain.ollama_model = best;
      migrated = true;
      reasons.push(`set ollama_model=${best}`);
    }
  }
  if (!migrated) return { settings: s, migrated: false };

  return {
    settings: {
      ...s,
      hoot_brain: brain,
      localInference: {
        ...(s.localInference || {}),
        preferredBackend: s.localInference?.preferredBackend || 'ollama',
      },
    },
    migrated: true,
    reason: reasons.join('; '),
    model: brain.ollama_model,
  };
}

module.exports = {
  DEFAULT_OLLAMA_MODEL,
  FALLBACK_PULL_MODELS,
  OPERATOR_MODEL_PATTERNS,
  OPERATOR_MODEL_PATTERNS_LEGACY,
  parseOllamaListRaw,
  installedOllamaModels,
  bestOperatorModelFromList,
  bestLoadedOperatorModel,
  rankScore,
  suggestLocalModels,
  selectBestLocalBrain,
  startOllamaPull,
  getPullState,
  ollamaEndpoint,
  lmstudioEndpoint,
  llamacppEndpoint,
  fetchLiveOllamaModels,
  resolveHootBrain,
  resolveHootBrainAsync,
  migrateBrainSettingsIfNeeded,
};
