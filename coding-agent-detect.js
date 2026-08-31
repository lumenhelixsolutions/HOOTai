/**
 * coding-agent-detect.js — detect-only status for coding agents and local gateways.
 *
 * Surfaces Claude Code, OmniRoute, ANTHROPIC_BASE_URL, and OpenCode in Vitals/doctor.
 * Does NOT modify Claude settings, OmniRoute config, or environment variables.
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawnSync } = require('child_process');
const os = require('os');

const SCHEMA = 'hoot.coding_agents.v1';

const DEFAULT_OMNIROUTE_PORTS = Object.freeze({
  primary: 20131,
  secondary: 20132,
});

function homeDir(override) {
  return override || process.env.USERPROFILE || process.env.HOME || os.homedir();
}

function whichOnPath(name, spawn = spawnSync) {
  const isWin = process.platform === 'win32';
  const probe = spawn(isWin ? 'where' : 'which', [name], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
  });
  if (probe.status !== 0 || !probe.stdout?.trim()) return null;
  return probe.stdout.trim().split(/\r?\n/)[0];
}

function runVersion(exePath, args = ['--version'], spawn = spawnSync) {
  if (!exePath) return null;
  try {
    const out = spawn(exePath, args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    });
    const text = (out.stdout || out.stderr || '').trim();
    return text.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function readJsonSafe(filePath, readFile = fs.readFileSync, exists = fs.existsSync) {
  try {
    if (!exists(filePath)) return null;
    return JSON.parse(readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Probe a TCP port on localhost. Returns { open, status? }.
 * OmniRoute may answer HTTP with 426 Upgrade Required — that still means listening.
 */
function probePort(port, host = '127.0.0.1', timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.destroy();
      resolve({ open: true, port });
    });
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ open: false, port, reason: 'timeout' });
    });
    socket.on('error', (err) => {
      resolve({ open: false, port, reason: err.code || err.message });
    });
  });
}

function normalizeBaseUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  return s.replace(/\/+$/, '');
}

function baseUrlPointsAtOmniRoute(baseUrl, ports = DEFAULT_OMNIROUTE_PORTS) {
  if (!baseUrl) return false;
  try {
    const u = new URL(baseUrl.includes('://') ? baseUrl : `http://${baseUrl}`);
    const host = (u.hostname || '').toLowerCase();
    const local = host === '127.0.0.1' || host === 'localhost' || host === '::1';
    if (!local) return false;
    const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
    return port === ports.primary || port === ports.secondary;
  } catch {
    return /2013[12]/.test(baseUrl) && /localhost|127\.0\.0\.1/i.test(baseUrl);
  }
}

/**
 * Claude Code install + settings (read-only).
 */
function detectClaudeCode(options = {}) {
  const home = homeDir(options.home);
  const spawn = options.spawn || spawnSync;
  const readFile = options.readFile || fs.readFileSync;
  const exists = options.exists || fs.existsSync;

  const names = process.platform === 'win32' ? ['claude', 'claude.exe'] : ['claude'];
  let exePath = null;
  for (const n of names) {
    exePath = whichOnPath(n, spawn);
    if (exePath) break;
  }

  // Fallback: well-known native install path on Windows
  if (!exePath) {
    const candidates = [
      path.join(home, '.local', 'bin', 'claude.exe'),
      path.join(home, '.local', 'bin', 'claude'),
    ];
    for (const c of candidates) {
      if (exists(c)) {
        exePath = c;
        break;
      }
    }
  }

  const version = exePath ? runVersion(exePath, ['--version'], spawn) : null;
  const settingsPath = path.join(home, '.claude', 'settings.json');
  const claudeJsonPath = path.join(home, '.claude.json');
  const settings = readJsonSafe(settingsPath, readFile, exists);
  const claudeJson = readJsonSafe(claudeJsonPath, readFile, exists);
  const homeDirPresent = exists(path.join(home, '.claude'));

  const model = settings?.model || null;
  const contextLength = settings?.['model.context_length'] ?? settings?.model_context_length ?? null;
  const approvedKeys = claudeJson?.customApiKeyResponses?.approved || [];
  const ollamaKeyApproved = Array.isArray(approvedKeys)
    && approvedKeys.some((k) => String(k).toLowerCase() === 'ollama');

  const present = Boolean(exePath) || homeDirPresent;
  return {
    id: 'claude-code',
    name: 'Claude Code',
    present,
    on_path: Boolean(exePath),
    path: exePath,
    version: version || null,
    home: homeDirPresent ? path.join(home, '.claude') : null,
    settings_path: exists(settingsPath) ? settingsPath : null,
    model,
    context_length: contextLength,
    ollama_api_key_approved: ollamaKeyApproved,
    plugins: settings?.enabledPlugins || null,
    note: present
      ? (model ? `Configured model: ${model}` : 'Installed; no model override in settings.json')
      : 'Claude Code not detected',
  };
}

