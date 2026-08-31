const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const okf = require('../okf-pack');

const PACKS = path.resolve(__dirname, '..', '..', 'packs');
const MYDEV = path.join(PACKS, 'mydev-control-plane');
const HELIX = path.join(PACKS, 'helixos-core');

describe('okf-pack', () => {
  it('validates mydev-control-plane', () => {
    const v = okf.validatePack(MYDEV);
    assert.equal(v.ok, true, v.errors.join('; '));
    assert.ok(v.pack.concept_count >= 3);
  });

  it('validates helixos-core', () => {
    const v = okf.validatePack(HELIX);
    assert.equal(v.ok, true, v.errors.join('; '));
    assert.ok(v.pack.concept_ids.includes('concept.helixos.gate2'));
  });

  it('lists packs under portfolio packs/', () => {
    const rows = okf.listPackDirs([PACKS]);
    const names = rows.map((r) => r.name);
    assert.ok(names.includes('mydev-control-plane'));
    assert.ok(names.includes('knotstore-core'));
    assert.ok(names.includes('helixos-core'));
  });

  it('gets concept by id', () => {
    const c = okf.getConcept(MYDEV, 'concept.mydev.thrall_pool');
    assert.ok(c);
    assert.equal(c.frontmatter.type, 'architecture');
  });

  it('searches concepts', () => {
    const hits = okf.searchConcepts(MYDEV, 'thrall');
    assert.ok(hits.some((h) => h.id === 'concept.mydev.thrall_pool'));
  });

  it('builds context snippet', () => {
    const md = okf.contextSnippet(HELIX, { maxConcepts: 2 });
    assert.match(md, /OKF pack: helixos-core/);
  });
});
