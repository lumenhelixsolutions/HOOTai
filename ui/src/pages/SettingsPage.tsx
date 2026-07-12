import { useState, useEffect } from "react";
import { Key, Save, CheckCircle, Database, Sparkles, Cpu, Zap, RefreshCw, Wifi, Shield, Info, PanelLeft, Tag } from "lucide-react";
import type { HootVersionInfo } from "@/lib/api";
import { api } from "../lib/api";
import { useCoach } from "@/context/CoachContext";
import HybridWorkspaceSettings from "@/components/hybrid/HybridWorkspaceSettings";
import { useSidebarTooltips } from "@/hooks/useSidebarTooltips";
import { useVersionHistory } from "@/hooks/useVersionHistory";

type VaultKeyRow = {
  name: string;
  provider: string;
  masked: string;
  source: string;
  updatedAt: string;
};

const KEY_DEFS = [
  { provider: "gemini", keyName: "GEMINI_API_KEY" },
  { provider: "openai", keyName: "OPENAI_API_KEY" },
  { provider: "anthropic", keyName: "ANTHROPIC_API_KEY" },
  { provider: "openrouter", keyName: "OPENROUTER_API_KEY" },
  { provider: "moonshot", keyName: "MOONSHOT_API_KEY" },
  { provider: "groq", keyName: "GROQ_API_KEY" },
  { provider: "xai", keyName: "XAI_API_KEY" },
];

interface LlamaCppSettings {
  enabled: boolean;
  binary: string;
  modelPath: string;
  host: string;
  port: number;
  contextSize: number;
  nGpuLayers: number;
  threads: number;
  extraArgs: string;
}

interface LmStudioSettings {
  enabled: boolean;
  host: string;
  port: number;
  protocol: string;
  basePath: string;
  defaultModel: string;
}

interface HootBrainSettings {
  mode: string;
  ollama_model: string;
  cloud_provider: string;
}

interface ServerSettings {
  localInference: {
    preferredBackend: string;
    lmstudio: LmStudioSettings;
    llamacpp: LlamaCppSettings;
  };
  tokenEfficiency: { rtkRecommended: boolean };
  hoot_brain?: HootBrainSettings;
  auth?: { enabled: boolean; token_hash?: string | null; created_at?: string | null };
  network?: { lan_enabled?: boolean };
}

