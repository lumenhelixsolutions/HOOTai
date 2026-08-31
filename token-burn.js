/**
 * HOOT Token Burn — RTK prevention layer (v1 local ingest from scan + rtk gain).
 */

const { execFile } = require('child_process');

function formatTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

function normalizeDailyRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    date: row.date || row.day || null,
    commands: Number(row.cmds ?? row.commands ?? row.total_commands ?? 0),
    input: Number(row.input ?? row.total_input ?? 0),
    output: Number(row.output ?? row.total_output ?? 0),
    saved: Number(row.saved ?? row.total_saved ?? row.saved_tokens ?? 0),
    savings_pct: Number(row.save_pct ?? row.savings_pct ?? row.avg_savings_pct ?? 0),
  };
}

function parseRtkGain(raw) {
  if (!raw) {
    return { summary: null, daily: [], weekly: [], monthly: [], has_data: false };
  }
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return { summary: null, daily: [], weekly: [], monthly: [], has_data: false };
    }
  }
  const summary = data.summary
    ? {
        total_commands: Number(data.summary.total_commands) || 0,
        total_input: Number(data.summary.total_input) || 0,
        total_output: Number(data.summary.total_output) || 0,
        total_saved: Number(data.summary.total_saved) || 0,
        avg_savings_pct: Number(data.summary.avg_savings_pct) || 0,
      }
    : null;
  const daily = (Array.isArray(data.daily) ? data.daily : [])
    .map(normalizeDailyRow)
    .filter(Boolean);
  const weekly = (Array.isArray(data.weekly) ? data.weekly : []).map(normalizeDailyRow).filter(Boolean);
  const monthly = (Array.isArray(data.monthly) ? data.monthly : []).map(normalizeDailyRow).filter(Boolean);
  return {
    summary,
    daily: daily.slice(-14),
    weekly: weekly.slice(-8),
    monthly: monthly.slice(-6),
    has_data: Boolean(summary && summary.total_commands > 0),
  };
}

const SHELL_HEAVY_AGENT_IDS = new Set([
  'claude-code',
  'codex',
  'cursor-agent',
  'hermes',
  'opencode',
  'kimi',
  'gemini-cli',
  'grok',
]);

function listShellHeavyAgents(scan) {
  return (scan?.coders || [])
    .filter((c) => c.detection?.present && (SHELL_HEAVY_AGENT_IDS.has(c.id) || ['claude', 'codex', 'hermes', 'gemini'].includes(c.command)))
    .map((c) => ({ id: c.id, name: c.name, command: c.command }));
}

