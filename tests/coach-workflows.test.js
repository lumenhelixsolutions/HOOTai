const { describe, it } = require('node:test');
const assert = require('node:assert');
const { listWorkflows, startWorkflow, getWorkflow } = require('../coach-workflows');
const { readVaultContext } = require('../coach-mcp');
const { shouldLogCommand, logHitlEvent, loadApprovalLog } = require('../coach-approval-log');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('coach-workflows Season C1', () => {
  it('lists workflows with steps', () => {
    const list = listWorkflows();
    assert.ok(list.length >= 2);
    assert.ok(list.every((w) => w.id && w.stepCount > 0));
  });

  it('starts prepare-local-audit with commands', () => {
    const started = startWorkflow('prepare-local-audit');
    assert.strictEqual(started.ok, true);
    assert.ok(started.commands.some((c) => c.type === 'runScan'));
    assert.ok(started.commands.some((c) => c.type === 'navigate'));
  });

  it('unknown workflow fails soft', () => {
    const started = startWorkflow('nope');
    assert.strictEqual(started.ok, false);
  });
});

describe('shouldLogCommand Season C3', () => {
  it('logs soft and hard types', () => {
    assert.strictEqual(shouldLogCommand({ type: 'runScan' }), true);
    assert.strictEqual(shouldLogCommand({ type: 'navigate' }), true);
    assert.strictEqual(shouldLogCommand({ type: 'launchProfile' }), true);
    assert.strictEqual(shouldLogCommand({ type: 'shell' }), false);
  });
});

describe('vault context Season C4', () => {
  it('returns structure when vault missing', () => {
    const v = readVaultContext({
      operator_policy: { vault_context: true, vault_path: path.join(os.tmpdir(), 'no-such-hoot-vault') },
    });
    assert.strictEqual(v.present, false);
  });

  it('can disable vault', () => {
    const v = readVaultContext({ operator_policy: { vault_context: false } });
    assert.strictEqual(v, null);
  });
});
