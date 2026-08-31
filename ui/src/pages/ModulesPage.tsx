import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useCoach } from "@/context/CoachContext";
import { hootSignal } from "@/lib/h00t-signals";
import {
  Box, Puzzle, Server, Wrench, Search, Loader2, AlertCircle,
  Download, CheckCircle2, Copy, RefreshCw, Play, ChevronDown, Package, Zap, FolderOpen,
} from "lucide-react";

type ModuleRow = {
  id: string;
  name: string;
  type: string;
  tag: string;
  description: string;
  enabled: boolean;
  version?: string;
  detection: {
    installed?: boolean;
    status?: string;
    cache_files?: number;
    claude_plugin?: boolean;
    codex_skills?: boolean;
    codex_agents?: boolean;
    plugin_by_frontend?: Record<string, Array<{ path: string; md_files: number }>>;
    plugin_probe?: { plugin_dirs: Array<{ frontend: string; path: string }> };
  };
  last_sync?: string | null;
  sync_stale?: boolean;
  upstream?: { tag: string; url?: string } | null;
  version_behind?: { catalog: string; upstream: string } | null;
  counts?: { skills?: number; agents?: number };
  sync?: { label?: string };
};

type Tab = "packs" | "skills" | "agents" | "mcp";

const statusColors: Record<string, string> = {
  ready: "#4ade80",
  "cached-only": "#60a5fa",
  "plugin-only": "#f59e0b",
  missing: "#ef4444",
  "needs-sync": "#fb923c",
  disabled: "#6b7280",
  blocked: "#fb923c",
};

