import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import type { HootMood } from "@/lib/hoot-ascii";
import { formatHootError, hootStatusFromContext, resolveHootMoodFromContext } from "@/lib/hoot-ascii";
import { setHootErrorReporter } from "@/lib/hoot-bus";
import { isPageVisible } from "@/lib/perf";
import { productionFieldsFromRadar } from "@/lib/production-radar";
import { slimCoachPageContext } from "@/lib/coach-context-slim";

export type CoachAction = {
  label: string;
  type: "navigate" | "chat" | "action" | "command";
  target?: string;
  prompt?: string;
};

export type CoachHint = {
  id: string;
  priority: number;
  tone: "tip" | "warning" | "celebration";
  message: string;
  actions: CoachAction[];
};

export type ViewGuide = {
  title: string;
  group: string;
  summary: string;
  features: string[];
  orchestration: string;
  nextActions?: string[];
};

export type HootError = {
  id: string;
  message: string;
  source: string;
  fix?: string;
  at: number;
};

type CoachContextValue = {
  hints: CoachHint[];
  topHint: CoachHint | null;
  viewGuide: ViewGuide | null;
  currentView: string;
  loading: boolean;
  pageContext: Record<string, unknown>;
  setPageContext: (ctx: Record<string, unknown>) => void;
  dismissHint: (id: string) => void;
  dismissed: Set<string>;
  coachOpen: boolean;
  setCoachOpen: (open: boolean) => void;
  pendingChatPrompt: string | null;
  queueChatPrompt: (prompt: string) => void;
  consumeChatPrompt: () => string | null;
  registerActionHandler: (handler: (target: string) => void) => () => void;
  emitCoachAction: (target: string) => void;
  refreshHints: () => void;
  hootMood: HootMood;
  setHootMood: (mood: HootMood, options?: { ttl?: number }) => void;
  chatLoading: boolean;
  setChatLoading: (loading: boolean) => void;
  hootPinned: boolean;
  setHootPinned: (pinned: boolean) => void;
  hootError: HootError | null;
  reportError: (err: { message: string; source: string; fix?: string }) => void;
  clearHootError: () => void;
  hootStatus: string | null;
  setHootStatus: (status: string | null) => void;
  coachSessionId: string;
};

const CoachContext = createContext<CoachContextValue | null>(null);

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem("agentdock_coach_dismissed");
    if (!raw) return new Set();
    const { day, ids } = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (day !== today) return new Set();
    return new Set(ids || []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem("agentdock_coach_dismissed", JSON.stringify({ day: today, ids: [...set] }));
}

