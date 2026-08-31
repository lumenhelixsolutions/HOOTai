/**
 * Global pending executive-actions dock — survives navigation.
 */

import { Check, ListTodo, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useExecutiveControl } from "@/context/ExecutiveControlContext";

export default function PendingActionsDock() {
  const { queue, pendingCount, openApproval, deny, clearFinished } = useExecutiveControl();
  const [open, setOpen] = useState(false);

  const live = queue.filter((a) => a.status === "pending" || a.status === "running" || a.status === "failed");
  if (pendingCount === 0 && live.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-4 z-[70] flex max-w-[min(100vw-2rem,22rem)] flex-col items-start gap-2 md:left-[calc(var(--hoot-sidebar,280px)+1rem)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hoot-gold-chip flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium shadow-lg"
        aria-expanded={open}
        aria-controls="hoot-pending-dock"
      >
        <ListTodo size={14} />
        {pendingCount} pending action{pendingCount === 1 ? "" : "s"}
      </button>

      {open && (
        <div
          id="hoot-pending-dock"
          className="w-full rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl"
          role="region"
          aria-label="Pending executive actions"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
              Executive queue · HITL
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={clearFinished}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                title="Clear finished"
                aria-label="Clear finished actions"
              >
                <Trash2 size={12} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Collapse queue"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {live.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-border bg-background/50 px-2.5 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{a.label}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-45">
                      {a.level} · {a.status}
                      {a.error ? ` · ${a.error}` : ""}
                    </div>
                  </div>
                  {a.status === "pending" && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openApproval(a.id)}
                        className="rounded-lg bg-[var(--hoot-gold)]/15 px-2 py-1 text-[10px] font-semibold text-[var(--hoot-gold)]"
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => deny(a.id)}
                        className="rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:text-red-300"
                        aria-label={`Deny ${a.label}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {a.status === "done" && <Check size={14} className="text-emerald-400" />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
