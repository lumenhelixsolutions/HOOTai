import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCoach } from "@/context/CoachContext";
import CoachThread from "@/components/coach/CoachThread";
import { useCoachCommandExecute } from "@/lib/useCoachCommandExecute";
import { Bot, X, MessageCircle, ChevronRight } from "lucide-react";

function getApiKey(): string | null {
  return localStorage.getItem("agentdock_gemini_key") || localStorage.getItem("agentdock_api_key");
}

function getModelProvider(): string {
  return localStorage.getItem("agentdock_model_provider") || "auto";
}

const toneStyles = {
  tip: { border: "rgba(255,176,66,0.35)", bg: "rgba(255,176,66,0.12)", accent: "#ffb042" },
  warning: { border: "rgba(245,158,11,0.4)", bg: "rgba(245,158,11,0.1)", accent: "#fbbf24" },
  celebration: { border: "rgba(74,222,128,0.35)", bg: "rgba(74,222,128,0.1)", accent: "#4ade80" },
};

export default function HeadCoach() {
  const navigate = useNavigate();
  const { topHint, viewGuide, dismissHint, coachOpen, setCoachOpen, consumeChatPrompt, emitCoachAction, queueChatPrompt, coachSessionId } = useCoach();
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [composerPrompt, setComposerPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (topHint) setBubbleVisible(true);
  }, [topHint?.id]);

  useEffect(() => {
    const prompt = consumeChatPrompt();
    if (prompt) {
      setCoachOpen(true);
      setComposerPrompt(prompt);
    }
  }, [consumeChatPrompt, setCoachOpen]);

  const runAction = (action: { type: string; target?: string; prompt?: string }) => {
    if (action.type === "navigate" && action.target) {
      navigate(action.target);
      if (topHint) dismissHint(topHint.id);
      return;
    }
    if (action.type === "chat") {
      if (action.prompt) queueChatPrompt(action.prompt);
      else setCoachOpen(true);
      return;
    }
    if (action.type === "action" && action.target) {
      emitCoachAction(action.target);
      if (topHint) dismissHint(topHint.id);
      return;
    }
    if (action.type === "command" && action.target === "runScan") navigate("/scan");
  };

  const executeCmd = useCoachCommandExecute(emitCoachAction);

  const showBubble = topHint && bubbleVisible && !coachOpen;
  const tone = topHint ? toneStyles[topHint.tone] : toneStyles.tip;

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, maxWidth: 420 }}>
      {showBubble && topHint && (
        <div
          style={{
            position: "relative",
            width: 360,
            padding: "14px 16px",
            borderRadius: 14,
            border: `1px solid ${tone.border}`,
            background: `linear-gradient(145deg, ${tone.bg}, rgba(13,13,13,0.95))`,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            animation: "coachPop 0.35s ease-out",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: tone.accent, fontWeight: 600 }}>
              AI Coach{viewGuide ? ` · ${viewGuide.title}` : ""}
            </span>
            <button
              type="button"
              onClick={() => { setBubbleVisible(false); dismissHint(topHint.id); }}
              style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 11 }}
            >
              Not now
            </button>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55, color: "#f5f5f5" }}>{topHint.message}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topHint.actions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => runAction(a)}
                style={{
                  padding: "6px 12px", borderRadius: 8, border: `1px solid ${tone.border}`,
                  background: "rgba(0,0,0,0.25)", color: tone.accent, cursor: "pointer",
                  fontSize: 11, display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {a.label}
                <ChevronRight size={10} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setCoachOpen(true); setBubbleVisible(false); }}
              style={{
                padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "#dadada", cursor: "pointer", fontSize: 11,
              }}
            >
              Ask more
            </button>
          </div>
          <div
            style={{
              position: "absolute", bottom: -8, right: 28, width: 14, height: 14,
              background: tone.bg, borderRight: `1px solid ${tone.border}`, borderBottom: `1px solid ${tone.border}`,
              transform: "rotate(45deg)",
            }}
          />
        </div>
      )}

      {coachOpen && (
        <div
          style={{
            width: 400, height: 520, background: "#0d0d0d",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
            display: "flex", flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Bot size={18} color="#ffb042" />
              <span style={{ fontSize: 14, fontWeight: 500 }}>AI Coach</span>
              <span style={{
                fontSize: 10, padding: "2px 6px", borderRadius: 4,
                background: getApiKey() ? "rgba(74,222,128,0.1)" : "rgba(255,176,66,0.12)",
                color: getApiKey() ? "#4ade80" : "#ffb042",
              }}>
                {getApiKey() ? `${getModelProvider().toUpperCase()} + screen context` : "SCREEN-AWARE"}
              </span>
            </div>
            <button type="button" onClick={() => setCoachOpen(false)} style={{ background: "none", border: "none", color: "#dadada", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
          <CoachThread
            sessionId={coachSessionId}
            pendingPrompt={composerPrompt}
            onPromptConsumed={() => setComposerPrompt(null)}
            onCommand={executeCmd}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setCoachOpen(!coachOpen)}
        title="AI Coach"
        style={{
          width: 58, height: 58, borderRadius: "50%",
          background: showBubble ? `linear-gradient(135deg, ${tone.accent}, #e8a050)` : "linear-gradient(135deg, #c8966a, #e8a050)",
          border: showBubble ? `2px solid ${tone.accent}` : "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: showBubble ? `0 0 0 4px ${tone.bg}, 0 8px 32px rgba(232,160,80,0.35)` : "0 8px 32px rgba(232,160,80,0.3)",
        }}
      >
        {coachOpen ? <X size={22} color="#0a0a0a" /> : <MessageCircle size={24} color="#0a0a0a" />}
      </button>
      <style>{`@keyframes coachPop { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </div>
  );
}