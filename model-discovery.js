/**
 * model-discovery.js — Exhaustive on-disk LLM weight discovery for HOOT Vitals.
 * Scans fixed drives + known caches for GGUF / HF / ONNX / large weight files.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/** Directories never entered (system / junk / huge non-model trees). */
const SKIP_DIR_NAMES = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'windows', 'system volume information', '$recycle.bin', 'recovery', 'perflogs',
  'msocache', 'config.msi', 'documents and settings',
  'programdata', // secrets/noise; hot roots still cover user caches
  'appdata', // skipped at drive-root walk; hot roots include specific AppData paths
  'temp', 'tmp', 'cache', // generic — hot roots still hit real model caches
  'winsxs', 'installer', 'packages', // Store packages noise unless hot-listed
  '.nuget', '.cargo', '.rustup', '.gradle', '.m2',
  'steamapps', 'steam', 'epic games', 'gog galaxy', 'origin games',
  'windowsapps', 'program files', 'program files (x86)',
  'boot', 'efi', 'intel', 'amd', 'nvidia',
  '__pycache__', '.venv', 'venv', '.tox', 'dist', 'build', 'target',
  'out', 'coverage', '.next', '.turbo',
]);

/** Media folders skipped only in quick mode (exhaustive still walks them). */
const QUICK_SKIP_EXTRA = new Set(['videos', 'music', 'pictures', 'movies', 'downloads']);

/** Dir names that look like model stores — deeper walk allowed. */
const MODELISH_DIR_RE = /^(models?|llms?|gguf|weights?|checkpoints?|huggingface|hf|lm[-_]?studio|ollama|transformers|diffusers|comfyui|automatic1111|stable-diffusion|text-generation|kobold|gpt4all|llama|mistral|qwen|gemma|phi|blobs|hub|safetensors)$/i;

const WEIGHT_RULES = [
  { ext: '.gguf', kind: 'gguf', minBytes: 1_000_000 },
  { ext: '.ggml', kind: 'ggml', minBytes: 1_000_000 },
  { ext: '.safetensors', kind: 'safetensors', minBytes: 40_000_000 },
  { ext: '.onnx', kind: 'onnx', minBytes: 20_000_000 },
  { ext: '.pt', kind: 'pytorch', minBytes: 50_000_000 },
  { ext: '.pth', kind: 'pytorch', minBytes: 50_000_000 },
  { ext: '.ckpt', kind: 'checkpoint', minBytes: 50_000_000 },
  { ext: '.bin', kind: 'bin-weights', minBytes: 80_000_000, nameRe: /model|weight|pytorch|ggml|llama|qwen|mistral|gemma|phi|bert|gpt/i },
];

function listFixedDrives() {
  const drives = [];
  if (process.platform === 'win32') {
    for (let i = 65; i <= 90; i += 1) {
      const letter = String.fromCharCode(i);
      const root = `${letter}:\\`;
      try {
        if (fs.existsSync(root)) drives.push(root);
      } catch { /* ignore */ }
    }
    // Also try PowerShell for network/mapped if letter loop missed
    try {
      const ps = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-Command', "Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object { $_.Root }"],
        { encoding: 'utf8', windowsHide: true, timeout: 8000 },
      );
      if (ps.status === 0 && ps.stdout) {
        for (const line of ps.stdout.split(/\r?\n/)) {
          const r = line.trim();
          if (r && !drives.includes(r) && fs.existsSync(r)) drives.push(r.endsWith('\\') ? r : `${r}\\`);
        }
      }
    } catch { /* ignore */ }
  } else {
    drives.push('/');
    for (const m of ['/mnt', '/media', '/Volumes', '/home']) {
      if (fs.existsSync(m)) drives.push(m);
    }
  }
  return [...new Set(drives)];
}

function safeStat(filePath) {
  try {
    const st = fs.statSync(filePath);
    return { size_bytes: st.size, modified_at: st.mtime.toISOString(), isDir: st.isDirectory(), isFile: st.isFile() };
  } catch {
    return null;
  }
}

function classifyWeightFile(fileName, sizeBytes) {
  const lower = fileName.toLowerCase();
  for (const rule of WEIGHT_RULES) {
    if (!lower.endsWith(rule.ext)) continue;
    if (sizeBytes < rule.minBytes) return null;
    if (rule.nameRe && !rule.nameRe.test(fileName)) return null;
    return rule.kind;
  }
  return null;
}

