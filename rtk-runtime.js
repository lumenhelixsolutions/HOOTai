/**
 * rtk-runtime.js — HOOT-bundled RTK (token compression).
 * RTK is a first-class HOOT capability: resolve bin under HootAi/bin first,
 * optionally provision the official Windows/Linux binary once, never treat
 * as a separate product the user must hunt down.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const https = require('https');
const { createWriteStream } = require('fs');

const RTK_RELEASE_TAG = process.env.HOOT_RTK_VERSION || 'v0.44.1';
const RTK_REPO = 'rtk-ai/rtk';

function binDir(hootRoot) {
  return path.join(hootRoot, 'bin');
}

function expectedBinaryName() {
  return process.platform === 'win32' ? 'rtk.exe' : 'rtk';
}

function bundledPath(hootRoot) {
  return path.join(binDir(hootRoot), expectedBinaryName());
}

function whichOnPath() {
  const name = expectedBinaryName().replace(/\.exe$/i, '');
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (probe.status !== 0 || !probe.stdout?.trim()) return null;
  return probe.stdout.trim().split(/\r?\n/)[0];
}

/**
 * Resolve RTK executable: HOOT bin > PATH.
 */
function resolveRtk(hootRoot) {
  const bundled = bundledPath(hootRoot);
  if (fs.existsSync(bundled)) {
    return { present: true, path: bundled, source: 'hoot-bin', bundled: true };
  }
  const onPath = whichOnPath();
  if (onPath) {
    return { present: true, path: onPath, source: 'path', bundled: false };
  }
  return { present: false, path: null, source: 'none', bundled: false };
}

