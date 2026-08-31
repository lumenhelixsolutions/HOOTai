/**
 * HOOT operator native tool schemas (Ollama / OpenAI tools API) + execution bridge.
 */

const { normalizeType } = require('./coach-operator');
const { normalizeCoachActionTarget } = require('./coach-actions');
const { readAllowedExcerpt, gitSnapshot } = require('./coach-mcp');

const MAX_TOOL_ROUNDS = 6;

/** Tools that may run server-side without UI HITL (read-only / planning). */
const AUTO_EXECUTE_TOOLS = new Set([
  'get_status',
  'read_memory',
  'git_snapshot',
  'read_hoot_file',
  'make_plan',
  'get_prefab',
  'get_activity',
  'providers_doctor',
  'credentials_list',
]);

/** Tools that change command-center state — always propose for human approval. */
const HITL_TOOLS = new Set([
  'navigate',
  'run_scan',
  'launch_profile',
  'append_memory',
  'coach_action',
  'set_provider_status',
  'generate_handoff',
  'switch_project',
  'booth_open',
  'credentials_put',
  'credentials_delete',
]);

function isHitlTool(name) {
  return HITL_TOOLS.has(String(name || ''));
}

function isAutoExecuteTool(name) {
  return AUTO_EXECUTE_TOOLS.has(String(name || ''));
}

