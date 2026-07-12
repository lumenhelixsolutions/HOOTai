import { X } from "lucide-react";

const SHORTCUTS: Array<{ keys: string[]; action: string }> = [
  { keys: ["Ctrl", "K"], action: "Open the command palette" },
  { keys: ["?"], action: "Show this shortcut overlay" },
  { keys: ["Ctrl", "B"], action: "Toggle the sidebar dock" },
  { keys: ["Ctrl", "/"], action: "Show / hide this overlay" },
  { keys: ["Ctrl", "."], action: "Toggle dark / light theme" },
  { keys: ["↑", "↓"], action: "Move through palette results" },
  { keys: ["Enter"], action: "Run the highlighted command" },
  { keys: ["Esc"], action: "Close palette or this overlay" },
  { keys: ["Docs"], action: "Sidebar → Documentation, or Ctrl+K → Documentation" },
];

/** `?` overlay listing every implemented keyboard shortcut. */
export default function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="hoot-backdrop fixed inset-0 z-[90] flex items-center justify-center px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="w-full max-w-md border border-border bg-popover text-popover-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">HOOT</div>
            <div className="font-serif text-lg">Keyboard shortcuts</div>
          </div>
          <button onClick={onClose} aria-label="Close shortcuts" className="p-1 opacity-60 hover:opacity-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
              <span className="text-sm text-muted-foreground">{s.action}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="border border-border bg-secondary px-2 py-0.5 text-[11px]">
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
          <p className="pt-3 text-xs text-muted-foreground">
            On macOS, Ctrl shortcuts also accept ⌘.
          </p>
        </div>
      </div>
    </div>
  );
}
