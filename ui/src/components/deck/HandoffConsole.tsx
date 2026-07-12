import { useEffect, useState } from "react";
import { Check, Copy, FileDown, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { Panel } from "@/components/dashboard/primitives";
import { TipIcon } from "@/components/HoverTip";
import { getTooltip } from "@/lib/tooltips";

/** Save-state generator — produces the strict auto_handoff.md block (manifest §4). */
export default function HandoffConsole() {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [snapshotPath, setSnapshotPath] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [autoArmed, setAutoArmed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getHandoffLatest().then((latest) => {
      if (latest && !latest.empty && latest.markdown) {
        setMarkdown(latest.markdown);
        setSnapshotPath((latest as { snapshot_path?: string | null }).snapshot_path || null);
        setGeneratedAt((latest as { copied_at?: string }).copied_at || null);
      }
    }).catch(() => {});
    api.getSettings().then((s) => {
      setAutoArmed(Boolean(s?.settings?.hybrid_workspace?.auto_handoff_on_cooldown ?? s?.hybrid_workspace?.auto_handoff_on_cooldown));
    }).catch(() => setAutoArmed(null));
  }, []);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const packet = await api.generateHandoff({ write_snapshot: true });
      setMarkdown(packet.markdown);
      setSnapshotPath(packet.snapshot_path || null);
      setGeneratedAt(packet.copied_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Handoff generation failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Panel title="Save-state console" subtitle="auto_handoff.md · paste-ready project state dump" icon={FileDown} action={<TipIcon id="deck.handoff.generate" />}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={generate}
          className="hoot-gold-chip flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition hover:brightness-110 disabled:opacity-50"
        >
          <Zap size={14} />
          {busy ? "Generating…" : "Generate save-state"}
        </button>
        {markdown && (
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs opacity-70 transition hover:opacity-100"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
        {autoArmed !== null && (
          <span
            className={`ml-auto rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] ${
              autoArmed
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-400"
                : "border-border bg-foreground/5 text-muted-foreground"
            }`}
            title={getTooltip("deck.handoff.auto").body}
          >
            auto on cooldown: {autoArmed ? "armed" : "off"}
          </span>
        )}
      </div>

      {error && <div className="mb-2 text-xs text-red-400">{error}</div>}

      {markdown ? (
        <>
          <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-emerald-200/90">
            {markdown}
          </pre>
          <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] opacity-45">
            {generatedAt && <span>generated {new Date(generatedAt).toLocaleTimeString()}</span>}
            {snapshotPath && <span title={`${getTooltip("deck.handoff.written").body} · ${snapshotPath}`}>written to disk ✓</span>}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm opacity-55">
          No save-state yet. Generate one before switching providers — the next AI ingests it instead of you re-explaining the project.
        </div>
      )}
    </Panel>
  );
}
