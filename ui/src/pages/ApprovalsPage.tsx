import { useCallback, useState } from "react";
import { Play, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useCoach } from "@/context/CoachContext";
import type { CoachApprovalEntry, CoachApprovalsPayload } from "@/lib/coach-approvals-types";
import { useSessionPoll } from "@/hooks/useSessionPoll";

const PHASE4_TARGET = 10;

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
  const { setPageContext } = useCoach();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [payload, status] = await Promise.all([
        api.getCoachApprovals(50),
        api.getCoachGraphStatus().catch(() => null),
      ]);
      setData(payload);
      setSidecarOnline(status?.sidecar?.online ?? false);
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
            Coach Approval Log
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.55, maxWidth: 560, lineHeight: 1.5 }}>
            Gated coach commands — launch, memory edits, and project switches — logged for Phase 4 operator trust.
          </p>
        </div>
        <button type="button" onClick={load} disabled={refreshing} style={btnStyle(false)}>
          <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

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
            Hard types: launch, launchProfile, setMemory, appendMemory, switchProject. Each successful or blocked execution appends one line to the JSONL log.
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

      <Section title="Approval events" caption={rows.length ? `Showing last ${rows.length} of ${data.count} total` : "No gated executions yet"}>
        {rows.length === 0 ? (
          <div style={{ padding: 16, borderRadius: 12, border: "1px solid rgba(255,176,66,0.2)", background: "rgba(255,176,66,0.06)", fontSize: 12, lineHeight: 1.55 }}>
            <strong style={{ color: "#ffb042" }}>No approvals logged yet.</strong> Ask the coach to launch a profile or edit memory — gated commands append here automatically.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["When", "Type", "Result", "Profile", "Project", "Error"].map((h) => (
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

  return (
    <tr>
      <td style={tdLeft}>{formatWhen(row.at)}</td>
      <td style={tdLeft}>
        <code style={{ fontSize: 11 }}>{typeLabel}</code>
      </td>
      <td style={tdLeft}>
        <span style={{ color: resultColor, fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>{resultLabel}</span>
      </td>
      <td style={tdLeft}>
        {row.profileId || "—"}
        {row.tier ? <span style={{ opacity: 0.45, marginLeft: 6 }}>({row.tier})</span> : null}
      </td>
      <td style={tdLeft}>{row.project || "—"}</td>
      <td style={{ ...tdLeft, opacity: 0.6, fontSize: 11, maxWidth: 240 }}>{row.error || "—"}</td>
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