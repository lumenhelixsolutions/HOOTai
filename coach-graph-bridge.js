/**
 * coach-graph-bridge.js — HTTP client for Coach Graph sidecar (M14).
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { logGraphRun } = require('./coach-approval-log');

const DEFAULT_BASE = process.env.COACH_GRAPH_URL || 'http://127.0.0.1:7788';
const PROBE_TIMEOUT_MS = 2000;
const RUN_TIMEOUT_MS = 180000;

function requestJson(method, urlString, body = null, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = body == null ? null : JSON.stringify(body);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : { Accept: 'application/json' },
        timeout: timeoutMs,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = { raw };
          }
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`coach-graph timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function probeCoachGraph(base = DEFAULT_BASE) {
  try {
    const { status, body } = await requestJson('GET', `${base.replace(/\/$/, '')}/health`);
    return { online: status >= 200 && status < 300, status, body, base };
  } catch (err) {
    return { online: false, status: 0, error: String(err.message || err), base };
  }
}

async function fetchCoachGraphSpec(base = DEFAULT_BASE) {
  const { status, body } = await requestJson('GET', `${base.replace(/\/$/, '')}/spec`);
  if (status < 200 || status >= 300) throw new Error(body?.error || `spec fetch failed (${status})`);
  return body;
}

async function fetchCoachGraphProfiles(base = DEFAULT_BASE) {
  const { status, body } = await requestJson('GET', `${base.replace(/\/$/, '')}/profiles`);
  if (status < 200 || status >= 300) throw new Error(body?.error || `profiles fetch failed (${status})`);
  return body;
}

async function runCoachGraph(
  { profileId, dryRun = false, autoApprove = false, minScore = null } = {},
  base = DEFAULT_BASE,
) {
  if (!profileId) throw new Error('profileId required');
  const { status, body } = await requestJson(
    'POST',
    `${base.replace(/\/$/, '')}/run`,
    {
      profile_id: profileId,
      dry_run: Boolean(dryRun),
      auto_approve: Boolean(autoApprove),
      ...(minScore != null ? { min_score: minScore } : {}),
    },
    RUN_TIMEOUT_MS,
  );
  const result = {
    ok: Boolean(body?.ok),
    status,
    profileId,
    dryRun: Boolean(dryRun),
    launched: Boolean(body?.launched),
    error: body?.error || null,
    config: body?.config || null,
    state: body?.state || null,
    sidecar: base,
  };
  logGraphRun({
    profileId,
    dryRun,
    autoApprove,
    ok: result.ok,
    launched: result.launched,
    error: result.error,
    tier: result.config?.tier || null,
    score: result.state?.score ?? null,
  });
  return result;
}

module.exports = {
  DEFAULT_BASE,
  probeCoachGraph,
  fetchCoachGraphSpec,
  fetchCoachGraphProfiles,
  runCoachGraph,
};