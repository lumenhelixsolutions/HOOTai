const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  SCHEMA,
  normalizeBaseUrl,
  baseUrlPointsAtOmniRoute,
  detectClaudeCode,
  detectOpenCode,
  detectAnthropicBaseUrl,
  detectOmniRoute,
  buildCodingAgentFindings,
  detectCodingAgents,
} = require('../coding-agent-detect');

describe('coding-agent-detect', () => {
  it('exports schema and base URL helpers', () => {
    assert.strictEqual(SCHEMA, 'hoot.coding_agents.v1');
    assert.strictEqual(normalizeBaseUrl(' http://127.0.0.1:20131/ '), 'http://127.0.0.1:20131');
    assert.strictEqual(normalizeBaseUrl(''), null);
    assert.strictEqual(baseUrlPointsAtOmniRoute('http://127.0.0.1:20131'), true);
    assert.strictEqual(baseUrlPointsAtOmniRoute('http://localhost:20132/v1'), true);
    assert.strictEqual(baseUrlPointsAtOmniRoute('https://api.anthropic.com'), false);
    assert.strictEqual(baseUrlPointsAtOmniRoute(null), false);
  });

  it('detects Claude Code from settings + mock which', () => {
    const home = path.join(__dirname, 'fixtures', 'fake-home-claude');
    const settings = {
      model: 'llama3-8b-ablitered-v3',
      'model.context_length': 8192,
      enabledPlugins: { 'ouroboros@ouroboros': true },
    };
    const files = new Map([
      [path.join(home, '.claude', 'settings.json'), JSON.stringify(settings)],
      [path.join(home, '.claude.json'), JSON.stringify({ customApiKeyResponses: { approved: ['ollama'] } })],
    ]);
    const dirs = new Set([path.join(home, '.claude')]);

    const claude = detectClaudeCode({
      home,
      exists: (p) => dirs.has(p) || files.has(p) || p.endsWith('claude.exe'),
      readFile: (p) => {
        if (!files.has(p)) throw new Error(`missing ${p}`);
        return files.get(p);
      },
      spawn: (cmd, args) => {
        if ((cmd === 'where' || cmd === 'which') && String(args?.[0]).startsWith('claude')) {
          return { status: 0, stdout: path.join(home, '.local', 'bin', 'claude.exe\n') };
        }
        if (String(args?.[0]) === '--version') {
          return { status: 0, stdout: '2.1.207 (Claude Code)\n' };
        }
        return { status: 1, stdout: '', stderr: '' };
      },
    });

    assert.strictEqual(claude.present, true);
    assert.strictEqual(claude.on_path, true);
    assert.strictEqual(claude.model, 'llama3-8b-ablitered-v3');
    assert.strictEqual(claude.context_length, 8192);
    assert.strictEqual(claude.ollama_api_key_approved, true);
    assert.match(String(claude.version), /2\.1\.207/);
  });

  it('detects missing Claude Code', () => {
    const claude = detectClaudeCode({
      home: path.join(__dirname, 'no-such-home'),
      exists: () => false,
      spawn: () => ({ status: 1, stdout: '', stderr: '' }),
    });
    assert.strictEqual(claude.present, false);
    assert.strictEqual(claude.model, null);
  });

  it('detects ANTHROPIC_BASE_URL unset and omniroute-pointing', () => {
    const unset = detectAnthropicBaseUrl({ env: {} });
    assert.strictEqual(unset.set, false);
    assert.strictEqual(unset.points_at_omniroute, false);

    const set = detectAnthropicBaseUrl({
      env: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:20131' },
    });
    assert.strictEqual(set.set, true);
    assert.strictEqual(set.points_at_omniroute, true);
  });

  it('detects OmniRoute via port probe and home', async () => {
    const home = 'C:\\Users\\test';
    const omniHome = path.join(home, '.omniroute');
    const omni = await detectOmniRoute({
      home,
      exists: (p) => p === omniHome,
      probePort: async (port) => ({ open: port === 20131, port }),
    });
    assert.strictEqual(omni.present, true);
    assert.strictEqual(omni.listening, true);
    assert.strictEqual(omni.ports.primary_open, true);
    assert.strictEqual(omni.ports.secondary_open, false);
    assert.match(omni.note, /20131/);
  });

  it('OpenCode home-only is present but not on PATH', () => {
    const home = 'D:\\users\\x';
    const oc = detectOpenCode({
      home,
      exists: (p) => p === path.join(home, '.opencode'),
      spawn: () => ({ status: 1, stdout: '', stderr: '' }),
    });
    assert.strictEqual(oc.present, true);
    assert.strictEqual(oc.on_path, false);
  });

  it('buildCodingAgentFindings flags omniroute up without base URL', () => {
    const findings = buildCodingAgentFindings({
      claude: { present: true, version: '2.1.207', model: 'x', path: 'c:\\claude.exe' },
      omniroute: { listening: true, home: 'h' },
      baseUrl: { set: false, points_at_omniroute: false },
      opencode: { present: true, on_path: false, home: 'oc' },
    });
    assert.ok(findings.some((f) => f.id === 'omniroute-running-baseurl-unset'));
    assert.ok(findings.some((f) => f.id === 'opencode-home-only'));
    assert.ok(findings.some((f) => f.id === 'claude-code-present'));
  });

  it('buildCodingAgentFindings high severity when base URL targets down OmniRoute', () => {
    const findings = buildCodingAgentFindings({
      claude: { present: true },
      omniroute: { listening: false, home: 'h' },
      baseUrl: { set: true, points_at_omniroute: true, value: 'http://127.0.0.1:20131' },
      opencode: { present: false },
    });
    assert.ok(findings.some((f) => f.id === 'baseurl-points-omniroute-down' && f.severity === 'high'));
  });

  it('detectCodingAgents returns full schema with injectables', async () => {
    const home = path.join(__dirname, 'fixtures', 'fake-home-aggregate');
    const report = await detectCodingAgents({
      home,
      env: {},
      exists: () => false,
      spawn: () => ({ status: 1, stdout: '', stderr: '' }),
      probePort: async (port) => ({ open: false, port }),
    });
    assert.strictEqual(report.schema, SCHEMA);
    assert.strictEqual(report.policy.mode, 'detect-only');
    assert.strictEqual(report.summary.claude_present, false);
    assert.strictEqual(report.summary.wired, false);
    assert.strictEqual(report.base_url.set, false);
    assert.ok(Array.isArray(report.findings));
  });
});
