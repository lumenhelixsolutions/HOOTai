/**
 * OKF pack loader/validator for HOOT (zero npm deps).
 * LumenHelix Open Knowledge Format-inspired bundles:
 *   pack/okf.json + pack/concepts/*.md + optional datapackage.json
 */

const fs = require('fs');
const path = require('path');

const FORMAT = 'lumenhelix-okf/1';
const REQUIRED_FM = ['id', 'title', 'type', 'status'];
const CLAIM_CLASSES = new Set([
  'proved',
  'implementation-tested',
  'modeled',
  'demo-synthetic',
  'engine-measured',
  'aspirational',
  'non-goal',
]);

function defaultPackRoots(hootRoot) {
  const projects = path.resolve(hootRoot, '..');
  return [
    path.join(projects, 'packs'),
    path.join(projects, 'HELIXos', 'packs'),
    path.join(hootRoot, 'state', 'okf-packs'),
    path.join(hootRoot, 'packs'),
  ];
}

function listPackDirs(roots) {
  const found = [];
  for (const root of roots) {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) continue;
    for (const name of fs.readdirSync(root)) {
      if (name === 'schema' || name.startsWith('.')) continue;
      const dir = path.join(root, name);
      const manifest = path.join(dir, 'okf.json');
      if (fs.existsSync(manifest) && fs.statSync(dir).isDirectory()) {
        found.push({ name, path: dir, root });
      }
    }
  }
  return found;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { data: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: text };
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, '');
  const data = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      try {
        data[key] = JSON.parse(val.replace(/'/g, '"'));
      } catch {
        data[key] = val
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      }
    } else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      data[key] = val.slice(1, -1);
    } else {
      data[key] = val;
    }
  }
  return { data, body };
}

function walkMd(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkMd(p, base, out);
    else if (name.endsWith('.md')) out.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}

function loadPack(packDir) {
  const abs = path.resolve(packDir);
  const manifestPath = path.join(abs, 'okf.json');
  if (!fs.existsSync(manifestPath)) {
    const err = new Error(`okf.json not found in ${abs}`);
    err.code = 'OKF_NO_MANIFEST';
    throw err;
  }
  const manifest = readJson(manifestPath);
  const conceptsDir = path.join(abs, 'concepts');
  const files = walkMd(conceptsDir);
  const concepts = files.map((rel) => {
    const full = path.join(conceptsDir, rel);
    const text = fs.readFileSync(full, 'utf8');
    const { data, body } = parseFrontmatter(text);
    return {
      file: `concepts/${rel}`,
      abs: full,
      frontmatter: data,
      bodyPreview: body.slice(0, 280),
      bodyLength: body.length,
    };
  });
  return { path: abs, manifest, concepts };
}

