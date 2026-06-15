/**
 * coach-approval-log.js — Track gated coach command executions for Phase 4 entry.
 */

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'state', 'coach-approvals.jsonl');
const HARD_TYPES = new Set([
  'launch', 'launchProfile', 'setMemory', 'appendMemory', 'switchProject',
]);

function ensureDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isHardCommand(cmd) {
  return HARD_TYPES.has(String(cmd?.type || ''));
}

function appendApprovalLog(entry) {
  ensureDir();
  const line = JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n';
  fs.appendFileSync(LOG_PATH, line, 'utf8');
}

function logCoachExecution(cmd, result) {
  if (!isHardCommand(cmd)) return null;
  const row = {
    type: cmd.type,
    ok: Boolean(result?.ok),
    profileId: cmd.profileId || cmd.profile || null,
    project: cmd.path || cmd.project || null,
    blocked: !result?.ok,
    error: result?.error || null,
  };
  appendApprovalLog(row);
  return row;
}

function loadApprovalLog(limit = 50) {
  if (!fs.existsSync(LOG_PATH)) return { path: LOG_PATH, rows: [], count: 0 };
  const lines = fs.readFileSync(LOG_PATH, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  const rows = lines.slice(-limit).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  return { path: LOG_PATH, rows, count: lines.length };
}

function summarizeApprovalLog(limit = 200) {
  const { rows, count } = loadApprovalLog(limit);
  const byType = {};
  const byProfile = {};
  const byTier = {};
  let okCount = 0;
  let blockedCount = 0;
  let graphRuns = 0;
  let graphDryRuns = 0;

  for (const row of rows) {
    const type = String(row.type || 'unknown');
    byType[type] = (byType[type] || 0) + 1;
    if (row.profileId) byProfile[row.profileId] = (byProfile[row.profileId] || 0) + 1;
    if (row.tier) byTier[row.tier] = (byTier[row.tier] || 0) + 1;
    if (row.ok) okCount += 1;
    if (row.blocked) blockedCount += 1;
    if (type === 'graphRun') {
      graphRuns += 1;
      if (row.dryRun) graphDryRuns += 1;
    }
  }

  const denom = rows.length || 1;
  return {
    window: rows.length,
    total: count,
    okCount,
    blockedCount,
    graphRuns,
    graphDryRuns,
    successRate: Math.round((okCount / denom) * 1000) / 10,
    byType,
    byProfile,
    byTier,
    phase4Ready: count >= 10,
  };
}

function logGraphRun(entry = {}) {
  const row = {
    type: 'graphRun',
    ok: Boolean(entry.ok),
    profileId: entry.profileId || null,
    project: null,
    blocked: !entry.ok,
    error: entry.error || null,
    dryRun: Boolean(entry.dryRun),
    autoApprove: Boolean(entry.autoApprove),
    launched: Boolean(entry.launched),
    tier: entry.tier || null,
    score: entry.score ?? null,
  };
  appendApprovalLog(row);
  return row;
}

module.exports = {
  LOG_PATH,
  isHardCommand,
  logCoachExecution,
  logGraphRun,
  loadApprovalLog,
  summarizeApprovalLog,
};