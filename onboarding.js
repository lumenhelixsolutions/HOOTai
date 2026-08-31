/**
 * HOOT first-run onboarding — scan + registry driven (no hardcoded layout).
 */

const { inferRootsFromProject } = require('./workspace-infer');
const { validateRoots } = require('./workspace-roots');
const { enrichRegistry } = require('./provider-cooldown');

const STEPS = [
  { id: 'scan', title: 'System scan', summary: 'Detect agents, models, keys, and machine posture.' },
  { id: 'local_brain', title: 'Local brain', summary: 'Pick the Ollama model for the H00T mascot (gemma4 preferred when installed).' },
  { id: 'project', title: 'Active project', summary: 'Pick the repo H00T should anchor launches and handoffs to.' },
  { id: 'layout', title: 'Workspace layout', summary: 'Confirm app / core / data trees inferred from the project folder.' },
  { id: 'providers', title: 'ProviderRide', summary: 'ProviderRide doctor matrix — mark cooldowns, session provider, sealed credentials, and optional Account Booth targets.' },
  { id: 'ready', title: 'Ready', summary: 'Optional handoff import — then enter the AI Command Center.' },
];

const CODER_TO_PROVIDER = {
  'claude-code': 'claude',
  claude: 'claude',
  codex: 'chatgpt',
  'gemini-cli': 'gemini',
  gemini: 'gemini',
  kimi: 'kimi',
  ollama: 'ollama',
};

function scanReady(scan) {
  return Boolean(scan && !scan.empty && (scan.tools || scan.coders));
}

function suggestSessionProvider(scan, cooldownRegistry) {
  const active = new Set();
  for (const [id, row] of Object.entries(cooldownRegistry?.providers || {})) {
    const st = row.effective_status || row.status;
    if (st === 'active' || st === 'local') active.add(id);
  }
  const coders = (scan?.coders || []).filter((c) => c.detection?.present);
  for (const c of coders) {
    const pid = CODER_TO_PROVIDER[c.id] || CODER_TO_PROVIDER[c.command];
    if (pid && (active.size === 0 || active.has(pid))) return pid;
  }
  if (scan?.tools?.ollama?.present && (active.size === 0 || active.has('ollama'))) return 'ollama';
  if (active.has('gemini')) return 'gemini';
  if (active.has('claude')) return 'claude';
  return 'ollama';
}

function buildChecks({ scan, activeProject, rootsValidated, settings, cooldownRegistry, localBrain }) {
  return {
    scan: scanReady(scan),
    local_brain: Boolean(localBrain?.ready || settings?.onboarding?.local_brain_done),
    project: Boolean(activeProject),
    layout: Boolean(rootsValidated?.roots?.length && rootsValidated.roots.some((r) => r.valid)),
    providers: Boolean(cooldownRegistry?.current_session_provider),
    completed: Boolean(settings?.onboarding?.completed),
  };
}

function resolveCurrentStep(checks) {
  if (checks.completed) return 'ready';
  if (!checks.scan) return 'scan';
  if (!checks.local_brain) return 'local_brain';
  if (!checks.project) return 'project';
  if (!checks.layout) return 'layout';
  if (!checks.providers) return 'providers';
  return 'ready';
}

function buildOnboardingState({
  settings,
  scan,
  activeProject,
  registry,
  rootsState,
  rootsValidated,
  portfolioRoots,
  cooldownRaw,
  localBrain = null,
}) {
  const cooldown = enrichRegistry(cooldownRaw || { providers: {}, version: 1 }, { scan });
  const checks = buildChecks({
    scan,
    activeProject,
    rootsValidated,
    settings,
    cooldownRegistry: cooldown,
    localBrain,
  });
  const currentStep = resolveCurrentStep(checks);
  const inferred = activeProject ? inferRootsFromProject(activeProject) : null;

  const detectedAgents = (scan?.coders || [])
    .filter((c) => c.detection?.present)
    .map((c) => ({ id: c.id, name: c.name || c.id, command: c.command }));

  return {
    version: 1,
    completed: checks.completed,
    current_step: currentStep,
    steps: STEPS,
    checks,
    portfolio_roots: portfolioRoots || [],
    scan_summary: scanReady(scan)
      ? {
          repo_path: scan?.repo?.path || null,
          ollama: Boolean(scan?.tools?.ollama?.present),
          agents_detected: detectedAgents.length,
          agents: detectedAgents.slice(0, 12),
          rtk: Boolean(scan?.tools?.rtk?.present),
        }
      : null,
    local_brain: localBrain,
    projects: {
      active: activeProject,
      count: registry?.projects?.length || 0,
      items: (registry?.projects || []).slice(0, 24),
    },
    layout: {
      current: rootsValidated,
      inferred,
      needs_confirm: Boolean(inferred && (!rootsState?.inferred || rootsState?.inferred_from !== activeProject)),
    },
    providers: {
      registry: cooldown,
      suggested_session_provider: suggestSessionProvider(scan, cooldown),
    },
    onboarding: settings?.onboarding || { completed: false },
  };
}

module.exports = {
  STEPS,
  scanReady,
  suggestSessionProvider,
  inferRootsFromProject,
  buildOnboardingState,
  resolveCurrentStep,
  CODER_TO_PROVIDER,
};