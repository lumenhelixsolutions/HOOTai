import { Link } from "react-router-dom";
import { Gauge, PictureInPicture2 } from "lucide-react";
import { useCooldownRegistry } from "@/hooks/useCooldownRegistry";
import CooldownBarCore from "./CooldownBarCore";
import { ProviderRideScoreChip } from "./ProviderRidePanel";
import { useDeckPopout } from "./popout";
import HoverTip from "@/components/HoverTip";
import { tooltipTitle } from "@/lib/tooltips";

/**
 * Always-visible top-bar cooldown indicator: mini gauge per provider, the
 * soonest unlock countdown, a link to the full Command Deck, and the
 * always-on-top popout toggle.
 */
export default function CooldownStrip() {
  const { registry, nowMs } = useCooldownRegistry();
  const { pipWindow, toggle } = useDeckPopout();

  if (!registry) return null;

  return (
    <div className="hoot-card-soft hidden items-center gap-2.5 rounded-2xl px-3 py-1.5 lg:flex" aria-label="Provider cooldown monitor">
      <ProviderRideScoreChip />
      <Link to="/deck" className="flex items-center gap-2 no-underline" title={tooltipTitle("deck.open")}>
        <CooldownBarCore registry={registry} nowMs={nowMs} />
        <Gauge size={14} className="hoot-gold-text" />
      </Link>
      <HoverTip id={pipWindow ? "deck.popout.close" : "deck.popout.open"}>
        <button
          type="button"
          onClick={toggle}
          className={`rounded-lg border px-1.5 py-1 transition ${
            pipWindow ? "hoot-gold-chip" : "border-border opacity-60 hover:opacity-100"
          }`}
        >
          <PictureInPicture2 size={13} />
        </button>
      </HoverTip>
    </div>
  );
}
