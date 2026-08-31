/**
 * HOOT AI Coach chat — multi-provider with local brain + operator commands.
 */

const { toGeminiContents, toOpenAIMessages, getApiKey } = require('./advisor');
const { mediatedLlmCall, mediatedRawCall } = require('./core/mediated');
const { AccessDeniedException } = require('./core/errors');
const { resolveProviderKey, isLocalProvider, isPlaceholderKey } = require('./key-vault');
const { resolveHootBrain, resolveHootBrainAsync } = require('./h00t-brain');
const { buildCoachChatResponse, summarizeCoachContext } = require('./coach-chat');
const { listCoachActions } = require('./coach-actions');
const {
  MAX_TOOL_ROUNDS,
  buildOperatorToolSchemas,
  executeNativeTool,
  toolRunsFromResults,
  proposalsFromToolRuns,
} = require('./coach-tools');

const MAX_HISTORY = 50;
const chats = new Map();

/** Vault-first key resolution — client override only when vault has no key for provider. */
function resolveChatApiKey({ apiKey, effectiveProvider }) {
  if (isLocalProvider(effectiveProvider)) return undefined;
  const vaultKey = resolveProviderKey(effectiveProvider);
  if (vaultKey && vaultKey !== '__local__') return vaultKey;
  const clientKey = String(apiKey || '').trim();
  if (clientKey && !isPlaceholderKey(clientKey)) return clientKey;
  if (effectiveProvider === 'gemini') {
    const legacy = getApiKey();
    return legacy ? String(legacy).trim() : undefined;
  }
  return undefined;
}

const OPERATOR_SYSTEM_PROMPT = `You are HOOT Operator — executive controller for this local AI command center.

YOU HAVE EXECUTIVE CONTROL (with human-in-the-loop):
- Read tools may run immediately (status, memory, git, plans).
- Mutating actions (scan, navigate, launch safe profiles, memory write, UI actions)
  must be proposed for the human to Approve in the coach UI — never claim they already ran
  unless a tool result says completed.

YOU DO: explain screens, propose scans, read repo/memory, recommend safe-audit profiles,
        propose navigate / stage launches, monitor sessions, manage modules/MCP policy.

YOU DO NOT: write code, edit source files, run shell, launch coding/refactor profiles,
             use write/delete MCP tools, or act as a coding agent.

When the user wants code changes, route them: Profiles → safe coding agent in Sessions.
Prefer TOOL CALLS or a \`\`\`json commands\`\`\` block over vague prose.
Every mutating action needs an executable command the UI can Approve.

Command format (required for local models without tool-calling):
\`\`\`json commands
[{"type":"runScan"},{"type":"navigate","route":"/scan"}]
\`\`\`
Also accepted: {"type":"runScan"} or {"action":"runScan"} inside a json fence.

Answer conversationally, then attach the commands block.`;

function getChat(sessionId) {
  if (!chats.has(sessionId)) {
    chats.set(sessionId, {
      messages: [{ role: 'system', text: OPERATOR_SYSTEM_PROMPT }],
      lastActive: Date.now(),
    });
  }
  const chat = chats.get(sessionId);
  chat.lastActive = Date.now();
  return chat;
}

function trimHistory(chat) {
  if (chat.messages.length > MAX_HISTORY) {
    const system = chat.messages.filter((m) => m.role === 'system');
    const rest = chat.messages.filter((m) => m.role !== 'system').slice(-(MAX_HISTORY - system.length));
    chat.messages = [...system, ...rest];
  }
}

