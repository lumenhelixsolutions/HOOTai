import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import type { TooltipDef } from "@/lib/tooltips";
import { useTooltipPortal } from "./TooltipPortalContext";

export type HelpTooltipProps = TooltipDef & {
  size?: number;
  children?: ReactNode;
  width?: number;
  placement?: "above" | "below";
};

function TooltipBubble({
  id,
  title,
  body,
  features,
  tips,
  orchestration,
  width,
  placement,
  style,
}: HelpTooltipProps & {
  id: string;
  placement: "above" | "below";
  style: React.CSSProperties;
}) {
  return (
    <div
      id={id}
      role="tooltip"
      style={{
        width,
        maxWidth: "min(92vw, 340px)",
        padding: "14px 16px",
        borderRadius: 12,
        background: "linear-gradient(165deg, #1a1a1a 0%, #0d0d0d 100%)",
        border: "1px solid rgba(255,176,66,0.22)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
        zIndex: 99990,
        pointerEvents: "none",
        ...style,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#ffb042", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: "rgba(245,245,245,0.88)" }}>{body}</div>
      {features && features.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 16, fontSize: 11, lineHeight: 1.5, color: "rgba(236,232,225,0.65)" }}>
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      {orchestration && (
        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5, color: "rgba(236,232,225,0.55)" }}>
          <strong style={{ color: "rgba(255,211,154,0.8)", fontWeight: 500 }}>Orchestration:</strong> {orchestration}
        </div>
      )}
      {tips && tips.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 11, lineHeight: 1.45, color: "rgba(134,239,172,0.75)", listStyle: "disc" }}>
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}
      <div
        style={{
          position: "absolute",
          ...(placement === "above"
            ? { bottom: -6, borderRight: "1px solid rgba(255,176,66,0.22)", borderBottom: "1px solid rgba(255,176,66,0.22)" }
            : { top: -6, borderLeft: "1px solid rgba(255,176,66,0.22)", borderTop: "1px solid rgba(255,176,66,0.22)" }),
          left: "50%",
          transform: "translateX(-50%) rotate(45deg)",
          width: 10,
          height: 10,
          background: "#141414",
        }}
      />
    </div>
  );
}

export default function HelpTooltip({
  title,
  body,
  features,
  tips,
  orchestration,
  size = 14,
  children,
  width = 300,
  placement = "above",
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const portal = useTooltipPortal();

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }
    if (portal) {
      setCoords(portal.mapPosition(anchorRef.current, placement));
      return;
    }
    setCoords(null);
  }, [open, portal, placement]);

  const portaled = portal && open && coords;
  const inline = !portal && open;

  const portaledStyle: React.CSSProperties = {
    position: "fixed",
    left: coords?.left ?? 0,
    top: coords?.top ?? 0,
    transform: placement === "below" ? "translate(-50%, 0)" : "translate(-50%, -100%)",
  };

  const inlineStyle: React.CSSProperties =
    placement === "below"
      ? { position: "absolute", top: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", zIndex: 300 }
      : { position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", zIndex: 300 };

  const bubble = (
    <TooltipBubble
      id={tooltipId}
      title={title}
      body={body}
      features={features}
      tips={tips}
      orchestration={orchestration}
      width={width}
      placement={placement}
      style={portaled ? portaledStyle : inlineStyle}
    />
  );

  return (
    <span
      ref={anchorRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children || (
        <button
          type="button"
          aria-label={`Help: ${title}`}
          aria-describedby={open ? tooltipId : undefined}
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "1px solid rgba(255,176,66,0.25)",
            background: open ? "rgba(255,176,66,0.15)" : "rgba(255,255,255,0.04)",
            color: open ? "#ffb042" : "rgba(236,232,225,0.55)",
            cursor: "help",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            transition: "all 0.15s ease",
          }}
        >
          <CircleHelp size={size} strokeWidth={2} />
        </button>
      )}
      {inline && bubble}
      {portaled && portal && createPortal(bubble, portal.root)}
    </span>
  );
}