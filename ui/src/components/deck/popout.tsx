import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  MessageCircle,
  Minimize2,
  X,
} from "lucide-react";
import {
  type CooldownRegistry,
  type ProviderRow,
  PROVIDER_ORDER,
  gaugeState,
  liveRemaining,
  formatClock,
} from "@/lib/cooldown";
import { useCooldownRegistry } from "@/hooks/useCooldownRegistry";
import { useCoach } from "@/context/CoachContext";
import CoachThread from "@/components/coach/CoachThread";
import HootOwl from '@/components/h00t/H00tOwl';
import HootLogo from '@/lib/h00t-logo';
import { readStoredHootFaceStyle } from '@/lib/h00t-face-styles';
import { TooltipPortalProvider, pipOverlayPortal } from "@/components/TooltipPortalContext";
import { useCoachCommandExecute } from "@/lib/useCoachCommandExecute";
import { BRAND } from "@/lib/brand";
import CooldownBarCore from "./CooldownBarCore";
import CompactDeckStats from "./CompactDeckStats";
import CompactPopoutRadar from "./CompactPopoutRadar";
import { DeckSurfaceMenu, ProviderDialMenu, type DeckMenuPosition } from "./DeckMenus";
import PopoutRadarTelemetry from "./PopoutRadarTelemetry";
import MatrixTicker from "./MatrixTicker";
import ProviderGauge from "./ProviderGauge";
import RecoveryTimeline from "./RecoveryTimeline";
import TelemetryHealth from "./TelemetryHealth";
import HoverTip from "@/components/HoverTip";
import { tooltipTitle } from "@/lib/tooltips";
import { api } from "@/lib/api";

/**
 * Floating always-on-top monitor. Uses Document Picture-in-Picture on Chromium
 * so the deck stays above every OS window. Falls back to a regular popup elsewhere.
 */

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
    };
  }
}

const DECK_SESSION_ID = "hoot-deck-" + Math.random().toString(36).slice(2, 8);

export type DeckPopoutView = "compact" | "full";

const POPOUT_SIZE = {
  compact: { w: 680, h: 204 },
  compactChat: { w: 680, h: 500 },
  full: { w: 1080, h: 860 },
  fullChat: { w: 1080, h: 1000 },
} as const;

type PopoutMenuState =
  | { kind: "surface"; position: DeckMenuPosition }
  | { kind: "provider"; position: DeckMenuPosition; providerId: string; row: ProviderRow }
  | null;

type DeckPopoutContextValue = {
  pipWindow: Window | null;
  viewMode: DeckPopoutView;
  chatExpanded: boolean;
  toggle: () => Promise<void>;
  close: () => void;
  expandDeck: () => void;
  collapseDeck: () => void;
  setChatExpanded: (value: boolean | ((prev: boolean) => boolean)) => void;
};

const DeckPopoutContext = createContext<DeckPopoutContextValue | null>(null);

function copyStylesInto(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      const style = target.createElement("style");
      style.textContent = css;
      target.head.appendChild(style);
    } catch {
      const owner = sheet.ownerNode;
      if (owner instanceof HTMLLinkElement && owner.href) {
        const link = target.createElement("link");
        link.rel = "stylesheet";
        link.href = owner.href;
        target.head.appendChild(link);
      }
    }
  }
  target.documentElement.className = document.documentElement.className;
  target.documentElement.style.background = "transparent";
  target.body.style.margin = "0";
  target.body.style.background = "transparent";
  target.body.style.overflow = "visible";
}

function resizePopoutWindow(win: Window, viewMode: DeckPopoutView, chatExpanded: boolean) {
  const size =
    viewMode === "full"
      ? chatExpanded
        ? POPOUT_SIZE.fullChat
        : POPOUT_SIZE.full
      : chatExpanded
        ? POPOUT_SIZE.compactChat
        : POPOUT_SIZE.compact;
  try {
    win.resizeTo(size.w, size.h);
  } catch {
    /* PiP or cross-origin may block resize */
  }
}

