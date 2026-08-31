import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { ActivitySessionGroup } from "@/lib/activity-types";

function outcomeColor(outcome: string | null) {
  if (outcome === "success") return "#4ade80";
  if (outcome === "failure") return "#fb923c";
  return "#888";
}

function projectLabel(project: string | null) {
  if (!project) return null;
  return String(project).split(/[/\\]/).pop() || project;
}

export default function ActivitySessionCards({
  groups,
  filterDate,
}: {
  groups: ActivitySessionGroup[];
  filterDate: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = filterDate
    ? groups.filter((g) => g.started_at?.startsWith(filterDate) || g.ended_at?.startsWith(filterDate))
    : groups;

  if (filtered.length === 0) {
    return (
      <div style={{ fontSize: 12, opacity: 0.5 }}>
        {filterDate ? `No grouped sessions on ${filterDate}.` : "Launch from Terminal or run an external agent to build session history."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map((g) => {
        const open = expanded === g.id;
        const mins = g.duration_ms ? Math.round(g.duration_ms / 60000) : null;
        const proj = projectLabel(g.project);
        return (
          <div
            key={g.id}
            style={{
              borderRadius: 10,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setExpanded(open ? null : g.id)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{g.agent_name || "Unknown agent"}</span>
                  <span style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.45 }}>
                    {g.kind === "hoot" ? "H00T launch" : g.source === "agentdock" ? "Dock" : "External"}
                  </span>
                  {g.running && (
                    <span style={{ fontSize: 9, color: "#4ade80", letterSpacing: "0.08em", textTransform: "uppercase" }}>running</span>
                  )}
                  {g.outcome && (
                    <span style={{ fontSize: 9, color: outcomeColor(g.outcome), letterSpacing: "0.08em", textTransform: "uppercase" }}>{g.outcome}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4, marginLeft: 22 }}>
                  {g.started_at ? `${g.started_at.slice(11, 16)}` : "—"}
                  {g.ended_at ? ` → ${g.ended_at.slice(11, 16)}` : g.running ? " → now" : ""}
                  {mins != null ? ` · ${mins}m` : ""}
                  {proj ? ` · ${proj}` : ""}
                </div>
                {g.sparkline.length > 1 && (
                  <div style={{ display: "flex", gap: 2, marginTop: 8, marginLeft: 22 }}>
                    {g.sparkline.map((_, i) => (
                      <div key={i} style={{ width: 6, height: 10, borderRadius: 2, background: "rgba(255,176,66,0.35)" }} />
                    ))}
                  </div>
                )}
              </div>
              {g.session_ref && g.kind === "hoot" && (
                <Link
                  to={`/terminal?session=${encodeURIComponent(g.session_ref)}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#ffb042", textDecoration: "none", flexShrink: 0 }}
                >
                  <ExternalLink size={12} />
                  Session
                </Link>
              )}
            </button>
            {open && g.events.length > 0 && (
              <div style={{ padding: "0 14px 12px 36px", display: "flex", flexDirection: "column", gap: 4 }}>
                {g.events.map((ev) => (
                  <div key={ev.id} style={{ fontSize: 11, opacity: 0.55 }}>
                    {ev.at.slice(11, 16)} — {ev.type.replace(/\./g, " · ")}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}