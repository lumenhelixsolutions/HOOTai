/**
 * Global health strip — HOOT API, Ollama, brain, scan age. Always truthful.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, Brain, RefreshCw, Server, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { isPageVisible } from "@/lib/session-poll";
import { loadMetrics, metricsSummary } from '@/lib/h00t-metrics';
import { ProviderRideScoreChip } from "@/components/deck/ProviderRidePanel";

type ChipTone = "green" | "amber" | "red" | "slate";

type HealthState = {
  hoot: { ok: boolean; detail: string };
  ollama: { ok: boolean; detail: string };
  brain: { ok: boolean; detail: string };
  scan: { ok: boolean; detail: string; stale?: boolean };
  checkedAt: number | null;
  unreachable: boolean;
};

const POLL_MS = 20000;

function toneClasses(tone: ChipTone) {
  if (tone === "green") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (tone === "amber") return "border-amber-400/35 bg-amber-400/10 text-amber-200";
  if (tone === "red") return "border-red-400/35 bg-red-400/10 text-red-300";
  return "border-border bg-foreground/[0.04] text-muted-foreground";
}

function Chip({
  label,
  detail,
  tone,
  icon,
}: {
  label: string;
  detail: string;
  tone: ChipTone;
  icon: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${toneClasses(tone)}`}
      title={`${label}: ${detail}`}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="font-medium uppercase tracking-[0.06em] opacity-70">{label}</span>
      <span className="truncate max-w-[9rem] sm:max-w-[14rem]">{detail}</span>
    </div>
  );
}

function ageLabel(iso: string | null | undefined) {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function HealthStrip() {
  const [health, setHealth] = useState<HealthState>({
    hoot: { ok: false, detail: "checking…" },
    ollama: { ok: false, detail: "…" },
    brain: { ok: false, detail: "…" },
    scan: { ok: false, detail: "…" },
    checkedAt: null,
    unreachable: false,
  });
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState(() => metricsSummary());

  const refresh = useCallback(async () => {
    if (!isPageVisible()) return;
    setBusy(true);
    try {
      const status = await api.getStatus();
      let brainOk = false;
      let brainDetail = "unknown";
      let ollamaOk = false;
      let ollamaDetail = "unknown";
      try {
        const b = await api.getCoachBrain();
        brainOk = Boolean(b.ready ?? b.doctor?.ready ?? b.brain?.available);
        const model = String(b.doctor?.model || b.brain?.model || "");
        brainDetail = brainOk
          ? model || String(b.doctor?.provider || "ready")
          : b.doctor?.ollama_reachable === false
            ? "ollama down"
            : "offline";
        ollamaOk = Boolean(b.doctor?.ollama_reachable ?? b.brain?.live_ollama?.ok);
        ollamaDetail = ollamaOk
          ? `${b.brain?.live_ollama?.count ?? "?"} models`
          : String(b.brain?.live_ollama?.error || "unreachable");
      } catch {
        brainDetail = "brain API fail";
        ollamaDetail = "unknown";
      }

      let scanOk = false;
      let scanDetail = "no cache";
      let scanStale = true;
      try {
        const scan = await api.getScanCached();
        const empty = Boolean(scan?.empty);
        const stale = Boolean(scan?._cache?.stale || scan?._cache?.source === "none");
        const ts = scan?.scanned_at || scan?._cache?.cached_at || scan?.timestamp || null;
        scanStale = empty || stale;
        scanOk = !empty && !stale;
        scanDetail = empty ? "no scan yet" : stale ? `stale · ${ageLabel(ts)}` : ageLabel(ts);
      } catch {
        scanDetail = "scan API fail";
      }

      setHealth({
        hoot: {
          ok: Boolean(status.ok),
          detail: status.display || status.version || "up",
        },
        ollama: { ok: ollamaOk, detail: ollamaDetail },
        brain: { ok: brainOk, detail: brainDetail },
        scan: { ok: scanOk, detail: scanDetail, stale: scanStale },
        checkedAt: Date.now(),
        unreachable: false,
      });
    } catch {
      setHealth({
        hoot: { ok: false, detail: "unreachable" },
        ollama: { ok: false, detail: "—" },
        brain: { ok: false, detail: "—" },
        scan: { ok: false, detail: "—" },
        checkedAt: Date.now(),
        unreachable: true,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    setMetrics(metricsSummary(loadMetrics()));
    const id = window.setInterval(() => {
      void refresh();
      setMetrics(metricsSummary(loadMetrics()));
    }, POLL_MS);
    const onVis = () => {
      if (isPageVisible()) {
        void refresh();
        setMetrics(metricsSummary(loadMetrics()));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const hootTone: ChipTone = health.hoot.ok ? "green" : "red";
  const ollamaTone: ChipTone = health.ollama.ok ? "green" : "amber";
  const brainTone: ChipTone = health.brain.ok ? "green" : health.unreachable ? "red" : "amber";
  const scanTone: ChipTone = health.scan.ok ? "green" : health.scan.stale ? "amber" : "slate";

  return (
    <div
      className={`flex w-full flex-wrap items-center gap-2 border-b px-4 py-2 md:px-7 ${
        health.unreachable
          ? "border-red-400/30 bg-red-400/[0.07]"
          : "border-border bg-card/40"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Command center health"
    >
      <Chip label="HOOT" detail={health.hoot.detail} tone={hootTone} icon={<Server size={12} />} />
      <Chip label="Ollama" detail={health.ollama.detail} tone={ollamaTone} icon={<Activity size={12} />} />
      <Chip label="Brain" detail={health.brain.detail} tone={brainTone} icon={<Brain size={12} />} />
      <Chip label="Scan" detail={health.scan.detail} tone={scanTone} icon={<Activity size={12} />} />
      <ProviderRideScoreChip />

      {health.unreachable && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-red-300">
          <AlertTriangle size={12} />
          <span>
            <strong>Resilience:</strong> HOOT not answering — run{" "}
            <code className="rounded bg-black/30 px-1">pwsh D:\projects\scripts\start-hoot.ps1</code>
            {" · "}then hard-refresh this tab
          </span>
        </div>
      )}
      {!health.unreachable && !health.ollama.ok && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-200">
          <AlertTriangle size={12} />
          <span>Ollama offline — local brain will fall back to rules until <code className="rounded bg-black/20 px-1">ollama serve</code></span>
        </div>
      )}
      {!health.unreachable && health.scan.stale && health.hoot.ok && (
        <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
          <span>Scan stale — use Home spine or Readiness to propose a fresh scan (HITL)</span>
        </div>
      )}

      <Chip
        label="HITL"
        detail={
          metrics.approveRate != null
            ? `${metrics.hitlApproved} ok · ${metrics.approveRate}%`
            : `${metrics.hitlProposed} proposed`
        }
        tone={metrics.hitlApproved > 0 ? "green" : metrics.hitlProposed > 0 ? "amber" : "slate"}
        icon={<TrendingUp size={12} />}
      />

      <button
        type="button"
        onClick={() => void refresh()}
        disabled={busy}
        className="ml-auto flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        aria-label="Refresh health"
      >
        <RefreshCw size={12} className={busy ? 'animate-spin' : undefined} />
        Refresh
      </button>
    </div>
  );
}
