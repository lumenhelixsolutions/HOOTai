const { describe, it } = require('node:test');
const assert = require('node:assert');

const WIDTH = 11;
const FACE_CENTER_COL = 5;
const BROW_SLASH_L_COL = 2;
const BROW_A_COL = 3;
const BROW_B_COL = 4;
const THIRD_EYE_COL = 5;
const BROW_D_COL = 6;
const BROW_E_COL = 7;
const BROW_SLASH_R_COL = 8;
const BROW_L_COL = BROW_A_COL;
const BROW_R_COL = BROW_E_COL;
const EYE_L_PAREN_COL = 3;
const EYE_L_COL = 4;
const EYE_R_COL = 6;
const EYE_R_PAREN_COL = 7;
const BEAK_L_COL = 4;
const BEAK_GLYPH_COL = 5;
const BEAK_R_COL = 6;
const FACE_ANIM_BEAT_FRAMES = 5;
const CASCADE_TICK_MULT = 2;
const BEAK_STANDBY = '▽';

function fixedFaceRow(slots, width = WIDTH) {
  const row = Array(width).fill(' ');
  for (const [col, ch] of Object.entries(slots)) {
    const idx = Number(col);
    if (idx >= 0 && idx < width) row[idx] = String(ch).slice(0, 1);
  }
  return row.join('');
}

function buildBrowLine(thirdEye, width = WIDTH, browFlanks) {
  const g = (thirdEye || '·').slice(0, 1);
  const a = (browFlanks?.a ?? browFlanks?.left ?? '_').slice(0, 1);
  const b = (browFlanks?.b ?? '_').slice(0, 1);
  const d = (browFlanks?.d ?? '_').slice(0, 1);
  const e = (browFlanks?.e ?? browFlanks?.right ?? '_').slice(0, 1);
  return fixedFaceRow({
    [BROW_SLASH_L_COL]: '/',
    [BROW_A_COL]: a,
    [BROW_B_COL]: b,
    [THIRD_EYE_COL]: g,
    [BROW_D_COL]: d,
    [BROW_E_COL]: e,
    [BROW_SLASH_R_COL]: '\\',
  }, width);
}

function buildEyesLine(left, right, width = WIDTH) {
  return fixedFaceRow({
    [EYE_L_PAREN_COL]: '(',
    [EYE_L_COL]: (left || '·').slice(0, 1),
    [EYE_R_COL]: (right || '·').slice(0, 1),
    [EYE_R_PAREN_COL]: ')',
  }, width);
}

function gapCenterFromEyeLine(eyeLine) {
  const open = eyeLine.indexOf('(');
  const close = eyeLine.indexOf(')', open + 1);
  if (open < 0 || close < 0) return Math.floor(eyeLine.length / 2);
  const inner = eyeLine.slice(open + 1, close);
  const tokens = inner.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return Math.floor(eyeLine.length / 2);
  const firstStart = eyeLine.indexOf(tokens[0], open + 1);
  const firstEnd = firstStart + tokens[0].length;
  const secondStart = eyeLine.indexOf(tokens[1], firstEnd);
  return Math.floor((firstEnd + secondStart) / 2);
}

function flankGlyphLtr(flanks, fastIndex, fallback = '·') {
  if (!flanks.length) return fallback;
  const n = flanks.length;
  const idx = ((fastIndex % n) + n) % n;
  return flanks[idx];
}

function resolveAlternatingAnim(frame) {
  const beat = Math.floor(frame / FACE_ANIM_BEAT_FRAMES);
  const generation = Math.floor(beat / 2);
  const isThinkBeat = beat % 2 === 1;
  return {
    beat,
    generation,
    isThinkBeat,
    isEyeBeat: !isThinkBeat,
    eyeIndex: generation,
    cascadeIndex: isThinkBeat ? generation : Math.max(0, generation - 1),
  };
}

