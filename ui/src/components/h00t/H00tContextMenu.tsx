import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Camera, ClipboardCopy, Layers, Maximize2, MessageCircle, Pause, PictureInPicture2, Play, Repeat } from "lucide-react";
import { HOOT_FACE_STYLE_META, nextFaceStyle, type HootFaceStyle } from '@/lib/h00t-face-styles';

export interface HootMenuState {
  x: number;
  y: number;
}

interface Props {
  menu: HootMenuState;
  paused: boolean;
  faceStyle: HootFaceStyle;
  onClose: () => void;
  onTogglePause: () => void;
  onCycleFaceStyle: () => void;
  onCopySnapshot: () => void;
  onCopyStatus: () => void;
}

/** Premium right-click menu for the HOOT face. Rendered via portal. */
export default function HootContextMenu({
  menu,
  paused,
  faceStyle,
  onClose,
  onTogglePause,
  onCycleFaceStyle,
  onCopySnapshot,
  onCopyStatus,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const current = HOOT_FACE_STYLE_META[faceStyle];
  const upcoming = HOOT_FACE_STYLE_META[nextFaceStyle(faceStyle)];

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const fire = (action: () => void) => () => {
    action();
    onClose();
  };

  const items: Array<{ icon: typeof Pause; label: string; hint?: string; action: () => void }> = [
    { icon: paused ? Play : Pause, label: paused ? "Resume face" : "Pause face", action: onTogglePause },
    {
      icon: Repeat,
      label: `Face: ${current.label}`,
      hint: `next · ${upcoming.label}`,
      action: onCycleFaceStyle,
    },
    {
      icon: MessageCircle,
      label: "Talk to HOOT",
      hint: "open coach",
      action: () => window.dispatchEvent(new CustomEvent("hoot:open-coach")),
    },
    {
      icon: PictureInPicture2,
      label: "Float owl above windows",
      hint: "transparent PiP",
      action: () => window.dispatchEvent(new CustomEvent("hoot:open-owl-float")),
    },
    {
      icon: Maximize2,
      label: "Detach coach panel",
      action: () => window.dispatchEvent(new CustomEvent("hoot:open-popout")),
    },
    {
      icon: Layers,
      label: "Cooldown deck popout",
      action: () => window.dispatchEvent(new CustomEvent("hoot:open-deck-popout")),
    },
    { icon: Camera, label: "Copy face snapshot", hint: "ASCII frame", action: onCopySnapshot },
    { icon: ClipboardCopy, label: "Copy status report", action: onCopyStatus },
  ];

  const left = Math.min(menu.x, window.innerWidth - 230);
  const top = Math.min(menu.y, window.innerHeight - items.length * 38 - 56);

  return createPortal(
    <div
      ref={ref}
      className="hoot-menu"
      role="menu"
      aria-label="HOOT options"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="hoot-menu-head">HOOT · {current.tagline}</div>
      {items.map(({ icon: Icon, label, hint, action }) => (
        <button key={label} role="menuitem" className="hoot-menu-item" onClick={fire(action)}>
          <Icon size={14} />
          <span className="hoot-menu-label">{label}</span>
          {hint && <span className='hoot-menu-hint'>{hint}</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
}
