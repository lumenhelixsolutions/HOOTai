import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useSessionPoll } from "@/hooks/useSessionPoll";
import type { LedgerRange, TokenLedgerDay, TokenLedgerPayload } from "@/lib/token-ledger-types";
import { LEDGER_ROWS } from "@/lib/token-ledger-types";
import {
  addDays,
  cellBackground,
  daysBetween,
  formatClock,
  formatDate,
  formatExact,
  formatNumber,
  formatShare,
  getValue,
  levelFor,
  logLinePath,
  movingAverage,
  parseDate,
  rangeDates,
  rowStats,
  sparkPath,
  sumDays,
} from "@/lib/token-ledger-view";

const RANGE_OPTIONS: { id: LedgerRange; label: string }[] = [
  { id: "90", label: "90d" },
  { id: "180", label: "180d" },
  { id: "365", label: "1y" },
  { id: "all", label: "All" },
];

function Section({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: "20px 22px",
        borderRadius: 14,
        background: "rgba(18,16,14,0.6)",
        border: "1px solid rgba(255,176,66,0.1)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginBottom: caption ? 4 : 16 }}>
        <h3 style={{ fontFamily: "'EB Garamond', serif", fontSize: 18, fontWeight: 400, margin: 0, color: "#f5e6d0" }}>{title}</h3>
        {caption && <span style={{ fontSize: 11, opacity: 0.45 }}>{caption}</span>}
      </div>
      {caption && <p style={{ margin: "0 0 16px", fontSize: 11, opacity: 0.48, lineHeight: 1.45 }}>{caption}</p>}
      {children}
    </section>
  );
}

