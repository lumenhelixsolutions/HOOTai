import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSessionPoll } from "@/hooks/useSessionPoll";
import type { TokenBurnReport } from "@/components/TokenBurnPanel";

export interface DashboardData {
  profiles: any[];
  projects: any[];
  activeProjectData: any;
  scan: any;
  usage: any;
  portfolio: any;
  research: any;
  memory: string;
  tokenBurn: TokenBurnReport | null;
}

export interface DashboardState extends DashboardData {
  loading: boolean;
  failedSources: Set<string>;
  reload: () => void;
  setProjects: (p: any[]) => void;
  setActiveProjectData: (d: any) => void;
  setTokenBurn: (t: TokenBurnReport | null) => void;
}

const EMPTY_DATA: DashboardData = {
  profiles: [],
  projects: [],
  activeProjectData: null,
  scan: null,
  usage: null,
  portfolio: null,
  research: null,
  memory: "",
  tokenBurn: null,
};

export function useDashboardData(onTotalFailure: () => void): DashboardState {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const failures = new Set<string>();

    api
      .getBootstrap()
      .then((bootstrap) => {
        if (cancelled || !mounted.current) return;
        setData({
          profiles: bootstrap.profiles || [],
          projects: bootstrap.projects?.projects || [],
          activeProjectData: bootstrap.activeProject || { active: bootstrap.projects?.active || null, project: null },
          scan: bootstrap.scan,
          usage: bootstrap.usage,
          portfolio: bootstrap.portfolio,
          research: null,
          memory: bootstrap.memory?.text || "",
          tokenBurn: bootstrap.tokenBurn || null,
        });
        setLoading(false);

        api.getResearch()
          .then((research) => {
            if (cancelled || !mounted.current) return;
            setData((prev) => ({ ...prev, research }));
          })
          .catch(() => {
            failures.add("research");
            if (!cancelled && mounted.current) setFailedSources(new Set(failures));
          });
      })
      .catch(async () => {
        const track = async <T,>(name: string, promise: Promise<T>, fallback: T): Promise<T> => {
          try {
            return await promise;
          } catch {
            failures.add(name);
            return fallback;
          }
        };
        const [profiles, projectData, activeData, scan, usage, portfolio, research, memoryData, tokenBurn] = await Promise.all([
          track("profiles", api.getProfiles(), [] as any[]),
          track("projects", api.getProjects(), { projects: [], active: null }),
          track("activeProject", api.getActiveProject(), { active: null, project: null }),
          track("scan", api.getScanCached().catch(() => api.runScan()), null),
          track("usage", api.getUsage(), null),
          track("portfolio", api.getPortfolioHealth(), null),
          track("research", api.getResearch(), null),
          track("memory", api.getMemory(), { text: "" }),
          track("tokenBurn", api.getTokenBurn(), null),
        ]);
        if (cancelled || !mounted.current) return;
        setData({
          profiles: profiles || [],
          projects: projectData?.projects || [],
          activeProjectData: activeData || { active: null, project: null },
          scan,
          usage,
          portfolio,
          research,
          memory: memoryData?.text || "",
          tokenBurn,
        });
        setLoading(false);
        if (failures.size >= 9) onTotalFailure();
        setFailedSources(new Set(failures));
      });

    return () => {
      cancelled = true;
    };
  }, [onTotalFailure, reloadKey]);

  useEffect(() => {
    if (!loading) setFailedSources((prev) => new Set(prev));
  }, [loading]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useSessionPoll(reload, { immediate: false });

  return useMemo(
    () => ({
      ...data,
      loading,
      failedSources,
      reload,
      setProjects: (projects: any[]) => setData((d) => ({ ...d, projects })),
      setActiveProjectData: (activeProjectData: any) => setData((d) => ({ ...d, activeProjectData })),
      setTokenBurn: (tokenBurn: TokenBurnReport | null) => setData((d) => ({ ...d, tokenBurn })),
    }),
    [data, loading, failedSources, reload],
  );
}
