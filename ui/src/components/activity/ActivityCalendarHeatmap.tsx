import { BRAND_COLORS } from "@/lib/brand";
import type { ActivityCalendarCell } from "@/lib/activity-types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cellColor(intensity: number, inRange: boolean) {
  if (!inRange) return "rgba(255,255,255,0.02)";
  const a = 0.08 + intensity * 0.72;
  return `rgba(255, 176, 66, ${a})`;
}

export default function ActivityCalendarHeatmap({
  weeks,
  selectedDate,
  onSelect,
}: {
  weeks: ActivityCalendarCell[][];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ fontSize: 10, textAlign: "center", opacity: 0.45, letterSpacing: "0.08em" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {week.map((cell) => {
              const selected = selectedDate === cell.date;
              return (
                <button
                  key={cell.date}
                  type="button"
                  title={`Activity day — ${cell.date}: ${cell.total_minutes} minutes across ${cell.events} events. Click to filter the session timeline.`}
                  onClick={() => cell.in_range && onSelect(cell.date)}
                  style={{
                    aspectRatio: "1",
                    minHeight: 28,
                    borderRadius: 6,
                    border: selected ? `2px solid ${BRAND_COLORS.gold}` : "1px solid rgba(255,255,255,0.06)",
                    background: cellColor(cell.intensity, cell.in_range),
                    cursor: cell.in_range ? "pointer" : "default",
                    opacity: cell.in_range ? 1 : 0.35,
                    padding: 0,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 10, opacity: 0.5 }}>
        <span>Log color</span>
        <div style={{ display: "flex", gap: 3 }}>
          {[0.1, 0.25, 0.45, 0.65, 0.9].map((a) => (
            <div key={a} style={{ width: 14, height: 14, borderRadius: 3, background: `rgba(255,176,66,${a})` }} />
          ))}
        </div>
        <span>Less</span>
        <span style={{ marginLeft: 4 }}>More</span>
      </div>
    </div>
  );
}