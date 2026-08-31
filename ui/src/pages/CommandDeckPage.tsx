import { Clock3, Gauge, RefreshCw } from "lucide-react";
import { Panel, WidgetError, WidgetSkeleton } from "@/components/dashboard/primitives";
import { useCooldownRegistry } from "@/hooks/useCooldownRegistry";
import { PROVIDER_ORDER } from "@/lib/cooldown";
import MatrixTicker from "@/components/deck/MatrixTicker";
import ProviderGauge from "@/components/deck/ProviderGauge";
import RecoveryTimeline from "@/components/deck/RecoveryTimeline";
import ContextRadar from "@/components/deck/ContextRadar";
import HandoffConsole from "@/components/deck/HandoffConsole";
import TelemetryHealth from "@/components/deck/TelemetryHealth";
import DeckCompactRadial from "@/components/deck/DeckCompactRadial";
import ProviderRidePanel from "@/components/deck/ProviderRidePanel";
import { useDeckPopout } from "@/components/deck/popout";
import HoverTip, { TipIcon } from "@/components/HoverTip";

export default function CommandDeckPage() {
  const { registry, loading, refreshing, failed, nowMs, reload, patch } = useCooldownRegistry();
  const { pipWindow, viewMode, toggle, expandDeck } = useDeckPopout();

  if (loading && !registry) {
    return (
      <div className="grid gap-[18px]">
        <WidgetSkeleton rows={2} title="Command Deck" />
        <WidgetSkeleton rows={4} />
      </div>
    );
  }

  if (failed && !registry) {
    return <WidgetError title="Command Deck" onRetry={reload} />;
  }

  if (!registry) return null;

  return (
    <div className="grid gap-[18px]">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <DeckCompactRadial
            registry={registry}
            nowMs={nowMs}
            pipOpen={Boolean(pipWindow)}
            pipExpanded={viewMode === "full"}
            onPopout={toggle}
            onExpandPopout={pipWindow ? expandDeck : undefined}
          />
        </div>
        <HoverTip id="deck.refresh">
          <button
            type="button"
            onClick={reload}
            className="flex shrink-0 items-center rounded-2xl border border-border px-3 py-3 opacity-70 transition hover:opacity-100"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
        </HoverTip>
      </div>

      <MatrixTicker registry={registry} />

      <ProviderRidePanel />

      <Panel title="Provider gauges" subtitle="Live cooldown matrix · click a gauge's actions to mark status" icon={Gauge} action={<TipIcon id="deck.gauge.provider" />}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {PROVIDER_ORDER.map((id) => {
            const row = registry.providers?.[id];
            if (!row) return null;
            return <ProviderGauge key={id} id={id} row={row} nowMs={nowMs} onPatch={patch} />;
          })}
        </div>
      </Panel>

      <Panel title="Recovery timeline" subtitle="Next 8 hours · unlocks and daily resets" icon={Clock3}>
        <RecoveryTimeline registry={registry} nowMs={nowMs} />
      </Panel>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <ContextRadar />
        <div className="grid gap-[18px] content-start">
          <HandoffConsole />
          <TelemetryHealth />
        </div>
      </div>

    </div>
  );
}
