import { useMemo } from "react";
import { Maximize2, PictureInPicture2 } from "lucide-react";
import { type CooldownRegistry, PROVIDER_ORDER, formatClock, gaugeState } from "@/lib/cooldown";
import CooldownBarCore, { useSoonestCooldown } from "./CooldownBarCore";
import HoverTip from "@/components/HoverTip";
import { getTooltip } from "@/lib/tooltips";

type Props = {
  registry: CooldownRegistry;
  nowMs: number;
  pipOpen: boolean;
  pipExpanded: boolean;
  onPopout: () => void;
  onExpandPopout?: () => void;
};

/**
 * Prominent compact radial cluster on the Command Deck page — pops out to the
 * always-on-top floating monitor and can expand into the full deck window.
 */
export default function DeckCompactRadial({
  registry,
  nowMs,
  pipOpen,
  pipExpanded,
  onPopout,
  onExpandPopout,
}: Props) {
  const soonest = useSoonestCooldown(registry, nowMs);
  const cooldownCount = useMemo(() => {
    let count = 0;
    for (const id of PROVIDER_ORDER) {
      const row = registry.providers?.[id];
      if (row && gaugeState(row) === "cooldown") count += 1;
    }
    return count;
  }, [registry]);

  return (
    <div className="hoot-card-soft flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <HoverTip id="deck.provider.mini">
          <CooldownBarCore registry={registry} nowMs={nowMs} ringSize={44} stroke={5} showSoonest={false} />
        </HoverTip>

        <div className="min-w-[140px]">
          {soonest ? (
            <div className="font-mono text-sm tabular-nums text-red-400">
              {soonest.label.split(" ")[0]} {formatClock(soonest.remaining)}
              <div className="text-[10px] uppercase tracking-[0.12em] opacity-45">next unlock</div>
            </div>
          ) : (
            <div className="text-sm font-medium text-emerald-400/90">
              All clear
              <div className="text-[10px] uppercase tracking-[0.12em] opacity-45">no cooldowns</div>
            </div>
          )}
        </div>

        <div className="hidden min-w-0 flex-1 md:block">
          <div className="truncate font-mono text-[10px] opacity-50">{registry.matrix_line}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] opacity-45">
            {registry.current_session_provider && (
              <span className="hoot-gold-text">
                session: {registry.current_session_provider.toUpperCase()}
              </span>
            )}
            {cooldownCount > 0 && <span>{cooldownCount} in cooldown</span>}
            <span>{getTooltip("deck.popout.open").body.split("—")[0].trim()}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {pipOpen && onExpandPopout && !pipExpanded && (
          <HoverTip id="deck.popout.expand">
            <button
              type="button"
              onClick={onExpandPopout}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] opacity-70 transition hover:opacity-100"
            >
              <Maximize2 size={14} />
              <span className="hidden sm:inline">Expand</span>
            </button>
          </HoverTip>
        )}
        <HoverTip id={pipOpen ? "deck.popout.close" : "deck.popout.open"}>
          <button
            type="button"
            onClick={onPopout}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs transition ${
              pipOpen ? "hoot-gold-chip font-semibold" : "border-border opacity-80 hover:opacity-100"
            }`}
          >
            <PictureInPicture2 size={16} />
            <span>{pipOpen ? (pipExpanded ? "Floating · full" : "Floating") : "Pop out monitor"}</span>
          </button>
        </HoverTip>
      </div>
    </div>
  );
}