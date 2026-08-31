const { describe, it } = require('node:test');
const assert = require('node:assert');
const { familyKey, quantLabel, flagDuplicates, buildVitalsAdvise } = require('../model-inventory');

describe('model-inventory', () => {
  it('normalizes family keys across quants', () => {
    assert.strictEqual(familyKey('Qwen2.5-Coder-7B-Instruct-abliterated-Q8_0.gguf'), familyKey('qwen2.5-coder-7b-instruct-Q4_K_M.gguf'));
    assert.ok(familyKey('gemma4:latest').includes('gemma'));
  });

  it('extracts quant labels', () => {
    assert.ok(quantLabel('model-Q4_K_M.gguf'));
    assert.strictEqual(quantLabel('gemma4:latest'), null);
  });

  it('flags duplicate clusters by family', () => {
    const rows = [
      { id: 'a', name: 'phi-Q4.gguf', backend: 'gguf-file', path_or_tag: 'C:\\m\\phi-Q4.gguf', family: familyKey('phi-Q4.gguf'), flags: [] },
      { id: 'b', name: 'phi-Q8.gguf', backend: 'gguf-file', path_or_tag: 'D:\\m\\phi-Q8.gguf', family: familyKey('phi-Q8.gguf'), flags: [] },
    ];
    // force same family
    rows[0].family = 'phi';
    rows[1].family = 'phi';
    const clusters = flagDuplicates(rows);
    assert.strictEqual(clusters.length, 1);
    assert.ok(rows[0].flags.includes('duplicate'));
    assert.ok(rows[1].flags.includes('duplicate'));
  });

  it('builds advise findings from inventory shape', () => {
    const advise = buildVitalsAdvise({
      findings: [{ id: 'duplicates', severity: 'medium', title: 'dup' }],
      duplicate_clusters: [{ id: 'dup:x' }],
      counts: { total: 2 },
    });
    assert.strictEqual(advise.schema, 'hoot.vitals_advise.v1');
    assert.strictEqual(advise.findings.length, 1);
  });
});
