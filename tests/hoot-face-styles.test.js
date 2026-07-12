const { describe, it } = require('node:test');
const assert = require('node:assert');

const HOOT_FACE_STYLES = ['grand', 'compact', 'neon', 'arcade', 'sentinel', 'prism'];

const STYLE_META = {
  grand: { width: 15, faceRows: 8 },
  compact: { width: 11, faceRows: 3 },
  neon: { width: 13, faceRows: 5 },
  arcade: { width: 11, faceRows: 5 },
  sentinel: { width: 15, faceRows: 6 },
  prism: { width: 11, faceRows: 4 },
};

function styleRow(slots, width) {
  const row = Array(width).fill(' ');
  for (const [col, ch] of Object.entries(slots)) {
    const idx = Number(col);
    if (idx >= 0 && idx < width) row[idx] = String(ch).slice(0, 1);
  }
  return row.join('');
}

function fitCaption(text, width) {
  const t = text.trim().slice(0, width);
  if (t.length >= width) return t;
  const pad = width - t.length;
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + t + ' '.repeat(width - t.length - left);
}

function nextFaceStyle(current) {
  const idx = HOOT_FACE_STYLES.indexOf(current);
  return HOOT_FACE_STYLES[(idx + 1) % HOOT_FACE_STYLES.length];
}

describe('hoot face styles', () => {
  it('cycles through all six styles', () => {
    let style = 'grand';
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      seen.add(style);
      style = nextFaceStyle(style);
    }
    assert.equal(seen.size, 6);
    assert.equal(style, 'grand');
  });

  it('neon frame uses bracket HUD layout', () => {
    const width = STYLE_META.neon.width;
    const crown = styleRow({ 2: '+', 3: '─', 4: '?', 9: '─', 10: '+' }, width);
    const eyes = styleRow({ 2: '(', 4: '◉', 8: '◉', 10: ')' }, width);
    assert.equal(crown.length, width);
    assert.equal(eyes[2], '(');
    assert.equal(eyes[4], '◉');
    assert.equal(eyes[10], ')');
  });

  it('arcade frame uses pixel crown and split eyes', () => {
    const width = STYLE_META.arcade.width;
    const crown = styleRow({ 2: '/', 3: '█', 4: '█', 5: '█', 6: '█', 7: '█', 8: '\\' }, width);
    const eyes = styleRow({ 1: '|', 2: '●', 3: '|', 5: '|', 6: '●', 7: '|' }, width);
    assert.equal(crown[3], '█');
    assert.equal(eyes[2], '●');
    assert.equal(eyes[6], '●');
  });

  it('sentinel frame includes tactical sweep and load bar', () => {
    const width = STYLE_META.sentinel.width;
    const sweep = styleRow({ 5: '>', 6: '─', 7: '─', 8: '─', 9: '>' }, width);
    const bar = styleRow({ 4: '|', 5: '■', 6: '■', 7: '□', 12: '|' }, width);
    assert.equal(sweep[5], '>');
    assert.equal(bar[5], '■');
    assert.equal(bar[7], '□');
  });

  it('prism frame uses gem crown and angled eyes', () => {
    const width = STYLE_META.prism.width;
    const crown = styleRow({ 2: '/', 3: '\\', 4: '◆', 5: '·', 6: '◆', 7: '/', 8: '\\' }, width);
    const eyes = styleRow({ 2: '<', 4: 'o', 6: 'O', 8: '>' }, width);
    const caption = fitCaption('scanning', width);
    assert.equal(crown[4], '◆');
    assert.equal(eyes[2], '<');
    assert.equal(eyes[8], '>');
    assert.equal(caption.trim(), 'scanning');
  });
});