function rtkVersion(exePath) {
  if (!exePath) return null;
  try {
    const out = spawnSync(exePath, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    return (out.stdout || out.stderr || '').trim().split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function assetNameForPlatform() {
  if (process.platform === 'win32') return 'rtk-x86_64-pc-windows-msvc.zip';
  if (process.platform === 'darwin') {
    return process.arch === 'arm64'
      ? 'rtk-aarch64-apple-darwin.tar.gz'
      : 'rtk-x86_64-apple-darwin.tar.gz';
  }
  return process.arch === 'arm64'
    ? 'rtk-aarch64-unknown-linux-gnu.tar.gz'
    : 'rtk-x86_64-unknown-linux-musl.tar.gz';
}

function downloadUrl(tag) {
  const asset = assetNameForPlatform();
  return `https://github.com/${RTK_REPO}/releases/download/${tag}/${asset}`;
}

function httpGetBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    https.get(url, { headers: { 'User-Agent': 'HOOT-rtk-runtime' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(httpGetBuffer(res.headers.location, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extractWindowsZip(zipBuf, destDir) {
  const tmpZip = path.join(destDir, `_rtk_download.zip`);
  fs.writeFileSync(tmpZip, zipBuf);
  const dest = path.join(destDir, expectedBinaryName());
  // Prefer Expand-Archive via PowerShell (available on Windows)
  const ps = spawnSync(
    'powershell.exe',
    [
      '-NoProfile', '-Command',
      `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '${tmpZip.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force; Get-ChildItem -Path '${destDir.replace(/'/g, "''")}' -Recurse -Filter 'rtk.exe' | Select-Object -First 1 -ExpandProperty FullName`,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 60000 },
  );
  try { fs.unlinkSync(tmpZip); } catch { /* ignore */ }
  if (ps.status !== 0) {
    throw new Error(ps.stderr || ps.stdout || 'Expand-Archive failed');
  }
  const found = (ps.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0];
  if (found && found !== dest && fs.existsSync(found)) {
    fs.copyFileSync(found, dest);
  }
  if (!fs.existsSync(dest)) {
    throw new Error('rtk.exe not found after extract');
  }
  return dest;
}

/**
 * Ensure RTK is available under HootAi/bin. Idempotent, fail-soft.
 * @returns {Promise<object>} resolveRtk result + provision meta
 */
async function ensureRtkBundled(hootRoot, options = {}) {
  const force = Boolean(options.force);
  const existing = resolveRtk(hootRoot);
  if (existing.present && existing.source === 'hoot-bin' && !force) {
    return {
      ...existing,
      version: rtkVersion(existing.path),
      provisioned: false,
      message: 'HOOT-bundled RTK already present',
    };
  }
  // Prefer copying from PATH into bin if present (no network)
  if (existing.present && existing.source === 'path' && !force) {
    try {
      fs.mkdirSync(binDir(hootRoot), { recursive: true });
      const dest = bundledPath(hootRoot);
      fs.copyFileSync(existing.path, dest);
      return {
        present: true,
        path: dest,
        source: 'hoot-bin',
        bundled: true,
        version: rtkVersion(dest),
        provisioned: true,
        message: 'Copied system RTK into HOOT bin (preinstalled for HOOT launches)',
      };
    } catch (err) {
      return {
        ...existing,
        version: rtkVersion(existing.path),
        provisioned: false,
        message: `Using PATH RTK; copy to bin failed: ${err.message}`,
      };
    }
  }

  if (options.skipDownload) {
    return {
      ...existing,
      version: null,
      provisioned: false,
      message: 'RTK not in HOOT bin; download skipped',
    };
  }

  try {
    fs.mkdirSync(binDir(hootRoot), { recursive: true });
    const tag = options.tag || RTK_RELEASE_TAG;
    const url = downloadUrl(tag);
    const buf = await httpGetBuffer(url);
    if (process.platform === 'win32') {
      const dest = extractWindowsZip(buf, binDir(hootRoot));
      return {
        present: true,
        path: dest,
        source: 'hoot-bin',
        bundled: true,
        version: rtkVersion(dest),
        provisioned: true,
        message: `Provisioned HOOT-bundled RTK from ${tag}`,
        release_url: `https://github.com/${RTK_REPO}/releases/tag/${tag}`,
      };
    }
    // Non-Windows: write tarball and try tar
    const tarPath = path.join(binDir(hootRoot), '_rtk_download.tgz');
    fs.writeFileSync(tarPath, buf);
    const tar = spawnSync('tar', ['-xzf', tarPath, '-C', binDir(hootRoot)], {
      encoding: 'utf8',
      timeout: 60000,
    });
    try { fs.unlinkSync(tarPath); } catch { /* ignore */ }
    if (tar.status !== 0) throw new Error(tar.stderr || 'tar extract failed');
    const dest = bundledPath(hootRoot);
    // find rtk binary if nested
    if (!fs.existsSync(dest)) {
      const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
          const p = path.join(dir, name);
          const st = fs.statSync(p);
          if (st.isDirectory()) {
            const f = walk(p);
            if (f) return f;
          } else if (name === 'rtk') return p;
        }
        return null;
      };
      const found = walk(binDir(hootRoot));
      if (found) fs.copyFileSync(found, dest);
    }
    if (fs.existsSync(dest)) {
      try { fs.chmodSync(dest, 0o755); } catch { /* ignore */ }
    }
    return {
      present: fs.existsSync(dest),
      path: fs.existsSync(dest) ? dest : null,
      source: fs.existsSync(dest) ? 'hoot-bin' : 'none',
      bundled: fs.existsSync(dest),
      version: rtkVersion(dest),
      provisioned: fs.existsSync(dest),
      message: fs.existsSync(dest) ? `Provisioned HOOT-bundled RTK from ${tag}` : 'Extract completed but rtk binary missing',
      release_url: `https://github.com/${RTK_REPO}/releases/tag/${tag}`,
    };
  } catch (err) {
    const again = resolveRtk(hootRoot);
    return {
      ...again,
      version: rtkVersion(again.path),
      provisioned: false,
      error: err.message,
      message: `Could not auto-provision RTK: ${err.message}. HOOT will retry on next start.`,
      release_url: `https://github.com/${RTK_REPO}/releases`,
    };
  }
}

/**
 * Status object for settings / vitals / coach (never "install as second product").
 */
function getRtkStatus(hootRoot) {
  const resolved = resolveRtk(hootRoot);
  return {
    product: 'HOOT RTK',
    preinstalled: true,
    separate_install_required: false,
    present: resolved.present,
    bundled: resolved.bundled,
    path: resolved.path,
    source: resolved.source,
    version: rtkVersion(resolved.path),
    bin_dir: binDir(hootRoot),
    agents: ['claude', 'codex', 'cursor', 'hermes'],
    note: resolved.present
      ? 'Token compression is part of HOOT (bundled or PATH).'
      : 'HOOT will auto-provision RTK into bin/ on start — not a separate install step.',
  };
}

/**
 * Prepend HOOT bin to PATH for child launches so rtk is always found.
 */
function pathWithHootBin(hootRoot, env = process.env) {
  const dir = binDir(hootRoot);
  const key = process.platform === 'win32' ? 'Path' : 'PATH';
  const current = env[key] || env.PATH || '';
  if (current.toLowerCase().includes(dir.toLowerCase())) return { ...env };
  return { ...env, [key]: `${dir}${path.delimiter}${current}`, PATH: `${dir}${path.delimiter}${env.PATH || current}` };
}

module.exports = {
  RTK_RELEASE_TAG,
  resolveRtk,
  rtkVersion,
  ensureRtkBundled,
  getRtkStatus,
  pathWithHootBin,
  bundledPath,
  binDir,
};
