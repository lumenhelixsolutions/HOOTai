import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Cpu, FolderKanban, LayoutGrid, Radar, Sparkles, Timer, X } from "lucide-react";
import { api } from "@/lib/api";

type OnboardingPayload = Awaited<ReturnType<typeof api.getOnboarding>>;

const STEP_ICONS: Record<string, typeof Radar> = {
  scan: Radar,
  local_brain: Cpu,
  project: FolderKanban,
  layout: LayoutGrid,
  providers: Timer,
  ready: Sparkles,
};

export default function OnboardingWizard({
  open,
  onClose,
  onComplete,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
  initial?: OnboardingPayload | null;
}) {
  const [data, setData] = useState<OnboardingPayload | null>(initial || null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [sessionProvider, setSessionProvider] = useState("");
  const [cooldowns, setCooldowns] = useState<Record<string, boolean>>({});

  const refresh = useCallback(() => api.getOnboarding().then(setData).catch(() => {}), []);

  useEffect(() => {
    if (!open) return;
    if (initial) setData(initial);
    else refresh();
  }, [open, initial, refresh]);

  useEffect(() => {
    if (!data) return;
    setSelectedProject(data.projects.active || data.projects.items?.[0]?.path || "");
    setSessionProvider(data.providers?.suggested_session_provider || "ollama");
    const draft: Record<string, boolean> = {};
    for (const [id, row] of Object.entries(data.providers?.registry?.providers || {})) {
      draft[id] = row.effective_status === "cooldown";
    }
    setCooldowns(draft);
  }, [data?.projects.active, data?.providers?.suggested_session_provider]);

  const step = data?.current_step || "scan";
  const steps = data?.steps || [];
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === step));

  const layoutRoots = useMemo(() => {
    const inferred = data?.layout?.inferred?.roots || [];
    const current = data?.layout?.current?.roots || [];
    return current.length ? current : inferred;
  }, [data]);

  if (!open) return null;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message || "Request failed");
    } finally {
      setBusy(null);
    }
  };

  const next = async () => {
    if (step === "scan") {
      await run("scan", async () => {
        const r = await api.postOnboarding({ action: "run_scan" });
        setData(r.onboarding);
      });
      return;
    }
    if (step === "local_brain") {
      await run("local_brain", async () => {
        const lb = (data as any)?.local_brain;
        const model = lb?.model || lb?.suggestions?.find((s: any) => s.recommended)?.tag || lb?.installed?.[0];
        if (model && lb?.ollama_present) {
          const r = await api.postOnboarding({ action: "set_local_brain", model });
          setData(r.onboarding);
        } else {
          const r = await api.postOnboarding({ action: "skip_local_brain" });
          setData(r.onboarding);
        }
      });
      return;
    }
    if (step === "project" && selectedProject) {
      await run("project", async () => {
        const r = await api.postOnboarding({ action: "set_project", path: selectedProject });
        setData(r.onboarding);
      });
      return;
    }
    if (step === "layout") {
      await run("layout", async () => {
        const r = await api.postOnboarding({ action: "infer_layout", path: selectedProject || undefined, force: true });
        setData(r.onboarding);
      });
      return;
    }
    if (step === "providers") {
      await run("providers", async () => {
        const r = await api.postOnboarding({
          action: "apply_providers",
          current_session_provider: sessionProvider,
          cooldowns: Object.entries(cooldowns)
            .filter(([, on]) => on)
            .map(([provider]) => ({ provider, preset: "3hr" as const })),
        });
        setData(r.onboarding);
      });
      return;
    }
    if (step === "ready") {
      await run("complete", async () => {
        const r = await api.postOnboarding({
          action: "complete",
          inbound_handoff: handoff.trim() || undefined,
        });
        setData(r.onboarding);
        onComplete?.();
        onClose();
      });
    }
  };

  const discover = () =>
    run("discover", async () => {
      const r = await api.postOnboarding({ action: "discover_projects" });
      setData(r.onboarding);
    });

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="hoot-card-soft max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] opacity-45">HOOT onboarding</div>
            <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.04em]">Set up from your machine</h2>
            <p className="mb-0 mt-2 text-sm opacity-65">
              Scan discovers agents and keys; project registry reveals repos; workspace layout is inferred from each project's folders — no fixed directory template.
            </p>
          </div>
          <button type="button" onClick={() => run("dismiss", () => api.postOnboarding({ action: "dismiss" }).then(() => onClose()))} className="rounded-lg border border-border p-2 opacity-60 hover:opacity-100" title="Dismiss the workspace setup wizard — reopen anytime via Ctrl+K → Workspace setup wizard">
            <X size={16} />
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {steps.map((s, i) => {
            const Icon = STEP_ICONS[s.id] || Sparkles;
            const done = data?.checks?.[s.id as keyof typeof data.checks];
            const active = s.id === step;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                  active ? "hoot-gold-chip font-semibold" : done ? "border-emerald-400/30 text-emerald-400" : "border-border opacity-55"
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                {s.title}
                {i < steps.length - 1 && <ChevronRight size={12} className="opacity-40" />}
              </div>
            );
          })}
        </div>

        {step === "scan" && (
          <div className="grid gap-3 text-sm">
            <p>HOOT scans your toolchain (Ollama, Claude Code, Codex, Gemini CLI, RTK, etc.) and reads portfolio roots:</p>
            <div className="rounded-xl border border-border bg-foreground/[0.03] p-3 font-mono text-xs">
              {(data?.portfolio_roots || []).join(" · ") || "D:/projects"}
            </div>
            {data?.scan_summary ? (
              <div className="text-xs opacity-70">
                Detected {data.scan_summary.agents_detected} agent(s)
                {data.scan_summary.ollama ? " · Ollama ready" : ""}
                {data.scan_summary.rtk ? " · RTK installed" : ""}
              </div>
            ) : (
              <div className="text-xs opacity-55">No scan yet — run one to continue.</div>
            )}
          </div>
        )}

        {step === "local_brain" && (
          <div className="grid gap-3 text-sm">
            <p className="opacity-70">
              The HOOT mascot uses a <strong className="text-foreground">local Ollama</strong> brain when available.
              Preferred on this studio: <code className="text-xs">gemma4:latest</code>.
            </p>
            {(data as any)?.local_brain?.ready ? (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-sm text-emerald-300">
                Ready — will use <code className="text-xs">{(data as any).local_brain.model}</code>
                {(data as any).local_brain.source ? ` (${(data as any).local_brain.source})` : ""}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-200">
                No suitable local model active yet. Pull a recommended tag or skip (rules-only coach).
              </div>
            )}
            {((data as any)?.local_brain?.installed || []).length > 0 && (
              <div className="text-xs opacity-70">
                Installed: {((data as any).local_brain.installed as string[]).join(", ")}
              </div>
            )}
            <div className="grid gap-2">
              {((data as any)?.local_brain?.suggestions || []).map((s: any) => (
                <div key={s.tag} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <div>
                    <div className="font-medium">{s.tag}{s.recommended ? " · recommended" : ""}{s.installed ? " · installed" : ""}</div>
                    <div className="text-[11px] opacity-50">{s.reason}</div>
                  </div>
                  <div className="flex gap-2">
                    {s.installed ? (
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-xs"
                        onClick={() => run("use-model", async () => {
                          const r = await api.postOnboarding({ action: "set_local_brain", model: s.tag });
                          setData(r.onboarding);
                        })}
                      >
                        Use
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-xs"
                        onClick={() => run("pull-model", async () => {
                          await api.postOnboarding({ action: "pull_local_model", model: s.tag });
                          const r = await api.postOnboarding({ action: "set_local_brain", model: s.tag });
                          setData(r.onboarding);
                        })}
                      >
                        Pull + use
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="self-start text-xs opacity-55 underline"
              onClick={() => run("skip-brain", async () => {
                const r = await api.postOnboarding({ action: "skip_local_brain" });
                setData(r.onboarding);
              })}
            >
              Skip local brain for now
            </button>
          </div>
        )}

        {step === "project" && (
          <div className="grid gap-3">
            <p className="text-sm opacity-70">Choose the repo HOOT should anchor. Projects are discovered from your portfolio scan roots.</p>
            <button type="button" onClick={discover} disabled={Boolean(busy)} className="self-start rounded-lg border border-border px-3 py-1.5 text-xs opacity-80">
              Refresh discovery
            </button>
            <div className="max-h-56 overflow-auto rounded-xl border border-border">
              {(data?.projects.items || []).map((p: any) => (
                <label key={p.path} className="flex cursor-pointer items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-foreground/[0.03]">
                  <div>
                    <div className="font-medium text-foreground">{p.name}</div>
                    <div className="font-mono text-[11px] opacity-50">{p.path}</div>
                  </div>
                  <input type="radio" name="project" checked={selectedProject === p.path} onChange={() => setSelectedProject(p.path)} />
                </label>
              ))}
              {(data?.projects.items || []).length === 0 && <div className="p-4 text-sm opacity-55">No projects found — check portfolio roots or add repos under D:/projects.</div>}
            </div>
          </div>
        )}

        {step === "layout" && (
          <div className="grid gap-3 text-sm">
            <p className="opacity-70">Inferred from <span className="font-mono text-xs">{data?.layout?.inferred?.inferred_from || selectedProject}</span>:</p>
            <ul className="m-0 grid gap-2 p-0">
              {layoutRoots.map((r: any) => (
                <li key={r.id} className="list-none rounded-xl border border-border px-3 py-2.5">
                  <div className="font-medium">{r.label} <span className="opacity-45">({r.id})</span></div>
                  <div className="font-mono text-[11px] opacity-55">{r.path}</div>
                  {r.exists === false && <div className="text-[11px] text-amber-500">Path not found — re-detect after scan</div>}
                </li>
              ))}
            </ul>
            {(data?.layout?.inferred?.hints || []).map((h: string) => (
              <div key={h} className="text-xs opacity-50">• {h}</div>
            ))}
          </div>
        )}

        {step === "providers" && (
          <div className="grid gap-3 text-sm">
            <p className="opacity-70">Mark providers on cooldown; HOOT exports <code className="text-xs">state/ai_status.json</code> automatically.</p>
            <label className="grid gap-1">
              <span className="text-xs opacity-55">Session provider (suggested from scan)</span>
              <select value={sessionProvider} onChange={(e) => setSessionProvider(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2">
                {["claude", "chatgpt", "gemini", "kimi", "ollama", "llamacpp"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(cooldowns).map((id) => (
                <label key={id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">
                  <input type="checkbox" checked={cooldowns[id]} onChange={(e) => setCooldowns((prev) => ({ ...prev, [id]: e.target.checked }))} />
                  {id}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === "ready" && (
          <div className="grid gap-3 text-sm">
            <p className="opacity-70">Optional: paste a handoff from another provider. HOOT writes project-brain draft — you're ready for the command center.</p>
            <textarea
              value={handoff}
              onChange={(e) => setHandoff(e.target.value)}
              rows={6}
              placeholder="### [PROJECT STATE DUMP - DO NOT TRANSLATE]…"
              className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"
            />
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-400">{error}</div>}

        <div className="mt-6 flex justify-between gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm opacity-70">
            Later
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={next} className="hoot-gold-chip rounded-xl px-4 py-2 text-sm font-semibold">
            {busy ? "Working…" : step === "ready" ? "Enter HOOT" : step === "scan" && !data?.checks?.scan ? "Run scan" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}