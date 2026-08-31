const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { probeRepo, matchIntegrations, scanRepoIntegrations } = require('../repo-integration-scan');

describe('repo-integration-scan', () => {
  it('probes a synthetic repo and suggests CE + HOOT RTK (not separate install)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoot-int-'));
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Agents\nUse Claude Code and compound engineering.\n');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'vitest' } }));
    fs.mkdirSync(path.join(dir, '.git'));
    const signals = probeRepo(dir);
    assert.strictEqual(signals.has_agents_md, true);
    assert.strictEqual(signals.has_git, true);
    const cands = matchIntegrations(signals, {
      modules: [{ id: 'compound-engineering', name: 'CE' }],
      mcpServers: [{ id: 'git' }],
      rtkStatus: { present: false, path: null },
    });
    assert.ok(cands.some((c) => c.module_id === 'compound-engineering'));
    assert.ok(cands.some((c) => c.mcp_id === 'git'));
    const rtk = cands.find((c) => c.integration_type === 'token-efficiency');
    assert.ok(rtk);
    const blob = `${rtk.opportunity} ${rtk.detail}`;
    assert.ok(/preinstall|bundled|HOOT RTK/i.test(blob));
    // Must not prescribe a separate curl|sh product install as the path
    assert.ok(!/curl -fsSL/i.test(blob));
    assert.ok(/not a separate|No curl|preinstall|bundled|auto-provision/i.test(blob));
  });

  it('scanRepoIntegrations respects empty active scope', () => {
    const result = scanRepoIntegrations({
      scope: 'active',
      activeProject: null,
      hootRoot: path.join(__dirname, '..'),
      modulesCatalog: { modules: [] },
      mcpCatalog: { servers: [] },
    });
    assert.strictEqual(result.repos.length, 0);
    assert.strictEqual(result.schema, 'hoot.repo_integration_scan.v1');
    assert.strictEqual(result.policy.rtk.includes('preinstalled') || result.policy.rtk.includes('bundled'), true);
  });
});
