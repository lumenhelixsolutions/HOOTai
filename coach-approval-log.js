/**
 * coach-approval-log.js — Track gated coach command executions for Phase 4 entry.
 */

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'state', 'coach-approvals.jsonl');
const HARD_TYPES = new Set([
  'launch', 'launchProfile', 'setMemory', 'appendMemory', 'switchProject',
  'setProviderStatus', 'generateHandoff', 'coachAction',
]);

/** Season C — log soft executive actions too for a full HITL timeline */
const SOFT_TYPES = new Set([
  'runScan', 'navigate', 'makePlan', 'generatePlan', 'getStatus',
]);

function ensureDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isHardCommand(cmd) {
  return HARD_TYPES.has(String(cmd?.type || ''));
}

function shouldLogCommand(cmd) {
  const t = String(cmd?.type || '');
  return HARD_TYPES.has(t) || SOFT_TYPES.has(t) || t === 'deny' || t === 'propose' || t === 'workflow';
}

function appendApprovalLog(entry) {
  ensureDir();
  const line = JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n';
  fs.appendFileSync(LOG_PATH, line, 'utf8');
}

function logCoachExecution(cmd, result, meta = {}) {
  if (!shouldLogCommand(cmd) && !meta.force) return null;
  const row = {
    type: cmd.type,
    ok: Boolean(result?.ok),
    profileId: cmd.profileId || cmd.profile || null,
    project: cmd.path || cmd.project || null,
    route: cmd.route || result?.route || null,
    target: cmd.target || result?.target || null,
    blocked: result ? !result.ok : Boolean(meta.denied),
    error: result?.error || meta.error || null,
    source: meta.source || cmd._source || 'coach-execute',
    decision: meta.decision || (result?.ok ? 'approved' : meta.denied ? 'denied' : 'executed'),
    workflow: cmd._workflow || meta.workflow || null,
    stepId: cmd._stepId || null,
    bind: cmd._bind || meta.bind || null,
  };
  appendApprovalLog(row);
  return row;
}

/** Client-side HITL events: propose / deny without execute */
function logHitlEvent(entry = {}) {
  const row = {
    type: entry.type || 'propose',
    ok: entry.decision === 'approved' || entry.decision === 'proposed',
    profileId: entry.profileId || null,
    project: entry.project || null,
    route: entry.route || null,
    target: entry.target || null,
    blocked: entry.decision === 'denied',
    error: entry.error || null,
    source: entry.source || 'hitl-ui',
    decision: entry.decision || 'proposed',
    workflow: entry.workflow || null,
    stepId: entry.stepId || null,
    bind: entry.bind || null,
    label: entry.label || null,
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
  shouldLogCommand,
  logCoachExecution,
  logHitlEvent,
  logGraphRun,
  loadApprovalLog,
  summarizeApprovalLog,
};