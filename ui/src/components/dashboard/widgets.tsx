import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Flame,
  FolderKanban,
  Layers3,
  PlayCircle,
  Radar,
  Scan,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  Wrench,
} from "lucide-react";
import TokenBurnPanel, { type TokenBurnReport } from "@/components/TokenBurnPanel";
import {
  ActionCard,
  Badge,
  BodyNote,
  EmptyState,
  LinkCard,
  MiniStat,
  Panel,
  SummaryCard,
  WidgetError,
  statusTone,
} from "./primitives";

export interface Readiness {
  state: string;
  headline: string;
  details: string[];
}

export interface SummaryItem {
  label: string;
  value: string;
  note: string;
}

const readinessSurface: Record<string, string> = {
  READY: "border-emerald-400/20 bg-emerald-400/[0.07]",
  DEGRADED: "border-amber-400/20 bg-amber-400/[0.07]",
  BLOCKED: "border-red-400/20 bg-red-400/[0.07]",
  UNKNOWN: "border-border bg-foreground/[0.04]",
};

/* ------------------------------------------------------------------ */
/* Hero: readiness headline + top summary cards                        */
/* ------------------------------------------------------------------ */
export function HeroReadinessWidget({
  brandName,
  activeProject,
  readiness,
  summary,
  scanFailed,
  onRetry,
}: {
  brandName: string;
  activeProject: any;
  readiness: Readiness;
  summary: SummaryItem[];
  scanFailed: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="hoot-card-soft rounded-3xl p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] md:p-7">
      <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_0.9fr]">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.18em] opacity-45">Command center</div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge text={statusTone[readiness.state]?.label || "Unknown"} tone={readiness.state} />
            <Badge text="Local-first" tone="UNKNOWN" />
          </div>
          <h1 className="m-0 font-serif text-[28px] leading-[1.05] tracking-[-0.04em] text-foreground md:text-4xl">
            {activeProject ? `${activeProject.name} command center` : `Prepare ${brandName} for the first run`}
          </h1>
          <p className="mb-0 mt-3.5 text-[15px] leading-relaxed opacity-70">
            {activeProject
              ? "See project readiness, session momentum, and the next highest-leverage action without leaving the home screen."
              : "Start with a scan, select a project, and add enough context so launches stay grounded, local-first, and recoverable."}
          </p>
          {scanFailed ? (
            <div className="mt-4">
              <WidgetError title="System scan" onRetry={onRetry} />
            </div>
          ) : (
            <div className={`mt-4 rounded-[18px] border p-4 ${readinessSurface[readiness.state] || readinessSurface.UNKNOWN}`}>
              <div className="text-sm font-semibold text-foreground">{readiness.headline}</div>
              <div className="mt-2.5 flex flex-col gap-2">
                {readiness.details.slice(0, 3).map((detail) => (
                  <div key={detail} className="flex items-start gap-2 text-xs opacity-75">
                    <CircleDot size={14} className="mt-px shrink-0" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-2.5">
          {summary.slice(0, 3).map((item) => (
            <SummaryCard key={item.label} label={item.label} value={item.value} note={item.note} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Active project context                                              */
/* ------------------------------------------------------------------ */
export function ActiveProjectWidget({
  activeProject,
  projects,
  activeIssues,
  switching,
  failed,
  onRetry,
  onProjectChange,
}: {
  activeProject: any;
  projects: any[];
  activeIssues: string[];
  switching: boolean;
  failed: boolean;
  onRetry: () => void;
  onProjectChange: (path: string) => void;
}) {
  const activeGit = activeProject?.git || {};
  return (
    <Panel title="Active project context" subtitle="Project-centered home" icon={Radar}>
      {failed ? (
        <WidgetError title="Project registry" onRetry={onRetry} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-2xl font-semibold tracking-[-0.04em] text-foreground">
                {activeProject?.name || "No active project"}
              </div>
              <div className="mt-1.5 truncate font-mono text-xs opacity-45">
                {activeProject?.path || "Choose a repo to anchor recommendations and launches"}
              </div>
            </div>
            <select
              value={activeProject?.path || ""}
              disabled={switching || projects.length === 0}
              onChange={(event) => onProjectChange(event.target.value)}
              aria-label="Active project"
              className="min-w-[230px] rounded-xl border border-border bg-foreground/[0.04] px-3 py-2.5 text-sm text-foreground"
            >
              <option value="">No active project</option>
              {projects.map((project) => (
                <option key={project.path} value={project.path}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {activeProject ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge text={activeProject.type || "unknown"} tone="UNKNOWN" />
                <Badge
                  text={activeGit.present ? `branch:${activeGit.branch || "none"}` : "no git repo"}
                  tone={activeGit.present ? "READY" : "UNKNOWN"}
                />
                <Badge text={activeGit.clean ? "git clean" : `dirty ${activeGit.uncommitted || 0}`} tone={activeGit.clean ? "READY" : "DEGRADED"} />
                <Badge
                  text={activeProject.hasAgentsMd ? "AGENTS.md ready" : "AGENTS.md missing"}
                  tone={activeProject.hasAgentsMd ? "READY" : "DEGRADED"}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MiniStat label="Modified" value={activeGit.modified ?? 0} />
                <MiniStat label="Untracked" value={activeGit.untracked ?? 0} />
                <MiniStat label="Ahead / Behind" value={`${activeGit.ahead ?? 0} / ${activeGit.behind ?? 0}`} />
                <MiniStat label="Risk flags" value={activeIssues.length} />
              </div>
              <div className="hoot-card-soft mt-4 rounded-[18px] p-4">
                <div className="mb-2.5 text-xs uppercase tracking-[0.14em] opacity-45">Why this matters</div>
                <div className="text-sm leading-relaxed opacity-75">
                  The active project is the operating context for readiness checks, memory, portfolio risk, and profile
                  selection. This keeps the home screen oriented around real work instead of raw controls.
                </div>
                <Link
                  to="/pipeline"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  Pipeline overview <ArrowRight size={12} />
                </Link>
              </div>
              {activeIssues.length > 0 && (
                <div className="mt-4 rounded-[18px] border border-red-400/20 bg-red-400/[0.05] p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-red-400">
                    <AlertTriangle size={16} /> Active project watchlist
                  </div>
                  {activeIssues.map((issue, index) => (
                    <div key={index} className="text-[13px] leading-relaxed opacity-85">
                      • {issue}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No active project selected"
              body="Pick a local repository so HOOT can give project-aware recommendations, first-run setup guidance, and cleaner session recovery context."
              actionLabel="Open Launch Center"
              actionTo="/launch"
            />
          )}
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* First-run mission flow                                              */
/* ------------------------------------------------------------------ */
export function MissionFlowWidget({
  scan,
  activeProject,
  hasContext,
  hasProfiles,
}: {
  scan: any;
  activeProject: any;
  hasContext: boolean;
  hasProfiles: boolean;
}) {
  const steps = [
    { number: "01", title: "Scan the machine", body: "Detect installed frontends, local model backends, and environment capability before promising a launch path.", ready: !!scan },
    { number: "02", title: "Choose the operating project", body: "Set the repo that should anchor recommendations, memory, and portfolio context.", ready: !!activeProject },
    { number: "03", title: "Add agent context", body: "Confirm AGENTS.md or memory notes exist before the first autonomous handoff.", ready: hasContext },
    { number: "04", title: "Launch with confidence", body: "Move into Launch Center once readiness is green or known tradeoffs are understood.", ready: hasProfiles },
  ];
  return (
    <Panel title="First-run mission flow" subtitle="Operating loop" icon={Workflow}>
      <div className="flex flex-col gap-3">
        {steps.map((step) => (
          <div key={step.number} className="hoot-card-soft grid grid-cols-[56px_1fr_auto] items-start gap-3 rounded-2xl p-3.5">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-[14px] text-[13px] font-bold ${
                step.ready ? "bg-emerald-400/10 text-emerald-400" : "bg-foreground/5 text-muted-foreground"
              }`}
            >
              {step.number}
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{step.title}</div>
              <div className="mt-1 text-[13px] leading-relaxed opacity-65">{step.body}</div>
            </div>
            {step.ready ? (
              <CheckCircle2 size={18} className="text-emerald-400" />
            ) : (
              <AlertTriangle size={18} className="text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Operator spine — Season A3 golden path CTA                          */
/* ------------------------------------------------------------------ */
export type SpineStepId = "scan" | "brain" | "project" | "launch" | "session";

export type SpineStep = {
  id: SpineStepId;
  number: string;
  title: string;
  body: string;
  ready: boolean;
  primaryLabel: string;
  kind: "hitl" | "nav" | "done";
  command?: Record<string, unknown>;
  to?: string;
};

export function OperatorSpineWidget({
  steps,
  currentId,
  onPrimary,
  busy,
}: {
  steps: SpineStep[];
  currentId: SpineStepId | "complete";
  onPrimary: (step: SpineStep) => void;
  busy?: boolean;
}) {
  const current = steps.find((s) => s.id === currentId) || null;
  const allReady = currentId === "complete";

  return (
    <section
      className="hoot-card-soft rounded-3xl border border-[rgba(255,176,66,0.22)] bg-[rgba(255,176,66,0.05)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] md:p-6"
      aria-label="Operator spine"
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] opacity-45">Golden path · Season A</div>
          <h2 className="m-0 font-serif text-2xl tracking-[-0.03em] text-foreground">
            Operator spine
          </h2>
        </div>
        {allReady ? (
          <Badge text="Ready to operate" tone="READY" />
        ) : (
          <Badge text="Next step required" tone="DEGRADED" />
        )}
      </div>
      <p className="mb-4 mt-1 max-w-2xl text-sm leading-relaxed opacity-70">
        One spine: scan → local brain → project → launch (HITL) → session. Mutations always wait for your Approve.
      </p>

      <ol className="m-0 mb-4 grid list-none gap-2 p-0 sm:grid-cols-5">
        {steps.map((step) => {
          const active = step.id === currentId;
          return (
            <li
              key={step.id}
              className={`rounded-2xl border p-3 ${
                step.ready
                  ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                  : active
                    ? "border-[rgba(255,176,66,0.4)] bg-[rgba(255,176,66,0.1)]"
                    : "border-border bg-foreground/[0.03]"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">{step.number}</span>
                {step.ready ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : active ? (
                  <CircleDot size={14} className="text-[var(--hoot-gold)]" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border border-border" />
                )}
              </div>
              <div className="text-xs font-semibold text-foreground">{step.title}</div>
              <div className="mt-1 text-[11px] leading-snug opacity-55 line-clamp-3">{step.body}</div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        {allReady ? (
          <>
            <Link
              to="/launch"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--hoot-gold)] px-4 py-2.5 text-sm font-semibold text-[var(--hoot-ink)]"
            >
              <PlayCircle size={16} /> Open Launch Center
            </Link>
            <Link to="/terminal" className="text-sm text-primary hover:underline">
              Open Session →
            </Link>
          </>
        ) : current ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPrimary(current)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--hoot-gold)] px-4 py-2.5 text-sm font-semibold text-[var(--hoot-ink)] disabled:opacity-50"
            >
              <PlayCircle size={16} />
              {busy ? "Working…" : current.primaryLabel}
            </button>
            {current.kind === "hitl" && (
              <span className="text-[11px] opacity-55">Opens approval sheet — nothing runs until you Approve</span>
            )}
            {current.to && current.kind === "nav" && (
              <Link to={current.to} className="text-sm text-muted-foreground hover:text-foreground">
                Or open page →
              </Link>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Token burn                                                          */
/* ------------------------------------------------------------------ */
export function TokenBurnWidget({
  data,
  loading,
  failed,
  onRefresh,
}: {
  data: TokenBurnReport | null;
  loading: boolean;
  failed: boolean;
  onRefresh: () => void;
}) {
  return (
    <Panel title="Token burn prevention" subtitle="RTK · shell output savings" icon={Flame}>
      {failed && !data ? (
        <WidgetError title="Token burn report" onRetry={onRefresh} />
      ) : (
        <TokenBurnPanel data={data} loading={loading} onRefresh={onRefresh} />
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Recommended actions + executive summary                             */
/* ------------------------------------------------------------------ */
export function NextActionsWidget({ actions }: { actions: Array<{ title: string; body: string; to: string; icon: any }> }) {
  return (
    <Panel title="Recommended next actions" subtitle="Do this next" icon={PlayCircle}>
      <div className="grid gap-2.5">
        {actions.map((action) => (
          <ActionCard key={action.title} to={action.to} icon={action.icon} title={action.title} body={action.body} />
        ))}
      </div>
    </Panel>
  );
}

export function ExecutiveSummaryWidget({ summary }: { summary: SummaryItem[] }) {
  return (
    <Panel title="Cleaner executive summary" subtitle="At-a-glance status" icon={ShieldCheck}>
      <div className="grid gap-2.5">
        {summary.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} note={item.note} />
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Suggested profiles                                                  */
/* ------------------------------------------------------------------ */
export function SuggestedProfilesWidget({ profiles, failed, onRetry }: { profiles: any[]; failed: boolean; onRetry: () => void }) {
  return (
    <Panel title="Suggested profiles" subtitle="Launch candidates" icon={Layers3}>
      {failed ? (
        <WidgetError title="Profile catalog" onRetry={onRetry} />
      ) : profiles.length > 0 ? (
        profiles.map((profile: any) => {
          const state = profile.state || profile.meta?.status || "UNKNOWN";
          return (
            <div key={profile.id} className="hoot-card-soft mb-2.5 rounded-2xl p-3.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{profile.name}</div>
                  <div className="mt-1 truncate text-xs opacity-50">
                    {profile.meta?.mode || "unknown mode"} · {profile.meta?.model || "model not specified"}
                  </div>
                </div>
                <Badge text={statusTone[state]?.label || state} tone={state} />
              </div>
            </div>
          );
        })
      ) : (
        <BodyNote>No profiles discovered yet.</BodyNote>
      )}
      <LinkCard to="/profiles" label="Review full profile catalog" />
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Recent sessions                                                     */
/* ------------------------------------------------------------------ */
export function RecentSessionsWidget({ outcomes, failed, onRetry }: { outcomes: any[]; failed: boolean; onRetry: () => void }) {
  return (
    <Panel title="Recent sessions" subtitle="Operational signal" icon={TerminalSquare}>
      {failed ? (
        <WidgetError title="Usage history" onRetry={onRetry} />
      ) : outcomes.length > 0 ? (
        outcomes.map((outcome: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
            <div className="min-w-0">
              <div className="truncate text-sm text-foreground">{outcome.profileName}</div>
              <div className="mt-0.5 text-[11px] opacity-45">
                {outcome.timestamp ? new Date(outcome.timestamp).toLocaleString() : "Unknown time"}
              </div>
            </div>
            <Badge
              text={outcome.outcome || "observed"}
              tone={outcome.outcome === "success" ? "READY" : outcome.outcome === "failure" ? "BLOCKED" : "DEGRADED"}
            />
          </div>
        ))
      ) : (
        <BodyNote>No launch outcomes yet.</BodyNote>
      )}
      <LinkCard to="/terminal" label="Open terminal control room" />
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Evidence + research                                                 */
/* ------------------------------------------------------------------ */
export function EvidenceResearchWidget({ evidenceBlocks, research }: { evidenceBlocks: string[]; research: any }) {
  return (
    <Panel title="Evidence and research" subtitle="Trust layer" icon={Sparkles}>
      {evidenceBlocks.length > 0 ? (
        evidenceBlocks.map((block, index) => {
          const title = block.match(/## Evidence:\s*(.+)/)?.[1]?.trim() || `Evidence ${index + 1}`;
          const status = block.match(/Status:\s*(.+)/)?.[1]?.trim().toUpperCase() || "UNKNOWN";
          const tone = statusTone[status] || statusTone.UNKNOWN;
          return (
            <div key={index} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
              <div className="truncate text-sm text-foreground">{title}</div>
              <Badge text={tone.label} tone={status} />
            </div>
          );
        })
      ) : (
        <BodyNote>No local evidence yet.</BodyNote>
      )}
      {research?.text && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] opacity-40">Latest research brief</div>
          <div className="text-[13px] leading-relaxed opacity-70">
            {String(research.text).slice(0, 220)}
            {String(research.text).length > 220 ? "…" : ""}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Quick links                                                         */
/* ------------------------------------------------------------------ */
export function QuickLinksWidget({ profileCount }: { profileCount: number }) {
  const links = [
    { to: "/scan", icon: Scan, label: "System Scan", desc: "Refresh local readiness" },
    { to: "/launch", icon: PlayCircle, label: "Launch Center", desc: "Preview and start stacks", highlight: true },
    { to: "/profiles", icon: Layers3, label: "Profiles", desc: `${profileCount} agent profiles` },
    { to: "/terminal", icon: TerminalSquare, label: "Terminal", desc: "Monitor sessions" },
    { to: "/settings", icon: Wrench, label: "Settings", desc: "Models and configuration" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {links.map(({ to, icon: Icon, label, desc, highlight }) => (
        <Link
          key={to}
          to={to}
          className={`flex flex-col gap-2.5 rounded-2xl border p-3.5 no-underline ${
            highlight ? "hoot-gold-chip" : "hoot-card-soft text-foreground"
          }`}
        >
          <div className="flex items-center justify-between">
            <Icon size={18} className={highlight ? "hoot-gold-text" : "opacity-60"} />
            <ArrowRight size={15} className={highlight ? "hoot-gold-text" : "opacity-50"} />
          </div>
          <div>
            <div className={`text-sm font-semibold ${highlight ? "" : "text-foreground"}`}>{label}</div>
            <div className="mt-1 text-xs opacity-50">{desc}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
