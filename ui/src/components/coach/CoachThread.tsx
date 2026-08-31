import { useEffect, useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { Send, Sparkles, User, Wrench } from "lucide-react";
import { useAgentDockRuntime, type AgentDockChatMessage } from "@/lib/useAgentDockRuntime";
import { useCoach } from "@/context/CoachContext";
import CoachMarkdown from "./CoachMarkdown";
import {
  coachCommandLabel,
  coachConfirmLevel,
} from "@/lib/coach-command-policy";

const panelStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  minHeight: 0,
};

const viewportStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

function CoachCommandList({
  commands,
  onCommand,
}: {
  commands: Array<Record<string, unknown>>;
  onCommand: (cmd: Record<string, unknown>) => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-[10px] border border-[rgba(255,176,66,0.25)] bg-[rgba(255,176,66,0.06)] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--hoot-gold)]">
        Executive actions · HITL
      </div>
      <p className="m-0 text-[11px] leading-snug opacity-65">
        Opens the global approval sheet. Nothing mutates until you Approve.
      </p>
      {commands.map((cmd, i) => {
        const level = coachConfirmLevel(cmd);
        const hard = level === "hard";
        return (
          <button
            key={i}
            type="button"
            onClick={() => onCommand(cmd)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-xs font-medium"
            style={{
              borderColor: hard ? "rgba(239,68,68,0.4)" : "rgba(255,176,66,0.35)",
              background: hard ? "rgba(239,68,68,0.1)" : "rgba(255,176,66,0.12)",
              color: hard ? "#f87171" : "#ffb042",
            }}
          >
            <Wrench size={12} />
            <span className="flex-1">{coachCommandLabel(cmd)}</span>
            <span className="text-[10px] opacity-75">{level === "auto" ? "Run" : "Review"}</span>
          </button>
        );
      })}
    </div>
  );
}

function CoachMessageRow({
  isUser,
  source,
  commands,
  onCommand,
}: {
  isUser: boolean;
  source?: string;
  commands?: Array<Record<string, unknown>>;
  onCommand?: (cmd: Record<string, unknown>) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexDirection: isUser ? "row-reverse" : "row" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: isUser ? "rgba(255,255,255,0.08)" : "rgba(255,176,66,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isUser ? <User size={14} /> : <Sparkles size={14} color="#ffb042" />}
      </div>
      <div style={{ maxWidth: "82%" }}>
        {!isUser && source && (
          <span
            style={{
              fontSize: 10,
              opacity: 0.55,
              display: "block",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {source === "coach-local" ? "Screen-aware coach" : source}
          </span>
        )}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: isUser ? "rgba(255,255,255,0.06)" : "rgba(255,176,66,0.06)",
            border: `1px solid ${isUser ? "rgba(255,255,255,0.08)" : "rgba(255,176,66,0.15)"}`,
            fontSize: 13,
            lineHeight: 1.5,
            color: "#f5f5f5",
          }}
        >
          <MessagePrimitive.Root>
            <MessagePrimitive.Parts
              components={isUser ? undefined : { Text: CoachMarkdown }}
            />
          </MessagePrimitive.Root>
        </div>
        {commands && commands.length > 0 && onCommand && (
          <CoachCommandList commands={commands} onCommand={onCommand} />
        )}
      </div>
    </div>
  );
}

function QuickReplies({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: string[];
  disabled?: boolean;
  onPick: (text: string) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div
      style={{
        padding: "8px 16px 0",
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {suggestions.slice(0, 4).map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          style={{
            padding: "5px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.03)",
            color: "#dadada",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: 11,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function CoachThreadInner({
  sessionId,
  seed,
  pendingPrompt,
  onPromptConsumed,
  onCommand,
}: {
  sessionId: string;
  seed: AgentDockChatMessage[];
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
  onCommand?: (cmd: Record<string, unknown>) => void;
}) {
  const { currentView, pageContext, viewGuide, setChatLoading } = useCoach();
  const { runtime, messages, isRunning, sendText } = useAgentDockRuntime(sessionId, seed, {
    coachView: currentView,
    pageContext,
  });

  useEffect(() => {
    setChatLoading(isRunning);
  }, [isRunning, setChatLoading]);

  useEffect(() => {
    if (!pendingPrompt?.trim() || isRunning) return;
    sendText(pendingPrompt);
    onPromptConsumed?.();
  }, [pendingPrompt, onPromptConsumed, sendText, isRunning]);

  const quickSuggestions = [
    ...(viewGuide?.nextActions || []),
    "What should I do on this screen?",
    "Walk me through the operator loop",
  ].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root style={panelStyle}>
        <ThreadPrimitive.Viewport style={viewportStyle}>
          <ThreadPrimitive.Messages>
            {({ message }) => {
              const dock = messages.find((m) => m.id === message.id);
              const isUser = message.role === "user";
              return (
                <CoachMessageRow
                  isUser={isUser}
                  source={dock?.source}
                  commands={dock?.commands}
                  onCommand={onCommand}
                />
              );
            }}
          </ThreadPrimitive.Messages>
          {isRunning && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: 0.6, fontSize: 12 }}>
              <Sparkles size={12} color="#ffb042" />
              Thinking…
            </div>
          )}
        </ThreadPrimitive.Viewport>
        <QuickReplies suggestions={quickSuggestions} disabled={isRunning} onPick={sendText} />
        <ComposerPrimitive.Root
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <ComposerPrimitive.Input
            data-coach-composer
            placeholder={`Ask about ${viewGuide?.title || "this screen"}…`}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "#f5f5f5",
              fontSize: 13,
              outline: "none",
              resize: "none",
              minHeight: 40,
            }}
          />
          <ComposerPrimitive.Send asChild>
            <button
              type="button"
              disabled={isRunning}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #c8966a, #e8a050)",
                color: "#0a0a0a",
                cursor: isRunning ? "not-allowed" : "pointer",
                opacity: isRunning ? 0.6 : 1,
              }}
            >
              <Send size={16} />
            </button>
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

export default function CoachThread(props: {
  sessionId: string;
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
  onCommand?: (cmd: Record<string, unknown>) => void;
}) {
  const seed: AgentDockChatMessage[] = [
    {
      id: "welcome",
      role: "assistant",
      text: "Hoot! I'm **HOOT** — My Ops OWL. I watch your machine, catch errors, and help you scan, build stacks, and launch. Ask me anything.",
      source: "coach-local",
    },
  ];

  return (
    <CoachThreadInner
      sessionId={props.sessionId}
      seed={seed}
      pendingPrompt={props.pendingPrompt}
      onPromptConsumed={props.onPromptConsumed}
      onCommand={props.onCommand}
    />
  );
}