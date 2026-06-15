const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  isHardCommand,
  logCoachExecution,
  logGraphRun,
  loadApprovalLog,
  summarizeApprovalLog,
  LOG_PATH,
} = require('../coach-approval-log');

const BACKUP = `${LOG_PATH}.test-backup`;

describe('coach-approval-log', () => {
  before(() => {
    if (fs.existsSync(LOG_PATH)) fs.copyFileSync(LOG_PATH, BACKUP);
    if (fs.existsSync(LOG_PATH)) fs.unlinkSync(LOG_PATH);
  });

  after(() => {
    if (fs.existsSync(LOG_PATH)) fs.unlinkSync(LOG_PATH);
    if (fs.existsSync(BACKUP)) fs.copyFileSync(BACKUP, LOG_PATH);
    if (fs.existsSync(BACKUP)) fs.unlinkSync(BACKUP);
  });

  it('detects hard commands', () => {
    assert.strictEqual(isHardCommand({ type: 'launch' }), true);
    assert.strictEqual(isHardCommand({ type: 'showMessage' }), false);
  });

  it('logs hard command executions', () => {
    logCoachExecution({ type: 'launch', profileId: 'local-safe' }, { ok: true });
    const data = loadApprovalLog();
    assert.ok(data.count >= 1);
    assert.strictEqual(data.rows[data.rows.length - 1].type, 'launch');
  });

  it('logs graph runs and summarizes analytics', () => {
    logGraphRun({
      profileId: 'local-safe-audit',
      dryRun: true,
      ok: true,
      launched: false,
      tier: 'safe-audit',
      score: 57,
    });
    const summary = summarizeApprovalLog();
    assert.ok(summary.graphRuns >= 1);
    assert.ok(summary.byType.graphRun >= 1);
    assert.ok(summary.byProfile['local-safe-audit'] >= 1);
  });
});