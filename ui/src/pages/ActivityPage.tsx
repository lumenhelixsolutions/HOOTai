import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useCoach } from "@/context/CoachContext";
import type { ActivityAnalytics, DiarySourceFilter, DiaryViewMode } from "@/lib/activity-types";
import ActivityKpiStrip from "@/components/activity/ActivityKpiStrip";
import ActivityCalendarHeatmap from "@/components/activity/ActivityCalendarHeatmap";
import ActivityTrendLine from "@/components/activity/ActivityTrendLine";
import ActivityDriverTable from "@/components/activity/ActivityDriverTable";
import ActivityDotPlot from "@/components/activity/ActivityDotPlot";
import ActivityDriversTable from "@/components/activity/ActivityDriversTable";
import ActivityProjectDriversTable from "@/components/activity/ActivityProjectDriversTable";
import ActivityAgentTable from "@/components/activity/ActivityAgentTable";
import ActivityTimeline, { TYPE_OPTIONS } from "@/components/activity/ActivityTimeline";
import ActivityLiveStrip from "@/components/activity/ActivityLiveStrip";
import ActivitySessionCards from "@/components/activity/ActivitySessionCards";
import ActivityTelemetryHealthPanel from "@/components/activity/ActivityTelemetryHealth";
import ActivityDayRollup from "@/components/activity/ActivityDayRollup";
import { useSessionPoll } from "@/hooks/useSessionPoll";

const DAY_OPTIONS = [7, 30, 90] as const;
type PatternTab = "calendar" | "drivers" | "agents" | "projects";

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
      <h3 style={{ fontFamily: "'EB Garamond', serif", fontSize: 18, fontWeight: 400, margin: "0 0 4px", color: "#f5e6d0" }}>{title}</h3>
      {caption && <p style={{ margin: "0 0 16px", fontSize: 11, opacity: 0.48, lineHeight: 1.45 }}>{caption}</p>}
      {!caption && <div style={{ marginBottom: 16 }} />}
      {children}
    </section>
  );
}

function isPageVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

