const { describe, it } = require('node:test');
const assert = require('node:assert');
const { probeCoachGraph, DEFAULT_BASE } = require('../coach-graph-bridge');

describe('coach-graph-bridge', () => {
  it('probeCoachGraph returns structured result', async () => {
    const probe = await probeCoachGraph(DEFAULT_BASE);
    assert.ok(typeof probe.online === 'boolean');
    assert.strictEqual(probe.base, DEFAULT_BASE);
  });
});