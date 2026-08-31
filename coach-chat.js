/**
 * Conversational AI Coach — view-aware replies (never dumps Operations Report).
 */

const { getViewGuide, ORCHESTRATION_LOOP } = require('./coach-guides');

function suggestCommands(context) {
  const cmds = [];
  const view = context.coachView || '/';
  if (view !== '/scan' && !context.scan?.tools?.ollama?.present) {
    cmds.push({ type: 'runScan' });
  }
  if (view === '/profiles' || view === '/launch') {
    cmds.push({ type: 'launch', profileId: context.pageContext?.easyTopPickId || undefined });
  }
  return cmds.filter((c) => c.type !== 'launch' || c.profileId);
}

function buildCoachChatResponse({ text, context = {} }) {
  const view = context.coachView || '/';
  const guide = context.viewGuide || getViewGuide(view);
  const pageContext = context.pageContext || {};
  const scan = context.scan || {};
  const question = String(text || '').trim();
  const lower = question.toLowerCase();

  const lines = [];
  lines.push(`You're on **${guide.title}** — ${guide.summary}`);

  if (lower.includes('help') || lower.includes('what') || lower.includes('how') || !question) {
    lines.push('');
    lines.push('**On this screen you can:**');
    for (const f of guide.features || []) lines.push(`• ${f}`);
    lines.push('');
    lines.push(`**Operator loop:** ${ORCHESTRATION_LOOP.compose}`);
    lines.push(`**Recommended next:** ${guide.nextActions?.[0] || 'Ask me something specific about this screen.'}`);
  }

  // Live state from pageContext
  const live = [];
  if (pageContext.readyCount != null) live.push(`${pageContext.readyCount} profiles ready`);
  if (pageContext.blockedCount > 0) live.push(`${pageContext.blockedCount} blocked`);
  if (pageContext.stackScore != null) live.push(`stack health ${pageContext.stackScore}/100`);
  if (pageContext.runningCount > 0) live.push(`${pageContext.runningCount} sessions running`);
  if (pageContext.viewMode) live.push(`${pageContext.viewMode} mode`);
  if (pageContext.easyStep === 3 && pageContext.easyTopPickName) {
    live.push(`top pick: ${pageContext.easyTopPickName}`);
  }
  if (pageContext.productionSessionActive || pageContext.grokSessionActive) {
    const tokens = Number(pageContext.productionEstContextTokens || pageContext.grokEstContextTokens) || 0;
    const model = pageContext.productionModelId || pageContext.grokModelId || 'agent';
    const agent = pageContext.productionAgentName || 'External agent';
    live.push(`${agent} active${tokens ? ` · ~${tokens >= 1000 ? `${Math.round(tokens / 1000)}K` : tokens} est context tokens` : ''} (${model})`);
  }
  if (live.length) {
    lines.push('');
    lines.push(`**Right now:** ${live.join(' · ')}`);
  }

  // Actionable blockers (brief, not a full report)
  const blockers = [];
  if (!scan.tools?.ollama?.present && ['/builder', '/profiles', '/launch', '/'].includes(view)) {
    blockers.push('Ollama is not detected — open **Readiness**, run a scan, then install Ollama if you want local profiles.');
  }
  if (!context.activeProject && ['/builder', '/launch', '/'].includes(view)) {
    blockers.push('No **active project** — pick one on Overview so launches and scans target the right repo.');
  }
  if (pageContext.blockedCount > 0) {
    blockers.push('Some profiles are **blocked by Memory** — open Memory or ask me to explain a safe alternative.');
  }
  if (blockers.length) {
    lines.push('');
    lines.push('**What I\'d fix first:**');
    for (const b of blockers) lines.push(`• ${b}`);
  }

  // Direct answer hooks
  if (lower.includes('orchestrat') || lower.includes('loop') || lower.includes('workflow')) {
    lines.push('');
    lines.push('**Your loop for this session:**');
    for (const step of ORCHESTRATION_LOOP.steps) {
      const here = step.path === view ? ' ← you are here' : '';
      lines.push(`• ${step.label}${here}: ${step.purpose}`);
    }
  }

  if (lower.includes('stack') && view === '/builder') {
    lines.push('');
    if (pageContext.stackScore >= 80) lines.push('Stack looks healthy — **Save profile** or **Launch** from the right panel.');
    else if (pageContext.stackIssues?.length) lines.push(`Top issue: ${pageContext.stackIssues[0]}. Open the **Install** tab or use a quick-start template.`);
    else lines.push('Start with **Local audit** template or the wizard: Agent → Model → Tools → Review.');
  }

  lines.push('');
  lines.push('_Answering from screen + live state. I propose actions for your Approve — I do not claim scans or launches already ran._');
  if (suggestCommands(context).length) {
    lines.push('_Proposed command chips (if any) need HITL approval before they mutate the command center._');
  }

  return {
    text: lines.join('\n'),
    commands: suggestCommands(context),
    source: 'coach-local',
  };
}