function resolveCascadeGlyphs(phase, holdCenter, flanks, frame) {
  const fast = frame * CASCADE_TICK_MULT;
  const idle = '_';
  const beak = BEAK_STANDBY;

  if (phase === 'perceive') {
    return {
      browA: idle, browB: '·', thirdEye: '?', browD: '·', browE: idle, beak,
      browLeft: idle, browRight: idle,
    };
  }
  if (phase === 'think') {
    return {
      browA: '·', browB: '·', thirdEye: '?', browD: '·', browE: '·', beak,
      browLeft: '·', browRight: '·',
    };
  }
  if (phase === 'intent') {
    return {
      browA: '·', browB: '@', thirdEye: '@', browD: '@', browE: '·', beak,
      browLeft: '·', browRight: '·',
    };
  }
  if (phase === 'act') {
    return {
      browA: '>', browB: '>', thirdEye: '>', browD: '>', browE: '>', beak,
      browLeft: '>', browRight: '>',
    };
  }

  const a = flankGlyphLtr(flanks, fast, holdCenter);
  const b = flankGlyphLtr(flanks, fast - 1, holdCenter);
  const c = flankGlyphLtr(flanks, fast - 2, holdCenter);
  const d = flankGlyphLtr(flanks, fast - 3, holdCenter);
  const e = flankGlyphLtr(flanks, fast - 4, holdCenter);
  return {
    browA: a, browB: b, thirdEye: c, browD: d, browE: e, beak,
    browLeft: a, browRight: e,
  };
}

function buildBeakLineStatic(glyph, width = WIDTH) {
  void glyph;
  return fixedFaceRow({ [BEAK_L_COL]: '\\', [BEAK_GLYPH_COL]: BEAK_STANDBY, [BEAK_R_COL]: '/' }, width);
}

/** Eye gap between pupils must stay empty (no telemetry spine). */
function eyeGapEmpty(eyeLine) {
  return eyeLine[FACE_CENTER_COL] === ' ' || eyeLine[FACE_CENTER_COL] === undefined;
}

