import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookText,
  Brain,
  Compass,
  ExternalLink,
  GitBranch,
  Link2,
  RefreshCw,
  Star,
  Workflow,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCoach } from "@/context/CoachContext";
import type { PipelineOverview, ProjectOverview } from "@/lib/pipeline-types";
import { Badge, MiniStat, Panel, WidgetError } from "@/components/dashboard/primitives";
import { useSessionPoll } from "@/hooks/useSessionPoll";

type PortfolioHealthItem = {
  name: string;
  path: string;
  type: string;
  hasGit: boolean;
  hasRemote?: boolean;
  clean?: boolean;
  issues: string[];
};

type DocEntry = {
  path: string;
  title: string;
  description: string;
};

type MvpCard = {
  name: string;
  path: string;
  type: string;
  role: string;
  active: boolean;
  git: { tone: string; label: string; issues: string[] };
  brain: { present: boolean; timestamp: string | null; hasPipelineWiki: boolean };
  nextBestMove: string | null;
  bridgeCount: number;
  bridges: Array<{ from: string; to: string; label: string }>;
  integration: { rtk: string; mcp: string; llamacpp: string } | null;
  docPath: string | null;
};

function gitHealth(item: PortfolioHealthItem | undefined) {
  if (!item) return { tone: "UNKNOWN", label: "Unknown", issues: [] as string[] };
  if (item.issues.includes("NO_GIT")) return { tone: "BLOCKED", label: "No git", issues: item.issues };
  if (item.issues.includes("NO_REMOTE")) return { tone: "DEGRADED", label: "No remote", issues: item.issues };
  if (item.issues.includes("UNCOMMITTED")) return { tone: "DEGRADED", label: "Uncommitted", issues: item.issues };
  return { tone: "READY", label: "Clean", issues: [] as string[] };
}

function projectBridges(name: string, bridges: PipelineOverview["bridges"]) {
  const lower = name.toLowerCase();
  return bridges.filter(
    (b) =>
      b.from.toLowerCase().includes(lower) ||
      b.to.toLowerCase().includes(lower) ||
      (lower === "hoot" && b.from.toLowerCase() === "hoot"),
  );
}

function findDocForProject(name: string, docs: DocEntry[]): string | null {
  const lower = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = docs.find((d) => {
    const pathKey = d.path.toLowerCase().replace(/[^a-z0-9]/g, "");
    const titleKey = d.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    return pathKey.includes(lower) || titleKey.includes(lower);
  });
  return hit?.path ?? null;
}