export default function SettingsPage() {
  const { setPageContext } = useCoach();
  const [vaultKeys, setVaultKeys] = useState<VaultKeyRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modelProvider, setModelProvider] = useState("auto");
  const [brainStatus, setBrainStatus] = useState<{ provider?: string; model?: string; available?: boolean } | null>(null);
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
  const [scanHints, setScanHints] = useState<{ rtk?: { present?: boolean }; wsl?: { present?: boolean }; lmstudio?: { present?: boolean; server?: { reachable?: boolean; host?: string; port?: number }; models?: Array<{ name?: string }> }; llamacpp?: { present?: boolean; server?: { reachable?: boolean } } } | null>(null);
  const [status, setStatus] = useState<{ urls?: string[]; bind?: { lan: boolean; port: number }; version?: string; display?: string; info?: HootVersionInfo } | null>(null);
  const [authStatus, setAuthStatus] = useState<{ enabled: boolean; authenticated: boolean } | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [sidebarTooltips, setSidebarTooltips] = useSidebarTooltips();
  const { history: versionHistory, record: recordVersion, isNew: versionIsNew } = useVersionHistory(status?.info);

  useEffect(() => {
    if (status?.info) recordVersion();
  }, [status?.info, recordVersion]);

  const loadKeys = () => {
    api.getKeys().then((r) => setVaultKeys(r.keys || [])).catch(() => setVaultKeys([]));
  };

  useEffect(() => {
    setModelProvider(localStorage.getItem("agentdock_model_provider") || "auto");
    api.getCoachBrain().then((r) => setBrainStatus(r.brain as typeof brainStatus)).catch(() => {});
    setCustomEndpoint(localStorage.getItem("agentdock_custom_endpoint") || "");
    loadKeys();
    api.getSettings().then((r) => {
      setServerSettings(r.settings);
      setScanHints(r.scanHints);
      if (r.keys?.length) setVaultKeys(r.keys);
    }).catch(() => {});
    api.getStatus().then(setStatus).catch(() => {});
    api.getAuthStatus().then(setAuthStatus).catch(() => {});
  }, []);

  useEffect(() => {
    setPageContext({
      preferredLocalBackend: serverSettings?.localInference?.preferredBackend || 'ollama',
      lmstudioEnabled: Boolean(serverSettings?.localInference?.lmstudio?.enabled),
      lmstudioInterest: Boolean(scanHints?.lmstudio?.present || scanHints?.lmstudio?.server?.reachable),
      llamacppEnabled: Boolean(serverSettings?.localInference?.llamacpp?.enabled),
      llamacppInterest: Boolean(scanHints?.llamacpp?.present || scanHints?.llamacpp?.server?.reachable),
      vaultKeyCount: vaultKeys.length,
    });
  }, [serverSettings, scanHints, vaultKeys.length, setPageContext]);

  const updateHootBrain = (patch: Partial<HootBrainSettings>) => {
    setServerSettings((prev) =>
      prev
        ? {
            ...prev,
            hoot_brain: { mode: "auto", ollama_model: "", cloud_provider: "gemini", ...prev.hoot_brain, ...patch },
          }
        : prev
    );
  };

  const updateLlama = (patch: Partial<LlamaCppSettings>) => {
    setServerSettings((prev) =>
      prev
        ? {
            ...prev,
            localInference: {
              ...prev.localInference,
              llamacpp: { ...prev.localInference.llamacpp, ...patch },
            },
          }
        : prev
    );
  };

  const updateLmStudio = (patch: Partial<LmStudioSettings>) => {
    setServerSettings((prev) =>
      prev
        ? {
            ...prev,
            localInference: {
              ...prev.localInference,
              lmstudio: { ...prev.localInference.lmstudio, ...patch },
            },
          }
        : prev
    );
  };

  const syncFromScan = async () => {
    setSyncing(true);
    try {
      const r = await api.syncKeys();
      setVaultKeys((r.keys || []) as VaultKeyRow[]);
    } finally {
      setSyncing(false);
    }
  };

  const save = async () => {
    localStorage.setItem("agentdock_model_provider", modelProvider);
    localStorage.setItem("agentdock_custom_endpoint", customEndpoint);
    for (const [name, value] of Object.entries(drafts)) {
      if (value.trim()) await api.saveKey(name, value.trim());
    }
    setDrafts({});
    loadKeys();
    if (serverSettings) {
      try {
        await api.saveSettings(serverSettings);
      } catch {
        /* optional */
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#f5f5f5",
    fontSize: 13,
    fontFamily: "'GeistMono', monospace",
  };

  const rowFor = (keyName: string) => vaultKeys.find((k) => k.name === keyName);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>Settings</h2>
        <button
          onClick={save}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid rgba(74,222,128,0.3)",
            background: saved ? "rgba(74,222,128,0.2)" : "rgba(74,222,128,0.1)",
            color: "#4ade80",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? "Saved!" : "Save"}
        </button>
      </div>

      <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Cpu size={16} color="#4ade80" />
          <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>HOOT Brain (local-first)</h3>
        </div>
        <p style={{ fontSize: 12, opacity: 0.5, margin: "0 0 12px" }}>
          Auto uses Ollama when detected, then LM Studio, then llama.cpp, then screen-aware rules. Cloud uses API keys below.
          {brainStatus?.available && (
            <span style={{ color: "#4ade80", display: "block", marginTop: 6 }}>
              Active: {brainStatus.provider} · {brainStatus.model || "default"}
            </span>
          )}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {["auto", "ollama", "lmstudio", "llamacpp", "cloud"].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateHootBrain({ mode })}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: serverSettings?.hoot_brain?.mode === mode || (!serverSettings?.hoot_brain?.mode && mode === "auto")
                  ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.08)",
                background: serverSettings?.hoot_brain?.mode === mode || (!serverSettings?.hoot_brain?.mode && mode === "auto")
                  ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.02)",
                color: serverSettings?.hoot_brain?.mode === mode || (!serverSettings?.hoot_brain?.mode && mode === "auto")
                  ? "#4ade80" : "#dadada",
                cursor: "pointer",
                fontSize: 12,
                textTransform: "capitalize",
              }}
            >
              {mode}
            </button>
          ))}
        </div>
        {serverSettings?.hoot_brain?.mode === "ollama" && (
          <input
            value={serverSettings.hoot_brain.ollama_model || ""}
            onChange={(e) => updateHootBrain({ ollama_model: e.target.value })}
            placeholder="Ollama model override (e.g. llama3.2:3b)"
            style={{ ...inputStyle, marginBottom: 12 }}
          />
        )}
        {serverSettings?.hoot_brain?.mode === "lmstudio" && (
          <input
            value={serverSettings.localInference.lmstudio.defaultModel || ""}
            onChange={(e) => updateLmStudio({ defaultModel: e.target.value })}
            placeholder="LM Studio model id override (optional)"
            style={{ ...inputStyle, marginBottom: 12 }}
          />
        )}
      </div>

      <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Sparkles size={16} color="#ffb042" />
          <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>Cloud Model Override</h3>
        </div>
        <p style={{ fontSize: 12, opacity: 0.5, margin: "0 0 12px" }}>
          Optional browser override when HOOT brain mode is Cloud. Keys come from the local vault.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["auto", "gemini", "openai", "anthropic", "openrouter", "groq", "xai", "custom"].map((p) => (
            <button
              key={p}
              onClick={() => setModelProvider(p)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: modelProvider === p ? "rgba(255,176,66,0.4)" : "rgba(255,255,255,0.08)",
                background: modelProvider === p ? "rgba(255,176,66,0.1)" : "rgba(255,255,255,0.02)",
                color: modelProvider === p ? "#ffb042" : "#dadada",
                cursor: "pointer",
                fontSize: 12,
                textTransform: "capitalize",
              }}
            >
              {p}
            </button>
          ))}
        </div>
        {modelProvider === "custom" && (
          <input
            value={customEndpoint}
            onChange={(e) => setCustomEndpoint(e.target.value)}
            placeholder="https://api.openai.com/v1/chat/completions"
            style={{ ...inputStyle, marginTop: 12 }}
          />
        )}
      </div>

      {serverSettings && (
        <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Cpu size={16} color="#4ade80" />
            <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>Local Inference</h3>
          </div>
          <p style={{ fontSize: 12, opacity: 0.55, margin: "0 0 12px", lineHeight: 1.5 }}>
            HOOT can build local, cloud, and hybrid stacks from the backends it discovers. Pick the default local engine and tune each runtime below.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {["ollama", "lmstudio", "llamacpp"].map((backend) => (
              <button
                key={backend}
                type="button"
                onClick={() =>
                  setServerSettings((prev) =>
                    prev ? { ...prev, localInference: { ...prev.localInference, preferredBackend: backend } } : prev
                  )
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: serverSettings.localInference.preferredBackend === backend ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.08)",
                  background: serverSettings.localInference.preferredBackend === backend ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.02)",
                  color: serverSettings.localInference.preferredBackend === backend ? "#4ade80" : "#dadada",
                  cursor: "pointer",
                  fontSize: 12,
                  textTransform: "capitalize",
                }}
              >
                {backend === "lmstudio" ? "LM Studio" : backend}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 18, padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <strong style={{ fontSize: 13, color: "#f5f5f5" }}>LM Studio</strong>
              <span style={{ fontSize: 11, color: scanHints?.lmstudio?.server?.reachable ? "#4ade80" : scanHints?.lmstudio?.present ? "#fbbf24" : "rgba(255,255,255,0.45)" }}>
                {scanHints?.lmstudio?.server?.reachable ? "reachable" : scanHints?.lmstudio?.present ? "detected" : "not detected"}
              </span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={serverSettings.localInference.lmstudio.enabled}
                onChange={(e) => updateLmStudio({ enabled: e.target.checked })}
              />
              Enable LM Studio OpenAI-compatible backend
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["host", "Host", "text"],
                ["port", "Port", "number"],
                ["protocol", "Protocol", "text"],
                ["basePath", "Base path", "text"],
                ["defaultModel", "Default model id", "text"],
              ].map(([key, label, type]) => (
                <div key={key} style={{ gridColumn: key === "defaultModel" ? "1 / -1" : undefined }}>
                  <label style={{ fontSize: 11, opacity: 0.5, display: "block", marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    value={String((serverSettings.localInference.lmstudio as Record<string, unknown>)[key] ?? "")}
                    onChange={(e) =>
                      updateLmStudio({
                        [key]: type === "number" ? Number(e.target.value) : e.target.value,
                      } as Partial<LmStudioSettings>)
                    }
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            {scanHints?.lmstudio?.models?.length ? (
              <p style={{ fontSize: 11, color: "#93c5fd", margin: "10px 0 0" }}>
                Detected models: {scanHints.lmstudio.models.map((model) => model.name).filter(Boolean).slice(0, 4).join(", ")}
              </p>
            ) : (
              <p style={{ fontSize: 11, opacity: 0.5, margin: "10px 0 0" }}>
                Default endpoint: {serverSettings.localInference.lmstudio.protocol}://{serverSettings.localInference.lmstudio.host}:{serverSettings.localInference.lmstudio.port}{serverSettings.localInference.lmstudio.basePath}/chat/completions
              </p>
            )}
          </div>
          <div style={{ marginBottom: 6, padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <strong style={{ fontSize: 13, color: "#f5f5f5" }}>llama.cpp</strong>
              <span style={{ fontSize: 11, color: scanHints?.llamacpp?.server?.reachable ? "#4ade80" : scanHints?.llamacpp?.present ? "#fbbf24" : "rgba(255,255,255,0.45)" }}>
                {scanHints?.llamacpp?.server?.reachable ? "reachable" : scanHints?.llamacpp?.present ? "detected" : "not detected"}
              </span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={serverSettings.localInference.llamacpp.enabled}
                onChange={(e) => updateLlama({ enabled: e.target.checked })}
              />
              Enable llama.cpp backend
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["binary", "Binary (llama-server)", "text"],
                ["modelPath", "GGUF model path", "text"],
                ["host", "Host", "text"],
                ["port", "Port", "number"],
              ].map(([key, label, type]) => (
                <div key={key} style={{ gridColumn: key === "modelPath" ? "1 / -1" : undefined }}>
                  <label style={{ fontSize: 11, opacity: 0.5, display: "block", marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    value={String((serverSettings.localInference.llamacpp as Record<string, unknown>)[key] ?? "")}
                    onChange={(e) =>
                      updateLlama({
                        [key]: type === "number" ? Number(e.target.value) : e.target.value,
                      } as Partial<LlamaCppSettings>)
                    }
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Key size={16} color="#ffb042" />
            <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>API Keys (local vault)</h3>
          </div>
          <button
            type="button"
            onClick={syncFromScan}
            disabled={syncing}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)", color: "#dadada", cursor: "pointer", fontSize: 11,
              display: "flex", alignItems: "center", gap: 6, opacity: syncing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={12} />
            {syncing ? "Syncing…" : "Pull from scan"}
          </button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.5, margin: "0 0 16px" }}>
          Keys auto-import from process env and scanned <code>.env</code> files on every Readiness scan.
          Stored in <code>state/key-vault.json</code> on your machine. UI shows last 3 characters only.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {KEY_DEFS.map((def) => {
            const stored = rowFor(def.keyName);
            return (
              <div key={def.keyName} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, width: 100, textTransform: "uppercase", opacity: 0.6 }}>{def.provider}</span>
                <input
                  type="password"
                  value={drafts[def.keyName] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [def.keyName]: e.target.value }))}
                  placeholder={stored ? `Stored ${stored.masked}` : `Enter ${def.keyName}…`}
                  style={{ ...inputStyle, flex: 1 }}
                />
                {stored && !drafts[def.keyName] && (
                  <span style={{ fontSize: 11, color: "#4ade80", fontFamily: "'GeistMono', monospace", minWidth: 72 }}>
                    {stored.masked}
                  </span>
                )}
                {stored && (
                  <span style={{ fontSize: 10, opacity: 0.45, maxWidth: 120 }} title={stored.source}>
                    {stored.source.startsWith("env-file") ? "from .env" : stored.source}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {vaultKeys.length > 0 && (
          <p style={{ fontSize: 11, color: "#4ade80", margin: "12px 0 0" }}>
            {vaultKeys.length} key{vaultKeys.length === 1 ? "" : "s"} in vault — used for coach, stack builder, and launches.
          </p>
        )}
      </div>

      <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Wifi size={16} color="#93c5fd" />
          <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>Network (LAN)</h3>
        </div>
        <p style={{ fontSize: 12, opacity: 0.55, margin: "0 0 12px", lineHeight: 1.5 }}>
          Start HOOT with <code>AGENTDOCK_LAN=1</code> to listen on your Wi‑Fi. Other devices open the LAN URL below.
          Windows firewall may need port {status?.bind?.port || 7777} allowed.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {(status?.urls || ["http://127.0.0.1:7777"]).map((url) => (
            <div key={url} style={{ fontSize: 12, fontFamily: "'GeistMono', monospace", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              {url}
              <button type="button" onClick={() => navigator.clipboard.writeText(url)} style={{ marginLeft: 10, fontSize: 10, opacity: 0.6, background: "none", border: "none", color: "#93c5fd", cursor: "pointer" }}>Copy</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Shield size={14} color="#fbbf24" />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={Boolean(serverSettings?.auth?.enabled)}
              onChange={(e) =>
                setServerSettings((prev) =>
                  prev ? { ...prev, auth: { ...prev.auth, enabled: e.target.checked, token_hash: prev.auth?.token_hash || null } } : prev
                )
              }
            />
            Require HOOT token on LAN (localhost always trusted)
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={tokenBusy}
            onClick={async () => {
              setTokenBusy(true);
              try {
                const r = await api.generateAuthToken(serverSettings?.auth?.enabled !== false);
                setNewToken(r.token);
                setAuthStatus({ enabled: true, authenticated: true });
                if (serverSettings) setServerSettings({ ...serverSettings, auth: { enabled: true, token_hash: "set", created_at: new Date().toISOString() } });
              } finally {
                setTokenBusy(false);
              }
            }}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.08)", color: "#fbbf24", cursor: "pointer", fontSize: 12 }}
          >
            {tokenBusy ? "Generating…" : "Generate / rotate token"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await api.clearAuthToken();
              setNewToken(null);
              setAuthStatus({ enabled: false, authenticated: true });
              if (serverSettings) setServerSettings({ ...serverSettings, auth: { enabled: false, token_hash: null } });
            }}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 12 }}
          >
            Disable auth
          </button>
        </div>
        {newToken && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", fontSize: 12 }}>
            <div style={{ color: "#fbbf24", marginBottom: 6 }}>Copy this token now — it won’t be shown again:</div>
            <code style={{ wordBreak: "break-all" }}>{newToken}</code>
          </div>
        )}
        {authStatus && (
          <p style={{ fontSize: 11, margin: "12px 0 0", opacity: 0.5 }}>
            Auth: {authStatus.enabled ? "on" : "off"} · You: {authStatus.authenticated ? "authenticated" : "needs token"}
          </p>
        )}
      </div>

      <HybridWorkspaceSettings />

      <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <PanelLeft size={16} color="#ffb042" />
          <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>UI Preferences</h3>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <span style={{ opacity: 0.85 }}>Show sidebar navigation tooltips</span>
          <input
            type="checkbox"
            checked={sidebarTooltips}
            onChange={(e) => setSidebarTooltips(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "#ffb042" }}
          />
        </label>
        <p style={{ fontSize: 11, opacity: 0.5, margin: "8px 0 0" }}>
          Toggle the explanatory tooltips that appear when hovering over the left sidebar menu items.
        </p>
      </div>

      {status?.info && (
        <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Info size={16} color="#ffb042" />
            <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>About HOOT</h3>
            {versionIsNew && (
              <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,176,66,0.15)", color: "#ffb042" }}>
                New version
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
            <div><span style={{ opacity: 0.5 }}>Release</span><div style={{ marginTop: 2, fontWeight: 600 }}>{status.info.display}</div></div>
            {status.info.changelog_headline && (
              <div style={{ opacity: 0.75, lineHeight: 1.5 }}>{status.info.changelog_headline}</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
              <VersionRow label="VERSION file" value={status.info.sources?.version_file || "—"} />
              <VersionRow label="Engine package" value={status.info.sources?.engine_package || "—"} />
              <VersionRow label="UI package" value={status.info.sources?.ui_package || "—"} />
              <VersionRow label="C.O.R.E." value={status.info.core ? `${status.info.core.name} v${status.info.core.version}` : "—"} />
              <VersionRow label="Node" value={status.info.engine?.node || "—"} />
              <VersionRow label="CE cache" value={status.info.sources?.ce_cache || "—"} />
            </div>
            {status.info.git && (
              <div style={{ fontFamily: "'GeistMono', monospace", fontSize: 11, opacity: 0.7 }}>
                git {status.info.git.branch} @ {status.info.git.commit}{status.info.git.dirty ? " (dirty)" : ""}
              </div>
            )}
            {status.urls?.[0] && (
              <div style={{ fontSize: 11, opacity: 0.55 }}>Serving at {status.urls.join(", ")}</div>
            )}
            {versionHistory.length > 1 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 10, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Recent versions seen</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {versionHistory.slice(0, 5).map((entry, i) => (
                    <div key={entry.display + i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Tag size={12} color={i === 0 ? "#ffb042" : "rgba(245,245,245,0.4)"} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{entry.display}</div>
                        {entry.headline && <div style={{ fontSize: 10, opacity: 0.6, lineHeight: 1.4 }}>{entry.headline}</div>}
                        <div style={{ fontSize: 9, opacity: 0.4 }}>{new Date(entry.seenAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Zap size={16} color="#fbbf24" />
          <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>Token Efficiency (RTK)</h3>
        </div>
        {scanHints && (
          <p style={{ fontSize: 11, margin: 0, color: scanHints.rtk?.present ? "#4ade80" : "#fbbf24" }}>
            RTK: {scanHints.rtk?.present ? "installed" : "not detected"}
          </p>
        )}
      </div>

      <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Database size={16} color="#ffb042" />
          <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>Local Data</h3>
        </div>
        <button
          onClick={async () => {
            if (!confirm("Clear all vault API keys?")) return;
            for (const k of vaultKeys) await api.deleteKey(k.name);
            setVaultKeys([]);
            localStorage.removeItem("agentdock_api_keys");
            localStorage.removeItem("agentdock_gemini_key");
          }}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontSize: 12,
          }}
        >
          Clear API Keys
        </button>
      </div>
    </div>
  );
}

function VersionRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ opacity: 0.5, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ marginTop: 2, fontFamily: "'GeistMono', monospace", fontSize: 11 }}>{value}</div>
    </div>
  );
}
