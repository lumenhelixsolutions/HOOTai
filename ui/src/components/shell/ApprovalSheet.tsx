/**
 * Unified HITL approval sheet — one design for soft/hard executive actions.
 */

import { useEffect, useRef } from "react";
import { AlertTriangle, Shield, X } from "lucide-react";
import { useExecutiveControl } from "@/context/ExecutiveControlContext";
import { coachCommandLabel } from "@/lib/coach-command-policy";

export default function ApprovalSheet() {
  const { sheetAction, closeSheet, deny, approve } = useExecutiveControl();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sheetAction) return;
    const t = window.setTimeout(() => confirmRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSheet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetAction, closeSheet]);

  if (!sheetAction || sheetAction.status === "done" || sheetAction.status === "denied") return null;

  const hard = sheetAction.level === "hard";
  const running = sheetAction.status === "running";
  const failed = sheetAction.status === "failed";
  const cmd = sheetAction.command;

  return (
    <div
      className="hoot-backdrop fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hoot-approval-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !running) closeSheet();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {hard ? (
              <AlertTriangle size={18} className="text-red-400" />
            ) : (
              <Shield size={18} className="text-amber-300" />
            )}
            <div>
              <div
                id="hoot-approval-title"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-55"
              >
                {hard ? "Hard approval · HITL" : "Soft approval · HITL"}
              </div>
              <h2 className="m-0 font-serif text-xl text-foreground">{sheetAction.label}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSheet}
            disabled={running}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/5"
            aria-label="Close approval"
          >
            <X size={16} />
          </button>
        </div>

        <p className="m-0 text-sm leading-relaxed opacity-80">{sheetAction.message}</p>

        <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          <div>
            <span className="opacity-50">type</span> {String(cmd.type)}
          </div>
          {cmd.route != null && (
            <div>
              <span className="opacity-50">route</span> {String(cmd.route)}
            </div>
          )}
          {cmd.profileId != null && (
            <div>
              <span className="opacity-50">profile</span> {String(cmd.profileId)}
            </div>
          )}
          {cmd.target != null && (
            <div>
              <span className="opacity-50">target</span> {String(cmd.target)}
            </div>
          )}
          {cmd.path != null && (
            <div>
              <span className="opacity-50">path</span> {String(cmd.path)}
            </div>
          )}
          <div className="mt-1 opacity-50">source · {sheetAction.source}</div>
        </div>

        {failed && sheetAction.error && (
          <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
            {sheetAction.error}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            ref={confirmRef}
            type="button"
            disabled={running}
            onClick={() => void approve(sheetAction.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium ${
              hard
                ? "bg-red-500/90 text-white hover:bg-red-500"
                : "bg-[var(--hoot-gold)] text-[var(--hoot-ink)] hover:opacity-95"
            } disabled:opacity-50`}
          >
            {running ? "Executing…" : hard ? "Approve & execute" : "Approve"}
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => deny(sheetAction.id)}
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            disabled={running}
            onClick={closeSheet}
            className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Later
          </button>
        </div>
        <p className="mb-0 mt-3 text-[11px] opacity-45">
          Esc closes · nothing mutates until you Approve · {coachCommandLabel(cmd)}
        </p>
      </div>
    </div>
  );
}
