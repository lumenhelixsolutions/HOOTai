import { useState } from "react";
import ProviderDialMark from "./ProviderDialMark";
import GaugeRing from "./GaugeRing";
import {
  type ProviderRow,
  STATE_COLORS,
  formatClock,
  gaugeState,
  limitsLine,
  liveRemaining,
  liveRemainingFraction,
  formatTimeLabel,
} from "@/lib/cooldown";
import { getTooltip } from "@/lib/tooltips";

type PatchFn = (body: { provider?: string; status?: string; cooldown_until?: string | null; preset?: string }) => Promise<unknown>;

/** Full-size radial countdown gauge for one provider, with quick cooldown actions. */
export default function ProviderGauge({
  id,
  row,
  nowMs,
  onPatch,
  size = 128,
}: {
  id: string;
  row: ProviderRow;
  nowMs: number;
  onPatch: PatchFn;
  size?: number;
}) {
  const [busy, setBusy] = useState(false);
  const state = gaugeState(row);
  const remaining = liveRemaining(row, nowMs);
  const fraction = liveRemainingFraction(row, nowMs);
  // Ring drains toward unlock; nearly-recovered cooldowns shift red → amber.
  const nearlyBack = state === "cooldown" && fraction !== null && fraction < 0.25;
  const color = nearlyBack ? "#fbbf24" : STATE_COLORS[state].stroke;
  const ringValue = state === "cooldown" ? (fraction ?? 1) : state === "unknown" ? 0 : 1;

  const act = async (body: Parameters<PatchFn>[0]) => {
    setBusy(true);
    try {
      await onPatch({ provider: id, ...body });
    } finally {
      setBusy(false);
    }
  };

  const isLocal = state === "local";
  const isDailyReset = row.limits_ref?.limit_type === "daily_reset";

  return (
    <div
      className="hoot-card-soft flex flex-col items-center rounded-2xl p-4"
      title={`${getTooltip("deck.gauge.provider").body} · ${row.label || id}: ${state}`}
    >
      <GaugeRing size={size} stroke={9} value={ringValue} color={color} glow={state !== "unknown"} pulse={isLocal && false}>
        <div className="flex flex-col items-center gap-0.5">
          <ProviderDialMark provider={id} size={Math.max(18, Math.round(size * 0.22))} dimmed={state === "cooldown"} />
          {state === "cooldown" && remaining !== null ? (
            <>
              <div className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatClock(remaining)}</div>
              <div className={`text-[8px] uppercase tracking-[0.14em] ${nearlyBack ? "text-amber-400" : STATE_COLORS.cooldown.text}`}>
                {nearlyBack ? "almost" : "locked"}
              </div>
            </>
          ) : (
            <>
              <div className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${STATE_COLORS[state].text}`}>
                {STATE_COLORS[state].label}
              </div>
              {isLocal && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />}
            </>
          )}
        </div>
      </GaugeRing>

      <div className="mt-2 text-sm font-semibold text-foreground">{row.label || id}</div>
      <div className="min-h-[16px] text-center font-mono text-[10px] leading-snug opacity-50">{limitsLine(row)}</div>

      {state === "cooldown" && (
        <div className="mt-1 text-center text-[10px] opacity-60">
          {row.cooldown_label || (row.ready_at_iso ? formatTimeLabel(row.ready_at_iso) : null) ? (
            <span>ready ~{row.cooldown_label || formatTimeLabel(row.ready_at_iso!)}</span>
          ) : null}
          {typeof row.est_messages_recovered === "number" && row.est_messages_recovered > 0 && (
            <span className="ml-1.5 text-emerald-400">+{row.est_messages_recovered} msg back</span>
          )}
        </div>
      )}

      {!isLocal && (
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
          {state === "cooldown" ? (
            <GaugeButton tone="green" disabled={busy} onClick={() => act({ status: "active", cooldown_until: null })}>
              Mark active
            </GaugeButton>
          ) : (
            <>
              <GaugeButton tone="red" disabled={busy} onClick={() => act({ preset: "3hr" })}>3h</GaugeButton>
              <GaugeButton tone="red" disabled={busy} onClick={() => act({ preset: "5hr" })}>5h</GaugeButton>
              {isDailyReset && row.next_reset_iso && (
                <GaugeButton
                  tone="red"
                  disabled={busy}
                  onClick={() => act({ status: "cooldown", cooldown_until: row.next_reset_iso })}
                >
                  til reset
                </GaugeButton>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GaugeButton({
  tone,
  disabled,
  onClick,
  children,
}: {
  tone: "red" | "green";
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls =
    tone === "red"
      ? "border-red-400/25 bg-red-400/10 text-red-400 hover:bg-red-400/20"
      : "border-emerald-400/25 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.06em] transition disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}
