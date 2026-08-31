import { useCallback, useEffect, useState } from "react";
import { Play, RefreshCw, ShieldCheck, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { useCoach } from "@/context/CoachContext";
import { useExecutiveControlOptional } from "@/context/ExecutiveControlContext";
import type { CoachApprovalEntry, CoachApprovalsPayload } from "@/lib/coach-approvals-types";
import { useSessionPoll } from "@/hooks/useSessionPoll";

const PHASE4_TARGET = 10;

type WorkflowCard = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  stepCount: number;
};

function Section({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: "20px 22px",
        borderRadius: 14,
        background: "rgba(18,16,14,0.6)",
        border: "1px solid rgba(255,176,66,0.1)",
      }}
    >
      <h3 style={{ fontFamily: "'EB Garamond', serif", fontSize: 18, fontWeight: 400, margin: "0 0 4px", color: "#f5e6d0" }}>{title}</h3>
      {caption && <p style={{ margin: "0 0 16px", fontSize: 11, opacity: 0.48, lineHeight: 1.45 }}>{caption}</p>}
      {!caption && <div style={{ marginBottom: 16 }} />}
      {children}
    </section>
  );
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const DEFAULT_GRAPH_PROFILE = "local-safe-audit";

export default function ApprovalsPage() {
  const [data, setData] = useState<CoachApprovalsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [graphProfile, setGraphProfile] = useState(DEFAULT_GRAPH_PROFILE);
  const [graphRunning, setGraphRunning] = useState(false);
  const [graphStatus, setGraphStatus] = useState<string | null>(null);
  const [sidecarOnline, setSidecarOnline] = useState<boolean | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowCard[]>([]);
  const [wfBusy, setWfBusy] = useState<string | null>(null);
  const { setPageContext } = useCoach();
  const executive = useExecutiveControlOptional();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [payload, status, wf] = await Promise.all([
        api.getCoachApprovals(80),
        api.getCoachGraphStatus().catch(() => null),
        api.getCoachWorkflows().catch(() => null),
      ]);
      setData(payload);
      setSidecarOnline(status?.sidecar?.online ?? false);
      if (wf?.workflows) setWorkflows(wf.workflows);
      setPageContext({
        approvalCount: payload.count,
        phase4Ready: payload.phase4Ready,
        approvalRecentOk: payload.rows.filter((r) => r.ok).length,
        graphRuns: payload.summary?.graphRuns ?? 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setPageContext]);

  const runWorkflow = useCallback(
    async (id: string) => {
      if (!executive) return;
      setWfBusy(id);
      try {
        await executive.startWorkflow(id);
        await load();
      } finally {
        setWfBusy(null);
      }
    },
    [executive, load],
  );

  const runGraphDryRun = useCallback(async () => {
    setGraphRunning(true);
    setGraphStatus(null);
    try {
      const result = await api.runCoachGraph({
        profileId: graphProfile.trim(),
        dryRun: true,
        autoApprove: true,
      });
      setGraphStatus(
        result.ok
          ? `Dry-run OK · score ${(result.state as { score?: number })?.score ?? "—"} · tier ${result.config?.tier ?? "default"}`
          : `Graph failed: ${result.error || "unknown error"}`,
      );
      await load();
    } catch (err) {
      setGraphStatus(`Sidecar error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGraphRunning(false);
    }
  }, [graphProfile, load]);

  useSessionPoll(load, { immediate: true });

  if (loading) return <div style={{ opacity: 0.5, fontSize: 13 }}>Loading coach approval log…</div>;
  if (!data) return <div style={{ opacity: 0.5, fontSize: 13 }}>Failed to load approval log.</div>;

  const progress = Math.min(100, (data.count / PHASE4_TARGET) * 100);
  const rows = [...data.rows].reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1100 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontSize: 28, margin: 0, fontWeight: 400, color: "#f5e6d0" }}>
            Trust · Approvals timeline
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.55, maxWidth: 560, lineHeight: 1.5 }}>
            HITL timeline — proposes, denials, approvals, workflows. Mutations never run without your Approve.
          </p>
        </div>
        <button type="button" onClick={load} disabled={refreshing} style={btnStyle(false)}>
          <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <Section
        title="Coach workflows"
        caption="Multi-step operator paths · each mutating step opens the global approval sheet"
      >
        {workflows.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>No workflows loaded — is HOOT server up?</p>
        ) : (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {workflows.map((wf) => (
              <div
                key={wf.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid rgba(255,176,66,0.15)",
                  background: "rgba(255,176,66,0.04)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5e6d0", marginBottom: 6 }}>{wf.title}</div>
                <p style={{ margin: "0 0 10px", fontSize: 11, opacity: 0.55, lineHeight: 1.45 }}>{wf.description}</p>
                <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 10 }}>
                  {wf.stepCount} steps · {(wf.tags || []).join(" · ")}
                </div>
                <button
                  type="button"
                  disabled={!executive || wfBusy === wf.id}
                  onClick={() => void runWorkflow(wf.id)}
                  style={btnStyle(true)}
                >
                  <Workflow size={14} />
                  {wfBusy === wf.id ? "Starting…" : "Start workflow"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Phase 4 progress"
        caption={`${data.count} of ${PHASE4_TARGET} gated executions recorded · ${data.phase4Ready ? "Phase 4 ready" : "Keep using gated coach commands"}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: data.phase4Ready ? "#34d399" : "#f5e6d0", fontWeight: 600 }}>
              {data.phase4Ready ? "Phase 4 unlocked" : `${data.count} / ${PHASE4_TARGET}`}
            </span>
            <span style={{ opacity: 0.5 }}>{Math.round(progress)}%</span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: 999,
                background: data.phase4Ready
                  ? "linear-gradient(90deg, #34d399, #6ee7b7)"
                  : "linear-gradient(90deg, #ffb042, #f59e0b)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.45, lineHeight: 1.5 }}>
            Season C logs hard + soft executive actions, proposes, denials, and workflows into the JSONL timeline.
          </p>
        </div>
      </Section>

      {data.summary && (
        <Section title="Approval analytics" caption="Aggregates from the JSONL log (M15)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Success rate", value: `${data.summary.successRate}%` },
              { label: "Graph runs", value: String(data.summary.graphRuns) },
              { label: "Dry-run graphs", value: String(data.summary.graphDryRuns) },
              { label: "Blocked", value: String(data.summary.blockedCount) },
            ].map((chip) => (
              <span
                key={chip.label}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span style={{ opacity: 0.5 }}>{chip.label}: </span>
                <strong>{chip.value}</strong>
              </span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 11 }}>
            <AnalyticsList title="By type" items={data.summary.byType} />
            <AnalyticsList title="By profile" items={data.summary.byProfile} />
            <AnalyticsList title="By tier" items={data.summary.byTier} />
          </div>
        </Section>
      )}

      <Section
        title="LangGraph dry-run"
        caption={`Coach graph sidecar ${sidecarOnline ? "online" : "offline"} · POST /api/coach/graph/run`}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={graphProfile}
            onChange={(e) => setGraphProfile(e.target.value)}
            placeholder="profile id"
            style={{
              flex: "1 1 220px",
              minWidth: 180,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.25)",
              color: "#f5e6d0",
              fontSize: 12,
            }}
          />
          <button type="button" onClick={runGraphDryRun} disabled={graphRunning || !sidecarOnline} style={btnStyle(true)}>
            <Play size={14} />
            {graphRunning ? "Running…" : "Dry-run graph"}
          </button>
        </div>
        {graphStatus && (
          <p style={{ margin: "12px 0 0", fontSize: 11, opacity: 0.7, lineHeight: 1.5 }}>{graphStatus}</p>
        )}
        {!sidecarOnline && (
          <p style={{ margin: "10px 0 0", fontSize: 11, opacity: 0.5 }}>
            Start sidecar: <code>python coach-graph/server.py</code> (port 7788)
          </p>
        )}
      </Section>

      <Section title="HITL timeline" caption={rows.length ? `Showing last ${rows.length} of ${data.count} total` : "No events yet"}>
        {rows.length === 0 ? (
          <div style={{ padding: 16, borderRadius: 12, border: "1px solid rgba(255,176,66,0.2)", background: "rgba(255,176,66,0.06)", fontSize: 12, lineHeight: 1.55 }}>
            <strong style={{ color: "#ffb042" }}>No timeline events yet.</strong> Start a workflow or Approve a coach action — proposes and denials appear here.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["When", "Type", "Decision", "Result", "Route / target", "Source", "Error"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <ApprovalRow key={`${row.at}-${row.type}-${idx}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          fontSize: 11,
          opacity: 0.65,
        }}
      >
        <ShieldCheck size={14} color="#ffb042" />
        Operator audit log at <code>/api/coach/audit</code> covers all coach tool calls — this view tracks gated approvals only.
      </div>
    </div>
  );
}

function AnalyticsList({ title, items }: { title: string; items: Record<string, number> }) {
  const entries = Object.entries(items || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ opacity: 0.5, marginBottom: 8 }}>{title}</div>
      {entries.length === 0 ? (
        <div style={{ opacity: 0.4 }}>—</div>
      ) : (
        entries.map(([key, count]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <code style={{ fontSize: 10 }}>{key}</code>
            <span>{count}</span>
          </div>
        ))
      )}
    </div>
  );
}

function ApprovalRow({ row }: { row: CoachApprovalEntry }) {
  const resultLabel = row.blocked ? "blocked" : row.ok ? "ok" : "failed";
  const resultColor = row.blocked ? "#fbbf24" : row.ok ? "#34d399" : "#f87171";
  const typeLabel = row.type === "graphRun" && row.dryRun ? "graphRun (dry)" : row.type;
  const decision = row.decision || (row.blocked ? "denied" : row.ok ? "approved" : "—");
  const where = [row.route, row.target, row.profileId, row.project, row.label].filter(Boolean).join(" · ") || "—";

  return (
    <tr>
      <td style={tdLeft}>{formatWhen(row.at)}</td>
      <td style={tdLeft}>
        <code style={{ fontSize: 11 }}>{typeLabel}</code>
        {row.workflow ? <div style={{ fontSize: 10, opacity: 0.45 }}>{String(row.workflow)}</div> : null}
      </td>
      <td style={tdLeft}>
        <span style={{ fontSize: 11, textTransform: "uppercase", opacity: 0.85 }}>{decision}</span>
      </td>
      <td style={tdLeft}>
        <span style={{ color: resultColor, fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>{resultLabel}</span>
      </td>
      <td style={{ ...tdLeft, fontSize: 11, maxWidth: 220 }}>{where}</td>
      <td style={{ ...tdLeft, fontSize: 10, opacity: 0.55 }}>{row.source || "—"}</td>
      <td style={{ ...tdLeft, opacity: 0.6, fontSize: 11, maxWidth: 200 }}>{row.error || "—"}</td>
    </tr>
  );
}

function btnStyle(primary: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: primary ? "1px solid rgba(255,176,66,0.35)" : "1px solid rgba(255,255,255,0.1)",
    background: primary ? "rgba(255,176,66,0.1)" : "rgba(255,255,255,0.03)",
    color: primary ? "#ffb042" : "#dadada",
    cursor: "pointer",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as const;
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 8px",
  color: "rgba(255,255,255,0.45)",
  fontWeight: 500,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const tdLeft: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 8px",
  verticalAlign: "middle",
  borderTop: "1px solid rgba(255,255,255,0.05)",
};