export default function ModulesPage() {
  const [tab, setTab] = useState<Tab>("packs");
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [autoSync, setAutoSync] = useState({ enabled: true, interval_days: 7 });
  const [skills, setSkills] = useState<Array<any>>([]);
  const [agents, setAgents] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [installPlan, setInstallPlan] = useState<any>(null);
  const [installLog, setInstallLog] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [prefab, setPrefab] = useState<Record<string, any> | null>(null);
  const toast = useToast();
  const { setPageContext } = useCoach();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mods, skillData, agentData, prefabData] = await Promise.all([
        api.getModules(),
        api.getSkills().catch(() => ({ skills: [] })),
        api.getAgents().catch(() => ({ agents: [] })),
        api.getPrefab().catch(() => null),
      ]);
      setModules(mods.modules || []);
      if (mods.auto_sync) setAutoSync(mods.auto_sync);
      setSkills(skillData.skills || []);
      setAgents(agentData.agents || []);
      setPrefab(prefabData);
      setLoading(false);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ce = modules.find((m) => m.id === "compound-engineering");
    setPageContext({
      moduleCount: modules.length,
      modulesEnabled: modules.filter((m) => m.enabled).length,
      modulesReady: modules.filter((m) => m.detection?.status === "ready").length,
      modulesNeedSync: modules.filter((m) => m.sync_stale).length,
      modulesOutdated: modules.filter((m) => m.version_behind).length,
      modulesTab: tab,
      cePluginDetected: Boolean(ce?.detection?.claude_plugin || ce?.detection?.codex_skills),
    });
  }, [modules, tab, setPageContext]);

  const packs = useMemo(() => modules.filter((m) => m.type === "plugin-pack" || m.type === "builtin"), [modules]);
  const mcpMods = useMemo(() => modules.filter((m) => m.type === "mcp-server"), [modules]);
  const cePack = useMemo(() => modules.find((m) => m.id === "compound-engineering"), [modules]);

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.toLowerCase();
    return skills.filter((s) => s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q));
  }, [skills, search]);

  const toggleModule = async (mod: ModuleRow) => {
    if (mod.type === "builtin") return;
    setBusy(mod.id);
    try {
      await api.setModuleEnabled(mod.id, !mod.enabled);
      await load();
      toast.showToast(`${mod.name} ${mod.enabled ? "disabled" : "enabled"}`, "success");
    } catch (e) {
      toast.showToast(String(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const syncModule = async (mod: ModuleRow) => {
    setBusy(`sync-${mod.id}`);
    setPageContext(hootSignal("module:syncing", 8000));
    try {
      const r = await api.syncModule(mod.id);
      toast.showToast(r.output || "Sync complete", "success");
      setPageContext(hootSignal("module:ready", 5000));
      await load();
    } catch (e) {
      setPageContext(hootSignal("module:install-fail", 5000));
      toast.showToast(String(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const fullSetup = async (mod: ModuleRow) => {
    setBusy(`full-${mod.id}`);
    setInstallLog(null);
    setPageContext(hootSignal("module:installing", 12000));
    try {
      const r = await api.fullModuleSetup(mod.id);
      const lines = (r.results || []).map((x: any) => `${x.step}: ${x.ok ? "ok" : x.error || x.output || "fail"}`);
      setInstallLog(lines.join("\n"));
      if (r.manual_steps?.length) {
        lines.push("", "Manual steps:", ...r.manual_steps.map((m: any) => m.output));
        setInstallLog(lines.join("\n"));
      }
      toast.showToast(r.ok ? "Full setup complete" : "Setup finished with issues", r.ok ? "success" : "warning");
      setPageContext(hootSignal(r.ok ? "module:ready" : "module:install-fail", 6000));
      await load();
    } catch (e) {
      setPageContext(hootSignal("module:install-fail", 5000));
      toast.showToast(String(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const runInstallTarget = async (mod: ModuleRow, target: string) => {
    setBusy(`install-${target}`);
    setPageContext(hootSignal("module:installing", 8000));
    try {
      const r = await api.installModule(mod.id, target);
      setInstallLog(r.output || r.error || (r.manual ? r.command : "done"));
      toast.showToast(r.manual ? "Manual step required ΓÇö see log" : "Install step complete", r.ok ? "success" : "warning");
      if (r.ok) setPageContext(hootSignal("module:ready", 4000));
      else if (!r.manual) setPageContext(hootSignal("module:install-fail", 4000));
      await load();
    } catch (e) {
      setPageContext(hootSignal("module:install-fail", 5000));
      toast.showToast(String(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const showInstall = async (mod: ModuleRow) => {
    try {
      const plan = await api.getModuleInstallPlan(mod.id);
      setInstallPlan({ mod, plan });
      setExpanded(mod.id);
    } catch (e) {
      toast.showToast(String(e), "error");
    }
  };

  const toggleAutoSync = async () => {
    try {
      const next = { ...autoSync, enabled: !autoSync.enabled };
      await api.setModuleSettings(next);
      setAutoSync(next);
      toast.showToast(`Auto-sync ${next.enabled ? "on" : "off"}`, "success");
    } catch (e) {
      toast.showToast(String(e), "error");
    }
  };

  const copyCmd = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const readSkill = async (skill: any) => {
    setExpanded(skill.id);
    setSkillContent(null);
    if (!skill.cached) {
      setSkillContent("Not cached ΓÇö run Sync or Full setup on Compound Engineering pack.");
      return;
    }
    try {
      const data = await api.getSkillContent(skill.id);
      setSkillContent(data.content);
    } catch (e) {
      setSkillContent(String(e));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", opacity: 0.5 }}>
        <Loader2 size={32} style={{ marginBottom: 12, animation: "spin 1s linear infinite" }} />
        <p>Loading module registryΓÇª</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <AlertCircle size={32} color="#ef4444" style={{ marginBottom: 12 }} />
        <p style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Puzzle size={24} color="#ffb042" />
        <h1 style={{ fontSize: 20, fontWeight: 400, margin: 0 }}>Module Manager v2</h1>
        <span style={{ fontSize: 12, opacity: 0.45, marginLeft: "auto" }}>
          detect ┬╖ install ┬╖ load ┬╖ auto-sync
        </span>
      </div>

      {prefab?.prefab && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>Prefab deliverable (shipped with HOOT)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 6 }}>Packs ({prefab.counts?.packs || prefab.prefab.packs?.length || 0})</div>
              {(prefab.prefab.packs || []).map((p: { id: string; name: string; version?: string }) => (
                <div key={p.id} style={{ fontSize: 12, opacity: 0.85 }}>{p.name}{p.version ? ` v${p.version}` : ""}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#4ade80", marginBottom: 6 }}>Built-ins ({prefab.counts?.builtins || prefab.prefab.builtins?.length || 0})</div>
              {(prefab.prefab.builtins || []).map((b: { id: string; name: string }) => (
                <div key={b.id} style={{ fontSize: 12, opacity: 0.85 }}>{b.name}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#fcd34d", marginBottom: 6 }}>MCP servers ({prefab.counts?.mcp_servers || prefab.prefab.mcp_servers?.length || 0})</div>
              {(prefab.prefab.mcp_servers || []).map((m: { id: string; name: string; default_enabled?: boolean }) => (
                <div key={m.id} style={{ fontSize: 12, opacity: 0.85 }}>{m.name}{m.default_enabled ? " ┬╖ on" : " ┬╖ opt-in"}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cePack && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#93c5fd" }}>Compound Engineering</div>
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
              Catalog {cePack.version}
              {cePack.upstream?.tag && ` ┬╖ upstream ${cePack.upstream.tag}`}
              {cePack.version_behind && " ┬╖ update available"}
              {cePack.sync_stale && " ┬╖ cache stale"}
            </div>
            <div style={{ fontSize: 10, opacity: 0.45, marginTop: 4, fontFamily: "'GeistMono', monospace" }}>
              Claude {cePack.detection?.claude_plugin ? "ΓùÅ" : "Γùï"} ┬╖ Codex skills {cePack.detection?.codex_skills ? "ΓùÅ" : "Γùï"} ┬╖ agents {cePack.detection?.codex_agents ? "ΓùÅ" : "Γùï"}
            </div>
          </div>
          <button type="button" disabled={busy === "full-compound-engineering"} onClick={() => fullSetup(cePack)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.1)", color: "#4ade80", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={14} /> {busy === "full-compound-engineering" ? "RunningΓÇª" : "Full setup"}
          </button>
          <button type="button" onClick={toggleAutoSync} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: autoSync.enabled ? "rgba(255,176,66,0.1)" : "transparent", color: autoSync.enabled ? "#ffb042" : "#888", cursor: "pointer", fontSize: 11 }}>
            Auto-sync {autoSync.enabled ? "on" : "off"} ({autoSync.interval_days}d)
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {([
          { id: "packs" as Tab, label: "Packs & Built-ins", icon: Package },
          { id: "skills" as Tab, label: `Skills (${skills.length})`, icon: Wrench },
          { id: "agents" as Tab, label: `Agents (${agents.length})`, icon: Box },
          { id: "mcp" as Tab, label: "MCP Servers", icon: Server },
        ]).map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
              padding: "8px 14px", borderRadius: 8, border: `1px solid ${tab === t.id ? "rgba(255,176,66,0.35)" : "rgba(255,255,255,0.08)"}`,
              background: tab === t.id ? "rgba(255,176,66,0.1)" : "transparent", color: tab === t.id ? "#ffb042" : "#dadada", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6,
            }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
        <button type="button" onClick={load} style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {installLog && (
        <pre style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.35)", fontSize: 11, lineHeight: 1.5, overflow: "auto", maxHeight: 160, whiteSpace: "pre-wrap" }}>{installLog}</pre>
      )}

      {(tab === "packs" || tab === "mcp") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {(tab === "packs" ? packs : mcpMods).map((mod) => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              expanded={expanded === mod.id}
              onToggleExpand={() => setExpanded((id) => (id === mod.id ? null : mod.id))}
              busy={busy}
              installPlan={installPlan?.mod?.id === mod.id ? installPlan.plan : null}
              copied={copied}
              onEnable={() => toggleModule(mod)}
              onSync={() => syncModule(mod)}
              onFullSetup={() => fullSetup(mod)}
              onInstall={() => showInstall(mod)}
              onRunTarget={(target) => runInstallTarget(mod, target)}
              onCopy={copyCmd}
            />
          ))}
        </div>
      )}

      {tab === "skills" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Search size={14} opacity={0.5} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search CE skillsΓÇª" style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#f5f5f5", fontSize: 13 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {filteredSkills.map((skill) => (
              <button key={skill.id} type="button" onClick={() => readSkill(skill)} style={{ padding: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: expanded === skill.id ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)", color: "#f5f5f5", cursor: "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{skill.name}</span>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, background: skill.cached ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)", color: skill.cached ? "#4ade80" : "#888" }}>
                    {skill.cached ? "cached" : "metadata"}
                  </span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>{skill.description?.slice(0, 90)}ΓÇª</div>
              </button>
            ))}
          </div>
          {expanded && skillContent && (
            <pre style={{ marginTop: 16, padding: 16, borderRadius: 10, background: "rgba(0,0,0,0.3)", fontSize: 11, lineHeight: 1.55, overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap" }}>{skillContent}</pre>
          )}
        </>
      )}

      {tab === "agents" && (
        <>
          <p style={{ fontSize: 12, opacity: 0.55, marginBottom: 14 }}>
            {agents.length} agents in CE catalog (install via Compound Engineering pack Full setup).
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {agents.map((agent) => (
            <div key={agent.id} style={{ padding: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{agent.name}</div>
              <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}>{agent.description}</div>
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  );
}

function ModuleCard({
  mod, expanded, onToggleExpand, busy, installPlan, copied,
  onEnable, onSync, onFullSetup, onInstall, onRunTarget, onCopy,
}: {
  mod: ModuleRow; expanded: boolean; onToggleExpand: () => void; busy: string | null;
  installPlan: any; copied: string | null;
  onEnable: () => void; onSync: () => void; onFullSetup: () => void; onInstall: () => void;
  onRunTarget: (target: string) => void; onCopy: (cmd: string, id: string) => void;
}) {
  const status = mod.detection?.status || "unknown";
  const color = statusColors[status] || "#6b7280";
  const isBuiltin = mod.type === "builtin";
  const isCe = mod.id === "compound-engineering";
  const pluginDirs = mod.detection?.plugin_probe?.plugin_dirs || [];

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${mod.enabled ? `${color}33` : "rgba(255,255,255,0.06)"}`, background: "rgba(255,255,255,0.02)", overflow: "hidden" }}>
      <button type="button" onClick={onToggleExpand} style={{ width: "100%", padding: 16, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "#f5f5f5" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{mod.name}</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(0,0,0,0.25)", color: "#aaa" }}>{mod.tag}</span>
              {mod.sync_stale && <span style={{ fontSize: 9, color: "#fb923c" }}>stale</span>}
              {mod.version_behind && <span style={{ fontSize: 9, color: "#60a5fa" }}>update</span>}
              {mod.enabled && <CheckCircle2 size={12} color="#4ade80" />}
            </div>
            <p style={{ fontSize: 12, opacity: 0.6, margin: "8px 0 0", lineHeight: 1.45 }}>{mod.description}</p>
          </div>
          <ChevronDown size={16} style={{ opacity: 0.4, transform: expanded ? "rotate(180deg)" : "none" }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 11, fontFamily: "'GeistMono', monospace" }}>
          <span style={{ color }}>{status}</span>
          {mod.detection?.cache_files != null && <span style={{ opacity: 0.45 }}>{mod.detection.cache_files} cached</span>}
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {pluginDirs.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, opacity: 0.45, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><FolderOpen size={10} /> Detected plugin paths</div>
              {pluginDirs.map((d) => (
                <div key={d.path} style={{ fontSize: 10, opacity: 0.6, fontFamily: "'GeistMono', monospace", marginBottom: 4 }}>{d.frontend}: {d.path}</div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {!isBuiltin && (
              <button type="button" disabled={busy === mod.id} onClick={onEnable} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: mod.enabled ? "rgba(239,68,68,0.08)" : "rgba(74,222,128,0.08)", color: mod.enabled ? "#f87171" : "#4ade80", cursor: "pointer", fontSize: 11 }}>
                {mod.enabled ? "Disable" : "Enable"}
              </button>
            )}
            {mod.sync && (
              <button type="button" disabled={busy === `sync-${mod.id}`} onClick={onSync} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,176,66,0.25)", background: "rgba(255,176,66,0.08)", color: "#ffb042", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                <Download size={12} /> Sync
              </button>
            )}
            {isCe && (
              <button type="button" disabled={busy === `full-${mod.id}`} onClick={onFullSetup} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.08)", color: "#4ade80", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={12} /> Full setup
              </button>
            )}
            <button type="button" onClick={onInstall} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(96,165,250,0.25)", background: "rgba(96,165,250,0.08)", color: "#93c5fd", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
              <Play size={12} /> Steps
            </button>
          </div>

          {installPlan?.steps?.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {installPlan.note && <p style={{ fontSize: 11, opacity: 0.55, margin: 0 }}>{installPlan.note}</p>}
              {installPlan.steps.map((step: any) => (
                <div key={step.id} style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12 }}>{step.label}</div>
                    {step.command && <code style={{ fontSize: 10, opacity: 0.65, wordBreak: "break-all" }}>{step.command}</code>}
                    {step.manual_note && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>{step.manual_note}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {step.runnable && step.target && (
                      <button type="button" disabled={Boolean(busy)} onClick={() => onRunTarget(step.target)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.08)", color: "#4ade80", cursor: "pointer", fontSize: 10 }}>Run</button>
                    )}
                    {step.command && (
                      <button type="button" onClick={() => onCopy(step.command, step.id)} style={{ background: "none", border: "none", color: copied === step.id ? "#4ade80" : "#aaa", cursor: "pointer" }}>
                        {copied === step.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
