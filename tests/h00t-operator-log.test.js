const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { appendOperatorLog, listOperatorLog, readLog } = require('../h00t-operator-log');

describe('hoot-operator-log', () => {
  let logPath;

  before(() => {
    logPath = path.join(os.tmpdir(), `hoot-op-log-${Date.now()}.json`);
  });

  after(() => {
    try { fs.unlinkSync(logPath); } catch { /* ignore */ }
  });

  it('starts empty when file missing', () => {
    const log = readLog(logPath);
    assert.deepStrictEqual(log.entries, []);
  });

  it('appends and lists entries newest-first', () => {
    const a = appendOperatorLog(logPath, { source: 'test', tool: 'navigate', ok: true });
    const b = appendOperatorLog(logPath, { source: 'test', tool: 'run_scan', ok: false, blocked: true });
    assert.ok(a.id);
    assert.ok(b.id);
    const rows = listOperatorLog(logPath, 10);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].tool, 'run_scan');
    assert.strictEqual(rows[1].tool, 'navigate');
  });
});