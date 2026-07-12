import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Cpu, Play, RefreshCw, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useCoach } from "@/context/CoachContext";
import type { BenchResultsPayload, BenchRow } from "@/lib/bench-types";
import { useSessionPoll } from "@/hooks/useSessionPoll";
import { asScanArray, normalizeLoadedModels } from "@/lib/scan-normalize";

const DEFAULT_PRESETS = ["phi3:mini", "qwen2.5:1.5b", "smollm2:360m"];

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

function tierLabel(row: BenchRow) {
  if (row.status !== "pass") return "—";
  if (row.tokens_per_sec >= 20) return "fast";
  if (row.tokens_per_sec >= 8) return "ok";
  return "slow";
}

function parseModelsInput(raw: string) {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function BenchPage() {
  const [data, setData] = useState<BenchResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [modelInput, setModelInput] = useState(DEFAULT_PRESETS.join(", "));
  const [scanPresets, setScanPresets] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [llamaRunning, setLlamaRunning] = useState(false);
  const [scanVitals, setScanVitals] = useState<{ ollama?: boolean; llamacpp?: boolean; gpu?: string } | null>(null);
  const { setPageContext } = useCoach();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const results = await api.getBenchResults();
      setData(results);
      setPageContext({
        benchModelCount: results.rows.length,
        benchPassCount: results.rows.filter((r) => r.status === "pass").length,
        benchUpdatedAt: results.updated_at,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setPageContext]);

  useSessionPoll(load, { immediate: true });

  useEffect(() => {
    api.getScanCached().then((scan) => {
      const s = scan as {
        ollama?: { loaded_models?: Array<{ name?: string }> };
        local_models?: { backends?: Array<{ id?: string; server?: { reachable?: boolean } }> };
        gpu?: { name?: string };
      };
      const loaded = normalizeLoadedModels(s)
        .map((m) => m.name)
        .filter((n): n is string => Boolean(n));
      if (loaded.length) setScanPresets(loaded);
      const llama = asScanArray(s?.local_models?.backends).find((b) => b.id === "llamacpp");
      setScanVitals({
        ollama: loaded.length > 0,
        llamacpp: Boolean(llama?.server?.reachable),
        gpu: s?.gpu?.name,
      });
    }).catch(() => {});
  }, []);

  const runLlamaBench = async () => {
    setLlamaRunning(true);
    setRunError(null);
    try {
      const result = await api.runLlamaCppBench();
      setData(result);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setLlamaRunning(false);
    }
  };

  const presets = useMemo(() => {
    const merged = [...new Set([...scanPresets, ...DEFAULT_PRESETS])];
    return merged;
  }, [scanPresets]);

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
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div style={{ opacity: 0.5, fontSize: 13 }}>Loading bench results…</div>;
  if (!data) return <div style={{ opacity: 0.5, fontSize: 13 }}>Failed to load bench results.</div>;

  const rows = data.rows;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1100 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontSize: 28, margin: 0, fontWeight: 400, color: "#f5e6d0" }}>
            Local Inference Vitals
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.55, maxWidth: 560, lineHeight: 1.5 }}>
            Ollama smoke + llama-bench GGUF probes feed profile scoring — tiers fast ≥20 · ok ≥8 tok/s adjust local stack readiness.
          </p>
          {data.updated_at && (
            <p style={{ margin: "6px 0 0", fontSize: 11, opacity: 0.4 }}>
              CSV updated {new Date(data.updated_at).toLocaleString()}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={load} disabled={refreshing || running} style={btnStyle(false)}>
            <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <Section title="Inference vitals" caption="Snapshot from last environment scan — re-scan from Dashboard if stale.">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <VitalChip label="Ollama models" ok={scanVitals?.ollama} detail={scanVitals?.ollama ? "loaded" : "none loaded"} />
          <VitalChip label="llama.cpp server" ok={scanVitals?.llamacpp} detail={scanVitals?.llamacpp ? "reachable" : "offline"} />
          <VitalChip label="GPU" ok={Boolean(scanVitals?.gpu)} detail={scanVitals?.gpu || "not detected"} />
          <VitalChip
            label="CSV schema"
            ok={data.validation?.ok}
            detail={data.validation?.ok ? `${data.validation.row_count} rows valid` : (data.validation?.errors?.[0] || "not validated")}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={runLlamaBench} disabled={llamaRunning || running} style={btnStyle(true)}>
            <Zap size={14} />
            {llamaRunning ? "Running llama-bench…" : "Run llama-bench (GGUF)"}
          </button>
        </div>
      </Section>

      <Section
        title="Run Ollama benchmark"
        caption="Comma- or newline-separated Ollama model tags. Empty list uses script defaults (phi3:mini, qwen2.5:1.5b, smollm2:360m)."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <textarea
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            rows={3}
            placeholder="phi3:mini, qwen2.5:1.5b"
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
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setModelInput(preset);
                  runBench([preset]);
                }}
                disabled={running}
                style={chipStyle(scanPresets.includes(preset))}
              >
                <Cpu size={12} />
                {preset}
                {scanPresets.includes(preset) ? " · loaded" : ""}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setModelInput(presets.join(", "));
                runBench(presets);
              }}
              disabled={running}
              style={chipStyle(false)}
            >
              All presets
            </button>
          </div>
          {runError && (
            <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#fca5a5", fontSize: 12 }}>
              {runError}
            </div>
          )}
        </div>
      </Section>

      <Section title="Bench results" caption={rows.length ? `${rows.length} models · scoring tiers: fast ≥20 tok/s · ok ≥8 · slow pass` : "No CSV yet — run a bench to populate state/bench-results.csv"}>
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
                  <tr key={row.model}>
                    <td style={tdLeft}>
                      <code style={{ fontSize: 12 }}>{row.model}</code>
                    </td>
                    <td style={tdLeft}>{row.backend || "ollama"}</td>
                    <td style={tdLeft}>
                      <span style={{ color: statusColor(row.status), fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={tdRight}>{row.latency_ms} ms</td>
                    <td style={tdRight}>{row.tokens_per_sec.toFixed(1)}</td>
                    <td style={tdRight}>{tierLabel(row)}</td>
                    <td style={{ ...tdLeft, opacity: 0.6, fontSize: 11, maxWidth: 280 }}>{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        <Activity size={14} color="#ffb042" />
        Vitals bench deltas apply to Ollama and llama.cpp profiles — re-run after pulling models or changing GGUF path in Settings.
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

function chipStyle(fromScan: boolean) {
  return {
    padding: "7px 11px",
    borderRadius: 8,
    border: fromScan ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.1)",
    background: fromScan ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.03)",
    color: fromScan ? "#6ee7b7" : "#aaa",
    cursor: "pointer",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    gap: 6,
  } as const;
}

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
};