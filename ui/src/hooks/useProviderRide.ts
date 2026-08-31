import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ProviderRideReport } from "@/lib/provider-ride";
import { isPageVisible, SESSION_REFRESH_EVENT } from "@/lib/session-poll";

const POLL_MS = 30000;

export function useProviderRide(pollMs = POLL_MS) {
  const [report, setReport] = useState<ProviderRideReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    if (!isPageVisible()) return;
    setRefreshing(true);
    try {
      const data = await api.getProviderRideDoctor();
      // Stale server may SPA-fallback HTML→empty object without score
      if (data && typeof data === "object" && (data.score || data.channels || data.available === false)) {
        setReport(data);
        setFailed(false);
        setErrorDetail(null);
      } else {
        setReport(null);
        setFailed(true);
        setErrorDetail("Stale H00T server (no doctor route) — restart: pwsh D:\\projects\\scripts\\start-hoot.ps1");
      }
    } catch (e) {
      setFailed(true);
      const msg = e instanceof Error ? e.message : String(e);
      if (/HTML instead of JSON/i.test(msg)) {
        setErrorDetail("Stale H00T server — restart so /api/providers/doctor is live");
      } else if (/Failed to fetch|NetworkError|ECONNREFUSED/i.test(msg)) {
        setErrorDetail("H00T not answering — start the server, then Retry");
      } else {
        setErrorDetail(msg || "Doctor request failed");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = setInterval(() => {
      if (isPageVisible()) void reload();
    }, pollMs);
    return () => clearInterval(id);
  }, [reload, pollMs]);

  useEffect(() => {
    const onRefresh = () => {
      void reload();
    };
    window.addEventListener(SESSION_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(SESSION_REFRESH_EVENT, onRefresh);
  }, [reload]);

  return { report, loading, failed, errorDetail, refreshing, reload };
}