describe('hoot cascade glyphs', () => {
  it('phase drip is on third eye / brow only; beak stays ▽', () => {
    const p = resolveCascadeGlyphs('perceive', '~', ['A', 'B'], 0);
    assert.strictEqual(p.thirdEye, '?');
    assert.strictEqual(p.beak, '▽');
    assert.strictEqual(p.browB, '·');
    assert.strictEqual(p.browD, '·');

    const t = resolveCascadeGlyphs('think', '~', ['A', 'B'], 0);
    assert.strictEqual(t.thirdEye, '?');
    assert.strictEqual(t.beak, '▽');
    assert.strictEqual(t.browA, '·');
    assert.strictEqual(t.browE, '·');

    const i = resolveCascadeGlyphs('intent', '~', ['A', 'B'], 0);
    assert.strictEqual(i.thirdEye, '@');
    assert.strictEqual(i.beak, '▽');

    const a = resolveCascadeGlyphs('act', '~', ['A', 'B'], 0);
    assert.strictEqual(a.thirdEye, '>');
    assert.strictEqual(a.browA, '>');
    assert.strictEqual(a.browE, '>');
    assert.strictEqual(a.beak, '▽');
  });

  it('hold marches flanks L→R across five brow slots; beak stays still', () => {
    const flanks = ['A', 'B', 'C', 'D', 'E'];
    const f = 2;
    const fast = f * CASCADE_TICK_MULT;
    const cascade = resolveCascadeGlyphs('hold', '~', flanks, f);
    assert.strictEqual(cascade.browA, flankGlyphLtr(flanks, fast));
    assert.strictEqual(cascade.browB, flankGlyphLtr(flanks, fast - 1));
    assert.strictEqual(cascade.thirdEye, flankGlyphLtr(flanks, fast - 2));
    assert.strictEqual(cascade.browD, flankGlyphLtr(flanks, fast - 3));
    assert.strictEqual(cascade.browE, flankGlyphLtr(flanks, fast - 4));
    assert.strictEqual(cascade.beak, '▽');
    assert.strictEqual(cascade.browLeft, cascade.browA);
    assert.strictEqual(cascade.browRight, cascade.browE);
    // Wide march: outer flanks differ when alphabet is long enough
    assert.ok(cascade.browA !== cascade.browE || flanks.length <= 1);
  });

  it('face rows center on FACE_CENTER_COL; eye gap empty', () => {
    const brow = buildBrowLine('@', WIDTH, { a: 'A', b: 'B', d: 'D', e: 'E' });
    const eyes = buildEyesLine('◉', '◉');
    const beak = buildBeakLineStatic('X');
    assert.strictEqual(brow[THIRD_EYE_COL], '@');
    assert.strictEqual(brow[BROW_SLASH_L_COL], '/');
    assert.strictEqual(brow[BROW_SLASH_R_COL], '\\');
    assert.strictEqual(brow[BROW_A_COL], 'A');
    assert.strictEqual(brow[BROW_B_COL], 'B');
    assert.strictEqual(brow[BROW_D_COL], 'D');
    assert.strictEqual(brow[BROW_E_COL], 'E');
    assert.strictEqual(gapCenterFromEyeLine(eyes), FACE_CENTER_COL);
    assert.ok(eyeGapEmpty(eyes), 'no telemetry between eyes');
    assert.strictEqual(beak[BEAK_GLYPH_COL], '▽');
    assert.strictEqual(THIRD_EYE_COL, FACE_CENTER_COL);
    assert.strictEqual(BEAK_GLYPH_COL, FACE_CENTER_COL);
  });

  it('brow headband is / a b c d e \\ (five glyph slots)', () => {
    const brow = buildBrowLine('@', WIDTH, { a: 'A', b: 'B', d: 'D', e: 'E' });
    assert.strictEqual((brow.match(/\//g) || []).length, 1);
    assert.strictEqual((brow.match(/\\/g) || []).length, 1);
    assert.strictEqual(brow.slice(BROW_A_COL, BROW_E_COL + 1), 'AB@DE');
    assert.strictEqual(brow.slice(BROW_SLASH_L_COL, BROW_SLASH_R_COL + 1), '/AB@DE\\');
  });

  it('beak is always \\ ▽ / and ignores cascade input', () => {
    const { beak } = resolveCascadeGlyphs('hold', '~', ['X', 'Y', 'Z'], 5);
    assert.strictEqual(beak, '▽');
    const row = buildBeakLineStatic('Z');
    assert.strictEqual(row[BEAK_L_COL], '\\');
    assert.strictEqual(row[BEAK_GLYPH_COL], '▽');
    assert.strictEqual(row[BEAK_R_COL], '/');
  });

  it('eyes and thinking alternate beats', () => {
    const eyeBeat = resolveAlternatingAnim(0);
    const thinkBeat = resolveAlternatingAnim(FACE_ANIM_BEAT_FRAMES);
    assert.strictEqual(eyeBeat.isEyeBeat, true);
    assert.strictEqual(eyeBeat.isThinkBeat, false);
    assert.strictEqual(thinkBeat.isThinkBeat, true);
    assert.strictEqual(thinkBeat.isEyeBeat, false);
    assert.strictEqual(eyeBeat.cascadeIndex, 0);
    assert.strictEqual(thinkBeat.cascadeIndex, 0);
    const laterEye = resolveAlternatingAnim(FACE_ANIM_BEAT_FRAMES * 2);
    const laterThink = resolveAlternatingAnim(FACE_ANIM_BEAT_FRAMES * 3);
    assert.strictEqual(laterEye.eyeIndex, 1);
    assert.strictEqual(laterEye.cascadeIndex, 0);
    assert.strictEqual(laterThink.cascadeIndex, 1);
  });
});
