import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Activity, Cpu, FolderSearch, Play, RefreshCw, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useCoach } from "@/context/CoachContext";
import type { BenchResultsPayload, BenchRow } from "@/lib/bench-types";
import type {
  AdviseFinding,
  CodingAgentsPayload,
  IntegrationScanPayload,
  InventoryModel,
  ModelInventoryPayload,
  RtkStatus,
} from "@/lib/model-inventory-types";
import { useSessionPoll } from "@/hooks/useSessionPoll";
import {
  getLocalBackend,
  getPrimaryGpuName,
  normalizeLoadedModels,
  parseOllamaListRaw,
} from "@/lib/scan-normalize";

const DEFAULT_PRESETS = ["phi3:mini", "qwen2.5:1.5b", "smollm2:360m"];

/** Season B2 — Vitals is a small product with chapters, not one megapage. */
const VITALS_CHAPTERS = [
  { id: "overview", label: "Overview" },
  { id: "models", label: "Models" },
  { id: "agents", label: "Agents" },
  { id: "integrations", label: "Repos" },
  { id: "bench", label: "Bench" },
] as const;
type VitalsChapter = (typeof VITALS_CHAPTERS)[number]["id"];

type ScanVitals = {
  ollamaPresent: boolean;
  installedCount: number;
  loadedCount: number;
  installedNames: string[];
  loadedNames: string[];
  llamacppPresent: boolean;
  llamacppReachable: boolean;
  llamaModel?: string | null;
  gpu?: string;
  scanStale?: boolean;
  scanEmpty?: boolean;
};

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

function statusColor(status: string) {
  if (status === "pass") return "#34d399";
  if (status === "weak") return "#fbbf24";
  if (status === "missing") return "#9ca3af";
  if (status === "error") return "#f87171";
  return "#d1d5db";
}

function severityColor(sev: string) {
  if (sev === "high") return "#f87171";
  if (sev === "medium") return "#fbbf24";
  if (sev === "info") return "#6ee7b7";
  return "#d1d5db";
}

function tierLabel(row: BenchRow) {
  if (row.status !== "pass") return "—";
  const tps = Number(row.tokens_per_sec) || 0;
  if (tps >= 20) return "fast";
  if (tps >= 8) return "ok";
  return "slow";
}

