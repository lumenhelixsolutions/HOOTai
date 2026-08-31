import { BRAND } from "@/lib/brand";

const GOLD = "#E8D5A3";

export default function HootWordmark({
  showSubtitle = true,
  compact = false,
}: {
  showSubtitle?: boolean;
  compact?: boolean;
}) {
  return (
    <div style={{ minWidth: 0, fontFamily: "'Fira Code', 'Consolas', monospace" }}>
      <div
        style={{
          fontSize: compact ? 16 : 18,
          fontWeight: 700,
          color: GOLD,
          // Tighter tracking so zeros in "h00t" stay readable as digits
          letterSpacing: compact ? "0.14em" : "0.18em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {BRAND.name}
      </div>
      {showSubtitle && (
        <div
          style={{
            marginTop: compact ? 5 : 7,
            fontSize: compact ? 7 : 8,
            fontWeight: 500,
            color: "rgba(220,215,200,0.68)",
            letterSpacing: "0.10em",
            textTransform: "none",
            lineHeight: 1.35,
          }}
        >
          {BRAND.subtitle}
        </div>
      )}
    </div>
  );
}