function viewOperatorSnapshot(view, pageContext = {}, context = {}) {
  const pc = pageContext;
  const snap = { view };

  if (view === '/' || view === '/dashboard') {
    snap.readyCount = pc.readyCount;
    snap.blockedCount = pc.blockedCount;
    snap.scanPresent = pc.scanPresent;
    snap.runningCount = pc.runningCount;
    snap.portfolioIssues = pc.portfolioIssues;
    snap.grokSessionActive = pc.grokSessionActive;
    snap.grokEstContextTokens = pc.grokEstContextTokens;
  } else if (view === '/scan') {
    snap.scanLoaded = pc.scanLoaded;
    snap.ollamaPresent = pc.ollamaPresent;
    snap.missingAgents = pc.missingAgents;
    snap.tokenBurnRisk = pc.tokenBurnRisk;
    snap.agentRadarExternal = pc.agentRadarExternal;
    snap.agentRadarTotal = pc.agentRadarTotal;
    snap.grokSessionActive = pc.grokSessionActive;
    snap.grokEstContextTokens = pc.grokEstContextTokens;
    snap.grokModelId = pc.grokModelId;
    snap.grokLastUserQuery = pc.grokLastUserQuery;
  } else if (view === '/profiles') {
    snap.viewMode = pc.viewMode;
    snap.easyStep = pc.easyStep;
    snap.easyTopPickId = pc.easyTopPickId;
    snap.easyTopPickName = pc.easyTopPickName;
    snap.blockedCount = pc.blockedCount;
  } else if (view === '/builder' || view === '/stack') {
    snap.stackScore = pc.stackScore;
    snap.stackIssues = pc.stackIssues?.slice?.(0, 3);
    snap.wizardStep = pc.wizardStep;
    snap.hasAgent = pc.hasAgent;
    snap.hasLlm = pc.hasLlm;
    snap.nodeCount = pc.nodeCount;
  } else if (view === '/launch') {
    snap.recommendedCount = pc.recommendedCount;
    snap.previewProfileId = pc.previewProfileId;
    snap.stagedProfileId = pc.stagedProfileId;
    snap.hasAuditWarnings = pc.hasAuditWarnings;
  } else if (view === '/modules') {
    snap.modulesTab = pc.modulesTab;
    snap.modulesOutdated = pc.modulesOutdated;
    snap.modulesNeedSync = pc.modulesNeedSync;
    snap.modulesReady = pc.modulesReady;
    snap.cePluginDetected = pc.cePluginDetected;
  } else if (view === '/terminal' || view === '/launch') {
    snap.runningCount = pc.runningCount;
    snap.activeSessionId = pc.activeSessionId;
    snap.errorCount = pc.errorCount;
  }

  const ready = (context.profiles || []).filter((p) => p.state === 'READY');
  if (ready.length) snap.readyProfileIds = ready.slice(0, 5).map((p) => p.id);

  return snap;
}

function summarizeMcpContext(mcpContext) {
  if (!mcpContext) return null;
  return {
    activeRepo: mcpContext.activeRepo,
    gitBranch: mcpContext.git?.branch || null,
    gitStatus: mcpContext.git?.status || null,
    recentCommits: mcpContext.git?.recentCommits || null,
    memoryExcerpt: mcpContext.filesystem?.find((f) => f.path === 'memory.md')?.excerpt?.slice(0, 400) || null,
  };
}

function summarizeCoachContext(context, { mode = 'minimal' } = {}) {
  const guide = context.viewGuide || getViewGuide(context.coachView);
  const pageContext = context.pageContext || {};
  const operatorSnapshot = viewOperatorSnapshot(context.coachView, pageContext, context);
  const base = {
    coachView: context.coachView,
    screen: guide.title,
    screenSummary: guide.summary,
    recommendedNext: guide.nextActions?.[0] || null,
    operatorSnapshot,
    activeProject: context.activeProject?.name || context.activeProject?.path || null,
    ollamaPresent: context.scan?.tools?.ollama?.present || false,
    readyProfiles: context.profileCounts?.ready ?? (context.profiles || []).filter((p) => p.state === 'READY').length,
    blockedProfiles: context.profileCounts?.blocked ?? (context.profiles || []).filter((p) => p.state === 'BLOCKED').length,
    sessionsRunning: context.sessionCounts?.running ?? (context.sessions || []).filter((s) => s.status === 'running').length,
    providerMatrix: context.hybridWorkspace?.cooldown?.matrix_line || pageContext.providerMatrix || null,
    contextMode: mode,
  };

  if (mode === 'minimal') {
    return {
      ...base,
      contextNote: 'Lightweight screen snapshot. Ask to refresh repo/memory context if needed.',
      productionActive: Boolean(pageContext.productionSessionActive || pageContext.grokSessionActive),
      productionEstTokens: pageContext.productionEstContextTokens || pageContext.grokEstContextTokens || null,
    };
  }

  return {
    ...base,
    features: guide.features,
    orchestration: ORCHESTRATION_LOOP.compose,
    installedAgents: context.installedAgents?.slice(0, 8),
    missingAgents: context.missingAgents?.slice(0, 6),
    mcpContext: summarizeMcpContext(context.mcpContext),
    activeRoot: context.hybridWorkspace?.active_root_path || context.workspaceTerse?.active_root || null,
    workspaceBoundaries: context.workspaceTerse?.rule || null,
    productionContext: pageContext.productionContext || null,
    sessionSummary: pageContext.sessionSummary || null,
    grokSummary: pageContext.grokSummary || null,
  };
}

module.exports = { buildCoachChatResponse, summarizeCoachContext, suggestCommands, viewOperatorSnapshot };