import { BRAND_COLORS } from "@/lib/brand";
import type { ActivityAnalytics } from "@/lib/activity-types";

export default function ActivityKpiStrip({ data }: { data: ActivityAnalytics }) {
  const t = data.kpis.today;
  const rate = t.success_rate != null ? `${Math.round(t.success_rate * 100)}%` : "—";

  const tiles = [
    { label: "Today", value: String(t.events), sub: "events" },
    { label: "Docked", value: `${t.dock_minutes}m`, sub: BRAND_COLORS.gold ? "agent time" : "dock" },
    { label: "External", value: `${t.external_minutes}m`, sub: "outside H00T" },
    { label: "Launches", value: String(t.launches), sub: "H00T sessions" },
    { label: "Success", value: rate, sub: `${t.successes} ok · ${t.failures} fail` },
    { label: "RTK saved", value: data.kpis.rtk_saved || "—", sub: "tokens prevented" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
      {tiles.map((tile) => (
        <div
          key={tile.label}
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255,176,66,0.04)",
            border: "1px solid rgba(255,176,66,0.12)",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>{tile.label}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: BRAND_COLORS.gold, marginTop: 4, fontFamily: "'EB Garamond', serif" }}>{tile.value}</div>
          <div style={{ fontSize: 10, opacity: 0.42, marginTop: 3 }}>{tile.sub}</div>
        </div>
      ))}
    </div>
  );
}