/**
 * OpenCode — lightweight presence only.
 */
function detectOpenCode(options = {}) {
  const home = homeDir(options.home);
  const spawn = options.spawn || spawnSync;
  const exists = options.exists || fs.existsSync;

  const exePath = whichOnPath('opencode', spawn)
    || (exists(path.join(home, '.opencode')) ? null : null);
  const homePresent = exists(path.join(home, '.opencode'));
  const version = exePath ? runVersion(exePath, ['--version'], spawn) : null;

  return {
    id: 'opencode',
    name: 'OpenCode',
    present: Boolean(exePath) || homePresent,
    on_path: Boolean(exePath),
    path: exePath,
    version,
    home: homePresent ? path.join(home, '.opencode') : null,
    note: exePath
      ? 'OpenCode binary on PATH'
      : homePresent
        ? 'OpenCode home present; binary not on PATH'
        : 'OpenCode not detected',
  };
}

/**
 * ANTHROPIC_BASE_URL from process env (server process environment).
 */
function detectAnthropicBaseUrl(options = {}) {
  const env = options.env || process.env;
  const raw = env.ANTHROPIC_BASE_URL || env.ANTHROPIC_API_BASE || null;
  const baseUrl = normalizeBaseUrl(raw);
  const ports = options.ports || DEFAULT_OMNIROUTE_PORTS;
  const pointsAtOmniRoute = baseUrlPointsAtOmniRoute(baseUrl, ports);

  return {
    id: 'anthropic-base-url',
    name: 'ANTHROPIC_BASE_URL',
    set: Boolean(baseUrl),
    value: baseUrl,
    points_at_omniroute: pointsAtOmniRoute,
    note: !baseUrl
      ? 'Unset — Claude Code uses default Anthropic/Ollama path, not OmniRoute'
      : pointsAtOmniRoute
        ? `Points at OmniRoute (${baseUrl})`
        : `Set to ${baseUrl} (not local OmniRoute ports)`,
  };
}

/**
 * OmniRoute — home dir + TCP ports (detect only).
 */
async function detectOmniRoute(options = {}) {
  const home = homeDir(options.home);
  const exists = options.exists || fs.existsSync;
  const ports = options.ports || DEFAULT_OMNIROUTE_PORTS;
  const probe = options.probePort || probePort;
  const homePath = path.join(home, '.omniroute');
  const homePresent = exists(homePath);

  const primary = await probe(ports.primary);
  const secondary = await probe(ports.secondary);
  const listening = Boolean(primary.open || secondary.open);

  return {
    id: 'omniroute',
    name: 'OmniRoute',
    present: homePresent || listening,
    home: homePresent ? homePath : null,
    ports: {
      primary: ports.primary,
      secondary: ports.secondary,
      primary_open: Boolean(primary.open),
      secondary_open: Boolean(secondary.open),
    },
    listening,
    wired_to_claude: false, // filled by aggregate when base URL known
    note: listening
      ? `Listening on ${[primary.open && ports.primary, secondary.open && ports.secondary].filter(Boolean).join(', ')}`
      : homePresent
        ? 'Home present; ports not open'
        : 'OmniRoute not detected',
  };
}

