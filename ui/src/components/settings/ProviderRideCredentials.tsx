/**
 * ProviderRide sealed credential intake — AES-GCM vault, masks only in UI.
 */

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { KeyRound, RefreshCw, Shield, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ProviderRideCredCatalog, ProviderRideCredItem } from "@/lib/provider-ride";

const CLOUD_PROVIDERS = ["claude", "chatgpt", "gemini", "kimi", "deepseek", "perplexity"] as const;
const KINDS = [
  { id: "api_key", label: "API key" },
  { id: "session", label: "Session token" },
  { id: "cookie", label: "Cookie export" },
] as const;

export default function ProviderRideCredentials() {
  const [items, setItems] = useState<ProviderRideCredItem[]>([]);
  const [catalog, setCatalog] = useState<ProviderRideCredCatalog[]>([]);
  const [cipher, setCipher] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<string>("claude");
  const [kind, setKind] = useState<string>("api_key");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.getProviderRideCredentials();
      setItems(r.items || []);
      setCatalog(r.catalog || []);
      setCipher(r.cipher || r.keyVault?.cipher || "aes-256-gcm");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load credentials");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    if (!value.trim()) {
      setErr("Paste a secret first");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api.putProviderRideCredential({
        provider,
        kind,
        value: value.trim(),
      });
      if (!r.ok) {
        setErr(r.error || "Store failed");
        return;
      }
      setValue("");
      setMsg(`Sealed ${r.slot || `${provider}:${kind}`} · ${r.masked || "••••"}${r.dual_write ? " · dual-wrote launch vault" : ""}`);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Store failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const [p, k] = id.split(":");
    if (!p) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.deleteProviderRideCredential(p, k || "api_key");
      if (!r.ok) setErr(r.error || "Delete failed");
      else {
        setMsg(`Removed ${id}`);
        await reload();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle: CSSProperties = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.35)",
    color: "#ece8e1",
    fontSize: 12,
    fontFamily: "'GeistMono', 'Fira Code', monospace",
  };

  return (
    <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Shield size={16} color="#ffb042" />
        <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>ProviderRide credentials</h3>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "#dadada",
            cursor: "pointer",
            fontSize: 11,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : undefined} />
          Refresh
        </button>
      </div>
      <p style={{ fontSize: 12, opacity: 0.5, margin: "0 0 14px", lineHeight: 1.5 }}>
        Seal API keys, session tokens, or manual cookie exports for ProviderRide.
        <strong> AES-256-GCM</strong> at rest under <code>state/provider-ride/</code>.
        Values are never returned by the API — only masks. Passwords are not stored.
        {cipher ? <> Cipher: <code>{cipher}</code>.</> : null}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <label style={{ fontSize: 11, opacity: 0.7, display: "flex", flexDirection: "column", gap: 4 }}>
          Provider
          <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ ...inputStyle, minWidth: 120 }}>
            {CLOUD_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {catalog.find((c) => c.provider === p)?.label || p}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, opacity: 0.7, display: "flex", flexDirection: "column", gap: 4 }}>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Paste ${kind.replace("_", " ")} for ${provider}…`}
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
        />
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={() => void save()}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,176,66,0.35)",
            background: "rgba(255,176,66,0.12)",
            color: "#ffb042",
            cursor: busy ? "wait" : "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            opacity: busy || !value.trim() ? 0.5 : 1,
          }}
        >
          <KeyRound size={13} />
          {busy ? "Sealing…" : "Seal in vault"}
        </button>
      </div>

      {msg ? <p style={{ fontSize: 11, color: "#4ade80", margin: "10px 0 0" }}>{msg}</p> : null}
      {err ? <p style={{ fontSize: 11, color: "#f87171", margin: "10px 0 0" }}>{err}</p> : null}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45, marginBottom: 8 }}>
          Sealed slots ({items.length})
        </div>
        {loading && !items.length ? (
          <p style={{ fontSize: 12, opacity: 0.4 }}>Loading…</p>
        ) : !items.length ? (
          <p style={{ fontSize: 12, opacity: 0.4 }}>Empty vault — seal a key above.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((row) => (
              <li
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(0,0,0,0.2)",
                  fontSize: 12,
                }}
              >
                <span style={{ fontFamily: "monospace", minWidth: 120 }}>{row.id}</span>
                <span style={{ opacity: 0.55, fontFamily: "monospace" }}>{row.masked || "••••"}</span>
                <span style={{ opacity: 0.4, fontSize: 10 }}>{row.source || ""}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(row.id)}
                  title="Delete sealed slot"
                  style={{
                    marginLeft: "auto",
                    border: "none",
                    background: "transparent",
                    color: "#f87171",
                    cursor: "pointer",
                    padding: 4,
                    opacity: 0.8,
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
