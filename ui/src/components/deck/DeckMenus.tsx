import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  ExternalLink,
  Layers,
  Maximize2,
  MessageCircle,
  PictureInPicture2,
  RefreshCw,
  ShieldAlert,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type ProviderRow,
  formatClock,
  gaugeState,
  limitsLine,
  liveRemaining,
} from "@/lib/cooldown";
import { useTooltipPortal } from "@/components/TooltipPortalContext";

export type DeckMenuPosition = { x: number; y: number };

type MenuItem = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  disabled?: boolean;
  action: () => void;
};

function DeckMenuPortal({
  container,
  position,
  title,
  children,
  onClose,
}: {
  container: HTMLElement;
  position: DeckMenuPosition;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const overlay = useTooltipPortal();
  const host = overlay?.root ?? container;
  const pipWin = container.ownerDocument.defaultView;
  const mapped = overlay?.mapPoint(position.x, position.y) ?? position;
  const left = overlay
    ? mapped.left
    : Math.min(position.x, pipWin!.innerWidth - 240);
  const top = overlay
    ? mapped.top
    : Math.min(position.y, pipWin!.innerHeight - 320);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const docs = overlay ? [document, container.ownerDocument] : [container.ownerDocument];
    for (const doc of docs) {
      doc.addEventListener("mousedown", away);
      doc.addEventListener("keydown", key);
      doc.addEventListener("scroll", onClose, true);
    }
    return () => {
      for (const doc of docs) {
        doc.removeEventListener("mousedown", away);
        doc.removeEventListener("keydown", key);
        doc.removeEventListener("scroll", onClose, true);
      }
    };
  }, [container, onClose, overlay]);

  return createPortal(
    <div
      ref={ref}
      className="hoot-menu"
      role="menu"
      aria-label={title}
      style={overlay ? { position: "fixed", left, top, zIndex: 99991 } : { left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="hoot-menu-head">{title}</div>
      {children}
    </div>,
    host,
  );
}

function MenuButton({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const Icon = item.icon;
  return (
    <button
      role="menuitem"
      className="hoot-menu-item"
      disabled={item.disabled}
      onClick={() => {
        if (item.disabled) return;
        item.action();
        onClose();
      }}
    >
      <Icon size={14} />
      <span className="hoot-menu-label">{item.label}</span>
      {item.hint && <span className="hoot-menu-hint">{item.hint}</span>}
    </button>
  );
}

type PatchFn = (body: {
  provider?: string;
  status?: string;
  cooldown_until?: string | null;
  preset?: string;
  current_session_provider?: string | null;
}) => Promise<unknown>;

export function ProviderDialMenu({
  container,
  position,
  providerId,
  row,
  nowMs,
  onPatch,
  onClose,
}: {
  container: HTMLElement;
  position: DeckMenuPosition;
  providerId: string;
  row: ProviderRow;
  nowMs: number;
  onPatch: PatchFn;
  onClose: () => void;
}) {
  const state = gaugeState(row);
  const remaining = liveRemaining(row, nowMs);
  const isLocal = state === "local";
  const isDailyReset = row.limits_ref?.limit_type === "daily_reset";

  const copyStatus = async () => {
    const lines = [
      `${row.label || providerId}: ${state}`,
      remaining !== null ? `remaining: ${formatClock(remaining)}` : null,
      limitsLine(row) || null,
      row.ready_at_iso ? `ready: ${row.ready_at_iso}` : null,
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join("\n"));
  };

  const items: MenuItem[] = [
    {
      icon: CheckCircle2,
      label: "Mark active",
      hint: "clear cooldown",
      disabled: isLocal || state !== "cooldown",
      action: () => onPatch({ provider: providerId, status: "active", cooldown_until: null }),
    },
    {
      icon: Timer,
      label: "Lock 3 hours",
      disabled: isLocal,
      action: () => onPatch({ provider: providerId, preset: "3hr" }),
    },
    {
      icon: Clock3,
      label: "Lock 5 hours",
      disabled: isLocal,
      action: () => onPatch({ provider: providerId, preset: "5hr" }),
    },
    {
      icon: ShieldAlert,
      label: "Lock until reset",
      hint: "daily cap",
      disabled: isLocal || !isDailyReset || !row.next_reset_iso,
      action: () =>
        onPatch({ provider: providerId, status: "cooldown", cooldown_until: row.next_reset_iso }),
    },
    {
      icon: Layers,
      label: "Set session provider",
      hint: providerId,
      action: () => onPatch({ current_session_provider: providerId }),
    },
    {
      icon: ClipboardCopy,
      label: "Copy provider status",
      action: () => void copyStatus(),
    },
  ];

  return (
    <DeckMenuPortal
      container={container}
      position={position}
      title={`${row.label || providerId} · ${state}`}
      onClose={onClose}
    >
      {items.map((item) => (
        <MenuButton key={item.label} item={item} onClose={onClose} />
      ))}
    </DeckMenuPortal>
  );
}

export function DeckSurfaceMenu({
  container,
  position,
  onClose,
  onExpand,
  onOpenChat,
  onClosePopout,
  onRefresh,
  onCopyMatrix,
  onCopyReport,
  onSyncTelemetry,
  onNavigateDeck,
}: {
  container: HTMLElement;
  position: DeckMenuPosition;
  onClose: () => void;
  onExpand: () => void;
  onOpenChat: () => void;
  onClosePopout: () => void;
  onRefresh: () => void;
  onCopyMatrix: () => void;
  onCopyReport: () => void;
  onSyncTelemetry: (importFromDisk: boolean) => void;
  onNavigateDeck: () => void;
}) {
  const items: MenuItem[] = [
    { icon: Maximize2, label: "Expand full Command Deck", action: onExpand },
    { icon: MessageCircle, label: "Ask HOOT", hint: "coach chat", action: onOpenChat },
    {
      icon: PictureInPicture2,
      label: "Float owl above windows",
      hint: "transparent PiP",
      action: () => window.dispatchEvent(new CustomEvent("hoot:open-owl-float")),
    },
    { icon: ExternalLink, label: "Open Command Deck page", action: onNavigateDeck },
    { icon: RefreshCw, label: "Refresh provider registry", action: onRefresh },
    { icon: ClipboardCopy, label: "Copy matrix line", action: onCopyMatrix },
    { icon: ClipboardCopy, label: "Copy status report", action: onCopyReport },
    { icon: ArrowUpFromLine, label: "Export telemetry now", action: () => onSyncTelemetry(false) },
    { icon: ArrowDownToLine, label: "Import telemetry from disk", action: () => onSyncTelemetry(true) },
    { icon: X, label: "Close monitor", action: onClosePopout },
  ];

  return (
    <DeckMenuPortal container={container} position={position} title="HOOT · Cooldown Monitor" onClose={onClose}>
      {items.map((item) => (
        <MenuButton key={item.label} item={item} onClose={onClose} />
      ))}
    </DeckMenuPortal>
  );
}