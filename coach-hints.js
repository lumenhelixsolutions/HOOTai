/**
 * Proactive AI Coach hints — rule-based, view-aware (Clippy-style assistance).
 */

const { buildGuideHint } = require('./coach-guides');
const { listActiveNotifications, toCoachHints } = require('./core/notifications');
const { resolveCoreDir } = require('./core/storage');
const { resolveProjectId } = require('./core/mediated');

function push(hints, hint) {
  hints.push({ id: hint.id, priority: hint.priority || 50, tone: hint.tone || 'tip', message: hint.message, actions: hint.actions || [] });
}

function buildCoachHints({
  view = '/',
  pageContext = {},
  scan = null,
  profiles = [],
  sessions = [],
  portfolio = null,
  agentRadar = null,
  tokenBurn = null,
  activeProject = null,
  coreUsage = null,
}) {
  const hints = [];
  const readyProfiles = profiles.filter(p => p.evaluation?.state === 'READY' || p.state === 'READY');
  const blockedProfiles = profiles.filter(p => p.evaluation?.state === 'BLOCKED' || p.state === 'BLOCKED');
  const runningSessions = (sessions || []).filter(s => s.status === 'running');
  const ollamaOk = scan?.tools?.ollama?.present;
  const rtkOk = scan?.tools?.rtk?.present;
  const wslOk = scan?.tools?.wsl?.present;
  const burnRisk = tokenBurn?.risk?.level || pageContext.tokenBurnRisk || 'low';
  const burnSaved = tokenBurn?.formatted?.total_saved || pageContext.tokenBurnSaved || null;
  const rtkPresent = tokenBurn?.prevention?.rtk?.present ?? scan?.tools?.rtk?.present ?? false;

  if (burnRisk === 'high' && !rtkPresent) {
    push(hints, {
      id: 'burn-rtk-high',
      priority: 88,
      tone: 'warning',
      message: `Token burn risk is high — HOOT RTK is preinstalled but not active on PATH yet (${tokenBurn?.rtk_profiles?.length || 0} RTK-tagged profile(s)). Open Vitals → Ensure HOOT RTK (no separate install).`,
      actions: [
        { label: 'Vitals / RTK', type: 'navigate', target: '/vitals' },
        { label: 'Token burn', type: 'navigate', target: '/burn' },
        { label: 'Ask HOOT', type: 'chat', prompt: 'How do I enable HOOT-bundled RTK token compression? It should be preinstalled, not a second install.' },
      ],
    });
  } else if (burnRisk === 'medium' && !rtkPresent) {
    push(hints, {
      id: 'burn-rtk-medium',
      priority: 74,
      tone: 'tip',
      message: 'Shell output from coding agents can burn context tokens. HOOT RTK ships preinstalled — provision into HootAi/bin from Vitals if missing.',
      actions: [{ label: 'Vitals', type: 'navigate', target: '/vitals' }, { label: 'Why HOOT RTK?', type: 'chat', prompt: 'Explain HOOT-bundled RTK (preinstalled token compression).' }],
    });
  } else if (burnSaved && burnRisk === 'low' && (view === '/' || view === '/scan' || view === '/vitals')) {
    push(hints, {
      id: 'burn-rtk-savings',
      priority: 52,
      tone: 'celebration',
      message: `HOOT RTK has prevented ~${burnSaved} tokens from reaching your agents (${tokenBurn?.formatted?.avg_savings_pct || '?'} avg savings).`,
      actions: [{ label: 'Refresh stats', type: 'action', target: 'token-burn-refresh' }],
    });
  }

  const radarExternal = agentRadar?.summary?.external || Number(pageContext.agentRadarExternal) || 0;
  const radarTotal = agentRadar?.summary?.total || Number(pageContext.agentRadarTotal) || 0;
  const radarDock = agentRadar?.summary?.dock || Number(pageContext.agentRadarDock) || 0;
  const radarAgents = agentRadar?.agents || pageContext.agentRadarAgents || [];
  const prodSessions = agentRadar?.production_sessions || agentRadar?.grok_sessions || pageContext.productionSessions || [];
  const prodPrimary = agentRadar?.production_context || pageContext.productionContext || prodSessions[0] || null;
  const prodActive = Boolean(
    pageContext.productionSessionActive
    || prodSessions.some((s) => s.active)
    || prodPrimary?.active
    || prodPrimary?.session_id,
  );
  const prodTokens = Number(pageContext.productionEstContextTokens || prodPrimary?.est_context_tokens) || 0;
  const prodModel = pageContext.productionModelId || prodPrimary?.model_id || prodPrimary?.agent_name || 'agent';
  const prodAgent = pageContext.productionAgentName || prodPrimary?.agent_name || prodPrimary?.agent_id || 'agent';
  const prodQuery = pageContext.productionLastUserQuery || prodPrimary?.last_user_query;

  if (prodActive && prodTokens >= 80000) {
    push(hints, {
      id: 'production-context-heavy',
      priority: 91,
      tone: 'warning',
      message: `${prodAgent} session has ~${prodTokens >= 1000 ? `${Math.round(prodTokens / 1000)}K` : prodTokens} estimated context tokens (${prodModel}). Compaction may be imminent — consider a handoff packet before switching providers.`,
      actions: [
        { label: 'Command Deck', type: 'navigate', target: '/command-deck' },
        { label: 'Token burn', type: 'navigate', target: '/scan' },
        { label: 'Ask HOOT', type: 'chat', prompt: `Analyze my active ${prodAgent} session context size and recommend when to hand off or compact.` },
      ],
    });
  } else if (prodActive) {
    const tokenBit = prodTokens ? ` · ~${prodTokens >= 1000 ? `${Math.round(prodTokens / 1000)}K` : prodTokens} est context` : '';
    const queryBit = prodQuery ? ` Last task: "${String(prodQuery).slice(0, 80)}${prodQuery.length > 80 ? '…' : ''}"` : '';
    push(hints, {
      id: 'production-session-active',
      priority: 86,
      tone: 'tip',
      message: `${prodAgent} is active on this machine (${prodModel}${tokenBit}). HOOT is tracking production telemetry for token burn analysis.${queryBit}`,
      actions: [
        { label: 'Readiness', type: 'navigate', target: '/scan' },
        { label: 'Ask HOOT', type: 'chat', prompt: `Summarize my active ${prodAgent} session — context size, model, and whether I should hand off.` },
      ],
    });
  }

  if (radarExternal > 0) {
    const names = radarAgents.filter(a => a.external > 0).map(a => a.name).slice(0, 3).join(', ');
    push(hints, {
      id: 'radar-external-agents',
      priority: 87,
      tone: 'warning',
      message: `${radarExternal} coding agent process(es) running outside HOOT${names ? ` (${names})` : ''}. HOOT is monitoring them — consider routing through Launch Center for memory + audit.`,
      actions: [
        { label: 'Agent radar', type: 'navigate', target: '/scan' },
        { label: 'Launch Center', type: 'navigate', target: '/launch' },
        { label: 'Ask HOOT', type: 'chat', prompt: `I have ${radarExternal} agent(s) running outside HOOT. What are they and should I consolidate?` },
      ],
    });
  } else if (radarTotal > 0 && radarDock > 0 && (view === '/' || view === '/terminal')) {
    push(hints, {
      id: 'radar-dock-active',
      priority: 58,
      tone: 'tip',
      message: `${radarDock} HOOT session(s) active on this machine${radarTotal > radarDock ? ` · ${radarTotal - radarDock} other agent process(es) nearby` : ''}.`,
      actions: [{ label: 'Sessions', type: 'navigate', target: '/terminal' }],
    });
  }

  if (view === '/' || view === '') {
    if (!scan) {
      push(hints, { id: 'dash-no-scan', priority: 90, tone: 'warning', message: "I haven't seen a system scan yet. Let me check what's installed on your machine.", actions: [{ label: 'Run scan', type: 'navigate', target: '/scan' }] });
    } else if (!ollamaOk && readyProfiles.some(p => (p.meta?.backend || p.backend) === 'ollama')) {
      push(hints, { id: 'dash-no-ollama', priority: 85, tone: 'warning', message: 'Your ready profiles expect Ollama, but I do not detect it. Want help fixing that?', actions: [{ label: 'Readiness', type: 'navigate', target: '/scan' }, { label: 'Stack Builder', type: 'navigate', target: '/builder' }] });
    }
    if (blockedProfiles.length > 0) {
      push(hints, { id: 'dash-blocked', priority: 80, tone: 'warning', message: `${blockedProfiles.length} profile(s) are blocked by memory or audit. I can help you pick a safer alternative.`, actions: [{ label: 'View profiles', type: 'navigate', target: '/profiles' }, { label: 'Ask AI Coach', type: 'chat', prompt: 'Which profiles are blocked and what should I use instead?' }] });
    }
    if (readyProfiles.length > 0 && runningSessions.length === 0) {
      push(hints, { id: 'dash-ready-launch', priority: 70, tone: 'tip', message: `You have ${readyProfiles.length} ready profile(s). Want a one-click launch recommendation?`, actions: [{ label: 'Launch Center', type: 'navigate', target: '/launch' }, { label: 'Easy profiles', type: 'navigate', target: '/profiles' }] });
    }
    if (portfolio?.items?.some(i => i.issues?.length)) {
      push(hints, { id: 'dash-portfolio', priority: 65, tone: 'tip', message: 'Some portfolio projects need git attention — uncommitted changes or missing remotes.', actions: [{ label: 'Ask AI Coach', type: 'chat', prompt: 'Summarize portfolio git health and what to fix first.' }] });
    }
  }

  if (view === '/scan') {
    if (!scan && !pageContext.scanLoaded) {
      push(hints, { id: 'scan-run', priority: 92, tone: 'tip', message: 'Tap Run Scan — I will map agents, models, and env keys for the rest of the app.', actions: [{ label: 'Run scan', type: 'action', target: 'scan-run' }] });
    }
    if (burnRisk !== 'low' || burnSaved) {
      push(hints, {
        id: 'scan-token-burn',
        priority: 76,
        tone: burnRisk === 'high' ? 'warning' : 'tip',
        message: burnSaved
          ? `Token burn: RTK saved ~${burnSaved} · risk ${burnRisk}`
          : `Token burn risk: ${burnRisk} — ${tokenBurn?.risk?.reasons?.[0] || 'check RTK status'}`,
        actions: [{ label: 'Refresh burn', type: 'action', target: 'token-burn-refresh' }, { label: 'Settings', type: 'navigate', target: '/settings' }],
      });
    }
    if (radarTotal > 0) {
      push(hints, {
        id: 'scan-radar-report',
        priority: 74,
        tone: radarExternal > 0 ? 'warning' : 'tip',
        message: `Agent radar: ${radarTotal} running process(es) — ${radarDock} HOOT docked, ${radarExternal} external.`,
        actions: [{ label: 'Refresh radar', type: 'action', target: 'radar-refresh' }, { label: 'Ask HOOT', type: 'chat', prompt: 'Summarize my running coding agents from the agent radar.' }],
      });
    } else if (!pageContext.radarLoading) {
      push(hints, { id: 'scan-radar-idle', priority: 52, tone: 'tip', message: 'No coding-agent processes detected right now. Agent radar rescans automatically while you work.', actions: [{ label: 'Refresh radar', type: 'action', target: 'radar-refresh' }] });
    }
    if (!ollamaOk) {
      push(hints, { id: 'scan-ollama', priority: 88, tone: 'warning', message: 'Ollama is missing. Most local profiles will not launch until it is installed.', actions: [{ label: 'Build local stack', type: 'navigate', target: '/builder' }] });
    }
    if (!rtkOk) {
      push(hints, { id: 'scan-rtk', priority: 72, tone: 'tip', message: 'HOOT RTK not on PATH yet — token compression is preinstalled with HOOT. Open Vitals and click Ensure HOOT RTK (no separate install).', actions: [{ label: 'Vitals', type: 'navigate', target: '/vitals' }, { label: 'Why HOOT RTK?', type: 'chat', prompt: 'How does HOOT-bundled RTK work? It should not require a second installation.' }] });
    } else if (!wslOk) {
      push(hints, { id: 'scan-rtk-win', priority: 60, tone: 'tip', message: 'HOOT RTK is present; native Windows uses explicit rtk <cmd>. Full IDE hooks work best in WSL — still not a separate product install.', actions: [{ label: 'Ask AI Coach', type: 'chat', prompt: 'Explain HOOT RTK on Windows vs WSL hooks.' }] });
    }
    const missingAgents = (scan?.coders || []).filter(c => !c.detection?.present).length;
    if (missingAgents > 3) {
      push(hints, { id: 'scan-agents', priority: 68, tone: 'tip', message: `Several coding agents are not installed yet (${missingAgents} missing). I can suggest a minimal set.`, actions: [{ label: 'Stack Builder install', type: 'navigate', target: '/builder' }] });
    }
  }

  if (view === '/profiles') {
    if (pageContext.viewMode === 'advanced' && profiles.length > 12) {
      push(hints, { id: 'profiles-many', priority: 75, tone: 'tip', message: `${profiles.length} profiles is a lot. Switch to Easy 1-2-3: pick agent → task → launch.`, actions: [{ label: 'Easy mode', type: 'action', target: 'profiles-easy-mode' }, { label: 'Ask AI Coach', type: 'chat', prompt: 'Recommend the best profile for a safe audit on this machine.' }] });
    }
    if (pageContext.viewMode === 'easy' && pageContext.easyStep === 3 && pageContext.easyTopPickId) {
      push(hints, { id: 'profiles-easy-ready', priority: 78, tone: 'celebration', message: `Top pick: ${pageContext.easyTopPickName || pageContext.easyTopPickId}. Preview audit, then launch.`, actions: [{ label: 'Launch top pick', type: 'action', target: 'profiles-launch-top' }] });
    }
    if (blockedProfiles.length > 0) {
      push(hints, { id: 'profiles-blocked', priority: 82, tone: 'warning', message: 'Some profiles are blocked. Check memory evidence before overriding.', actions: [{ label: 'Memory', type: 'navigate', target: '/memory' }] });
    }
  }

  if (view === '/builder') {
    const score = pageContext.stackScore ?? 0;
    const issues = pageContext.stackIssues || [];
    const nodeCount = pageContext.nodeCount ?? 0;
    const step = pageContext.wizardStep;

    if (nodeCount === 0) {
      push(hints, { id: 'builder-empty', priority: 95, tone: 'tip', message: "Looks like a blank canvas. I'll walk you through it: pick an Agent, then a Model, then optional Tools. Or use a Quick Start template.", actions: [{ label: 'Start wizard', type: 'action', target: 'wizard-agent' }, { label: 'Local audit template', type: 'action', target: 'template-local-audit' }] });
    } else if (step === 'agent' && !pageContext.hasAgent) {
      push(hints, { id: 'builder-need-agent', priority: 90, tone: 'tip', message: 'Step 1: choose the agent frontend (Claude Code, Codex, Hermes…). I will only show agents detected on your system.', actions: [{ label: 'Next: Model', type: 'action', target: 'wizard-llm' }] });
    } else if (step === 'llm' && !pageContext.hasLlm) {
      push(hints, { id: 'builder-need-llm', priority: 90, tone: 'tip', message: 'Step 2: pick a model. Green options are loaded in Ollama right now.', actions: [{ label: 'Show loaded only', type: 'action', target: 'filter-loaded' }] });
    } else if (score < 50) {
      push(hints, { id: 'builder-low-score', priority: 88, tone: 'warning', message: `Stack health is ${score}/100. ${issues[0] || 'Fix blockers before launch.'}`, actions: [{ label: 'Install tab', type: 'action', target: 'tab-install' }, { label: 'Ask AI Coach', type: 'chat', prompt: `My stack score is ${score}. Issues: ${issues.join('; ')}. What should I change?` }] });
    } else if (score >= 80 && nodeCount >= 2) {
      push(hints, { id: 'builder-ready', priority: 85, tone: 'celebration', message: 'This stack looks healthy. Save as a profile or launch — I can audit one more time if you want.', actions: [{ label: 'Save profile', type: 'action', target: 'save-stack' }, { label: 'Launch', type: 'action', target: 'launch-stack' }] });
    }
    if (pageContext.selectedNodeType === 'tool' && !pageContext.toolFromMcp) {
      push(hints, { id: 'builder-mcp-tool', priority: 70, tone: 'tip', message: 'Tip: assign MCP git from your catalog instead of typing shell commands — safer and scoped to one repo.', actions: [{ label: 'Assign MCP git', type: 'action', target: 'add-mcp-git' }] });
    }
  }

  if (view === '/terminal') {
    if (runningSessions.length === 0) {
      push(hints, { id: 'term-idle', priority: 70, tone: 'tip', message: 'No active sessions. Launch from Profiles or Stack Builder — I will monitor output here.', actions: [{ label: 'Profiles', type: 'navigate', target: '/profiles' }] });
    } else {
      push(hints, { id: 'term-active', priority: 60, tone: 'tip', message: `${runningSessions.length} session(s) running. Report outcome when done so memory learns.`, actions: [{ label: 'Ask AI Coach', type: 'chat', prompt: 'What should I watch for in the active terminal session?' }] });
    }
  }

  if (view === '/memory') {
    if (pageContext.hasBlockedEvidence) {
      push(hints, { id: 'memory-blocked', priority: 72, tone: 'warning', message: 'Memory contains active block evidence. Launches may be denied until you resolve or override safely.', actions: [{ label: 'Ask AI Coach', type: 'chat', prompt: 'Explain what is blocked in memory and how to unblock safely.' }, { label: 'Profiles', type: 'navigate', target: '/profiles' }] });
    } else {
      push(hints, { id: 'memory-tip', priority: 55, tone: 'tip', message: 'Memory blocks launches after repeated failures. I use evidence here when scoring profiles.', actions: [{ label: 'Ask AI Coach', type: 'chat', prompt: 'Explain what is blocked in memory and how to unblock safely.' }] });
    }
  }

  if (view === '/launch') {
    if (pageContext.hasAuditWarnings && pageContext.previewProfileId) {
      push(hints, { id: 'launch-audit-warn', priority: 84, tone: 'warning', message: `Audit found warnings on ${pageContext.previewProfileId}. Review before launching.`, actions: [{ label: 'Re-preview', type: 'action', target: 'launch-review-first' }, { label: 'Ask AI Coach', type: 'chat', prompt: `Explain launch audit warnings for profile ${pageContext.previewProfileId}.` }] });
    } else if (pageContext.stagedProfileId && !pageContext.hasAuditWarnings) {
      push(hints, { id: 'launch-staged', priority: 80, tone: 'celebration', message: `${pageContext.stagedProfileId} passed audit preview. Ready to launch.`, actions: [{ label: 'Launch now', type: 'action', target: 'launch-staged-go' }] });
    } else if ((pageContext.recommendedCount || 0) > 0) {
      push(hints, { id: 'launch-tip', priority: 65, tone: 'tip', message: 'Launch Center stages profiles with audit preview. Start with the top recommendation.', actions: [{ label: 'Preview top pick', type: 'action', target: 'launch-review-first' }, { label: 'Profiles', type: 'navigate', target: '/profiles' }] });
    } else {
      push(hints, { id: 'launch-empty', priority: 60, tone: 'tip', message: 'No ready recommendations yet. Run a scan or build a stack first.', actions: [{ label: 'Readiness', type: 'navigate', target: '/scan' }, { label: 'Stack Builder', type: 'navigate', target: '/builder' }] });
    }
  }

  if (view === '/settings') {
    if (!pageContext.llamacppEnabled && pageContext.llamacppInterest) {
      push(hints, { id: 'settings-llama', priority: 64, tone: 'tip', message: 'Enable llama.cpp in Local Inference and set a GGUF path for a second backend beside Ollama.', actions: [{ label: 'Ask AI Coach', type: 'chat', prompt: 'Help me configure llama.cpp settings for local inference.' }] });
    }
  }

  if (view === '/modules') {
    const outdated = Number(pageContext.modulesOutdated) || 0;
    const needSync = Number(pageContext.modulesNeedSync) || 0;
    if (outdated > 0 || needSync > 0) {
      push(hints, {
        id: 'modules-sync',
        priority: 83,
        tone: 'warning',
        message: `${needSync || outdated} module(s) need sync or have upstream updates. One-click setup keeps CE skills and MCP paths aligned.`,
        actions: [{ label: 'Run auto-sync', type: 'action', target: 'modules-auto-sync' }, { label: 'Ask HOOT', type: 'chat', prompt: 'Which HOOT modules need sync and what should I install first?' }],
      });
    } else {
      push(hints, {
        id: 'modules-ok',
        priority: 55,
        tone: 'tip',
        message: 'Module Manager installs CE skills, MCP servers, and launch env hooks. HOOT reads this when suggesting stacks.',
        actions: [{ label: 'Ask HOOT', type: 'chat', prompt: 'Explain how HOOT modules connect to my coding agents.' }],
      });
    }
  }

  // Always include a view guide so the coach is never silent on a screen
  const guideHint = buildGuideHint(view, pageContext);
  const projectId = resolveProjectId(activeProject);
  try {
    const coreDir = resolveCoreDir();
    const coreNotes = listActiveNotifications(coreDir, { project_id: projectId });
    for (const hint of toCoachHints(coreNotes)) push(hints, hint);
  } catch { /* optional */ }

  if (coreUsage?.daily_usd_cap) {
    const spend = Number(coreUsage.current_spend) || 0;
    const cap = Number(coreUsage.daily_usd_cap) || 0;
    const pct = cap > 0 ? Math.round((spend / cap) * 100) : 0;
    if (pct >= 50 && pct < 100) {
      push(hints, {
        id: 'core-budget-progress',
        priority: 74,
        tone: pct >= 80 ? 'warning' : 'tip',
        message: `C.O.R.E. spend today: $${spend.toFixed(4)} / $${cap} (${pct}%) for project "${projectId}".`,
        actions: [
          { label: 'View rollup', type: 'navigate', target: '/scan' },
          { label: 'Adjust budget', type: 'chat', prompt: `Help me adjust the C.O.R.E. daily budget for ${projectId}.` },
        ],
      });
    }
  }

  if (!hints.some((h) => h.id === guideHint.id)) {
    push(hints, guideHint);
  }

  return hints.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

module.exports = { buildCoachHints };