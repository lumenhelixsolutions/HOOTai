const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  resolveHootEmotion,
  resolveHootMoodFromContext,
  activeHootSignal,
} = require('../h00t-emotions.cjs');

function ctx(overrides = {}) {
  return {
    pathname: '/',
    pageContext: {},
    hasError: false,
    coachOpen: false,
    chatLoading: false,
    topHintTone: null,
    hasTopHint: false,
    ...overrides,
  };
}

describe('hoot emotions', () => {
  it('activeHootSignal expires after TTL', () => {
    const pc = { hootSignal: 'module:syncing', hootSignalAt: Date.now() - 5000, hootSignalTtl: 1000 };
    assert.strictEqual(activeHootSignal(pc), null);
  });

  it('signal module:syncing wins over idle', () => {
    const emotion = resolveHootEmotion(ctx({
      pageContext: { hootSignal: 'module:syncing', hootSignalAt: Date.now(), hootSignalTtl: 4000 },
    }));
    assert.strictEqual(emotion.mood, 'syncing');
    assert.match(emotion.caption, /sync/i);
  });

  it('error beats path defaults', () => {
    assert.strictEqual(resolveHootMoodFromContext(ctx({ hasError: true })), 'error');
  });

  it('radar external triggers alert', () => {
    const emotion = resolveHootEmotion(ctx({ pageContext: { agentRadarExternal: 2 } }));
    assert.strictEqual(emotion.mood, 'alert');
    assert.match(emotion.caption, /outside/i);
  });

  it('modules agents tab is curious', () => {
    const emotion = resolveHootEmotion(ctx({ pathname: '/modules', pageContext: { modulesTab: 'agents' } }));
    assert.strictEqual(emotion.mood, 'curious');
  });

  it('stack strong score is proud', () => {
    const emotion = resolveHootEmotion(ctx({ pathname: '/builder', pageContext: { stackScore: 85 } }));
    assert.strictEqual(emotion.mood, 'proud');
  });
});