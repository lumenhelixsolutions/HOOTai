import { useCallback, useEffect, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { formatEstTokens } from "@/lib/production-radar";

type RadarPayload = Awaited<ReturnType<typeof api.getAgentRadar>>;

function formatScanAge(scannedAt: string | null) {
  if (!scannedAt) return "never";
  const ms = Date.now() - new Date(scannedAt).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

/** One-line agent radar strip for the compact floating monitor. */
export default function CompactPopoutRadar() {
  const [radar, setRadar] = useState<RadarPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setRadar(await api.getAgentRadar(force));
    } catch {
      setRadar(null);
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

  return (
    <div className="hoot-deck-float-panel flex items-center gap-2 rounded-lg px-2 py-1.5">
      <Radio size={10} className={running > 0 ? "shrink-0 text-emerald-400" : "shrink-0 opacity-35"} />
      <div className="min-w-0 flex-1 truncate font-mono text-[9px] leading-snug">
        {radar ? (
          <>
            <span className={running > 0 ? "text-emerald-400" : "opacity-50"}>{running} run</span>
            <span className="opacity-35"> · </span>
            <span className="text-sky-300/80">{summary?.dock ?? 0} {BRAND.dockLabel.split(" ")[0].toLowerCase()}</span>
            <span className="opacity-35"> · </span>
            <span className={external > 0 ? "text-amber-400" : "opacity-50"}>{external} ext</span>
            {estTokens > 0 && (
              <>
                <span className="opacity-35"> · </span>
                <span className="opacity-55">~{formatEstTokens(estTokens)} ctx</span>
              </>
            )}
            {primary?.agent_name && (
              <>
                <span className="opacity-35"> · </span>
                <span className="text-amber-300/85">{primary.agent_name}</span>
              </>
            )}
            <span className="opacity-35"> · </span>
            <span className="opacity-40">{formatScanAge(radar.scanned_at ?? null)}</span>
          </>
        ) : (
          <span className="text-amber-400/80">radar unavailable</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => load(true)}
        className="shrink-0 rounded border border-border px-1 py-0.5 opacity-45 transition hover:opacity-100"
        title="Refresh agent radar"
      >
        <RefreshCw size={9} className={loading ? "animate-spin" : ""} />
      </button>
    </div>
  );
}