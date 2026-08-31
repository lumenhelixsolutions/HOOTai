const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { analyzeSafetensors, parseShard, quarantinePackage, restoreQuarantine } = require('../safetensors-advisor');

describe('safetensors-advisor', () => {
  it('parses out- and of-N shard names', () => {
    assert.strictEqual(parseShard('out-00003.safetensors').kind, 'out-index');
    assert.strictEqual(parseShard('model-00001-of-00008.safetensors').total, 8);
  });

  it('groups shards as one keep package', () => {
    const dir = 'D:\\models\\glm52_i4';
    const models = Array.from({ length: 12 }, (_, i) => ({
      id: `st-${i}`,
      name: `out-${String(i).padStart(5, '0')}.safetensors`,
      path_or_tag: path.join(dir, `out-${String(i).padStart(5, '0')}.safetensors`),
      size_bytes: 2e9,
      weight_kind: 'safetensors',
      backend: 'hf-safetensors',
    }));
    const report = analyzeSafetensors(models);
    assert.strictEqual(report.summary.packages, 1);
    assert.strictEqual(report.packages[0].shard_count, 12);
    assert.strictEqual(report.packages[0].verdict, 'keep');
  });

  it('quarantine moves package with undo', () => {
    const hoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hoot-q-'));
    const pkg = path.join(hoot, 'models', 'partial');
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(pkg, 'out-00000.safetensors'), 'x');
    // incomplete declared total
    fs.writeFileSync(path.join(pkg, 'model.safetensors.index.json'), JSON.stringify({ weight_map: {} }));
    const r = quarantinePackage(hoot, pkg, { confirm: true, reason: 'test' });
    assert.strictEqual(r.ok, true);
    assert.ok(!fs.existsSync(pkg));
    assert.ok(fs.existsSync(r.entry.to));
    const rest = restoreQuarantine(hoot, r.entry.id, { confirm: true });
    assert.strictEqual(rest.ok, true);
    assert.ok(fs.existsSync(pkg));
  });
});
