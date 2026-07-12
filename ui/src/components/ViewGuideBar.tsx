import { Link, useLocation } from "react-router-dom";
import { ArrowRight, BookText, Route } from "lucide-react";
import { getViewDoc, ORCHESTRATION_STEPS } from "@/lib/app-docs";
import HelpTooltip from "./HelpTooltip";
import { useCoach } from "@/context/CoachContext";

export default function ViewGuideBar() {
  const location = useLocation();
  const doc = getViewDoc(location.pathname);
  const { queueChatPrompt } = useCoach();
  const stepIndex = ORCHESTRATION_STEPS.findIndex((s) => s.path === location.pathname);

  return (
    <div
      style={{
        marginBottom: 20,
        padding: "16px 18px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "linear-gradient(135deg, rgba(255,176,66,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Route size={14} color="#ffb042" />
            <span style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,211,154,0.75)" }}>
              {doc.group} · Screen guide
            </span>
            <HelpTooltip title={doc.title} body={doc.summary} features={doc.features} orchestration={doc.orchestration} tips={doc.tips} />
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(245,245,245,0.82)" }}>{doc.summary}</div>
          <div style={{ fontSize: 12, marginTop: 8, color: "rgba(236,232,225,0.55)", lineHeight: 1.5 }}>
            <strong style={{ color: "rgba(255,211,154,0.8)", fontWeight: 500 }}>Orchestration:</strong> {doc.orchestration}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => queueChatPrompt(`I'm on ${doc.title}. What should I do on this screen right now, and what's next in the operator loop?`)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,176,66,0.3)",
              background: "rgba(255,176,66,0.1)",
              color: "#ffb042",
              cursor: "pointer",
              fontSize: 12,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Ask HOOT <ArrowRight size={12} />
          </button>
          <Link
            to="/docs"
            title="Open bundled operator guides and implementation plans"
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(236,232,225,0.75)",
              textDecoration: "none",
              fontSize: 12,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <BookText size={12} /> Docs
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {ORCHESTRATION_STEPS.map((step, i) => {
          const active = step.path === location.pathname;
          const done = stepIndex >= 0 && i < stepIndex;
          return (
            <Link
              key={step.path}
              to={step.path}
              title={doc.tips[i] || step.label}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                textDecoration: "none",
                fontSize: 11,
                border: `1px solid ${active ? "rgba(255,176,66,0.4)" : done ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.08)"}`,
                background: active ? "rgba(255,176,66,0.12)" : done ? "rgba(74,222,128,0.06)" : "transparent",
                color: active ? "#ffb042" : done ? "#86efac" : "rgba(236,232,225,0.55)",
              }}
            >
              {i + 1}. {step.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}