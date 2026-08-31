const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  bestOperatorModelFromList,
  rankScore,
  resolveHootBrain,
  migrateBrainSettingsIfNeeded,
  suggestLocalModels,
  DEFAULT_OLLAMA_MODEL,
} = require('../h00t-brain');

describe('hoot-brain local mascot', () => {
  it('prefers gemma4 over llama patterns', () => {
    const best = bestOperatorModelFromList(['llama3.2:3b', 'gemma4:latest', 'phi3:mini']);
    assert.strictEqual(best, 'gemma4:latest');
    assert.ok(rankScore('gemma4:latest') > rankScore('llama3.2:3b'));
  });

  it('default pull target is gemma4', () => {
    assert.strictEqual(DEFAULT_OLLAMA_MODEL, 'gemma4:latest');
  });

  it('resolveHootBrain auto picks gemma from installed list', () => {
    const scan = { tools: { ollama: { present: true } }, ollama: { list_raw: 'NAME\ngemma4:latest\n' } };
    const brain = resolveHootBrain({
      scan,
      settings: { hoot_brain: { mode: 'auto' } },
      installedModels: ['gemma4:latest'],
      autoPull: false,
    });
    assert.strictEqual(brain.provider, 'ollama');
    assert.strictEqual(brain.model, 'gemma4:latest');
    assert.strictEqual(brain.available, true);
  });

  it('migrate flips cloud to auto when models exist', () => {
    const mig = migrateBrainSettingsIfNeeded(
      { hoot_brain: { mode: 'cloud', cloud_provider: 'gemini' } },
      { scan: { tools: { ollama: { present: true } } }, installedModels: ['gemma4:latest'] },
    );
    assert.strictEqual(mig.migrated, true);
    assert.strictEqual(mig.settings.hoot_brain.mode, 'auto');
    assert.strictEqual(mig.settings.hoot_brain.ollama_model, 'gemma4:latest');
  });

  it('suggestLocalModels marks gemma recommended when missing', () => {
    const s = suggestLocalModels([]);
    assert.ok(s.some((x) => x.tag.includes('gemma') && x.recommended));
  });
});