export function DeckPopoutProvider({ children }: { children: ReactNode }) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [viewMode, setViewMode] = useState<DeckPopoutView>("compact");
  const [chatExpanded, setChatExpanded] = useState(false);
  const winRef = useRef<Window | null>(null);
  winRef.current = pipWindow;

  const close = useCallback(() => {
    try {
      winRef.current?.close();
    } catch {
      /* already gone */
    }
    setPipWindow(null);
    setViewMode("compact");
    setChatExpanded(false);
  }, []);

  const toggle = useCallback(async () => {
    if (winRef.current && !winRef.current.closed) {
      close();
      return;
    }
    let win: Window | null = null;
    try {
      if (window.documentPictureInPicture?.requestWindow) {
        win = await window.documentPictureInPicture.requestWindow({
          width: POPOUT_SIZE.compact.w,
          height: POPOUT_SIZE.compact.h,
        });
      }
    } catch {
      /* user dismissed or unsupported */
    }
    if (!win) {
      win = window.open(
        "",
        "hoot-cooldown-deck",
        `popup=yes,width=${POPOUT_SIZE.compact.w},height=${POPOUT_SIZE.compact.h}`,
      );
    }
    if (!win) return;
    copyStylesInto(win.document);
    win.document.title = "HOOT · Cooldown Deck";
    win.addEventListener("pagehide", () => {
      setPipWindow(null);
      setViewMode("compact");
      setChatExpanded(false);
    });
    setViewMode("compact");
    setChatExpanded(false);
    setPipWindow(win);
  }, [close]);

  const expandDeck = useCallback(() => {
    setViewMode("full");
    if (winRef.current && !winRef.current.closed) {
      resizePopoutWindow(winRef.current, "full", chatExpanded);
    }
  }, [chatExpanded]);

  const collapseDeck = useCallback(() => {
    setViewMode("compact");
    setChatExpanded(false);
    if (winRef.current && !winRef.current.closed) {
      resizePopoutWindow(winRef.current, "compact", false);
    }
  }, []);

  useEffect(() => {
    const onUnload = () => winRef.current?.close();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  useEffect(() => {
    const onDeckPopout = () => {
      void toggle();
    };
    window.addEventListener("hoot:open-deck-popout", onDeckPopout);
    return () => window.removeEventListener("hoot:open-deck-popout", onDeckPopout);
  }, [toggle]);

  const value = useMemo<DeckPopoutContextValue>(
    () => ({
      pipWindow,
      viewMode,
      chatExpanded,
      toggle,
      close,
      expandDeck,
      collapseDeck,
      setChatExpanded,
    }),
    [pipWindow, viewMode, chatExpanded, toggle, close, expandDeck, collapseDeck],
  );

  return (
    <DeckPopoutContext.Provider value={value}>
      {children}
      <DeckPopoutPortal />
    </DeckPopoutContext.Provider>
  );
}

export function useDeckPopout() {
  const ctx = useContext(DeckPopoutContext);
  if (!ctx) throw new Error("useDeckPopout must be used within DeckPopoutProvider");
  return ctx;
}

function DeckPopoutPortal() {
  const { pipWindow } = useDeckPopout();
  const { registry, nowMs, patch, reload, applyRegistry } = useCooldownRegistry();
  if (!pipWindow || !registry) return null;
  return (
    <PopoutSurface
      pipWindow={pipWindow}
      registry={registry}
      nowMs={nowMs}
      patch={patch}
      reload={reload}
      applyRegistry={applyRegistry}
    />
  );
}

/** Floating monitor rendered inside the PiP/popup window via portal (shares app state). */
export function PopoutSurface({
  pipWindow,
  registry,
  nowMs,
  patch,
  reload,
  applyRegistry,
}: {
  pipWindow: Window;
  registry: CooldownRegistry;
  nowMs: number;
  patch: ReturnType<typeof useCooldownRegistry>["patch"];
  reload: ReturnType<typeof useCooldownRegistry>["reload"];
  applyRegistry: ReturnType<typeof useCooldownRegistry>["applyRegistry"];
}) {
  const { viewMode, chatExpanded, expandDeck, collapseDeck, setChatExpanded, close } = useDeckPopout();
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<PopoutMenuState>(null);
  const { hootMood, hootStatus, setHootStatus, pageContext, chatLoading, topHint } = useCoach();
  const body = pipWindow.document.body;

  const hootMoodContext = useMemo(
    () => ({
      pathname: location.pathname,
      pageContext,
      hasError: false,
      coachOpen: chatExpanded,
      chatLoading,
      topHintTone: topHint?.tone || null,
      hasTopHint: Boolean(topHint),
    }),
    [location.pathname, pageContext, chatExpanded, chatLoading, topHint],
  );

  useEffect(() => {
    resizePopoutWindow(pipWindow, viewMode, chatExpanded);
  }, [pipWindow, viewMode, chatExpanded]);

  const executeCmd = useCoachCommandExecute(undefined, { onStatus: setHootStatus });
  const menuContainer = pipWindow.document.body;
  const overlayPortal = useMemo(() => pipOverlayPortal(pipWindow), [pipWindow]);
  const faceStyle = readStoredHootFaceStyle("grand");

  const openCoach = useCallback(() => {
    setChatExpanded(true);
    window.dispatchEvent(new CustomEvent("hoot:open-coach"));
  }, [setChatExpanded]);

  const openSurfaceMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenu({ kind: "surface", position: { x: e.clientX, y: e.clientY } });
  };

  const openProviderMenu = (e: MouseEvent, providerId: string, row: ProviderRow) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ kind: "provider", position: { x: e.clientX, y: e.clientY }, providerId, row });
  };

  const copyMatrix = async () => {
    const session = registry.current_session_provider ? `\nSESSION: ${registry.current_session_provider}` : "";
    await navigator.clipboard.writeText(`${registry.matrix_line || ""}${session}`);
  };

  const copyStatusReport = async () => {
    const lines = [registry.matrix_line || ""];
    if (registry.current_session_provider) lines.push(`SESSION: ${registry.current_session_provider}`);
    for (const id of PROVIDER_ORDER) {
      const row = registry.providers?.[id];
      if (!row) continue;
      const state = gaugeState(row);
      const remaining = liveRemaining(row, nowMs);
      lines.push(
        `${row.label || id}: ${state}${remaining !== null ? ` · ${formatClock(remaining)}` : ""}`,
      );
    }
    await navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
  };

  const syncTelemetry = async (importFromDisk: boolean) => {
    try {
      const result = await api.syncTelemetry(importFromDisk);
      if (result.registry) applyRegistry(result.registry);
      else await reload();
    } catch {
      /* toast-free monitor */
    }
  };

  const fullHeader = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">
          HOOT · Command Deck
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <HoverTip id="deck.popout.collapse">
          <button
            type="button"
            onClick={collapseDeck}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] opacity-70 transition hover:opacity-100"
          >
            <Minimize2 size={12} />
            Bar
          </button>
        </HoverTip>
        <HoverTip id={chatExpanded ? "deck.chat.collapse" : "deck.chat.expand"}>
          <button
            type="button"
            onClick={() => setChatExpanded((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] transition ${
              chatExpanded ? "hoot-gold-chip" : "border-border opacity-60 hover:opacity-100"
            }`}
          >
            <MessageCircle size={12} />
            {chatExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </HoverTip>
      </div>
    </div>
  );

  const compactMonitor = (
    <div
      className="hoot-deck-float-shell space-y-1.5"
      onContextMenu={openSurfaceMenu}
      title="Right-click for monitor options"
    >
      <div className="hoot-deck-float-bar flex items-center gap-2.5 rounded-2xl px-2.5 py-2">
        <HoverTip id="shell.hoot.float" placement="below">
          <button
            type="button"
            onClick={openCoach}
            className="shrink-0 rounded-xl border-0 bg-transparent p-0 transition hover:opacity-90"
            aria-label="Ask HOOT"
          >
            <HootLogo
              mood={hootMood}
              moodContext={hootMoodContext}
              size={54}
              faceStyle={faceStyle}
              statusLine={hootStatus}
              trackMouse
              className="hoot-deck-owl"
            />
          </button>
        </HoverTip>

        <div className="hoot-deck-float-divider hidden sm:block" aria-hidden />

        <div className="min-w-0 flex-1">
          <CooldownBarCore
            registry={registry}
            nowMs={nowMs}
            ringSize={34}
            stroke={4}
            showCountdown
            onProviderContextMenu={openProviderMenu}
          />
        </div>

        <div className="hoot-deck-float-divider hidden md:block" aria-hidden />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <HoverTip id="deck.popout.expand" placement="below">
            <button
              type="button"
              onClick={expandDeck}
              className="rounded-lg border border-white/10 bg-black/25 px-1.5 py-1 text-white/70 transition hover:text-white"
              title={tooltipTitle("deck.popout.expand")}
            >
              <Maximize2 size={13} />
            </button>
          </HoverTip>
          <HoverTip id={chatExpanded ? "deck.chat.collapse" : "deck.chat.expand"} placement="below">
            <button
              type="button"
              onClick={() => setChatExpanded((v) => !v)}
              className={`rounded-lg border px-1.5 py-1 transition ${
                chatExpanded ? "hoot-gold-chip" : "border-white/10 bg-black/25 text-white/70 hover:text-white"
              }`}
            >
              <MessageCircle size={13} />
            </button>
          </HoverTip>
        </div>
      </div>

      <CompactDeckStats registry={registry} nowMs={nowMs} />
      <CompactPopoutRadar />

      {registry.matrix_line && (
        <div className="hoot-deck-float-panel truncate rounded-lg px-2 py-1 font-mono text-[9px] opacity-55">
          {registry.matrix_line}
        </div>
      )}
    </div>
  );

  const content =
    viewMode === "full" ? (
      <div
        className="hoot-deck-float-shell flex h-screen flex-col gap-2.5 overflow-visible p-3 font-sans text-foreground"
        onContextMenu={openSurfaceMenu}
        title="Right-click for monitor options"
      >
        {fullHeader}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
          <MatrixTicker registry={registry} />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {PROVIDER_ORDER.map((id) => {
              const row = registry.providers?.[id];
              if (!row) return null;
              return <ProviderGauge key={id} id={id} row={row} nowMs={nowMs} onPatch={patch} size={100} />;
            })}
          </div>
          <RecoveryTimeline registry={registry} nowMs={nowMs} />
          <PopoutRadarTelemetry />
          <TelemetryHealth />
        </div>
        {chatExpanded && (
          <div className="hoot-deck-float-panel flex max-h-[42%] min-h-[220px] flex-col overflow-visible rounded-xl">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <HootOwl mood={hootMood} moodContext={hootMoodContext} size="sm" statusLine={hootStatus} className="hoot-deck-owl" />
                <span className="text-[11px] font-medium opacity-80">Ask {BRAND.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setChatExpanded(false)}
                className="rounded-md border border-border p-1 opacity-50 transition hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <CoachThread sessionId={DECK_SESSION_ID} onCommand={executeCmd} />
            </div>
          </div>
        )}
      </div>
    ) : (
      <div
        className={`hoot-deck-float-shell flex flex-col overflow-visible font-sans text-foreground ${
          chatExpanded ? "h-screen gap-2 p-2" : "p-2"
        }`}
      >
        {compactMonitor}

        {chatExpanded && (
          <div className="hoot-deck-float-panel flex min-h-0 flex-1 flex-col overflow-visible rounded-xl">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <HootOwl mood={hootMood} moodContext={hootMoodContext} size="sm" statusLine={hootStatus} className="hoot-deck-owl" />
                <span className="text-[11px] font-medium opacity-80">Ask {BRAND.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setChatExpanded(false)}
                className="rounded-md border border-border p-1 opacity-50 transition hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <CoachThread sessionId={DECK_SESSION_ID} onCommand={executeCmd} />
            </div>
          </div>
        )}
      </div>
    );

  return createPortal(
    <TooltipPortalProvider value={overlayPortal}>
      {content}
      {menu?.kind === "surface" && (
        <DeckSurfaceMenu
          container={menuContainer}
          position={menu.position}
          onClose={() => setMenu(null)}
          onExpand={expandDeck}
          onOpenChat={() => setChatExpanded(true)}
          onClosePopout={close}
          onRefresh={() => void reload()}
          onCopyMatrix={() => void copyMatrix()}
          onCopyReport={() => void copyStatusReport()}
          onSyncTelemetry={(importFromDisk) => void syncTelemetry(importFromDisk)}
          onNavigateDeck={() => navigate("/deck")}
        />
      )}
      {menu?.kind === 'provider' && (
        <ProviderDialMenu
          container={menuContainer}
          position={menu.position}
          providerId={menu.providerId}
          row={menu.row}
          nowMs={nowMs}
          onPatch={patch}
          onClose={() => setMenu(null)}
        />
      )}
    </TooltipPortalProvider>,
    body,
  );
}