function buildRecommendations({ rtkPresent, wslPresent, rtkProfiles, shellAgents, gain, settings, rtkPath }) {
  const recs = [];
  if (!rtkPresent) {
    recs.push({
      id: 'ensure-hoot-rtk',
      priority: 90,
      title: 'Ensure HOOT RTK (preinstalled — not a second install)',
      detail: 'HOOT ships RTK under HootAi/bin. Open Vitals → Ensure HOOT RTK to provision the binary.',
      action: 'vitals',
    });
  } else if (!wslPresent && process.platform === 'win32') {
    recs.push({
      id: 'wsl-rtk-hooks',
      priority: 55,
      title: 'Optional: WSL for full IDE auto-hooks',
      detail: `HOOT RTK is present${rtkPath ? ` at ${rtkPath}` : ''}. Native Windows uses explicit rtk <cmd>; full Claude/Cursor hooks work best in WSL.`,
      action: 'settings',
    });
  }
  if (rtkProfiles.length > 0 && !rtkPresent) {
    recs.push({
      id: 'rtk-profiles-blocked',
      priority: 85,
      title: `${rtkProfiles.length} profile(s) expect RTK`,
      detail: 'HOOT prepends bin/ on launch — ensure RTK via Vitals if still missing.',
      action: 'vitals',
    });
  }
  if (rtkPresent && !gain.has_data) {
    recs.push({
      id: 'rtk-no-gain-yet',
      priority: 55,
      title: 'No RTK savings logged yet',
      detail: 'Run agent sessions with RTK (HOOT bin on PATH), then refresh burn stats.',
      action: 'refresh',
    });
  }
  if (settings?.tokenEfficiency?.rtkRecommended === false && shellAgents.length > 0) {
    recs.push({
      id: 'enable-rtk-setting',
      priority: 60,
      title: 'Re-enable RTK recommendations in Settings',
      detail: 'Token efficiency hints are turned off.',
      action: 'settings',
    });
  }
  return recs.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

function assessBurnRisk({ rtkPresent, wslPresent, rtkProfiles, shellAgents, gain, productionContext = null }) {
  const reasons = [];
  let level = 'low';
  const grokTokens = Number(productionContext?.est_context_tokens) || 0;

  if (grokTokens >= 120000) {
    level = level === 'high' ? 'high' : 'medium';
    reasons.push(`Grok CLI session context ~${formatTokens(grokTokens)} est tokens — compaction/handoff recommended`);
  } else if (grokTokens >= 50000) {
    reasons.push(`Grok CLI session context ~${formatTokens(grokTokens)} est tokens — monitor burn on long turns`);
  }

  if (!rtkPresent && (rtkProfiles.length > 0 || shellAgents.length >= 2)) {
    level = 'high';
    reasons.push('HOOT RTK not active yet while shell-heavy agents or RTK-tagged profiles are present — open Vitals → Ensure HOOT RTK');
  } else if (!rtkPresent && shellAgents.length > 0) {
    level = 'medium';
    reasons.push('HOOT RTK binary not detected — provision from Vitals (preinstalled, not a separate install)');
  } else if (rtkPresent && !wslPresent && process.platform === 'win32') {
    level = 'low';
    reasons.push('HOOT RTK ready on native Windows — use rtk <cmd>; optional WSL for full IDE hooks');
  } else if (gain.has_data && gain.summary) {
    level = 'low';
    reasons.push(`HOOT RTK prevented ~${formatTokens(gain.summary.total_saved)} tokens from reaching agents`);
  } else if (rtkPresent) {
    level = 'low';
    reasons.push('HOOT RTK ready (bundled) — run sessions to accumulate savings data');
  } else {
    level = 'medium';
    reasons.push('Ensure HOOT RTK from Vitals before long Claude/Codex sessions');
  }

  return { level, reasons };
}

function buildTokenBurnReport({ scan = null, profiles = [], settings = {}, gainOverride = null, agentRadar = null, rtkStatus = null } = {}) {
  const te = scan?.token_efficiency || {};
  const rtkTool = scan?.tools?.rtk || {};
  // Prefer live HOOT-bundled RTK status (bin/) over stale scan PATH probes
  const rtkPresent = Boolean(
    rtkStatus?.present
    || te.rtk?.present
    || rtkTool.present,
  );
  const rtkPath = rtkStatus?.path || te.rtk?.path || rtkTool.path || null;
  const rtkVersion = rtkStatus?.version || te.rtk?.version || rtkTool.version || null;
  const wsl = {
    present: Boolean(te.wsl?.present ?? scan?.tools?.wsl?.present),
    full_hooks: Boolean(te.wsl?.full_hooks),
  };
  const gain = parseRtkGain(gainOverride ?? te.rtk?.gain ?? null);
  const rtkProfiles = profiles
    .filter((p) => p.meta?.token_efficiency === 'rtk')
    .map((p) => ({ id: p.id, name: p.name, frontend: p.meta?.frontend || null }));
  const shellAgents = listShellHeavyAgents(scan);
  const productionContext = agentRadar?.production_context || null;
  const risk = assessBurnRisk({
    rtkPresent,
    wslPresent: wsl.present,
    rtkProfiles,
    shellAgents,
    gain,
    productionContext,
  });
  const recommendations = buildRecommendations({
    rtkPresent,
    wslPresent: wsl.present,
    rtkProfiles,
    shellAgents,
    gain,
    settings,
    rtkPath,
  });

  return {
    version: 1,
    scanned_at: new Date().toISOString(),
    prevention: {
      rtk: {
        present: rtkPresent,
        version: rtkVersion,
        path: rtkPath,
        source: rtkStatus?.source || te.rtk?.source || rtkTool.source || null,
        preinstalled: true,
        separate_install_required: false,
      },
      wsl,
    },
    gain,
    rtk_profiles: rtkProfiles,
    shell_agents: shellAgents,
    risk,
    recommendations,
    settings: {
      rtk_recommended: settings?.tokenEfficiency?.rtkRecommended !== false,
    },
    docs: {
      token_efficiency: 'docs/TOKEN_EFFICIENCY.md',
      rtk_guide: 'https://www.rtk-ai.app/docs/analytics/gain/',
      skill_id: 'token-efficiency',
    },
    formatted: {
      total_saved: gain.summary ? formatTokens(gain.summary.total_saved) : null,
      avg_savings_pct: gain.summary ? `${gain.summary.avg_savings_pct.toFixed(1)}%` : null,
    },
    production_context: productionContext,
  };
}

function refreshRtkGain(hootRoot = null) {
  return new Promise((resolve) => {
    let bin = process.platform === 'win32' ? 'rtk.exe' : 'rtk';
    try {
      if (hootRoot) {
        const { resolveRtk } = require('./rtk-runtime');
        const r = resolveRtk(hootRoot);
        if (r.present && r.path) bin = r.path;
      }
    } catch { /* use PATH */ }
    execFile(bin, ['gain', '--all', '--format', 'json'], { timeout: 20000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve({ ok: false, error: err.message, gain: null });
      try {
        const gain = JSON.parse(String(stdout).trim());
        return resolve({ ok: true, gain, path: bin });
      } catch (e) {
        return resolve({ ok: false, error: e.message, gain: null });
      }
    });
  });
}

module.exports = {
  formatTokens,
  parseRtkGain,
  buildTokenBurnReport,
  refreshRtkGain,
  listShellHeavyAgents,
};