function shouldSkipDir(name, depth, exhaustive) {
  const n = String(name || '');
  const low = n.toLowerCase();
  if (SKIP_DIR_NAMES.has(low)) return true;
  if (!exhaustive && QUICK_SKIP_EXTRA.has(low)) return true;
  // Always enter model-ish caches under AppData when we reach them from hot roots
  if (n.startsWith('.') && depth > 0 && !MODELISH_DIR_RE.test(n)) {
    if (['.cache', '.ollama', '.local', '.config', '.huggingface'].includes(low)) return false;
    if (!exhaustive) return true;
    // exhaustive: still skip most dot dirs except known AI caches
    if (!['.cache', '.ollama', '.local', '.config', '.huggingface', '.lmstudio'].includes(low)) return true;
  }
  return false;
}

function hotRoots(hootRoot, settings = {}) {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const localApp = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const roaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const roots = [
    path.join(home, '.ollama'),
    path.join(home, '.ollama', 'models'),
    path.join(home, '.cache', 'huggingface'),
    path.join(home, '.cache', 'huggingface', 'hub'),
    path.join(home, '.cache', 'lm-studio'),
    path.join(home, '.cache', 'lm-studio', 'models'),
    path.join(home, '.cache', 'gpt4all'),
    path.join(home, 'models'),
    path.join(home, 'Models'),
    path.join(home, 'LLMs'),
    path.join(home, 'Documents', 'models'),
    path.join(home, 'Documents', 'Models'),
    path.join(localApp, 'nomic.ai', 'GPT4All'),
    path.join(roaming, 'llama.cpp'),
    path.join(home, '.local', 'share', 'SillyTavern'),
    'C:\\models',
    'C:\\LLMs',
    'C:\\AI',
    'C:\\LLM',
    'D:\\models',
    'D:\\Models',
    'D:\\LLMs',
    'D:\\LLM',
    'D:\\AI',
    'D:\\AI\\models',
    'D:\\gguf',
    'D:\\weights',
    'E:\\models',
    'E:\\LLMs',
    'E:\\AI',
    path.join(path.dirname(hootRoot || ''), 'models'),
    hootRoot,
    path.dirname(hootRoot || ''),
  ];
  const configured = settings?.localInference?.llamacpp?.modelPath;
  if (configured) roots.unshift(path.dirname(configured));
  // every fixed drive \models \LLMs \AI
  for (const d of listFixedDrives()) {
    roots.push(path.join(d, 'models'));
    roots.push(path.join(d, 'Models'));
    roots.push(path.join(d, 'LLMs'));
    roots.push(path.join(d, 'LLM'));
    roots.push(path.join(d, 'AI'));
    roots.push(path.join(d, 'gguf'));
    roots.push(path.join(d, 'weights'));
    roots.push(path.join(d, 'huggingface'));
  }
  return [...new Set(roots.filter((r) => r && fs.existsSync(r)))];
}

/**
 * BFS walk collecting weight files.
 */
function walkForWeights(root, options = {}) {
  const {
    maxDepth = 8,
    maxFiles = 500,
    deadlineMs = 60_000,
    exhaustive = false,
    label = root,
  } = options;
  const out = [];
  const start = Date.now();
  const queue = [{ dir: root, depth: 0 }];
  let dirsVisited = 0;
  let truncated = false;
  let reason = null;

  while (queue.length) {
    if (out.length >= maxFiles) {
      truncated = true;
      reason = 'max_files';
      break;
    }
    if (Date.now() - start > deadlineMs) {
      truncated = true;
      reason = 'deadline';
      break;
    }
    const { dir, depth } = queue.shift();
    dirsVisited += 1;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (out.length >= maxFiles) break;
      const name = ent.name;
      const full = path.join(dir, name);
      try {
        if (ent.isDirectory()) {
          if (depth >= maxDepth) continue;
          if (shouldSkipDir(name, depth, exhaustive)) continue;
          // At drive root (depth 0), still skip Windows-ish
          const low = name.toLowerCase();
          if (depth === 0 && (low === 'windows' || low === 'program files' || low === 'program files (x86)')) continue;
          // Deeper allowance for modelish dirs under exhaustive
          if (exhaustive && depth >= 4 && !MODELISH_DIR_RE.test(name) && !low.includes('model') && !low.includes('llm') && !low.includes('gguf')) {
            // still enter one more level if parent was modelish — otherwise skip deep non-model trees
            if (depth >= 6) continue;
          }
          queue.push({ dir: full, depth: depth + 1 });
        } else if (ent.isFile()) {
          const st = safeStat(full);
          if (!st || !st.isFile) continue;
          const kind = classifyWeightFile(name, st.size_bytes);
          if (!kind) continue;
          out.push({
            name,
            path: full,
            size_bytes: st.size_bytes,
            modified_at: st.modified_at,
            kind,
            source_root: label,
          });
        }
      } catch { /* skip */ }
    }
  }

  return {
    files: out,
    meta: {
      root,
      dirs_visited: dirsVisited,
      files_found: out.length,
      truncated,
      truncate_reason: reason,
      duration_ms: Date.now() - start,
      max_depth: maxDepth,
    },
  };
}

