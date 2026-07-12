import { useMemo } from "react";
import {
  type CooldownRegistry,
  PROVIDER_ORDER,
  formatClock,
  gaugeState,
  liveRemaining,
} from "@/lib/cooldown";
import { useSoonestCooldown } from "./CooldownBarCore";

/** Compact telemetry pills for the floating deck monitor. */
export default function CompactDeckStats({
  registry,
  nowMs,
}: {
  registry: CooldownRegistry;
  nowMs: number;
}) {
  const soonest = useSoonestCooldown(registry, nowMs);

  const counts = useMemo(() => {
    let cooldown = 0;
    let ready = 0;
    let local = 0;
    for (const id of PROVIDER_ORDER) {
      const row = registry.providers?.[id];
      if (!row) continue;
      const state = gaugeState(row);
      if (state === "cooldown") cooldown += 1;
      else if (state === "local") local += 1;
      else if (state === "active") ready += 1;
    }
    return { cooldown, ready, local };
  }, [registry]);

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      <Stat label="Cooldowns" value={String(counts.cooldown)} tone={counts.cooldown > 0 ? "warn" : "ok"} />
      <Stat label="Ready" value={String(counts.ready)} tone="ok" />
      <Stat
        label="Next unlock"
        value={soonest ? formatClock(soonest.remaining) : "—"}
        sub={soonest?.label.split(" ")[0]}
        tone={soonest ? "warn" : "muted"}
      />
      <Stat
        label="Session"
        value={registry.current_session_provider?.toUpperCase() || "—"}
        tone={registry.current_session_provider ? "live" : "muted"}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "ok" | "warn" | "live" | "muted";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "live"
          ? "text-sky-300"
          : "opacity-55";
  return (
    <div className="hoot-deck-float-stat rounded-lg px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-[0.14em] opacity-40">{label}</div>
      <div className={`font-mono text-[11px] font-semibold tabular-nums leading-tight ${color}`}>{value}</div>
      {sub && <div className="truncate text-[8px] opacity-45">{sub}</div>}
    </div>
  );
}