function buildCommandPrompt(context, { mode = 'minimal' } = {}) {
  const summary = summarizeCoachContext(context, { mode });
  const includeMcp = mode !== 'minimal' && context.mcpContext;
  const mcpBlock = includeMcp
    ? `\n\nLive read-only context (git + HOOT files — cite when answering repo/memory questions):\n${JSON.stringify(context.mcpContext, null, 2)}`
    : '';
  const modeNote = mode === 'minimal'
    ? '\n(Context is a lightweight heartbeat snapshot — do not assume fresh git/memory unless user asks.)'
    : '';
  return `Current screen context (use this — do NOT invent state):
${JSON.stringify(summary, null, 2)}${mcpBlock}${modeNote}

Executive app commands (HITL: human Approves mutations in the coach UI):
Prefer a fenced block:
\`\`\`json commands
[{"type":"runScan"},{"type":"navigate","route":"/scan"}]
\`\`\`
Commands:
- navigate { route } — e.g. /scan, /profiles, /terminal, /memory, /bench
- runScan { repo? }
- getStatus {}
- launchProfile { profileId } — safe-audit/read-only/monitoring only
- switchProject { path }
- readMemory {}
- appendMemory { title, kind, observed, reason, profileId? }
- makePlan { goal }
- coachAction { target } — UI actions: ${listCoachActions().map((a) => a.id).join(', ')}
- getPrefab {}, getActivity {}
- showMessage { text }, openUrl { url }

Aliases: launch→launchProfile, generatePlan→makePlan, setMemory→appendMemory, action→type
Also accepted: {"action":"runScan"} inside any \`\`\`json fence.

Operator loop: propose runScan → (user Approves) → getStatus → recommend safe profile → propose launchProfile → navigate /terminal.
Use coachAction for in-page buttons (scan-run, launch-staged-go, wizard-agent, modules-auto-sync, etc.).
When mcpContext is present, cite git/memory excerpts — do not invent repo state.
If mcpContext.vault is present (read-only Obsidian notes), you may cite vault excerpts for knowledge —
never claim vault writes; vault is knowledge plane only.
Do NOT say "Running the scan now" unless a tool result already completed it — propose and wait for Approve.
For multi-step ops, prefer proposing a command sequence (or user can start workflows on Approvals).

Respond to the user's message directly. Reference the screen they are on.`;
}

const COMMAND_TYPE_ALIASES = {
  action: null, // field name, not type
  runscan: 'runScan',
  run_scan: 'runScan',
  launch: 'launchProfile',
  launchprofile: 'launchProfile',
  launch_profile: 'launchProfile',
  generateplan: 'makePlan',
  makeplan: 'makePlan',
  make_plan: 'makePlan',
  setmemory: 'appendMemory',
  appendmemory: 'appendMemory',
  append_memory: 'appendMemory',
  getstatus: 'getStatus',
  get_status: 'getStatus',
  readmemory: 'readMemory',
  read_memory: 'readMemory',
  switchproject: 'switchProject',
  switch_project: 'switchProject',
  coachaction: 'coachAction',
  coach_action: 'coachAction',
  getprefab: 'getPrefab',
  getactivity: 'getActivity',
  showmessage: 'showMessage',
  openurl: 'openUrl',
};

function normalizeExtractedCommand(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const typeRaw = raw.type || raw.action || raw.command || raw.name || raw.tool;
  if (!typeRaw) return null;
  const key = String(typeRaw).toLowerCase().replace(/[^a-z0-9_]/g, '');
  const type = COMMAND_TYPE_ALIASES[key] || (COMMAND_TYPE_ALIASES[key] === null ? null : String(typeRaw));
  if (!type) return null;
  // Skip pure alias-null keys that weren't real types
  if (key === 'action' && !raw.type) {
    /* already handled via raw.action as typeRaw */
  }
  const cmd = { ...raw, type };
  if (raw.profile_id && !cmd.profileId) cmd.profileId = raw.profile_id;
  if (raw.route || raw.path || raw.target) {
    if (type === 'navigate' && !cmd.route) cmd.route = raw.route || raw.path || raw.target;
  }
  delete cmd.action;
  delete cmd.command;
  delete cmd.name;
  delete cmd.tool;
  return cmd;
}

