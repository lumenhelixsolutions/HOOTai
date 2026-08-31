import { useCallback, useMemo, useRef, useState } from "react";
import type { AppendMessage, ExternalStoreAdapter, ThreadMessageLike } from "@assistant-ui/core";
import { useExternalStoreRuntime } from "@assistant-ui/react";
import { api } from "@/lib/api";
import { slimCoachPageContext } from "@/lib/coach-context-slim";
import { wantsLiveCoachContext } from "@/lib/coach-context-intent";
import { useExecutiveControlOptional } from "@/context/ExecutiveControlContext";

export type AgentDockChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  commands?: Array<Record<string, unknown>>;
  source?: string;
};

function getModelProvider(): string | undefined {
  const p = localStorage.getItem("agentdock_model_provider") || "auto";
  return p === "auto" ? undefined : p;
}

/** Browser override — only sent when user explicitly chose a cloud provider. */
function getApiKeyOverride(): string | undefined {
  const provider = localStorage.getItem("agentdock_model_provider") || "auto";
  if (provider === "auto" || provider === "ollama" || provider === "llamacpp" || provider === "lmstudio" || provider === "lm-studio" || provider === "coach-local") {
    return undefined;
  }
  const key = (localStorage.getItem("agentdock_gemini_key") || localStorage.getItem("agentdock_api_key") || "").trim();
  return key || undefined;
}

function extractText(message: AppendMessage): string {
  return message.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

function toThreadLike(msg: AgentDockChatMessage): ThreadMessageLike {
  return {
    id: msg.id,
    role: msg.role,
    content: [{ type: "text", text: msg.text }],
    metadata: { custom: { commands: msg.commands || [], source: msg.source } },
  };
}

export function useAgentDockRuntime(
  sessionId: string,
  seed: AgentDockChatMessage[],
  coachContext?: { coachView?: string; pageContext?: Record<string, unknown> },
  onCommands?: (commands: Array<Record<string, unknown>> | null) => void,
) {
  const [messages, setMessages] = useState<AgentDockChatMessage[]>(seed);
  const [isRunning, setIsRunning] = useState(false);
  const idRef = useRef(0);
  const nextId = () => `msg-${++idRef.current}`;
  const executive = useExecutiveControlOptional();

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isRunning) return;
      const userMsg: AgentDockChatMessage = { id: nextId(), role: "user", text: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setIsRunning(true);
      onCommands?.(null);
      try {
        const provider = getModelProvider();
        const apiKey = getApiKeyOverride();
        const view = coachContext?.coachView || "/";
        const slimContext = slimCoachPageContext(view, coachContext?.pageContext || {});
        const contextMode = wantsLiveCoachContext(trimmed) ? "full" : "minimal";
        const res = await api.chat(sessionId, trimmed, {
          ...(provider ? { provider } : {}),
          ...(apiKey ? { apiKey } : {}),
          customEndpoint: localStorage.getItem("agentdock_custom_endpoint") || undefined,
          coachView: view,
          pageContext: slimContext,
          contextMode,
        });
        // Merge JSON commands + any tool-loop HITL proposals into one approve list
        const commands = Array.isArray(res.commands) ? res.commands : [];
        const fromTools = Array.isArray(res.toolRuns)
          ? res.toolRuns
              .filter((t: { proposed?: boolean; command?: Record<string, unknown> }) => t?.proposed && t?.command)
              .map((t: { command: Record<string, unknown> }) => t.command)
          : [];
        const merged = [...commands];
        for (const c of fromTools) {
          if (!c?.type) continue;
          if (!merged.some((m) => m.type === c.type && m.route === c.route && m.profileId === c.profileId && m.target === c.target)) {
            merged.push(c);
          }
        }
        // Global HITL queue — survives navigation away from coach
        if (merged.length && executive) {
          executive.enqueue(merged, "coach-chat");
        }
        const aiMsg: AgentDockChatMessage = {
          id: nextId(),
          role: "assistant",
          text: res.text || "...",
          commands: merged,
          source: res.source,
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (merged.length) onCommands?.(merged);
      } catch (e: unknown) {
        const err = e instanceof Error ? e.message : "Chat failed";
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: `⚠️ ${err}`, source: "error" }]);
      } finally {
        setIsRunning(false);
      }
    },
    [sessionId, isRunning, onCommands, coachContext?.coachView, coachContext?.pageContext, executive],
  );

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const text = extractText(message);
      await sendText(text);
    },
    [sendText],
  );

  const adapter = useMemo<ExternalStoreAdapter<AgentDockChatMessage>>(
    () => ({
      messages,
      isRunning,
      convertMessage: toThreadLike,
      onNew,
      setMessages,
    }),
    [messages, isRunning, onNew],
  );

  const runtime = useExternalStoreRuntime(adapter);
  return { runtime, messages, setMessages, isRunning, sendText };
}