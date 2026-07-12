import { useEffect, useState } from "react";
import { Copy, RefreshCw, Timer, Check } from "lucide-react";
import { Panel, LinkCard, WidgetError } from "@/components/dashboard/primitives";
import { useCooldownRegistry } from "@/hooks/useCooldownRegistry";
import {
  PROVIDER_ORDER,
  STATE_COLORS,
  formatClock,
  gaugeState,
  limitsLine,
  liveRemaining,
  liveRemainingFraction,
} from "@/lib/cooldown";
import GaugeRing from "@/components/deck/GaugeRing";
import HoverTip from "@/components/HoverTip";
import { getTooltip } from "@/lib/tooltips";

/** Dashboard widget: compact mini-gauge strip for the Cooldown Command Deck. */
export default function ProviderMatrixWidget({
  onRegistryChange,
}: {
  onRegistryChange?: (matrixLine: string) => void;
}) {
  const { registry, loading, refreshing, failed, nowMs, reload, patch } = useCooldownRegistry();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (registry) onRegistryChange?.(registry.matrix_line || "");
  }, [registry, onRegistryChange]);

  const copyRegistry = async () => {
    if (!registry) return;
    const session = registry.current_session_provider ? `\nSESSION: ${registry.current_session_provider}` : "";
    await navigator.clipboard.writeText(`${registry.matrix_line || ""}${session}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggle = async (id: string) => {
    const row = registry?.providers?.[id];
    if (!row || row.status === "local") return;
    setBusy(id);
    try {
      const state = gaugeState(row);
      await patch(
        state === "cooldown"
          ? { provider: id, status: "active", cooldown_until: null }
          : { provider: id, preset: "3hr" },
      );
    } finally {
      setBusy(null);
    }
  };

  if (loading && !registry) {
    return (
      <Panel title="Cooldown deck" subtitle="Provider matrix" icon={Timer}>
        <div className="opacity-55">Loading provider status…</div>
      </Panel>
    );
  }

  if (failed && !registry) {
    return (
      <Panel title="Cooldown deck" subtitle="Provider matrix" icon={Timer}>
        <WidgetError title="Provider registry" onRetry={reload} />
      </Panel>
    );
  }

  if (!registry) return null;

  return (
    <Panel title="Cooldown deck" subtitle="Live provider gauges · click to toggle cooldown" icon={Timer}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 overflow-x-auto whitespace-nowrap font-mono text-[11px] leading-relaxed opacity-60">
          {registry.matrix_line}
        </div>
        <div className="flex shrink-0 gap-2">
          <HoverTip id="matrix.copy">
            <button type="button" onClick={copyRegistry} className="rounded-lg border border-border px-2.5 py-1.5 text-xs opacity-70 hover:opacity-100">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </HoverTip>
          <HoverTip id="matrix.refresh">
            <button type="button" onClick={reload} className="rounded-lg border border-border px-2.5 py-1.5 text-xs opacity-70 hover:opacity-100">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </HoverTip>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {PROVIDER_ORDER.map((id) => {
          const row = registry.providers?.[id];
          if (!row) return null;
          const state = gaugeState(row);
          const remaining = liveRemaining(row, nowMs);
          const fraction = liveRemainingFraction(row, nowMs);
          const nearlyBack = state === "cooldown" && fraction !== null && fraction < 0.25;
          const color = nearlyBack ? "#fbbf24" : STATE_COLORS[state].stroke;
          const value = state === "cooldown" ? (fraction ?? 1) : state === "unknown" ? 0 : 1;
          return (
            <button
              key={id}
              type="button"
              disabled={busy === id}
              onClick={() => toggle(id)}
              title={`${getTooltip("matrix.provider").body} · ${row.label}: ${state}${remaining ? ` · ${formatClock(remaining)} left` : ""} · ${limitsLine(row)}`}
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition hover:bg-foreground/[0.04] disabled:opacity-40"
            >
              <GaugeRing size={52} stroke={5} value={value} color={color} glow={state === "cooldown"}>
                {state === "cooldown" && remaining !== null ? (
                  <span className="font-mono text-[8px] font-semibold tabular-nums">{formatClock(remaining)}</span>
                ) : (
                  <span className={`text-[7px] font-semibold uppercase ${STATE_COLORS[state].text}`}>
                    {state === "unknown" ? "?" : STATE_COLORS[state].label}
                  </span>
                )}
              </GaugeRing>
              <span className="max-w-full truncate text-[9px] opacity-60">{(row.label || id).split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      <LinkCard to="/deck" label="Open Command Deck — gauges, timeline, context radar, save-state" />
    </Panel>
  );
}
