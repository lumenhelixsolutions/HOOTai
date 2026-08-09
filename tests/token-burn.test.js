const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseRtkGain, buildTokenBurnReport, formatTokens } = require('../token-burn');

const SAMPLE_GAIN = {
  summary: {
    total_commands: 196,
    total_input: 1276098,
    total_output: 59244,
    total_saved: 1220217,
    avg_savings_pct: 95.62,
  },
  daily: [
    { date: '2026-01-28', cmds: 89, input: 380900, output: 26700, saved: 355800, save_pct: 93.4 },
    { date: '2026-01-29', cmds: 102, input: 894500, output: 32400, saved: 863700, save_pct: 96.6 },
  ],
};

describe('token-burn', () => {
  it('formatTokens abbreviates large counts', () => {
    assert.strictEqual(formatTokens(1220217), '1.2M');
    assert.strictEqual(formatTokens(4500), '4.5K');
    assert.strictEqual(formatTokens(42), '42');
  });

  it('parseRtkGain normalizes RTK JSON', () => {
    const parsed = parseRtkGain(SAMPLE_GAIN);
    assert.strictEqual(parsed.summary.total_saved, 1220217);
    assert.strictEqual(parsed.daily.length, 2);
    assert.strictEqual(parsed.daily[0].commands, 89);
    assert.strictEqual(parsed.has_data, true);
  });

  it('flags high risk when RTK missing and rtk profiles exist', () => {
    const report = buildTokenBurnReport({
      scan: {
        tools: { rtk: { present: false }, wsl: { present: true } },
        token_efficiency: { rtk: { present: false, gain: null }, wsl: { present: true, full_hooks: true } },
        coders: [{ id: 'claude-code', name: 'Claude Code', command: 'claude', detection: { present: true } }],
      },
      profiles: [{ id: 'p1', name: 'RTK Profile', meta: { token_efficiency: 'rtk' } }],
      settings: { tokenEfficiency: { rtkRecommended: true } },
    });
    assert.strictEqual(report.risk.level, 'high');
    assert.ok(report.recommendations.some((r) => r.id === 'ensure-hoot-rtk'));
    assert.strictEqual(report.rtk_profiles.length, 1);
  });

  it('reports low risk with RTK gain data', () => {
    const report = buildTokenBurnReport({
      scan: {
        tools: { rtk: { present: true, version: '0.1.0' }, wsl: { present: true } },
        token_efficiency: { rtk: { present: true, gain: SAMPLE_GAIN }, wsl: { present: true, full_hooks: true } },
        coders: [],
      },
      profiles: [],
      settings: {},
    });
    assert.strictEqual(report.risk.level, 'low');
    assert.strictEqual(report.formatted.total_saved, '1.2M');
    assert.strictEqual(report.gain.summary.total_commands, 196);
  });
});