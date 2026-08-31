/**
 * Client-side success metrics for Season D (local only, no PII).
 */

const KEY = "hoot_success_metrics_v1";

export type HootMetrics = {
  firstUsefulAt: string | null;
  hitlProposed: number;
  hitlApproved: number;
  hitlDenied: number;
  workflowsStarted: number;
  scansProposed: number;
  lastEventAt: string | null;
};

function empty(): HootMetrics {
  return {
    firstUsefulAt: null,
    hitlProposed: 0,
    hitlApproved: 0,
    hitlDenied: 0,
    workflowsStarted: 0,
    scansProposed: 0,
    lastEventAt: null,
  };
}

export function loadMetrics(): HootMetrics {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

function save(m: HootMetrics) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}

export function trackMetric(
  kind: "propose" | "approve" | "deny" | "workflow" | "scan_propose" | "useful",
) {
  const m = loadMetrics();
  const now = new Date().toISOString();
  m.lastEventAt = now;
  if (!m.firstUsefulAt && (kind === "approve" || kind === "useful" || kind === "workflow")) {
    m.firstUsefulAt = now;
  }
  if (kind === "propose") m.hitlProposed += 1;
  if (kind === "approve") m.hitlApproved += 1;
  if (kind === "deny") m.hitlDenied += 1;
  if (kind === "workflow") m.workflowsStarted += 1;
  if (kind === "scan_propose") m.scansProposed += 1;
  save(m);
  return m;
}

export function metricsSummary(m: HootMetrics = loadMetrics()) {
  const total = m.hitlApproved + m.hitlDenied;
  const approveRate = total ? Math.round((m.hitlApproved / total) * 100) : null;
  return {
    ...m,
    approveRate,
    hasFirstUseful: Boolean(m.firstUsefulAt),
  };
}
