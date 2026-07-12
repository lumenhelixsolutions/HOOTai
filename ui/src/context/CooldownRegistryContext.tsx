import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import type { CooldownRegistry } from "@/lib/cooldown";
import { SESSION_REFRESH_EVENT, isPageVisible } from "@/lib/session-poll";

export type CooldownRegistryValue = {
  registry: CooldownRegistry | null;
  loading: boolean;
  refreshing: boolean;
  failed: boolean;
  nowMs: number;
  reload: () => Promise<void>;
  patch: (body: {
    provider?: string;
    status?: string;
    cooldown_until?: string | null;
    preset?: string;
    current_session_provider?: string | null;
  }) => Promise<CooldownRegistry>;
  applyRegistry: (data: CooldownRegistry) => void;
};

const CooldownRegistryContext = createContext<CooldownRegistryValue | null>(null);

/**
 * Single shared cooldown registry for deck page, top-bar strip, popout, and matrix.
 * Manual refresh always fetches (latest response wins); no busy-drop.
 */
export function CooldownRegistryProvider({
  children,
  pollMs = 30000,
}: {
  children: ReactNode;
  pollMs?: number;
}) {
  const [registry, setRegistry] = useState<CooldownRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const requestSeq = useRef(0);

  const applyRegistry = useCallback((data: CooldownRegistry) => {
    setRegistry(data);
    setFailed(false);
  }, []);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    setRefreshing(true);
    setFailed(false);
    try {
      const data = (await api.getProviderCooldown()) as unknown as CooldownRegistry;
      if (seq !== requestSeq.current) return;
      applyRegistry(data);
    } catch {
      if (seq === requestSeq.current) setFailed(true);
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [applyRegistry]);

  const patch = useCallback(
    async (body: {
      provider?: string;
      status?: string;
      cooldown_until?: string | null;
      preset?: string;
      current_session_provider?: string | null;
    }) => {
      const data = (await api.patchProviderCooldown(body)) as unknown as CooldownRegistry;
      applyRegistry(data);
      return data;
    },
    [applyRegistry],
  );

  useEffect(() => {
    void reload();
    const poll = setInterval(() => {
      if (isPageVisible()) void reload();
    }, pollMs);
    return () => clearInterval(poll);
  }, [reload, pollMs]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const onSession = () => {
      if (isPageVisible()) void reload();
    };
    window.addEventListener(SESSION_REFRESH_EVENT, onSession);
    return () => window.removeEventListener(SESSION_REFRESH_EVENT, onSession);
  }, [reload]);

  const value: CooldownRegistryValue = {
    registry,
    loading,
    refreshing,
    failed,
    nowMs,
    reload,
    patch,
    applyRegistry,
  };

  return (
    <CooldownRegistryContext.Provider value={value}>{children}</CooldownRegistryContext.Provider>
  );
}

export function useCooldownRegistry(): CooldownRegistryValue {
  const ctx = useContext(CooldownRegistryContext);
  if (!ctx) {
    throw new Error("useCooldownRegistry must be used within CooldownRegistryProvider");
  }
  return ctx;
}