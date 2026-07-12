/**
 * Per-view guides for AI Coach — features, orchestration, and realtime advice.
 */

const ORCHESTRATION_LOOP = {
  title: 'Operator loop',
  steps: [
    { id: 'overview', label: 'Overview', path: '/', purpose: 'See mission status, blocked profiles, portfolio git health' },
    { id: 'readiness', label: 'Readiness', path: '/scan', purpose: 'Scan tools, agents, Ollama, RTK, env keys' },
    { id: 'profiles', label: 'Profiles', path: '/profiles', purpose: 'Pick agent + task (Easy 1-2-3) or browse all profiles' },
    { id: 'launch', label: 'Launch Center', path: '/launch', purpose: 'Audit preview, goal-based recommendations, staged launch' },
    { id: 'sessions', label: 'Sessions', path: '/terminal', purpose: 'Monitor terminals, send input, report outcomes to Memory' },
    { id: 'memory', label: 'Memory', path: '/memory', purpose: 'Evidence blocks bad launches — edit to unblock safely' },
  ],
  compose: 'Overview → Readiness → Profiles → Launch → Sessions → Memory (feedback loop)',
};

const VIEW_GUIDES = {
  '/': {
    title: 'Overview',
    group: 'Command Center',
    summary: 'Mission dashboard — profile health, active project, portfolio git, and what to do next.',
    features: [
      'Profile readiness counts (Ready / Fixable / Blocked)',
      'Active project switcher — scopes scans and launches',
      'Portfolio git health — uncommitted changes, missing remotes',
      'Research brief + memory evidence preview',
      'Quick links into Readiness, Profiles, Launch',
    ],
    orchestration: 'Start here each session. If blocked profiles or missing scan, fix before launching.',
    nextActions: ['Run Readiness scan if stale', 'Open Launch Center when profiles are Ready', 'Switch active project before agent work'],
  },
  '/scan': {
    title: 'Readiness',
    group: 'Command Center',
    summary: 'System scan — what is installed, what is missing, and whether local models are loaded.',
    features: [
      'Hardware + GPU VRAM for model fit',
      'Ollama, RTK, WSL, llama.cpp detection',
      'Coding agents on PATH (Claude Code, Codex, Hermes…)',
      'Env keys present (never shows secret values)',
      'Discovered GGUF models for llama.cpp',
    ],
    orchestration: 'Run scan after installing tools or changing env. Stack Builder and Profiles use this data.',
    nextActions: ['Run scan', 'Fix missing Ollama or agents', 'Open Stack Builder to compose a local stack'],
  },
  '/profiles': {
    title: 'Profiles',
    group: 'Command Center',
    summary: 'Launch profiles — pre-built agent+model+task combinations with audit scoring.',
    features: [
      'Easy 1-2-3: Agent → Task → Launch top pick',
      'Advanced: grouped by agent with telemetry',
      'Dry-run audit preview before launch',
      'Memory blocks shown with override path',
      'Filter by state: Ready, Fixable, Blocked',
    ],
    orchestration: 'Pick a Ready profile or use Easy mode. Preview audit, then launch → Sessions.',
    nextActions: ['Use Easy mode if overwhelmed', 'Inspect audit panel before launch', 'Check Memory if profile is Blocked'],
  },
  '/launch': {
    title: 'Launch Center',
    group: 'Command Center',
    summary: 'Staged launch — goal-based recommendations, audit explainability, script preview.',
    features: [
      'Goal selector (privacy, speed, local, etc.)',
      'Recommended vs blocked profiles from planner',
      'Dry-run audit with warnings/errors',
      'Active project context in header',
      'One-click launch after preview passes',
    ],
    orchestration: 'Choose goal → preview top recommendation → launch → monitor in Sessions.',
    nextActions: ['Preview before launch', 'Resolve audit warnings', 'Report session outcome to Memory'],
  },
  '/terminal': {
    title: 'Sessions',
    group: 'Command Center',
    summary: 'Live terminal monitor for launched agent sessions.',
    features: [
      'Multi-session list with status',
      'Streaming stdout/stderr',
      'Send input to running session',
      'Stop session + report outcome',
      'Handoff from Launch / Stack Builder via URL params',
    ],
    orchestration: 'After launch, watch output here. Report outcome so Memory learns.',
    nextActions: ['Report outcome when done', 'Stop runaway sessions', 'Return to Profiles for next task'],
  },
  '/activity': {
    title: 'Activity',
    group: 'Intelligence',
    summary: 'Session diary — radar history, HOOT launches, and daily telemetry rollup.',
    features: [
      'Calendar heatmap of agent activity (14 days)',
      'Today timeline from agent radar diffs + launches',
      'Write diary/YYYY-MM-DD.md for human-readable log',
      'Shared across LAN devices via server state',
    ],
    orchestration: 'Review after long sessions. Radar auto-logs external vs docked agent time.',
    nextActions: ['Write diary .md', 'Check external agent minutes', 'Open Readiness for live radar'],
  },
  '/bench': {
    title: 'Local Model Bench',
    group: 'Intelligence',
    summary: 'Ollama smoke benchmarks — latency and tokens/sec tiers that adjust local profile readiness.',
    features: [
      'CSV results table (model, status, latency, tok/s)',
      'Run bench on comma-separated model list',
      'Presets from scan-loaded Ollama models',
      'Scoring tiers: fast ≥20 tok/s, ok ≥8, slow pass',
    ],
    orchestration: 'Bench after pulling new models, then re-check Profiles for updated local scores.',
    nextActions: ['Run bench on loaded models', 'Re-scan if presets are empty', 'Open Profiles for bench-adjusted scores'],
  },
  '/approvals': {
    title: 'Coach Approvals',
    group: 'Intelligence',
    summary: 'Gated coach command log — launch, memory edits, project switches — with Phase 4 progress.',
    features: [
      'Approval event table with profile and project context',
      'Phase 4 progress bar (10 gated executions)',
      'Blocked vs ok outcomes',
      'Distinct from full coach audit log',
    ],
    orchestration: 'Review after coach launches or memory edits; track progress before Phase 4 autonomy.',
    nextActions: ['Refresh after gated coach commands', 'Check Phase 4 progress', 'Use coach to launch a profile to append entries'],
  },
  '/portfolio': {
    title: 'Portfolio',
    group: 'Intelligence',
    summary: 'MVP launcher hub — git health, project-brain status, next-best-move excerpts, and bridge links for every portfolio repo.',
    features: [
      'Responsive card grid for cineforge, lookBOOK, racegps, NOTEtoolsLM-v2, PromptPack, ecc, Hoot',
      'Git health badges — clean, uncommitted, no remote',
      'Brain present + timestamp + pipeline wiki flags',
      'Next best move excerpt from current-state.md',
      'Set active project per card; links to Pipeline and bundled docs',
    ],
    orchestration: 'Start here for multi-repo orientation — pick active MVP, fix git/brain gaps, then open Pipeline for milestones.',
    nextActions: ['Set the MVP you are working on as active', 'Refresh registry after brain updates', 'Open Pipeline for milestone and bridge detail'],
  },
  '/memory': {
    title: 'Memory',
    group: 'Intelligence',
    summary: 'Local learning layer — evidence blocks repeated bad launches.',
    features: [
      'Markdown evidence blocks parsed on launch',
      'Manual edit for corrections',
      'Advisor reads memory before recommendations',
      'Unblock only with documented override reason',
    ],
    orchestration: 'Check here when profiles are Blocked. Fix root cause, don\'t just override.',
    nextActions: ['Read blocked evidence', 'Ask AI Coach how to unblock', 'Update after successful session'],
  },
  '/builder': {
    title: 'Stack Builder',
    group: 'Build + Configure',
    summary: 'Visual stack composer — Agent → Model → Tools → Review with health score.',
    features: [
      'Wizard steps + quick-start templates',
      'Scan-driven agent/model lists (● = detected/loaded)',
      'MCP git tool assignment',
      'Install tab for missing tools',
      'Save as profile or launch directly',
    ],
    orchestration: 'Compose stack → fix health score → save profile → launch from Profiles or here.',
    nextActions: ['Use Local audit template', 'Open Install tab for blockers', 'Save profile when score ≥ 80'],
  },
  '/modules': {
    title: 'Module Manager',
    group: 'Build + Configure',
    summary: 'Install and sync CE skills, MCP servers, and launch env hooks for coding agents.',
    features: [
      'One-click install from modules catalog',
      'Auto-sync upstream CE skills on interval',
      'GitHub version checks for drift',
      'Launch env injection (AGENTDOCK_CE_PLUGIN_PATH, etc.)',
      'HOOT reads module state when advising stacks',
    ],
    orchestration: 'Install modules before complex stacks. Re-sync after upstream releases.',
    nextActions: ['Run full setup on CE module', 'Enable auto-sync', 'Return to Stack Builder'],
  },
  '/skills': {
    title: 'Skills',
    group: 'Build + Configure',
    summary: 'Compound engineering skills catalog — reusable agent capabilities.',
    features: [
      'Browse skills by category',
      'View skill content and upstream links',
      'CE-compatible profile tagging',
    ],
    orchestration: 'Reference when choosing profiles or building custom stacks.',
    nextActions: ['Open a skill before complex tasks', 'Match skill to profile task mode'],
  },
  '/settings': {
    title: 'Settings',
    group: 'Build + Configure',
    summary: 'API keys, model provider, local inference (Ollama + llama.cpp), hybrid workspace, and C.O.R.E. budget hooks.',
    features: [
      'Provider keys stored locally in browser',
      'Hybrid workspace roots + auto handoff on cooldown',
      'llama.cpp GGUF path + server port',
      'Server-side settings sync',
      'About panel with version, git, and changelog headline',
    ],
    orchestration: 'Configure once. Re-scan after changing local inference or workspace roots.',
    nextActions: ['Set Gemini/OpenAI key for AI Coach chat', 'Enable llama.cpp if using GGUF', 'Save then run Readiness scan'],
  },
  '/deck': {
    title: 'Command Deck',
    group: 'Command Center',
    summary: 'Live cooldown monitor — provider gauges, recovery timeline, workspace context radar, save-state handoffs, and always-on-top popout.',
    features: [
      'Radial countdown gauges per provider with 3h/5h/til-reset presets',
      'Next-8-hours recovery timeline (unlocks + daily resets)',
      'Context radar: files touched in workspace roots + token cost',
      'Save-state console: auto_handoff.md generator + auto-on-cooldown',
      'Document PiP popout with agent radar + expandable HOOT chat',
      'Matrix ticker — copy registry line for provider handoff',
    ],
    orchestration: 'Check before switching providers. Mark cooldowns when you hit a limit; generate save-state before handoff.',
    nextActions: ['Copy matrix line into next AI chat', 'Pop out monitor while coding', 'Generate save-state before COOLDOWN'],
  },
  '/docs': {
    title: 'Documentation',
    group: 'Build + Configure',
    summary: 'Bundled operator guides and implementation plans — README, AI Coach, Command Deck, hybrid workspace, and milestone docs.',
    features: [
      'Shipped inside every UI build at /docs/*',
      'Searchable in-app browser with categories',
      'Raw markdown links for external editors',
      'Manifest regenerated on each build',
    ],
    orchestration: 'Reference before complex workflows or when onboarding — docs mirror repo docs/ folder.',
    nextActions: ['Start with HOOT Operator Guide (README)', 'Read Command Deck plan before first handoff', 'Share docs link with teammates on LAN'],
  },
};

