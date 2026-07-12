import { Flame, RefreshCw, ShieldAlert, TrendingDown } from "lucide-react";

export type TokenBurnReport = {
  version: number;
  scanned_at: string;
  prevention: {
    rtk: { present: boolean; version: string | null };
    wsl: { present: boolean; full_hooks: boolean };
  };
  gain: {
    summary: {
      total_commands: number;
      total_saved: number;
      avg_savings_pct: number;
    } | null;
    daily: Array<{ date: string | null; saved: number; savings_pct: number; commands: number }>;
    has_data: boolean;
  };
  rtk_profiles: Array<{ id: string; name: string }>;
  shell_agents: Array<{ id: string; name: string }>;
  risk: { level: "low" | "medium" | "high"; reasons: string[] };
  recommendations: Array<{ id: string; title: string; detail: string }>;
  formatted: { total_saved: string | null; avg_savings_pct: string | null };
  refresh?: { ok: boolean; error?: string } | null;
};

const riskTone: Record<string, { color: string; bg: string; border: string }> = {
  high: { color: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.28)" },
  medium: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)" },
  low: { color: "#4ade80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.2)" },
};

export default function TokenBurnPanel({
  data,
  loading,
  onRefresh,
  compact = false,
}: {
  data: TokenBurnReport | null;
  loading?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}) {
  if (!data && loading) {
    return <div style={{ fontSize: 12, opacity: 0.5 }}>Loading token burn stats…</div>;
  }
  if (!data) {
    return <div style={{ fontSize: 12, opacity: 0.5 }}>Run a system scan to assess token burn risk.</div>;
  }

  const tone = riskTone[data.risk.level] || riskTone.medium;
  const maxDaily = Math.max(...data.gain.daily.map((d) => d.saved), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 12 : 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            flex: 1,
            padding: compact ? "12px 14px" : "14px 16px",
            borderRadius: 14,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <ShieldAlert size={15} color={tone.color} />
            <span style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: tone.color, fontWeight: 600 }}>
              Burn risk · {data.risk.level}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, opacity: 0.85 }}>{data.risk.reasons[0]}</p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(251,146,60,0.28)",
              background: "rgba(251,146,60,0.08)",
              color: "#fb923c",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <RefreshCw size={14} className={loading ? "spin" : undefined} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
        <BurnStat label="RTK" value={data.prevention.rtk.present ? "Installed" : "Missing"} ok={data.prevention.rtk.present} />
        <BurnStat label="WSL hooks" value={data.prevention.wsl.full_hooks ? "Full" : data.prevention.wsl.present ? "Partial" : "None"} ok={data.prevention.wsl.full_hooks} />
        <BurnStat label="Saved" value={data.formatted.total_saved || "—"} ok={Boolean(data.gain.has_data)} />
        <BurnStat label="Avg save" value={data.formatted.avg_savings_pct || "—"} ok={Boolean(data.gain.has_data)} />
      </div>

      {data.gain.daily.length > 0 && (
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 10 }}>
            Daily prevention (RTK tokens kept out of context)
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64 }}>
            {data.gain.daily.slice(-10).map((day) => (
              <div key={day.date || Math.random()} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 28,
                    height: `${Math.max(8, (day.saved / maxDaily) * 48)}px`,
                    borderRadius: 6,
                    background: "linear-gradient(180deg, #fb923c, #c8872e)",
                    opacity: 0.9,
                  }}
                  title={`RTK token savings — ${day.date}: ${day.saved} tokens saved via shell-output reduction on this day.`}
                />
                <span style={{ fontSize: 8, opacity: 0.4 }}>{day.date ? day.date.slice(5) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 12 }}>
        <MiniList title="RTK profiles" items={data.rtk_profiles.map((p) => p.name)} empty="No RTK-tagged profiles" />
        <MiniList title="Shell-heavy agents" items={data.shell_agents.map((a) => a.name)} empty="None detected on scan" />
      </div>

      {data.recommendations.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.recommendations.slice(0, compact ? 2 : 3).map((rec) => (
            <div
              key={rec.id}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <TrendingDown size={14} color="#fb923c" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5" }}>{rec.title}</div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3, lineHeight: 1.45 }}>{rec.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!data.prevention.rtk.present && (
        <div style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Flame size={13} color="#fb923c" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Prevention layer: install RTK in WSL, run <code style={{ opacity: 0.9 }}>rtk init -g</code>, then refresh. Measurement from{" "}
            <code style={{ opacity: 0.9 }}>rtk gain --all --format json</code> (v2 external dashboards optional).
          </span>
        </div>
      )}
    </div>
  );
}

function BurnStat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: ok ? "#4ade80" : "#fb923c", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function MiniList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 8 }}>{title}</div>
      {items.length > 0 ? (
        items.slice(0, 4).map((item) => (
          <div key={item} style={{ fontSize: 12, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: 0.8 }}>
            {item}
          </div>
        ))
      ) : (
        <div style={{ fontSize: 12, opacity: 0.45 }}>{empty}</div>
      )}
    </div>
  );
}