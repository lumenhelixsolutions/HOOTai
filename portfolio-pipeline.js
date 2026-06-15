/**
 * Portfolio pipeline overview — cross-repo milestones, bridges, project-brain snapshots.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BRIDGES = [
  { from: 'lookBOOK', to: 'cineforge', label: 'shot_graph.json ingest', endpoint: 'POST /projects/{id}/ingest/lookbook' },
  { from: 'NOTEtoolsLM-v2', to: 'lookBOOK / cineforge', label: 'vault export artifacts', endpoint: 'POST /api/vault/export' },
  { from: 'PromptPack', to: 'portfolio', label: 'prompt compression', endpoint: 'skills + agent profiles' },
  { from: 'ecc', to: 'all repos', label: 'universal skills registry', endpoint: 'ecc/skills/' },
  { from: 'Hoot', to: 'all repos', label: 'launch + memory + brain ingest', endpoint: 'profiles + project-brain' },
];

const INTEGRATION_MATRIX = [
  { project: 'Hoot', rtk: '✅', mcp: '✅', llamacpp: '✅', role: 'kernel / command center' },
  { project: 'ecc', rtk: '✅', mcp: '⬜', llamacpp: '⬜', role: 'skill registry' },
  { project: 'cineforge', rtk: '✅', mcp: '✅', llamacpp: '⚠️', role: 'video studio' },
  { project: 'lookBOOK', rtk: '✅', mcp: '✅', llamacpp: '⚠️', role: 'animation compiler' },
  { project: 'NOTEtoolsLM-v2', rtk: '✅', mcp: '✅', llamacpp: '⬜', role: 'NotebookLM orchestrator' },
  { project: 'PromptPack', rtk: '⬜', mcp: '✅', llamacpp: '⬜', role: 'Chrome extension' },
  { project: 'racegps', rtk: '✅', mcp: '✅', llamacpp: '⬜', role: 'UE5 racing game' },
];

function readTextIfExists(filePath, max = 4000) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const text = fs.readFileSync(filePath, 'utf8').trim();
    if (!text) return null;
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return null;
  }
}

function readBrainFile(projectPath, filename) {
  if (!projectPath) return null;
  return readTextIfExists(path.join(projectPath, '.agentdock', 'project-brain', filename));
}

function parseTimestamp(markdown) {
  if (!markdown) return null;
  const m = markdown.match(/^Timestamp:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

function extractSection(markdown, heading) {
  if (!markdown) return null;
  const re = new RegExp(`(?:^|\\n)#+\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n#+\\s|$)`, 'i');
  const m = markdown.match(re);
  return m ? m[1].trim().slice(0, 800) : null;
}

function detectBrain(projectPath) {
  const base = path.join(projectPath, '.agentdock', 'project-brain');
  const fileKeys = {
    'current-state.md': 'current-state.md',
    'summary.md': 'summary.md',
    'artifacts.json': 'artifacts.json',
    'wiki/pipeline-overview.md': path.join('wiki', 'pipeline-overview.md'),
  };
  const present = {};
  for (const [key, rel] of Object.entries(fileKeys)) {
    present[key] = fs.existsSync(path.join(base, rel));
  }
  return {
    present: Object.values(present).some(Boolean),
    files: present,
    current_state: readBrainFile(projectPath, 'current-state.md'),
    summary: readBrainFile(projectPath, 'summary.md'),
    pipeline_overview: readBrainFile(projectPath, path.join('wiki', 'pipeline-overview.md')),
    timestamp: parseTimestamp(readBrainFile(projectPath, 'current-state.md')),
  };
}

function parseMilestones(markdown) {
  if (!markdown) return { version: null, milestones: [] };
  const version = markdown.match(/^Milestone-Version:\s*(.+)$/m)?.[1]?.trim() || null;
  const milestones = [];
  const rowRe = /^\|\s*(\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm;
  let m;
  while ((m = rowRe.exec(markdown)) !== null) {
    const num = Number(m[1]);
    if (!num || num > 20) continue;
    milestones.push({
      id: num,
      name: m[2].trim(),
      status: m[3].trim().toLowerCase(),
      projects: m[4].trim(),
    });
  }
  return { version, milestones };
}

function readJsonIfExists(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function probeHttpOk(url, timeoutSec = 2) {
  if (!url) return false;
  try {
    if (process.platform === 'win32') {
      const ps = `$r = Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -TimeoutSec ${timeoutSec} -UseBasicParsing; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { exit 0 } else { exit 1 }`;
      const result = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: (timeoutSec + 2) * 1000 });
      return result.status === 0;
    }
    const result = spawnSync('curl', ['-s', '-f', '-m', String(timeoutSec), url], { encoding: 'utf8', timeout: (timeoutSec + 2) * 1000 });
    return result.status === 0;
  } catch {
    return false;
  }
}

function checkVisualStoryBridge(portfolioRoot) {
  const root = portfolioRoot || process.cwd();
  const lookbookExport = path.join(root, 'lookBOOK', 'lookbook', 'pipeline', 'cineforge_export.py');
  const cineforgeIngest = path.join(root, 'cineforge', 'backend', 'ingest', 'lookbook.py');
  const e2eCandidates = [
    path.join(root, 'scripts', 'pipeline-visual-story.ps1'),
    path.join(root, 'lookBOOK', 'scripts', 'pipeline-visual-story.ps1'),
  ];
  const e2eScript = e2eCandidates.find((p) => fs.existsSync(p)) || e2eCandidates[0];
  const lastRunCandidates = [
    path.join(root, 'scripts', '.pipeline-visual-story-last-run.json'),
    path.join(root, 'lookBOOK', 'scripts', '.pipeline-visual-story-last-run.json'),
  ];
  const lastRunPath = lastRunCandidates.find((p) => fs.existsSync(p)) || lastRunCandidates[0];
  const lastRun = readJsonIfExists(lastRunPath);
  const cineforgeUrl = process.env.CINEFORGE_URL || 'http://127.0.0.1:8000/health';
  const healthUrl = cineforgeUrl.includes('/health') ? cineforgeUrl : `${cineforgeUrl.replace(/\/$/, '')}/health`;

  const modulesReady = fs.existsSync(lookbookExport) && fs.existsSync(cineforgeIngest);
  const scriptReady = fs.existsSync(e2eScript);
  const e2ePassed = Boolean(lastRun?.ok);
  const cineforgeOnline = probeHttpOk(healthUrl);

  let status = 'unknown';
  if (modulesReady && scriptReady && e2ePassed) status = 'verified';
  else if (modulesReady && scriptReady) status = 'ready';
  else status = 'incomplete';

  return {
    id: 'lookbook-cineforge',
    label: 'lookBOOK → cineforge shot graph',
    endpoint: 'POST /projects/{id}/ingest/lookbook',
    status,
    modules_ready: modulesReady,
    e2e_script: scriptReady,
    e2e_script_path: e2eScript,
    last_e2e: lastRun
      ? {
          ok: Boolean(lastRun.ok),
          finished_at: lastRun.finished_at || lastRun.started_at || null,
          shot_count: lastRun.shot_count ?? null,
          pushed: Boolean(lastRun.pushed),
          error: lastRun.error || null,
        }
      : null,
    cineforge_online: cineforgeOnline,
    cineforge_health_url: healthUrl,
  };
}

function buildProjectOverview(project) {
  if (!project?.path) return null;
  const brain = detectBrain(project.path);
  const current = brain.current_state;
  return {
    project: { name: project.name, path: project.path, type: project.type },
    brain: {
      present: brain.present,
      timestamp: brain.timestamp,
      files: brain.files,
    },
    next_best_move: extractSection(current, 'Next Best Move') || extractSection(current, 'Next'),
    working: extractSection(current, 'What Is Working'),
    blockers: extractSection(current, 'Blockers'),
    excerpt: current ? current.split('\n').slice(0, 24).join('\n') : null,
  };
}

function buildPipelineOverview({ registry = { projects: [], active: null }, portfolioRoot } = {}) {
  const root = portfolioRoot || path.dirname(registry.projects?.[0]?.path || process.cwd());
  const milestonesPath = path.join(root, 'MILESTONES.md');
  const milestonesDoc = readTextIfExists(milestonesPath, 12000);
  const milestones = parseMilestones(milestonesDoc);

  const projects = (registry.projects || []).map((p) => {
    const brain = detectBrain(p.path);
    return {
      name: p.name,
      path: p.path,
      type: p.type,
      active: path.normalize(p.path) === path.normalize(registry.active || ''),
      git: p.git || null,
      brain: {
        present: brain.present,
        timestamp: brain.timestamp,
        has_pipeline_overview: Boolean(brain.pipeline_overview),
        has_current_state: Boolean(brain.current_state),
      },
      pipeline_excerpt: brain.pipeline_overview
        ? brain.pipeline_overview.split('\n').slice(0, 12).join('\n')
        : null,
    };
  });

  const active = projects.find((p) => p.active) || null;
  const activeDetail = active
    ? registry.projects.find((p) => path.normalize(p.path) === path.normalize(active.path))
    : null;

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    milestone_version: milestones.version,
    milestones: milestones.milestones,
    bridges: BRIDGES,
    bridge_health: [checkVisualStoryBridge(root)],
    integration_matrix: INTEGRATION_MATRIX,
    projects,
    active_project: buildProjectOverview(activeDetail),
    sources: {
      milestones: fs.existsSync(milestonesPath) ? milestonesPath : null,
      pipeline_integrations: path.join(root, 'docs', 'PIPELINE_INTEGRATIONS.md'),
      portfolio_overview: path.join(root, '_PORTFOLIO_PIPELINE_OVERVIEW.md'),
    },
  };
}

module.exports = {
  buildPipelineOverview,
  buildProjectOverview,
  checkVisualStoryBridge,
  detectBrain,
  parseMilestones,
  BRIDGES,
  INTEGRATION_MATRIX,
};