function parseModelsInput(raw: string) {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatTps(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function formatSize(bytes: number) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

function vitalsFromScan(scan: any): ScanVitals {
  const empty = Boolean(scan?.empty);
  const loadedNames = normalizeLoadedModels(scan)
    .map((m) => String(m.name || "").trim())
    .filter(Boolean);
  const installedNames = parseOllamaListRaw(scan?.ollama?.list_raw);
  const ollamaPresent = Boolean(scan?.tools?.ollama?.present) || installedNames.length > 0 || loadedNames.length > 0;
  const llama = getLocalBackend(scan, "llamacpp") as
    | { present?: boolean; configured_model?: string; server?: { reachable?: boolean } }
    | undefined;
  const gpu = getPrimaryGpuName(scan);
  return {
    ollamaPresent,
    installedCount: installedNames.length,
    loadedCount: loadedNames.length,
    installedNames,
    loadedNames,
    llamacppPresent: Boolean(llama?.present),
    llamacppReachable: Boolean(llama?.server?.reachable),
    llamaModel: llama?.configured_model || null,
    gpu,
    scanStale: Boolean(scan?._cache?.stale),
    scanEmpty: empty,
  };
}

export default function BenchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const chapterParam = searchParams.get("tab") || "overview";
  const chapter: VitalsChapter = VITALS_CHAPTERS.some((c) => c.id === chapterParam)
    ? (chapterParam as VitalsChapter)
    : "overview";
  const setChapter = (id: VitalsChapter) => {
    setSearchParams(id === "overview" ? {} : { tab: id }, { replace: true });
  };
  const show = (id: VitalsChapter) => chapter === id;

  const [data, setData] = useState<BenchResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [modelInput, setModelInput] = useState(DEFAULT_PRESETS.join(", "));
  const [installedPresets, setInstalledPresets] = useState<string[]>([]);
  const [loadedPresets, setLoadedPresets] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [llamaRunning, setLlamaRunning] = useState(false);
  const [scanVitals, setScanVitals] = useState<ScanVitals | null>(null);
  const [modelInputSeeded, setModelInputSeeded] = useState(false);
  const [inventory, setInventory] = useState<ModelInventoryPayload | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [backendFilter, setBackendFilter] = useState<string>("all");
  const [findings, setFindings] = useState<AdviseFinding[]>([]);
  const [rtk, setRtk] = useState<RtkStatus | null>(null);
  const [rtkBusy, setRtkBusy] = useState(false);
  const [agents, setAgents] = useState<CodingAgentsPayload | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [integrationScope, setIntegrationScope] = useState<"active" | "portfolio">("portfolio");
  const [integration, setIntegration] = useState<IntegrationScanPayload | null>(null);
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const { setPageContext } = useCoach();

  const applyScan = useCallback((scan: any) => {
    const vitals = vitalsFromScan(scan);
    setScanVitals(vitals);
    setLoadedPresets(vitals.loadedNames);
    setInstalledPresets(vitals.installedNames);
    if (!modelInputSeeded && vitals.installedNames.length > 0) {
      setModelInput(vitals.installedNames.slice(0, 4).join(", "));
      setModelInputSeeded(true);
    }
  }, [modelInputSeeded]);

  const loadScan = useCallback(async (fresh = false) => {
    try {
      const scan = fresh ? await api.runScan() : await api.getScanCached();
      applyScan(scan);
      return scan;
    } catch {
      return null;
    }
  }, [applyScan]);

  const loadInventory = useCallback(async (mode: "quick" | "exhaustive" = "quick") => {
    setInventoryLoading(true);
    setActionMsg(mode === "exhaustive" ? "Exhaustive multi-drive scan running (may take several minutes)…" : null);
    try {
      const inv = mode === "exhaustive"
        ? await api.refreshVitalsModels("exhaustive")
        : await api.getVitalsModels("quick");
      setInventory(inv);
      setFindings(inv.findings || []);
      setPageContext({
        vitalsModelCount: inv.counts?.total,
        vitalsDupClusters: inv.duplicate_clusters?.length,
        vitalsFindings: inv.findings?.length,
        vitalsScanMode: inv.mode,
      });
      if (mode === "exhaustive") {
        const cov = inv.coverage;
        setActionMsg(
          `Exhaustive scan done: ${inv.counts?.total ?? 0} models · drives ${(cov?.drives_detected || []).join(", ") || "?"} · ${cov?.duration_ms ? Math.round(cov.duration_ms / 1000) + "s" : ""}${cov?.truncated ? " · truncated (hit limits)" : ""}`,
        );
      }
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setInventoryLoading(false);
    }
  }, [setPageContext]);

  const loadRtk = useCallback(async () => {
    try {
      setRtk(await api.getRtkStatus());
    } catch { /* ignore */ }
  }, []);

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const res = await api.getVitalsAgents();
      setAgents(res);
      setPageContext({
        claudePresent: res.summary?.claude_present,
        omnirouteListening: res.summary?.omniroute_listening,
        anthropicBaseUrlSet: res.summary?.base_url_set,
        agentsWired: res.summary?.wired,
        claudeModel: res.claude?.model || null,
      });
    } catch {
      /* ignore — section stays empty */
    } finally {
      setAgentsLoading(false);
    }
  }, [setPageContext]);

  const load = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const results = await api.getBenchResults();
      setData(results);
      setPageContext({
        benchModelCount: results.rows.length,
        benchPassCount: results.rows.filter((r) => r.status === "pass").length,
        benchUpdatedAt: results.updated_at,
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setPageContext]);

  useSessionPoll(load, { immediate: true });

  useEffect(() => {
    void loadScan(false);
    void loadInventory();
    void loadRtk();
    void loadAgents();
  }, [loadScan, loadInventory, loadRtk, loadAgents]);

  const refreshEnvironment = async () => {
    setScanning(true);
    setRunError(null);
    try {
      await loadScan(true);
      await loadInventory();
      await loadRtk();
      await loadAgents();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  const ensureRtk = async () => {
    setRtkBusy(true);
    setActionMsg(null);
    try {
      const res = await api.ensureHootRtk(false);
      setRtk(res);
      setActionMsg(res.message || (res.present ? "HOOT RTK ready (preinstalled)." : "RTK provision pending"));
      await loadInventory();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRtkBusy(false);
    }
  };

  const runIntegrationScan = async () => {
    setIntegrationBusy(true);
    setRunError(null);
    try {
      const res = await api.scanVitalsIntegrations(integrationScope);
      setIntegration(res);
      setPageContext({ integrationCandidates: res.counts?.candidates, integrationRepos: res.counts?.repos });
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setIntegrationBusy(false);
    }
  };

  const onModelAction = async (model: InventoryModel, action: string) => {
    setActionMsg(null);
    try {
      if (action === "set_llamacpp_model") {
        await api.vitalsModelAction(action, model.id, { path: model.path_or_tag });
        setActionMsg(`Set llama.cpp modelPath → ${model.path_or_tag}`);
      } else if (action === "set_ollama_preferred") {
        await api.vitalsModelAction(action, model.id, { tag: model.name });
        setActionMsg(`Preferred Ollama model → ${model.name}`);
      } else if (action === "bench_ollama") {
        await runBench([model.name]);
        return;
      }
      await loadInventory();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const runLlamaBench = async () => {
    setLlamaRunning(true);
    setRunError(null);
    try {
      const result = await api.runLlamaCppBench();
      setData(result);
      await loadInventory();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setLlamaRunning(false);
    }
  };

  const presets = useMemo(() => {
    const preferred = [...loadedPresets, ...installedPresets];
    return [...new Set([...preferred, ...DEFAULT_PRESETS])].slice(0, 12);
  }, [installedPresets, loadedPresets]);

  const filteredModels = useMemo(() => {
    const list = inventory?.models || [];
    if (backendFilter === "all") return list;
    if (backendFilter === "gguf") {
      return list.filter((m) => m.backend === "gguf-file" || m.backend === "llamacpp" || m.weight_kind === "gguf" || m.weight_kind === "ggml");
    }
    if (backendFilter === "weight-file") {
      return list.filter((m) =>
        ["weight-file", "hf-safetensors", "onnx"].includes(m.backend)
        || ["safetensors", "onnx", "pytorch", "checkpoint", "bin-weights"].includes(String(m.weight_kind || "")),
      );
    }
    return list.filter((m) => m.backend === backendFilter);
  }, [inventory, backendFilter]);

  const runBench = async (models?: string[]) => {
    const targets = models ?? parseModelsInput(modelInput);
    setRunning(true);
    setRunError(null);
    try {
      const result = await api.runBench(targets);
      setData(result);
      setPageContext({
        benchModelCount: result.rows.length,
        benchPassCount: result.rows.filter((r) => r.status === "pass").length,
        benchUpdatedAt: result.updated_at,
      });
      await loadInventory();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div style={{ opacity: 0.5, fontSize: 13 }}>Loading bench results…</div>;
  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        <div style={{ opacity: 0.75, fontSize: 13 }}>Failed to load bench results.</div>
        {loadError && (
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#fca5a5", fontSize: 12 }}>
            {loadError}
          </div>
        )}
        <button type="button" onClick={load} style={btnStyle(true)}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const rows = data.rows;
  const ollamaOk = Boolean(scanVitals?.ollamaPresent && (scanVitals.installedCount > 0 || scanVitals.loadedCount > 0));
  const ollamaDetail = !scanVitals
    ? "scan pending"
    : scanVitals.scanEmpty
      ? "no scan yet — refresh env"
      : scanVitals.installedCount > 0
        ? `${scanVitals.installedCount} installed · ${scanVitals.loadedCount} loaded`
        : scanVitals.ollamaPresent
          ? "daemon up · 0 models listed"
          : "ollama not detected";

  const llamaDetail = !scanVitals
    ? "scan pending"
    : scanVitals.scanEmpty || (!scanVitals.llamacppPresent && !scanVitals.llamacppReachable && scanVitals.scanStale)
      ? "unknown — refresh env"
      : scanVitals.llamacppReachable
        ? "reachable"
        : scanVitals.llamacppPresent
          ? "binary found · server offline"
          : "not on PATH";

  const llamaHint = scanVitals?.llamaModel
    ? `Configured GGUF: ${scanVitals.llamaModel}`
    : "Set localInference.llamacpp.modelPath in Settings (or use Set as llama.cpp on a GGUF row).";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1100 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontSize: 28, margin: 0, fontWeight: 400, color: "#f5e6d0" }}>
            Local Inference Vitals
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.55, maxWidth: 620, lineHeight: 1.5 }}>
            Machine hub — models, coding agents, repo integrations, and benches.
            HOOT RTK is <strong style={{ color: "#ffb042", fontWeight: 500 }}>preinstalled</strong>. Use chapters to stay focused.
          </p>
          {data.updated_at && (
            <p style={{ margin: "6px 0 0", fontSize: 11, opacity: 0.4 }}>
              CSV updated {new Date(data.updated_at).toLocaleString()}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={refreshEnvironment} disabled={scanning || running} style={btnStyle(false)}>
            <RefreshCw size={14} className={scanning ? "spin" : undefined} />
            {scanning ? "Scanning…" : "Refresh env"}
          </button>
          <button type="button" onClick={() => { void load(); void loadInventory(); }} disabled={refreshing || running} style={btnStyle(false)}>
            <RefreshCw size={14} className={refreshing || inventoryLoading ? "spin" : undefined} />
            {refreshing || inventoryLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <nav
        aria-label="Vitals chapters"
        style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: 4, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
      >
        {VITALS_CHAPTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChapter(c.id)}
            style={chipStyle(chapter === c.id)}
            aria-current={chapter === c.id ? "page" : undefined}
          >
            {c.label}
          </button>
        ))}
      </nav>

      {show("overview") && <Section
        title="Inference vitals"
        caption={
          scanVitals?.scanStale || scanVitals?.scanEmpty
            ? "Environment snapshot is missing or stale — click Refresh env (full scanner, may take 30–90s)."
            : "Snapshot from last environment scan + HOOT-bundled RTK status."
        }
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <VitalChip label="Ollama models" ok={ollamaOk} detail={ollamaDetail} />
          <VitalChip label="llama.cpp" ok={scanVitals?.llamacppReachable} detail={llamaDetail} />
          <VitalChip label="GPU" ok={Boolean(scanVitals?.gpu)} detail={scanVitals?.gpu || "not detected"} />
          <VitalChip
            label="HOOT RTK"
            ok={Boolean(rtk?.present)}
            detail={
              rtk?.present
                ? `${rtk.source || "ready"}${rtk.version ? ` · ${rtk.version}` : ""}`
                : "preinstalled · click Ensure"
            }
          />
          <VitalChip
            label="CSV schema"
            ok={data.validation?.ok}
            detail={data.validation?.ok ? `${data.validation.row_count} rows valid` : (data.validation?.errors?.[0] || "not validated")}
          />
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 11, opacity: 0.5, lineHeight: 1.45 }}>{llamaHint}</p>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={runLlamaBench} disabled={llamaRunning || running} style={btnStyle(true)}>
            <Zap size={14} />
            {llamaRunning ? "Running llama-bench…" : "Run llama-bench (GGUF)"}
          </button>
          <button type="button" onClick={ensureRtk} disabled={rtkBusy} style={btnStyle(true)}>
            <Zap size={14} />
            {rtkBusy ? "Provisioning RTK…" : rtk?.present ? "Refresh HOOT RTK" : "Ensure HOOT RTK"}
          </button>
        </div>
        {actionMsg && (
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "#f5e6d0", opacity: 0.75 }}>{actionMsg}</p>
        )}
      </Section>}

      {show("agents") && <Section
        title="Coding agents & gateways"
        caption="Detect-only doctor row — Claude Code, OmniRoute, ANTHROPIC_BASE_URL, OpenCode. HOOT never rewrites these configs from this panel."
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <VitalChip
            label="Claude Code"
            ok={Boolean(agents?.claude?.present)}
            detail={
              agentsLoading && !agents
                ? "scanning…"
                : agents?.claude?.present
                  ? [
                      agents.claude.version?.replace(/\s*\(Claude Code\)/i, "") || "installed",
                      agents.claude.model || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "not detected"
            }
          />
          <VitalChip
            label="OmniRoute"
            ok={Boolean(agents?.omniroute?.listening)}
            detail={
              agentsLoading && !agents
                ? "scanning…"
                : agents?.omniroute?.listening
                  ? [
                      agents.omniroute.ports?.primary_open && `:${agents.omniroute.ports.primary}`,
                      agents.omniroute.ports?.secondary_open && `:${agents.omniroute.ports.secondary}`,
                    ]
                      .filter(Boolean)
                      .join(" ") || "listening"
                  : agents?.omniroute?.home
                    ? "home · ports idle"
                    : "not detected"
            }
          />
          <VitalChip
            label="ANTHROPIC_BASE_URL"
            ok={Boolean(agents?.base_url?.set)}
            detail={
              agentsLoading && !agents
                ? "scanning…"
                : agents?.base_url?.set
                  ? agents.base_url.points_at_omniroute
                    ? `→ OmniRoute ${agents.base_url.value}`
                    : String(agents.base_url.value)
                  : "unset (default path)"
            }
          />
          <VitalChip
            label="Wired?"
            ok={Boolean(agents?.summary?.wired)}
            detail={
              agentsLoading && !agents
                ? "scanning…"
                : agents?.summary?.wired
                  ? "Claude → OmniRoute"
                  : "not wired (ok for Ollama)"
            }
          />
          <VitalChip
            label="OpenCode"
            ok={Boolean(agents?.opencode?.on_path)}
            detail={
              agentsLoading && !agents
                ? "scanning…"
                : agents?.opencode?.on_path
                  ? agents.opencode.version || "on PATH"
                  : agents?.opencode?.present
                    ? "home only"
                    : "not detected"
            }
          />
        </div>
        {agents?.claude?.path && (
          <p style={{ margin: "12px 0 0", fontSize: 11, opacity: 0.45, lineHeight: 1.45, wordBreak: "break-all" }}>
            Claude path: <code style={{ opacity: 0.85 }}>{agents.claude.path}</code>
            {agents.claude.ollama_api_key_approved ? " · ollama key approved" : ""}
          </p>
        )}
        {agents?.policy?.note && (
          <p style={{ margin: "8px 0 0", fontSize: 11, opacity: 0.4, lineHeight: 1.45 }}>{agents.policy.note}</p>
        )}
        {(agents?.findings?.length ?? 0) > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {agents!.findings.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: severityColor(f.severity) }}>
                  {f.severity.toUpperCase()} · {f.title}
                </div>
                {f.detail && (
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, lineHeight: 1.45 }}>{f.detail}</div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => void loadAgents()} disabled={agentsLoading} style={btnStyle(false)}>
            <RefreshCw size={14} className={agentsLoading ? "spin" : undefined} />
            {agentsLoading ? "Detecting…" : "Re-detect agents"}
          </button>
        </div>
      </Section>}

      {show("overview") && findings.length > 0 && (
        <Section title="Health advise" caption="Read-only findings — duplicates, orphans, freshness, RTK. No automatic deletes.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {findings.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: severityColor(f.severity) }}>
                  {f.severity.toUpperCase()} · {f.title}
                </div>
                {f.detail && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, lineHeight: 1.45 }}>{f.detail}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {show("models") && <Section
        title="Model inventory & manage"
        caption={
          inventory
            ? `${inventory.counts.total} models · ${inventory.counts.ollama} Ollama · ${inventory.counts.gguf} GGUF · ${inventory.counts.lmstudio} LM Studio · ${inventory.counts.duplicates} dup clusters`
            : "Loading unified inventory from Ollama, GGUF discovery, LM Studio, and settings…"
        }
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
          {["all", "ollama", "gguf", "lmstudio", "hf-safetensors", "weight-file"].map((b) => (
            <button key={b} type="button" onClick={() => setBackendFilter(b)} style={chipStyle(backendFilter === b)}>
              {b}
            </button>
          ))}
          <button type="button" onClick={() => void loadInventory("quick")} disabled={inventoryLoading} style={btnStyle(false)}>
            <RefreshCw size={14} />
            {inventoryLoading ? "Scanning…" : "Quick reload"}
          </button>
          <button type="button" onClick={() => void loadInventory("exhaustive")} disabled={inventoryLoading} style={btnStyle(true)}>
            <FolderSearch size={14} />
            {inventoryLoading ? "Exhaustive scan…" : "Exhaustive scan (all drives)"}
          </button>
        </div>
        {inventory?.coverage && (
          <p style={{ fontSize: 11, opacity: 0.5, margin: "0 0 12px", lineHeight: 1.45 }}>
            Mode: <strong style={{ color: "#ffb042" }}>{inventory.mode || inventory.coverage.mode || "quick"}</strong>
            {" · "}drives: {(inventory.coverage.drives_detected || []).join(", ") || "—"}
            {" · "}on-disk files: {inventory.coverage.files_total ?? "—"}
            {inventory.coverage.by_kind && ` · kinds: ${Object.entries(inventory.coverage.by_kind).map(([k, v]) => `${k}=${v}`).join(", ")}`}
            {inventory.coverage.by_drive && ` · by drive: ${Object.entries(inventory.coverage.by_drive).map(([k, v]) => `${k}:${v}`).join(" ")}`}
            {inventory.coverage.truncated ? " · ⚠ truncated (raise limits / re-run)" : ""}
            {inventory.counts?.safetensors != null ? ` · safetensors rows: ${inventory.counts.safetensors}` : ""}
          </p>
        )}
        {!inventory || filteredModels.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.55 }}>
            {inventoryLoading
              ? "Discovering models across drives… exhaustive mode can take 2–5+ minutes on large disks."
              : "No models found. Run Exhaustive scan (all drives) — quick mode only hits known hot roots."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["Model", "Backend", "Size", "Flags", "Bench", "Advise / manage"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredModels.map((m) => (
                  <tr key={m.id}>
                    <td style={tdLeft}>
                      <code style={{ fontSize: 11 }}>{m.name}</code>
                      {m.drive && <div style={{ fontSize: 10, opacity: 0.45 }}>{m.drive} · {m.path_or_tag.length > 48 ? `…${m.path_or_tag.slice(-40)}` : m.path_or_tag}</div>}
                      {!m.drive && m.backend === "ollama" && m.loaded && <div style={{ fontSize: 10, color: "#6ee7b7" }}>loaded</div>}
                    </td>
                    <td style={tdLeft}>{m.backend}</td>
                    <td style={tdRight}>{formatSize(m.size_bytes)}</td>
                    <td style={tdLeft}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(m.flags || []).map((f) => (
                          <span key={f} style={flagStyle(f)}>{f}</span>
                        ))}
                        {!(m.flags || []).length && <span style={{ opacity: 0.4 }}>—</span>}
                      </div>
                    </td>
                    <td style={tdRight}>
                      {m.bench ? (
                        <span style={{ color: statusColor(m.bench.status) }}>
                          {m.bench.tier || m.bench.status} {m.bench.tokens_per_sec ? `· ${m.bench.tokens_per_sec}` : ""}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={tdLeft}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {(m.advise || []).slice(0, 2).map((a, i) => (
                          <div key={i} style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.35 }}>
                            {a.url ? (
                              <a href={a.url} target="_blank" rel="noreferrer" style={{ color: "#ffb042" }}>{a.title}</a>
                            ) : (
                              a.title
                            )}
                            {a.command && <div style={{ fontFamily: "ui-monospace, monospace", opacity: 0.55 }}>{a.command}</div>}
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                          {m.backend === "ollama" && (
                            <>
                              <button type="button" style={miniBtn} onClick={() => onModelAction(m, "bench_ollama")}>Bench</button>
                              <button type="button" style={miniBtn} onClick={() => onModelAction(m, "set_ollama_preferred")}>Prefer</button>
                            </>
                          )}
                          {(m.backend === "gguf-file" || m.backend === "llamacpp") && (
                            <button type="button" style={miniBtn} onClick={() => onModelAction(m, "set_llamacpp_model")}>
                              Set as llama.cpp
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>}

      {show("models") && inventory?.safetensors && inventory.safetensors.packages?.length > 0 && (
        <Section
          title="SafeTensors packages (safe manage)"
          caption="Grouped by folder — shards like out-000xx are ONE model. Verdicts: keep / review / quarantine candidate. Quarantine moves the whole folder (undoable); never auto-deletes."
        >
          <p style={{ fontSize: 11, opacity: 0.55, margin: "0 0 12px" }}>
            {inventory.safetensors.summary.packages} packages · {inventory.safetensors.summary.files} files · ~
            {(inventory.safetensors.summary.total_bytes / 1e9).toFixed(1)} GB · keep {inventory.safetensors.summary.keep} · review{" "}
            {inventory.safetensors.summary.review} · quarantine {inventory.safetensors.summary.quarantine_candidates}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {inventory.safetensors.packages.map((pkg: any) => (
              <div
                key={pkg.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${
                    pkg.verdict === "keep"
                      ? "rgba(52,211,153,0.25)"
                      : pkg.verdict === "quarantine_candidate"
                        ? "rgba(248,113,113,0.3)"
                        : "rgba(251,191,36,0.25)"
                  }`,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#f5e6d0" }}>
                      {pkg.verdict.toUpperCase()} · {pkg.usefulness.replace(/_/g, " ")}
                    </div>
                    <code style={{ fontSize: 11, opacity: 0.7 }}>{pkg.path}</code>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                      {pkg.file_count} files · {pkg.shard_count} shards · ~{(pkg.total_bytes / 1e9).toFixed(1)} GB · {pkg.confidence} confidence
                    </div>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 11, opacity: 0.65, lineHeight: 1.45 }}>
                      {(pkg.reasons || []).map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {pkg.verdict === "quarantine_candidate" && (
                      <button
                        type="button"
                        style={miniBtn}
                        onClick={() => {
                          if (!window.confirm(`Quarantine entire package?\n\n${pkg.path}\n\nThis moves the folder (not permanent delete). You can restore from quarantine log.`)) return;
                          void (async () => {
                            try {
                              await api.vitalsModelAction("quarantine_package", pkg.id, { path: pkg.path });
                              setActionMsg(`Quarantined ${pkg.path}`);
                              await loadInventory();
                            } catch (e) {
                              setActionMsg(e instanceof Error ? e.message : String(e));
                            }
                          })();
                        }}
                      >
                        Quarantine package…
                      </button>
                    )}
                    {pkg.verdict === "keep" && (
                      <span style={{ fontSize: 10, color: "#6ee7b7" }}>Recommended: keep</span>
                    )}
                    {pkg.verdict === "review" && (
                      <span style={{ fontSize: 10, color: "#fbbf24" }}>Manual review — not junk by default</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 10, opacity: 0.45, lineHeight: 1.45 }}>
            {inventory.safetensors.policy?.note || "Manage whole folders only."} Permanent delete is never exposed.
          </p>
        </Section>
      )}

      {show("integrations") && <Section
        title="Repo integration scan"
        caption="Bounded scan of portfolio/active repos for module, MCP, prefab, and HOOT RTK opportunities — reuses modules-catalog (no second plugin system)."
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <button type="button" style={chipStyle(integrationScope === "active")} onClick={() => setIntegrationScope("active")}>Active project</button>
          <button type="button" style={chipStyle(integrationScope === "portfolio")} onClick={() => setIntegrationScope("portfolio")}>Portfolio roots</button>
          <button type="button" onClick={runIntegrationScan} disabled={integrationBusy} style={btnStyle(true)}>
            <FolderSearch size={14} />
            {integrationBusy ? "Scanning repos…" : "Scan repos"}
          </button>
          <button type="button" onClick={() => navigate("/modules")} style={btnStyle(false)}>
            Open Modules
          </button>
        </div>
        {integration && (
          <>
            <p style={{ fontSize: 11, opacity: 0.5, margin: "0 0 10px" }}>
              {integration.counts.repos} repos · {integration.counts.candidates} candidates
              {integration.policy?.rtk ? ` · ${integration.policy.rtk}` : ""}
            </p>
            {integration.candidates.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.55 }}>No integration candidates for this scope.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["Repo", "Opportunity", "Type", "Confidence", "Action"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {integration.candidates.map((c) => (
                      <tr key={c.id}>
                        <td style={tdLeft}><code style={{ fontSize: 11 }}>{c.repo}</code></td>
                        <td style={tdLeft}>
                          <div style={{ fontSize: 12 }}>{c.opportunity}</div>
                          {c.detail && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2, maxWidth: 360 }}>{c.detail}</div>}
                        </td>
                        <td style={tdLeft}>{c.integration_type}</td>
                        <td style={tdLeft}>{c.confidence}</td>
                        <td style={tdLeft}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(c.actions || []).map((a, i) => (
                              a.type === "navigate" && a.target ? (
                                <button key={i} type="button" style={miniBtn} onClick={() => navigate(a.target!)}>{a.label}</button>
                              ) : a.type === "api" && a.path?.includes("rtk") ? (
                                <button key={i} type="button" style={miniBtn} onClick={() => void ensureRtk()}>{a.label}</button>
                              ) : (
                                <span key={i} style={{ fontSize: 10, opacity: 0.5 }}>{a.label}</span>
                              )
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {!integration && (
          <div style={{ fontSize: 12, opacity: 0.5 }}>Run Scan repos to map modules/plugins/MCP/RTK opportunities onto portfolio projects.</div>
        )}
      </Section>}

      {show("bench") && <Section
        title="Run Ollama benchmark"
        caption="Comma- or newline-separated Ollama model tags. Prefills from installed models when available."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <textarea
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            rows={3}
            placeholder="gemma4:latest, phi3:mini"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)",
              color: "#dadada",
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => runBench()} disabled={running} style={btnStyle(true)}>
              <Play size={14} />
              {running ? "Running bench…" : "Run bench"}
            </button>
            {presets.map((preset) => {
              const loaded = loadedPresets.includes(preset);
              const installed = installedPresets.includes(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setModelInput(preset);
                    runBench([preset]);
                  }}
                  disabled={running}
                  style={chipStyle(loaded || installed)}
                >
                  <Cpu size={12} />
                  {preset}
                  {loaded ? " · loaded" : installed ? " · installed" : ""}
                </button>
              );
            })}
          </div>
          {runError && (
            <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#fca5a5", fontSize: 12 }}>
              {runError}
            </div>
          )}
        </div>
      </Section>}

      {show("bench") && <Section title="Bench results" caption={rows.length ? `${rows.length} models · scoring tiers: fast ≥20 tok/s · ok ≥8 · slow pass` : "No CSV yet — run a bench to populate state/bench-results.csv"}>
        {rows.length === 0 ? (
          <div style={{ padding: 16, borderRadius: 12, border: "1px solid rgba(255,176,66,0.2)", background: "rgba(255,176,66,0.06)", fontSize: 12, lineHeight: 1.55 }}>
            <strong style={{ color: "#ffb042" }}>No bench data yet.</strong> Ensure Ollama is running, then run a preset or enter model tags above.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["Model", "Backend", "Status", "Latency", "Tokens/sec", "Tier", "Note"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.backend || "ollama"}:${row.model}`}>
                    <td style={tdLeft}><code style={{ fontSize: 12 }}>{row.model}</code></td>
                    <td style={tdLeft}>{row.backend || "ollama"}</td>
                    <td style={tdLeft}>
                      <span style={{ color: statusColor(row.status), fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={tdRight}>{Number(row.latency_ms) || 0} ms</td>
                    <td style={tdRight}>{formatTps(row.tokens_per_sec)}</td>
                    <td style={tdRight}>{tierLabel(row)}</td>
                    <td style={{ ...tdLeft, opacity: 0.6, fontSize: 11, maxWidth: 280 }}>{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>}

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
        <Activity size={14} color="#ffb042" />
        Advise is default. Manage actions confirm medium risk only. Destructive model delete is not enabled yet (doctor phase). HOOT RTK ships preinstalled into HootAi/bin.
      </div>
    </div>
  );
}

function VitalChip({ label, ok, detail }: { label: string; ok?: boolean; detail: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${ok ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.1)"}`,
        background: ok ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.03)",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 10, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: ok ? "#6ee7b7" : "#d1d5db" }}>{detail}</div>
    </div>
  );
}

function flagStyle(flag: string): React.CSSProperties {
  const hot = flag === "duplicate" || flag === "stale_file";
  return {
    fontSize: 9,
    padding: "2px 6px",
    borderRadius: 6,
    border: `1px solid ${hot ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.12)"}`,
    color: hot ? "#fbbf24" : "#aaa",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  };
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

function chipStyle(active: boolean) {
  return {
    padding: "7px 11px",
    borderRadius: 8,
    border: active ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.03)",
    color: active ? "#6ee7b7" : "#aaa",
    cursor: "pointer",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    gap: 6,
  } as const;
}

const miniBtn: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255,176,66,0.25)",
  background: "rgba(255,176,66,0.06)",
  color: "#ffb042",
  cursor: "pointer",
  fontSize: 10,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
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
  whiteSpace: "normal",
};
