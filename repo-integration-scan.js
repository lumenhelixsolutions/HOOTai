/**
 * repo-integration-scan.js — Suggest HOOT module/plugin/prefab integrations per repo.
 * Reuses modules-catalog, mcp-catalog, prefab patterns — no second plugin system.
 */

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'target', 'ui', 'vendor',
  '.venv', 'venv', '__pycache__', '.tox', 'coverage', '.next',
]);

function readText(file, max = 200000) {
  try {
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > max) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function loadJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function listChildRepos(root, { max = 80 } = {}) {
  if (!exists(root)) return [];
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !SKIP_DIRS.has(d.name))
      .slice(0, max)
      .map((d) => path.join(root, d.name));
  } catch {
    return [];
  }
}

function probeRepo(repoPath) {
  const name = path.basename(repoPath);
  const signals = {
    path: repoPath,
    name,
    has_git: exists(path.join(repoPath, '.git')),
    has_package_json: exists(path.join(repoPath, 'package.json')),
    has_pyproject: exists(path.join(repoPath, 'pyproject.toml')),
    has_cargo: exists(path.join(repoPath, 'Cargo.toml')) || exists(path.join(repoPath, 'src-tauri', 'Cargo.toml')),
    has_agents_md: exists(path.join(repoPath, 'AGENTS.md')) || exists(path.join(repoPath, 'agents.md')),
    has_claude: exists(path.join(repoPath, 'CLAUDE.md')) || exists(path.join(repoPath, '.claude')),
    has_codex: exists(path.join(repoPath, '.codex')) || exists(path.join(repoPath, 'AGENTS.md')),
    has_mcp_json: exists(path.join(repoPath, '.mcp.json'))
      || exists(path.join(repoPath, '.cursor', 'mcp.json'))
      || exists(path.join(repoPath, 'mcp.json')),
    has_agentdock: exists(path.join(repoPath, '.agentdock')),
    has_skills: exists(path.join(repoPath, 'skills')) || exists(path.join(repoPath, '.claude', 'skills')),
    has_tauri: exists(path.join(repoPath, 'src-tauri')),
    has_dockerfile: exists(path.join(repoPath, 'Dockerfile')) || exists(path.join(repoPath, 'docker-compose.yml')),
  };

  const textBlobs = [];
  for (const rel of ['AGENTS.md', 'README.md', 'package.json', 'pyproject.toml', 'CLAUDE.md']) {
    const t = readText(path.join(repoPath, rel), 120000);
    if (t) textBlobs.push(t.slice(0, 80000));
  }
  const blob = textBlobs.join('\n').toLowerCase();

  signals.mentions = {
    ollama: /\bollama\b/.test(blob),
    llamacpp: /llama\.cpp|llama-server|gguf/.test(blob),
    rtk: /\brtk\b|token.?efficien/.test(blob),
    mcp: /\bmcp\b|model context protocol/.test(blob),
    compound: /compound.?engineering|everyinc/.test(blob),
    cineforge: /cineforge|shot.?graph|lookbook/.test(blob),
    notebooklm: /notebooklm|notetoolslm/.test(blob),
    playwright: /playwright/.test(blob),
    fastapi: /fastapi/.test(blob),
    nextjs: /next\.js|"next"/.test(blob) || /"next"/.test(blob),
    vitest: /vitest/.test(blob),
    pytest: /pytest/.test(blob),
  };

  if (signals.has_package_json) {
    const pkg = loadJson(path.join(repoPath, 'package.json'), {});
    signals.npm_name = pkg.name || null;
    signals.npm_scripts = Object.keys(pkg.scripts || {});
  }

  return signals;
}

/**
 * Map signals → integration candidates against modules catalog + mcp + prefabs.
 */