export default function ActivityPage() {
  const [analytics, setAnalytics] = useState<ActivityAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [writing, setWriting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);
  const [patternTab, setPatternTab] = useState<PatternTab>("calendar");
  const [diaryView, setDiaryView] = useState<DiaryViewMode>("grouped");
  const [sourceFilter, setSourceFilter] = useState<DiarySourceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { setPageContext } = useCoach();

  const load = useCallback(async (opts?: { days?: number; touchRadar?: boolean }) => {
    const windowDays = opts?.days ?? days;
    setRefreshing(true);
    try {
      if (opts?.touchRadar !== false && isPageVisible()) {
        await api.getAgentRadar().catch(() => null);
      }
      const data = await api.getActivityAnalytics(windowDays);
      setAnalytics(data);
      setPageContext({ activityToday: data.kpis.today.events });
      setSelectedDate((prev) => prev || data.range.to);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, setPageContext]);

  useSessionPoll(() => load({ touchRadar: true }), { immediate: true });

  const timelineDate = selectedDate || analytics?.range.to || null;

  const selectedDayRollup = useMemo(() => {
    if (!analytics || !timelineDate) return null;
    return analytics.daily_series.find((d) => d.date === timelineDate) || null;
  }, [analytics, timelineDate]);

  const filteredGroups = useMemo(() => {
    if (!analytics) return [];
    const groups = analytics.session_groups;
    if (sourceFilter === "all") return groups;
    if (sourceFilter === "hoot") return groups.filter((g) => g.kind === "hoot");
    if (sourceFilter === "dock") return groups.filter((g) => g.source === "agentdock");
    if (sourceFilter === "external") return groups.filter((g) => g.source === "external");
    return groups;
  }, [analytics, sourceFilter]);

  const driverCaption = useMemo(() => {
    if (!analytics || analytics.empty) {
      return "Radar diffs and HOOT launches populate daily agent minutes. Run a session or open Terminal to start.";
    }
    return `${analytics.range.from} → ${analytics.range.to} · log color scale on calendar`;
  }, [analytics]);

  const writeDiary = async () => {
    setWriting(true);
    try {
      await api.writeDiary(timelineDate || undefined);
      await load({ touchRadar: false });
    } finally {
      setWriting(false);
    }
  };

  const exportJson = async () => {
    const blob = await api.exportActivityJson(days);
    const url = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `hoot-activity-${analytics?.range.to || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filterSelectStyle = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.03)",
    color: "#dadada",
    fontSize: 11,
  } as const;

  if (loading) return <div style={{ opacity: 0.5, fontSize: 13 }}>Loading operator telemetry…</div>;
  if (!analytics) return <div style={{ opacity: 0.5, fontSize: 13 }}>Failed to load activity analytics.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1200 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontSize: 28, margin: 0, fontWeight: 400, color: "#f5e6d0" }}>
            Operator Telemetry
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.55, maxWidth: 520, lineHeight: 1.5 }}>
            Session diary, radar history, and launch outcomes — grouped sessions with live agent snapshot.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as (typeof DAY_OPTIONS)[number])}
            style={filterSelectStyle}
            aria-label="Analytics window"
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}d window</option>
            ))}
          </select>
          <button type="button" onClick={() => load({ touchRadar: true })} disabled={refreshing} style={btnStyle(false)}>
            <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" onClick={exportJson} style={btnStyle(false)}>
            <Download size={14} />
            Export JSON
          </button>
          <button type="button" onClick={writeDiary} disabled={writing} style={btnStyle(true)}>
            {writing ? "Writing…" : "Write diary .md"}
          </button>
        </div>
      </header>

      <ActivityLiveStrip live={analytics.live} health={analytics.telemetry_health} />

      <ActivityKpiStrip data={analytics} />

      <Section title="Session diary" caption={timelineDate ? `${timelineDate} · calendar selects day · grouped or raw events` : "Recent sessions"}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {(["grouped", "raw"] as DiaryViewMode[]).map((mode) => (
            <button key={mode} type="button" onClick={() => setDiaryView(mode)} style={tabBtn(diaryView === mode)}>
              {mode === "grouped" ? "Grouped sessions" : "Raw events"}
            </button>
          ))}
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as DiarySourceFilter)} style={filterSelectStyle}>
            <option value="all">All sources</option>
            <option value="hoot">HOOT launches</option>
            <option value="dock">Docked agents</option>
            <option value="external">External agents</option>
          </select>
          {diaryView === "raw" && (
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={filterSelectStyle}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t === "all" ? "All event types" : t}</option>
              ))}
            </select>
          )}
        </div>
        {diaryView === "grouped" ? (
          <ActivitySessionCards groups={filteredGroups} filterDate={timelineDate} />
        ) : (
          <ActivityTimeline events={analytics.timeline} filterDate={timelineDate} sourceFilter={sourceFilter} typeFilter={typeFilter} />
        )}
        <ActivityDayRollup day={selectedDayRollup} />
      </Section>

      <Section title="Activity patterns" caption={driverCaption}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {(
            [
              ["calendar", "Calendar & trend"],
              ["drivers", "Agent drivers"],
              ["agents", "Agent comparison"],
              ["projects", "By project"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPatternTab(id)} style={tabBtn(patternTab === id)}>
              {label}
            </button>
          ))}
        </div>
        {patternTab === "calendar" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24 }}>
              <ActivityTrendLine series={analytics.daily_series} />
              <ActivityCalendarHeatmap weeks={analytics.calendar_weeks} selectedDate={timelineDate} onSelect={setSelectedDate} />
            </div>
            <div style={{ marginTop: 20 }}>
              <ActivityDriverTable days={analytics.daily_series} selectedDate={timelineDate} onSelect={setSelectedDate} />
            </div>
          </>
        )}
        {patternTab === "drivers" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
            <ActivityDotPlot drivers={analytics.drivers} />
            <ActivityDriversTable drivers={analytics.drivers} />
          </div>
        )}
        {patternTab === "agents" && <ActivityAgentTable agents={analytics.agent_comparison} />}
        {patternTab === "projects" && <ActivityProjectDriversTable drivers={analytics.project_drivers} />}
      </Section>

      <ActivityTelemetryHealthPanel health={analytics.telemetry_health} radarMeta={analytics.radar_meta} />
    </div>
  );
}

function btnStyle(primary: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: primary ? "1px solid rgba(255,176,66,0.35)" : "1px solid rgba(255,255,255,0.1)",
    background: primary ? "rgba(255,176,66,0.1)" : "rgba(255,255,255,0.03)",
    color: primary ? "#ffb042" : "#dadada",
    cursor: "pointer",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as const;
}

function tabBtn(active: boolean) {
  return {
    padding: "7px 12px",
    borderRadius: 8,
    border: active ? "1px solid rgba(255,176,66,0.35)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(255,176,66,0.1)" : "transparent",
    color: active ? "#ffb042" : "#aaa",
    cursor: "pointer",
    fontSize: 11,
  } as const;
}