const { describe, it } = require('node:test');
const assert = require('node:assert');
const { extractCommands, normalizeExtractedCommand, scrubFalseExecutionClaims } = require('../chat');
const { executeNativeTool, isHitlTool, proposalsFromToolRuns } = require('../coach-tools');

describe('extractCommands local-model formats', () => {
  it('parses preferred json commands fence', () => {
    const raw = 'Sure.\n```json commands\n[{"type":"runScan"},{"type":"navigate","route":"/scan"}]\n```';
    const { commands, text } = extractCommands(raw);
    assert.strictEqual(commands.length, 2);
    assert.strictEqual(commands[0].type, 'runScan');
    assert.strictEqual(commands[1].route, '/scan');
    assert.ok(!text.includes('runScan'));
  });

  it('parses action field from generic json fence (gemma style)', () => {
    const raw = 'Running the scan now:\n\n```json\n{\n  "action": "runScan",\n  "repo": null\n}\n```';
    const { commands } = extractCommands(raw);
    assert.strictEqual(commands.length, 1);
    assert.strictEqual(commands[0].type, 'runScan');
  });

  it('normalizes snake_case and launch aliases', () => {
    assert.strictEqual(normalizeExtractedCommand({ action: 'run_scan' })?.type, 'runScan');
    assert.strictEqual(normalizeExtractedCommand({ type: 'launch', profileId: 'x' })?.type, 'launchProfile');
  });
});

describe('scrubFalseExecutionClaims', () => {
  it('marks false running claims when no tools completed', () => {
    const out = scrubFalseExecutionClaims('Running the scan now. All good.', { hasCompletedTools: false, pendingCount: 1 });
    assert.match(out, /proposed — not executed/i);
    assert.match(out, /Approve/i);
  });

  it('leaves text alone when tools completed', () => {
    const out = scrubFalseExecutionClaims('Scan complete.', { hasCompletedTools: true });
    assert.strictEqual(out, 'Scan complete.');
  });
});

describe('HITL native tools', () => {
  it('marks run_scan as HITL tool', () => {
    assert.strictEqual(isHitlTool('run_scan'), true);
    assert.strictEqual(isHitlTool('get_status'), false);
  });

  it('proposes run_scan without executing', async () => {
    let scanned = false;
    const result = await executeNativeTool(
      'run_scan',
      {},
      {
        hitl: true,
        deps: {
          executeCoachCommand: async () => {
            scanned = true;
            return { ok: true };
          },
          coachDeps: {},
        },
      },
    );
    assert.strictEqual(result.proposed, true);
    assert.strictEqual(result.pending_approval, true);
    assert.strictEqual(result.command.type, 'runScan');
    assert.strictEqual(scanned, false);
  });

  it('proposalsFromToolRuns extracts commands', () => {
    const props = proposalsFromToolRuns([
      { name: 'run_scan', result: { proposed: true, command: { type: 'runScan' } } },
    ]);
    assert.strictEqual(props[0].type, 'runScan');
  });
});
