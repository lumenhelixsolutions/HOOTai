const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const CROWN_GAUGE_CELLS = 9;
const SPINE_POINTS = 5;

function healthFromContext(ctx) {
  const pc = ctx.pageContext;
  let h = 100;
  if (Number(pc.errorCount) > 0) h -= 45;
  if (ctx.hasError) h = Math.min(h, 30);
  if (Number(pc.agentRadarExternal) > 0) h -= 25;
  if (pc.tokenBurnRisk === 'high') h -= 20;
  else if (pc.tokenBurnRisk === 'medium') h -= 10;
  if (Number(pc.modulesNeedSync) > 0 || Number(pc.modulesOutdated) > 0) h -= 10;
  if (Number(pc.profilesBlocked) > 0) h -= 10;
  const score = Number(pc.stackScore) || 0;
  if (score > 0 && score < 50) h -= 20;
  return Math.max(5, Math.min(100, h));
}

function crownGauge(health) {
  const filled = Math.round((health / 100) * CROWN_GAUGE_CELLS);
  return Array.from({ length: CROWN_GAUGE_CELLS }, (_, i) => (i < filled ? '=' : '_'));
}

function eventGlyphsForTrigger(triggerId) {
  if (triggerId === 'idle') return null;
  if (triggerId.startsWith('launch:running') || triggerId === 'launch:active') return ['◆'];
  if (triggerId === 'hint:celebration' || triggerId === 'module:ready') return ['★', '★'];
  if (triggerId === 'error') return ['!', '!'];
  if (triggerId === 'scan:active') return ['◎'];
  if (triggerId.startsWith('coach:')) return ['~'];
  return null;
}

let grandSpine = {
  triggerId: 'idle',
  spine: [null, null, null, null, null],
  queue: [],
  healthBand: 4,
  feedIndex: 0,
};

function resetGrandSpine() {
  grandSpine = {
    triggerId: 'idle',
    spine: [null, null, null, null, null],
    queue: [],
    healthBand: 4,
    feedIndex: 0,
  };
}

function enqueueSpineGlyphs(glyphs) {
  grandSpine.queue.push(...glyphs.map((g) => g.slice(0, 1)));
}

function tickGrandSpine(triggerId, frame, health) {
  const band = Math.round(health / 25);
  if (triggerId !== grandSpine.triggerId) {
    const glyphs = eventGlyphsForTrigger(triggerId);
    if (glyphs) grandSpine.queue.push(...glyphs);
    grandSpine.triggerId = triggerId;
  }
  if (band < grandSpine.healthBand) grandSpine.queue.push('!');
  else if (band === 4 && grandSpine.healthBand < 4) grandSpine.queue.push('+');
  grandSpine.healthBand = band;

  let next = grandSpine.queue.shift() ?? null;
  if (next === null && frame % 6 === 0) next = '·';
  grandSpine.spine = [next, ...grandSpine.spine.slice(0, SPINE_POINTS - 1)];
  return grandSpine.spine;
}

const baseCtx = {
  pathname: '/',
  pageContext: {},
  hasError: false,
};

describe('hoot spine + health channel', () => {
  beforeEach(() => resetGrandSpine());

  it('healthFromContext penalizes errors and external agents', () => {
    assert.equal(healthFromContext(baseCtx), 100);
    const sick = healthFromContext({
      ...baseCtx,
      hasError: true,
      pageContext: { agentRadarExternal: 2, errorCount: 1, tokenBurnRisk: 'high' },
    });
    assert.ok(sick < 50);
  });

  it('crownGauge fills cells from health score', () => {
    const gauge = crownGauge(100);
    assert.equal(gauge.length, CROWN_GAUGE_CELLS);
    assert.ok(gauge.every((c) => c === '='));
  });

  it('eventGlyphsForTrigger maps launch and win triggers', () => {
    assert.deepEqual(eventGlyphsForTrigger('launch:running'), ['◆']);
    assert.deepEqual(eventGlyphsForTrigger('hint:celebration'), ['★', '★']);
    assert.equal(eventGlyphsForTrigger('idle'), null);
  });

  it('tickGrandSpine advances 5-point register', () => {
    const spine = tickGrandSpine('launch:running', 0, 100);
    assert.equal(spine.length, SPINE_POINTS);
    enqueueSpineGlyphs(['◆', '★']);
    assert.equal(tickGrandSpine('idle', 1, 100)[0], '◆');
    assert.equal(tickGrandSpine('idle', 2, 100)[0], '★');
  });
});