function buildOperatorToolSchemas() {
  return [
    {
      type: 'function',
      function: {
        name: 'navigate',
        description: 'Navigate the HOOT UI to a route path',
        parameters: {
          type: 'object',
          properties: { route: { type: 'string', description: 'e.g. /scan, /profiles, /terminal, /launch' } },
          required: ['route'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'run_scan',
        description: 'Run system readiness scan (tools, agents, Ollama, env)',
        parameters: { type: 'object', properties: { repo: { type: 'string' } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_status',
        description: 'Get live HOOT status: scan summary, profiles, sessions, agent radar',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'launch_profile',
        description: 'Launch a safe-audit/read-only/monitoring profile only (never coding profiles)',
        parameters: {
          type: 'object',
          properties: { profile_id: { type: 'string' } },
          required: ['profile_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_memory',
        description: 'Read HOOT memory.md evidence log',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'append_memory',
        description: 'Append a structured evidence block to memory.md',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            kind: { type: 'string' },
            observed: { type: 'string' },
            reason: { type: 'string' },
            profile_id: { type: 'string' },
          },
          required: ['title', 'observed'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'coach_action',
        description: 'Trigger an in-page UI action (scan-run, launch-staged-go, wizard-agent, etc.)',
        parameters: {
          type: 'object',
          properties: { target: { type: 'string' } },
          required: ['target'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'make_plan',
        description: 'Build a launch plan for a goal (privacy, audit, etc.)',
        parameters: {
          type: 'object',
          properties: { goal: { type: 'string' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'git_snapshot',
        description: 'Read-only git status and recent commits for the active project',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_hoot_file',
        description: 'Read an allowlisted HOOT root file excerpt (memory.md, profiles/, state/)',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_provider_status',
        description: 'Update provider cooldown registry (claude, chatgpt, gemini, kimi, ollama, llamacpp)',
        parameters: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            status: { type: 'string', enum: ['active', 'cooldown', 'unknown'] },
            cooldown_until: { type: 'string' },
            preset: { type: 'string', enum: ['3hr', '5hr', 'midnight_pt'] },
          },
          required: ['provider'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'providers_doctor',
        description: 'Read-only ProviderRide doctor: multi-backend status matrix, cooldowns, fixes (no mutations)',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'booth_open',
        description: 'HITL: open allowlisted AI account URL (usage/account) via Account Booth — never free-form URLs',
        parameters: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: 'claude | chatgpt | gemini | kimi | …' },
            target: { type: 'string', description: 'account | usage' },
            dry_run: { type: 'boolean' },
          },
          required: ['provider'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'credentials_list',
        description: 'List masked provider credentials (presence only; never plaintext)',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'credentials_put',
        description: 'HITL: store provider API key/session/cookie in AES-GCM vault (value never logged)',
        parameters: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            kind: { type: 'string', enum: ['api_key', 'session', 'cookie'] },
            value: { type: 'string', description: 'Secret to seal — not echoed back' },
          },
          required: ['provider', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'credentials_delete',
        description: 'HITL: delete a sealed credential slot',
        parameters: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            kind: { type: 'string', enum: ['api_key', 'session', 'cookie'] },
          },
          required: ['provider'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generate_handoff',
        description: 'Generate paste-ready handoff packet for switching cloud providers',
        parameters: {
          type: 'object',
          properties: {
            next_action: { type: 'string' },
            write_snapshot: { type: 'boolean' },
          },
        },
      },
    },
  ];
}

function parseToolArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function toolCallToCommand(name, args) {
  const a = args || {};
  switch (name) {
    case 'navigate':
      return { type: 'navigate', route: a.route };
    case 'run_scan':
      return { type: 'runScan', repo: a.repo };
    case 'get_status':
      return { type: 'getStatus' };
    case 'launch_profile':
      return { type: 'launchProfile', profileId: a.profile_id || a.profileId };
    case 'read_memory':
      return { type: 'readMemory' };
    case 'append_memory':
      return { type: 'appendMemory', title: a.title, kind: a.kind, observed: a.observed, reason: a.reason, profileId: a.profile_id };
    case 'coach_action':
      return { type: 'coachAction', target: normalizeCoachActionTarget(a.target) };
    case 'make_plan':
      return { type: 'makePlan', goal: a.goal || 'privacy' };
    case 'set_provider_status':
      return {
        type: 'setProviderStatus',
        provider: a.provider,
        status: a.status,
        cooldown_until: a.cooldown_until,
        preset: a.preset,
      };
    case 'providers_doctor':
      return { type: 'providersDoctor' };
    case 'booth_open':
      return {
        type: 'boothOpen',
        provider: a.provider,
        target: a.target || 'account',
        dry_run: Boolean(a.dry_run || a.dryRun),
      };
    case 'credentials_list':
      return { type: 'credentialsList' };
    case 'credentials_put':
      return {
        type: 'credentialsPut',
        provider: a.provider,
        kind: a.kind || 'api_key',
        // value travels only inside HITL payload until Approve executes
        value: a.value,
      };
    case 'credentials_delete':
      return {
        type: 'credentialsDelete',
        provider: a.provider,
        kind: a.kind || 'api_key',
      };
    case 'generate_handoff':
      return { type: 'generateHandoff', next_action: a.next_action, write_snapshot: a.write_snapshot };
    default:
      return null;
  }
}

/**
 * Execute or propose a native tool.
 * Mutations default to HITL proposal (not executed) so the UI can Approve.
 */
async function executeNativeTool(name, args, { deps, hootRoot, activeProject, policy, hybridFns, hitl = true }) {
  const parsed = parseToolArgs(args);

  // HITL: queue mutating tools for human approval instead of executing mid-chat
  if (hitl && isHitlTool(name)) {
    const command = toolCallToCommand(name, parsed) || { type: name, ...parsed };
    return {
      ok: true,
      proposed: true,
      pending_approval: true,
      type: command.type || name,
      command,
      summary: `Queued for approval: ${command.type || name}`,
      message: 'Not executed yet — waiting for human-in-the-loop approval in the coach UI.',
    };
  }

  if (name === 'set_provider_status') {
    const fn = hybridFns?.patchProvider || hybridFns?.applyCooldownPreset;
    if (!fn) return { ok: false, error: 'Provider cooldown module unavailable' };
    try {
      const state = parsed.preset
        ? hybridFns.applyCooldownPreset(parsed.provider, parsed.preset, parsed.cooldown_until)
        : hybridFns.patchProvider(parsed);
      const registry = hybridFns.enrichRegistry(state, { scan: deps?.lastScan });
      return { ok: true, type: 'set_provider_status', registry };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (name === 'providers_doctor') {
    try {
      const providerRideHost = require('./provider-ride-host');
      const enrich = hybridFns?.enrichRegistry;
      const load = hybridFns?.loadState;
      const registry = enrich && load
        ? enrich(load(), { scan: deps?.lastScan })
        : { providers: {} };
      const report = providerRideHost.runHostDoctor({
        registry,
        scan: deps?.lastScan,
      });
      return { ok: true, type: 'providers_doctor', report };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (name === 'booth_open') {
    // Should only run after HITL Approve (hitl path returns proposal above)
    try {
      const providerRideHost = require('./provider-ride-host');
      const result = await providerRideHost.openBooth(
        parsed.provider,
        parsed.target || 'account',
        { dryRun: Boolean(parsed.dry_run || parsed.dryRun) },
      );
      return { ok: result.ok, type: 'booth_open', ...result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (name === 'credentials_list') {
    try {
      const providerRideHost = require('./provider-ride-host');
      return {
        ok: true,
        type: 'credentials_list',
        items: providerRideHost.listCredentials(),
        status: providerRideHost.credentialStatus(),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (name === 'credentials_put') {
    try {
      const providerRideHost = require('./provider-ride-host');
      const { setVaultKey } = require('./key-vault');
      const result = providerRideHost.putCredential(
        {
          provider: parsed.provider,
          kind: parsed.kind || 'api_key',
          value: parsed.value,
          source: 'coach-hitl',
        },
        {
          dualWrite: ({ envNames, value }) => {
            for (const n of envNames || []) setVaultKey(n, value, 'provider-ride', { force: true });
          },
        },
      );
      if (result.value) delete result.value;
      return { ok: result.ok, type: 'credentials_put', ...result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (name === 'credentials_delete') {
    try {
      const providerRideHost = require('./provider-ride-host');
      const result = providerRideHost.deleteCredential(parsed.provider, parsed.kind || 'api_key');
      return { ok: result.ok, type: 'credentials_delete', ...result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (name === 'generate_handoff') {
    if (!hybridFns?.generateHandoffPacket) return { ok: false, error: 'Handoff module unavailable' };
    try {
      const packet = await hybridFns.generateHandoffPacket({
        activeProject,
        nextAction: parsed.next_action,
        writeSnapshot: parsed.write_snapshot !== false,
      });
      return { ok: true, type: 'generate_handoff', packet };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (name === 'git_snapshot') {
    if (policy?.mcp_git === false) return { ok: false, blocked: true, error: 'git MCP disabled in operator policy' };
    const snap = await gitSnapshot(activeProject);
    return { ok: true, type: 'git_snapshot', snapshot: snap || { error: 'No git repo on active project' } };
  }

  if (name === 'read_hoot_file') {
    if (policy?.mcp_filesystem === false) return { ok: false, blocked: true, error: 'filesystem MCP disabled in operator policy' };
    const rel = parsed.path || parsed.file;
    const item = readAllowedExcerpt(hootRoot, rel);
    if (!item) return { ok: false, blocked: true, error: `Path not allowlisted: ${rel}` };
    return { ok: true, type: 'read_hoot_file', file: item };
  }

  const cmd = toolCallToCommand(name, parsed);
  if (!cmd) return { ok: false, error: `Unknown tool: ${name}` };
  return deps.executeCoachCommand(cmd, deps.coachDeps);
}

function summarizeToolResult(name, result) {
  if (result?.pending_approval || result?.proposed) {
    return `${name}: pending human approval`;
  }
  if (!result?.ok) return `${name}: blocked — ${result?.error || 'failed'}`;
  if (name === 'run_scan') return 'run_scan: scan complete';
  if (name === 'get_status') return 'get_status: live status fetched';
  if (name === 'launch_profile') return `launch_profile: launched ${result.session?.profileName || result.session?.profileId || ''}`.trim();
  if (name === 'navigate') return `navigate: ${result.route}`;
  if (name === 'coach_action') return `coach_action: ${result.target}`;
  if (name === 'read_memory') return 'read_memory: memory loaded';
  if (name === 'append_memory') return 'append_memory: evidence logged';
  if (name === 'git_snapshot') return `git_snapshot: ${result.snapshot?.branch || 'no repo'}`;
  if (name === 'read_hoot_file') return `read_hoot_file: ${result.file?.path}`;
  if (name === 'set_provider_status') return `set_provider_status: ${result.registry?.matrix_line || 'updated'}`;
  if (name === 'providers_doctor') return `providers_doctor: ${result.report?.score || '?'} — ${result.report?.matrix_line || 'ok'}`;
  if (name === 'booth_open') return result.opened ? `booth_open: ${result.url}` : `booth_open: ${result.error || result.url || 'queued'}`;
  if (name === 'credentials_list') return `credentials_list: ${result.items?.length || 0} sealed slots`;
  if (name === 'credentials_put') return result.ok ? `credentials_put: sealed ${result.slot} (${result.masked})` : `credentials_put: ${result.error}`;
  if (name === 'credentials_delete') return result.ok ? `credentials_delete: removed` : `credentials_delete: ${result.error}`;
  if (name === 'generate_handoff') return `generate_handoff: packet ready (${result.packet?.markdown?.length || 0} chars)`;
  return `${name}: ok`;
}

function toolRunsFromResults(calls) {
  return calls.map((c) => ({
    type: c.name,
    ok: Boolean(c.result?.ok),
    proposed: Boolean(c.result?.proposed || c.result?.pending_approval),
    summary: summarizeToolResult(c.name, c.result),
    route: c.result?.route || null,
    target: c.result?.target || null,
    launched: Boolean(c.result?.launched),
    command: c.result?.command || null,
  }));
}

/** Collect HITL-pending commands from native tool runs for the coach UI. */
function proposalsFromToolRuns(toolCallLog = []) {
  const out = [];
  for (const c of toolCallLog) {
    if (c.result?.command && (c.result.proposed || c.result.pending_approval)) {
      out.push({ ...c.result.command, _source: 'native-tool', _tool: c.name });
    }
  }
  return out;
}

module.exports = {
  MAX_TOOL_ROUNDS,
  AUTO_EXECUTE_TOOLS,
  HITL_TOOLS,
  isHitlTool,
  isAutoExecuteTool,
  buildOperatorToolSchemas,
  toolCallToCommand,
  parseToolArgs,
  executeNativeTool,
  summarizeToolResult,
  toolRunsFromResults,
  proposalsFromToolRuns,
};