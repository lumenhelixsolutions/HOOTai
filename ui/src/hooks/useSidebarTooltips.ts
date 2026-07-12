import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hoot_sidebar_tooltips";

/**
 * UI preference: show/hide the explanatory tooltips on the primary sidebar nav.
 * Persisted to localStorage so the choice survives reloads.
 */
export function useSidebarTooltips(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) setEnabled(raw === "true");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const save = useCallback((value: boolean) => {
    setEnabled(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* storage unavailable */
    }
  }, []);

  return [enabled, save];
}
