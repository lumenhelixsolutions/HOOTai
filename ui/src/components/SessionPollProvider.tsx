import { useEffect } from "react";
import { SESSION_POLL_MS, dispatchSessionRefresh, isPageVisible } from "@/lib/session-poll";

/** Fires a global refresh on mount and every 30 minutes while the HOOT tab is visible. */
export default function SessionPollProvider() {
  useEffect(() => {
    const tick = () => {
      if (isPageVisible()) dispatchSessionRefresh();
    };
    tick();
    const id = setInterval(tick, SESSION_POLL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}