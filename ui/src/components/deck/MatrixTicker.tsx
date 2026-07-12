import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { type CooldownRegistry, formatTimeLabel } from "@/lib/cooldown";
import HoverTip from "@/components/HoverTip";

/** Always-visible registry line — the paste-ready provider matrix header. */
export default function MatrixTicker({ registry }: { registry: CooldownRegistry }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const session = registry.current_session_provider ? `\nSESSION: ${registry.current_session_provider}` : "";
    await navigator.clipboard.writeText(`${registry.matrix_line || ""}${session}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="hoot-card-soft flex items-center gap-3 rounded-2xl px-4 py-3">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[11px] tracking-tight opacity-75">
        {registry.matrix_line}
        {registry.current_session_provider && (
          <span className="hoot-gold-text ml-3">SESSION: {registry.current_session_provider.toUpperCase()}</span>
        )}
      </div>
      {registry.updated_at && (
        <div className="shrink-0 font-mono text-[10px] opacity-40">upd {formatTimeLabel(registry.updated_at)}</div>
      )}
      <HoverTip id="deck.matrix.copy">
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg border border-border px-2 py-1.5 opacity-70 transition hover:opacity-100"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
      </HoverTip>
    </div>
  );
}