function ensureCoachSessionId() {
  const storageKey = "hoot_coach_session_id";
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = `ai-coach-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return `ai-coach-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [pageContext, setPageContextState] = useState<Record<string, unknown>>({});
  const [hints, setHints] = useState<CoachHint[]>([]);
  const [viewGuide, setViewGuide] = useState<ViewGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [coachOpen, setCoachOpen] = useState(false);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
  const [actionHandlers, setActionHandlers] = useState<Set<(t: string) => void>>(new Set());
  const [hootMoodOverride, setHootMoodOverride] = useState<HootMood | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [hootPinned, setHootPinnedState] = useState(() => localStorage.getItem("hoot_pinned") === "1");
  const [hootError, setHootError] = useState<HootError | null>(null);
  const [hootStatusManual, setHootStatusManual] = useState<string | null>(null);
  const moodTtlRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coachSessionId = useMemo(() => ensureCoachSessionId(), []);

  const setHootPinned = useCallback((pinned: boolean) => {
    setHootPinnedState(pinned);
    localStorage.setItem("hoot_pinned", pinned ? "1" : "0");
  }, []);

  const setHootMood = useCallback((mood: HootMood, options?: { ttl?: number }) => {
    if (moodTtlRef.current) {
      clearTimeout(moodTtlRef.current);
      moodTtlRef.current = null;
    }
    setHootMoodOverride(mood);
    if (options?.ttl) {
      moodTtlRef.current = setTimeout(() => {
        setHootMoodOverride(null);
        moodTtlRef.current = null;
      }, options.ttl);
    }
  }, []);

  const visibleHints = useMemo(() => hints.filter((h) => !dismissed.has(h.id)), [hints, dismissed]);
  const topHint = visibleHints[0] || null;

  const autoHootMood = useMemo(
    () =>
      resolveHootMoodFromContext({
        pathname: location.pathname,
        pageContext,
        hasError: Boolean(hootError),
        coachOpen,
        chatLoading,
        topHintTone: topHint?.tone || null,
        hasTopHint: Boolean(topHint),
      }),
    [location.pathname, pageContext, hootError, coachOpen, chatLoading, topHint],
  );

  const hootMood = hootMoodOverride ?? autoHootMood;

  const hootStatus = useMemo(
    () =>
      hootStatusManual ||
      hootStatusFromContext({
        pathname: location.pathname,
        pageContext,
        hasError: Boolean(hootError),
        coachOpen,
        chatLoading,
        topHintTone: topHint?.tone || null,
        hasTopHint: Boolean(topHint),
      }),
    [location.pathname, pageContext, hootError, coachOpen, chatLoading, topHint, hootStatusManual],
  );

  const setHootStatus = useCallback((status: string | null) => {
    setHootStatusManual(status);
  }, []);

  const pageContextRef = useRef(pageContext);
  pageContextRef.current = pageContext;

  const setPageContext = useCallback((ctx: Record<string, unknown>) => {
    setPageContextState((prev) => ({ ...prev, ...ctx }));
  }, []);

  const hintContextKey = useMemo(() => {
    const { radarLoading: _rl, agentRadarScannedAt: _at, ...rest } = pageContext;
    return JSON.stringify(rest);
  }, [pageContext]);

  const refreshHints = useCallback(() => {
    setLoading(true);
    api
      .getCoachHints(location.pathname, pageContextRef.current)
      .then((r) => {
        setHints((r.hints || []) as CoachHint[]);
        setViewGuide((r.guide as ViewGuide) || null);
      })
      .catch(() => { setHints([]); setViewGuide(null); })
      .finally(() => setLoading(false));
  }, [location.pathname]);

  useEffect(() => {
    setPageContextState({});
  }, [location.pathname]);

  useEffect(() => {
    const signal = pageContext.hootSignal as string | undefined;
    const at = Number(pageContext.hootSignalAt) || 0;
    const ttl = Number(pageContext.hootSignalTtl) || 0;
    if (!signal || !at || !ttl) return;
    const remaining = ttl - (Date.now() - at);
    const clear = () => {
      setPageContextState((prev) => {
        if (prev.hootSignal !== signal) return prev;
        const next = { ...prev };
        delete next.hootSignal;
        delete next.hootSignalAt;
        delete next.hootSignalTtl;
        return next;
      });
    };
    if (remaining <= 0) {
      clear();
      return;
    }
    const t = setTimeout(clear, remaining);
    return () => clearTimeout(t);
  }, [pageContext.hootSignal, pageContext.hootSignalAt, pageContext.hootSignalTtl]);

  useEffect(() => {
    const t = setTimeout(refreshHints, 400);
    return () => clearTimeout(t);
  }, [location.pathname, hintContextKey, refreshHints]);

  useEffect(() => {
    if (!coachOpen) return;
    const sessionId = coachSessionId;
    const syncContext = () => {
      if (!isPageVisible()) return;
      const slim = slimCoachPageContext(location.pathname, pageContextRef.current);
      api.refreshCoachContext(sessionId, location.pathname, slim).catch(() => {});
    };
    syncContext();
    const id = setInterval(syncContext, 60000);
    return () => clearInterval(id);
  }, [coachOpen, location.pathname, coachSessionId]);

  const prevExternalRef = useRef<number | null>(null);
  const handoffSuggestedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const poll = (force = false) => {
      if (!force && !isPageVisible()) return;
      if (force) setPageContextState((prev) => ({ ...prev, radarLoading: true }));
      api
        .getAgentRadar(force)
        .then((radar) => {
          if (cancelled) return;
          const total = radar.summary?.total ?? 0;
          const dock = radar.summary?.dock ?? 0;
          const external = radar.summary?.external ?? 0;
          const grokFields = productionFieldsFromRadar(radar);
          const prevExternal = prevExternalRef.current;
          if (prevExternal != null && prevExternal > 0 && external === 0 && !handoffSuggestedRef.current) {
            handoffSuggestedRef.current = true;
            setPendingChatPrompt("External agent session ended — generate a handoff packet before switching providers?");
            setCoachOpen(true);
          }
          prevExternalRef.current = external;
          setPageContextState((prev) => {
            if (
              !force &&
              prev.agentRadarTotal === total &&
              prev.agentRadarDock === dock &&
              prev.agentRadarExternal === external &&
              prev.productionSessionActive === grokFields.productionSessionActive &&
              prev.productionEstContextTokens === grokFields.productionEstContextTokens &&
              prev.productionAgentId === grokFields.productionAgentId
            ) {
              return prev.radarLoading ? { ...prev, radarLoading: false } : prev;
            }
            return {
              ...prev,
              radarLoading: false,
              agentRadarTotal: total,
              agentRadarDock: dock,
              agentRadarExternal: external,
              agentRadarAgents: radar.agents ?? [],
              agentRadarScannedAt: radar.scanned_at,
              ...grokFields,
            };
          });
        })
        .catch(() => {
          if (!cancelled) setPageContextState((prev) => (prev.radarLoading ? { ...prev, radarLoading: false } : prev));
        });
    };
    const bootTimer = setTimeout(() => poll(), 3000);
    const id = setInterval(() => poll(), 20000);
    const onVisible = () => poll(true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(bootTimer);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [location.pathname]);

  const queueChatPrompt = useCallback((prompt: string) => {
    setPendingChatPrompt(prompt);
    setCoachOpen(true);
    setHootMoodOverride(null);
  }, []);

  const dismissHint = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const consumeChatPrompt = useCallback(() => {
    const p = pendingChatPrompt;
    setPendingChatPrompt(null);
    return p;
  }, [pendingChatPrompt]);

  const registerActionHandler = useCallback((handler: (target: string) => void) => {
    setActionHandlers((prev) => new Set(prev).add(handler));
    return () => {
      setActionHandlers((prev) => {
        const next = new Set(prev);
        next.delete(handler);
        return next;
      });
    };
  }, []);

  const emitCoachAction = useCallback((target: string) => {
    actionHandlers.forEach((h) => h(target));
  }, [actionHandlers]);

  const reportError = useCallback((err: { message: string; source: string; fix?: string }) => {
    const entry: HootError = {
      id: `err-${Date.now()}`,
      message: err.message,
      source: err.source,
      fix: err.fix,
      at: Date.now(),
    };
    setHootError(entry);
    setHootMoodOverride("error");
    setHootStatusManual(formatHootError(err.message, err.source));
    setCoachOpen(true);
    queueChatPrompt(
      err.fix
        ? `HOOT — I hit an error during ${err.source}: ${err.message.slice(0, 300)}. ${err.fix}`
        : `HOOT — help me fix this ${err.source} error: ${err.message.slice(0, 300)}`,
    );
  }, [queueChatPrompt]);

  const clearHootError = useCallback(() => {
    setHootError(null);
    setHootStatusManual(null);
    setHootMoodOverride(null);
  }, []);

  useEffect(() => {
    setHootErrorReporter(reportError);
    return () => setHootErrorReporter(null);
  }, [reportError]);

  const value: CoachContextValue = {
    hints: visibleHints,
    topHint,
    viewGuide,
    currentView: location.pathname,
    loading,
    pageContext,
    setPageContext,
    dismissHint,
    dismissed,
    coachOpen,
    setCoachOpen,
    pendingChatPrompt,
    queueChatPrompt,
    consumeChatPrompt,
    registerActionHandler,
    emitCoachAction,
    refreshHints,
    hootMood,
    setHootMood,
    chatLoading,
    setChatLoading,
    hootPinned,
    setHootPinned,
    hootError,
    reportError,
    clearHootError,
    hootStatus,
    setHootStatus,
    coachSessionId,
  };

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoach() {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error("useCoach must be used within CoachProvider");
  return ctx;
}