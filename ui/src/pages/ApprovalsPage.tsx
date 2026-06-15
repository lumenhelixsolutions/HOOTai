import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
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

export default function ApprovalsPage() {
  const [data, setData] = useState<CoachApprovalsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { setPageContext } = useCoach();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const payload = await api.getCoachApprovals(50);
      setData(payload);
      setPageContext({
        approvalCount: payload.count,
        phase4Ready: payload.phase4Ready,
        approvalRecentOk: payload.rows.filter((r) => r.ok).length,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setPageContext]);

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

function ApprovalRow({ row }: { row: CoachApprovalEntry }) {
  const resultLabel = row.blocked ? "blocked" : row.ok ? "ok" : "failed";
  const resultColor = row.blocked ? "#fbbf24" : row.ok ? "#34d399" : "#f87171";

  return (
    <tr>
      <td style={tdLeft}>{formatWhen(row.at)}</td>
      <td style={tdLeft}>
        <code style={{ fontSize: 11 }}>{row.type}</code>
      </td>
      <td style={tdLeft}>
        <span style={{ color: resultColor, fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>{resultLabel}</span>
      </td>
      <td style={tdLeft}>{row.profileId || "—"}</td>
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