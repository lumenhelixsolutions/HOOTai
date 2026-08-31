import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { GripHorizontal, Minimize2, X } from "lucide-react";
import { useCoach } from "@/context/CoachContext";
import HootLogo from "@/lib/h00t-logo";
import { moodColor, type HootMoodContext } from "@/lib/h00t-ascii";
import { readStoredHootFaceStyle } from "@/lib/h00t-face-styles";
import HoverTip from "@/components/HoverTip";
import { TooltipPortalProvider, pipOverlayPortal } from "@/components/TooltipPortalContext";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
    };
  }
}

const FLOAT_POS_KEY = "hoot_owl_float_pos";
const FLOAT_SIZE = { w: 168, h: 196 };

type FloatPos = { x: number; y: number };

type HootFloatContextValue = {
  pipWindow: Window | null;
  open: () => Promise<void>;
  close: () => void;
  toggle: () => Promise<void>;
};

const HootFloatContext = createContext<HootFloatContextValue | null>(null);

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
  target.body.style.overflow = "hidden";
}

function loadFloatPos(): FloatPos {
  try {
    const raw = localStorage.getItem(FLOAT_POS_KEY);
    if (!raw) return { x: 12, y: 12 };
    const parsed = JSON.parse(raw) as FloatPos;
    return {
      x: Math.max(0, Math.min(parsed.x, FLOAT_SIZE.w - 80)),
      y: Math.max(0, Math.min(parsed.y, FLOAT_SIZE.h - 80)),
    };
  } catch {
    return { x: 12, y: 12 };
  }
}

function saveFloatPos(pos: FloatPos) {
  localStorage.setItem(FLOAT_POS_KEY, JSON.stringify(pos));
}

export function HootFloatProvider({ children }: { children: ReactNode }) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const winRef = useRef<Window | null>(null);
  winRef.current = pipWindow;

  const close = useCallback(() => {
    try {
      winRef.current?.close();
    } catch {
      /* already gone */
    }
    setPipWindow(null);
  }, []);

  const open = useCallback(async () => {
    if (winRef.current && !winRef.current.closed) return;

    let win: Window | null = null;
    try {
      if (window.documentPictureInPicture?.requestWindow) {
        win = await window.documentPictureInPicture.requestWindow({
          width: FLOAT_SIZE.w,
          height: FLOAT_SIZE.h,
        });
      }
    } catch {
      /* fall through */
    }
    if (!win) {
      win = window.open(
        "",
        "hoot-owl-float",
        `popup=yes,width=${FLOAT_SIZE.w},height=${FLOAT_SIZE.h}`,
      );
    }
    if (!win) return;

    copyStylesInto(win.document);
    win.document.title = "HOOT";
    win.addEventListener("pagehide", () => setPipWindow(null));
    setPipWindow(win);
  }, []);

  const toggle = useCallback(async () => {
    if (winRef.current && !winRef.current.closed) {
      close();
      return;
    }
    await open();
  }, [close, open]);

  useEffect(() => {
    const onOpen = () => {
      void open();
    };
    const onClose = () => close();
    window.addEventListener("hoot:open-owl-float", onOpen);
    window.addEventListener("hoot:close-owl-float", onClose);
    return () => {
      window.removeEventListener("hoot:open-owl-float", onOpen);
      window.removeEventListener("hoot:close-owl-float", onClose);
    };
  }, [open, close]);

  useEffect(() => {
    const onUnload = () => winRef.current?.close();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const value = useMemo(
    () => ({ pipWindow, open, close, toggle }),
    [pipWindow, open, close, toggle],
  );

  return (
    <HootFloatContext.Provider value={value}>
      {children}
      <HootFloatPortal />
    </HootFloatContext.Provider>
  );
}

export function useHootFloat() {
  const ctx = useContext(HootFloatContext);
  if (!ctx) throw new Error("useHootFloat must be used within HootFloatProvider");
  return ctx;
}

function HootFloatPortal() {
  const { pipWindow, close } = useHootFloat();
  if (!pipWindow) return null;
  return <HootFloatSurface pipWindow={pipWindow} onClose={close} />;
}

function HootFloatSurface({ pipWindow, onClose }: { pipWindow: Window; onClose: () => void }) {
  const location = useLocation();
  const { hootMood, hootStatus, setCoachOpen, pageContext, chatLoading, topHint } = useCoach();
  const [pos, setPos] = useState<FloatPos>(() => loadFloatPos());
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const faceStyle = readStoredHootFaceStyle("grand");

  const moodContext: HootMoodContext = useMemo(
    () => ({
      pathname: location.pathname,
      pageContext,
      hasError: false,
      coachOpen: false,
      chatLoading,
      topHintTone: topHint?.tone || null,
      hasTopHint: Boolean(topHint),
    }),
    [location.pathname, pageContext, chatLoading, topHint],
  );

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = {
      x: Math.max(0, Math.min(dragRef.current.origX + dx, FLOAT_SIZE.w - 96)),
      y: Math.max(0, Math.min(dragRef.current.origY + dy, FLOAT_SIZE.h - 120)),
    };
    setPos(next);
  }, []);

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setPos((p) => {
      saveFloatPos(p);
      return p;
    });
  }, []);

  const openCoach = useCallback(() => {
    setCoachOpen(true);
    window.dispatchEvent(new CustomEvent("hoot:open-coach"));
  }, [setCoachOpen]);

  const content = (
    <div
      className="hoot-float-shell"
      style={{
        width: FLOAT_SIZE.w,
        height: FLOAT_SIZE.h,
        background: "transparent",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: pos.x,
          top: pos.y,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div
          className="hoot-float-drag"
          onPointerDown={startDrag}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "center",
            opacity: 0.35,
            cursor: "grab",
            touchAction: "none",
            padding: "2px 0",
          }}
          title="Drag HOOT"
        >
          <GripHorizontal size={12} color="#aaa" />
        </div>

        <HootLogo
          mood={hootMood}
          moodContext={moodContext}
          size={118}
          faceStyle={faceStyle}
          statusLine={hootStatus}
          trackMouse
          onClick={openCoach}
          className="hoot-float-owl"
        />

        <span
          style={{
            fontSize: 8,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: 0.5,
            color: moodColor(hootMood),
            maxWidth: 130,
            textAlign: "center",
            fontFamily: "'Fira Code', monospace",
          }}
        >
          {hootStatus ? hootStatus.slice(0, 24) : "click ┬╖ coach"}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          display: "flex",
          gap: 4,
        }}
      >
        <HoverTip id="shell.hoot.float.dock" placement="below">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 bg-black/20 p-1 text-white/60 transition hover:text-white"
            aria-label="Dock HOOT"
          >
            <Minimize2 size={12} />
          </button>
        </HoverTip>
        <HoverTip id="shell.hoot.float.close" placement="below">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 bg-black/20 p-1 text-white/60 transition hover:text-white"
            aria-label="Close floating HOOT"
          >
            <X size={12} />
          </button>
        </HoverTip>
      </div>
    </div>
  );

  const overlayPortal = useMemo(() => pipOverlayPortal(pipWindow), [pipWindow]);

  return createPortal(
    <TooltipPortalProvider value={overlayPortal}>{content}</TooltipPortalProvider>,
    pipWindow.document.body,
  );
}