function getViewGuide(view = '/') {
  const key = view === '' ? '/' : view;
  return VIEW_GUIDES[key] || {
    title: 'HOOT',
    group: 'Command Center',
    summary: 'HOOT — local AI command center on 127.0.0.1.',
    features: ['Use the sidebar to navigate core views'],
    orchestration: ORCHESTRATION_LOOP.compose,
    nextActions: ['Open Overview', 'Ask the AI Coach'],
  };
}

function buildCoachMessage(guide, pageContext = {}) {
  const ctxBits = [];
  if (pageContext.readyCount != null) ctxBits.push(`${pageContext.readyCount} ready profiles`);
  if (pageContext.blockedCount != null && pageContext.blockedCount > 0) ctxBits.push(`${pageContext.blockedCount} blocked`);
  if (pageContext.runningCount != null && pageContext.runningCount > 0) ctxBits.push(`${pageContext.runningCount} sessions running`);
  if (pageContext.agentRadarExternal > 0) ctxBits.push(`${pageContext.agentRadarExternal} external agents`);
  if (pageContext.agentRadarTotal > 0 && !pageContext.agentRadarExternal) ctxBits.push(`${pageContext.agentRadarTotal} agents on machine`);
  if (pageContext.stackScore != null) ctxBits.push(`stack health ${pageContext.stackScore}/100`);
  if (pageContext.viewMode) ctxBits.push(`${pageContext.viewMode} mode`);
  const ctx = ctxBits.length ? ` Right now: ${ctxBits.join(', ')}.` : '';
  const next = guide.nextActions?.[0];
  return `You're on **${guide.title}**. ${guide.summary}${ctx}${next ? ` Try: ${next}.` : ''}`;
}

function buildGuideHint(view, pageContext) {
  const guide = getViewGuide(view);
  return {
    id: `guide-${view.replace(/\//g, '-') || 'home'}`,
    priority: 48,
    tone: 'tip',
    message: buildCoachMessage(guide, pageContext).replace(/\*\*/g, ''),
    actions: [
      { label: 'Explain this screen', type: 'chat', prompt: `I'm on ${guide.title}. Explain every feature on this screen and what I should do next in the operator loop.` },
      { label: 'Orchestration help', type: 'chat', prompt: 'Walk me through the HOOT operator loop for my current situation.' },
    ],
  };
}

module.exports = {
  ORCHESTRATION_LOOP,
  VIEW_GUIDES,
  getViewGuide,
  buildCoachMessage,
  buildGuideHint,
};