import { type MouseEvent, type ReactNode } from "react";
import {
  type ProviderRow,
  STATE_COLORS,
  formatClock,
  gaugeState,
  liveRemaining,
  liveRemainingFraction,
} from "@/lib/cooldown";
import GaugeRing from "./GaugeRing";
import ProviderDialMark from "./ProviderDialMark";

type Props = {
  id: string;
  row: ProviderRow;
  nowMs: number;
  ringSize: number;
  stroke?: number;
  glow?: boolean;
  overlay?: ReactNode;
  dimLogoOnCooldown?: boolean;
  showCountdown?: boolean;
  onContextMenu?: (e: MouseEvent, id: string, row: ProviderRow) => void;
};

/** Provider gauge ring with brand mark in the center. */
export default function ProviderDial({
  id,
  row,
  nowMs,
  ringSize,
  stroke,
  glow,
  overlay,
  dimLogoOnCooldown = true,
  showCountdown = false,
  onContextMenu,
}: Props) {
  const state = gaugeState(row);
  const remaining = liveRemaining(row, nowMs);
  const fraction = liveRemainingFraction(row, nowMs);
  const nearlyBack = state === "cooldown" && fraction !== null && fraction < 0.25;
  const color = nearlyBack ? "#fbbf24" : STATE_COLORS[state].stroke;
  const value = state === "cooldown" ? (fraction ?? 1) : state === "unknown" ? 0 : 1;
  const ringStroke = stroke ?? Math.max(2, Math.round(ringSize * 0.15));
  const logoSize = Math.max(8, Math.round(ringSize * 0.52));

  const countdown =
    showCountdown && state === "cooldown" && remaining !== null ? (
      <span
        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 font-mono font-semibold tabular-nums leading-none text-red-400"
        style={{ fontSize: Math.max(6, Math.round(ringSize * 0.2)) }}
      >
        {formatClock(remaining)}
      </span>
    ) : null;

  return (
    <span
      className={onContextMenu ? "cursor-context-menu" : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, id, row) : undefined}
    >
      <GaugeRing
        size={ringSize}
        stroke={ringStroke}
        value={value}
        color={color}
        glow={glow ?? state === "cooldown"}
      >
        <div className="relative flex items-center justify-center">
          <ProviderDialMark
            provider={id}
            size={logoSize}
            dimmed={dimLogoOnCooldown && state === "cooldown"}
          />
          {countdown}
          {overlay}
        </div>
      </GaugeRing>
    </span>
  );
}

export function providerDialTitle(id: string, row: ProviderRow, nowMs: number, state = gaugeState(row)) {
  const remaining = state === "cooldown" ? liveRemaining(row, nowMs) : null;
  return `${row.label || id}: ${state}${remaining ? ` · ${remaining}s left` : ""}`;
}