function matchIntegrations(signals, catalogs) {
  const { modules = [], mcpServers = [], rtkStatus = null } = catalogs;
  const candidates = [];
  const push = (c) => {
    candidates.push({
      repo: signals.name,
      repo_path: signals.path,
      confidence: c.confidence || 'medium',
      ...c,
    });
  };

  const ce = modules.find((m) => m.id === 'compound-engineering');
  if (ce && (signals.has_claude || signals.has_codex || signals.mentions.compound || signals.has_agents_md)) {
    push({
      id: `${signals.name}:compound-engineering`,
      opportunity: 'Compound Engineering skills/agents pack',
      module_id: 'compound-engineering',
      integration_type: 'module',
      confidence: signals.mentions.compound || signals.has_claude ? 'high' : 'medium',
      detail: 'Matches Claude/Codex/AGENTS surface — use Modules full-setup / install targets.',
      actions: [
        { label: 'Open Modules', type: 'navigate', target: '/modules' },
        { label: 'Install plan', type: 'api', method: 'GET', path: `/api/modules/${encodeURIComponent('compound-engineering')}/install-plan` },
      ],
    });
  }

  if (signals.has_git && mcpServers.some((s) => s.id === 'git')) {
    push({
      id: `${signals.name}:mcp-git`,
      opportunity: 'MCP git server (allowlisted)',
      module_id: null,
      mcp_id: 'git',
      integration_type: 'mcp',
      confidence: 'high',
      detail: 'Repo has .git — scope mcp-server-git to this path only (never whole drive).',
      actions: [
        { label: 'MCP catalog', type: 'navigate', target: '/settings' },
      ],
    });
  }

  if (signals.has_mcp_json) {
    push({
      id: `${signals.name}:mcp-review`,
      opportunity: 'Review existing MCP client config',
      integration_type: 'mcp-audit',
      confidence: 'high',
      detail: 'Project already declares MCP config — reconcile with HOOT allowlist; disable handshake-dead servers.',
      actions: [{ label: 'Settings / MCP', type: 'navigate', target: '/settings' }],
    });
  }

  // RTK: never "install as second product" — enable HOOT bundled RTK
  if (signals.has_claude || signals.has_codex || signals.mentions.rtk || signals.has_agents_md) {
    const ready = rtkStatus?.present;
    push({
      id: `${signals.name}:hoot-rtk`,
      opportunity: ready
        ? 'HOOT RTK token compression (already preinstalled)'
        : 'Enable HOOT-bundled RTK (auto-provisioned — not a separate install)',
      integration_type: 'token-efficiency',
      confidence: 'high',
      detail: ready
        ? `Use HOOT bin RTK at ${rtkStatus.path}. Tag profiles token_efficiency: rtk.`
        : 'HOOT provisions RTK into HootAi/bin on start. No curl|sh second install required for HOOT-managed flows.',
      actions: [
        { label: 'Vitals', type: 'navigate', target: '/vitals' },
        { label: 'Ensure RTK', type: 'api', method: 'POST', path: '/api/vitals/rtk/ensure' },
      ],
    });
  }

  if (signals.mentions.ollama || signals.mentions.llamacpp) {
    push({
      id: `${signals.name}:local-inference`,
      opportunity: 'Bind local models via Vitals / Local Inference settings',
      integration_type: 'local-inference',
      confidence: 'medium',
      detail: 'Docs mention Ollama/GGUF — inventory models on Vitals and set preferred backend.',
      actions: [
        { label: 'Vitals models', type: 'navigate', target: '/vitals' },
        { label: 'Settings', type: 'navigate', target: '/settings' },
      ],
    });
  }

  if (signals.has_tauri || signals.mentions.cineforge || /cineforge|lookbook|shot/i.test(signals.name)) {
    push({
      id: `${signals.name}:media-pipeline`,
      opportunity: 'Media/pipeline prefab (local or hybrid)',
      integration_type: 'prefab',
      confidence: signals.has_tauri || signals.mentions.cineforge ? 'high' : 'low',
      detail: 'Use Stack Builder local/hybrid prefab; keep MCP allowlist tight.',
      actions: [{ label: 'Build prefabs', type: 'navigate', target: '/builder' }],
    });
  }

  if (signals.has_agentdock || signals.has_skills) {
    push({
      id: `${signals.name}:project-brain`,
      opportunity: 'Project-brain / multi-agent convention present',
      integration_type: 'convention',
      confidence: 'medium',
      detail: 'Align with HOOT project registry + Coach context; no extra plugin runtime needed.',
      actions: [{ label: 'Portfolio', type: 'navigate', target: '/portfolio' }],
    });
  }

  if (signals.has_package_json && (signals.mentions.nextjs || signals.mentions.vitest)) {
    push({
      id: `${signals.name}:web-stack`,
      opportunity: 'Node web stack — shell-heavy agents benefit from HOOT RTK',
      integration_type: 'token-efficiency',
      confidence: 'medium',
      detail: 'npm test/build output is token-heavy; HOOT RTK compresses agent shell traffic.',
      actions: [{ label: 'Ensure RTK', type: 'api', method: 'POST', path: '/api/vitals/rtk/ensure' }],
    });
  }

  if (signals.has_pyproject && signals.mentions.pytest) {
    push({
      id: `${signals.name}:python-pytest`,
      opportunity: 'Python test stack — pair with local model profiles',
      integration_type: 'prefab',
      confidence: 'low',
      detail: 'Prefer local Ollama profiles for iterative pytest loops when privacy matters.',
      actions: [{ label: 'Profiles', type: 'navigate', target: '/profiles' }],
    });
  }

  return candidates;
}

