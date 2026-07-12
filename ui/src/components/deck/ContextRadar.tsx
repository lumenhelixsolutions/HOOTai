import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderTree, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Panel, WidgetError } from "@/components/dashboard/primitives";
import HoverTip, { TipIcon } from "@/components/HoverTip";
import { getTooltip } from "@/lib/tooltips";

type RadarFile = {
  path: string;
  ext: string;
  mtime_iso: string;
  age_minutes: number;
  size_bytes: number;
  est_tokens: number;
};

type RadarRoot = {
  id: string;
  label: string;
  role: string | null;
  path: string;
  exists: boolean;
  active: boolean;
  truncated: boolean;
  total_files: number;
  total_est_tokens: number;
  files: RadarFile[];
};

type RadarData = {
  generated_at: string;
  window_hours: number;
  roots: RadarRoot[];
  totals: { files: number; est_tokens: number };
};

const WINDOWS = [1, 2, 6, 24];
const MAX_ROWS = 10;

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Workspace interceptor view — what changed recently and what it costs to feed an AI. */
export default function ContextRadar() {
  const [data, setData] = useState<RadarData | null>(null);
  const [hours, setHours] = useState(2);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (h: number) => {
    setLoading(true);
    setFailed(false);
    try {
      setData(await api.getWorkspaceContext(h));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(hours);
    const poll = setInterval(() => load(hours), 60000);
    return () => clearInterval(poll);
  }, [load, hours]);

  return (
    <Panel title="Context radar" subtitle={`Workspace interceptor · files touched in last ${hours}h`} icon={FolderTree} action={<TipIcon id="deck.context.window" />}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setHours(w)}
              title={`${getTooltip("deck.context.window").body} · ${w} hour window`}
              className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
                hours === w
                  ? "hoot-gold-chip font-semibold"
                  : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              {w}h
            </button>
          ))}
          <HoverTip id="deck.context.rescan">
            <button type="button" onClick={() => load(hours)} className="ml-1 rounded-lg border border-border px-2 py-1 opacity-60 hover:opacity-100">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </HoverTip>
        </div>
        {data && (
          <div className="font-mono text-[11px] opacity-55">
            {data.totals.files} files · ~{fmtTokens(data.totals.est_tokens)} tokens
          </div>
        )}
      </div>

      {failed && <WidgetError title="Context radar" onRetry={() => load(hours)} />}

      {!failed && data && data.roots.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm opacity-60">
          No workspace roots configured.{" "}
          <Link to="/settings" className="hoot-gold-text no-underline">Set them in Settings → Hybrid Workspace</Link>{" "}
          or pick an active project.
        </div>
      )}

      {!failed && data && data.roots.length > 0 && (
        <div className={`grid gap-3 ${data.roots.length >= 3 ? "lg:grid-cols-3" : data.roots.length === 2 ? "lg:grid-cols-2" : ""}`}>
          {data.roots.map((root) => {
            const maxTokens = Math.max(1, ...root.files.map((f) => f.est_tokens));
            return (
              <div key={root.id} className={`rounded-xl border p-3 ${root.active ? "border-amber-400/30 bg-amber-400/[0.04]" : "border-border bg-foreground/[0.02]"}`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                    {root.label}
                    {root.active && <span className="hoot-gold-chip rounded-full px-1.5 py-0.5 text-[9px] uppercase">active</span>}
                  </div>
                  <div className="font-mono text-[10px] opacity-50">
                    {root.total_files ? `~${fmtTokens(root.total_est_tokens)} tok` : ""}
                  </div>
                </div>
                <div className="mb-2 truncate font-mono text-[10px] opacity-40" title={root.path}>{root.path}</div>

                {!root.exists && <div className="text-[11px] text-amber-400">Path not found on disk.</div>}
                {root.exists && root.files.length === 0 && (
                  <div className="text-[11px] opacity-45">No source files modified in window.</div>
                )}

                <div className="grid gap-1">
                  {root.files.slice(0, MAX_ROWS).map((f) => (
                    <div key={f.path} className="grid grid-cols-[1fr_auto] items-center gap-2" title={`${getTooltip("deck.context.file").body} · ${f.path} · ${f.size_bytes} bytes · ~${f.est_tokens} tokens`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-mono text-[11px] text-foreground/85">{f.path}</span>
                          <span className="shrink-0 rounded border border-border px-1 text-[9px] uppercase opacity-50">{f.ext}</span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                          <div
                            className="h-full rounded-full bg-amber-400/60"
                            style={{ width: `${Math.max(4, (f.est_tokens / maxTokens) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-mono text-[10px] leading-tight opacity-55">
                        <div>{fmtTokens(f.est_tokens)} tok</div>
                        <div className="opacity-70">{fmtAge(f.age_minutes)} ago</div>
                      </div>
                    </div>
                  ))}
                </div>
                {root.files.length > MAX_ROWS && (
                  <div className="mt-1.5 text-[10px] opacity-45">+{root.files.length - MAX_ROWS} more in window</div>
                )}
                {root.truncated && <div className="mt-1 text-[10px] text-amber-400/80">scan truncated at file cap</div>}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