function MvpCardView({
  card,
  onSetActive,
  settingActive,
}: {
  card: MvpCard;
  onSetActive: (path: string) => void;
  settingActive: string | null;
}) {
  const excerpt = card.nextBestMove?.trim() || null;

  return (
    <article
      className={`hoot-card-soft flex h-full flex-col rounded-[20px] p-4 transition-colors ${
        card.active ? "ring-1 ring-[#ffb042]/35 bg-[#ffb042]/[0.04]" : ""
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-lg font-semibold tracking-[-0.02em] text-foreground">{card.name}</h3>
            {card.active && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#ffb042]/30 bg-[#ffb042]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[#ffb042]">
                <Star size={10} /> Active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed opacity-55">{card.role}</p>
          <p className="mt-1 font-mono text-[10px] opacity-35 truncate" title={card.path}>
            {card.path}
          </p>
        </div>
        <Badge text={card.git.label} tone={card.git.tone} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-foreground/[0.02] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] opacity-45">
            <Brain size={11} /> Brain
          </div>
          <div className="text-xs font-medium text-foreground">
            {card.brain.present ? (card.brain.hasPipelineWiki ? "State + wiki" : "Present") : "Missing"}
          </div>
          <div className="mt-0.5 text-[10px] opacity-45">{card.brain.timestamp || "No timestamp"}</div>
        </div>
        <div className="rounded-xl border border-border bg-foreground/[0.02] p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] opacity-45">
            <Link2 size={11} /> Bridges
          </div>
          <div className="text-xs font-medium text-foreground">{card.bridgeCount} connected</div>
          <div className="mt-0.5 text-[10px] opacity-45 truncate">
            {card.bridges[0] ? `${card.bridges[0].from} → ${card.bridges[0].to}` : "No bridges"}
          </div>
        </div>
      </div>

      <div className="mb-3 flex-1">
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] opacity-45">Next best move</div>
        {excerpt ? (
          <p className="line-clamp-4 text-xs leading-relaxed opacity-75 whitespace-pre-wrap">{excerpt}</p>
        ) : (
          <p className="text-xs leading-relaxed opacity-45">
            No current-state excerpt — add `.agentdock/project-brain/current-state.md`.
          </p>
        )}
      </div>

      {card.integration && (
        <div className="mb-3 flex flex-wrap gap-1.5 text-[10px] opacity-55">
          <span className="rounded-md border border-border px-1.5 py-0.5">RTK {card.integration.rtk}</span>
          <span className="rounded-md border border-border px-1.5 py-0.5">MCP {card.integration.mcp}</span>
          <span className="rounded-md border border-border px-1.5 py-0.5">llama.cpp {card.integration.llamacpp}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {!card.active && (
          <button
            type="button"
            onClick={() => onSetActive(card.path)}
            disabled={settingActive === card.path}
            className="rounded-lg border border-[#ffb042]/35 bg-[#ffb042]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#ffb042] hover:bg-[#ffb042]/15 disabled:opacity-50"
          >
            {settingActive === card.path ? "Setting…" : "Set active"}
          </button>
        )}
        <Link
          to="/pipeline"
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-foreground no-underline hover:bg-foreground/[0.04]"
        >
          <Workflow size={12} /> Pipeline
        </Link>
        {card.docPath && (
          <Link
            to={`/docs?doc=${encodeURIComponent(card.docPath)}`}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-foreground no-underline hover:bg-foreground/[0.04]"
          >
            <BookText size={12} /> Docs
          </Link>
        )}
        {card.brain.hasPipelineWiki && (
          <span className="inline-flex items-center gap-1 text-[10px] opacity-45">
            <ExternalLink size={10} /> wiki/pipeline-overview.md
          </span>
        )}
      </div>
    </article>
  );
}

export default function PortfolioPage() {
  const { setPageContext } = useCoach();
  const [health, setHealth] = useState<PortfolioHealthItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineOverview | null>(null);
  const [overviews, setOverviews] = useState<Record<string, ProjectOverview>>({});
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingActive, setSettingActive] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setRefreshing(true);
    setError(null);
    try {
      const [healthRes, pipelineRes] = await Promise.all([
        api.getPortfolioHealth(),
        api.getPortfolioPipeline(refresh),
      ]);
      const items: PortfolioHealthItem[] = healthRes?.items || [];
      setHealth(items);
      setPipeline(pipelineRes);

      const overviewEntries = await Promise.all(
        (pipelineRes.projects || []).map(async (p) => {
          try {
            const res = await api.getProjectOverview(p.path);
            return [p.path, res] as const;
          } catch {
            return [p.path, null] as const;
          }
        }),
      );
      const map: Record<string, ProjectOverview> = {};
      for (const [path, ov] of overviewEntries) {
        if (ov) map[path] = ov;
      }
      setOverviews(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useSessionPoll(() => load(true), { immediate: true });

  useEffect(() => {
    fetch("/docs/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setDocs(m?.docs || []))
      .catch(() => setDocs([]));
  }, []);

  const cards = useMemo<MvpCard[]>(() => {
    if (!pipeline) return [];
    const healthByPath = new Map(health.map((h) => [h.path, h]));
    const healthByName = new Map(health.map((h) => [h.name.toLowerCase(), h]));

    return pipeline.projects.map((p) => {
      const healthItem = healthByPath.get(p.path) || healthByName.get(p.name.toLowerCase());
      const matrix = pipeline.integration_matrix.find(
        (row) => row.project.toLowerCase() === p.name.toLowerCase(),
      );
      const bridges = projectBridges(p.name, pipeline.bridges);
      const overview = overviews[p.path];

      return {
        name: p.name,
        path: p.path,
        type: p.type,
        role: matrix?.role || p.type || "portfolio MVP",
        active: p.active,
        git: gitHealth(healthItem),
        brain: {
          present: p.brain.present,
          timestamp: p.brain.timestamp,
          hasPipelineWiki: p.brain.has_pipeline_overview,
        },
        nextBestMove: overview?.next_best_move || (p.active ? pipeline.active_project?.next_best_move : null) || null,
        bridgeCount: bridges.length,
        bridges,
        integration: matrix ? { rtk: matrix.rtk, mcp: matrix.mcp, llamacpp: matrix.llamacpp } : null,
        docPath: findDocForProject(p.name, docs),
      };
    });
  }, [pipeline, health, overviews, docs]);

  const stats = useMemo(() => {
    const brains = cards.filter((c) => c.brain.present).length;
    const gitIssues = cards.filter((c) => c.git.issues.length > 0).length;
    const bridged = cards.filter((c) => c.bridgeCount > 0).length;
    const ready = cards.filter((c) => c.git.tone === "READY").length;
    return { total: cards.length, brains, gitIssues, bridged, ready };
  }, [cards]);

  /** Season D1 — one calm narrative before the grid */
  const portfolioStory = useMemo(() => {
    if (!cards.length) {
      return {
        headline: "No portfolio projects registered yet",
        body: "Run a registry refresh or set an active project from Home so fleet health has something to narrate.",
        tone: "UNKNOWN" as const,
      };
    }
    const active = cards.find((c) => c.active);
    const attention = cards.filter((c) => c.git.issues.length > 0 || !c.brain.present);
    if (stats.gitIssues === 0 && stats.brains >= Math.max(1, Math.floor(stats.total / 2))) {
      return {
        headline: "Fleet is calm — git clean enough to hand off",
        body: active
          ? `Active focus is ${active.name}. ${stats.brains}/${stats.total} brains present · ${stats.bridged} bridge-linked. Drill into cards only if you need a specific MVP.`
          : `No active MVP selected. ${stats.ready}/${stats.total} git-clean · set active from a card before launches.`,
        tone: "READY" as const,
      };
    }
    if (attention.length > 0) {
      const names = attention.slice(0, 3).map((c) => c.name).join(", ");
      return {
        headline: "Fleet needs attention before multi-repo work",
        body: `Watch: ${names}${attention.length > 3 ? ` (+${attention.length - 3})` : ""}. Prefer fixing git/brain on the active project first, then expand.`,
        tone: "DEGRADED" as const,
      };
    }
    return {
      headline: "Fleet snapshot ready",
      body: `${stats.total} MVPs · ${stats.brains} brains · ${stats.bridged} bridges. Pick one active project and stay there for the session.`,
      tone: "UNKNOWN" as const,
    };
  }, [cards, stats]);

  useEffect(() => {
    if (!pipeline) return;
    setPageContext({
      portfolioMvpCount: cards.length,
      portfolioBrainCount: stats.brains,
      portfolioGitIssues: stats.gitIssues,
      activeProjectName: cards.find((c) => c.active)?.name || null,
    });
  }, [pipeline, cards, stats, setPageContext]);

  const handleSetActive = async (path: string) => {
    setSettingActive(path);
    try {
      await api.setActiveProject(path);
      await load(true);
    } finally {
      setSettingActive(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="hoot-card-soft h-64 animate-pulse rounded-[20px] p-4" />
        ))}
      </div>
    );
  }

  if (error || !pipeline) {
    return <WidgetError title="Portfolio hub" onRetry={() => load(true)} />;
  }

  return (
    <div className="flex max-w-[1200px] flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#ffb042]">
            <Compass size={18} />
            <span className="text-[11px] uppercase tracking-[0.16em] opacity-70">Fleet hub</span>
          </div>
          <h1 className="font-serif text-3xl font-normal tracking-[-0.02em] text-foreground">Portfolio MVPs</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed opacity-55">
            One fleet story first — then drill into MVP cards only when you need detail.
          </p>
          <p className="mt-1 text-[11px] opacity-40">
            {stats.total} repos · {stats.brains} brains · updated {new Date(pipeline.generated_at).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-[#ffb042]/35 bg-[#ffb042]/10 px-3.5 py-2 text-xs font-medium text-[#ffb042] hover:bg-[#ffb042]/15 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
          {refreshing ? "Refreshing…" : "Refresh registry"}
        </button>
      </header>

      {/* Season D1 — portfolio narrative */}
      <section
        className={`rounded-3xl border p-5 md:p-6 ${
          portfolioStory.tone === "READY"
            ? "border-emerald-400/25 bg-emerald-400/[0.05]"
            : portfolioStory.tone === "DEGRADED"
              ? "border-amber-400/30 bg-amber-400/[0.06]"
              : "border-border bg-foreground/[0.03]"
        }`}
        aria-label="Portfolio health story"
      >
        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] opacity-45">Fleet narrative</div>
        <h2 className="m-0 font-serif text-2xl tracking-[-0.02em] text-foreground">{portfolioStory.headline}</h2>
        <p className="mb-0 mt-2 max-w-3xl text-sm leading-relaxed opacity-70">{portfolioStory.body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/pipeline" className="text-xs font-medium text-primary hover:underline">
            Pipeline matrix →
          </Link>
          <Link to="/" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Operator spine on Home →
          </Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="MVPs" value={stats.total} />
        <MiniStat label="Brains present" value={stats.brains} />
        <MiniStat label="Git attention" value={stats.gitIssues} />
        <MiniStat label="Bridge-linked" value={stats.bridged} />
      </div>

      <Panel title="MVP launcher grid" subtitle="Portfolio hub" icon={Compass}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <MvpCardView key={card.path} card={card} onSetActive={handleSetActive} settingActive={settingActive} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Cross-repo bridges" subtitle="Quick scan" icon={Link2}>
          <div className="flex flex-col gap-2">
            {pipeline.bridges.slice(0, 5).map((b) => (
              <div key={`${b.from}-${b.to}`} className="rounded-xl border border-border bg-foreground/[0.02] px-3 py-2.5 text-xs">
                <div className="font-medium text-foreground">
                  {b.from} <span className="opacity-45">→</span> {b.to}
                </div>
                <div className="mt-1 opacity-55">{b.label}</div>
              </div>
            ))}
            <Link to="/pipeline" className="hoot-gold-text mt-1 inline-flex items-center gap-1.5 text-xs font-semibold no-underline">
              <Workflow size={13} /> Full pipeline matrix
            </Link>
          </div>
        </Panel>

        <Panel title="Git health legend" subtitle="From portfolio scan" icon={GitBranch}>
          <div className="flex flex-col gap-2 text-xs leading-relaxed opacity-65">
            <p>
              <Badge text="Clean" tone="READY" /> — committed working tree with remote configured.
            </p>
            <p>
              <Badge text="Uncommitted" tone="DEGRADED" /> — local changes need commit or stash before handoff.
            </p>
            <p>
              <Badge text="No remote" tone="DEGRADED" /> — git present but missing upstream remote.
            </p>
            <p className="opacity-55">
              Set the active MVP before launches so HOOT memory, scans, and coach context anchor to the right repo.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}