function validatePack(packDir) {
  const errors = [];
  const warnings = [];
  let pack;
  try {
    pack = loadPack(packDir);
  } catch (e) {
    return { ok: false, errors: [e.message], warnings: [], pack: null };
  }
  const m = pack.manifest || {};
  if (m.format !== FORMAT) errors.push(`format must be "${FORMAT}" (got ${JSON.stringify(m.format)})`);
  if (!m.name || typeof m.name !== 'string') errors.push('manifest.name required');
  if (!m.version) errors.push('manifest.version required');

  const ids = new Set();
  for (const c of pack.concepts) {
    const fm = c.frontmatter || {};
    for (const k of REQUIRED_FM) {
      if (!fm[k]) errors.push(`${c.file}: missing frontmatter.${k}`);
    }
    if (fm.id) {
      if (ids.has(fm.id)) errors.push(`duplicate concept id: ${fm.id}`);
      ids.add(fm.id);
    }
    if (fm.claim_class && !CLAIM_CLASSES.has(fm.claim_class)) {
      warnings.push(`${c.file}: unknown claim_class ${fm.claim_class}`);
    }
    if (fm.related) {
      const rel = Array.isArray(fm.related) ? fm.related : [fm.related];
      for (const r of rel) {
        if (typeof r === 'string' && r.startsWith('concept.') && !ids.has(r)) {
          // may be external; warn later after full scan
          warnings.push(`${c.file}: related ${r} not in this pack (may be external)`);
        }
      }
    }
  }

  if (m.datapackage) {
    const dp = path.join(pack.path, m.datapackage);
    if (!fs.existsSync(dp)) errors.push(`datapackage missing: ${m.datapackage}`);
  }

  // re-filter related warnings only for ids that truly missing after full id set
  const relatedWarnings = [];
  for (const c of pack.concepts) {
    const rel = c.frontmatter?.related;
    if (!rel) continue;
    for (const r of Array.isArray(rel) ? rel : [rel]) {
      if (typeof r === 'string' && r.startsWith('concept.') && !ids.has(r)) {
        relatedWarnings.push(`${c.file}: related ${r} not in this pack`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: warnings.filter((w) => !w.includes('related')).concat(relatedWarnings),
    pack: {
      name: m.name,
      version: m.version,
      title: m.title || m.name,
      path: pack.path,
      concept_count: pack.concepts.length,
      concept_ids: [...ids],
      helixos: m.helixos || null,
    },
  };
}

function getConcept(packDir, conceptId) {
  const pack = loadPack(packDir);
  const hit = pack.concepts.find((c) => c.frontmatter?.id === conceptId);
  if (!hit) return null;
  const text = fs.readFileSync(hit.abs, 'utf8');
  return { ...hit, text, pack: pack.manifest.name };
}

function searchConcepts(packDir, query) {
  const q = String(query || '').toLowerCase();
  const pack = loadPack(packDir);
  if (!q) return pack.concepts.map((c) => ({ id: c.frontmatter.id, title: c.frontmatter.title, file: c.file, tags: c.frontmatter.tags }));
  return pack.concepts
    .filter((c) => {
      const blob = JSON.stringify(c.frontmatter).toLowerCase() + c.bodyPreview.toLowerCase();
      return blob.includes(q);
    })
    .map((c) => ({
      id: c.frontmatter.id,
      title: c.frontmatter.title,
      file: c.file,
      tags: c.frontmatter.tags,
      claim_class: c.frontmatter.claim_class,
    }));
}

/**
 * Ingest: copy pack into HOOT state/okf-packs/<name>
 */
function ingestPack(sourceDir, hootRoot) {
  const v = validatePack(sourceDir);
  if (!v.ok) {
    const err = new Error(`validate failed: ${v.errors.join('; ')}`);
    err.validation = v;
    throw err;
  }
  const name = v.pack.name;
  const destRoot = path.join(hootRoot, 'state', 'okf-packs');
  const dest = path.join(destRoot, name);
  fs.mkdirSync(destRoot, { recursive: true });
  copyDir(path.resolve(sourceDir), dest);
  const indexPath = path.join(destRoot, 'index.json');
  const index = readJson(indexPath, { packs: [] });
  const entry = {
    name,
    version: v.pack.version,
    path: dest,
    ingested_at: new Date().toISOString(),
    concept_count: v.pack.concept_count,
  };
  index.packs = (index.packs || []).filter((p) => p.name !== name).concat([entry]);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  return { ...entry, validation: v };
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (name === 'node_modules' || name === '.git') continue;
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function resolvePackByName(name, hootRoot) {
  const roots = defaultPackRoots(hootRoot);
  for (const row of listPackDirs(roots)) {
    if (row.name === name) return row.path;
  }
  const ingested = path.join(hootRoot, 'state', 'okf-packs', name);
  if (fs.existsSync(path.join(ingested, 'okf.json'))) return ingested;
  return null;
}

function contextSnippet(packDir, { maxConcepts = 12, query = '' } = {}) {
  const pack = loadPack(packDir);
  let concepts = pack.concepts;
  if (query) {
    const hits = new Set(searchConcepts(packDir, query).map((h) => h.id));
    concepts = concepts.filter((c) => hits.has(c.frontmatter.id));
  }
  concepts = concepts.slice(0, maxConcepts);
  const lines = [
    `# OKF pack: ${pack.manifest.name}@${pack.manifest.version}`,
    pack.manifest.description || '',
    '',
  ];
  for (const c of concepts) {
    lines.push(`## ${c.frontmatter.title || c.frontmatter.id}`);
    lines.push(`id: ${c.frontmatter.id}`);
    if (c.frontmatter.claim_class) lines.push(`claim_class: ${c.frontmatter.claim_class}`);
    if (c.frontmatter.helixos_tier) lines.push(`helixos_tier: ${c.frontmatter.helixos_tier}`);
    lines.push('');
    lines.push(c.bodyPreview);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  FORMAT,
  CLAIM_CLASSES,
  defaultPackRoots,
  listPackDirs,
  loadPack,
  validatePack,
  getConcept,
  searchConcepts,
  ingestPack,
  resolvePackByName,
  contextSnippet,
};
