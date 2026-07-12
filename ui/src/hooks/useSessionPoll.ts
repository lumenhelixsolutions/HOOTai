import { useEffect, useRef } from "react";
import { SESSION_POLL_MS, SESSION_REFRESH_EVENT, isPageVisible } from "@/lib/session-poll";

type SessionPollOptions = {
  /** Run once on mount before the first interval (default true). */
  immediate?: boolean;
  /** Listen for global session refresh events from AppLayout (default true). */
  listenGlobal?: boolean;
  enabled?: boolean;
};

/**
 * Re-run `callback` on mount, every 30 minutes while the tab is visible,
 * and when the app dispatches a global session refresh.
 */
export function useSessionPoll(callback: () => void | Promise<void>, options: SessionPollOptions = {}) {
  const { immediate = false, listenGlobal = true, enabled = true } = options;
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (!isPageVisible()) return;
      void cbRef.current();
    };

    if (immediate) run();

    const interval = setInterval(run, SESSION_POLL_MS);

    const onGlobal = () => run();
    if (listenGlobal) window.addEventListener(SESSION_REFRESH_EVENT, onGlobal);

    return () => {
      clearInterval(interval);
      if (listenGlobal) window.removeEventListener(SESSION_REFRESH_EVENT, onGlobal);
    };
  }, [enabled, immediate, listenGlobal]);
}