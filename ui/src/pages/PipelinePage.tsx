import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { useCoach } from "@/context/CoachContext";
import type { PipelineOverview } from "@/lib/pipeline-types";
import { useSessionPoll } from "@/hooks/useSessionPoll";

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

const statusColor: Record<string, string> = {
  done: "#4ade80",
  active: "#ffb042",
  blocked: "#f87171",
  proposed: "#9ca3af",
};

const bridgeStatusColor: Record<string, string> = {
  verified: "#4ade80",
  ready: "#ffb042",
  incomplete: "#f87171",
  unknown: "#9ca3af",
};

function ExcerptBlock({ text }: { text: string }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        borderRadius: 10,
        background: "rgba(0,0,0,0.25)",
        fontSize: 11,
        lineHeight: 1.45,
        overflow: "auto",
        maxHeight: 220,
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </pre>
  );
}

export default function PipelinePage() {
  const { setPageContext } = useCoach();
  const [data, setData] = useState<PipelineOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setRefreshing(true);
    try {
      setData(await api.getPortfolioPipeline(refresh));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useSessionPoll(() => load(true), { immediate: true });

  useEffect(() => {
    if (!data) return;
    const active = data.projects.find((p) => p.active);
    setPageContext({
      milestoneCount: data.milestones.length,
      activeProjectName: active?.name || data.active_project?.project.name || null,
    });
  }, [data, setPageContext]);

  if (loading) return <div style={{ opacity: 0.5, fontSize: 13 }}>Loading pipeline overview…</div>;
  if (!data) return <div style={{ opacity: 0.5, fontSize: 13 }}>Failed to load pipeline overview.</div>;

  const active = data.active_project;
  const activePipeline = data.projects.find((p) => p.active);
  const pipelineRepos = data.projects.filter((p) => p.pipeline_excerpt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1100 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontSize: 28, margin: 0, fontWeight: 400, color: "#f5e6d0" }}>
            Pipeline Overview
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.55, maxWidth: 620, lineHeight: 1.5 }}>
            Portfolio-wide milestones, cross-repo bridges, and project-brain freshness — complements per-repo Project Overview.
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11, opacity: 0.4 }}>
            Milestones {data.milestone_version || "—"} · {data.projects.length} repos · updated {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,176,66,0.35)",
            background: "rgba(255,176,66,0.1)",
            color: "#ffb042",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
          {refreshing ? "Refreshing…" : "Refresh registry"}
        </button>
      </header>

      {activePipeline?.pipeline_excerpt && (
        <Section
          title="Pipeline overview"
          caption={`Active repo · ${activePipeline.name} · wiki/pipeline-overview.md`}
        >
          <ExcerptBlock text={activePipeline.pipeline_excerpt} />
        </Section>
      )}

      {active && (
        <Section title="Project overview" caption={`Active repo · ${active.project.name} · project-brain current-state`}>
          <div style={{ display: "grid", gap: 12, fontSize: 12, lineHeight: 1.55 }}>
            <div style={{ opacity: 0.55, fontFamily: "monospace", fontSize: 11 }}>{active.project.path}</div>
            {active.brain.timestamp && (
              <div style={{ opacity: 0.5 }}>Brain timestamp: {active.brain.timestamp}</div>
            )}
            {active.next_best_move && (
              <div>
                <strong style={{ color: "#ffb042" }}>Next best move</strong>
                <p style={{ margin: "6px 0 0", opacity: 0.8, whiteSpace: "pre-wrap" }}>{active.next_best_move}</p>
              </div>
            )}
            {active.blockers && active.blockers !== "None for M9 close" && (
              <div>
                <strong>Blockers</strong>
                <p style={{ margin: "6px 0 0", opacity: 0.75, whiteSpace: "pre-wrap" }}>{active.blockers}</p>
              </div>
            )}
            {active.excerpt && <ExcerptBlock text={active.excerpt} />}
            {!active.brain.present && (
              <p style={{ margin: 0, opacity: 0.55 }}>No `.agentdock/project-brain/` yet — add current-state.md per portfolio convention.</p>
            )}
          </div>
        </Section>
      )}

      <Section title="Portfolio milestones" caption="From MILESTONES.md at portfolio root">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {data.milestones.map((m) => (
            <div
              key={m.id}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                minWidth: 180,
                flex: "1 1 180px",
              }}
            >
              <div style={{ fontSize: 10, opacity: 0.45 }}>M{m.id}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{m.name}</div>
              <div style={{ fontSize: 11, marginTop: 6, color: statusColor[m.status] || "#aaa" }}>{m.status}</div>
              <div style={{ fontSize: 10, opacity: 0.45, marginTop: 4 }}>{m.projects}</div>
            </div>
          ))}
        </div>
      </Section>

      {data.bridge_health?.length > 0 && (
        <Section title="Bridge health" caption="Automated checks for cross-repo data handoffs (M6 visual story)">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.bridge_health.map((b) => (
              <div
                key={b.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{b.label}</div>
                    <code style={{ fontSize: 10, opacity: 0.5 }}>{b.endpoint}</code>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: bridgeStatusColor[b.status] || "#aaa", textTransform: "uppercase" }}>
                    {b.status}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, fontSize: 11 }}>
                  <span style={{ padding: "4px 8px", borderRadius: 6, background: b.modules_ready ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)", color: b.modules_ready ? "#4ade80" : "#f87171" }}>
                    modules {b.modules_ready ? "✓" : "✗"}
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: 6, background: b.e2e_script ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)", color: b.e2e_script ? "#4ade80" : "#f87171" }}>
                    e2e script {b.e2e_script ? "✓" : "✗"}
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: 6, background: b.last_e2e?.ok ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)", color: b.last_e2e?.ok ? "#4ade80" : "#9ca3af" }}>
                    last e2e {b.last_e2e?.ok ? "✓" : b.last_e2e ? "✗" : "—"}
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: 6, background: b.cineforge_online ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)", color: b.cineforge_online ? "#4ade80" : "#9ca3af" }}>
                    cineforge {b.cineforge_online ? "online" : "offline"}
                  </span>
                </div>
                {b.last_e2e?.finished_at && (
                  <p style={{ margin: "10px 0 0", fontSize: 10, opacity: 0.45 }}>
                    Last run {new Date(b.last_e2e.finished_at).toLocaleString()}
                    {b.last_e2e.shot_count != null ? ` · ${b.last_e2e.shot_count} shots` : ""}
                    {b.last_e2e.pushed ? " · pushed" : ""}
                    {b.last_e2e.error ? ` · ${b.last_e2e.error}` : ""}
                  </p>
                )}
                {!b.last_e2e?.ok && (
                  <p style={{ margin: "10px 0 0", fontSize: 10, opacity: 0.45 }}>
                    Run <code>pwsh D:\projects\scripts\pipeline-visual-story.ps1</code> to verify the bridge.
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Cross-repo bridges" caption="Data and skill flows across the portfolio">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.bridges.map((b) => (
            <div
              key={`${b.from}-${b.to}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 12,
              }}
            >
              <div>
                <strong>{b.from}</strong>
                <span style={{ opacity: 0.45 }}> → </span>
                <strong>{b.to}</strong>
                <div style={{ marginTop: 4, opacity: 0.55 }}>{b.label}</div>
              </div>
              <code style={{ fontSize: 10, opacity: 0.5, alignSelf: "center" }}>{b.endpoint}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Phase 1 integration matrix" caption="RTK · MCP git · llama.cpp — from PIPELINE_INTEGRATIONS.md">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ opacity: 0.45, textAlign: "left" }}>
              {["Project", "RTK", "MCP", "llama.cpp", "Role"].map((h) => (
                <th key={h} style={{ padding: "8px 8px 8px 0", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.integration_matrix.map((row) => (
              <tr key={row.project} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "8px 8px 8px 0", fontWeight: 600 }}>{row.project}</td>
                <td style={{ padding: "8px 8px 8px 0" }}>{row.rtk}</td>
                <td style={{ padding: "8px 8px 8px 0" }}>{row.mcp}</td>
                <td style={{ padding: "8px 8px 8px 0" }}>{row.llamacpp}</td>
                <td style={{ padding: "8px 8px 8px 0", opacity: 0.55 }}>{row.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {pipelineRepos.length > 0 && (
        <Section title="Per-repo pipeline stages" caption="Excerpts from wiki/pipeline-overview.md where present">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {pipelineRepos.map((p) => (
              <div
                key={p.path}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: p.active ? "rgba(255,176,66,0.06)" : "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: p.active ? 600 : 500, marginBottom: 8 }}>
                  {p.name}
                  {p.active && <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.5 }}>active</span>}
                </div>
                <ExcerptBlock text={p.pipeline_excerpt!} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Repo brain status" caption="current-state.md timestamps · wiki/pipeline-overview.md where present">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ opacity: 0.45, textAlign: "left" }}>
              {["Repo", "Brain", "Pipeline wiki", "Timestamp", "Git"].map((h) => (
                <th key={h} style={{ padding: "8px 8px 8px 0", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.projects.map((p) => (
              <tr key={p.path} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: p.active ? "rgba(255,176,66,0.06)" : undefined }}>
                <td style={{ padding: "8px 8px 8px 0", fontWeight: p.active ? 600 : 400 }}>{p.name}</td>
                <td style={{ padding: "8px 8px 8px 0" }}>{p.brain.has_current_state ? "✓ state" : p.brain.present ? "partial" : "—"}</td>
                <td style={{ padding: "8px 8px 8px 0" }}>{p.brain.has_pipeline_overview ? "✓" : "—"}</td>
                <td style={{ padding: "8px 8px 8px 0", opacity: 0.55, fontSize: 11 }}>{p.brain.timestamp || "—"}</td>
                <td style={{ padding: "8px 8px 8px 0", opacity: 0.55 }}>{p.git?.clean ? "clean" : p.git?.present ? "dirty" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, opacity: 0.55 }}>
        <Workflow size={14} color="#ffb042" />
        Per-repo pipeline stages live in <code>.agentdock/project-brain/wiki/pipeline-overview.md</code> (lookBOOK, cineforge, etc.).
      </div>
    </div>
  );
}