/**
 * Read-only findings for doctor/Vitals (no auto-wiring).
 */
function buildCodingAgentFindings({ claude, omniroute, baseUrl, opencode }) {
  const findings = [];

  if (claude?.present) {
    findings.push({
      id: 'claude-code-present',
      severity: 'info',
      title: 'Claude Code detected',
      detail: [claude.version, claude.model && `model=${claude.model}`, claude.path]
        .filter(Boolean)
        .join(' · '),
    });
  } else {
    findings.push({
      id: 'claude-code-missing',
      severity: 'info',
      title: 'Claude Code not on PATH',
      detail: 'Install Claude Code or ensure claude is on PATH if you use it as the house agent.',
    });
  }

  if (omniroute?.listening && !baseUrl?.set) {
    findings.push({
      id: 'omniroute-running-baseurl-unset',
      severity: 'medium',
      title: 'OmniRoute up · ANTHROPIC_BASE_URL unset',
      detail:
        'Gateway is local but Claude Code is not configured to use it. Leave as-is unless you need multi-client routing.',
    });
  } else if (omniroute?.listening && baseUrl?.set && !baseUrl.points_at_omniroute) {
    findings.push({
      id: 'omniroute-running-not-wired',
      severity: 'medium',
      title: 'OmniRoute listening but Claude is not pointed at it',
      detail:
        'Detection only — ANTHROPIC_BASE_URL points elsewhere. Do not auto-wire; set base URL deliberately when pools are ready.',
    });
  } else if (omniroute?.home && !omniroute.listening) {
    findings.push({
      id: 'omniroute-home-idle',
      severity: 'info',
      title: 'OmniRoute home present · ports idle',
      detail: omniroute.home,
    });
  }

  if (baseUrl?.points_at_omniroute && omniroute && !omniroute.listening) {
    findings.push({
      id: 'baseurl-points-omniroute-down',
      severity: 'high',
      title: 'ANTHROPIC_BASE_URL targets OmniRoute but ports are closed',
      detail: baseUrl.value,
    });
  }

  if (opencode?.present && !opencode.on_path) {
    findings.push({
      id: 'opencode-home-only',
      severity: 'info',
      title: 'OpenCode install remnant (not on PATH)',
      detail: opencode.home || 'home present',
    });
  }

  return findings;
}

/**
 * Aggregate detect-only report for Vitals/doctor.
 */
async function detectCodingAgents(options = {}) {
  const claude = detectClaudeCode(options);
  const opencode = detectOpenCode(options);
  const baseUrl = detectAnthropicBaseUrl(options);
  const omniroute = await detectOmniRoute(options);
  omniroute.wired_to_claude = Boolean(baseUrl.points_at_omniroute && omniroute.listening);

  const findings = buildCodingAgentFindings({ claude, omniroute, baseUrl, opencode });

  const summary = {
    claude_present: Boolean(claude.present),
    omniroute_listening: Boolean(omniroute.listening),
    base_url_set: Boolean(baseUrl.set),
    wired: Boolean(omniroute.wired_to_claude),
    opencode_present: Boolean(opencode.present),
  };

  return {
    schema: SCHEMA,
    generated_at: new Date().toISOString(),
    policy: {
      mode: 'detect-only',
      note: 'HOOT never sets ANTHROPIC_BASE_URL or rewrites Claude/OmniRoute config from this endpoint.',
    },
    summary,
    claude,
    omniroute,
    base_url: baseUrl,
    opencode,
    findings,
  };
}

module.exports = {
  SCHEMA,
  DEFAULT_OMNIROUTE_PORTS,
  whichOnPath,
  runVersion,
  probePort,
  normalizeBaseUrl,
  baseUrlPointsAtOmniRoute,
  detectClaudeCode,
  detectOpenCode,
  detectAnthropicBaseUrl,
  detectOmniRoute,
  buildCodingAgentFindings,
  detectCodingAgents,
};
