/**
 * ProviderRide doctor panel — multi-backend status + fixes + booth/cred CTAs.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink, KeyRound, Radar, RefreshCw } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { useProviderRide } from "@/hooks/useProviderRide";
import { api } from "@/lib/api";
import { channelTone, scoreTone, type ProviderRideChannel } from "@/lib/provider-ride";
import { PROVIDER_ORDER } from "@/lib/cooldown";

function toneClass(t: "green" | "amber" | "red" | "slate") {
  if (t === "green") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (t === "amber") return "border-amber-400/35 bg-amber-400/10 text-amber-100";
  if (t === "red") return "border-red-400/35 bg-red-400/10 text-red-200";
  return "border-border bg-foreground/[0.04] text-muted-foreground";
}

function ChannelCard({
  id,
  ch,
  onOpenBooth,
  busy,
}: {
  id: string;
  ch: ProviderRideChannel;
  onOpenBooth: (id: string) => void;
  busy: string | null;
}) {
  const tone = channelTone(ch.status);
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold tracking-wide">{ch.label || id}</div>
          <div className="mt-0.5 font-mono text-[10px] opacity-75">
            {String(ch.status).toUpperCase()}
            {ch.active_backend ? ` @ ${ch.active_backend}` : ""}
            {ch.eta ? ` · ${ch.eta}` : ""}
            {ch.session ? " · SESSION" : ""}
          </div>
        </div>
        {ch.booth?.length ? (
          <button
            type="button"
            disabled={busy === id}
            onClick={() => onOpenBooth(id)}
            className="shrink-0 rounded-lg border border-border/60 bg-background/30 p-1.5 opacity-80 transition hover:opacity-100 disabled:opacity-40"
            title="Open Account Booth (allowlisted)"
          >
            <ExternalLink size={12} />
          </button>
        ) : null}
      </div>
      {ch.fixes?.[0] ? (
        <p className="mt-1.5 text-[10px] leading-snug opacity-80 line-clamp-2">{ch.fixes[0]}</p>
      ) : null}
    </div>
  );
}

export default function ProviderRidePanel() {
  const { report, loading, failed, errorDetail, refreshing, reload } = useProviderRide();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const openBooth = async (provider: string) => {
    setBusy(provider);
    setNote(null);
    try {
      const r = await api.openProviderRideBooth(provider, "account", false);
      if (!r.ok) setNote(r.error || "Booth open failed");
      else setNote(`Opened ${r.url || provider}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Booth open failed");
    } finally {
      setBusy(null);
    }
  };

  const score = report?.score || "—";
  const st = scoreTone(report?.score);
  const order = PROVIDER_ORDER.filter((id) => report?.channels?.[id]);

  return (
    <Panel
      title="ProviderRide"
      subtitle={
        report?.available === false
          ? report.error || "Package unavailable"
          : "Multi-backend doctor · cooldown truth · account booth"
      }
      icon={Radar}
      action={
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg border border-border p-1.5 opacity-70 transition hover:opacity-100"
          title="Refresh ProviderRide doctor"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        </button>
      }
    >
      {loading && !report ? (
        <div className="text-[12px] opacity-50">Loading ProviderRide…</div>
      ) : failed && !report ? (
        <div className="flex flex-col gap-1.5 text-[12px] text-amber-200">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle size={14} />
            <span>{errorDetail || "Doctor unreachable — is h00t server running?"}</span>
            <button type="button" className="underline opacity-80" onClick={() => void reload()}>
              Retry
            </button>
          </div>
          {errorDetail && /restart|stale/i.test(errorDetail) ? (
            <code className="rounded bg-black/30 px-2 py-1 text-[10px] text-amber-100/80">
              pwsh D:\projects\scripts\start-hoot.ps1
            </code>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${toneClass(st)}`}>
              score {score}
            </span>
            {report?.session_provider ? (
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] opacity-80">
                session · {report.session_provider}
              </span>
            ) : null}
            {report?.credentials?.entry_count != null ? (
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] opacity-70">
                {report.credentials.entry_count} sealed creds
              </span>
            ) : null}
            <Link
              to="/settings"
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] no-underline opacity-80 transition hover:opacity-100"
            >
              <KeyRound size={12} />
              Credentials
            </Link>
          </div>

          {report?.matrix_line ? (
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 font-mono text-[10px] opacity-70">
              {report.matrix_line}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {order.map((id) => {
              const ch = report?.channels?.[id];
              if (!ch) return null;
              return (
                <ChannelCard key={id} id={id} ch={ch} onOpenBooth={(p) => void openBooth(p)} busy={busy} />
              );
            })}
          </div>

          {report?.fixes?.length ? (
            <div className="rounded-xl border border-border/70 bg-foreground/[0.03] px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-50">Top fixes</div>
              <ol className="m-0 list-decimal space-y-1 pl-4 text-[11px] leading-snug opacity-85">
                {report.fixes.slice(0, 5).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {note ? <p className="m-0 text-[11px] opacity-60">{note}</p> : null}
        </div>
      )}
    </Panel>
  );
}

/** Compact chip for CooldownStrip / HealthStrip */
export function ProviderRideScoreChip() {
  const { report } = useProviderRide(45000);
  if (!report?.score) return null;
  const st = scoreTone(report.score);
  return (
    <Link
      to="/deck"
      className={`hidden items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-mono no-underline sm:flex ${toneClass(st)}`}
      title={report.matrix_line || "ProviderRide doctor"}
    >
      <Radar size={11} />
      <span className="opacity-70">Ride</span>
      <span>{report.score}</span>
    </Link>
  );
}
