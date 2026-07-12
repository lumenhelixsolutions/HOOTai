import { type MouseEvent, useMemo } from "react";
import {
  type CooldownRegistry,
  type ProviderRow,
  PROVIDER_ORDER,
  formatClock,
  gaugeState,
  liveRemaining,
} from "@/lib/cooldown";
import ProviderDial, { providerDialTitle } from "./ProviderDial";
import { getTooltip } from "@/lib/tooltips";

type Props = {
  registry: CooldownRegistry;
  nowMs: number;
  ringSize?: number;
  stroke?: number;
  showSoonest?: boolean;
  showCountdown?: boolean;
  onProviderContextMenu?: (e: MouseEvent, id: string, row: ProviderRow) => void;
};

export function useSoonestCooldown(registry: CooldownRegistry | null, nowMs: number) {
  return useMemo(() => {
    if (!registry) return null;
    let best: { id: string; label: string; remaining: number } | null = null;
    for (const id of PROVIDER_ORDER) {
      const row = registry.providers?.[id];
      if (!row || gaugeState(row) !== "cooldown") continue;
      const remaining = liveRemaining(row, nowMs);
      if (remaining === null || remaining <= 0) continue;
      if (!best || remaining < best.remaining) best = { id, label: row.label || id, remaining };
    }
    return best;
  }, [registry, nowMs]);
}

/** Shared provider dial row + soonest countdown — matches the top-bar strip layout. */
export default function CooldownBarCore({
  registry,
  nowMs,
  ringSize = 20,
  stroke,
  showSoonest = true,
  showCountdown = false,
  onProviderContextMenu,
}: Props) {
  const soonest = useSoonestCooldown(registry, nowMs);

  return (
    <>
      <div className="flex items-center gap-1">
        {PROVIDER_ORDER.map((id) => {
          const row = registry.providers?.[id];
          if (!row) return null;
          const state = gaugeState(row);
          const remaining = state === "cooldown" ? liveRemaining(row, nowMs) : null;
          return (
            <span
              key={id}
              title={`${getTooltip("deck.provider.mini").body} · ${providerDialTitle(id, row, nowMs, state)}${remaining ? ` · ${formatClock(remaining)} left` : ""} · right-click options`}
            >
              <ProviderDial
                id={id}
                row={row}
                nowMs={nowMs}
                ringSize={ringSize}
                stroke={stroke}
                showCountdown={showCountdown}
                onContextMenu={onProviderContextMenu}
              />
            </span>
          );
        })}
      </div>
      {showSoonest &&
        (soonest ? (
          <span
            className="font-mono text-[10px] tabular-nums text-red-400"
            title={`${getTooltip("deck.soonest").body} · ${soonest.label}`}
          >
            {soonest.label.split(" ")[0].toUpperCase()} {formatClock(soonest.remaining)}
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-[0.1em] text-emerald-400/80">all clear</span>
        ))}
    </>
  );
}