export default function TokenLedgerPage() {
  const [data, setData] = useState<TokenLedgerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<LedgerRange>("365");
  const [footprint, setFootprint] = useState<Awaited<ReturnType<typeof api.discoverTokenLedger>> | null>(null);
  const [discovering, setDiscovering] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setRefreshing(true);
    try {
      const report = await api.getTokenLedger(refresh);
      setData(report);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const scanSystem = useCallback(async () => {
    setDiscovering(true);
    try {
      const disc = await api.discoverTokenLedger();
      setFootprint(disc);
      await load(true);
    } finally {
      setDiscovering(false);
    }
  }, [load]);

  useSessionPoll(() => load(true), { immediate: true });

  const visible = useMemo(() => {
    if (!data) return null;
    const [start, end] = rangeDates(data, range);
    const leadingStart = addDays(start, -start.getDay());
    const gridDays = daysBetween(data, leadingStart, end);
    const visibleDays = daysBetween(data, start, end);
    const thresholds = data.metadata.scale?.thresholds || [0, 0, 0, 0];
    const momentSet = new Set((data.metadata.key_moments || []).map((m) => m.date));
    const visibleMoments = (data.metadata.key_moments || [])
      .filter((m) => {
        const d = parseDate(m.date);
        return d >= start && d <= end;
      })
      .sort((a, b) => b.total_tokens - a.total_tokens);
    const peak = visibleDays.reduce(
      (best, day) => (getValue(day, "total") > getValue(best, "total") ? day : best),
      visibleDays[0],
    );
    const weeks = Math.ceil(gridDays.length / 7);
    return { start, end, gridDays, visibleDays, thresholds, momentSet, visibleMoments, peak, weeks, leadingStart };
  }, [data, range]);

  if (loading) return <div style={{ opacity: 0.5, fontSize: 13 }}>Loading token ledger…</div>;
  if (!data) return <div style={{ opacity: 0.5, fontSize: 13 }}>Failed to load token ledger.</div>;

  const meta = data.metadata;
  const eq = meta.equivalents;
  const assumptions = eq.assumptions as Record<string, number>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1180 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontSize: 28, margin: 0, fontWeight: 400, color: "#f5e6d0" }}>
            Token Ledger
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.55, maxWidth: 640, lineHeight: 1.5 }}>
            Overall local AI footprint — Codex, Claude Code, Gemini CLI, Grok, Cursor, and H00T logs when discovered. Use <strong>Scan system</strong> to find token logs across clients.
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11, opacity: 0.4 }}>
            Updated {formatDate(meta.generated_at.slice(0, 10), { year: true })} · {meta.refresh_mode} · {meta.timezone}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "inline-flex", gap: 2, padding: 2, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                style={{
                  minWidth: 52,
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: 0,
                  cursor: "pointer",
                  fontSize: 11,
                  background: range === opt.id ? "#ffb042" : "transparent",
                  color: range === opt.id ? "#12100e" : "#aaa",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void scanSystem()}
            disabled={discovering || refreshing}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,176,66,0.35)",
              background: "rgba(255,176,66,0.1)",
              color: "#ffb042",
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Flame size={14} />
            {discovering ? "Scanning system…" : "Scan system for logs"}
          </button>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,176,66,0.35)",
              background: "rgba(255,176,66,0.1)",
              color: "#ffb042",
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
            {refreshing ? "Refreshing…" : "Refresh ingest"}
          </button>
        </div>
      </header>

      {(footprint || (meta as any).sources?.footprint) && (
        <Section title="AI footprint sources" caption="Read-only discovery of local LLM client logs (Claude, Codex, Gemini, Grok, Cursor, H00T).">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {((footprint?.sources || (meta as any).sources?.footprint?.sources || []) as Array<any>).map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${s.present ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)"}`,
                  background: s.present ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.02)",
                  minWidth: 140,
                  fontSize: 11,
                }}
              >
                <div style={{ fontWeight: 600, color: s.present ? "#6ee7b7" : "#aaa" }}>{s.label}</div>
                <div style={{ opacity: 0.55, marginTop: 4 }}>
                  {s.present ? `${s.files} log files · probe ~${formatNumber(s.tokens_probe || 0)} tok` : "not found"}
                </div>
              </div>
            ))}
          </div>
          {(footprint?.summary || (meta as any).footprint_summary) && (
            <p style={{ margin: "12px 0 0", fontSize: 11, opacity: 0.5 }}>
              {(footprint?.summary || (meta as any).footprint_summary).sources_present} sources ·{" "}
              {(footprint?.summary || (meta as any).footprint_summary).files} files · probe{" "}
              {formatNumber((footprint?.summary || (meta as any).footprint_summary).tokens_probe || 0)} tokens sampled
            </p>
          )}
        </Section>
      )}

      {meta.empty && (
        <div style={{ padding: 16, borderRadius: 12, border: "1px solid rgba(255,176,66,0.2)", background: "rgba(255,176,66,0.06)", fontSize: 12, lineHeight: 1.55 }}>
          <strong style={{ color: "#ffb042" }}>No token data yet.</strong> Click <strong>Scan system for logs</strong> to discover Claude/Codex/Grok/Gemini/H00T usage files, then Refresh ingest.
          {!meta.configured && (
            <p style={{ margin: "8px 0 0", opacity: 0.75 }}>
              Paths are auto-discovered under your home directory and H00T state — no manual CSV required for JSONL clients.
            </p>
          )}
        </div>
      )}

      <Section title="Daily token burn" caption="Weekly total line: log y-scale; daily cells: log color scale">
        <BurnNowStrip meta={meta} />
        {visible && (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.5 }}>
              {formatNumber(sumDays(visible.visibleDays, "total"))} tokens in view. Peak day {formatNumber(getValue(visible.peak, "total"))} on {formatDate(visible.peak.date, { year: true })}.
            </p>
            <BurnHeatmap data={data} visible={visible} />
            <BurnMomentTable moments={visible.visibleMoments} />
          </>
        )}
      </Section>

      <Section title="What is driving the burn?" caption="Sorted by share; Codex groups plus separated Claude and ChatGPT estimates">
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Work family", "Tokens", "Share", "Evidence"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(meta.work_breakdown?.groups || []).map((g) => (
              <tr key={g.name}>
                <td style={tdLeft}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{g.note}</div>
                </td>
                <td style={tdRight}>{formatNumber(g.total_tokens)}</td>
                <td style={tdRight}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                    <div style={{ position: "relative", height: 18, background: "rgba(255,255,255,0.06)" }}>
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: `${Math.max(1, Math.min(100, g.share * 100))}%`,
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: "#ffb042",
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                    </div>
                    <span>{formatShare(g.share)}</span>
                  </div>
                </td>
                <td style={{ ...tdLeft, opacity: 0.55, fontSize: 11 }}>
                  {(g.examples || []).map((e) => `${formatDate(e.date)} ${e.label} (${formatNumber(e.tokens)})`).join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: "10px 0 0", fontSize: 11, opacity: 0.45 }}>{meta.work_breakdown?.method}</p>
      </Section>

      <table style={tableStyle}>
        <thead>
          <tr>
            {["Tool", "Today", "Last 7 days", "Last 30 days", "Peak day", "Active days", "30d shape"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEDGER_ROWS.map((row) => {
            const stats = rowStats(data, row.key);
            const sparkMax = Math.max(1, ...stats.sparkValues);
            return (
              <tr key={row.key}>
                <td style={tdLeft}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{row.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>{row.note}</div>
                </td>
                <td style={tdRight}>{formatNumber(stats.today)}</td>
                <td style={tdRight}>{formatNumber(stats.last7)}</td>
                <td style={tdRight}>{formatNumber(stats.last30)}</td>
                <td style={tdRight}>
                  {formatNumber(getValue(stats.peak, row.key))}
                  <div style={{ fontSize: 10, opacity: 0.45 }}>{stats.peak?.date ? formatDate(stats.peak.date, { year: true }) : "—"}</div>
                </td>
                <td style={tdRight}>{stats.activeDays}d</td>
                <td style={tdRight}>
                  <svg width={118} height={26} viewBox="0 0 118 26" aria-hidden>
                    <line x1="0" x2="118" y1="25.5" y2="25.5" stroke="rgba(255,255,255,0.1)" />
                    <path d={sparkPath(stats.sparkValues, 118, 26, sparkMax)} fill="none" stroke="#ffb042" strokeWidth={1.8} />
                  </svg>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Section title="Scale equivalents" caption="Fermi estimates from cumulative token burn">
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Measure", "Estimate", "Equivalent", "Basis"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdLeft}>Water</td>
              <td style={tdRight}>{formatExact(Math.round(eq.water.ai_gallons))} gal</td>
              <td style={tdRight}>{eq.water.almond_latte_equivalent.toFixed(1)} almond-milk lattes</td>
              <td style={{ ...tdLeft, fontSize: 11, opacity: 0.55 }}>
                {assumptions.tokens_per_query_equivalent} tokens/query-equiv; {assumptions.ai_water_gallons_per_query} gal/query
              </td>
            </tr>
            <tr>
              <td style={tdLeft}>Electricity</td>
              <td style={tdRight}>{formatExact(Math.round(eq.electricity.ai_kwh))} kWh</td>
              <td style={tdRight}>{formatExact(Math.round(eq.electricity.netflix_big_screen_movie_equivalent))} Netflix movies</td>
              <td style={{ ...tdLeft, fontSize: 11, opacity: 0.55 }}>{assumptions.ai_energy_wh_per_query} Wh/query-equiv</td>
            </tr>
            <tr>
              <td style={tdLeft}>Code</td>
              <td style={tdRight}>{formatExact(Math.round(eq.code.gross_loc_equivalent))} gross LOC</td>
              <td style={tdRight}>{eq.code.engineer_years_mid.toFixed(1)} engineer-years (mid)</td>
              <td style={{ ...tdLeft, fontSize: 11, opacity: 0.55 }}>{assumptions.tokens_per_loc} tokens/LOC</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {visible && (
        <Section title="30-day moving average" caption="Shared log y-scale per provider lane">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
            {LEDGER_ROWS.map((row) => {
              const series = movingAverage(visible.visibleDays, row.key, 30);
              const positives = series.map((p) => p.value).filter((v) => v > 0);
              const yMin = positives.length ? Math.min(...positives) : 1;
              const yMax = positives.length ? Math.max(...positives) : 1;
              const width = 280;
              const height = 86;
              return (
                <div key={row.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                    <strong>{row.label}</strong>
                    <span style={{ opacity: 0.5 }}>{formatNumber(series.at(-1)?.value || 0)}</span>
                  </div>
                  <svg width="100%" height={104} viewBox={`0 0 ${width} 104`} role="img">
                    <line x1="0" x2={width} y1={height} y2={height} stroke="rgba(255,255,255,0.1)" />
                    <path d={logLinePath(series, width, height, yMin, yMax)} fill="none" stroke="#ffb042" strokeWidth={2} />
                    <text x="0" y="102" fill="rgba(255,255,255,0.4)" fontSize="10">
                      {series[0]?.date ? formatDate(series[0].date) : ""}
                    </text>
                    <text x={width} y="102" textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10">
                      {series.at(-1)?.date ? formatDate(series.at(-1)!.date) : ""}
                    </text>
                  </svg>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Recent detail" caption="Last 14 days · provider breakdown">
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Date", "Total", "Codex", "Claude", "ChatGPT", "Claude exact", "Claude chat est.", "ChatGPT export", "ChatGPT activity", "Codex threads", "Claude calls"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.days.slice(-14).reverse().map((day) => (
                <tr key={day.date}>
                  <td style={tdLeft}>{formatDate(day.date, { weekday: "short" })}</td>
                  <td style={tdRight}>{formatNumber(day.total_tokens)}</td>
                  <td style={tdRight}>{formatNumber(day.codex.total_tokens)}</td>
                  <td style={tdRight}>{formatNumber(day.claude.total_tokens)}</td>
                  <td style={tdRight}>{formatNumber(day.chatgpt.total_tokens)}</td>
                  <td style={tdRight}>{formatNumber(day.claude.exact_logged_tokens)}</td>
                  <td style={tdRight}>{formatNumber(day.claude.estimated_chat_tokens)}</td>
                  <td style={tdRight}>{formatNumber(day.chatgpt.export_estimated_tokens || 0)}</td>
                  <td style={tdRight}>{formatNumber(day.chatgpt.activity_estimated_tokens || 0)}</td>
                  <td style={tdRight}>{formatExact(day.codex.threads || 0)}</td>
                  <td style={tdRight}>{formatExact(day.claude.exact_calls || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          fontSize: 11,
          opacity: 0.65,
        }}
      >
        <Flame size={14} color="#ffb042" />
        RTK prevention stats live on Overview and Readiness — this ledger tracks provider token volume, not shell savings.
      </div>
    </div>
  );
}

function BurnNowStrip({ meta }: { meta: TokenLedgerPayload["metadata"] }) {
  const lh = meta.current?.last_hour;
  const dtd = meta.current?.day_to_date;
  const windowLabel =
    lh?.window_start && lh?.window_end
      ? `${formatClock(lh.window_start)} – ${formatClock(lh.window_end)}`
      : "Latest 60 minutes";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 24, marginBottom: 16, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div>
        <div style={{ fontSize: 11, opacity: 0.45 }}>Last hour</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: "#f5e6d0", marginTop: 2 }}>{formatNumber(lh?.total_tokens || 0)}</div>
        <div style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>{windowLabel}; {lh?.basis || "Exact local Codex events"}</div>
      </div>
      <div>
        <div style={{ fontSize: 11, opacity: 0.45 }}>Day to date</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: "#f5e6d0", marginTop: 2 }}>{formatNumber(dtd?.total_tokens || 0)}</div>
        <div style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>
          {dtd?.date ? formatDate(dtd.date, { year: true }) : "Today"}; {dtd?.basis || "Current day"}
        </div>
      </div>
    </div>
  );
}

function BurnHeatmap({
  data,
  visible,
}: {
  data: TokenLedgerPayload;
  visible: {
    start: Date;
    end: Date;
    gridDays: TokenLedgerDay[];
    visibleDays: TokenLedgerDay[];
    thresholds: number[];
    momentSet: Set<string>;
    weeks: number;
    leadingStart: Date;
  };
}) {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: visible.weeks }, (_, index) => ({
    weekIndex: index,
    start: addDays(visible.leadingStart, index * 7),
    total: 0,
    firstDate: "",
    lastDate: "",
  }));
  visible.visibleDays.forEach((day) => {
    const date = parseDate(day.date);
    const weekIndex = Math.floor((date.getTime() - visible.leadingStart.getTime()) / weekMs);
    if (buckets[weekIndex]) {
      buckets[weekIndex].total += getValue(day, "total");
      buckets[weekIndex].firstDate ||= day.date;
      buckets[weekIndex].lastDate = day.date;
    }
  });
  const active = buckets.filter((b) => b.total > 0);
  const totals = active.map((b) => b.total);
  const minLog = Math.log10(Math.max(1, Math.min(...totals, 1)));
  const maxLog = Math.log10(Math.max(...totals, 1));
  const span = Math.max(0.0001, maxLog - minLog);
  const sparkH = 42;
  const yFor = (value: number) => sparkH - ((Math.log10(Math.max(1, value)) - minLog) / span) * sparkH;
  const points = active.map((b) => ({ ...b, x: b.weekIndex * 17 + 6.5, y: yFor(b.total) }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "112px 1fr", gap: "10px 18px", minWidth: 480 }}>
        <div style={{ alignSelf: "end", fontSize: 12 }}>
          <strong>Weekly total</strong>
          <div style={{ opacity: 0.45, fontSize: 11 }}>{active.length ? `${formatNumber(active.at(-1)?.total || 0)} latest` : "log y-scale"}</div>
        </div>
        <svg width={visible.weeks * 17} height={54} style={{ display: "block" }}>
          <line x1="0" x2={visible.weeks * 17} y1={sparkH} y2={sparkH} stroke="rgba(255,255,255,0.1)" />
          {path && <path d={path} fill="none" stroke="#ffb042" strokeWidth={1.8} />}
        </svg>
        {LEDGER_ROWS.map((row) => (
          <div key={row.key} style={{ display: "contents" }}>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
              <strong style={{ fontSize: 13 }}>{row.label}</strong>
              <div style={{ fontSize: 11, opacity: 0.45 }}>{formatNumber(sumDays(visible.visibleDays, row.key))}</div>
            </div>
            <div
              style={{
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: "13px",
                gridTemplateRows: "repeat(7, 13px)",
                gap: 4,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                paddingTop: 8,
                width: "max-content",
              }}
            >
              {visible.gridDays.map((day) => {
                const date = parseDate(day.date);
                const weekIndex = Math.floor((date.getTime() - visible.leadingStart.getTime()) / weekMs);
                const dayIndex = date.getDay();
                const inView = date >= visible.start && date <= visible.end;
                const level = levelFor(getValue(day, row.key), visible.thresholds);
                const isToday = day.date === data.metadata.today;
                const isMoment = visible.momentSet.has(day.date);
                return (
                  <button
                    key={`${row.key}-${day.date}`}
                    type="button"
                    title={`${row.label} · ${formatDate(day.date, { weekday: "short", year: true })}: ${formatExact(getValue(day, row.key))} tokens`}
                    style={{
                      gridColumn: weekIndex + 1,
                      gridRow: dayIndex + 1,
                      width: 13,
                      height: 13,
                      padding: 0,
                      borderRadius: 2,
                      border: isToday || isMoment ? "1px solid #f5e6d0" : "1px solid rgba(255,255,255,0.05)",
                      background: inView ? cellBackground(level) : "transparent",
                      visibility: inView ? "visible" : "hidden",
                      cursor: inView ? "pointer" : "default",
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 10, opacity: 0.5 }}>
        <span>Log color</span>
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ width: 13, height: 13, borderRadius: 2, background: cellBackground(i) }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function BurnMomentTable({ moments }: { moments: TokenLedgerPayload["metadata"]["key_moments"] }) {
  return (
    <table style={{ ...tableStyle, marginTop: 16 }}>
      <thead>
        <tr>
          {["Date", "Burn", "Moment", "Driver"].map((h) => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {moments.map((m) => (
          <tr key={m.date}>
            <td style={tdLeft}>{formatDate(m.date, { year: true })}</td>
            <td style={tdRight}>{formatNumber(m.total_tokens)}</td>
            <td style={tdLeft}>
              <div style={{ fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                Codex {formatNumber(m.codex_tokens)} / Claude {formatNumber(m.claude_tokens)} / ChatGPT {formatNumber(m.chatgpt_tokens)}
              </div>
            </td>
            <td style={{ ...tdLeft, opacity: 0.55, fontSize: 12 }}>{m.driver}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const thStyle: React.CSSProperties = {
  textAlign: "right",
  padding: "8px 8px",
  color: "rgba(255,255,255,0.45)",
  fontWeight: 500,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const tdRight: React.CSSProperties = {
  textAlign: "right",
  padding: "8px 8px",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
  borderTop: "1px solid rgba(255,255,255,0.05)",
};

const tdLeft: React.CSSProperties = {
  ...tdRight,
  textAlign: "left",
};