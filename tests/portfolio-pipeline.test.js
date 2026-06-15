const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  buildPipelineOverview,
  buildProjectOverview,
  checkLookbookLabBridge,
  checkVisualStoryBridge,
  checkStoryRenderBridge,
  checkRenderGraphSidecar,
  checkDirectorGraphSidecar,
  detectBrain,
  parseMilestones,
} = require('../portfolio-pipeline');

const HOOT_ROOT = path.join(__dirname, '..');
const PORTFOLIO_ROOT = path.dirname(HOOT_ROOT);

describe('portfolio-pipeline', () => {
  it('parseMilestones reads milestone table', () => {
    const md = `Milestone-Version: 2026-06-11.1
| 1 | Portfolio Foundation | done | ecc |
| 2 | HOOT Kernel GA | done | Hoot |`;
    const parsed = parseMilestones(md);
    assert.strictEqual(parsed.version, '2026-06-11.1');
    assert.strictEqual(parsed.milestones.length, 2);
    assert.strictEqual(parsed.milestones[0].status, 'done');
  });

  it('detectBrain finds Hoot current-state', () => {
    const brain = detectBrain(HOOT_ROOT);
    assert.strictEqual(brain.present, true);
    assert.strictEqual(brain.files['current-state.md'], true);
    assert.ok(brain.current_state?.includes('Current State'));
  });

  it('buildProjectOverview returns next move excerpt', () => {
    const overview = buildProjectOverview({ name: 'Hoot', path: HOOT_ROOT, type: 'node' });
    assert.ok(overview);
    assert.strictEqual(overview.project.name, 'Hoot');
    assert.ok(overview.brain.present);
  });

  it('buildPipelineOverview includes bridges and projects', () => {
    const report = buildPipelineOverview({
      registry: {
        active: HOOT_ROOT,
        projects: [{ name: 'Hoot', path: HOOT_ROOT, type: 'node' }],
      },
      portfolioRoot: PORTFOLIO_ROOT,
    });
    assert.ok(report.bridges.length >= 3);
    assert.ok(report.integration_matrix.length >= 5);
    assert.ok(report.milestones.length >= 1);
    assert.strictEqual(report.projects[0].name, 'Hoot');
    assert.ok(report.active_project);
  });

  it('checkVisualStoryBridge reports module and script readiness', () => {
    const health = checkVisualStoryBridge(PORTFOLIO_ROOT);
    assert.strictEqual(health.id, 'lookbook-cineforge');
    assert.strictEqual(health.modules_ready, true);
    assert.strictEqual(health.e2e_script, true);
    assert.ok(['verified', 'ready', 'incomplete'].includes(health.status));
  });

  it('checkLookbookLabBridge reports lab module readiness', () => {
    const health = checkLookbookLabBridge(PORTFOLIO_ROOT);
    assert.strictEqual(health.id, 'lookbook-lab');
    assert.strictEqual(health.modules_ready, true);
    assert.ok(['verified', 'online', 'ready', 'incomplete'].includes(health.status));
  });

  it('buildPipelineOverview includes bridge_health', () => {
    const report = buildPipelineOverview({
      registry: { active: HOOT_ROOT, projects: [] },
      portfolioRoot: PORTFOLIO_ROOT,
    });
    assert.ok(Array.isArray(report.bridge_health));
    assert.strictEqual(report.bridge_health[0].id, 'lookbook-lab');
    assert.ok(report.bridge_health.some((b) => b.id === 'lookbook-cineforge'));
    assert.ok(report.bridge_health.some((b) => b.id === 'story-render-chain'));
    assert.ok(report.bridge_health.some((b) => b.id === 'cineforge-render-graph'));
    assert.ok(report.bridge_health.some((b) => b.id === 'lookbook-director-graph'));
  });

  it('checkStoryRenderBridge reports script readiness', () => {
    const health = checkStoryRenderBridge(PORTFOLIO_ROOT);
    assert.strictEqual(health.id, 'story-render-chain');
    assert.strictEqual(health.e2e_script, true);
  });

  it('checkRenderGraphSidecar reports module readiness', () => {
    const health = checkRenderGraphSidecar(PORTFOLIO_ROOT);
    assert.strictEqual(health.id, 'cineforge-render-graph');
    assert.strictEqual(health.modules_ready, true);
  });

  it('checkDirectorGraphSidecar reports module readiness', () => {
    const health = checkDirectorGraphSidecar(PORTFOLIO_ROOT);
    assert.strictEqual(health.id, 'lookbook-director-graph');
    assert.strictEqual(health.modules_ready, true);
  });
});