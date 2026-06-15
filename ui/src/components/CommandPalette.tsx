import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  BookText,
  CalendarDays,
  Cpu,
  Flame,
  Gauge,
  Layers3,
  Moon,
  PanelLeftClose,
  PlayCircle,
  Radar,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Compass,
  Workflow,
  Wrench,
} from "lucide-react";
import { toggleTheme } from "@/lib/theme";
import { api } from "@/lib/api";
import { useCoach } from "@/context/CoachContext";
import { getTooltip } from "@/lib/tooltips";

export interface PaletteCommand {
  id: string;
  label: string;
  hint: string;
  group: "Navigate" | "Actions";
  keywords: string;
  icon: typeof Radar;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onToggleSidebar: () => void;
}

/**
 * Ctrl/Cmd+K command palette: jump to any route or run an app action.
 * Keyboard: arrows to move, Enter to run, Esc to close.
 */
export default function CommandPalette({ open, onClose, onToggleSidebar }: Props) {
  const navigate = useNavigate();
  const { emitCoachAction } = useCoach();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      { id: "nav-overview", label: "Overview", hint: getTooltip("nav.overview").body, group: "Navigate", keywords: "dashboard home mission", icon: Radar, run: () => navigate("/") },
      { id: "nav-scan", label: "Readiness", hint: getTooltip("nav.readiness").body, group: "Navigate", keywords: "scan tools health posture", icon: ShieldCheck, run: () => navigate("/scan") },
      { id: "nav-profiles", label: "Profiles", hint: getTooltip("nav.profiles").body, group: "Navigate", keywords: "stacks roles audit", icon: Layers3, run: () => navigate("/profiles") },
      { id: "nav-terminal", label: "Sessions", hint: getTooltip("nav.sessions").body, group: "Navigate", keywords: "terminal console output", icon: TerminalSquare, run: () => navigate("/terminal") },
      { id: "nav-launch", label: "Launch Center", hint: getTooltip("nav.launch").body, group: "Navigate", keywords: "run start execute", icon: PlayCircle, run: () => navigate("/launch") },
      { id: "nav-deck", label: "Command Deck", hint: getTooltip("nav.deck").body, group: "Navigate", keywords: "cooldown gauge matrix popout handoff radar", icon: Gauge, run: () => navigate("/deck") },
      { id: "nav-activity", label: "Activity", hint: getTooltip("nav.activity").body, group: "Navigate", keywords: "history log radar diary", icon: CalendarDays, run: () => navigate("/activity") },
      { id: "nav-burn", label: "Token Ledger", hint: getTooltip("nav.burn").body, group: "Navigate", keywords: "token burn codex claude chatgpt ledger fermi", icon: Flame, run: () => navigate("/burn") },
      { id: "nav-bench", label: "Bench", hint: getTooltip("nav.bench").body, group: "Navigate", keywords: "bench ollama local model tokens latency benchmark", icon: Cpu, run: () => navigate("/bench") },
      { id: "nav-approvals", label: "Approvals", hint: getTooltip("nav.approvals").body, group: "Navigate", keywords: "coach approval phase4 gated launch memory audit", icon: ShieldCheck, run: () => navigate("/approvals") },
      { id: "nav-portfolio", label: "Portfolio", hint: getTooltip("nav.portfolio").body, group: "Navigate", keywords: "portfolio mvp launcher hub cineforge lookbook racegps brain git health cards", icon: Compass, run: () => navigate("/portfolio") },
      { id: "nav-pipeline", label: "Pipeline", hint: getTooltip("nav.pipeline").body, group: "Navigate", keywords: "pipeline milestones bridges portfolio project-brain integration matrix", icon: Workflow, run: () => navigate("/pipeline") },
      { id: "nav-memory", label: "Memory", hint: getTooltip("nav.memory").body, group: "Navigate", keywords: "notes learning evidence blocked", icon: BookOpen, run: () => navigate("/memory") },
      { id: "nav-builder", label: "Stack Builder", hint: getTooltip("nav.builder").body, group: "Navigate", keywords: "compose build wizard stack", icon: Sparkles, run: () => navigate("/builder") },
      { id: "nav-modules", label: "Modules", hint: getTooltip("nav.modules").body, group: "Navigate", keywords: "plugins skills mcp installer prefab", icon: Wrench, run: () => navigate("/modules") },
      { id: "nav-docs", label: "Documentation", hint: getTooltip("nav.docs").body, group: "Navigate", keywords: "docs guide readme plans operator manual", icon: BookText, run: () => navigate("/docs") },
      { id: "nav-settings", label: "Settings", hint: getTooltip("nav.settings").body, group: "Navigate", keywords: "config preferences keys hybrid core", icon: SettingsIcon, run: () => navigate("/settings") },
      { id: "act-scan", label: "Run system scan", hint: "Open Readiness and rescan agents, Ollama, GPU, RTK, and env keys", group: "Actions", keywords: "rescan detect refresh readiness", icon: ShieldCheck, run: () => navigate("/scan") },
      { id: "act-theme", label: "Toggle dark / light theme", hint: getTooltip("shell.theme").body, group: "Actions", keywords: "appearance mode color theme", icon: Moon, run: () => toggleTheme() },
      { id: "act-sidebar", label: "Toggle sidebar", hint: getTooltip("shell.sidebar.collapse").body, group: "Actions", keywords: "collapse expand dock nav sidebar", icon: PanelLeftClose, run: onToggleSidebar },
      { id: "act-handoff", label: "Generate handoff packet", hint: getTooltip("deck.handoff.generate").body, group: "Actions", keywords: "handoff packet switch provider dump save-state", icon: Sparkles, run: () => { navigate("/deck"); emitCoachAction("generate-handoff"); } },
      { id: "act-bootstrap", label: "Workspace setup wizard", hint: "Scan-driven onboarding: active project, layout, providers, and hybrid roots", group: "Actions", keywords: "onboarding bootstrap workspace setup", icon: Sparkles, run: () => { window.dispatchEvent(new CustomEvent("hoot-open-onboarding")); onClose(); } },
      { id: "act-claude-cd", label: "Mark Claude cooldown (3hr)", hint: "Mark Claude COOLDOWN in the provider matrix — opens Command Deck context", group: "Actions", keywords: "claude cooldown quota limit 3hr", icon: ShieldCheck, run: () => { api.patchProviderCooldown({ provider: "claude", preset: "3hr" }).catch(() => {}); navigate("/deck"); } },
      { id: "act-popout", label: "Open floating Command Deck", hint: getTooltip("deck.popout.open").body, group: "Actions", keywords: "popout pip floating monitor always on top", icon: Gauge, run: () => navigate("/deck") },
      { id: "act-owl-float", label: "Float HOOT owl above windows", hint: getTooltip("shell.hoot.float").body, group: "Actions", keywords: "owl ascii mascot pip always on top transparent float", icon: Gauge, run: () => window.dispatchEvent(new CustomEvent("hoot:open-owl-float")) },
      { id: "act-hybrid-settings", label: "Hybrid workspace settings", hint: "Workspace roots, auto handoff on cooldown, and provider matrix in Settings", group: "Navigate", keywords: "cooldown roots workspace hybrid", icon: SettingsIcon, run: () => navigate("/settings") },
    ],
    [navigate, onToggleSidebar, emitCoachAction],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.hint} ${c.keywords}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const runCommand = (cmd: PaletteCommand) => {
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[index]) runCommand(filtered[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = "";

  return (
    <div
      className="hoot-backdrop fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="w-full max-w-xl border border-border bg-popover text-popover-foreground shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 opacity-50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a view or run an action…"
            aria-label="Search commands"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2" role="listbox">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">No matching commands.</div>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            const groupHeader =
              cmd.group !== lastGroup ? (
                <div className="px-4 pb-1 pt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground opacity-70">
                  {cmd.group}
                </div>
              ) : null;
            lastGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {groupHeader}
                <button
                  data-index={i}
                  onClick={() => runCommand(cmd)}
                  onMouseMove={() => setIndex(i)}
                  role="option"
                  aria-selected={i === index}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    i === index ? "hoot-active-item" : "border border-transparent"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} className={i === index ? "hoot-gold-text" : "opacity-60"} />
                  <span className="flex-1 text-sm">{cmd.label}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:block">{cmd.hint}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
