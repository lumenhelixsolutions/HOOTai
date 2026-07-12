import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, Flame, PlayCircle, Radar, Scan, Sparkles, Wrench } from "lucide-react";
import { Button } from "antd";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useCoach } from "@/context/CoachContext";
import { BRAND } from "@/lib/brand";
import { useDashboardData } from "@/hooks/useDashboardData";
import { WidgetSkeleton, statusTone } from "@/components/dashboard/primitives";
import { asScanArray, normalizeLoadedModels } from "@/lib/scan-normalize";
import {
  ActiveProjectWidget,
  ExecutiveSummaryWidget,
  HeroReadinessWidget,
  MissionFlowWidget,
  NextActionsWidget,
  TokenBurnWidget,
  type Readiness,
  type SummaryItem,
} from "@/components/dashboard/widgets";


export default function Dashboard() {
  const toast = useToast();
  const { setPageContext, pageContext, registerActionHandler } = useCoach();
  const [switchingProject, setSwitchingProject] = useState(false);
  const [burnLoading, setBurnLoading] = useState(false);

  const [handoffBusy, setHandoffBusy] = useState(false);

  const data = useDashboardData(() => toast.showToast("Failed to load dashboard data", "error"));
  const { profiles, projects, activeProjectData, scan, portfolio, memory, tokenBurn, loading, failedSources, reload } = data;

  const activeProject = useMemo(() => {
    const fromActive = activeProjectData?.project;
    if (fromActive) return fromActive;
    const activePath = activeProjectData?.active;
    return projects.find((project: any) => project.path === activePath) || null;
  }, [activeProjectData, projects]);

  const profileCounts = useMemo(() => {
    const counts = { READY: 0, DEGRADED: 0, BLOCKED: 0, UNKNOWN: 0 };
    for (const profile of profiles) {
      const state = profile.state || profile.meta?.status || "UNKNOWN";
      counts[state as keyof typeof counts] = (counts[state as keyof typeof counts] || 0) + 1;
    }
    return counts;
  }, [profiles]);


  const activeIssues = useMemo(() => {
    if (!activeProject) return [];
    const item = (portfolio?.items || []).find(
      (entry: any) => entry.path === activeProject.path || entry.name === activeProject.name,
    );
    return item?.issues || [];
  }, [portfolio, activeProject]);

  const refreshBurn = async () => {
    setBurnLoading(true);
    try {
      const fresh = await api.getTokenBurn(true);
      data.setTokenBurn(fresh);
      setPageContext({
        tokenBurnRisk: fresh.risk?.level,
        tokenBurnSaved: fresh.formatted?.total_saved,
        rtkPresent: fresh.prevention?.rtk?.present,
      });
    } catch {
      toast.showToast("Failed to refresh token burn stats", "error");
    } finally {
      setBurnLoading(false);
    }
  };

  useEffect(() => {
    setPageContext({
      scanPresent: Boolean(scan),
      readyCount: profileCounts.READY,
      blockedCount: profileCounts.BLOCKED,
      portfolioIssues: activeIssues.length,
      tokenBurnRisk: tokenBurn?.risk?.level,
      tokenBurnSaved: tokenBurn?.formatted?.total_saved,
      rtkPresent: tokenBurn?.prevention?.rtk?.present,
    });
  }, [scan, profileCounts, activeIssues.length, tokenBurn, setPageContext]);

  useEffect(() => {
    return registerActionHandler((target) => {
      if (target === "token-burn-refresh") refreshBurn();
      if (target === "generate-handoff") generateHandoff();
      if (target === "session-bootstrap" || target === "open-onboarding") {
        window.dispatchEvent(new CustomEvent("hoot-open-onboarding"));
      }
    });
  }, [registerActionHandler]);

  const generateHandoff = async () => {
    setHandoffBusy(true);
    try {
      const packet = await api.generateHandoff();
      await navigator.clipboard.writeText(packet.markdown);
      toast.showToast("Handoff packet copied to clipboard", "success");
    } catch {
      toast.showToast("Failed to generate handoff", "error");
    } finally {
      setHandoffBusy(false);
    }
  };

  const readiness = useMemo<Readiness>(() => {
    if (!scan) {
      return {
        state: "UNKNOWN",
        headline: "Run a local scan to establish system readiness.",
        details: ["No system scan available yet", "Toolchain and model availability are unknown"],
      };
    }
    const coders = scan.coders || [];
    const installedCoders = coders.filter((coder: any) => coder.detection?.present).length;
    const localBackends = (scan.local_models?.backends || []).filter((backend: any) => backend.present).length;
    const details: string[] = [];
    if (!scan.tools?.ollama?.present) details.push("Ollama not detected");
    if (installedCoders === 0) details.push("No agent CLI detected");
    if (!activeProject) details.push("No active project selected");
    if (activeProject && !activeProject.hasAgentsMd) details.push("AGENTS.md missing for active project");
    const state = details.length === 0 ? "READY" : installedCoders > 0 || activeProject ? "DEGRADED" : "BLOCKED";
    return {
      state,
      headline:
        state === "READY"
          ? "System and project context are in place for local-first execution."
          : state === "BLOCKED"
            ? "You have first-run blockers to clear before reliable launches."
            : "You can proceed, but the next run will be stronger after a short setup pass.",
      details:
        details.length > 0
          ? details
          : [
              `${installedCoders}/${coders.length || installedCoders} agent tools detected`,
              `${localBackends} local model backends ready`,
            ],
    };
  }, [scan, activeProject]);

  const executiveSummary = useMemo<SummaryItem[]>(() => {
    const coders = asScanArray(scan?.coders);
    const installedCoders = coders.filter((coder: any) => coder.detection?.present).length;
    const loadedModels = normalizeLoadedModels(scan).length;
    const cleanProjects = projects.filter((project: any) => project.git?.clean).length;
    const radarTotal = Number(pageContext.agentRadarTotal) || 0;
    const radarExt = Number(pageContext.agentRadarExternal) || 0;
    const radarDock = Number(pageContext.agentRadarDock) || 0;
    const items: SummaryItem[] = [
      { label: "Readiness", value: statusTone[readiness.state]?.label || "Unknown", note: readiness.headline },
      { label: "Active project", value: activeProject?.name || "None selected", note: activeProject?.type || "Pick a repo to ground recommendations" },
      { label: "Profiles ready", value: `${profileCounts.READY}/${profiles.length || 0}`, note: `${profileCounts.DEGRADED} fixable · ${profileCounts.BLOCKED} blocked` },
      { label: "Toolchain", value: `${installedCoders}/${coders.length || 0} detected`, note: `${loadedModels} models loaded locally` },
      { label: "Project health", value: `${cleanProjects}/${projects.length || 0} clean`, note: activeIssues.length ? activeIssues.join(", ") : "No active-project issues surfaced" },
    ];
    if (radarTotal > 0) {
      items.push({
        label: "Agent radar",
        value: `${radarTotal} running`,
        note: radarExt > 0 ? `${radarExt} external · ${radarDock} docked` : `${radarDock} docked · HOOT monitoring`,
      });
    }
    if (tokenBurn) {
      items.push({
        label: "Token burn",
        value: tokenBurn.formatted.total_saved || tokenBurn.risk.level,
        note: tokenBurn.prevention.rtk.present
          ? `RTK on · ${tokenBurn.formatted.avg_savings_pct || "awaiting gain data"}`
          : `RTK missing · ${tokenBurn.risk.level} risk`,
      });
    }
    return items;
  }, [scan, projects, activeProject, readiness, profileCounts, profiles.length, activeIssues, pageContext, tokenBurn]);

  const recommendedActions = useMemo(() => {
    const actions: Array<{ title: string; body: string; to: string; icon: any }> = [];
    if (!scan) actions.push({ title: "Run the first scan", body: "Detect local agents, models, and machine capability before launch.", to: "/scan", icon: Scan });
    if (!activeProject) actions.push({ title: "Choose an active project", body: "HOOT works best when build, launch, and memory stay tied to a repo.", to: "/launch", icon: PlayCircle });
    if (activeProject && !activeProject.hasAgentsMd) actions.push({ title: "Add AGENTS.md context", body: "Document architecture and workflow so the next autonomous run is grounded.", to: "/settings", icon: Wrench });
    if (readiness.state !== "READY") actions.push({ title: "Resolve readiness gaps", body: "Review scan results and settings to clear blockers or missing pieces.", to: "/settings", icon: Wrench });
    if (tokenBurn?.risk?.level === "high") {
      actions.unshift({
        title: "Reduce token burn",
        body: "RTK is missing while shell-heavy agents are active — install prevention before long sessions.",
        to: "/scan",
        icon: Flame,
      });
    }
    if (Number(pageContext.agentRadarExternal) > 0) {
      actions.unshift({
        title: "Review external agents",
        body: `${pageContext.agentRadarExternal} coding agent(s) running ${BRAND.externalLabel} — see radar report on Readiness.`,
        to: "/scan",
        icon: Radar,
      });
    }
    if (actions.length === 0)
      actions.push({ title: "Move into Launch Review", body: "Your system looks ready. Review the staged path and continue with a guided launch.", to: "/launch", icon: PlayCircle });
    return actions.slice(0, 4);
  }, [scan, activeProject, readiness.state, pageContext.agentRadarExternal, tokenBurn?.risk?.level]);


  const handleProjectChange = async (path: string) => {
    setSwitchingProject(true);
    try {
      const result = await api.setActiveProject(path);
      const nextProjects = result?.projects || projects;
      data.setProjects(nextProjects);
      data.setActiveProjectData({
        active: result?.active || path,
        project: nextProjects.find((project: any) => project.path === (result?.active || path)) || null,
      });
      toast.showToast("Active project updated", "success");
    } catch {
      toast.showToast("Failed to switch active project", "error");
    } finally {
      setSwitchingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <WidgetSkeleton rows={4} title="Command center" />
        <div className="grid gap-[18px] lg:grid-cols-[1.25fr_0.95fr]">
          <WidgetSkeleton rows={4} title="Active project" />
          <WidgetSkeleton rows={4} title="Mission flow" />
        </div>
        <div className="grid gap-[18px] lg:grid-cols-2">
          <WidgetSkeleton title="Next actions" />
          <WidgetSkeleton title="Summary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <HeroReadinessWidget
        brandName={BRAND.name}
        activeProject={activeProject}
        readiness={readiness}
        summary={executiveSummary}
        scanFailed={failedSources.has("scan")}
        onRetry={reload}
      />

      <div className="grid gap-[18px] lg:grid-cols-[1.25fr_0.95fr]">
        <ActiveProjectWidget
          activeProject={activeProject}
          projects={projects}
          activeIssues={activeIssues}
          switching={switchingProject}
          failed={failedSources.has("projects")}
          onRetry={reload}
          onProjectChange={handleProjectChange}
        />
        <MissionFlowWidget
          scan={scan}
          activeProject={activeProject}
          hasContext={!!activeProject?.hasAgentsMd || Boolean(memory.trim())}
          hasProfiles={profiles.length > 0}
        />
      </div>

      <TokenBurnWidget
        data={tokenBurn}
        loading={burnLoading}
        failed={failedSources.has("tokenBurn")}
        onRefresh={refreshBurn}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="primary"
          size="small"
          loading={handoffBusy}
          onClick={generateHandoff}
          icon={<ClipboardCopy size={14} />}
        >
          {handoffBusy ? "Generating…" : "Generate handoff"}
        </Button>
        <Button
          size="small"
          onClick={() => window.dispatchEvent(new CustomEvent("hoot-open-onboarding"))}
          icon={<Sparkles size={14} />}
        >
          Workspace setup
        </Button>
      </div>


      <div className="grid gap-[18px] lg:grid-cols-2">
        <NextActionsWidget actions={recommendedActions} />
        <ExecutiveSummaryWidget summary={executiveSummary} />
      </div>


    </div>
  );
}