function resolveScanTargets(opts) {
  const {
    scope = 'active',
    path: explicitPath = null,
    activeProject = null,
    portfolioRoot = null,
    registryProjects = [],
    maxRepos = 40,
  } = opts;

  if (scope === 'path' && explicitPath) {
    return [explicitPath].filter((p) => exists(p));
  }
  if (scope === 'active') {
    if (activeProject && exists(activeProject)) return [activeProject];
    return [];
  }
  // portfolio
  const fromRegistry = (registryProjects || [])
    .map((p) => p.path || p)
    .filter((p) => typeof p === 'string' && exists(p));
  if (fromRegistry.length) return fromRegistry.slice(0, maxRepos);
  if (portfolioRoot && exists(portfolioRoot)) {
    return listChildRepos(portfolioRoot, { max: maxRepos });
  }
  return [];
}

/**
 * @param {object} opts
 * @returns {{ schema, scanned_at, scope, repos, candidates, counts }}
 */
function scanRepoIntegrations(opts = {}) {
  const targets = resolveScanTargets(opts);
  const modulesCatalog = opts.modulesCatalog
    || loadJson(path.join(opts.hootRoot || '', 'modules', 'modules-catalog.json'), { modules: [] });
  const mcpCatalog = opts.mcpCatalog
    || loadJson(path.join(opts.hootRoot || '', 'state', 'mcp-catalog.json'), { servers: [] });

  const modules = modulesCatalog.modules || [];
  const mcpServers = mcpCatalog.servers || [];
  const catalogs = { modules, mcpServers, rtkStatus: opts.rtkStatus || null };

  const repos = [];
  const candidates = [];
  for (const repoPath of targets) {
    const signals = probeRepo(repoPath);
    repos.push({
      path: signals.path,
      name: signals.name,
      has_git: signals.has_git,
      signals: signals.mentions,
    });
    candidates.push(...matchIntegrations(signals, catalogs));
  }

  return {
    schema: 'hoot.repo_integration_scan.v1',
    scanned_at: new Date().toISOString(),
    scope: opts.scope || 'active',
    repos,
    candidates,
    counts: {
      repos: repos.length,
      candidates: candidates.length,
      by_type: candidates.reduce((acc, c) => {
        acc[c.integration_type] = (acc[c.integration_type] || 0) + 1;
        return acc;
      }, {}),
    },
    policy: {
      mcp: 'allowlist-only; no whole-drive filesystem servers',
      rtk: 'HOOT-bundled preinstalled capability — not a second installation',
      modules: 'modules-catalog.json + module-manager only',
    },
  };
}

module.exports = {
  probeRepo,
  matchIntegrations,
  scanRepoIntegrations,
  resolveScanTargets,
};
