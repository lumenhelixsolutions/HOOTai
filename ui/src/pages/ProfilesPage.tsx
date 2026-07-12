import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronRight, Eye, Filter,
  Layers3, PlayCircle, Search, ShieldAlert, Sparkles, Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useCoach } from "@/context/CoachContext";
import {
  TASK_INTENTS, getAgentTheme, normalizeAgentId, profileMatchesTask,
  sortProfilesForPick, statusTone,
} from "@/lib/profileTaxonomy";

type ViewMode = "easy" | "advanced";

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("easy");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [easyAgent, setEasyAgent] = useState<string | null>(null);
  const [easyTask, setEasyTask] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const toast = useToast();
  const { setPageContext, registerActionHandler } = useCoach();

  useEffect(() => {
    api.getProfiles()
      .then((data) => {
        setProfiles(data || []);
        const agents = [...new Set((data || []).map((p: any) => normalizeAgentId(p.meta?.frontend)))];
        const expanded: Record<string, boolean> = {};
        agents.forEach((a) => { expanded[a] = true; });
        setExpandedAgents(expanded);
        setLoading(false);
      })
      .catch((error: any) => {
        setLoading(false);
        toast.showToast(error.message || "Failed to load profiles", "error");
      });
  }, [toast]);

  const filtered = useMemo(() => {
    return profiles.filter((profile) => {
      const haystack = [profile.name, profile.id, profile.meta?.frontend, profile.meta?.backend, profile.meta?.model, profile.taskMode]
        .filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || profile.state === statusFilter;
      const matchesAgent = agentFilter === "all" || normalizeAgentId(profile.meta?.frontend) === agentFilter;
      return matchesSearch && matchesStatus && matchesAgent;
    });
  }, [profiles, search, statusFilter, agentFilter]);

  const agentGroups = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const profile of filtered) {
      const agent = normalizeAgentId(profile.meta?.frontend);
      if (!groups.has(agent)) groups.set(agent, []);
      groups.get(agent)!.push(profile);
    }
    return [...groups.entries()]
      .map(([agent, items]) => ({
        agent,
        theme: getAgentTheme(agent),
        items: sortProfilesForPick(items),
        ready: items.filter((p) => p.state === "READY").length,
        total: items.length,
        launches: items.reduce((sum, p) => sum + (p.telemetry?.launchCount || 0), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const easyMatches = useMemo(() => {
    if (!easyAgent || !easyTask) return [];
    return sortProfilesForPick(
      profiles.filter((p) => normalizeAgentId(p.meta?.frontend) === easyAgent && profileMatchesTask(p, easyTask))
    );
  }, [profiles, easyAgent, easyTask]);

  const easyTopPick = easyMatches[0] || null;

  const stats = useMemo(() => ({
    total: profiles.length,
    ready: profiles.filter((p) => p.state === "READY").length,
    fixable: profiles.filter((p) => p.state === "DEGRADED").length,
    blocked: profiles.filter((p) => p.state === "BLOCKED").length,
    agents: agentGroups.length,
  }), [profiles, agentGroups]);

  const inspect = async (profile: any) => {
    setSelected(profile);
    try {
      setPreview(await api.dryRun(profile.id));
    } catch (error: any) {
      setPreview({ error: error.message || "Preview failed" });
      toast.showToast(error.message || "Preview failed", "error");
    }
  };

  const launchProfile = async (profile: any, overrideReason?: string) => {
    setLaunchingId(profile.id);
    try {
      const result = await api.launch(profile.id, overrideReason);
      if (result.blocked) toast.showToast(result.message || "Launch blocked", "warning", 6000);
      else if (result.session) toast.showToast(`Launched ${result.session.profileName}`, "success");
    } catch (error: any) {
      toast.showToast(error.message || "Launch failed", "error");
    } finally {
      setLaunchingId(null);
    }
  };

  const resetEasy = () => { setEasyAgent(null); setEasyTask(null); };
  const easyStep = !easyAgent ? 1 : !easyTask ? 2 : 3;

  useEffect(() => {
    setPageContext({
      viewMode,
      profileCount: profiles.length,
      blockedCount: stats.blocked,
      profilesBlocked: stats.blocked,
      easyStep,
      easyTopPickId: easyTopPick?.id || null,
      easyTopPickName: easyTopPick?.name || null,
    });
  }, [viewMode, profiles.length, stats.blocked, easyStep, easyTopPick, setPageContext]);

  useEffect(() => {
    return registerActionHandler((target) => {
      if (target === "profiles-easy-mode") setViewMode("easy");
      if (target === "profiles-launch-top" && easyTopPick) launchProfile(easyTopPick);
    });
  }, [easyTopPick, registerActionHandler]);

  if (loading) {
    return <div style={{ minHeight: "50vh", display: "grid", placeItems: "center", opacity: 0.56 }}>Loading profiles…</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section style={{ padding: 22, borderRadius: 22, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.42, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Profile Library</div>
              <div style={{ fontSize: 28, color: "#ffffff", fontWeight: 600, letterSpacing: "-0.05em" }}>{stats.total} launch profiles, organized as a reusable catalog.</div>
              <div style={{ fontSize: 14, opacity: 0.68, lineHeight: 1.7, marginTop: 10 }}>
                Launch Center is the guided review-and-run surface. This page stays focused on browsing, filtering, and inspecting the full profile library.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <ModeButton active={viewMode === "easy"} onClick={() => setViewMode("easy")} label="Easy 1-2-3" />
              <ModeButton active={viewMode === "advanced"} onClick={() => setViewMode("advanced")} label="Advanced" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
            <StatTile label="Profiles" value={stats.total} />
            <StatTile label="Agents" value={stats.agents} accent="#7dd3fc" />
            <StatTile label="Ready" value={stats.ready} accent="#86efac" />
            <StatTile label="Blocked" value={stats.blocked} accent="#fca5a5" />
          </div>

          {viewMode === "advanced" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr 0.7fr", gap: 10 }}>
              <InputShell icon={Search}>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search profiles, models, tasks…" style={inputStyle} />
              </InputShell>
              <InputShell icon={Filter}>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
                  <option value="all">All states</option>
                  <option value="READY">Ready</option>
                  <option value="DEGRADED">Fixable</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </InputShell>
              <InputShell icon={Layers3}>
                <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} style={inputStyle}>
                  <option value="all">All agents</option>
                  {agentGroups.map((g) => <option key={g.agent} value={g.agent}>{g.theme.label}</option>)}
                </select>
              </InputShell>
            </div>
          )}
        </section>

        {viewMode === "easy" ? (
          <EasyPicker
            step={easyStep}
            agentGroups={agentGroups}
            easyAgent={easyAgent}
            easyTask={easyTask}
            easyMatches={easyMatches}
            easyTopPick={easyTopPick}
            onPickAgent={(agent) => { setEasyAgent(agent); setEasyTask(null); }}
            onPickTask={(task) => setEasyTask(task)}
            onReset={resetEasy}
            onInspect={inspect}
            onLaunch={launchProfile}
            launchingId={launchingId}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {agentGroups.map((group) => (
              <AgentSection
                key={group.agent}
                group={group}
                expanded={expandedAgents[group.agent] !== false}
                onToggle={() => setExpandedAgents((prev) => ({ ...prev, [group.agent]: !prev[group.agent] }))}
                onInspect={inspect}
                onLaunch={launchProfile}
                launchingId={launchingId}
              />
            ))}
          </div>
        )}
      </div>

      <AuditPanel
        selected={selected}
        preview={preview}
        launchingId={launchingId}
        onLaunch={launchProfile}
      />
    </div>
  );
}

function EasyPicker({
  step, agentGroups, easyAgent, easyTask, easyMatches, easyTopPick,
  onPickAgent, onPickTask, onReset, onInspect, onLaunch, launchingId,
}: any) {
  const agentTheme = easyAgent ? getAgentTheme(easyAgent) : null;

  return (
    <section style={{ padding: 24, borderRadius: 24, background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        <StepBadge n={1} label="Pick agent" active={step === 1} done={step > 1} color={agentTheme?.color} />
        <StepBadge n={2} label="Pick task" active={step === 2} done={step > 2} color={agentTheme?.color} />
        <StepBadge n={3} label="Launch" active={step === 3} done={false} color={agentTheme?.color} />
        {(easyAgent || easyTask) && (
          <button onClick={onReset} style={{ marginLeft: "auto", ...ghostButtonStyle }}>Start over</button>
        )}
      </div>

      {step === 1 && (
        <>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>1. Which agent are you launching?</div>
          <div style={{ fontSize: 14, opacity: 0.62, marginBottom: 20 }}>Big tiles, color-coded by frontend. Pick the tool you actually have installed.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {agentGroups.map((group: any) => (
              <button key={group.agent} onClick={() => onPickAgent(group.agent)} style={{
                textAlign: "left", padding: 22, borderRadius: 20, cursor: "pointer",
                background: group.theme.bg, border: `2px solid ${group.theme.border}`,
                boxShadow: `0 0 0 1px ${group.theme.glow}`,
              }}>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: group.theme.color, marginBottom: 8 }}>Agent</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em" }}>{group.theme.label}</div>
                <div style={{ fontSize: 13, opacity: 0.68, marginTop: 10 }}>{group.total} profiles · {group.ready} ready</div>
                {group.launches > 0 && <div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>{group.launches} launches logged</div>}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && agentTheme && (
        <>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
            2. What kind of work? <span style={{ color: agentTheme.color }}>{agentTheme.label}</span>
          </div>
          <div style={{ fontSize: 14, opacity: 0.62, marginBottom: 20 }}>Choose the task intent. Profiles are filtered to match.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {TASK_INTENTS.map((task) => {
              const count = profilesForAgentTask(agentGroups, easyAgent, task.id);
              return (
                <button key={task.id} onClick={() => onPickTask(task.id)} disabled={count === 0} style={{
                  textAlign: "left", padding: 18, borderRadius: 16, cursor: count ? "pointer" : "not-allowed",
                  opacity: count ? 1 : 0.38, background: "rgba(255,255,255,0.03)", border: `1px solid ${agentTheme.border}`,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{task.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.58, marginTop: 6, lineHeight: 1.5 }}>{task.hint}</div>
                  <div style={{ fontSize: 11, color: agentTheme.color, marginTop: 10 }}>{count} profile{count === 1 ? "" : "s"}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 3 && agentTheme && easyTask && (
        <>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
            3. Launch the best match
          </div>
          <div style={{ fontSize: 14, opacity: 0.62, marginBottom: 20 }}>
            {easyMatches.length} profiles match <strong style={{ color: agentTheme.color }}>{agentTheme.label}</strong> + <strong>{TASK_INTENTS.find((t) => t.id === easyTask)?.label}</strong>.
          </div>

          {easyTopPick ? (
            <div style={{ padding: 24, borderRadius: 22, marginBottom: 18, background: agentTheme.bg, border: `2px solid ${agentTheme.border}` }}>
              <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: agentTheme.color, marginBottom: 8 }}>Recommended</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em" }}>{easyTopPick.name}</div>
              <div style={{ fontSize: 12, opacity: 0.45, fontFamily: "'GeistMono', monospace", marginTop: 6 }}>{easyTopPick.id}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <StatusPill state={easyTopPick.state} />
                <TelemetryPill profile={easyTopPick} />
                {easyTopPick.score != null && <span style={chipStyle}>Score {easyTopPick.score}</span>}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button onClick={() => onLaunch(easyTopPick)} disabled={launchingId === easyTopPick.id || easyTopPick.state === "BLOCKED"} style={{ ...primaryButtonStyle, flex: "none", padding: "14px 22px", fontSize: 15, opacity: launchingId === easyTopPick.id || easyTopPick.state === "BLOCKED" ? 0.5 : 1 }}>
                  <Zap size={16} /> {launchingId === easyTopPick.id ? "Launching…" : "Launch now"}
                </button>
                <button onClick={() => onInspect(easyTopPick)} style={secondaryButtonStyle}><Eye size={14} /> Inspect first</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, borderRadius: 16, border: "1px dashed rgba(255,255,255,0.14)", opacity: 0.7 }}>No profiles match this agent + task combination.</div>
          )}

          {easyMatches.length > 1 && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>Other matches</div>
              {easyMatches.slice(1, 6).map((profile: any) => (
                <CompactProfileRow key={profile.id} profile={profile} theme={agentTheme} onInspect={() => onInspect(profile)} onLaunch={() => onLaunch(profile)} launching={launchingId === profile.id} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function profilesForAgentTask(agentGroups: any[], agent: string, taskId: string) {
  const group = agentGroups.find((g: any) => g.agent === agent);
  if (!group) return 0;
  return group.items.filter((p: any) => profileMatchesTask(p, taskId)).length;
}

function AgentSection({ group, expanded, onToggle, onInspect, onLaunch, launchingId }: any) {
  return (
    <section style={{ borderRadius: 22, overflow: "hidden", border: `1px solid ${group.theme.border}`, background: "rgba(255,255,255,0.02)" }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "18px 20px",
        border: "none", cursor: "pointer", textAlign: "left", background: group.theme.bg,
      }}>
        <div style={{ width: 6, alignSelf: "stretch", borderRadius: 999, background: group.theme.color, flexShrink: 0 }} />
        {expanded ? <ChevronDown size={18} color={group.theme.color} /> : <ChevronRight size={18} color={group.theme.color} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{group.theme.label}</div>
          <div style={{ fontSize: 12, opacity: 0.58, marginTop: 4 }}>{group.total} profiles · {group.ready} ready · {group.launches} launches</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <MiniStat label="Ready" value={group.ready} color="#86efac" />
          <MiniStat label="Total" value={group.total} color={group.theme.color} />
        </div>
      </button>

      {expanded && (
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {group.items.map((profile: any) => (
            <ProfileCard key={profile.id} profile={profile} theme={group.theme} onInspect={() => onInspect(profile)} onLaunch={() => onLaunch(profile)} launching={launchingId === profile.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProfileCard({ profile, theme, onInspect, onLaunch, launching }: any) {
  const tone = statusTone[profile.state || "UNKNOWN"] || statusTone.UNKNOWN;
  return (
    <div style={{ padding: 18, borderRadius: 18, background: "rgba(255,255,255,0.024)", border: `1px solid ${tone.border}`, borderLeft: `4px solid ${theme.color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, color: "#ffffff", fontWeight: 600 }}>{profile.name}</div>
          <div style={{ fontSize: 11, opacity: 0.42, marginTop: 4, fontFamily: "'GeistMono', monospace" }}>{profile.id}</div>
        </div>
        <StatusPill state={profile.state} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {profile.meta?.mode && <Chip text={profile.meta.mode} />}
        {profile.taskMode && <Chip text={profile.taskMode} />}
        {profile.meta?.model && <Chip text={profile.meta.model} highlight />}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <TelemetryPill profile={profile} />
        {profile.score != null && <span style={chipStyle}><BarChart3 size={11} style={{ marginRight: 4 }} />{profile.score}</span>}
        {profile.ce_compatible && <span style={{ ...chipStyle, color: "#c4b5fd", borderColor: "rgba(139,92,246,0.22)" }}>CE</span>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={onInspect} style={secondaryButtonStyle}><Eye size={14} /> Inspect</button>
        <button onClick={onLaunch} disabled={launching || profile.state === "BLOCKED"} style={{ ...primaryButtonStyle, opacity: launching || profile.state === "BLOCKED" ? 0.56 : 1, cursor: launching || profile.state === "BLOCKED" ? "not-allowed" : "pointer" }}>
          <PlayCircle size={14} /> {launching ? "Launching…" : "Launch"}
        </button>
      </div>
    </div>
  );
}

function CompactProfileRow({ profile, theme, onInspect, onLaunch, launching }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ width: 4, height: 36, borderRadius: 999, background: theme.color }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{profile.name}</div>
        <div style={{ fontSize: 11, opacity: 0.45 }}>{profile.state} · score {profile.score ?? "—"}</div>
      </div>
      <button onClick={onInspect} style={{ ...ghostButtonStyle, padding: "8px 10px" }}><Eye size={14} /></button>
      <button onClick={onLaunch} disabled={launching || profile.state === "BLOCKED"} style={{ ...primaryButtonStyle, flex: "none", padding: "8px 12px", opacity: launching || profile.state === "BLOCKED" ? 0.5 : 1 }}>
        <PlayCircle size={14} />
      </button>
    </div>
  );
}

function AuditPanel({ selected, preview, launchingId, onLaunch }: any) {
  return (
    <section style={{ position: "sticky", top: 94, padding: 22, borderRadius: 22, background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ fontSize: 11, opacity: 0.42, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Inspect</div>
      <div style={{ fontSize: 24, color: "#ffffff", fontWeight: 600, letterSpacing: "-0.04em", marginBottom: 10 }}>Audit panel</div>
      <div style={{ fontSize: 13, opacity: 0.68, lineHeight: 1.7, marginBottom: 16 }}>
        Review warnings, telemetry, and the launch script before you commit.
      </div>

      {selected ? (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 18, color: "#ffffff", fontWeight: 600 }}>{selected.name}</div>
            <div style={{ fontSize: 11, opacity: 0.42, marginTop: 4, fontFamily: "'GeistMono', monospace" }}>{selected.id}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <Chip text={selected.meta?.frontend || "agent"} highlight />
            <Chip text={selected.meta?.mode || "mode"} />
            <Chip text={selected.taskMode || selected.meta?.task_mode || "task"} />
            <TelemetryPill profile={selected} />
          </div>
          {preview?.error ? (
            <AuditBlock title="Preview error" tone="red" items={[preview.error]} />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <AuditBlock title="Errors" tone="red" items={preview?.audit?.errors || []} emptyLabel="No blocking errors." />
              <AuditBlock title="Warnings" tone="gold" items={preview?.audit?.warnings || []} emptyLabel="No warnings." />
              <SuggestionBlock suggestions={preview?.audit?.suggestions || []} />
              <div style={{ padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 11, opacity: 0.42, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Launch script preview</div>
                <pre style={{ margin: 0, maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.6, fontFamily: "'GeistMono', monospace", color: "#ece8e1" }}>
                  {preview?.script || "No script available."}
                </pre>
              </div>
            </div>
          )}
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <button onClick={() => onLaunch(selected)} disabled={launchingId === selected.id || selected.state === "BLOCKED"} style={{ ...primaryButtonStyle, opacity: launchingId === selected.id || selected.state === "BLOCKED" ? 0.56 : 1, cursor: launchingId === selected.id || selected.state === "BLOCKED" ? "not-allowed" : "pointer" }}>
              <PlayCircle size={14} /> {launchingId === selected.id ? "Launching…" : "Launch profile"}
            </button>
            {(preview?.audit?.warnings?.length || 0) > 0 && (
              <button onClick={() => onLaunch(selected, "User approved after reviewing warnings in Profiles panel")} style={secondaryButtonStyle}>
                <ShieldAlert size={14} /> Launch with override
              </button>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)" }}>
          <div style={{ fontSize: 16, color: "#ffffff", fontWeight: 600, marginBottom: 8 }}>Select a profile</div>
          <div style={{ fontSize: 13, opacity: 0.68, lineHeight: 1.7 }}>Use Easy 1-2-3 or Advanced view, then inspect before launch.</div>
        </div>
      )}
    </section>
  );
}

function StepBadge({ n, label, active, done, color }: { n: number; label: string; active: boolean; done: boolean; color?: string }) {
  const accent = color || "#86efac";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: active || done ? 1 : 0.38 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14,
        background: done ? accent : active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
        color: done ? "#0a0e17" : active ? "#fff" : "#aaa",
        border: `1px solid ${active || done ? accent : "rgba(255,255,255,0.1)"}`,
      }}>{done ? "✓" : n}</div>
      <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? "#fff" : "#aaa" }}>{label}</div>
    </div>
  );
}

function StatusPill({ state }: { state?: string }) {
  const tone = statusTone[state || "UNKNOWN"] || statusTone.UNKNOWN;
  return <span style={{ padding: "6px 10px", borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>{tone.label}</span>;
}

function TelemetryPill({ profile }: { profile: any }) {
  const t = profile.telemetry;
  if (!t?.launchCount) return <span style={chipStyle}>No launches yet</span>;
  return <span style={chipStyle}>{t.launchCount} launches · {t.successRate ?? 0}% success</span>;
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 11, opacity: 0.42, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || "#fff", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: "8px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", textAlign: "center" }}>
      <div style={{ fontSize: 10, opacity: 0.45, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 16px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600,
      border: active ? "1px solid rgba(74,222,128,0.28)" : "1px solid rgba(255,255,255,0.08)",
      background: active ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.03)",
      color: active ? "#86efac" : "#ddd6cb",
    }}>{label}</button>
  );
}

function AuditBlock({ title, tone, items, emptyLabel }: { title: string; tone: "red" | "gold"; items: string[]; emptyLabel?: string }) {
  const styles = tone === "red"
    ? { color: "#fca5a5", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.16)", icon: AlertTriangle }
    : { color: "#ffcb89", bg: "rgba(255,176,66,0.06)", border: "rgba(255,176,66,0.16)", icon: CheckCircle2 };
  const Icon = styles.icon;
  return (
    <div style={{ padding: 14, borderRadius: 16, background: styles.bg, border: `1px solid ${styles.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: styles.color, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em" }}>
        <Icon size={14} />{title}
      </div>
      {items.length > 0 ? items.map((item, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>• {item}</div>) : <div style={{ fontSize: 13, opacity: 0.68 }}>{emptyLabel || "Nothing here."}</div>}
    </div>
  );
}

function SuggestionBlock({ suggestions }: { suggestions: any[] }) {
  return (
    <div style={{ padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.42 }}>
        <Sparkles size={14} color="#ffb042" />Suggestions
      </div>
      {suggestions.length > 0 ? suggestions.map((s, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 13 }}>{s.name || s.profile || s.id || "Alternative"}</span>
          {s.score !== undefined && <span style={{ fontSize: 12, opacity: 0.54 }}>{s.score}%</span>}
        </div>
      )) : <div style={{ fontSize: 13, opacity: 0.68 }}>No alternatives suggested.</div>}
    </div>
  );
}

function Chip({ text, highlight }: { text: string; highlight?: boolean }) {
  return <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${highlight ? "rgba(255,176,66,0.22)" : "rgba(255,255,255,0.08)"}`, background: highlight ? "rgba(255,176,66,0.08)" : "rgba(255,255,255,0.03)", color: highlight ? "#ffcb89" : "#ddd6cb", fontSize: 11 }}>{text}</span>;
}

function InputShell({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
      <Icon size={14} color="#bfb8ab" />{children}
    </div>
  );
}

const chipStyle: React.CSSProperties = { padding: "5px 9px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", fontSize: 11, color: "#ddd6cb", display: "inline-flex", alignItems: "center" };
const inputStyle: React.CSSProperties = { width: "100%", border: "none", outline: "none", background: "transparent", color: "#ece8e1", fontSize: 13, padding: "12px 0" };
const ghostButtonStyle: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#bfb8ab", cursor: "pointer", fontSize: 13 };
const secondaryButtonStyle: React.CSSProperties = { flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#ece8e1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13 };
const primaryButtonStyle: React.CSSProperties = { flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(74,222,128,0.2)", background: "rgba(74,222,128,0.1)", color: "#86efac", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, cursor: "pointer" };