/**
 * @param {object} opts
 * @param {'quick'|'exhaustive'} [opts.mode]
 */
function discoverWeightFiles(opts = {}) {
  const {
    hootRoot,
    settings = {},
    mode = 'quick',
    scan = null,
  } = opts;
  const exhaustive = mode === 'exhaustive';
  const started = Date.now();
  const map = new Map(); // normalized path -> file
  const rootsMeta = [];
  const drives = listFixedDrives();

  // Seed from scanner snapshot
  if (Array.isArray(scan?.local_models?.discovered_ggufs)) {
    for (const g of scan.local_models.discovered_ggufs) {
      const p = g.path || g.fullPath;
      if (!p) continue;
      map.set(path.normalize(p), {
        name: g.name || path.basename(p),
        path: p,
        size_bytes: g.size_bytes || (g.size_mb ? Math.round(g.size_mb * 1e6) : 0),
        modified_at: g.modified_at || null,
        kind: 'gguf',
        source_root: 'scan-cache',
      });
    }
  }

  const hot = hotRoots(hootRoot, settings);
  for (const root of hot) {
    const result = walkForWeights(root, {
      maxDepth: exhaustive ? 16 : 8,
      maxFiles: exhaustive ? 5000 : 200,
      deadlineMs: exhaustive ? 180_000 : 15_000,
      exhaustive,
      label: `hot:${root}`,
    });
    rootsMeta.push(result.meta);
    for (const f of result.files) map.set(path.normalize(f.path), f);
  }

  if (exhaustive) {
    // Full drive roots — slower, broader; high caps so multi-TB disks still report
    for (const drive of drives) {
      const result = walkForWeights(drive, {
        maxDepth: 10,
        maxFiles: 8000,
        deadlineMs: 240_000,
        exhaustive: true,
        label: `drive:${drive}`,
      });
      rootsMeta.push(result.meta);
      for (const f of result.files) map.set(path.normalize(f.path), f);
    }
  } else {
    // Quick mode: hot roots only; coverage still lists all fixed drives detected
  }

  // Configured llama path
  const configured = settings?.localInference?.llamacpp?.modelPath;
  if (configured && fs.existsSync(configured)) {
    const st = safeStat(configured);
    if (st) {
      map.set(path.normalize(configured), {
        name: path.basename(configured),
        path: configured,
        size_bytes: st.size_bytes,
        modified_at: st.modified_at,
        kind: classifyWeightFile(path.basename(configured), st.size_bytes) || 'gguf',
        source_root: 'settings',
      });
    }
  }

  const files = [...map.values()];
  const byKind = files.reduce((acc, f) => {
    acc[f.kind] = (acc[f.kind] || 0) + 1;
    return acc;
  }, {});
  const byDrive = files.reduce((acc, f) => {
    const d = /^[A-Za-z]:/.test(f.path) ? f.path.slice(0, 2).toUpperCase() : (f.path.startsWith('/') ? '/' : '?');
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  return {
    mode,
    files,
    coverage: {
      mode,
      drives_detected: drives,
      hot_roots: hot,
      roots_scanned: rootsMeta.length,
      files_total: files.length,
      by_kind: byKind,
      by_drive: byDrive,
      truncated: rootsMeta.some((m) => m.truncated),
      roots_meta: rootsMeta,
      duration_ms: Date.now() - started,
    },
  };
}

module.exports = {
  listFixedDrives,
  hotRoots,
  discoverWeightFiles,
  classifyWeightFile,
  walkForWeights,
  WEIGHT_RULES,
  SKIP_DIR_NAMES,
};