function looksLikeCommandObject(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return Boolean(obj.type || obj.action || obj.command || obj.name || obj.tool);
}

/**
 * Extract executable commands from model text.
 * Local models often emit {"action":"runScan"} instead of ```json commands.
 */
/**
 * Strip false "already running / completed" claims when no tool result completed.
 * OOTBIJS truth: never claim execution without evidence.
 */
function scrubFalseExecutionClaims(text, { hasCompletedTools = false, pendingCount = 0 } = {}) {
  let out = String(text || '');
  if (hasCompletedTools) return out;
  const lies = [
    /\bI('m| am) (now )?running (the )?scan\b/gi,
    /\bRunning the scan now\b/gi,
    /\bScan complete\b/gi,
    /\bI('ve| have) (just )?(started|launched|executed)\b/gi,
    /\bSuccessfully (ran|launched|executed)\b/gi,
  ];
  for (const re of lies) {
    out = out.replace(re, (m) => `〔proposed — not executed〕`);
  }
  if (pendingCount > 0 && !/Pending executive actions/i.test(out) && !/approval/i.test(out)) {
    out = `${out}\n\n_Pending executive actions need your Approve — nothing mutates until then._`;
  }
  return out;
}

function extractCommands(aiText) {
  const textIn = String(aiText || '');
  const commands = [];
  let text = textIn;

  const tryParse = (body) => {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  };

  const pushParsed = (parsed) => {
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of list) {
      const cmd = normalizeExtractedCommand(item);
      if (cmd) commands.push(cmd);
    }
  };

  // 1) Preferred: ```json commands
  const preferred = /```json\s*commands\s*\n([\s\S]*?)```/gi;
  let m;
  while ((m = preferred.exec(textIn)) !== null) {
    const parsed = tryParse(m[1].trim());
    if (parsed) pushParsed(parsed);
    text = text.replace(m[0], '').trim();
  }

  // 2) Any ```json fence that looks like commands
  if (!commands.length) {
    const fences = /```(?:json)?\s*\n([\s\S]*?)```/gi;
    while ((m = fences.exec(textIn)) !== null) {
      const body = m[1].trim();
      if (!/[{[]/.test(body)) continue;
      const parsed = tryParse(body);
      if (!parsed) continue;
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (list.some(looksLikeCommandObject)) {
        pushParsed(parsed);
        text = text.replace(m[0], '').trim();
      }
    }
  }

  // 3) Bare JSON object/array on its own line(s)
  if (!commands.length) {
    const bare = /^\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*$/m.exec(textIn);
    if (bare) {
      const parsed = tryParse(bare[1]);
      if (parsed) {
        const list = Array.isArray(parsed) ? parsed : [parsed];
        if (list.some(looksLikeCommandObject)) {
          pushParsed(parsed);
          text = text.replace(bare[0], '').trim();
        }
      }
    }
  }

  // Dedupe by type+JSON
  const seen = new Set();
  const deduped = [];
  for (const c of commands) {
    const key = `${c.type}:${c.profileId || ''}:${c.route || ''}:${c.target || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }

  return { text: text.trim() || textIn.trim(), commands: deduped };
}

function operatorPolicy(settings) {
  const p = settings?.operator_policy || {};
  return {
    native_tools: p.native_tools !== false,
    /** Mutations require UI Approve (default true). Reads still auto-run. */
    hitl: p.hitl !== false && p.hitl_mutations !== false,
    mcp_git: p.mcp_git !== false,
    mcp_filesystem: p.mcp_filesystem !== false,
    audit_log: p.audit_log !== false,
  };
}

const NATIVE_TOOL_LOOP_MS = Math.max(15000, Number(process.env.HOOT_NATIVE_TOOL_LOOP_MS) || 90000);

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label || 'operation'} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runOllamaNativeToolLoop({
  endpoint,
  model,
  messages,
  operatorRuntime,
  sessionId,
  timeoutMs = NATIVE_TOOL_LOOP_MS,
}) {
  const run = async () => {
    const tools = buildOperatorToolSchemas();
    const toolCallLog = [];
    let workingMessages = [...messages];
    let finalContent = '';
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds += 1;
      const res = await mediatedRawCall({
        client: operatorRuntime.coreClient,
        projectRef: operatorRuntime.activeProject,
        provider: 'ollama',
        model,
        endpoint,
        messages: workingMessages,
        tools,
        tool_choice: 'auto',
        tags: ['coach-chat', 'ollama-tools', `round-${rounds}`],
        source: 'coach-chat-tools',
        cache: false,
      });
      if (res.blocked) {
        throw res.error || new AccessDeniedException('Budget hard-stop blocked Ollama tool loop');
      }
      const assistantMsg = res.message || { role: 'assistant', content: '' };
      finalContent = res.text || assistantMsg.content || '';

      if (!res.tool_calls?.length) break;

      workingMessages.push({
        role: 'assistant',
        content: assistantMsg.content || '',
        tool_calls: res.tool_calls,
      });

      for (const tc of res.tool_calls) {
        const fn = tc.function || {};
        const name = fn.name;
        const args = fn.arguments;
        const result = await executeNativeTool(name, args, {
          deps: operatorRuntime.deps,
          hootRoot: operatorRuntime.hootRoot,
          activeProject: operatorRuntime.activeProject,
          policy: operatorRuntime.policy,
          hybridFns: operatorRuntime.hybridFns,
          hitl: operatorRuntime.policy?.hitl !== false,
        });
        toolCallLog.push({ name, args, result });

        if (operatorRuntime.appendLog && operatorRuntime.policy?.audit_log !== false) {
          operatorRuntime.appendLog({
            source: 'chat-native-loop',
            sessionId,
            tool: name,
            ok: Boolean(result?.ok),
            blocked: Boolean(result?.blocked),
            error: result?.error || null,
          });
        }

        workingMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    const toolRuns = toolRunsFromResults(toolCallLog);
    return {
      text: finalContent,
      toolCallLog,
      toolRuns,
      nativeTools: toolCallLog.length > 0,
      rounds,
    };
  };

  return withTimeout(run(), timeoutMs, 'Ollama native tool loop');
}

function localBrainOfflineHint(brain) {
  const lines = [
    '_Local brain offline._ Fix in order:',
    '1. Ensure Ollama is running (`ollama serve`)',
    `2. Pull a model if needed (\`ollama pull ${brain?.model || 'gemma4:latest'}\`)`,
    '3. Restart HOOT (`pwsh D:\\projects\\scripts\\start-hoot.ps1`)',
    '4. Check coach brain doctor: `GET /api/coach/brain`',
  ];
  if ((brain?.suggestions || []).length) {
    lines.push(`Suggestions: ${(brain.suggestions || []).map((s) => s.tag || s).join(', ')}`);
  }
  return `\n\n${lines.join('\n')}`;
}

function brainPublicMeta(brain, effectiveProvider, effectiveModel, effectiveEndpoint) {
  return {
    provider: effectiveProvider || brain?.provider || null,
    model: effectiveModel || brain?.model || null,
    endpoint: effectiveEndpoint || brain?.endpoint || null,
    available: Boolean(brain?.available),
    source: brain?.source || null,
    live_ollama: brain?.live_ollama || null,
    pulling: Boolean(brain?.pulling),
  };
}

function hasValidCloudKey(provider) {
  const key = resolveProviderKey(provider);
  return Boolean(key && key !== '__local__');
}

async function resolveEffectiveBrain({ provider, context, settings, installedModels = null }) {
  const scan = context?.scanFull || context?.scan;
  const brainCfg = settings?.hoot_brain || {};
  let mode = String(brainCfg.mode || 'auto').toLowerCase();
  const clientProvider = provider && provider !== 'auto' ? String(provider).toLowerCase() : null;

  // Prefer async live tags when no pre-fetched list
  const resolveLocal = async (providerOverride) => {
    if (installedModels) {
      return resolveHootBrain({ scan, settings, providerOverride, installedModels });
    }
    return resolveHootBrainAsync({ scan, settings, providerOverride });
  };

  // Cloud settings but local models exist: treat as auto for mascot (local-first)
  if (mode === 'cloud') {
    const localBrain = await resolveLocal('auto');
    if (localBrain.available || localBrain.pulling) {
      return { ...localBrain, source: localBrain.source || 'local-over-cloud' };
    }
  }

  if (clientProvider && isLocalProvider(clientProvider)) {
    const brain = await resolveLocal(clientProvider);
    return { ...brain, provider: clientProvider };
  }

  if ((mode === 'auto' || mode === 'cloud') && clientProvider && !isLocalProvider(clientProvider)) {
    const localBrain = await resolveLocal('auto');
    if (localBrain.available || localBrain.pulling) return localBrain;
  }

  if (mode === 'auto' && !clientProvider) {
    const brain = await resolveLocal('auto');
    if (brain.available || brain.pulling) return brain;
    const cloudProvider = brainCfg.cloud_provider || 'gemini';
    if (hasValidCloudKey(cloudProvider)) {
      return { provider: cloudProvider, model: null, endpoint: null, available: true, source: 'cloud-fallback' };
    }
    return brain;
  }

  if (mode === 'cloud' && !clientProvider) {
    const cloudProvider = brainCfg.cloud_provider || 'gemini';
    if (hasValidCloudKey(cloudProvider)) {
      return { provider: cloudProvider, model: null, endpoint: null, available: true, source: 'cloud' };
    }
    const localBrain = await resolveLocal('auto');
    if (localBrain.available || localBrain.pulling) {
      return { ...localBrain, source: 'local-fallback' };
    }
    return { provider: cloudProvider, model: null, endpoint: null, available: false, source: 'cloud-no-key' };
  }

  if (clientProvider) {
    if (hasValidCloudKey(clientProvider)) {
      return { provider: clientProvider, model: null, endpoint: null, available: true, source: 'explicit' };
    }
    const localBrain = await resolveLocal('auto');
    if (localBrain.available || localBrain.pulling) {
      return { ...localBrain, source: 'local-fallback', requestedProvider: clientProvider };
    }
    return { provider: clientProvider, model: null, endpoint: null, available: false, source: 'explicit-no-key' };
  }

  return resolveLocal('auto');
}

async function processChatMessage({
  sessionId,
  text,
  event,
  context,
  provider,
  model,
  apiKey,
  customEndpoint,
  settings,
  operatorRuntime,
}) {
  const chat = getChat(sessionId);

  if (event) {
    chat.messages.push({ role: 'system', text: `[EVENT] ${event.type}: ${JSON.stringify(event.data || {})}` });
  }
  if (text) {
    chat.messages.push({ role: 'user', text });
  }

  trimHistory(chat);

  const brain = await resolveEffectiveBrain({ provider, context, settings });
  const effectiveProvider = brain.provider || 'coach-local';
  const effectiveModel = model || brain.model;
  const effectiveEndpoint = customEndpoint || brain.endpoint;

  const systemMsg = chat.messages.find((m) => m.role === 'system')?.text || '';
  const contextMode = context?.contextMode || 'minimal';
  const commandPrompt = buildCommandPrompt(context || {}, { mode: contextMode });
  const history = chat.messages.filter((m) => m.role !== 'system');

  const resolvedKey = resolveChatApiKey({ apiKey, effectiveProvider });
  const hasLlm = Boolean(
    (isLocalProvider(effectiveProvider) && brain.available)
    || (resolvedKey && resolvedKey !== '__local__')
    || (effectiveProvider === 'custom' && effectiveEndpoint),
  );

  if (brain.pulling && !hasLlm) {
    const local = buildCoachChatResponse({ text, context: context || {} });
    const tag = brain.model || 'gemma4:latest';
    const pullMsg = `_HOOT is fetching your local brain (\`${tag}\`) via Ollama — try again in a minute. Suggestions: ${(brain.suggestions || []).filter((s) => !s.installed).map((s) => s.tag).join(', ') || tag}._`;
    chat.messages.push({ role: 'model', text: `${local.text}\n\n${pullMsg}` });
    trimHistory(chat);
    return {
      text: `${local.text}\n\n${pullMsg}`,
      commands: local.commands,
      source: 'coach-local',
      brain: brainPublicMeta(brain, effectiveProvider, effectiveModel, effectiveEndpoint),
    };
  }

  if (!hasLlm) {
    const local = buildCoachChatResponse({ text, context: context || {} });
    const textOut = `${local.text}${localBrainOfflineHint(brain)}`;
    chat.messages.push({ role: 'model', text: textOut });
    trimHistory(chat);
    return {
      text: textOut,
      commands: local.commands,
      source: 'coach-local',
      brain: brainPublicMeta(brain, effectiveProvider, effectiveModel, effectiveEndpoint),
    };
  }

  let aiText = '';
  let commands = [];
  let toolRuns = [];
  let nativeTools = false;
  let toolCallLog = [];
  const policy = operatorPolicy(settings);

  const mergeCommands = (fromText, fromTools = []) => {
    const map = new Map();
    for (const c of [...fromTools, ...fromText]) {
      if (!c?.type) continue;
      const key = `${c.type}:${c.profileId || ''}:${c.route || ''}:${c.target || ''}`;
      map.set(key, c);
    }
    return [...map.values()];
  };

  try {
    const openAiMessages = toOpenAIMessages([
      { role: 'system', text: `${systemMsg}\n\n${commandPrompt}` },
      ...history,
    ]);

    if (
      effectiveProvider === 'ollama'
      && policy.native_tools
      && operatorRuntime?.deps
    ) {
      try {
        const loop = await runOllamaNativeToolLoop({
          endpoint: effectiveEndpoint,
          model: effectiveModel,
          messages: openAiMessages,
          operatorRuntime: { ...operatorRuntime, policy },
          sessionId,
        });
        aiText = loop.text;
        toolRuns = loop.toolRuns;
        nativeTools = loop.nativeTools;
        toolCallLog = loop.toolCallLog || [];
        const extracted = extractCommands(aiText);
        aiText = extracted.text;
        const proposed = proposalsFromToolRuns(toolCallLog);
        commands = mergeCommands(extracted.commands, proposed);
        // If model claimed actions but emitted no parseable commands, leave text as-is
      } catch (toolErr) {
        // OOTBIJS: tool loop hung/failed → single-shot completion still uses the local model
        const res = await mediatedLlmCall({
          client: operatorRuntime?.coreClient,
          projectRef: operatorRuntime?.activeProject || context?.activeProject,
          provider: 'ollama',
          model: effectiveModel,
          endpoint: effectiveEndpoint,
          messages: openAiMessages,
          tags: ['coach-chat', 'tool-loop-fallback'],
          source: 'coach-chat',
        });
        if (res.blocked) {
          throw res.error || new AccessDeniedException(res.meta?.reason || 'Budget hard-stop');
        }
        aiText = res.text;
        const extracted = extractCommands(aiText);
        aiText = extracted.text;
        commands = extracted.commands;
        if (!aiText) {
          throw toolErr;
        }
      }
    } else if (effectiveProvider === 'gemini') {
      const contents = toGeminiContents([
        { role: 'system', text: `${systemMsg}\n\n${commandPrompt}` },
        ...history,
      ]);
      const res = await mediatedLlmCall({
        client: operatorRuntime?.coreClient,
        projectRef: operatorRuntime?.activeProject || context?.activeProject,
        provider: 'gemini',
        model: effectiveModel || 'gemini-2.0-flash',
        apiKey: resolvedKey,
        contents,
        tags: ['coach-chat'],
        source: 'coach-chat',
      });
      if (res.blocked) {
        throw res.error || new AccessDeniedException(res.meta?.reason || 'Budget hard-stop');
      }
      aiText = res.text;
      const extracted = extractCommands(aiText);
      aiText = extracted.text;
      commands = extracted.commands;
    } else {
      const res = await mediatedLlmCall({
        client: operatorRuntime?.coreClient,
        projectRef: operatorRuntime?.activeProject || context?.activeProject,
        provider: effectiveProvider,
        model: effectiveModel,
        apiKey: resolvedKey === '__local__' ? undefined : resolvedKey,
        endpoint: effectiveEndpoint,
        messages: openAiMessages,
        tags: ['coach-chat'],
        source: 'coach-chat',
      });
      if (res.blocked) {
        throw res.error || new AccessDeniedException(res.meta?.reason || 'Budget hard-stop');
      }
      aiText = res.text;
      const extracted = extractCommands(aiText);
      aiText = extracted.text;
      commands = extracted.commands;
    }

    // Truth pass: never claim completed mutations without tool success; always surface HITL queue
    const completedTools = (toolRuns || []).some((t) => t.ok && !t.proposed);
    aiText = scrubFalseExecutionClaims(aiText, {
      hasCompletedTools: completedTools,
      pendingCount: commands.length,
    });
    if (commands.length) {
      const pendingNote = `\n\n_Pending executive actions (Approve to run): ${commands.map((c) => c.type).join(', ')}_`;
      if (!/Pending executive actions/i.test(aiText)) {
        aiText = `${aiText}${pendingNote}`;
      }
    }
  } catch (e) {
    const local = buildCoachChatResponse({ text, context: context || {} });
    const shortErr = String(e.message || 'unavailable').split('\n')[0].slice(0, 120);
    const localHint = e instanceof AccessDeniedException
      ? 'C.O.R.E. budget guard'
      : (isLocalProvider(effectiveProvider) ? 'Local LLM' : 'LLM');
    const budgetNote = e instanceof AccessDeniedException
      ? '\n\n_Set a higher daily cap via **Settings** or PATCH `/api/core/budgets`._'
      : localBrainOfflineHint(brain);
    aiText = `${local.text}\n\n_(${localHint} — ${shortErr}. Answering from your screen.)_${budgetNote}`;
    commands = local.commands;
    chat.messages.push({ role: 'model', text: aiText });
    trimHistory(chat);
    return {
      text: aiText,
      commands,
      source: 'coach-local',
      llmError: shortErr,
      brain: brainPublicMeta(brain, effectiveProvider, effectiveModel, effectiveEndpoint),
    };
  }

  chat.messages.push({ role: 'model', text: aiText });
  trimHistory(chat);

  return {
    text: aiText,
    commands,
    toolRuns,
    nativeTools,
    pendingApprovals: commands.length,
    hitl: policy.hitl,
    source: effectiveProvider,
    brain: brainPublicMeta(brain, effectiveProvider, effectiveModel, effectiveEndpoint),
  };
}

function getChatHistory(sessionId) {
  return getChat(sessionId).messages.filter((m) => m.role !== 'system');
}

function clearChat(sessionId) {
  chats.delete(sessionId);
}

module.exports = {
  processChatMessage,
  getChatHistory,
  clearChat,
  OPERATOR_SYSTEM_PROMPT,
  resolveChatApiKey,
  withTimeout,
  localBrainOfflineHint,
  brainPublicMeta,
  extractCommands,
  normalizeExtractedCommand,
  scrubFalseExecutionClaims,
  NATIVE_TOOL_LOOP_MS,
};