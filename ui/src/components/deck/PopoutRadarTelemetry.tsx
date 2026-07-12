import { useCallback, useEffect, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { formatEstTokens } from "@/lib/production-radar";
import HoverTip from "@/components/HoverTip";
import { getTooltip } from "@/lib/tooltips";

type RadarPayload = Awaited<ReturnType<typeof api.getAgentRadar>>;

function formatScanAge(scannedAt: string | null) {
  if (!scannedAt) return "never";
  const ms = Date.now() - new Date(scannedAt).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

/** Compact agent-radar strip for the always-on-top cooldown deck popout. */
export default function PopoutRadarTelemetry() {
  const [radar, setRadar] = useState<RadarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setFailed(false);
    try {
      setRadar(await api.getAgentRadar(force));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const poll = setInterval(() => load(false), 30_000);
    return () => clearInterval(poll);
  }, [load]);

  const summary = radar?.summary;
  const primary = radar?.production_context;
  const sessionSummary = radar?.session_summary || radar?.grok_summary;
  const running = summary?.total ?? 0;
  const external = summary?.external ?? 0;
  const estTokens = primary?.est_context_tokens ?? sessionSummary?.est_context_tokens ?? 0;
  const activeSessions = sessionSummary?.active ?? (primary?.active ? 1 : 0);

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.03] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-55">
          <Radio size={11} className={running > 0 ? "text-emerald-400" : "opacity-40"} />
          Agent radar
        </div>
        <HoverTip id="deck.radar.refresh">
          <button
            type="button"
            onClick={() => load(true)}
            className="rounded-md border border-border px-1.5 py-0.5 opacity-50 transition hover:opacity-100"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          </button>
        </HoverTip>
      </div>

      {failed && !radar ? (
        <div className="text-[10px] text-amber-400/90">Radar unavailable — retry</div>
      ) : (
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
            <Stat label="running" value={String(running)} tone={running > 0 ? "live" : "muted"} />
            <Stat label={BRAND.dockLabel.split(" ")[0]} value={String(summary?.dock ?? 0)} tone="dock" />
            <Stat label="external" value={String(external)} tone={external > 0 ? "warn" : "muted"} />
            <span className="opacity-40">{formatScanAge(radar?.scanned_at ?? null)}</span>
          </div>

          {(activeSessions > 0 || primary?.agent_name) && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-2 py-1.5 font-mono text-[9px] leading-relaxed">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-amber-300/90">
                  {primary?.agent_name || "session"}
                  {primary?.model_id ? ` · ${primary.model_id}` : ""}
                </span>
                {estTokens > 0 && <span className="opacity-55">~{formatEstTokens(estTokens)} ctx</span>}
                {sessionSummary?.turn_count ? (
                  <span className="opacity-45">{sessionSummary.turn_count} turns</span>
                ) : null}
              </div>
              {primary?.last_user_query && (
                <div className="mt-0.5 truncate opacity-45" title={`${getTooltip("deck.radar.query").body} · ${primary.last_user_query}`}>
                  “{primary.last_user_query.slice(0, 72)}{primary.last_user_query.length > 72 ? "…" : ""}”
                </div>
              )}
            </div>
          )}

          {radar?.agents && radar.agents.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {radar.agents.slice(0, 5).map((a) => (
                <span
                  key={a.id}
                  className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] opacity-60"
                  title={`${getTooltip("deck.radar.agent").body} · ${a.name}: ${a.count} proc · dock ${a.dock} · ext ${a.external}`}
                >
                  {a.name} {a.count > 1 ? `×${a.count}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "live" | "dock" | "warn" | "muted" }) {
  const color =
    tone === "live" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "dock" ? "text-sky-300/80" : "opacity-55";
  return (
    <span className={color}>
      {value} <span className="uppercase opacity-60">{label}</span>
    </span>
  );
}